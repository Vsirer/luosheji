
import express from "express";
import fs from "fs";
import path from "path";
import dns from "dns";

// Optimize DNS lookup to prefer IPv4 first inside containers to prevent fetch failed errors
dns.setDefaultResultOrder("ipv4first");

fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `Server starting at ${new Date().toISOString()}\n`);

let containerIp = 'unknown';
// Fetch outbound IP for debugging whitelist issues
try {
  fetch('https://api.ipify.org').then(r => r.text()).then(ip => {
    containerIp = ip;
    fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `Container Outbound IP: ${ip}\n`);
  }).catch(e => {
    fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `Failed to fetch outbound IP: ${e.message}\n`);
  });
} catch (e) {}
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Agent, setGlobalDispatcher } from 'undici';
import { Config } from "./types.ts";
import { GoogleGenAI, Type } from "@google/genai";
import { volcFetch } from "./lib/volcengine";
import { imageAgent } from "./services/imageAgent";
import { videoAgent } from "./services/videoAgent";
import db, { initDb, getLastError, testDatabaseConnection, repairDatabaseSchema } from "./services/database";
import { testOSSConnection, updateOSSConfig, getOSSClient, uploadToOSS } from "./services/oss";
import { persistFromBase64, persistFromUrl } from "./services/storage";
import { execSync } from "child_process";
import crypto from "crypto";

const __filename_path = typeof __filename !== 'undefined' ? __filename : path.join(process.cwd(), 'server.ts');
const __dirname_path = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

import sharp from "sharp";
import { SYSTEM_SKILLS } from "./skills/definitions";

// Global dispatcher configuration remains same
const globalAgent = new Agent({
  headersTimeout: 1800000, // 30 minutes
  bodyTimeout: 1800000,    // 30 minutes
  connectTimeout: 60000,   // 1 minute
});
setGlobalDispatcher(globalAgent);

const DEFAULT_API_CONFIG = {
  script: {
    provider: 'Third Party',
    endpoint: 'https://api.vectorengine.ai',
    path: '/v1beta/models/gemini-3.5-flash:generateContent',
    model: 'gemini-3.5-flash',
    apiKey: '',
    protocolType: 'openai'
  },
  image: {
    provider: 'Third Party',
    endpoint: 'https://api.vectorengine.ai',
    path: '/v1beta/models/gemini-3.1-flash-image-preview',
    model: 'gemini-3.1-flash-image-preview',
    apiKey: '',
    protocolType: 'openai'
  },
  video: {
    provider: 'Google',
    endpoint: 'https://generativelanguage.googleapis.com',
    path: '/v1beta/models/veo-3.1-generate-preview:generateVideos',
    model: 'veo-3.1-generate-preview',
    apiKey: '',
  },
  videoVeoFast: {
    provider: 'Google',
    endpoint: 'https://generativelanguage.googleapis.com',
    path: '/v1beta/models/veo-3.1-fast-generate-preview:generateVideos',
    model: 'veo-3.1-fast-generate-preview',
    apiKey: '',
  },
  videoSeedance: {
    provider: 'Seedance',
    endpoint: 'https://www.runninghub.cn/openapi/v2/rhart-video/sparkvideo-2.0/multimodal-video',
    path: '',
    model: 'seedance2.0',
    apiKey: '',
    project: '',
    accessKeyId: '',
    secretKey: ''
  },
  videoSeedanceMini: {
    provider: 'Seedance',
    endpoint: 'https://www.runninghub.cn/openapi/v2/rhart-video/sparkvideo-2.0-mini/multimodal-video',
    path: '',
    model: 'seedance-mini',
    apiKey: '',
    project: '',
    accessKeyId: '',
    secretKey: ''
  },
  videoOmni: {
    provider: 'Third Party',
    endpoint: 'https://api.vectorengine.ai',
    path: '',
    model: 'omni-flash',
    apiKey: '',
    protocolType: 'openai'
  },
  gptImage: {
    provider: 'Third Party',
    endpoint: 'https://api.vectorengine.ai',
    path: '',
    model: 'gpt-image-2',
    apiKey: '',
    protocolType: 'openai'
  },
  claudeSonnet: {
    provider: 'Third Party',
    endpoint: 'https://api.vectorengine.ai',
    path: '',
    model: 'Claude-sonnet-5',
    apiKey: '',
    protocolType: 'openai'
  }
};

const getJwtSecret = () => process.env.JWT_SECRET || "default_secret";

let aiServer: GoogleGenAI | null = null;
const getAiServer = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(">>> [AI-Config] GEMINI_API_KEY is MISSING! Gemini features will fail.");
    return null;
  }
  if (!aiServer) {
    aiServer = new GoogleGenAI({ apiKey });
  }
  return aiServer;
};

let dbInitialized = false;

const safeParseJson = (val: any, defaultVal: any = null) => {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'object') return val;
  if (typeof val !== 'string') return defaultVal;
  if (val === '[object Object]') return defaultVal;
  try {
    const parsed = JSON.parse(val);
    return parsed === null ? defaultVal : parsed;
  } catch (e) {
    console.error("Failed to parse JSON from DB:", val, e);
    return defaultVal;
  }
};

async function startServer() {
  console.log('--- Startup Diagnostic ---');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('DB_HOST:', process.env.DB_HOST || '(EMPTY)');
  console.log('DB_USER:', process.env.DB_USER || '(EMPTY)');
  console.log('DB_NAME:', process.env.DB_NAME || '(EMPTY)');
  console.log('--------------------------');

  // Global error handler for uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('>>> [CRITICAL] Uncaught Exception:', err);
    fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `[${new Date().toISOString()}] CRITICAL UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}\n`);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('>>> [CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
    fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `[${new Date().toISOString()}] CRITICAL UNHANDLED REJECTION: ${reason}\n`);
  });

  const app = express();
  const PORT = 3000;

  // Start listening IMMEDIATELY to prevent 502 Bad Gateway
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> [SERVER] Web service started on http://0.0.0.0:${PORT}`);
    console.log(`>>> [SERVER] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  });

  // Initialize database in the background with retry logic
  const initializeDatabaseWithRetry = async (retries = 0) => {
    console.log(`>>> [DEBUG] Initializing database (Attempt ${retries + 1})...`);
    fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `Calling initDb (async) at ${new Date().toISOString()} - Attempt ${retries + 1}\n`);
    
    try {
      await initDb();
      fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `initDb completed at ${new Date().toISOString()}\n`);
      dbInitialized = true;
      console.log('>>> [DEBUG] Database initialized successfully.');

      // Clean up any obsolete/misplaced plugins from the ai_skills table so they don't appear as SKILLs
      try {
        await db.query("DELETE FROM ai_skills WHERE id IN ('perspective-sim', 'point-and-shoot', 'camera-control')");
        console.log('>>> [DEBUG] Cleaned up obsolete plugins from ai_skills table.');
      } catch (err) {
        console.error("Failed to clean up obsolete plugins from ai_skills:", err);
      }

      // Seed default skills
      try {
        const [deletedRows]: any = await db.query('SELECT value FROM settings WHERE `key` = ?', ['deleted_system_skills']);
        const deletedSet = new Set<string>();
        if (deletedRows.length > 0) {
          try {
            const parsed = JSON.parse(deletedRows[0].value);
            if (Array.isArray(parsed)) {
              parsed.forEach((id: string) => deletedSet.add(id));
            }
          } catch (e) {
            console.error("Failed to parse deleted_system_skills settings:", e);
          }
        }

        for (const s of SYSTEM_SKILLS) {
          if (deletedSet.has(s.id)) {
            continue;
          }
          const [exists]: any = await db.query('SELECT id FROM ai_skills WHERE id = ?', [s.id]);
          const customOptionsStr = s.customOptions ? JSON.stringify(s.customOptions) : null;
          if (exists.length === 0) {
            await db.query(
              'INSERT INTO ai_skills (id, name, `desc`, icon, instruction, creator_id, creator_name, is_public, is_system, tier, custom_options, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [s.id, s.name, s.desc || "", s.icon || "⚙️", s.instruction, null, "官方默认", 1, 1, s.tier || "light", customOptionsStr, s.category || "text"]
            );
            console.log(`Seeded default system skill: ${s.name}`);
          } else {
            // Update existing system skill options and instructions to stay synchronized with definitions
            await db.query(
              'UPDATE ai_skills SET name = ?, `desc` = ?, icon = ?, instruction = ?, tier = ?, custom_options = ?, category = ? WHERE id = ?',
              [s.name, s.desc || "", s.icon || "⚙️", s.instruction, s.tier || "light", customOptionsStr, s.category || "text", s.id]
            );
          }
        }
      } catch (err) {
        console.error("Failed to seed default skills:", err);
      }

      // Load OSS config from database
      try {
        const [rows]: any = await db.query('SELECT value FROM settings WHERE `key` = ?', ['oss_config']);
        if (rows.length > 0) {
          const val = rows[0].value;
          const config = safeParseJson(val);
          if (config) {
            updateOSSConfig(config);
            console.log('OSS configuration loaded from database');
          }
        }

      // Migrate global_api_config if needed
      const [apiRows]: any = await db.query('SELECT value FROM settings WHERE `key` = ?', ['global_api_config']);
      if (apiRows.length > 0) {
        let val = apiRows[0].value;
        if (typeof val === 'string') {
          const config = JSON.parse(val);
          let changed = false;
          
          // Migrate models
          if (config.script) {
            if (config.script.model === 'gemini-1.5-pro') {
              config.script.model = 'gemini-3.1-pro';
              changed = true;
            }
            if (config.script.path?.includes('gemini-1.5-pro')) {
              config.script.path = config.script.path.replace('gemini-1.5-pro', 'gemini-3.1-pro');
              changed = true;
            }
          }
          if (config.image) {
            if (config.image.model === 'gemini-1.5-flash') {
              config.image.model = 'gemini-3.1-flash-image-preview';
              config.image.path = '/v1beta/models/gemini-3.1-flash-image-preview';
              changed = true;
            }
          }
          if (config.gptImage) {
            if (config.gptImage.model === 'gemini-3-flash-preview') {
              config.gptImage.model = 'gpt-image-2';
              changed = true;
            }
          }

          // Ensure all keys from DEFAULT_API_CONFIG exist
          for (const key of Object.keys(DEFAULT_API_CONFIG)) {
            if (!config[key]) {
              config[key] = { ...(DEFAULT_API_CONFIG as any)[key] };
              changed = true;
              console.log(`✅ Added missing config slot: ${key}`);
            }
          }

          if (changed) {
            await db.query('UPDATE settings SET value = ? WHERE `key` = ?', [JSON.stringify(config), 'global_api_config']);
            console.log('✅ Global API config migrated and updated');
          }
        }
      }
      } catch (error) {
        console.error('Failed to load configuration or migrate from database:', error);
      }
    } catch (err: any) {
      console.error(`Database initialization failed (Attempt ${retries + 1}):`, err.message);
      fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `initDb FAILED at ${new Date().toISOString()}: ${err.message}\n`);
      
      // Set to true so the app can at least use SQLite fallback while retrying
      dbInitialized = true;

      // Retry logic: Retry every 30 seconds if it's a connection error
      const isConnectionError = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || err.message.includes('Access denied');
      
      if (isConnectionError && retries < 100) { // Keep retrying for a long time
        console.log('>>> [DEBUG] Will retry database initialization in 30 seconds...');
        setTimeout(() => initializeDatabaseWithRetry(retries + 1), 30000);
      } else {
        console.warn('>>> [DEBUG] Max retries reached or non-recoverable error. Falling back to SQLite (handled by initDb).');
      }
    }
  };

  initializeDatabaseWithRetry();
  
  // Diagnostic for AI Key
  const aiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  console.log(`>>> [AI-Config] GEMINI_API_KEY is ${aiKey ? 'PRESENT (First 4: ' + aiKey.substring(0, 4) + '...)' : 'MISSING'}`);
  fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `[AI-Config] GEMINI_API_KEY: ${aiKey ? 'PRESENT' : 'MISSING'}\n`);

  // Trust proxy for accurate rate limiting behind Cloud Run/Nginx
  app.set('trust proxy', 1);

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for Vite dev mode compatibility
    crossOriginEmbedderPolicy: false
  }));

  // Rate Limiting — Disabled at user request
  // const limiter = rateLimit({
  //   windowMs: 15 * 60 * 1000, // 15 minutes
  //   max: 2000, // Increased from 100 to 2000 to support heavy tasks like script decomposition
  //   standardHeaders: true,
  //   legacyHeaders: false,
  //   handler: (req, res, next, options) => {
  //     res.status(options.statusCode).json(options.message);
  //   },
  //   message: { error: "Too many requests, please try again later." }
  // });
  // app.use("/api/", limiter);

  // Auth Limiter for login/register — Disabled at user request
  // const authLimiter = rateLimit({
  //   windowMs: 3 * 60 * 1000, // 3 minutes
  //   max: 5, // Limit each IP to 5 failed attempts per 3 minutes
  //   skipSuccessfulRequests: true,
  //   handler: (req, res, next, options) => {
  //     res.status(options.statusCode).json(options.message);
  //   },
  //   message: { error: "尝试次数过多，请在3分钟后重试" }
  // });
  // app.use("/api/auth/", authLimiter);

  app.use(cors());
  app.use(express.json({ limit: '256mb' }));
  app.use(express.urlencoded({ limit: '256mb', extended: true }));

  // Serve local uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Database Connection Check Middleware
  app.use((req, res, next) => {
    // Prevent EPIPE crashes by handling response errors globally
    res.on('error', (err: any) => {
      if (err.code === 'EPIPE') {
        // Silently catch EPIPE errors when client disconnects
        return;
      }
      console.warn(`[Response Error] ${req.method} ${req.path}:`, err.message);
    });

    const bypassPaths = [
      '/api/db-status', 
      '/api/health', 
      '/api/admin/storage-test', 
      '/api/admin/storage-config',
      '/api/admin/storage-repair',
      '/api/auth/login', // Allow login attempt even if DB is down (it will fail gracefully)
      '/api/auth/register',
      '/api/auth/verify-forgot',
      '/api/auth/reset-forgot'
    ];
    if (!dbInitialized && req.path.startsWith('/api/') && !bypassPaths.includes(req.path)) {
      return res.status(503).json({ 
        error: "Database connection failed. Please check your MySQL configuration and whitelist.",
        details: "Access denied or host unreachable."
      });
    }
    next();
  });

  app.get("/api/db-status", (req, res) => {
    res.json({ 
      mode: (db as any).getMode(),
      mysqlConfigured: Boolean(process.env.DB_HOST),
      initialized: dbInitialized
    });
  });

  app.get("/api/oss-status", async (req, res) => {
    const status = await testOSSConnection();
    res.json(status);
  });

  app.get("/api/health", (req, res) => {
    const lastError = getLastError();
    const deniedIpMatch = lastError?.message?.match(/@'([^']+)'/);
    const deniedIp = deniedIpMatch ? deniedIpMatch[1] : (containerIp !== 'unknown' ? containerIp : null);
    
    res.json({ 
      status: "ok",
      database: dbInitialized ? "connected" : "disconnected",
      error: lastError?.message,
      details: lastError?.code,
      deniedIp: deniedIp
    });
  });

  // Auth Middleware
  const authenticateToken = async (req: any, res: any, next: any) => {
    // Basic health check and db status should not be blocked if DB is starting
    if (!dbInitialized && (req.path === '/api/health' || req.path === '/api/db-status')) {
      return next();
    }
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log(`[Auth] Request: ${req.method} ${req.path}`);
    console.log(`[Auth] Token present: ${!!token}`);

    if (token === 'guest') {
      req.user = { id: 999999, username: '游客', role: 'user', points: 0, status: 'active' };
      console.log(`[Auth] Authenticated Guest mode user for ${req.path}`);
      return next();
    }

    if (!token) {
      console.warn(`[Auth] No token provided for ${req.path}`);
      return res.status(401).json({ error: "需要身份验证令牌" });
    }

    jwt.verify(token, getJwtSecret(), async (err: any, user: any) => {
      if (err) {
        console.error(`[Auth] JWT verification failed for ${req.path}:`, err.message);
        // Change 403 to 401 to avoid Nginx interception of 403 and provide better feedback
        return res.status(401).json({ error: "令牌无效或已过期，请重新登录" });
      }
      
      // Fetch latest user info from database to handle role transfers and status changes
      try {
        const [users]: any = await db.query("SELECT role, leader_id, status FROM users WHERE id = ?", [user.id]);
        if (users[0]) {
          user.role = users[0].role;
          user.leader_id = users[0].leader_id;
          user.status = users[0].status;
          
          if (user.status === 'disabled') {
            return res.status(401).json({ error: "账号已被禁用" });
          }
        }
      } catch (dbErr) {
        console.error(`[Auth] Error fetching latest user info for ${user.id}:`, dbErr);
      }
      
      // Fallback: If the user email matches the default admin username, ensure they have admin role
      const lowerUsername = user.username?.toLowerCase() || '';
      const defaultAdmin = process.env.DEFAULT_ADMIN_USERNAME?.toLowerCase() || '';

      if (lowerUsername && defaultAdmin && lowerUsername === defaultAdmin) {
        console.log(`[Auth] Admin fallback MATCHED for ${lowerUsername}`);
        user.role = 'admin';
      }
      
      req.user = user;
      console.log(`[Auth] Authenticated user: ${user.username} (ID: ${user.id}, Role: ${user.role})`);
      next();
    });
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'admin') {
      return res.status(401).json({ error: '需要管理员权限' });
    }
    next();
  };

  // Diagnostic route to check if /api/sys/m is blocked
  app.get("/api/test-auth", authenticateToken, (req: any, res) => {
    res.json({ message: "Auth works", user: req.user });
  });

  app.get("/api/admin/test", authenticateToken, isAdmin, (req: any, res) => {
    res.json({ message: "Admin auth works", user: req.user });
  });

  app.post("/api/panorama/heal-seam", authenticateToken, async (req: any, res) => {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "缺少图片URL" });

    try {
      console.log(`>>> [Seam-Fix] Processing image: ${imageUrl}`);
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Failed to fetch image");
      const buffer = Buffer.from(await response.arrayBuffer());

      // 1. Horizontal roll 50% using sharp
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) throw new Error("Invalid image metadata");
      
      const halfWidth = Math.floor(metadata.width / 2);
      const leftHalf = await sharp(buffer).extract({ left: 0, top: 0, width: halfWidth, height: metadata.height }).toBuffer();
      const rightHalf = await sharp(buffer).extract({ left: halfWidth, top: 0, width: metadata.width - halfWidth, height: metadata.height }).toBuffer();
      
      // Swap halves
      const rolledBuffer = await sharp({
        create: {
          width: metadata.width,
          height: metadata.height,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
      .composite([
        { input: rightHalf, left: 0, top: 0 },
        { input: leftHalf, left: metadata.width - halfWidth, top: 0 }
      ])
      .toBuffer();

      // 2. Call AI to Inpaint the center seam (area around metadata.width/2)
      // Since our simple gpt-image-2 might not support precise masking yet, 
      // we'll send the whole rolled image to imageAgent with a specific prompt
      // requesting "heal the middle seam"
      const base64Rolled = rolledBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64Rolled}`;
      
      const [apiRows]: any = await db.query('SELECT value FROM settings WHERE `key` = ?', ['global_api_config']);
      const apiConfig = apiRows[0] ? JSON.parse(apiRows[0].value) : DEFAULT_API_CONFIG;
      
    const healConfig: any = {
        prompt: "Perfectly blend and merge the vertical seam line in the center of this panoramic image. Ensure smooth transitions for floors, ceilings, and walls. Keep the rest of the image unchanged. Realistic architectural photography style.",
        imageSize: "4K",
        aspectRatio: "2:1",
        referenceImages: [{ data: dataUrl, mimeType: 'image/png', type: 'general' }]
      };

      const healResult = await imageAgent.generateSmartImage(healConfig, apiConfig);
      const healedUrl = typeof healResult === 'string' ? healResult : healResult.imageUrl;
      if (!healedUrl) throw new Error("AI healing failed");

      // 3. Roll back (Fetch AI result and roll)
      const healedResponse = await fetch(healedUrl);
      const healedBuffer = Buffer.from(await healedResponse.arrayBuffer());
      
      // Extract halves again to un-roll
      const healedLeftHalf = await sharp(healedBuffer).extract({ left: 0, top: 0, width: halfWidth, height: metadata.height }).toBuffer();
      const healedRightHalf = await sharp(healedBuffer).extract({ left: halfWidth, top: 0, width: metadata.width - halfWidth, height: metadata.height }).toBuffer();

      const finalBuffer = await sharp({
        create: {
          width: metadata.width,
          height: metadata.height,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
      .composite([
        { input: healedRightHalf, left: 0, top: 0 },
        { input: healedLeftHalf, left: metadata.width - halfWidth, top: 0 }
      ])
      .toBuffer();

      // Save and return
      const finalUrl = await persistFromBase64(`data:image/png;base64,${finalBuffer.toString('base64')}`, `luosheji/healed/${req.user.id}/${Date.now()}.png`);
      res.json({ success: true, url: finalUrl });

    } catch (error: any) {
      console.error("[Seam-Fix] Error:", error);
      res.status(500).json({ error: "接缝修复失败", details: error.message });
    }
  });

  app.get("/api/proxy-asset", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: "Missing URL parameter" });

    try {
      // Validate that it's an allowed URL pattern (e.g. aliyuncs.com or our own bucket)
      // For now, let's be flexible but stay within our OSS domain if possible
      // if (!url.includes('.aliyuncs.com')) {
      //   return res.status(403).json({ error: "Only aliyuncs.com assets can be proxied" });
      // }

      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: `Asset fetch failed: ${response.statusText}` });
      }

      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error('Asset proxy failed:', error);
      res.status(500).json({ error: "Asset proxy failed", details: error.message });
    }
  });

  // --- Auth Routes ---

  app.post("/api/auth/register", async (req, res) => {
    const { username, password, phone, inviteCode } = req.body;

    if (!username || !password || !phone || !inviteCode) {
      return res.status(400).json({ error: "缺少必填字段" });
    }

    // Check if invite code is valid and has uses left
    const [codes]: any = await db.query("SELECT * FROM invitation_codes WHERE code = ? AND current_uses < max_uses", [inviteCode]);
    const codeRow = codes[0];
    
    if (!codeRow) {
      return res.status(400).json({ error: "邀请码无效或已使用" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Check if the creator of the code is a leader to automatically link them
      const [creators]: any = await db.query("SELECT role FROM users WHERE id = ?", [codeRow.creator_id]);
      const creatorRole = creators[0]?.role;
      const leaderId = creatorRole === 'leader' ? codeRow.creator_id : null;

      // Explicitly set points to 10 as per requirement
      const [result]: any = await db.query(
        "INSERT INTO users (username, password, phone, points, leader_id) VALUES (?, ?, ?, ?, ?)", 
        [username, hashedPassword, phone, 10, leaderId]
      );
      const newUserId = result.insertId;

      // Increment code usage
      await db.query("UPDATE invitation_codes SET current_uses = current_uses + 1 WHERE id = ?", [codeRow.id]);

      res.json({ message: "注册成功" });
    } catch (e: any) {
      if (e.message.includes('UNIQUE constraint failed') || e.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: "用户名已存在" });
      }
      res.status(500).json({ error: "服务器错误" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;

    const [users]: any = await db.query("SELECT * FROM users WHERE username = ?", [username]);
    const user = users[0];
    
    if (!user) return res.status(401).json({ error: "用户名或密码错误" });
    if (user.status === 'disabled') return res.status(401).json({ error: "账号已禁用" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: "用户名或密码错误" });

     const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, getJwtSecret(), { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, points: user.points } });
  });

  app.post("/api/auth/verify-forgot", async (req, res) => {
    const { username, phone } = req.body;
    if (!username || !phone) {
      return res.status(400).json({ error: "请输入用户名和手机号" });
    }

    try {
      const [users]: any = await db.query("SELECT id, username, phone, status FROM users WHERE username = ?", [username]);
      const user = users[0];
      if (!user) {
        return res.status(400).json({ error: "用户名或手机号不正确" });
      }
      if (user.status === 'disabled') {
        return res.status(400).json({ error: "账号已禁用" });
      }

      if (user.phone !== phone) {
        return res.status(400).json({ error: "用户名或手机号不正确" });
      }

      res.json({ success: true, message: "验证成功，请输入新密码" });
    } catch (e: any) {
      console.error("verify-forgot error:", e);
      res.status(500).json({ error: "服务器内部错误" });
    }
  });

  app.post("/api/auth/reset-forgot", async (req, res) => {
    const { username, phone, newPassword } = req.body;
    if (!username || !phone || !newPassword) {
      return res.status(400).json({ error: "信息不完整" });
    }

    try {
      const [users]: any = await db.query("SELECT id, username, phone, status FROM users WHERE username = ?", [username]);
      const user = users[0];
      if (!user || user.phone !== phone) {
        return res.status(400).json({ error: "验证失败，无法修改密码" });
      }
      if (user.status === 'disabled') {
        return res.status(400).json({ error: "账号已禁用" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id]);

      res.json({ success: true, message: "密码修改成功，请使用新密码登录" });
    } catch (e: any) {
      console.error("reset-forgot error:", e);
      res.status(500).json({ error: "服务器内部错误" });
    }
  });

  // --- User Routes ---

  app.get("/api/user/profile", authenticateToken, async (req: any, res) => {
    if (req.user.id === 999999) {
      return res.json({
        id: 'guest',
        username: '游客',
        phone: '13800000000',
        points: 0,
        role: 'user',
        status: 'active',
        leader_id: null,
        point_limit: 0,
        monthly_points_spent: 0,
        invitationCodes: [],
        teamInfo: null
      });
    }

    const [users]: any = await db.query("SELECT id, username, phone, points, role, status, leader_id, point_limit FROM users WHERE id = ?", [req.user.id]);
    const user = users[0];
    if (!user) return res.status(404).json({ error: "未找到用户" });

    // Calculate monthly spent for the current user
    const [spentRows]: any = await db.query(
      "SELECT COALESCE(SUM(amount), 0) as spent FROM usage_logs WHERE user_id = ? AND type = 'points_spent' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
      [req.user.id]
    );
    const monthly_points_spent = Number(spentRows[0].spent);
    
    let codes = [];
    if (user.role === 'admin' || user.role === 'leader') {
      [codes] = await db.query("SELECT code, current_uses, max_uses FROM invitation_codes WHERE creator_id = ?", [req.user.id]);
    }

    let effectiveLeaderId = user.leader_id;
    if (!effectiveLeaderId) {
      const [teamLeaders]: any = await db.query(`
        SELECT t.leader_id FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.user_id = ? LIMIT 1
      `, [req.user.id]);
      if (teamLeaders[0]) {
        effectiveLeaderId = teamLeaders[0].leader_id;
      }
    }

    let teamInfo = null;
    if (effectiveLeaderId) {
      const [leaders]: any = await db.query("SELECT id, username, points FROM users WHERE id = ?", [effectiveLeaderId]);
      if (leaders[0]) {
        teamInfo = {
          leaderName: leaders[0].username,
          teamPoints: leaders[0].points
        };
      }
    } else if (user.role === 'leader') {
      const [members]: any = await db.query("SELECT COUNT(*) as count FROM users WHERE leader_id = ?", [user.id]);
      teamInfo = {
        memberCount: members[0].count,
        maxMembers: 200
      };
    }

    res.json({ ...user, monthly_points_spent, invitationCodes: codes, teamInfo });
  });

  app.patch("/api/user/profile", authenticateToken, async (req: any, res) => {
    const { username } = req.body;
    if (!username || username.trim().length < 2) {
      return res.status(400).json({ error: "用户名长度至少为2个字符" });
    }

    try {
      // Check if username is already taken
      const [existing]: any = await db.query("SELECT id FROM users WHERE username = ? AND id != ?", [username, req.user.id]);
      if (existing.length > 0) {
        return res.status(400).json({ error: "该用户名已被占用" });
      }

      const [result]: any = await db.query("UPDATE users SET username = ? WHERE id = ?", [username, req.user.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: "未找到用户" });

      res.json({ success: true, username });
    } catch (e: any) {
      res.status(500).json({ error: "更新用户名失败", details: e.message });
    }
  });

  app.post("/api/user/change-password", authenticateToken, async (req: any, res) => {
    const { newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [result]: any = await db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, req.user.id]);
    if (result.affectedRows === 0) return res.status(500).json({ error: "更新失败" });
    res.json({ message: "密码已更新" });
  });

  app.post("/api/user/deduct-points", authenticateToken, async (req: any, res) => {
    const { amount, reason, taskId } = req.body;
    const deductAmount = Number(amount);
    
    if (isNaN(deductAmount) || deductAmount <= 0) {
      return res.status(400).json({ error: "无效金额" });
    }

    try {
      const [users]: any = await db.query("SELECT username, points, leader_id, point_limit FROM users WHERE id = ?", [req.user.id]);
      const user = users[0];
      if (!user) return res.status(404).json({ error: "未找到用户" });

      let targetId = req.user.id;
      let usingTeamPoints = false;

      let effectiveLeaderId = user.leader_id;
      if (!effectiveLeaderId) {
        const [teamLeaders]: any = await db.query(`
          SELECT t.leader_id FROM team_members tm
          JOIN teams t ON tm.team_id = t.id
          WHERE tm.user_id = ? LIMIT 1
        `, [req.user.id]);
        if (teamLeaders[0]) {
          effectiveLeaderId = teamLeaders[0].leader_id;
        }
      }

      console.log(`[Points] User ${req.user.id} (${user.username}) attempting to deduct ${deductAmount}. Current points: ${user.points}, Leader ID: ${user.leader_id}, Effective Leader ID: ${effectiveLeaderId}, Point Limit: ${user.point_limit}`);

      // Check user's point limit if set (applies to both team and individual points)
      if (user.point_limit > 0) {
        const [spentRows]: any = await db.query(
          "SELECT COALESCE(SUM(amount), 0) as spent FROM usage_logs WHERE user_id = ? AND type = 'points_spent' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
          [req.user.id]
        );
        const spent = Number(spentRows[0].spent);
        if (spent + deductAmount > user.point_limit) {
          console.log(`[Points] User ${req.user.id} exceeded point limit. Spent: ${spent}, Limit: ${user.point_limit}`);
          return res.status(400).json({ error: `已超出本月积分使用上限 (${user.point_limit})，当前已使用 ${spent}。` });
        }
      }

      // Priority: Team points (Leader's points)
      if (effectiveLeaderId) {
        const [leaders]: any = await db.query("SELECT id, username, points FROM users WHERE id = ?", [effectiveLeaderId]);
        const leader = leaders[0];
        console.log(`[Points] Checking leader ${effectiveLeaderId} (${leader?.username}). Leader points: ${leader?.points}`);
        
        if (leader && leader.points >= deductAmount) {
          targetId = effectiveLeaderId;
          usingTeamPoints = true;
          console.log(`[Points] Using team points from leader ${targetId}`);
        } else {
          console.log(`[Points] Leader points insufficient or leader not found. Falling back to user points.`);
        }
      }

      const [result]: any = await db.query(
        "UPDATE users SET points = points - ? WHERE id = ? AND points >= ?",
        [deductAmount, targetId, deductAmount]
      );

      console.log(`[Points] Update result: affectedRows=${result.affectedRows}, targetId=${targetId}`);

      if (result.affectedRows === 0) {
        const [targetUsers]: any = await db.query("SELECT points FROM users WHERE id = ?", [targetId]);
        const targetUser = targetUsers[0];
        const currentPoints = targetUser?.points || 0;
        
        console.log(`[Points] Deduction failed. Target points: ${currentPoints}, Required: ${deductAmount}`);

        let errorMsg = "积分不足";
        if (usingTeamPoints) {
          errorMsg = "团队积分不足";
        } else if (effectiveLeaderId) {
          errorMsg = `团队积分不足且个人积分不足 (当前个人积分: ${user.points})`;
        } else {
          errorMsg = `积分不足 (当前积分: ${user.points})`;
        }

        return res.status(401).json({ 
          error: errorMsg, 
          currentPoints: currentPoints,
          requiredAmount: deductAmount
        });
      }
      
      const [updatedTarget]: any = await db.query("SELECT points FROM users WHERE id = ?", [targetId]);
      const remainingPoints = updatedTarget[0].points;
      
      await db.query(
        "INSERT INTO usage_logs (user_id, type, amount, details) VALUES (?, ?, ?, ?)",
        [req.user.id, 'points_spent', deductAmount, JSON.stringify({ 
          reason: reason || 'Points deduction',
          targetId,
          usingTeamPoints,
          remainingPoints,
          taskId
        })]
      );

      res.json({ success: true, remainingPoints, usingTeamPoints });
    } catch (error: any) {
      console.error('Points deduction failed:', error);
      res.status(500).json({ error: "积分扣除失败，请稍后重试", details: error.message });
    }
  });

  app.post("/api/user/refund-points", authenticateToken, async (req: any, res) => {
    const { amount, reason } = req.body;
    const refundAmount = Number(amount);
    
    if (isNaN(refundAmount) || refundAmount <= 0) {
      return res.status(400).json({ error: "无效金额" });
    }

    try {
      // Find the last deduction to know where to refund
      const [lastLogs]: any = await db.query(
        "SELECT details FROM usage_logs WHERE user_id = ? AND type = 'points_spent' ORDER BY created_at DESC LIMIT 1",
        [req.user.id]
      );
      
      let targetId = req.user.id;
      if (lastLogs[0]) {
        const details = safeParseJson(lastLogs[0].details);
        if (details && details.targetId) {
          targetId = details.targetId;
        }
      }

      await db.query(
        "UPDATE users SET points = points + ? WHERE id = ?",
        [refundAmount, targetId]
      );

      const [updatedTarget]: any = await db.query("SELECT points FROM users WHERE id = ?", [targetId]);
      const remainingPoints = updatedTarget[0].points;
      
      await db.query(
        "INSERT INTO usage_logs (user_id, type, amount, details) VALUES (?, ?, ?, ?)",
        [req.user.id, 'points_refund', refundAmount, JSON.stringify({ reason, targetId })]
      );

      res.json({ success: true, remainingPoints });
    } catch (error: any) {
      console.error("Refund points error:", error);
      res.status(500).json({ error: "积分退还失败", details: error.message });
    }
  });

  // --- Custom Skills Routes ---

  app.get("/api/skills", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Fetch custom skills that are public or created by the current user
      const [customSkills]: any = await db.query(
        "SELECT * FROM ai_skills WHERE is_public = 1 OR creator_id = ?",
        [userId]
      );

      // Fetch user's installed skills
      const [installedRows]: any = await db.query(
        "SELECT skill_id FROM user_skills WHERE user_id = ?",
        [userId]
      );
      const installedSet = new Set(installedRows.map((r: any) => r.skill_id));

      const mappedCustomSkills = customSkills.map((skill: any) => ({
        id: skill.id,
        name: skill.name,
        desc: skill.desc || "",
        icon: skill.icon || "⚙️",
        instruction: skill.instruction || "",
        creatorId: skill.creator_id,
        creatorName: skill.creator_name || "未知用户",
        isPublic: Boolean(skill.is_public),
        isSystem: Boolean(skill.is_system),
        tier: skill.tier || "light",
        category: skill.category || "text",
        customOptions: (() => {
          if (!skill.custom_options) return null;
          try {
            return JSON.parse(skill.custom_options);
          } catch (e) {
            return null;
          }
        })(),
        isInstalled: skill.is_system ? true : installedSet.has(skill.id)
      }));

      res.json({ success: true, skills: mappedCustomSkills });
    } catch (error: any) {
      console.error("Failed to query skills:", error);
      res.status(500).json({ error: "获取技能列表失败", details: error.message });
    }
  });

  // --- Shared Canvases Routes ---

  app.get("/api/shared-canvases", authenticateToken, async (req: any, res) => {
    try {
      const [rows]: any = await db.query(
        "SELECT id, name, creator_id, creator_name, history, created_at FROM shared_canvases ORDER BY created_at DESC"
      );

      const canvases = rows.map((row: any) => {
        let historyObj = [];
        if (row.history) {
          try {
            historyObj = typeof row.history === 'string' ? JSON.parse(row.history) : row.history;
          } catch (e) {
            console.error("Failed to parse history JSON from shared_canvases:", e);
          }
        }
        return {
          id: row.id,
          name: row.name,
          creatorId: row.creator_id,
          creatorName: row.creator_name || "未知用户",
          history: historyObj,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          isShared: true
        };
      });

      res.json({ success: true, canvases });
    } catch (error: any) {
      console.error("Failed to query shared canvases:", error);
      res.status(500).json({ error: "获取共享画布失败", details: error.message });
    }
  });

  app.post("/api/shared-canvases", authenticateToken, async (req: any, res) => {
    const { id, name, history } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: "缺少画布ID或名称" });
    }

    const userId = req.user.id;
    const username = req.user.username || "未知用户";
    const historyStr = history ? JSON.stringify(history) : "[]";

    try {
      // Check if already exists
      const [exists]: any = await db.query("SELECT id, creator_id FROM shared_canvases WHERE id = ?", [id]);
      if (exists.length > 0) {
        // Check permissions
        if (exists[0].creator_id !== userId && req.user.role !== 'admin') {
          return res.status(403).json({ error: "您没有权限更新此共享画布" });
        }
        
        await db.query(
          "UPDATE shared_canvases SET name = ?, history = ? WHERE id = ?",
          [name, historyStr, id]
        );
      } else {
        await db.query(
          "INSERT INTO shared_canvases (id, name, creator_id, creator_name, history) VALUES (?, ?, ?, ?, ?)",
          [id, name, userId, username, historyStr]
        );
      }

      res.json({
        success: true,
        canvas: {
          id,
          name,
          creatorId: userId,
          creatorName: username,
          history,
          createdAt: Date.now(),
          isShared: true
        }
      });
    } catch (error: any) {
      console.error("Failed to save shared canvas:", error);
      res.status(500).json({ error: "分享画布失败", details: error.message });
    }
  });

  app.delete("/api/shared-canvases/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    try {
      const [rows]: any = await db.query("SELECT creator_id FROM shared_canvases WHERE id = ?", [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: "未找到共享画布" });
      }

      const userId = req.user.id;
      if (rows[0].creator_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "您没有权限删除此共享画布" });
      }

      await db.query("DELETE FROM shared_canvases WHERE id = ?", [id]);
      res.json({ success: true, message: "删除共享画布成功" });
    } catch (error: any) {
      console.error("Failed to delete shared canvas:", error);
      res.status(500).json({ error: "删除共享画布失败", details: error.message });
    }
  });

  app.post("/api/skills", authenticateToken, async (req: any, res) => {
    const { name, desc, icon, instruction, isPublic, tier, customOptions, category } = req.body;
    if (!name || !instruction) {
      return res.status(400).json({ error: "名称和系统提示词属于必填字段" });
    }

    const id = "skill_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    const userId = req.user.id;
    const username = req.user.username || "未知用户";

    try {
      const customOptionsStr = customOptions ? JSON.stringify(customOptions) : null;
      await db.query(
        "INSERT INTO ai_skills (id, name, `desc`, icon, instruction, creator_id, creator_name, is_public, tier, custom_options, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, name, desc || "", icon || "⚙️", instruction, userId, username, isPublic !== false ? 1 : 0, tier || "light", customOptionsStr, category || "text"]
      );

      // Automatically install for creator
      await db.query(
        "INSERT INTO user_skills (user_id, skill_id) VALUES (?, ?)",
        [userId, id]
      );

      res.json({
        success: true,
        skill: {
          id,
          name,
          desc: desc || "",
          icon: icon || "⚙️",
          instruction,
          creatorId: userId,
          creatorName: username,
          isPublic: isPublic !== false,
          isSystem: false,
          tier: tier || "light",
          category: category || "text",
          customOptions: customOptions || null,
          isInstalled: true
        }
      });
    } catch (error: any) {
      console.error("Failed to create skill:", error);
      res.status(500).json({ error: "创建技能失败", details: error.message });
    }
  });

  app.put("/api/skills/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { name, desc, icon, instruction, isPublic, tier, customOptions, category } = req.body;

    if (!name || !instruction) {
      return res.status(400).json({ error: "名称和系统提示词属于必填字段" });
    }

    try {
      // Find skill
      const [skills]: any = await db.query("SELECT * FROM ai_skills WHERE id = ?", [id]);
      if (skills.length === 0) {
        return res.status(404).json({ error: "技能未找到" });
      }

      // Restrict update to creator or admin
      const userId = req.user.id;
      const isUserAdmin = req.user.role === "admin";
      if (skills[0].creator_id !== userId && !isUserAdmin) {
        return res.status(403).json({ error: "只有创建者或管理员可以修改该技能" });
      }

      const customOptionsStr = customOptions ? JSON.stringify(customOptions) : null;
      await db.query(
        "UPDATE ai_skills SET name = ?, `desc` = ?, icon = ?, instruction = ?, is_public = ?, tier = ?, custom_options = ?, category = ? WHERE id = ?",
        [name, desc || "", icon || "⚙️", instruction, isPublic !== false ? 1 : 0, tier || "light", customOptionsStr, category || "text", id]
      );

      res.json({ success: true, message: "技能已更新" });
    } catch (error: any) {
      console.error("Failed to update skill:", error);
      res.status(500).json({ error: "更新技能失败", details: error.message });
    }
  });

  app.delete("/api/skills/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isUserAdmin = req.user.role === "admin";

    try {
      // Find skill
      const [skills]: any = await db.query("SELECT * FROM ai_skills WHERE id = ?", [id]);
      if (skills.length === 0) {
        return res.status(404).json({ error: "技能未找到" });
      }

      // Restrict delete to creator or admin to prevent random deletion
      if (skills[0].creator_id !== userId && !isUserAdmin) {
        return res.status(403).json({ error: "只有创建者或管理员可以删除该技能" });
      }

      // If deleting a system skill, register it as deleted in settings
      if (skills[0].is_system) {
        const [rows]: any = await db.query('SELECT value FROM settings WHERE `key` = ?', ['deleted_system_skills']);
        let deletedArray: string[] = [];
        if (rows.length > 0) {
          try {
            const parsed = JSON.parse(rows[0].value);
            if (Array.isArray(parsed)) {
              deletedArray = parsed;
            }
          } catch (e) {}
        }
        if (!deletedArray.includes(id)) {
          deletedArray.push(id);
          const [existsSetting]: any = await db.query('SELECT `key` FROM settings WHERE `key` = ?', ['deleted_system_skills']);
          if (existsSetting.length > 0) {
            await db.query('UPDATE settings SET value = ? WHERE `key` = ?', [JSON.stringify(deletedArray), 'deleted_system_skills']);
          } else {
            await db.query('INSERT INTO settings (`key`, value) VALUES (?, ?)', ['deleted_system_skills', JSON.stringify(deletedArray)]);
          }
        }
      }

      // Delete from DB (user_skills references it with ON DELETE CASCADE)
      await db.query("DELETE FROM ai_skills WHERE id = ?", [id]);
      res.json({ success: true, message: "技能已成功删除" });
    } catch (error: any) {
      console.error("Failed to delete skill:", error);
      res.status(500).json({ error: "删除技能失败", details: error.message });
    }
  });

  app.post("/api/skills/:id/install", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const [skills]: any = await db.query("SELECT * FROM ai_skills WHERE id = ?", [id]);
      if (skills.length === 0) {
        return res.status(404).json({ error: "技能未找到" });
      }

      // Add to user active list with duplicate safety
      if (db.getMode() === 'sqlite') {
        await db.query("INSERT OR IGNORE INTO user_skills (user_id, skill_id) VALUES (?, ?)", [userId, id]);
      } else {
        await db.query(
          "INSERT INTO user_skills (user_id, skill_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE skill_id = skill_id",
          [userId, id]
        );
      }

      res.json({ success: true, message: "技能已添加入您的专属列表" });
    } catch (error: any) {
      console.error("Failed to install skill:", error);
      res.status(500).json({ error: "添加技能失败", details: error.message });
    }
  });

  app.post("/api/skills/:id/uninstall", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      await db.query("DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?", [userId, id]);
      res.json({ success: true, message: "技能已在您的专属列表中移除" });
    } catch (error: any) {
      console.error("Failed to uninstall skill:", error);
      res.status(500).json({ error: "移除技能失败", details: error.message });
    }
  });

  app.post("/api/user/log-usage", authenticateToken, async (req: any, res) => {
    const { type, amount, details } = req.body;
    if (!type) return res.status(400).json({ error: "缺少类型" });

    try {
      await db.query(
        "INSERT INTO usage_logs (user_id, type, amount, details) VALUES (?, ?, ?, ?)",
        [req.user.id, type, amount || 0, JSON.stringify(details || {})]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "记录使用情况失败", details: e.message });
    }
  });

  app.get("/api/user/points-history", authenticateToken, async (req: any, res) => {
    try {
      // Fetch all logs in the last 30 days for this user
      const [allLogs]: any = await db.query(
        "SELECT id, type, amount, details, created_at FROM usage_logs WHERE user_id = ? AND type IN ('points_spent', 'points_refund') AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) ORDER BY created_at DESC",
        [req.user.id]
      );

      // Fetch history records from last 30 days to correlate task status
      const thirtyDaysAgoMs = Date.now() - 31 * 24 * 3600 * 1000;
      const [historyRows]: any = await db.query(
        "SELECT id, type, status, timestamp, config, image_url, video_url, revised_prompt, error FROM history WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp DESC",
        [req.user.id, String(thirtyDaysAgoMs)]
      );

      // Detect database timezone offset relative to the Node process (UTC) to eliminate double conversion shifts
      let offsetMs = 0;
      try {
        const [rows]: any = await db.query("SELECT NOW() as db_now");
        if (rows && rows[0] && rows[0].db_now) {
          const dbNowStr = rows[0].db_now;
          let dbNowMs = 0;
          if (dbNowStr instanceof Date) {
            dbNowMs = dbNowStr.getTime();
          } else {
            const iso = String(dbNowStr).trim().replace(' ', 'T');
            dbNowMs = new Date(iso + (iso.endsWith('Z') || iso.includes('+') || iso.includes('-') ? '' : 'Z')).getTime();
          }
          const nodeNowMs = Date.now();
          const rawDiff = dbNowMs - nodeNowMs;
          const thirtyMinutes = 30 * 60 * 1000;
          offsetMs = Math.round(rawDiff / thirtyMinutes) * thirtyMinutes;
          console.log(`[Timezone Debug] points-history API - DB Time Offset: ${offsetMs} ms (${offsetMs / (3600 * 1000)} hours)`);
        }
      } catch (e) {
        console.warn("Failed to check DB offset in points-history api:", e);
      }

      const mapReasonToTaskName = (reason: string, type: string = '', config: any = null) => {
        const normalized = (reason || '').toLowerCase();
        const modelStr = (config?.model || '').toLowerCase();
        
        if (normalized.includes('创作剧本') || normalized.includes('编剧') || normalized.includes('script_gen')) {
          return '创作剧本';
        }
        if (normalized.includes('分析剧本') || normalized.includes('剧本深度分析') || normalized.includes('拆解剧本')) {
          return '分析剧本';
        }
        if (normalized.includes('影音拉片') || normalized.includes('拉片分析') || normalized.includes('dissector') || normalized.includes('dissect')) {
          return '影音拉片';
        }
        if (normalized.includes('改写剧本') || normalized.includes('剧本深度改写')) {
          return '改写剧本';
        }
        
        if (normalized.includes('video') || normalized.includes('视频') || type === 'video' || modelStr.includes('video') || modelStr.includes('seedance')) {
          if (normalized.includes('omni') || modelStr.includes('omni')) {
            return 'Omni/多模态视频';
          }
          if (normalized.includes('mini') || modelStr.includes('mini')) {
            return 'RH-SD2.0mini/多模态视频';
          }
          if (normalized.includes('2.5') || modelStr.includes('2.5')) {
            return 'SD.25即将上线/多模态视频';
          }
          if (normalized.includes('2.1') || modelStr.includes('2.1')) {
            return 'Seedance 2.1/多模态视频';
          }
          return 'RH-SD2.0/多模态视频';
        }
        
        if (normalized.includes('image') || normalized.includes('图片') || normalized.includes('图') || type === 'image') {
          if (modelStr.includes('gpt-image-2') || modelStr.includes('gpt') || normalized.includes('gpt-image-2') || normalized.includes('gpt')) {
            return 'GPT-Image-2';
          }
          if (modelStr.includes('banana') || modelStr.includes('nano') || normalized.includes('banana') || normalized.includes('nano')) {
            return 'nano banana 2';
          }
          return 'nano banana 2';
        }
        
        if (normalized.includes('提示词')) {
          return '提示词编写';
        }
        if (normalized.includes('质检')) {
          return '质检审计';
        }
        if (normalized.includes('导演') || normalized.includes('制片')) {
          return '导演制片咨询';
        }
        if (normalized.includes('灵感编剧') || normalized.includes('灵境文造') || normalized.includes('编剧')) {
          return '创作剧本';
        }
        
        return reason || '智能创意任务';
      };

      const parseCreatedAt = (created_at: any): number => {
        if (!created_at) return 0;
        let t = 0;
        if (created_at instanceof Date) {
          t = created_at.getTime();
        } else {
          const rawT = new Date(created_at).getTime();
          if (!isNaN(rawT)) {
            t = rawT;
          } else if (typeof created_at === 'string') {
            const iso = created_at.trim().replace(' ', 'T');
            const t2 = new Date(iso).getTime();
            if (!isNaN(t2)) {
              t = t2;
            } else {
              const t3 = new Date(iso + 'Z').getTime();
              if (!isNaN(t3)) {
                t = t3;
              }
            }
          }
        }
        if (t > 0) {
          return t - offsetMs;
        }
        return 0;
      };

      const spentLogs = allLogs.filter((log: any) => log.type === 'points_spent');
      const refundLogs = allLogs.filter((log: any) => log.type === 'points_refund');

      const matchedRefundIds = new Set<number>();
      const matchedHistoryIds = new Set<string>();

      const processedSpent = spentLogs.map((spent: any) => {
        const details = safeParseJson(spent.details, {});
        const reason = details.reason || '';
        const spentTime = parseCreatedAt(spent.created_at);
        const loggedTaskId = details.taskId;

        // 1. Try to find a matched history row by loggedTaskId or timestamp alignment
        const normalized = reason.toLowerCase();
        let matchedHistory: any = null;

        if (loggedTaskId) {
          // Precise match via recorded taskId
          matchedHistory = historyRows.find((h: any) => String(h.id) === String(loggedTaskId));
        }

        if (!matchedHistory) {
          // Heuristic match with 90 seconds sliding window and unique constraint
          matchedHistory = historyRows.find((h: any) => {
            if (matchedHistoryIds.has(String(h.id))) return false;

            const hTime = Number(h.timestamp);
            const timeDiff = Math.abs(hTime - spentTime);
            if (timeDiff > 90000) return false;

            // Type match verification
            const isVideoSpent = normalized.includes('video') || normalized.includes('视频') || normalized.includes('seedance');
            const isVideoHistory = h.type === 'video';
            if (isVideoSpent !== isVideoHistory) return false;

            const isImageSpent = normalized.includes('image') || normalized.includes('图片') || normalized.includes('图') || normalized.includes('banana');
            const isImageHistory = h.type === 'image';
            if (isImageSpent !== isImageHistory) return false;

            return true;
          });
        }

        if (matchedHistory) {
          // Track matched history items to never reuse them
          matchedHistoryIds.add(String(matchedHistory.id));
        }

        // 2. Try to find a corresponding refund log (refund was within 30 minutes after spent)
        const matchingRefund = refundLogs.find((ref: any) => {
          if (matchedRefundIds.has(ref.id)) return false;
          const refTime = parseCreatedAt(ref.created_at);
          const timeDiff = refTime - spentTime;
          const isSameAmount = Math.abs(Number(ref.amount) - Number(spent.amount)) < 0.01;
          return timeDiff >= -10000 && timeDiff < 1800000 && isSameAmount;
        });

        let isFailed = false;
        if (matchedHistory && (matchedHistory.status === 'failed' || matchedHistory.status === 'error')) {
          isFailed = true;
        } else if (matchingRefund) {
          isFailed = true;
          matchedRefundIds.add(matchingRefund.id);
        } else if (reason.toLowerCase().includes('failed') || reason.toLowerCase().includes('失败')) {
          isFailed = true;
        }

        const parsedConfig = matchedHistory ? safeParseJson(matchedHistory.config, {}) : null;
        const taskName = mapReasonToTaskName(reason, matchedHistory?.type || '', parsedConfig);

        let status = '成功';
        if (matchedHistory) {
          if (matchedHistory.status === 'failed' || matchedHistory.status === 'error') {
            status = '失败';
          } else if (matchedHistory.status === 'loading' || matchedHistory.status === 'processing' || matchedHistory.status === 'running') {
            status = '进行中';
          }
        } else if (isFailed) {
          status = '失败';
        }

        let durationStr = '00:03';
        const seed = spent.id;
        if (status === '进行中') {
          const startTime = matchedHistory ? Number(matchedHistory.timestamp) : spentTime;
          const elapsedSecs = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
          const mins = Math.floor(elapsedSecs / 60);
          const remSecs = elapsedSecs % 60;
          durationStr = `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
        } else if (taskName.includes('视频') || taskName.includes('seedance') || taskName.includes('Omni')) {
          const secs = 75 + (seed % 285);
          const mins = Math.floor(secs / 60);
          const remSecs = secs % 60;
          durationStr = `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
        } else if (taskName.toLowerCase().includes('image') || taskName.includes('图')) {
          const secs = 5 + (seed % 15);
          durationStr = `00:${String(secs).padStart(2, '0')}`;
        } else {
          const secs = 2 + (seed % 6);
          durationStr = `00:${String(secs).padStart(2, '0')}`;
        }

        let taskId = matchedHistory?.id;
        const rawIdNum = Number(taskId);
        const isValidTaskId = taskId && !isNaN(rawIdNum) && taskId.length >= 10;
        
        if (!isValidTaskId) {
          const seedStr = String(spent.id).padStart(5, '0');
          const timePart = String(Math.abs(spentTime % 1000000000)).padStart(9, '0');
          const randPart = String((spent.id * 17) % 100000).padStart(5, '0');
          taskId = `20657${seedStr}${timePart.substring(0, 5)}${randPart.substring(0, 4)}`;
        }

        let asset: any = null;
        if (matchedHistory) {
          asset = {
            id: matchedHistory.id,
            type: matchedHistory.type,
            imageUrl: matchedHistory.image_url,
            videoUrl: matchedHistory.video_url,
            revisedPrompt: matchedHistory.revised_prompt,
            config: safeParseJson(matchedHistory.config, {}),
            status: matchedHistory.status,
            error: matchedHistory.error
          };
        }

        let finalCreatedAt = spent.created_at;
        if (matchedHistory && matchedHistory.timestamp) {
          finalCreatedAt = new Date(Number(matchedHistory.timestamp)).toISOString();
        } else if (spentTime) {
          finalCreatedAt = new Date(spentTime).toISOString();
        }

        return {
          id: spent.id,
          taskId: taskId,
          createdAt: finalCreatedAt,
          type: spent.type,
          amount: spent.amount,
          taskName: taskName,
          status: status,
          duration: durationStr,
          asset: asset
        };
      });

      // Handle unmatched refunds (e.g., admin giving points or positive balance changes)
      const unmatchedRefunds = refundLogs.filter((ref: any) => !matchedRefundIds.has(ref.id));
      const processedRefunds = unmatchedRefunds.map((ref: any) => {
        const details = safeParseJson(ref.details, {});
        const reason = details.reason || '';
        const refTime = parseCreatedAt(ref.created_at);
        const refTimeMs = refTime || new Date(ref.created_at).getTime();

        const seedStr = String(ref.id).padStart(5, '0');
        const timePart = String(Math.abs(refTimeMs % 1000000000)).padStart(9, '0');
        const randPart = String((ref.id * 17) % 100000).padStart(5, '0');
        const taskId = `20658${seedStr}${timePart.substring(0, 5)}${randPart.substring(0, 4)}`;

        // Human readable task name
        const taskName = mapReasonToTaskName(reason);
        
        // If it's a refund due to failure, show as '失败' status so points show as 0 and status shows as '失败'
        const isFailureRefund = reason.includes('失败') || reason.includes('退款') || reason.toLowerCase().includes('fail') || reason.toLowerCase().includes('refund');

        let finalCreatedAt = ref.created_at;
        if (refTime) {
          finalCreatedAt = new Date(refTime).toISOString();
        }

        return {
          id: ref.id,
          taskId: taskId,
          createdAt: finalCreatedAt,
          type: ref.type,
          amount: ref.amount,
          taskName: taskName,
          status: isFailureRefund ? '失败' : '成功',
          duration: '-'
        };
      });

      // Combine and sort by createdAt DESC
      const combinedRecords = [...processedSpent, ...processedRefunds].sort((a: any, b: any) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Pagination
      const limit = 30;
      let page = parseInt(req.query.page as string) || 1;
      if (page < 1) page = 1;
      if (page > 100) page = 100;

      const totalCount = combinedRecords.length;
      const startIndex = (page - 1) * limit;
      const paginatedRecords = combinedRecords.slice(startIndex, startIndex + limit);

      res.json({
        records: paginatedRecords,
        pagination: {
          page: page,
          limit: limit,
          total: totalCount,
          totalPages: Math.min(100, Math.ceil(totalCount / limit))
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: "获取积分使用情况和任务记录失败", details: e.message });
    }
  });

  // --- History Routes ---

  app.get("/api/user/history/:id", authenticateToken, async (req: any, res) => {
    try {
      const [rows]: any = await db.query("SELECT * FROM history WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
      if (rows.length === 0) return res.status(404).json({ error: "未找到记录" });
      
      const row = rows[0];
      const item = {
        ...row,
        config: safeParseJson(row.config, {}),
        position: safeParseJson(row.position, null),
        isOptimized: Boolean(row.is_optimized),
        hiddenFromCanvas: Boolean(row.hidden_from_canvas),
        canvasId: row.canvas_id || 'default',
        imageUrl: row.image_url,
        videoUrl: row.video_url,
        arkOriginalUrl: row.ark_original_url,
        revisedPrompt: row.revised_prompt,
        parentId: row.parent_id || undefined
      };
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ error: "获取记录失败", details: e.message });
    }
  });

  app.get("/api/user/history", authenticateToken, async (req: any, res) => {
    try {
      const [rows]: any = await db.query("SELECT * FROM history WHERE user_id = ? ORDER BY timestamp DESC", [req.user.id]);
      // Parse JSON fields
      const history = rows.map((row: any) => ({
        ...row,
        config: safeParseJson(row.config, {}),
        position: safeParseJson(row.position, null),
        isOptimized: Boolean(row.is_optimized),
        hiddenFromCanvas: Boolean(row.hidden_from_canvas),
        canvasId: row.canvas_id || 'default',
        imageUrl: row.image_url,
        videoUrl: row.video_url,
        arkOriginalUrl: row.ark_original_url,
        revisedPrompt: row.revised_prompt,
        parentId: row.parent_id || undefined
      }));
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ error: "获取历史记录失败", details: e.message });
    }
  });

  app.post("/api/user/upload-to-oss", authenticateToken, async (req: any, res) => {
    const { data, filename } = req.body;
    try {
      const finalFilename = filename.startsWith('luosheji/') ? filename : `luosheji/${filename}`;
      const url = await persistFromBase64(data, finalFilename);
      res.json({ success: true, url });
    } catch (e: any) {
      res.status(500).json({ error: "媒体上传失败", details: e.message });
    }
  });

  app.post("/api/user/history", authenticateToken, async (req: any, res) => {
    const item = req.body;
    try {
      // Helper to check if a URL is NOT an OSS URL
      const isNotOSS = (url: string) => {
        if (!url || typeof url !== 'string') return false;
        // If it's a data URL or blob URL, it's definitely not OSS
        if (url.startsWith('data:') || url.startsWith('blob:')) return true;
        // If it's an HTTP URL, check if it contains aliyuncs.com or other OSS patterns
        if (url.startsWith('http://') || url.startsWith('https://')) {
          return !url.includes('.aliyuncs.com') && !url.includes('oss-');
        }
        return false;
      };

      // Recursive function to find and upload non-OSS URLs in an object
      const processObjectForOSS = async (obj: any, prefix: string): Promise<any> => {
        if (!obj || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
          return Promise.all(obj.map((val, i) => processObjectForOSS(val, `${prefix}_${i}`)));
        }

        const newObj = { ...obj };
        for (const [key, value] of Object.entries(newObj)) {
          if (typeof value === 'string' && isNotOSS(value)) {
            // It's a potential media URL that needs uploading
            const filename = `luosheji/history/${req.user.id}/${item.id}_${prefix}_${key}.png`;
            console.log(`>>> [DEBUG] Found non-OSS URL in ${prefix}.${key}, uploading to OSS: ${filename}`);
            try {
              if (value.startsWith('data:')) {
                newObj[key] = await persistFromBase64(value, filename);
              } else {
                newObj[key] = await persistFromUrl(value, filename);
              }
              console.log(`>>> [DEBUG] Successfully uploaded ${prefix}.${key} to OSS: ${newObj[key]}`);
            } catch (err: any) {
              console.error(`>>> [DEBUG] Failed to upload ${prefix}.${key} to OSS (will fallback to original URL):`, err.message);
              newObj[key] = value;
            }
          } else if (value && typeof value === 'object') {
            newObj[key] = await processObjectForOSS(value, `${prefix}_${key}`);
          }
        }
        return newObj;
      };

      console.log(`>>> [DEBUG] Processing media for history item ${item.id}`);
      
      // Process top-level URLs
      let finalImageUrl = item.imageUrl;
      let finalVideoUrl = item.videoUrl;

      if (finalImageUrl && isNotOSS(finalImageUrl)) {
        const filename = `luosheji/history/${req.user.id}/${item.id}_image.png`;
        console.log(`>>> [DEBUG] Persisting image for history ${item.id} to OSS: ${filename}`);
        try {
          if (finalImageUrl.startsWith('data:')) {
            finalImageUrl = await persistFromBase64(finalImageUrl, filename);
          } else {
            finalImageUrl = await persistFromUrl(finalImageUrl, filename);
          }
          console.log(`>>> [DEBUG] Image persisted to OSS: ${finalImageUrl}`);
        } catch (err: any) {
          console.error('Failed to persist top-level image to OSS (falling back to original URL):', err.message);
          finalImageUrl = item.imageUrl;
        }
      }

      if (finalVideoUrl && isNotOSS(finalVideoUrl)) {
        let ext = 'mp4';
        if (item.type === 'audio') {
          ext = 'mp3';
        } else if (finalVideoUrl.startsWith('data:')) {
          const match = finalVideoUrl.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
          if (match && match[1]) {
            const mime = match[1];
            if (mime.startsWith('audio/')) {
              ext = mime.split('/')[1] || 'mp3';
            } else if (mime.startsWith('video/')) {
              ext = mime.split('/')[1] || 'mp4';
            }
          }
        }
        const filename = `luosheji/history/${req.user.id}/${item.id}_video.${ext}`;
        try {
          if (finalVideoUrl.startsWith('data:')) {
            finalVideoUrl = await persistFromBase64(finalVideoUrl, filename);
          } else {
            finalVideoUrl = await persistFromUrl(finalVideoUrl, filename);
          }
        } catch (err: any) {
          console.error('Failed to persist top-level video/audio to OSS (falling back to original URL):', err.message);
          finalVideoUrl = item.videoUrl;
        }
      }

      // Process nested URLs in config
      let finalConfig = item.config;
      if (finalConfig) {
        finalConfig = await processObjectForOSS(finalConfig, 'config');
      }

      const [result]: any = await db.query(
        `INSERT INTO history (id, user_id, type, status, image_url, video_url, ark_original_url, revised_prompt, is_optimized, error, config, timestamp, position, hidden_from_canvas, parent_id, canvas_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         status = VALUES(status), image_url = VALUES(image_url), video_url = VALUES(video_url), 
         ark_original_url = VALUES(ark_original_url),
         revised_prompt = VALUES(revised_prompt), is_optimized = VALUES(is_optimized), 
         error = VALUES(error), config = VALUES(config), position = VALUES(position), 
         hidden_from_canvas = VALUES(hidden_from_canvas),
         parent_id = VALUES(parent_id),
         canvas_id = VALUES(canvas_id)`,
        [
          item.id !== undefined ? item.id : null,
          req.user.id !== undefined ? req.user.id : null,
          item.type !== undefined ? item.type : null,
          item.status !== undefined ? item.status : null,
          finalImageUrl !== undefined ? finalImageUrl : null,
          finalVideoUrl !== undefined ? finalVideoUrl : null,
          item.arkOriginalUrl !== undefined ? item.arkOriginalUrl : null,
          item.revisedPrompt !== undefined ? item.revisedPrompt : null,
          item.isOptimized ? 1 : 0,
          item.error !== undefined ? item.error : null,
          finalConfig !== undefined && finalConfig !== null ? JSON.stringify(finalConfig) : null,
          item.timestamp !== undefined ? item.timestamp : Date.now(),
          item.position !== undefined && item.position !== null ? JSON.stringify(item.position) : null,
          item.hiddenFromCanvas ? 1 : 0,
          item.parentId !== undefined ? item.parentId : null,
          item.canvasId !== undefined ? item.canvasId : 'default'
        ]
      );
      
      if (result.affectedRows === 0) {
        console.warn('History save: No rows affected. item.id:', item.id);
      }

      const ossUrl = finalImageUrl || finalVideoUrl;
      res.json({ 
        success: true, 
        imageUrl: finalImageUrl, 
        videoUrl: finalVideoUrl, 
        arkOriginalUrl: item.arkOriginalUrl,
        ossUrl: ossUrl,
        config: finalConfig,
        canvasId: item.canvasId || 'default'
      });
    } catch (e: any) {
      console.error('Failed to save history:', e);
      res.status(500).json({ error: "保存历史记录失败", details: e.message });
    }
  });

  app.delete("/api/user/history/:id", authenticateToken, async (req: any, res) => {
    try {
      await db.query("DELETE FROM history WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "删除历史记录失败", details: e.message });
    }
  });

  // --- Memory System (User Preferences & System Learnings) Routes ---

  app.get("/api/user/preferences", authenticateToken, async (req: any, res) => {
    try {
      const [rows]: any = await db.query("SELECT pref_key, pref_value, updated_at FROM user_preferences WHERE user_id = ?", [req.user.id]);
      res.json({ success: true, preferences: rows });
    } catch (e: any) {
      res.status(500).json({ error: "获取用户偏好失败", details: e.message });
    }
  });

  app.post("/api/user/preferences", authenticateToken, async (req: any, res) => {
    try {
      const { pref_key, pref_value } = req.body;
      if (!pref_key) {
        return res.status(400).json({ error: "缺少 pref_key" });
      }
      await db.query("DELETE FROM user_preferences WHERE user_id = ? AND pref_key = ?", [req.user.id, pref_key]);
      await db.query("INSERT INTO user_preferences (user_id, pref_key, pref_value) VALUES (?, ?, ?)", [req.user.id, pref_key, pref_value]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "保存用户偏好失败", details: e.message });
    }
  });

  app.get("/api/system-learnings", authenticateToken, async (req: any, res) => {
    try {
      const skillId = req.query.skillId;
      let query = "SELECT * FROM system_learnings";
      let params: any[] = [];
      if (skillId) {
        query += " WHERE skill_id = ?";
        params.push(skillId);
      }
      query += " ORDER BY created_at DESC LIMIT 50";
      const [rows]: any = await db.query(query, params);
      res.json({ success: true, learnings: rows });
    } catch (e: any) {
      res.status(500).json({ error: "获取系统学习经验失败", details: e.message });
    }
  });

  app.post("/api/system-learnings", authenticateToken, async (req: any, res) => {
    try {
      const { skill_id, learning_key, learning_value } = req.body;
      if (!learning_value) {
        return res.status(400).json({ error: "缺少 learning_value" });
      }
      await db.query("INSERT INTO system_learnings (skill_id, learning_key, learning_value) VALUES (?, ?, ?)", [skill_id || null, learning_key || null, learning_value]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "保存系统学习经验失败", details: e.message });
    }
  });

  // --- Pipeline Routes ---

  app.get("/api/user/pipelines", authenticateToken, async (req: any, res) => {
    try {
      const [rows]: any = await db.query("SELECT * FROM pipelines WHERE user_id = ? ORDER BY timestamp DESC", [req.user.id]);
      const pipelines = rows.map((row: any) => ({
        ...row,
        assets: safeParseJson(row.assets, []),
        tasks: safeParseJson(row.tasks, []),
        segments: safeParseJson(row.segments, []),
        originalScript: row.original_script,
        directorStyle: row.director_style,
        aspectRatio: row.aspect_ratio,
        visualStyle: row.visual_style,
        imageQuality: row.image_quality,
        narrativeMode: row.narrative_mode,
        targetSegments: row.target_segments,
        globalRule: row.global_rule
      }));
      res.json(pipelines);
    } catch (e: any) {
      res.status(500).json({ error: "获取流水线失败", details: e.message });
    }
  });

  app.post("/api/user/pipelines", authenticateToken, async (req: any, res) => {
    const p = req.body;
    
    // Ensure ID is present
    if (!p.id || p.id === 'null' || p.id === 'undefined') {
      p.id = `pipeline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    try {
      // Persist assets to OSS if configured
      if (p.assets && Array.isArray(p.assets)) {
        for (let i = 0; i < p.assets.length; i++) {
          const asset = p.assets[i];
          
          // Handle generatedMedia
          if (asset.generatedMedia) {
            const mediaFields = ['mainImageUrl', 'secondaryMediaUrl', 'sketchUrl', 'threeViewUrl', 'layoutUrl', 'combinedUrl'];
            for (const field of mediaFields) {
              const url = asset.generatedMedia[field];
              const isNotOSS = (u: string) => u && !u.includes('aliyuncs.com');
              if (url && (url.startsWith('data:') || (url.startsWith('http') && isNotOSS(url)))) {
                try {
                  const ext = url.startsWith('data:video') ? 'mp4' : 'png';
                  const timestamp = Date.now();
                  const filename = `luosheji/pipelines/${req.user.id}/${p.id}/asset_${asset.id || i}_${field}_${timestamp}.${ext}`;
                  if (url.startsWith('data:')) {
                    asset.generatedMedia[field] = await persistFromBase64(url, filename);
                  } else {
                    asset.generatedMedia[field] = await persistFromUrl(url, filename);
                  }
                } catch (storageErr) {
                  console.warn(`Failed to persist pipeline asset ${i} media ${field} to storage:`, storageErr);
                }
              }
            }
          }

          // Handle variants
          if (asset.variants && Array.isArray(asset.variants)) {
            for (let j = 0; j < asset.variants.length; j++) {
              const variant = asset.variants[j];
              const variantFields = ['imageUrl', 'sketchUrl', 'threeViewUrl', 'secondaryMediaUrl'];
              for (const field of variantFields) {
                const url = variant[field];
                const isNotOSS = (u: string) => u && !u.includes('aliyuncs.com');
                if (url && (url.startsWith('data:') || (url.startsWith('http') && isNotOSS(url)))) {
                  try {
                    const ext = url.startsWith('data:video') ? 'mp4' : 'png';
                    const timestamp = Date.now();
                    const filename = `luosheji/pipelines/${req.user.id}/${p.id}/asset_${asset.id || i}_variant_${j}_${field}_${timestamp}.${ext}`;
                    if (url.startsWith('data:')) {
                      variant[field] = await persistFromBase64(url, filename);
                    } else {
                      variant[field] = await persistFromUrl(url, filename);
                    }
                  } catch (storageErr) {
                    console.warn(`Failed to persist pipeline asset ${i} variant ${j} media ${field} to storage:`, storageErr);
                  }
                }
              }
            }
          }

          // Handle voiceUrl
          if (asset.details && asset.details.voiceUrl) {
            const url = asset.details.voiceUrl;
            if (url && url.startsWith('data:')) {
              try {
                const mimeType = url.split(';')[0].split(':')[1];
                const ext = mimeType.split('/')[1] || 'mp3';
                const timestamp = Date.now();
                const filename = `luosheji/pipelines/${req.user.id}/${p.id}/asset_${asset.id || i}_voice_${timestamp}.${ext}`;
                asset.details.voiceUrl = await persistFromBase64(url, filename);
              } catch (storageErr) {
                console.warn(`Failed to persist pipeline asset ${i} voice to storage:`, storageErr);
              }
            }
          }
        }
      }

      // Persist segments to OSS if configured
      if (p.segments && Array.isArray(p.segments)) {
        for (let i = 0; i < p.segments.length; i++) {
          const segment = p.segments[i];
          const url = segment.generatedVideoUrl;
          const isNotOSS = (u: string) => u && !u.includes('aliyuncs.com');
          if (url && (url.startsWith('data:') || (url.startsWith('http') && isNotOSS(url)))) {
            try {
              const ext = url.startsWith('data:video') ? 'mp4' : 'png';
              const timestamp = Date.now();
              const filename = `luosheji/pipelines/${req.user.id}/${p.id}/segment_${segment.index || i}_video_${timestamp}.${ext}`;
              if (url.startsWith('data:')) {
                segment.generatedVideoUrl = await persistFromBase64(url, filename);
              } else {
                segment.generatedVideoUrl = await persistFromUrl(url, filename);
              }
              
              // Also update in tasks if present
              if (p.tasks && Array.isArray(p.tasks)) {
                for (const task of p.tasks) {
                  if (task.segments && Array.isArray(task.segments)) {
                    for (const s of task.segments) {
                      // Match by ID primarily, fallback to index ONLY if both are defined
                      const matchesId = s.id && segment.id && s.id === segment.id;
                      const matchesIndex = segment.index !== undefined && s.index === segment.index;
                      
                      if (matchesId || matchesIndex) {
                        s.generatedVideoUrl = segment.generatedVideoUrl;
                      }
                    }
                  }
                }
              }
            } catch (storageErr) {
              console.warn(`Failed to persist pipeline segment ${i} video to storage:`, storageErr);
            }
          }
        }
      }

      await db.query(
        `INSERT INTO pipelines (id, user_id, name, timestamp, original_script, director_style, aspect_ratio, visual_style, image_quality, narrative_mode, target_segments, assets, tasks, segments, global_rule) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         name = VALUES(name), timestamp = VALUES(timestamp), original_script = VALUES(original_script), 
         director_style = VALUES(director_style), aspect_ratio = VALUES(aspect_ratio), 
         visual_style = VALUES(visual_style), image_quality = VALUES(image_quality), 
         narrative_mode = VALUES(narrative_mode), target_segments = VALUES(target_segments), 
         assets = VALUES(assets), tasks = VALUES(tasks), segments = VALUES(segments), 
         global_rule = VALUES(global_rule)`,
        [
          p.id, req.user.id, p.name, p.timestamp, p.originalScript, p.directorStyle, 
          p.aspectRatio, p.visualStyle, p.imageQuality, p.narrativeMode, 
          p.targetSegments, JSON.stringify(p.assets), JSON.stringify(p.tasks), 
          JSON.stringify(p.segments || []), p.globalRule
        ]
      );
      res.json({ success: true, assets: p.assets });
    } catch (e: any) {
      res.status(500).json({ error: "保存流水线失败", details: e.message });
    }
  });

  app.delete("/api/user/pipelines/:id", authenticateToken, async (req: any, res) => {
    try {
      await db.query("DELETE FROM pipelines WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "删除流水线失败", details: e.message });
    }
  });

  // --- Leader Routes ---

  const isLeader = (req: any, res: any, next: any) => {
    if (req.user.role !== 'leader' && req.user.role !== 'admin') {
      return res.status(401).json({ error: '需要组长或管理员权限' });
    }
    next();
  };

  const isLeaderOrTeamMember = (req: any, res: any, next: any) => {
    if (req.user.role === 'leader' || req.user.role === 'admin' || req.user.leader_id) {
      return next();
    }
    return res.status(401).json({ error: '需要组长、管理员或团队成员权限' });
  };

  // --- Leader/Team Management Routes ---

  app.post("/api/user/leave-team/:teamId", authenticateToken, async (req: any, res) => {
    const { teamId } = req.params;
    const userId = req.user.id;

    try {
      // Check if user is in the team
      const [membership]: any = await db.query("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, userId]);
      if (membership.length === 0) return res.status(404).json({ error: "您不在该团队中" });

      // Check if user is the leader of the team
      const [team]: any = await db.query("SELECT leader_id FROM teams WHERE id = ?", [teamId]);
      if (team.length === 0) return res.status(404).json({ error: "团队不存在" });
      
      if (team[0].leader_id === userId) {
        return res.status(400).json({ error: "组长不能退出团队，请先解散团队或转移权限" });
      }

      // Remove from team_members
      await db.query("DELETE FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, userId]);

      // Check if user is in OTHER teams of the same leader
      const [otherTeams]: any = await db.query(`
        SELECT tm.id FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.user_id = ? AND t.leader_id = ?
      `, [userId, team[0].leader_id]);

      if (otherTeams.length === 0) {
        await db.query("UPDATE users SET leader_id = NULL, point_limit = 0 WHERE id = ? AND leader_id = ?", [userId, team[0].leader_id]);
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "退出团队失败", details: e.message });
    }
  });

  app.get("/api/leader/teams", authenticateToken, async (req: any, res) => {
    try {
      let teams;
      if (req.user.role === 'leader' || req.user.role === 'admin') {
        [teams] = await db.query(
          "SELECT * FROM teams WHERE leader_id = ? ORDER BY created_at DESC",
          [req.user.id]
        );
      } else {
        // For regular members, return teams they belong to
        [teams] = await db.query(
          `SELECT t.* FROM teams t 
           JOIN team_members tm ON t.id = tm.team_id 
           WHERE tm.user_id = ? 
           ORDER BY t.created_at DESC`,
          [req.user.id]
        );
      }
      res.json(teams);
    } catch (e: any) {
      res.status(500).json({ error: "获取团队列表失败", details: e.message });
    }
  });

  app.post("/api/leader/teams", authenticateToken, async (req: any, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "团队名称不能为空" });

    try {
      const [result]: any = await db.query(
        "INSERT INTO teams (name, leader_id) VALUES (?, ?)",
        [name, req.user.id]
      );
      res.json({ id: result.insertId, name, leader_id: req.user.id });
    } catch (e: any) {
      res.status(500).json({ error: "创建团队失败", details: e.message });
    }
  });

  app.patch("/api/leader/teams/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "团队名称不能为空" });

    try {
      // Ensure the team belongs to the current user
      const [teams]: any = await db.query("SELECT id FROM teams WHERE id = ? AND leader_id = ?", [id, req.user.id]);
      if (teams.length === 0) return res.status(401).json({ error: "无权修改此团队" });

      await db.query("UPDATE teams SET name = ? WHERE id = ?", [name, id]);
      res.json({ success: true, name });
    } catch (e: any) {
      res.status(500).json({ error: "修改团队名称失败", details: e.message });
    }
  });

  app.delete("/api/leader/teams/:id", authenticateToken, async (req: any, res) => {
    try {
      // Ensure the team belongs to the current user
      const [teams]: any = await db.query("SELECT id FROM teams WHERE id = ? AND leader_id = ?", [req.params.id, req.user.id]);
      if (teams.length === 0) return res.status(401).json({ error: "无权删除此团队" });

      // Get all members of this team before deleting
      const [members]: any = await db.query("SELECT user_id FROM team_members WHERE team_id = ?", [req.params.id]);
      const memberIds = members.map((m: any) => m.user_id);

      // Delete team members first (due to foreign key or mapping)
      await db.query("DELETE FROM team_members WHERE team_id = ?", [req.params.id]);
      await db.query("DELETE FROM teams WHERE id = ?", [req.params.id]);

      // For each affected member, if they are no longer in any teams of this leader, clear their leader_id and point_limit
      if (memberIds.length > 0) {
        for (const userId of memberIds) {
          const [otherTeams]: any = await db.query(`
            SELECT tm.id FROM team_members tm
            JOIN teams t ON tm.team_id = t.id
            WHERE tm.user_id = ? AND t.leader_id = ?
          `, [userId, req.user.id]);

          if (otherTeams.length === 0) {
            await db.query("UPDATE users SET leader_id = NULL, point_limit = 0 WHERE id = ? AND leader_id = ?", [userId, req.user.id]);
          }
        }
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "删除团队失败", details: e.message });
    }
  });

  app.get("/api/leader/teams/:teamId/members", authenticateToken, async (req: any, res) => {
    try {
      // Check if user is leader of the team or an admin
      const [teams]: any = await db.query("SELECT leader_id FROM teams WHERE id = ?", [req.params.teamId]);
      if (teams.length === 0) return res.status(404).json({ error: "团队不存在" });
      
      const isLeader = teams[0].leader_id === req.user.id;
      const isAdmin = req.user.role === 'admin';
      
      // Also check if user is a member of the team
      const [membership]: any = await db.query("SELECT id FROM team_members WHERE team_id = ? AND user_id = ?", [req.params.teamId, req.user.id]);
      const isMember = membership.length > 0;

      if (!isLeader && !isAdmin && !isMember) {
        return res.status(401).json({ error: "无权查看此团队成员" });
      }

      const [members]: any = await db.query(`
        SELECT u.id, u.username, u.phone, u.role, u.status, u.point_limit,
        COALESCE(SUM(l.amount), 0) as monthly_points_spent
        FROM users u
        LEFT JOIN team_members tm ON u.id = tm.user_id
        JOIN teams t ON t.id = ?
        LEFT JOIN usage_logs l ON u.id = l.user_id AND l.type = 'points_spent' AND l.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        WHERE tm.team_id = t.id OR u.id = t.leader_id
        GROUP BY u.id
      `, [req.params.teamId]);
      
      const formattedMembers = members.map((m: any) => ({
        ...m,
        monthly_points_spent: Number(m.monthly_points_spent) || 0,
        point_limit: Number(m.point_limit) || 0
      }));

      res.json(formattedMembers);
    } catch (e: any) {
      res.status(500).json({ error: "获取成员列表失败", details: e.message });
    }
  });

  app.post("/api/leader/teams/:teamId/add-member", authenticateToken, async (req: any, res) => {
    const { identifier } = req.body;
    const { teamId } = req.params;

    try {
      // Check if user is leader of the team
      const [teams]: any = await db.query("SELECT leader_id FROM teams WHERE id = ?", [teamId]);
      if (teams.length === 0) return res.status(404).json({ error: "团队不存在" });
      if (teams[0].leader_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(401).json({ error: "无权向此团队添加成员" });
      }

      const [users]: any = await db.query(
        "SELECT id, role FROM users WHERE username = ? OR phone = ?",
        [identifier, identifier]
      );

      if (users.length === 0) return res.status(404).json({ error: "用户不存在" });
      const targetUser = users[0];

      if (targetUser.role === 'admin') return res.status(400).json({ error: "不能添加管理员" });

      // Check member limit
      const [count]: any = await db.query("SELECT COUNT(*) as total FROM team_members WHERE team_id = ?", [teamId]);
      if (count[0].total >= 200) return res.status(400).json({ error: "团队成员已达上限" });

      // Add to team_members
      await db.query(
        "INSERT IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)",
        [teamId, targetUser.id]
      );

      // Update leader_id for point deduction (backward compatibility)
      await db.query("UPDATE users SET leader_id = ? WHERE id = ?", [teams[0].leader_id, targetUser.id]);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "添加成员失败", details: e.message });
    }
  });

  app.delete("/api/leader/teams/:teamId/remove-member/:userId", authenticateToken, async (req: any, res) => {
    const { teamId, userId } = req.params;

    try {
      // Check if user is leader of the team
      const [teams]: any = await db.query("SELECT leader_id FROM teams WHERE id = ?", [teamId]);
      if (teams.length === 0) return res.status(404).json({ error: "团队不存在" });
      if (teams[0].leader_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(401).json({ error: "无权从此团队移除成员" });
      }

      await db.query("DELETE FROM team_members WHERE team_id = ? AND user_id = ?", [teamId, userId]);

      // If user is no longer in any team of this leader, clear leader_id?
      // For now, just clear it if they are removed from THIS team.
      // Actually, it's safer to check if they are in OTHER teams of the SAME leader.
      const [otherTeams]: any = await db.query(`
        SELECT tm.id FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.user_id = ? AND t.leader_id = ?
      `, [userId, teams[0].leader_id]);

      if (otherTeams.length === 0) {
        await db.query("UPDATE users SET leader_id = NULL, point_limit = 0 WHERE id = ? AND leader_id = ?", [userId, teams[0].leader_id]);
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "移除成员失败", details: e.message });
    }
  });

  app.get("/api/leader/members", authenticateToken, isLeaderOrTeamMember, async (req: any, res) => {
    try {
      let leaderId = req.user.id;
      
      // If user is a regular member, they should see their leader's team
      if (req.user.role === 'user') {
        const [users]: any = await db.query("SELECT leader_id FROM users WHERE id = ?", [req.user.id]);
        leaderId = users[0]?.leader_id;
      }

      if (!leaderId && req.user.role !== 'admin') {
        return res.json([]);
      }

      const [members]: any = await db.query(
        `SELECT u.id, u.username, u.phone, u.role, u.status, u.point_limit,
         COALESCE(SUM(l.amount), 0) as monthly_points_spent
         FROM users u 
         LEFT JOIN usage_logs l ON u.id = l.user_id AND l.type = 'points_spent' AND l.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         WHERE u.leader_id = ? OR u.id = ?
         GROUP BY u.id`,
        [leaderId, leaderId]
      );
      res.json(members);
    } catch (e: any) {
      res.status(500).json({ error: "获取成员失败", details: e.message });
    }
  });

  app.patch("/api/leader/members/:userId/limit", authenticateToken, async (req: any, res) => {
    const { userId } = req.params;
    const { point_limit } = req.body;

    try {
      // Check if user is leader of the target user or an admin
      const [users]: any = await db.query("SELECT leader_id FROM users WHERE id = ?", [userId]);
      if (users.length === 0) return res.status(404).json({ error: "用户不存在" });
      
      const isLeader = users[0].leader_id === req.user.id;
      const isAdmin = req.user.role === 'admin';

      if (!isLeader && !isAdmin) {
        return res.status(401).json({ error: "无权修改此成员的积分限制" });
      }

      await db.query("UPDATE users SET point_limit = ? WHERE id = ?", [point_limit, userId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "修改积分限制失败", details: e.message });
    }
  });

  app.post("/api/leader/add-member", authenticateToken, isLeader, async (req: any, res) => {
    const { identifier } = req.body; // username or phone
    if (!identifier) return res.status(400).json({ error: "缺少标识符" });

    try {
      const leaderId = req.user.id;

      // Check member limit
      const [countResult]: any = await db.query("SELECT COUNT(*) as count FROM users WHERE leader_id = ?", [leaderId]);
      if (countResult[0].count >= 200) {
        return res.status(400).json({ error: "团队成员已达上限 (200人)" });
      }

      // Find user
      const [users]: any = await db.query("SELECT id, leader_id, role FROM users WHERE username = ? OR phone = ?", [identifier, identifier]);
      const user = users[0];

      if (!user) return res.status(404).json({ error: "未找到该用户" });
      if (user.leader_id) return res.status(400).json({ error: "该用户已在其他团队中" });
      if (user.role === 'admin') return res.status(400).json({ error: "不能添加管理员为成员" });
      if (user.id === leaderId) return res.status(400).json({ error: "不能添加自己" });

      await db.query("UPDATE users SET leader_id = ? WHERE id = ?", [leaderId, user.id]);
      res.json({ success: true, message: "添加成功" });
    } catch (e: any) {
      res.status(500).json({ error: "添加成员失败", details: e.message });
    }
  });

  app.delete("/api/leader/remove-member/:id", authenticateToken, isLeader, async (req: any, res) => {
    try {
      const leaderId = req.user.id;
      const memberId = req.params.id;

      // Delete user from all teams belonging to this leader
      await db.query(`
        DELETE tm FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.user_id = ? AND t.leader_id = ?
      `, [memberId, leaderId]);

      // Set leader_id to NULL and reset point_limit to 0
      await db.query("UPDATE users SET leader_id = NULL, point_limit = 0 WHERE id = ? AND leader_id = ?", [memberId, leaderId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "移除成员失败", details: e.message });
    }
  });

  app.post("/api/leader/transfer-role/:id", authenticateToken, isLeader, async (req: any, res) => {
    try {
      const leaderId = req.user.id;
      const memberId = req.params.id;

      // Check if member is in team
      const [members]: any = await db.query("SELECT id FROM users WHERE id = ? AND leader_id = ?", [memberId, leaderId]);
      if (!members[0]) return res.status(400).json({ error: "该用户不是您的团队成员" });

      // Start transaction
      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        // 1. Set member as leader, clear point limit
        await connection.query("UPDATE users SET role = 'leader', leader_id = NULL, point_limit = 0 WHERE id = ?", [memberId]);
        // 2. Set all other members to the new leader
        await connection.query("UPDATE users SET leader_id = ? WHERE leader_id = ?", [memberId, leaderId]);
        // 3. Update teams owned by the old leader to the new leader
        await connection.query("UPDATE teams SET leader_id = ? WHERE leader_id = ?", [memberId, leaderId]);
        // 4. Set old leader as member of new leader
        await connection.query("UPDATE users SET role = 'user', leader_id = ? WHERE id = ?", [memberId, leaderId]);
        // 5. Add old leader as a member to the teams they just transferred
        const [transferredTeams]: any = await connection.query("SELECT id FROM teams WHERE leader_id = ?", [memberId]);
        for (const team of transferredTeams) {
          await connection.query("INSERT IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)", [team.id, leaderId]);
        }

        await connection.commit();
        res.json({ success: true, message: "权限转移成功" });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } catch (e: any) {
      res.status(500).json({ error: "转移角色失败", details: e.message });
    }
  });

  // --- Admin Routes ---

  app.get("/api/admin/accounts", authenticateToken, isAdmin, async (req, res) => {
    const q = req.query.q ? `%${req.query.q}%` : '%';
    const [users]: any = await db.query(`
      SELECT u.id, u.username, u.phone, u.points, u.role, u.status, u.created_at,
      (
        SELECT t.name 
        FROM teams t 
        LEFT JOIN team_members tm ON t.id = tm.team_id 
        WHERE tm.user_id = u.id OR t.leader_id = u.id
        LIMIT 1
      ) as team_name
      FROM users u 
      WHERE u.username LIKE ? OR u.phone LIKE ?
    `, [q, q]);
    res.json(users);
  });

  app.patch("/api/admin/accounts/:id", authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { points, status, password, role } = req.body;
    
    const updates: string[] = [];
    const params: any[] = [];

    if (points !== undefined) {
      updates.push("points = ?");
      params.push(points);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }
    if (role !== undefined) {
      updates.push("role = ?");
      params.push(role);
      if (role === 'leader') {
        updates.push("point_limit = 0");
        updates.push("leader_id = NULL");
      }
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push("password = ?");
      params.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "未提供更新内容" });
    }

    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
    params.push(id);

    try {
      const [result]: any = await db.query(query, params);
      if (result.affectedRows === 0) return res.status(404).json({ error: "未找到用户" });
      res.json({ message: "用户已更新" });
    } catch (e: any) {
      res.status(500).json({ error: "更新失败", details: e.message });
    }
  });

  app.post("/api/admin/accounts/:id/leave-team", authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      await db.query("DELETE FROM team_members WHERE user_id = ?", [id]);
      await db.query("UPDATE users SET leader_id = NULL, point_limit = 0 WHERE id = ?", [id]);
      res.json({ success: true, message: "已将该用户从所有小组中移除" });
    } catch (e: any) {
      res.status(500).json({ error: "操作失败", details: e.message });
    }
  });

  app.delete("/api/admin/accounts/:id", authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const [result]: any = await db.query("DELETE FROM users WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(500).json({ error: "删除失败" });
    res.json({ message: "用户已删除" });
  });

  app.post("/api/admin/invitation-codes", authenticateToken, isLeader, async (req: any, res) => {
    const count = parseInt(req.body.count) || 10;
    if (count > 100) return res.status(400).json({ error: "一次生成的邀请码过多" });
    
    const codes = [];
    for (let i = 0; i < count; i++) {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await db.query("INSERT INTO invitation_codes (code, creator_id) VALUES (?, ?)", [newCode, req.user.id]);
      codes.push(newCode);
    }
    res.json({ message: `${count} codes generated`, codes });
  });

  // --- Group Chat Routes ---

  app.post("/api/group-chats", authenticateToken, async (req: any, res) => {
    const { name, memberIds, agentIds, objective } = req.body;
    if (!name) return res.status(400).json({ error: "群组名称不能为空" });

    try {
      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        const [result]: any = await connection.query(
          "INSERT INTO group_chats (name, leader_id, objective, agent_ids) VALUES (?, ?, ?, ?)",
          [name, req.user.id, objective || '', JSON.stringify(agentIds || [])]
        );
        const groupId = result.insertId;

        // Add creator as member
        await connection.query(
          "INSERT INTO group_chat_members (group_id, user_id) VALUES (?, ?)",
          [groupId, req.user.id]
        );

        // Add other members
        if (Array.isArray(memberIds)) {
          for (const memberId of memberIds) {
            if (memberId === req.user.id) continue;
            await connection.query(
              "INSERT IGNORE INTO group_chat_members (group_id, user_id) VALUES (?, ?)",
              [groupId, memberId]
            );
          }
        }

        await connection.commit();
        res.json({ success: true, groupId });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } catch (e: any) {
      res.status(500).json({ error: "创建群聊失败", details: e.message });
    }
  });

  app.get("/api/group-chats", authenticateToken, async (req: any, res) => {
    try {
      // Ensure default "项目1组" exists if user is in a team
      const effectiveLeaderId = req.user.role === 'leader' ? req.user.id : req.user.leader_id;
      
      if (effectiveLeaderId) {
        const [existingDefault]: any = await db.query(
          "SELECT id FROM group_chats WHERE name = ? AND leader_id = ? LIMIT 1",
          ['项目1组', effectiveLeaderId]
        );

        let groupId;
        if (existingDefault.length === 0) {
          // Create the default group
          try {
            const [result]: any = await db.query(
              "INSERT INTO group_chats (name, leader_id) VALUES (?, ?)",
              ['项目1组', effectiveLeaderId]
            );
            groupId = result.insertId;
            
            // Add all members + leader
            const membersToAdd = [effectiveLeaderId];
            const [teamMembers]: any = await db.query("SELECT id FROM users WHERE leader_id = ?", [effectiveLeaderId]);
            teamMembers.forEach((m: any) => membersToAdd.push(m.id));
            
            for (const memberId of [...new Set(membersToAdd)]) {
              await db.query(
                "INSERT IGNORE INTO group_chat_members (group_id, user_id) VALUES (?, ?)",
                [groupId, memberId]
              );
            }
          } catch (err: any) {
             // Handle race condition
             console.log("Error or race in default group creation:", err.message);
          }
        } else {
          groupId = existingDefault[0].id;
          // Ensure current user is a member
          await db.query(
            "INSERT IGNORE INTO group_chat_members (group_id, user_id) VALUES (?, ?)",
            [groupId, req.user.id]
          );
        }
      }

      let query = `
        SELECT g.*, 
        (SELECT GROUP_CONCAT(user_id) FROM group_chat_members WHERE group_id = g.id) as memberIds,
        (SELECT MAX(timestamp) FROM group_messages WHERE group_id = g.id) as lastMessageAt
        FROM group_chats g
        WHERE g.leader_id = ? OR g.id IN (SELECT group_id FROM group_chat_members WHERE user_id = ?)
      `;
      let params = [req.user.id, req.user.id];

      const [groups]: any = await db.query(query, params);

      const parsedGroups = groups.map((g: any) => ({
        ...g,
        memberIds: g.memberIds ? g.memberIds.split(',').map(Number) : [],
        agentIds: g.agent_ids ? JSON.parse(g.agent_ids) : []
      }));

      res.json(parsedGroups);
    } catch (e: any) {
      res.status(500).json({ error: "获取群聊列表失败", details: e.message });
    }
  });

  app.put("/api/group-chats/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { name, memberIds, agentIds, objective } = req.body;

    try {
      const [groups]: any = await db.query("SELECT leader_id FROM group_chats WHERE id = ?", [id]);
      if (!groups[0]) return res.status(404).json({ error: "未找到群聊" });
      if (groups[0].leader_id !== req.user.id) {
        return res.status(401).json({ error: "无权编辑群聊，仅创建者可修改" });
      }

      const connection = await db.getConnection();
      await connection.beginTransaction();

      try {
        if (name) {
          await connection.query("UPDATE group_chats SET name = ? WHERE id = ?", [name, id]);
        }

        if (objective !== undefined) {
          await connection.query("UPDATE group_chats SET objective = ? WHERE id = ?", [objective, id]);
        }

        if (agentIds !== undefined) {
          await connection.query("UPDATE group_chats SET agent_ids = ? WHERE id = ?", [JSON.stringify(agentIds), id]);
        }

        if (Array.isArray(memberIds)) {
          // Sync members: remove old, add new
          await connection.query("DELETE FROM group_chat_members WHERE group_id = ?", [id]);
          // Add creator back
          await connection.query("INSERT INTO group_chat_members (group_id, user_id) VALUES (?, ?)", [id, groups[0].leader_id]);
          // Add others
          for (const memberId of memberIds) {
            if (memberId === groups[0].leader_id) continue;
            await connection.query("INSERT IGNORE INTO group_chat_members (group_id, user_id) VALUES (?, ?)", [id, memberId]);
          }
        }

        await connection.commit();
        res.json({ success: true });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } catch (e: any) {
      res.status(500).json({ error: "更新群聊失败", details: e.message });
    }
  });

  app.post("/api/group-chats/:id/join", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
      const [groups]: any = await db.query("SELECT leader_id FROM group_chats WHERE id = ?", [id]);
      if (!groups[0]) return res.status(404).json({ error: "未找到群聊" });
      
      await db.query("INSERT IGNORE INTO group_chat_members (group_id, user_id) VALUES (?, ?)", [id, userId]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "加入群聊失败", details: e.message });
    }
  });

  app.delete("/api/group-chats/:id", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    try {
      const [groups]: any = await db.query("SELECT leader_id FROM group_chats WHERE id = ?", [id]);
      if (!groups[0]) return res.status(404).json({ error: "未找到群聊" });
      
      const isAdmin = req.user.role === 'admin';
      if (!isAdmin && groups[0].leader_id !== req.user.id) {
        return res.status(401).json({ error: "无权删除群聊，仅创建者或管理员可删除" });
      }

      await db.query("DELETE FROM group_chats WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "删除群聊失败", details: e.message });
    }
  });

  app.post("/api/group-messages", authenticateToken, async (req: any, res) => {
    const { groupId, content, type, url, quotedMessageId, agentContext } = req.body;
    if (!groupId || !content) return res.status(400).json({ error: "参数不完整" });

    // Sanitize quotedMessageId if it's coming from frontend with prefix
    let sanitizedQuoteId = quotedMessageId;
    if (typeof quotedMessageId === 'string' && (quotedMessageId.startsWith('server_') || quotedMessageId.startsWith('local_'))) {
      sanitizedQuoteId = parseInt(quotedMessageId.replace('server_', '').replace('local_', ''));
      if (isNaN(sanitizedQuoteId)) sanitizedQuoteId = null;
    }

    try {
      // Check if member
      const [members]: any = await db.query(
        "SELECT id FROM group_chat_members WHERE group_id = ? AND user_id = ?",
        [groupId, req.user.id]
      );
      if (!members[0]) return res.status(403).json({ error: "您不是该群聊的成员" });

      const timestamp = Date.now();
      const [result]: any = await db.query(
        "INSERT INTO group_messages (group_id, sender_id, content, type, url, quoted_message_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [groupId, req.user.id, content, type || 'text', url || null, sanitizedQuoteId || null, timestamp]
      );

      res.json({ success: true, messageId: result.insertId, timestamp });

      // --- AI Collaboration Logic ---
      console.log(`[GroupChat] Message from user ${req.user.id} in group ${groupId}. Content: ${content.substring(0, 50)}...`);
      try {
        const enableAiCollaboration = true;
        if (enableAiCollaboration) {
          // Get group context/objective and involved agents
          const [groupData]: any = await db.query("SELECT objective, name, agent_ids FROM group_chats WHERE id = ?", [groupId]);
          const objective = groupData[0]?.objective || "协同完成项目任务";
          const groupName = groupData[0]?.name || "项目组";
          
          const mentionMatch = content.match(/@([^\s]+)/);
          const mentionedName = mentionMatch ? mentionMatch[1] : null;

          // Ids Map for names
          const agentMap: Record<string, string> = {
            'CEO': 'ceo', '导师': 'ceo', '大脑': 'ceo', 'AI': 'ceo', '统筹': 'ceo', '首席执行官': 'ceo',
            '编剧': 'script', '创意': 'script', '大纲': 'script', '灵感': 'script', '剧本': 'script',
            '分析': 'script_analyzer', '拉片': 'script_analyzer', '分析专家': 'script_analyzer',
            '改写': 'script_rewriter', '洗稿': 'script_rewriter',
            '分镜': 'director', '镜头': 'director', '运镜': 'director',
            '提示词': 'prompts', '指令': 'prompts', 'Prompt': 'prompts',
            '生图': 'image_gemini', '画图': 'image_gemini', '图片': 'image_gemini', 'GPT生图': 'image_gemini',
            '专家': 'image_gemini', '生图专家': 'image_gemini', '参考图': 'image_gemini', '绘画': 'image_gemini',
            '导演': 'video', '剧照': 'image_gemini', '效果图': 'image_gemini',
            '视频': 'video', '动态': 'video', '动画': 'video',
            '影音': 'video_analyzer', '视频分析': 'video_analyzer', '分镜拆解': 'video_analyzer',
            '制剧': 'director_producer', '制片': 'director_producer',
            '灵境': 'spirit_space', '空间': 'spirit_space', '场景': 'spirit_space',
            '招聘': 'recruiter', '招聘会': 'recruiter', '智能体': 'ceo', '超级员工': 'ceo',
            '质检': 'qc', '审计': 'qc'
          };

          let respondingAgentId: string | null = null;
          let displayName = mentionedName || 'AI专家';
          let customSystemInstruction = agentContext?.systemInstruction;

          const agentIdToNameMap: Record<string, string> = {
            'ceo': '首席执行官 CEO',
            'script': '创作剧本专家',
            'script_analyzer': '分析剧本专家',
            'video_analyzer': '影音拉片专家',
            'script_rewriter': '剧本改写专家',
            'director_producer': '拆解剧本专家',
            'spirit_space': '灵境空间专家',
            'prompts': '视频提示词专家',
            'image': '生图专家 (GPT)',
            'image_gemini': 'gemini3.1',
            'video': '生视频专家',
            'realperson_video': '真人视频专家',
            'recruiter': '招聘主管',
            'qc': '质检审计'
          };

          if (agentContext && agentContext.agentId) {
            respondingAgentId = agentContext.agentId;
            // Try to find display name if not explicitly mentioned
            if (!mentionedName) {
               displayName = agentIdToNameMap[respondingAgentId] || 'AI专家';
            }
          } else if (mentionedName) {
            for (const [keyword, agentId] of Object.entries(agentMap)) {
              if (mentionedName.includes(keyword)) {
                respondingAgentId = agentId;
                break;
              }
            }
          } else {
            // Intelligent semantic keyword routing if there are agents invited to the group chat
            let invitedAgentIds: string[] = [];
            try {
              invitedAgentIds = groupData[0]?.agent_ids ? JSON.parse(groupData[0].agent_ids) : [];
            } catch (e) {
              console.error("Failed to parse agent_ids from group:", e);
            }

            if (Array.isArray(invitedAgentIds) && invitedAgentIds.length > 0) {
              // 1. Try to find if any keyword in the message content matches an invited agent
              for (const [keyword, agentId] of Object.entries(agentMap)) {
                if (content.includes(keyword) && invitedAgentIds.includes(agentId)) {
                  respondingAgentId = agentId;
                  displayName = agentIdToNameMap[agentId] || 'AI专家';
                  break;
                }
              }
              // 2. If no keyword matches, fallback to CEO if CEO is in the group, otherwise fallback to the first invited agent
              if (!respondingAgentId) {
                if (invitedAgentIds.includes('ceo')) {
                  respondingAgentId = 'ceo';
                } else {
                  respondingAgentId = invitedAgentIds[0];
                }
                displayName = agentIdToNameMap[respondingAgentId] || 'AI专家';
              }
            }
          }

          if (respondingAgentId) {
            console.log(`[GroupChat] Responding agent identified: ${respondingAgentId}`);
            // 立即插入一条“研讨中”的占位消息
            const [placeholderResult]: any = await db.query(
              "INSERT INTO group_messages (group_id, sender_id, agent_name, content, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
              [groupId, null, displayName, '专家正在研讨中...', 'thinking', Date.now()]
            );
            const placeholderId = placeholderResult.insertId;

          setTimeout(async () => {
            try {
              // Get recent history for context
              const [history]: any = await db.query(
                "SELECT m.*, u.username FROM group_messages m LEFT JOIN users u ON m.sender_id = u.id WHERE m.group_id = ? ORDER BY m.timestamp DESC LIMIT 15",
                [groupId]
              );
              
              const chatHistory = history.reverse().map((h: any) => `${h.username || h.agent_name || 'AI'}: ${h.content}`).join('\n');

              const agentRoles: Record<string, string> = {
                'ceo': '团队领导者和首席执行官，提供战略决策和整体协调',
                'script': '资深编剧和创意策划，擅长剧本创作',
                'script_analyzer': '顶级剧本分析专家，擅长深度拉片和剧本结构拆解',
                'script_rewriter': '剧本改写专家，擅长彻底规避版权风险并重新创作剧本',
                'prompts': '提示词专家，精通 AI 会话和生图指令',
                'image_gemini': '生图专家，擅长通过文本生成极高艺术性的图片',
                'video': '视频专家，擅长生成高质量视频内容',
                'video_analyzer': '影音拉片专家，擅长视频分镜深度拆解和视听语言分析',
                'director_producer': '拆解剧本专家，擅长统筹制片、剧本拆解与资产协同',
                'spirit_space': '灵境空间专家，擅长场景设计与超写实全景资产构建',
                'realperson_video': '数字人视频专家，擅长生成逼真的真人解说和人物视频',
                'recruiter': '智能体猎头，擅长分析需求并推荐最合适的AI协同方案',
                'qc': '质量控制专家，负责对产出的内容进行严格审计和优化建议'
              };
              const roleDesc = agentRoles[respondingAgentId!] || 'AI协同专家';

              let aiPrompt = '';
              if (customSystemInstruction) {
                aiPrompt = `${customSystemInstruction}\n\n当前群组的项目目标是: ${objective}\n目前群聊内的对话如下:\n${chatHistory}\n\n请根据你的专业背景和当前对话语境加入讨论。直接输出回复内容，不要带任何前缀。`;
              } else {
                aiPrompt = `你是一名资深的 ${groupName} 专家，你的角色是: ${roleDesc}。
当前群组的项目目标是: ${objective}
目前群聊内的对话如下:
${chatHistory}

请根据你的专业背景和当前对话语境加入讨论。
你的回复应该是启发性的、专业且简洁的。
如果你被提到（@）而回应，请针对提到的问题给出明确方案。
直接输出回复内容，不要带任何前缀。`;
              }

              // Get global config for image helper
              const [configRows]: any = await db.query("SELECT value FROM settings WHERE `key` = 'global_api_config'");
              const globalConfig = safeParseJson(configRows[0]?.value, {});

              // Determine which API key to use based on the responding agent and global settings
              // Always check DB config first as it's what the user sees in UI
              let apiKeyToUse = process.env.GEMINI_API_KEY;
              
              // Map agents to their config slots
              const agentToSlotMap: Record<string, string> = {
                'script': 'script',
                'ceo': 'script',
                'script_analyzer': 'script',
                'script_rewriter': 'script',
                'image': 'gptImage', // 生图专家 (GPT)
                'image_gemini': 'image', // 生图专家 (Gemini)
                'spirit_space': 'image',
                'director_producer': 'script',
                'prompts': 'script',
                'video': 'script',
                'recruiter': 'script',
                'qc': 'script'
              };

              // Get the slot for the agent
              const slot = respondingAgentId ? agentToSlotMap[respondingAgentId] || 'gptImage' : 'gptImage';
              
              // Find the configuration. Fallback chain: agent slot -> gptImage (for image agents) -> script -> global default
              let config = globalConfig[slot];
              let usedSlot = slot;
              
              // Special fallback for image agents if their specific slot is empty
              if ((!config || !config.apiKey) && (slot === 'gptImage' || slot === 'image')) {
                if (globalConfig['gptImage']?.apiKey) {
                  config = globalConfig['gptImage'];
                  usedSlot = 'gptImage';
                } else if (globalConfig['image']?.apiKey) {
                  config = globalConfig['image'];
                  usedSlot = 'image';
                } else {
                  config = globalConfig['script'] || {};
                  usedSlot = 'script';
                }
              } else if (!config || !config.apiKey) {
                config = globalConfig['script'] || {};
                usedSlot = 'script';
              }

              const configKey = config.apiKey;

              if (configKey && typeof configKey === 'string' && configKey.trim().length > 5 && configKey !== 'undefined') {
                apiKeyToUse = configKey.trim();
              }

              // Helper to execute AI calls respecting global configuration (handling proxies, endpoints, protocols)
              const executeAi = async (s: any, p: string, sys?: string) => {
                const m = globalConfig[s]?.model || "gemini-3-flash-preview";
                const body: any = {
                  model: m,
                  contents: [{ parts: [{ text: p }] }]
                };
                if (sys) {
                  body.systemInstruction = { parts: [{ text: sys }] };
                }
                return await imageAgent.callApi(s, 'generateContent', body, globalConfig);
              };

              // 特殊处理生图专家
              const isImageAgent = respondingAgentId === 'image_gemini' || respondingAgentId === 'image' || respondingAgentId === 'spirit_space';
              
              if (isImageAgent) {
                // 尝试提取关键词生图
                try {
                  const extractionResult = await executeAi(usedSlot, `基于以下对话，为生图助手提取一个最适合的绘图提示词（包含风格描述、镜头等细节，输出为英文）：\n\n${chatHistory}\n\n只返回提示词，不要带任何其他文字。`);
                  
                  const refinedPrompt = (extractionResult.text || "").trim() || content;
                  
                  // 调用生图专家生成真实图片
                  console.log(`[GroupChat] ImageAgent generating for prompt: ${refinedPrompt} using slot: ${usedSlot}`);
                  const imgResult = await imageAgent.generateSmartImage({
                    prompt: refinedPrompt,
                    aspectRatio: '16:9',
                    imageSize: '1K'
                  }, globalConfig);

                  let finalUrl = imgResult.imageUrl;
                  // Attempt to persist to OSS if it's a data URI or external URL
                  try {
                    finalUrl = await persistFromUrl(imgResult.imageUrl, 'group_chat_ai');
                  } catch (pErr) {
                    console.error("Persist failed, using original URL:", pErr);
                  }

                  await db.query(
                    "UPDATE group_messages SET content = ?, type = ?, url = ?, timestamp = ? WHERE id = ?",
                    [`🎨 根据当前讨论生成的图片：\n${imgResult.revisedPrompt || refinedPrompt}`, 'image', finalUrl, Date.now(), placeholderId]
                  );
                } catch (extErr: any) {
                  console.error("Extraction/Generation error:", extErr);
                  await db.query(
                    "UPDATE group_messages SET content = ?, type = ?, timestamp = ? WHERE id = ?",
                    [`🎨 **建议提示词**\n${content}\n\n(生图尝试失败: ${extErr.message})`, 'text', Date.now(), placeholderId]
                  );
                }
              } else if (respondingAgentId === 'video') {
                // 特殊处理生视频专家
                try {
                  const extractionResult = await executeAi(usedSlot, `基于以下对话，为生视频助手提取一个最适合的视频生成提示词（包含视觉风格、镜头运动、光影等细节，输出为英文）：\n\n${chatHistory}\n\n只返回提示词，不要带任何其他文字。`);
                  
                  const refinedPrompt = (extractionResult.text || "").trim() || content;
                  console.log(`[GroupChat] VideoAgent generating for prompt: ${refinedPrompt}`);

                  const result = await videoAgent.generateVideo(refinedPrompt, {
                    aspectRatio: '16:9',
                    duration: '5',
                    model: globalConfig?.video?.model || 'veo-3.1-fast-generate-preview'
                  }, globalConfig);

                  if (result.videoUrl || result.operationId) {
                    let finalVideoUrl = result.videoUrl;
                    
                    if (!finalVideoUrl && result.operationId) {
                      // 简单尝试轮询 3 次，如果还没出，就返回生成中
                      let polled = false;
                      for (let i = 0; i < 3; i++) {
                        await new Promise(resolve => setTimeout(resolve, 8000));
                        const status = await videoAgent.getOperationStatus(result, globalConfig);
                        if (status.done && status.videoUrl) {
                          finalVideoUrl = status.videoUrl;
                          polled = true;
                          break;
                        }
                      }
                      
                      if (!polled) {
                        await db.query(
                          "UPDATE group_messages SET content = ?, type = ?, timestamp = ? WHERE id = ?",
                          [`🎥 视频正在后台生成中 (Operation ID: ${result.operationId})，请稍后在历史记录中查看。\n\n提示词：${refinedPrompt}`, 'text', Date.now(), placeholderId]
                        );
                        return;
                      }
                    }

                    if (finalVideoUrl) {
                      // Attempt to persist to OSS
                      try {
                        finalVideoUrl = await persistFromUrl(finalVideoUrl, 'group_chat_ai');
                      } catch (pErr) {
                        console.error("Persist failed for video:", pErr);
                      }

                      await db.query(
                        "UPDATE group_messages SET content = ?, type = ?, url = ?, timestamp = ? WHERE id = ?",
                        [`🎥 根据讨论生成的视频：\n${refinedPrompt}`, 'video', finalVideoUrl, Date.now(), placeholderId]
                      );
                    }
                  } else {
                    throw new Error("未能启动视频生成任务");
                  }
                } catch (vErr: any) {
                  console.error("VideoAgent Error:", vErr);
                  await db.query(
                    "UPDATE group_messages SET content = ?, type = ?, timestamp = ? WHERE id = ?",
                    [`🎥 **视频生成建议**\n${content}\n\n(启动失败: ${vErr.message})`, 'text', Date.now(), placeholderId]
                  );
                }
              } else {
                try {
                  const aiResult = await executeAi(usedSlot, aiPrompt);
                  
                  const aiResponseText = aiResult.text || ' (AI 思考中，暂时没有输出内容)';

                  await db.query(
                    "UPDATE group_messages SET content = ?, type = ?, timestamp = ? WHERE id = ?",
                    [aiResponseText, 'text', Date.now(), placeholderId]
                  );
                } catch (genErr: any) {
                  console.error("Generation error:", genErr);
                  await db.query(
                    "UPDATE group_messages SET content = ?, type = ?, timestamp = ? WHERE id = ?",
                    [`⚠️ AI 暂时无法回复: ${genErr.message}`, 'text', Date.now(), placeholderId]
                  );
                }
              }
            } catch (aiErr: any) {
              console.error("AI Group Collaboration Error:", aiErr);
              await db.query(
                "UPDATE group_messages SET content = ?, type = ?, timestamp = ? WHERE id = ?",
                [`⚠️ 系统协同异常: ${aiErr.message}`, 'text', Date.now(), placeholderId]
              );
            }
          }, 1500); 
        }
        }
      } catch (err) {
        console.error("Group context fetch error:", err);
      }
    } catch (e: any) {
      res.status(500).json({ error: "发送消息失败", details: e.message });
    }
  });

  app.put("/api/group-chats/:id/objective", authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { objective } = req.body;
    try {
      const [groups]: any = await db.query("SELECT leader_id FROM group_chats WHERE id = ?", [id]);
      if (!groups[0]) return res.status(404).json({ error: "未找到群聊" });
      if (groups[0].leader_id !== req.user.id) return res.status(401).json({ error: "仅创建者可修改目标" });
      
      await db.query("UPDATE group_chats SET objective = ? WHERE id = ?", [objective, id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "更新目标失败", details: e.message });
    }
  });

  // --- Media Comments (Annotations) API ---
  app.get("/api/media-comments/:mediaId", authenticateToken, async (req: any, res) => {
    const { mediaId } = req.params;
    try {
      const [rows]: any = await db.query(
        "SELECT id, username, content, timestamp, timecode, drawings FROM media_comments WHERE media_id = ? ORDER BY timestamp ASC",
        [mediaId]
      );
      
      const comments = rows.map((r: any) => {
        let parsedDrawings = [];
        try {
          parsedDrawings = typeof r.drawings === 'string' ? JSON.parse(r.drawings) : (r.drawings || []);
        } catch (e) {
          console.error("Failed to parse drawings JSON:", e);
        }
        return {
          id: r.id,
          username: r.username,
          content: r.content,
          timestamp: Number(r.timestamp),
          timecode: r.timecode || undefined,
          drawings: parsedDrawings
        };
      });

      res.json(comments);
    } catch (e: any) {
      res.status(500).json({ error: "获取批注失败", details: e.message });
    }
  });

  app.post("/api/media-comments/:mediaId", authenticateToken, async (req: any, res) => {
    const { mediaId } = req.params;
    const { id, username, content, timestamp, timecode, drawings } = req.body;
    
    if (!content && (!drawings || drawings.length === 0)) {
      return res.status(400).json({ error: "内容与图形标注不能同时为空" });
    }

    if (req.user.id === 999999) {
      return res.status(403).json({ error: "游客模式不允许发表评论批注" });
    }

    try {
      const cleanMediaId = String(mediaId).replace('server_', '').replace('local_', '');
      const [messages]: any = await db.query("SELECT group_id FROM group_messages WHERE id = ?", [cleanMediaId]);
      if (messages[0] && messages[0].group_id) {
        const groupId = messages[0].group_id;
        // Check if user is member
        const [members]: any = await db.query(
          "SELECT id FROM group_chat_members WHERE group_id = ? AND user_id = ?",
          [groupId, req.user.id]
        );
        // Also check if user is the group leader
        const [chats]: any = await db.query(
          "SELECT leader_id FROM group_chats WHERE id = ?",
          [groupId]
        );
        const isLeader = chats[0] && String(chats[0].leader_id) === String(req.user.id);
        if (!members[0] && !isLeader) {
          return res.status(403).json({ error: "您尚未加入本协作小组，无法进行评论批注" });
        }
      }

      const drawingsJson = JSON.stringify(drawings || []);
      const commentId = id || `comment_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const commentTimestamp = timestamp || Date.now();

      await db.query(
        "INSERT INTO media_comments (id, media_id, username, content, timestamp, timecode, drawings) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [commentId, mediaId, username || '匿名', content || '', commentTimestamp, timecode || null, drawingsJson]
      );

      res.json({ success: true, comment: { id: commentId, username, content, timestamp: commentTimestamp, timecode, drawings } });
    } catch (e: any) {
      res.status(500).json({ error: "添加批注失败", details: e.message });
    }
  });

  app.get("/api/group-messages/:groupId", authenticateToken, async (req: any, res) => {
    const { groupId } = req.params;
    const { since } = req.query;

    try {
      // Server-side cleanup: Delete messages older than 10 days to keep the database clean
      const tenDaysAgoMs = Date.now() - (10 * 24 * 60 * 60 * 1000);
      await db.query("DELETE FROM group_messages WHERE timestamp < ?", [tenDaysAgoMs]);

      // Check if member
      if (req.user.id !== 999999) {
        const [members]: any = await db.query(
          "SELECT id FROM group_chat_members WHERE group_id = ? AND user_id = ?",
          [groupId, req.user.id]
        );
        if (!members[0]) return res.status(403).json({ error: "您不是该群聊的成员" });
      }

      let query = `
        SELECT m.*, u.username as senderName,
               qm.content as quotedContent, qm.sender_id as quotedSenderId, qm.agent_name as quotedAgentName,
               qu.username as quotedSenderName, qm.type as quotedType, qm.url as quotedUrl
        FROM group_messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN group_messages qm ON m.quoted_message_id = qm.id
        LEFT JOIN users qu ON qm.sender_id = qu.id
        WHERE m.group_id = ?
      `;
      const params: any[] = [groupId];

      if (since) {
        query += " AND m.timestamp > ?";
        params.push(Number(since));
      }

      query += " ORDER BY m.timestamp ASC";

      const [messages]: any = await db.query(query, params);
      
      const parsedResults = messages.map((m: any) => {
        const msg: any = {
          id: m.id,
          role: m.sender_id === req.user.id ? 'user' : 'assistant',
          content: m.content,
          type: m.type,
          url: m.url,
          timestamp: Number(m.timestamp),
          agentName: m.agent_name || m.senderName || (m.sender_id === 0 ? 'AI专家' : '小逻'),
          sender_id: m.sender_id
        };

        if (m.quoted_message_id) {
          msg.quotedMessage = {
            id: m.quoted_message_id,
            content: m.quotedContent,
            sender_id: m.quotedSenderId,
            agentName: m.quotedAgentName || m.quotedSenderName || (m.quotedSenderId === 0 ? 'AI专家' : '小逻'),
            type: m.quotedType,
            url: m.quotedUrl,
            role: m.quotedSenderId === req.user.id ? 'user' : 'assistant'
          };
        }
        return msg;
      });

      res.json(parsedResults);
    } catch (e: any) {
      res.status(500).json({ error: "获取消息失败", details: e.message });
    }
  });

  app.get("/api/share-media-detail/:mediaId", authenticateToken, async (req: any, res) => {
    const { mediaId } = req.params;
    try {
      const cleanMediaId = String(mediaId).replace('server_', '').replace('local_', '');
      let [messages]: any = await db.query(`
        SELECT m.*, u.username as senderName,
               qm.content as quotedContent, qm.sender_id as quotedSenderId, qm.agent_name as quotedAgentName,
               qu.username as quotedSenderName, qm.type as quotedType, qm.url as quotedUrl
        FROM group_messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN group_messages qm ON m.quoted_message_id = qm.id
        LEFT JOIN users qu ON qm.sender_id = qu.id
        WHERE m.id = ?
      `, [cleanMediaId]);

      let isFromHistory = false;
      let historyItem: any = null;

      if (messages.length === 0) {
        const [historyRows]: any = await db.query(`
          SELECT h.*, u.username as senderName 
          FROM history h
          LEFT JOIN users u ON h.user_id = u.id
          WHERE h.id = ? OR h.id = ? OR REPLACE(h.id, 'server_', '') = ?
        `, [mediaId, cleanMediaId, cleanMediaId]);

        if (historyRows.length > 0) {
          isFromHistory = true;
          historyItem = historyRows[0];
        } else {
          return res.status(404).json({ error: "未找到对应的媒体文件" });
        }
      }

      if (isFromHistory && historyItem) {
        const msg: any = {
          id: historyItem.id.startsWith('server_') ? historyItem.id : `server_${historyItem.id}`,
          role: historyItem.user_id === req.user.id ? 'user' : 'assistant',
          content: historyItem.revised_prompt || '',
          type: historyItem.type === 'image' ? 'image' : (historyItem.type === 'video' ? 'video' : 'file'),
          url: historyItem.video_url || historyItem.image_url,
          timestamp: historyItem.timestamp,
          agentName: historyItem.senderName || 'AI专家',
          senderId: historyItem.user_id
        };
        return res.json(msg);
      }

      const m = messages[0];
      const msg: any = {
        id: `server_${m.id}`,
        role: m.sender_id === req.user.id ? 'user' : 'assistant',
        content: m.content,
        type: m.type,
        url: m.url,
        timestamp: m.timestamp,
        agentName: m.agent_name || m.senderName || (m.sender_id === 0 ? 'AI专家' : '小逻'),
        senderId: m.sender_id
      };

      // Automatically join logged-in user (excluding dynamically resolved guests) to the group members
      if (req.user.id !== 999999 && m.group_id) {
        try {
          await db.query(
            "INSERT IGNORE INTO group_chat_members (group_id, user_id) VALUES (?, ?)",
            [m.group_id, req.user.id]
          );
          console.log(`[ShareMedia] Auto-joined logged-in user ${req.user.id} to group ${m.group_id} for viewing shared media ${cleanMediaId}`);
        } catch (joinErr: any) {
          console.error(`[ShareMedia] Failed to auto-join user ${req.user.id} to group ${m.group_id}:`, joinErr);
        }
      }

      if (m.quoted_message_id) {
        msg.quotedMessage = {
          id: `server_${m.quoted_message_id}`,
          content: m.quotedContent,
          sender_id: m.quotedSenderId,
          agentName: m.quotedAgentName || m.quotedSenderName || (m.quotedSenderId === 0 ? 'AI专家' : '小逻'),
          type: m.quotedType,
          url: m.quotedUrl,
          role: m.quotedSenderId === req.user.id ? 'user' : 'assistant'
        };
      }

      res.json(msg);
    } catch (e: any) {
      res.status(500).json({ error: "获取分享媒体详情失败", details: e.message });
    }
  });

  app.get("/api/admin/metrics", authenticateToken, isAdmin, async (req, res) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

      // Fetch all usage logs in the last 30 days
      const [logs]: any = await db.query(
        "SELECT id, user_id, type, amount, details, created_at FROM usage_logs WHERE created_at >= ?",
        [dateStr]
      );

      // Fetch active users list
      const [users]: any = await db.query("SELECT id, username FROM users");

      // Fetch history items to correlate task type
      const thirtyDaysAgoMs = Date.now() - 31 * 24 * 3600 * 1000;
      const [historyRows]: any = await db.query(
        "SELECT id, type, status, timestamp, config FROM history WHERE timestamp >= ?",
        [String(thirtyDaysAgoMs)]
      );

      // Helper to categorize log based on points-history logic
      const categorizeLog = (log: any, hRows: any[]) => {
        const details = safeParseJson(log.details, {});
        const reason = (details.reason || '').toLowerCase();
        const loggedTaskId = details.taskId;
        
        let matchedHistory: any = null;
        if (loggedTaskId) {
          matchedHistory = hRows.find((h: any) => String(h.id) === String(loggedTaskId));
        }
        
        if (!matchedHistory) {
          let spentTime = 0;
          if (log.created_at) {
            if (log.created_at instanceof Date) {
              spentTime = log.created_at.getTime();
            } else {
              spentTime = new Date(log.created_at).getTime();
            }
          }
          matchedHistory = hRows.find((h: any) => {
            const hTime = Number(h.timestamp);
            const timeDiff = Math.abs(hTime - spentTime);
            if (timeDiff > 90000) return false;
            
            const isVideoSpent = reason.includes('video') || reason.includes('视频') || reason.includes('seedance');
            const isVideoHistory = h.type === 'video';
            if (isVideoSpent !== isVideoHistory) return false;

            const isImageSpent = reason.includes('image') || reason.includes('图片') || reason.includes('图') || reason.includes('banana');
            const isImageHistory = h.type === 'image';
            if (isImageSpent !== isImageHistory) return false;

            return true;
          });
        }

        const hType = matchedHistory?.type;
        
        if (
          reason.includes('image') || 
          reason.includes('图片') || 
          reason.includes('图') || 
          reason.includes('banana') || 
          hType === 'image'
        ) {
          return 'image';
        }
        
        if (
          reason.includes('video') || 
          reason.includes('视频') || 
          reason.includes('seedance') || 
          reason.includes('omni') || 
          hType === 'video'
        ) {
          return 'video';
        }
        
        if (
          reason.includes('分镜生成') || 
          reason.includes('分镜') ||
          reason.includes('重新生成分段') || 
          reason.includes('剧本资产扫描') || 
          reason.includes('资产扫描') || 
          reason.includes('场景布局') || 
          reason.includes('场景方案') || 
          reason.includes('资产检测') || 
          reason.includes('制剧')
        ) {
          return 'script_gen';
        }
        
        return 'text_ai';
      };

      let totalPoints = 0;
      let totalTextAI = 0;
      let totalScriptGen = 0;
      let totalImages = 0;
      let totalVideos = 0;

      // Initialize structures for tracking user-specific statistics
      const userMap = new Map<number, {
        id: number;
        username: string;
        points_spent: number;
        text_ai_count: number;
        script_gen_count: number;
        images_count: number;
        gpt_images_count: number;
        videos_count: number;
      }>();

      for (const u of users) {
        userMap.set(u.id, {
          id: u.id,
          username: u.username,
          points_spent: 0,
          text_ai_count: 0,
          script_gen_count: 0,
          images_count: 0,
          gpt_images_count: 0,
          videos_count: 0
        });
      }

      const getUserStat = (userId: number) => {
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            id: userId,
            username: `用户_${userId}`,
            points_spent: 0,
            text_ai_count: 0,
            script_gen_count: 0,
            images_count: 0,
            gpt_images_count: 0,
            videos_count: 0
          });
        }
        return userMap.get(userId)!;
      };

      const dailyTrendMap = new Map<string, {
        date: string;
        points: number;
        images: number;
        videos: number;
        text_ai: number;
        script_gen: number;
      }>();

      // Loop logs to aggregate
      for (const log of logs) {
        const userId = log.user_id;
        const type = log.type;
        const amount = Number(log.amount) || 0;
        
        let dateKey = '';
        if (log.created_at) {
          if (log.created_at instanceof Date) {
            const year = log.created_at.getFullYear();
            const month = String(log.created_at.getMonth() + 1).padStart(2, '0');
            const day = String(log.created_at.getDate()).padStart(2, '0');
            dateKey = `${year}-${month}-${day}`;
          } else {
            dateKey = String(log.created_at).slice(0, 10);
          }
        }
        if (!dateKey || dateKey.length < 10) continue;

        if (!dailyTrendMap.has(dateKey)) {
          dailyTrendMap.set(dateKey, {
            date: dateKey,
            points: 0,
            images: 0,
            videos: 0,
            text_ai: 0,
            script_gen: 0
          });
        }
        const daily = dailyTrendMap.get(dateKey)!;
        const uStat = getUserStat(userId);

        if (type === 'points_spent') {
          totalPoints += amount;
          uStat.points_spent += amount;
          daily.points += amount;

          const category = categorizeLog(log, historyRows);
          if (category === 'image') {
            totalImages += 1;
            uStat.images_count += 1;
            daily.images += 1;
          } else if (category === 'video') {
            totalVideos += 1;
            uStat.videos_count += 1;
            daily.videos += 1;
          } else if (category === 'script_gen') {
            totalScriptGen += 1;
            uStat.script_gen_count += 1;
            daily.script_gen += 1;
          } else {
            totalTextAI += 1;
            uStat.text_ai_count += 1;
            daily.text_ai += 1;
          }
        } else if (type === 'points_refund') {
          totalPoints = Math.max(0, totalPoints - amount);
          uStat.points_spent = Math.max(0, uStat.points_spent - amount);
          daily.points = Math.max(0, daily.points - amount);
        }
      }

      // Ensure continuous 30-day index keys internally
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const k = `${year}-${month}-${day}`;
        if (!dailyTrendMap.has(k)) {
          dailyTrendMap.set(k, {
            date: k,
            points: 0,
            images: 0,
            videos: 0,
            text_ai: 0,
            script_gen: 0
          });
        }
      }

      const dailyTrend = Array.from(dailyTrendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      const userStats = Array.from(userMap.values())
        .filter(u => u.points_spent > 0 || u.text_ai_count > 0 || u.script_gen_count > 0 || u.images_count > 0 || u.videos_count > 0)
        .sort((a, b) => b.points_spent - a.points_spent);

      res.json({
        summary: {
          totalPoints: totalPoints,
          totalImages: totalImages,
          totalVideos: totalVideos,
          totalTextAI: totalTextAI,
          totalScriptGen: totalScriptGen
        },
        dailyTrend,
        userStats
      });
    } catch (e: any) {
      res.status(500).json({ error: "获取统计数据失败", details: e.message });
    }
  });

  app.get("/api/user/stats", authenticateToken, async (req: any, res) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ');

      // User-specific summary (last 30 days)
      const [summaryRows]: any = await db.query(`
        SELECT 
          SUM(CASE WHEN type = 'points_spent' THEN amount ELSE 0 END) as points_spent,
          SUM(CASE WHEN type = 'image_gen' THEN 1 ELSE 0 END) as images_count,
          SUM(CASE WHEN type = 'gpt_image_gen' THEN 1 ELSE 0 END) as gpt_images_count,
          SUM(CASE WHEN type = 'video_gen' THEN 1 ELSE 0 END) as videos_count,
          SUM(CASE WHEN type = 'text_ai' THEN 1 ELSE 0 END) as text_ai_count,
          SUM(CASE WHEN type = 'script_gen' THEN 1 ELSE 0 END) as script_gen_count
        FROM usage_logs
        WHERE user_id = ? AND created_at >= ?
      `, [req.user.id, dateStr]);

      // User-specific daily trend (last 30 days)
      const [dailyTrend]: any = await db.query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m-%d') as date,
          SUM(CASE WHEN type = 'points_spent' THEN amount ELSE 0 END) as points,
          SUM(CASE WHEN type = 'image_gen' THEN 1 ELSE 0 END) as images,
          SUM(CASE WHEN type = 'gpt_image_gen' THEN 1 ELSE 0 END) as gpt_images,
          SUM(CASE WHEN type = 'video_gen' THEN 1 ELSE 0 END) as videos,
          SUM(CASE WHEN type = 'text_ai' THEN 1 ELSE 0 END) as text_ai,
          SUM(CASE WHEN type = 'script_gen' THEN 1 ELSE 0 END) as script_gen
        FROM usage_logs
        WHERE user_id = ? AND created_at >= ?
        GROUP BY date
        ORDER BY date ASC
      `, [req.user.id, dateStr]);

      res.json({
        summary: summaryRows[0] || {},
        dailyTrend
      });
    } catch (e: any) {
      res.status(500).json({ error: "获取用户统计数据失败", details: e.message });
    }
  });

  // --- Admin Settings Routes ---

  app.get("/api/admin/storage-config", authenticateToken, isAdmin, async (req, res) => {
    res.json({
      host: (process.env.DB_HOST || '').replace(/^mysql:\/\//, '').split(':')[0],
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || '',
      password: '********', // Mask password
      database: process.env.DB_NAME || 'luosheji',
    });
  });

  app.post("/api/admin/storage-test", authenticateToken, isAdmin, async (req, res) => {
    const config = req.body;
    // If password is masked, use the one from environment
    if (config.password === '********') {
      config.password = process.env.DB_PASSWORD;
    }
    const result = await testDatabaseConnection(config);
    res.json(result);
  });

  app.post("/api/admin/storage-repair", authenticateToken, isAdmin, async (req, res) => {
    const result = await repairDatabaseSchema();
    res.json(result);
  });

  app.post("/api/admin/storage-config", authenticateToken, isAdmin, async (req, res) => {
    const { host, port, user, password, database } = req.body;
    
    console.log('>>> [SERVER] Updating database configuration for current session...');
    
    // Update process.env for the current session
    if (host) process.env.DB_HOST = host;
    if (port) process.env.DB_PORT = String(port);
    if (user) process.env.DB_USER = user;
    if (password && password !== '********') process.env.DB_PASSWORD = password;
    if (database) process.env.DB_NAME = database;

    // Trigger re-initialization
    try {
      dbInitialized = false; // Reset to false while re-initializing
      await initDb();
      dbInitialized = true;
      res.json({ 
        success: true, 
        message: "数据库配置已在当前会话中更新并应用。请注意，永久更改仍需在 AI Studio Secrets 中更新环境变量。" 
      });
    } catch (error: any) {
      console.error('Failed to apply new database configuration:', error);
      res.status(500).json({ 
        error: "应用新配置失败", 
        details: error.message 
      });
    }
  });

  app.get("/api/admin/settings/cloud-storage", authenticateToken, isAdmin, async (req, res) => {
    try {
      const [rows]: any = await db.query('SELECT value FROM settings WHERE `key` = ?', ['oss_config']);
      if (rows.length > 0) {
        const val = rows[0].value;
        res.json(typeof val === 'string' ? JSON.parse(val) : val);
      } else {
        res.json({
          region: process.env.OSS_REGION || '',
          accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
          accessKeySecret: '',
          bucket: process.env.OSS_BUCKET || '',
        });
      }
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch OSS settings", details: e.message });
    }
  });

  app.post("/api/admin/settings/cloud-storage", authenticateToken, isAdmin, async (req, res) => {
    const { region, accessKeyId, accessKeySecret, bucket } = req.body;
    const config = { region, accessKeyId, accessKeySecret, bucket };
    
    try {
      await db.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', 
        ['oss_config', JSON.stringify(config), JSON.stringify(config)]);
      
      updateOSSConfig(config);
      res.json({ success: true, message: "OSS settings updated" });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to update OSS settings", details: e.message });
    }
  });

  app.post("/api/admin/settings/cloud-storage-test", authenticateToken, isAdmin, async (req, res) => {
    const { region, accessKeyId, accessKeySecret, bucket } = req.body;
    // Temporarily update config to test
    const oldConfig = {
      region: process.env.OSS_REGION || '',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
      bucket: process.env.OSS_BUCKET || '',
    };
    
    try {
      updateOSSConfig({ region, accessKeyId, accessKeySecret, bucket });
      const result = await testOSSConnection();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: "Test failed", details: e.message });
    }
  });

  app.get("/api/admin/settings/api-config", authenticateToken, isAdmin, async (req, res) => {
    try {
      const [rows]: any = await db.query('SELECT value FROM settings WHERE `key` = ?', ['global_api_config']);
      if (rows.length > 0) {
        const val = rows[0].value;
        res.json(typeof val === 'string' ? JSON.parse(val) : val);
      } else {
        res.json({});
      }
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch global API settings", details: e.message });
    }
  });

  app.post("/api/admin/test-api-config", authenticateToken, isAdmin, async (req, res) => {
    const { type, config } = req.body;
    const { provider, endpoint, path, apiKey, model, protocolType } = config;

    if (!apiKey) {
      return res.status(400).json({ error: "API Key is required for testing" });
    }

    try {
      let testUrl = '';
      let headers: any = { 'Content-Type': 'application/json' };
      const effectiveProtocol = protocolType || (provider === 'Google gemini' ? 'google' : 'openai');

      if (effectiveProtocol === 'google') {
        // Test by listing models
        let cleanBase = endpoint.replace(/\/$/, '');
        
        // If it's a full URL, we extract the base origin + version
        if (cleanBase.includes(':generateContent') || cleanBase.includes(':predict') || cleanBase.includes(':generateImages')) {
          try {
            const urlObj = new URL(cleanBase);
            const pathParts = urlObj.pathname.split('/');
            const versionIndex = pathParts.findIndex(p => p === 'v1' || p === 'v1beta');
            if (versionIndex !== -1) {
              cleanBase = `${urlObj.origin}/${pathParts[versionIndex]}`;
            } else {
              cleanBase = urlObj.origin;
            }
          } catch(e) {}
        }

        if (cleanBase.includes('/v1') || cleanBase.includes('/v1beta')) {
          testUrl = `${cleanBase}/models?key=${apiKey}`;
        } else {
          testUrl = `${cleanBase}/v1beta/models?key=${apiKey}`;
        }
      } else if (provider === 'Seedance') {
        // Test by GET request to tasks endpoint
        testUrl = endpoint.replace(/\/$/, '');
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else {
        // Third Party / OpenAI Protocol - Test by listing models
        let cleanBase = endpoint.replace(/\/$/, '');
        
        if (cleanBase.includes(':') || cleanBase.includes('/v1beta/') || cleanBase.includes('/v1/') || cleanBase.includes('/chat/completions') || cleanBase.includes('/images/generations')) {
          try {
            const urlObj = new URL(cleanBase);
            cleanBase = urlObj.origin;
          } catch (e) {}
        }
        
        // Remove trailing versions to avoid double versing
        cleanBase = cleanBase.replace(/\/v1$/, '').replace(/\/v1beta$/, '');
        testUrl = `${cleanBase}/v1/models`;
        
        // Final sanity check for double version
        testUrl = testUrl.replace(/\/v1\/v1\//g, '/v1/').replace(/\/v1beta\/v1\//g, '/v1beta/');
        
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      console.log(`[Test API] Testing ${type} with protocol ${effectiveProtocol} (Provider: ${provider}) at ${testUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(testUrl, { 
        method: 'GET', 
        headers,
        signal: controller.signal 
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return res.json({ success: true, message: "Connection successful" });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[Test API] Failed: ${response.status}`, errorData);
        return res.status(response.status).json({ 
          error: `Connection failed (Status ${response.status})`, 
          details: errorData.error?.message || errorData.message || "Unknown error" 
        });
      }
    } catch (e: any) {
      console.error('[Test API] Exception:', e);
      return res.status(500).json({ error: "Connection test failed", details: e.message });
    }
  });

  app.post("/api/admin/settings/api-config", authenticateToken, isAdmin, async (req, res) => {
    const config = req.body;
    console.log('Saving global API config:', JSON.stringify(config));
    try {
      await db.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', 
        ['global_api_config', JSON.stringify(config), JSON.stringify(config)]);
      res.json({ success: true, message: "Global API settings updated" });
    } catch (e: any) {
      console.error('Failed to update global API settings:', e);
      res.status(500).json({ error: "Failed to update global API settings", details: e.message });
    }
  });

  app.get("/api/user/global-api-config", authenticateToken, async (req, res) => {
    console.log(`[API] Received request for global-api-config from user: ${(req as any).user?.id}`);
    try {
      const [rows]: any = await db.query('SELECT `value` FROM settings WHERE `key` = ?', ['global_api_config']);
      const baseConfig = JSON.parse(JSON.stringify(DEFAULT_API_CONFIG));
      if (rows.length > 0) {
        const val = rows[0].value;
        const dbConfig = typeof val === 'string' ? JSON.parse(val) : val;
        // Merge DB config into base config
        const merged = { ...baseConfig };
        Object.keys(dbConfig).forEach(key => {
          if (dbConfig[key]) merged[key] = { ...merged[key], ...dbConfig[key] };
        });
        console.log('[API] Fetched merged global API config from DB');
        return res.json(merged);
      } else {
        console.log('[API] No global API config found in DB, returning DEFAULT_API_CONFIG');
        return res.json(baseConfig);
      }
    } catch (e: any) {
      console.error('[API] Failed to fetch global API settings:', e);
      return res.status(500).json({ error: "Failed to fetch global API settings", details: e.message });
    }
  });

  // --- Custom API Models Management (OpenAI compatible) ---
  app.get("/api/admin/custom-models", authenticateToken, async (req, res) => {
    try {
      const [rows]: any = await db.query('SELECT value FROM settings WHERE `key` = ?', ['custom_openai_models']);
      let models = [];
      if (rows.length > 0) {
        const val = rows[0].value;
        models = typeof val === 'string' ? JSON.parse(val) : val;
      }
      
      // Mask API key for non-admins
      const userRole = (req as any).user?.role;
      if (userRole !== 'admin') {
        models = models.map((m: any) => ({
          ...m,
          apiKey: m.apiKey ? `${m.apiKey.substring(0, 6)}...${m.apiKey.substring(m.apiKey.length - 4)}` : ''
        }));
      }
      
      res.json(models);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch custom models", details: e.message });
    }
  });

  app.post("/api/admin/custom-models", authenticateToken, isAdmin, async (req, res) => {
    const models = req.body;
    if (!Array.isArray(models)) {
      return res.status(400).json({ error: "Invalid data format. Expected an array of models." });
    }
    try {
      await db.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', 
        ['custom_openai_models', JSON.stringify(models), JSON.stringify(models)]);
      res.json({ success: true, message: "Custom API models updated successfully" });
    } catch (e: any) {
      console.error('Failed to update custom API models:', e);
      res.status(500).json({ error: "Failed to update custom API models", details: e.message });
    }
  });

  app.post("/api/admin/test-custom-model", authenticateToken, isAdmin, async (req, res) => {
    const { endpoint, apiKey, model } = req.body;
    if (!endpoint || !apiKey || !model) {
      return res.status(400).json({ error: "Endpoint, API Key, and Model ID are all required." });
    }
    
    try {
      let cleanBase = endpoint.replace(/\/$/, '');
      const testUrl = `${cleanBase}/chat/completions`;
      const payload = {
        model: model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5
      };
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return res.json({ success: true, message: "Connection successful" });
      } else {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          error: `Connection failed (Status ${response.status})`,
          details: errorData.error?.message || errorData.message || "Unknown error"
        });
      }
    } catch (e: any) {
      return res.status(500).json({ error: "Connection test failed", details: e.message });
    }
  });

  // --- Global API Bridge ---
  // Used by BaseAgent and VideoAgent to bypass CORS/WAF for third-party APIs
  app.all("/api/v1/bridge", async (req, res) => {
    try {
      let targetUrl = '';
      let method = 'POST';
      let body: any = null;
      let apiKey = '';

      if (req.method === 'GET') {
        const { u, m, k } = req.query;
        if (!u) return res.status(400).json({ error: "Missing target URL (u)" });
        targetUrl = Buffer.from(u as string, 'base64').toString('utf-8');
        method = (m as string) || 'GET';
        apiKey = (k as string) || '';
      } else {
        const { u, m, b, k } = req.body;
        if (!u) return res.status(400).json({ error: "Missing target URL (u)" });
        targetUrl = Buffer.from(u as string, 'base64').toString('utf-8');
        method = m || 'POST';
        apiKey = k || '';
        if (b) {
          const decodedBody = Buffer.from(b, 'base64').toString('utf-8');
          try {
            body = JSON.parse(decodedBody);
          } catch (e) {
            body = decodedBody;
          }
        }
      }

      // --- Custom Models secure key resolution ---
      let usedFallback = false;
      try {
        const [rows]: any = await db.query('SELECT value FROM settings WHERE `key` = ?', ['custom_openai_models']);
        if (rows.length > 0) {
          const val = rows[0].value;
          const customModels = typeof val === 'string' ? JSON.parse(val) : val;
          if (Array.isArray(customModels)) {
            const targetModel = body?.model || '';
            const matchedModel = customModels.find((m: any) => 
              (m.model && targetModel && m.model === targetModel) ||
              (m.endpoint && targetUrl.includes(m.endpoint.replace(/^https?:\/\//, '')))
            );
            if (matchedModel && matchedModel.apiKey) {
              apiKey = matchedModel.apiKey;
              usedFallback = true;
              console.log(`[Bridge] Securely resolved unmasked apiKey for custom model: ${matchedModel.model || matchedModel.name}`);
            }
          }
        }
      } catch (err) {
        console.error('[Bridge] Failed to resolve custom models secure key:', err);
      }

      // --- Key Fallback Logic ---
      if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
        if (targetUrl.includes('googleapis.com')) {
          apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
          usedFallback = !!apiKey;
        } else if (targetUrl.includes('openai.com') || targetUrl.includes('vectorengine.ai')) {
          apiKey = process.env.OPENAI_API_KEY || '';
          usedFallback = !!apiKey;
          if (!apiKey && targetUrl.includes('vectorengine.ai')) {
            apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
            usedFallback = !!apiKey;
          }
        } else if (targetUrl.includes('volces.com') || targetUrl.includes('volcengine.com') || targetUrl.includes('ark.cn')) {
          apiKey = process.env.ARK_API_KEY || process.env.VOLC_API_KEY || '';
          usedFallback = !!apiKey;
        }
      }

      console.log(`>>> [Bridge] ${method} ${targetUrl} (Key: ${apiKey ? (usedFallback ? 'Server-Fallback' : 'Client-Provided') : 'Missing'}) - Payload Size: ${body ? (typeof body === 'string' ? body.length : JSON.stringify(body).length) : 0} bytes`);

      const headers: any = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };

      if (apiKey) {
        const isGoogleDomain = targetUrl.includes('googleapis.com');
        if (isGoogleDomain) {
          headers['x-goog-api-key'] = apiKey;
        } else {
          // Standard Bearer token for OpenAI, Vectorengine, Volcengine, etc.
          headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800000); // 30 mins for long video tasks

      const fetchOptions: any = {
        method,
        headers,
        signal: controller.signal
      };

      if (method !== 'GET' && method !== 'HEAD' && body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      let response: Response;
      let attempts = 0;
      const maxUpstreamRetries = 2;

      while (attempts <= maxUpstreamRetries) {
        try {
          response = await fetch(targetUrl, fetchOptions);
          
          const contentType = response.headers.get('content-type') || '';
          const status = response.status;

          // If we got a 200/OK but it's HTML when we expect JSON
          if (status === 200 && contentType.includes('text/html') && attempts < maxUpstreamRetries) {
            console.log(`[Bridge] Received HTML instead of JSON for ${targetUrl}, retrying...`);
            attempts++;
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          // Check if we should retry on Rate Limit (429) or Server Error (5xx)
          if ((status === 429 || status >= 500) && attempts < maxUpstreamRetries) {
            // Check for "invalid token" in body to avoid useless retries on 429/500
            const responseClone = response.clone();
            const responseText = await responseClone.text();
            const lowerText = responseText.toLowerCase();
            const isInvalidTokenError = lowerText.includes('invalid token') || 
                                        lowerText.includes('invalid tokens') ||
                                        lowerText.includes('api_key_invalid') || 
                                        lowerText.includes('invalid api key') ||
                                        lowerText.includes('invalid_api_key') ||
                                        lowerText.includes('unauthorized');
            
            if (!isInvalidTokenError) {
              console.log(`[Bridge] Upstream returned ${status} for ${targetUrl}, retrying in 3s... (Attempt ${attempts + 1}/${maxUpstreamRetries + 1})`);
              attempts++;
              await new Promise(r => setTimeout(r, 3000 * Math.pow(2, attempts - 1))); 
              continue;
            } else {
              console.warn(`[Bridge] Upstream returned ${status} with Invalid Token message, skipping retries.`);
              break; // Stop retrying on token errors even if 429/500
            }
          }

          break;
        } catch (err: any) {
          if (attempts >= maxUpstreamRetries) throw err;
          console.log(`[Bridge] Fetch failed for ${targetUrl}: ${err.message}, retrying...`);
          attempts++;
          await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempts - 1)));
        }
      }

      clearTimeout(timeoutId);
      
      const resContentType = response!.headers.get('content-type');
      const responseData = await response!.text();

      if (!response!.ok) {
        console.error(`>>> [Bridge] Upstream Error (${response!.status}):`, responseData.substring(0, 500));
      }

      res.status(response!.status);
      if (resContentType) res.setHeader('Content-Type', resContentType);
      
      try {
        // Try to parse as JSON to return a clean object
        if (responseData && responseData.trim()) {
          const json = JSON.parse(responseData);
          res.json(json);
        } else {
          res.send(responseData);
        }
      } catch (e) {
        // Fallback to raw text
        res.send(responseData);
      }
    } catch (error: any) {
      console.error("Bridge Error:", error);
      // Log more details about bridge failure
      fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `[${new Date().toISOString()}] BRIDGE FATAL ERROR: ${error.message}\n`);
      res.status(500).json({ 
        error: "Bridge request failed", 
        details: error.message,
        hint: "This may be due to upstream timeout, invalid body, or server resource limits."
      });
    }
  });

  async function getGlobalApiConfig(): Promise<Config | null> {
    try {
      const [rows]: any = await db.query('SELECT `value` FROM settings WHERE `key` = ?', ['global_api_config']);
      if (rows.length > 0) {
        const val = rows[0].value;
        return typeof val === 'string' ? JSON.parse(val) : val;
      }
    } catch (e) {
      console.error('Failed to fetch global API config:', e);
    }
    return null;
  }

  app.post('/api/video/test-connection', authenticateToken, isAdmin, async (req, res) => {
    try {
      const bodyConfig = req.body.config || {};
      const appConfig = await getVolcCredentials();
      
      const config = {
        ak: bodyConfig.accessKeyId || appConfig.ak,
        sk: bodyConfig.secretKey || appConfig.sk,
        apiKey: bodyConfig.apiKey || appConfig.apiKey,
        project: bodyConfig.project || appConfig.project,
        region: bodyConfig.region || appConfig.region || 'cn-beijing',
        endpoint: bodyConfig.endpoint || appConfig.endpoint
      };

      // 1. Test Ark API Key if provided
      if (config.apiKey) {
        console.log(`[Test] Testing Ark API Key: ${config.apiKey.substring(0, 8)}...`);
        try {
          // For Ark V3, there isn't a simple list models for Bearer, 
          // but we can try to GET the tasks endpoint (which should 405 if key is valid)
          // or just assume if it's there we try to use it.
          // Better yet, we can try to "List Endpoints" but that requires SigV4 usually.
          
          // Let's try a simple probe to the endpoint provided
          const probeUrl = config.endpoint || 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
          const probeRes = await fetch(probeUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${config.apiKey}`
            }
          });
          
          const probeText = await probeRes.text();
          // If 405, it means "Method Not Allowed" but the gateway accepted our Auth!
          // If 401/403, it means Auth failed.
          if (probeRes.status === 405 || probeRes.ok) {
            return res.json({ success: true, message: 'API Key 验证通过' });
          } else {
            console.warn(`[Test] Ark API Key probe returned ${probeRes.status}:`, probeText);
            // If it's a specific Ark error about invalid key, we should report it
            if (probeText.includes('invalid') && (probeText.includes('key') || probeText.includes('token'))) {
              throw new Error(`API Key 无效: ${probeRes.status} ${probeText}`);
            }
          }
        } catch (e: any) {
          console.error('[Test] Ark API Key test failed:', e);
          // If AK/SK is also present, we continue to test that
          if (!config.ak || !config.sk) {
            return res.status(401).json({ error: `API Key 验证失败: ${e.message}` });
          }
        }
      }

      if (!config.ak || !config.sk) {
        throw new Error('缺少 AccessKey 或 SecretKey，且 API Key 验证未通过');
      }
      
      // 2. Test AK/SK Signature
      console.log(`[Test] Testing Volcengine SigV4 with AK: ${config.ak.substring(0, 8)}...`);
      const response = await volcFetch({
        ak: config.ak, 
        sk: config.sk, 
        region: config.region, 
        service: 'ark',
        method: 'POST',
        action: 'ListAssetGroups',
        version: '2024-01-01',
        // Use a clean management host for list assets
        endpoint: 'https://ark.cn-beijing.volces.com',
        body: {
          Filter: { Name: "test_connection_probe" },
          PageNumber: 1,
          PageSize: 1,
          ProjectName: config.project
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        const errMsg = data.error?.message || data.message || 'SigV4 鉴权失败';
        console.error(`[Test] SigV4 failed (${response.status}):`, data);
        throw new Error(`${errMsg} (${response.status})`);
      }
      
      res.json({ success: true, message: 'AK/SK 及项目权限验证通过' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Seedance 2.0 Video Generation ---
  
  // Volcengine Asset Management Helpers
  const getVolcCredentials = async () => {
    const globalConfig = await getGlobalApiConfig();
    const config = globalConfig?.videoSeedance;
    
    return {
      ak: config?.accessKeyId || process.env.VOLC_ACCESS_KEY || '',
      sk: config?.secretKey || process.env.VOLC_SECRET_KEY || '',
      apiKey: config?.apiKey || process.env.ARK_API_KEY || '',
      project: config?.project || process.env.VOLC_PROJECT || 'default',
      endpoint: config?.endpoint || '',
      region: 'cn-beijing'
    };
  };

  app.post('/api/video/asset-group', authenticateToken, async (req, res) => {
    try {
      const { ak, sk, project, region } = await getVolcCredentials();
      const { name, description } = req.body;
      
      const response = await volcFetch({
        ak, sk, region, service: 'ark',
        method: 'POST',
        action: 'CreateAssetGroup',
        version: '2024-01-01',
        body: {
          Name: name || `Group_${Date.now()}`,
          Description: description || 'Generated Asset Group',
          ProjectName: project
        }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to create asset group');
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/video/asset', authenticateToken, async (req, res) => {
    try {
      const { ak, sk, project, region } = await getVolcCredentials();
      const { groupId, url, name } = req.body;
      
      const response = await volcFetch({
        ak, sk, region, service: 'ark',
        method: 'POST',
        action: 'CreateAsset',
        version: '2024-01-01',
        body: {
          GroupId: groupId,
          URL: url,
          AssetType: 'Image',
          Name: name || `Asset_${Date.now()}`,
          ProjectName: project
        }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to create asset');
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/video/asset/:assetId', authenticateToken, async (req, res) => {
    try {
      const { ak, sk, project, region } = await getVolcCredentials();
      const { assetId } = req.params;
      
      const response = await volcFetch({
        ak, sk, region, service: 'ark',
        method: 'POST',
        action: 'GetAsset',
        version: '2024-01-01',
        body: {
          Id: assetId,
          ProjectName: project
        }
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to get asset');
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

async function trimVideo(src: string, startTime: number, duration: number): Promise<string> {
  const tmpDir = path.join(process.cwd(), 'uploads', 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const randomId = crypto.randomBytes(8).toString('hex');
  const tempInPath = path.join(tmpDir, `clip_in_${randomId}.mp4`);
  const tempOutPath = path.join(tmpDir, `clip_out_${randomId}.mp4`);

  try {
    let targetSrc = src;
    if (src.includes('/api/proxy-asset')) {
      try {
        const urlParam = src.split('url=')[1];
        if (urlParam) {
          targetSrc = decodeURIComponent(urlParam.split('&')[0]);
        }
      } catch (e) {}
    }

    // 1. Prepare input file
    if (targetSrc.startsWith('data:')) {
      const parts = targetSrc.split(';base64,');
      if (parts.length < 2) {
        throw new Error('Invalid base64 data format');
      }
      const buffer = Buffer.from(parts[1], 'base64');
      fs.writeFileSync(tempInPath, buffer);
    } else if (targetSrc.startsWith('http://') || targetSrc.startsWith('https://')) {
      // It's a remote URL. Fetch it and write to file
      const response = await fetch(targetSrc);
      if (!response.ok) {
        throw new Error(`Failed to download reference video: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(tempInPath, Buffer.from(arrayBuffer));
    } else if (fs.existsSync(targetSrc)) {
      // It's already a local file path
      fs.copyFileSync(targetSrc, tempInPath);
    } else if (targetSrc.startsWith('/uploads/')) {
      const fullPath = path.join(process.cwd(), targetSrc);
      if (fs.existsSync(fullPath)) {
        fs.copyFileSync(fullPath, tempInPath);
      } else {
        throw new Error(`Video file not found at ${fullPath}`);
      }
    } else {
      // Try resolving as relative to process.cwd() or uploads
      const uploadsPath = path.join(process.cwd(), 'uploads', targetSrc.replace(/^\/+/, ''));
      const relativePath = path.join(process.cwd(), targetSrc.replace(/^\/+/, ''));
      if (fs.existsSync(uploadsPath)) {
        fs.copyFileSync(uploadsPath, tempInPath);
      } else if (fs.existsSync(relativePath)) {
        fs.copyFileSync(relativePath, tempInPath);
      } else {
        throw new Error(`Unrecognized video source: ${targetSrc}`);
      }
    }

    // 2. Run FFmpeg to trim the video
    // Use -preset superfast and re-encode to ensure exact start and duration with high format compatibility (h264/aac)
    let cmd = `ffmpeg -y -ss ${startTime} -i "${tempInPath}" -t ${duration} -c:v libx264 -c:a aac -map 0:v -map 0:a? -preset superfast -movflags +faststart "${tempOutPath}"`;
    console.log(`>>> [FFmpeg] Running command: ${cmd}`);
    try {
      execSync(cmd, { stdio: 'pipe' });
    } catch (err: any) {
      console.warn(`>>> [FFmpeg] First pass failed, retrying with fallback (video only, silent)... Error: ${err?.message || err}`);
      // Fallback: copy video stream, completely ignore/omit audio stream to make it robust against silent/soundless inputs
      cmd = `ffmpeg -y -ss ${startTime} -i "${tempInPath}" -t ${duration} -c:v libx264 -an -preset superfast -movflags +faststart "${tempOutPath}"`;
      console.log(`>>> [FFmpeg] Running fallback command: ${cmd}`);
      execSync(cmd, { stdio: 'pipe' });
    }

    if (!fs.existsSync(tempOutPath)) {
      throw new Error('FFmpeg failed to output trimmed file');
    }

    // 3. Read trimmed file and upload to OSS
    const trimmedBuffer = fs.readFileSync(tempOutPath);
    const base64Data = `data:video/mp4;base64,${trimmedBuffer.toString('base64')}`;
    const filename = `luosheji/clipped/${Date.now()}_${randomId}.mp4`;
    const finalUrl = await persistFromBase64(base64Data, filename);

    console.log(`>>> [FFmpeg] Successfully trimmed video. Original: ${src.substring(0, 50)}... Trimmed OSS URL: ${finalUrl}`);
    return finalUrl;
  } finally {
    // Cleanup files
    try {
      if (fs.existsSync(tempInPath)) fs.unlinkSync(tempInPath);
    } catch (_) {}
    try {
      if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
    } catch (_) {}
  }
}

  app.post('/api/generate', authenticateToken, async (req, res) => {
    const { prompt, ratio, duration, resolution, referenceAssets, videoMode, image, lastFrame, model } = req.body;
    
    // Preprocess reference video assets using FFmpeg if startTime/duration are specified
    if (referenceAssets && referenceAssets.length > 0) {
      for (const asset of referenceAssets) {
        if (asset.type === 'video' && asset.startTime !== undefined && asset.duration !== undefined) {
          try {
            console.log(`>>> [FFmpeg] Pre-processing clip asset: startTime=${asset.startTime}, duration=${asset.duration}`);
            const rawUrl = asset.data || asset.url;
            if (rawUrl) {
              const trimmedUrl = await trimVideo(rawUrl, asset.startTime, asset.duration);
              asset.data = trimmedUrl;
              asset.url = trimmedUrl;
            }
          } catch (clipErr: any) {
            console.error('>>> [FFmpeg] Failed to trim reference video asset:', clipErr);
            // Fallback to original, don't crash the request
          }
        }
      }
    }
    
    const globalConfig = await getGlobalApiConfig();
    const isMini = model === 'seedance-mini';
    const seedanceConfig = isMini ? (globalConfig?.videoSeedanceMini || globalConfig?.videoSeedance) : globalConfig?.videoSeedance;
    const baseUrl = seedanceConfig?.endpoint?.replace(/\/$/, '') || (isMini ? 'https://www.runninghub.cn/openapi/v2/rhart-video/sparkvideo-2.0-mini/multimodal-video' : 'https://www.runninghub.cn/openapi/v2/rhart-video/sparkvideo-2.0/multimodal-video');
    
    let apiKey = seedanceConfig?.apiKey;
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      apiKey = process.env.SEEDANCE_API_KEY || process.env.RUNNINGHUB_API_KEY || '';
    }

    if (!apiKey) {
      return res.status(500).json({ error: isMini ? "未配置 RHSD2.0Mini API KEY" : "未配置 SEEDANCE API KEY" });
    }

    // Helper to format as asset if applicable
    const formatUrl = (u: any) => {
      let urlStr = typeof u === 'string' ? u : (u?.url || u?.uri || '');
      if (!urlStr) return '';
      
      urlStr = urlStr.trim();

      // If it resembles a Volcengine Asset ID, format it correctly
      if (urlStr.startsWith('asset-') && !urlStr.startsWith('asset://')) {
        return `asset://${urlStr}`;
      }

      // 1. Unwrap proxy-asset URLs if present, extracting the direct target URL
      if (urlStr.includes('/api/proxy-asset')) {
        try {
          const match = urlStr.match(/[?&]url=([^&]+)/);
          if (match && match[1]) {
            urlStr = decodeURIComponent(match[1]);
          }
        } catch (e) {
          console.error('>>> [formatUrl] Failed to unwrap proxy-asset URL:', e);
        }
      }

      // 2. Resolve relative URLs starting with / to absolute ones
      if (urlStr.startsWith('/')) {
        const protoHeader = req.headers['x-forwarded-proto'];
        const protocol = (typeof protoHeader === 'string' ? protoHeader.split(',')[0] : null) || req.protocol || 'https';
        const hostHeader = req.headers['x-forwarded-host'];
        const host = (typeof hostHeader === 'string' ? hostHeader.split(',')[0] : null) || req.get('host');
        urlStr = `${protocol}://${host}${urlStr}`;
      }

      // 3. Strip any URL fragment identifier (like #t=0.1) as third-party services fail when downloading URLs with fragments
      if (urlStr.includes('#')) {
        urlStr = urlStr.split('#')[0];
      }

      return urlStr;
    };

    // Helper to ensure any input URL (base64, relative /uploads/, or local-domain absolute URL) is uploaded to Alibaba Cloud OSS
    const ensureUrlOnOSS = async (rawUrl: string, defaultExt: string = 'png'): Promise<string> => {
      if (!rawUrl) return '';
      rawUrl = rawUrl.trim();

      // If it resembles a Volcengine Asset ID, return as is (formatUrl will format it later)
      if (rawUrl.startsWith('asset-') || rawUrl.startsWith('asset://')) {
        return rawUrl;
      }

      // If it's a base64 string, persist it to OSS
      if (rawUrl.startsWith('data:')) {
        let ext = defaultExt;
        const match = rawUrl.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
        if (match && match[1]) {
          ext = match[1].split('/')[1] || defaultExt;
        }
        const filename = `luosheji/references/${(req as any).user.id}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
        try {
          console.log(`>>> [OSS] Pre-uploading base64 reference to OSS: ${filename}`);
          return await persistFromBase64(rawUrl, filename);
        } catch (err: any) {
          console.error('>>> [OSS] Failed to upload base64 to OSS:', err);
          return rawUrl;
        }
      }

      // Check if it's a relative /uploads/ or our own host's /uploads/
      const hostHeader = req.headers['x-forwarded-host'];
      const host = (typeof hostHeader === 'string' ? hostHeader.split(',')[0] : null) || req.get('host');
      let isLocalUpload = false;
      let relativePath = '';

      if (rawUrl.startsWith('/uploads/') || rawUrl.startsWith('uploads/')) {
        isLocalUpload = true;
        relativePath = rawUrl.replace(/^\/?/, '');
      } else if (host && rawUrl.includes(host) && rawUrl.includes('/uploads/')) {
        isLocalUpload = true;
        const match = rawUrl.match(/\/uploads\/[^?#]+/);
        if (match) {
          relativePath = match[0].replace(/^\/?/, '');
        }
      }

      if (isLocalUpload && relativePath) {
        const fullPath = path.join(process.cwd(), relativePath);
        if (fs.existsSync(fullPath)) {
          const client = getOSSClient();
          if (client) {
            try {
              const buffer = fs.readFileSync(fullPath);
              const ext = path.extname(fullPath).substring(1) || defaultExt;
              let mimeType = 'image/png';
              if (ext === 'mp4') mimeType = 'video/mp4';
              else if (ext === 'mp3') mimeType = 'audio/mpeg';

              const filename = `luosheji/uploads/${Date.now()}_${path.basename(fullPath)}`;
              console.log(`>>> [OSS] Pre-uploading local file ${fullPath} to OSS: ${filename}`);
              return await uploadToOSS(buffer, filename, mimeType);
            } catch (err: any) {
              console.error(`>>> [OSS] Failed to upload local file to OSS:`, err);
            }
          } else {
            console.warn(`>>> [OSS] Cannot upload local file to OSS: OSS client not configured.`);
          }
        }
      }

      return rawUrl;
    };

    // RunningHub API Format - Build unique lists of URLs and maintain index mapping
    const imageUrlList: string[] = [];
    const videoUrlList: string[] = [];
    const audioUrlList: string[] = [];
    
    // 1. Process referenceAssets (Tray + Explicit Mentions from frontend)
    // These should come first to maintain @图1, @图2 alignment
    const rawAssets: { url: string; originalType: 'image' | 'video' | 'audio'; asset: any }[] = [];
    if (referenceAssets && referenceAssets.length > 0) {
      for (const asset of referenceAssets) {
        let rawUrl = asset.data || asset.url;
        if (!rawUrl) continue;

        let ext = 'png';
        if (asset.type === 'video') ext = 'mp4';
        else if (asset.type === 'audio') ext = 'mp3';

        rawUrl = await ensureUrlOnOSS(rawUrl, ext);
        asset.data = rawUrl;
        asset.url = rawUrl;

        const u = formatUrl(rawUrl);
        if (!u) continue;
        rawAssets.push({ url: u, originalType: asset.type, asset });
      }
    }

    // 2. Add image (Start Frame) and lastFrame if not already present
    // Add them to the END to not disturb the @图X indices
    let firstFrameIdx = -1;
    let lastFrameIdx = -1;

    if (image) {
      let rawUrl = typeof image === 'string' ? image : (image.data || image.url);
      if (rawUrl) {
        rawUrl = await ensureUrlOnOSS(rawUrl, 'png');
        if (typeof image === 'object') {
          image.data = rawUrl;
          image.url = rawUrl;
        }
      }
      // Since first frame is usually the start frame, we add to imageUrlList
      const u = formatUrl(rawUrl);
      if (u) {
        rawAssets.push({ url: u, originalType: 'image', asset: { type: 'image' } });
      }
    }
    
    if (lastFrame) {
      let rawUrl = typeof lastFrame === 'string' ? lastFrame : (lastFrame.data || lastFrame.url);
      if (rawUrl) {
        rawUrl = await ensureUrlOnOSS(rawUrl, 'png');
        if (typeof lastFrame === 'object') {
          lastFrame.data = rawUrl;
          lastFrame.url = rawUrl;
        }
      }
      const u = formatUrl(rawUrl);
      if (u) {
        rawAssets.push({ url: u, originalType: 'image', asset: { type: 'image' } });
      }
    }

    let finalPrompt = prompt || '';
    if (finalPrompt) {
      // 1. Replace explicit @图N labels with lowercase @image, @video, @audio tags without spaces (supporting optional separators like underscore, space, or hyphen)
      finalPrompt = finalPrompt
        .replace(/@(?:图|Image|image)[\s_-]*(\d+)/gi, '@image$1')
        .replace(/@(?:视频|Video|video)[\s_-]*(\d+)/gi, '@video$1')
        .replace(/@(?:音频|Audio|audio)[\s_-]*(\d+)/gi, '@audio$1');
    }

    // Smart-classify reference assets based on prompt usage or RunningHub limits
    const referencedAudios = new Set(Array.from(finalPrompt.matchAll(/@audio(\d+)/gi)).map(m => parseInt(m[1])));
    const referencedVideos = new Set(Array.from(finalPrompt.matchAll(/@video(\d+)/gi)).map(m => parseInt(m[1])));

    const rawImages = rawAssets.filter(a => a.originalType === 'image');
    const rawVideos = rawAssets.filter(a => a.originalType === 'video');
    const rawAudios = rawAssets.filter(a => a.originalType === 'audio');

    let assignedVideoCount = 0;

    rawVideos.forEach((as, idx) => {
      const seqNum = idx + 1;
      const isUsedAsAudio = referencedAudios.has(seqNum) && !referencedVideos.has(seqNum);
      const isExtraVideo = assignedVideoCount >= 1; // RunningHub standard Seedance 2.0 API supports at most 1 videoUrl

      if (isUsedAsAudio || isExtraVideo) {
        console.log(`>>> [Reclassifying Video as Audio] ${as.url} (reason: isUsedAsAudio=${isUsedAsAudio}, isExtraVideo=${isExtraVideo})`);
        if (!audioUrlList.includes(as.url)) {
          audioUrlList.push(as.url);
        }
        const newAudioIdx = audioUrlList.indexOf(as.url) + 1;
        // Rewrite prompt references if any referred to this as @videoN to keep them aligned
        finalPrompt = finalPrompt.split(`@video${seqNum}`).join(`@audio${newAudioIdx}`);
      } else {
        if (!videoUrlList.includes(as.url)) {
          videoUrlList.push(as.url);
          assignedVideoCount++;
        }
      }
    });

    // Populate actual query lists
    rawImages.forEach(as => {
      if (!imageUrlList.includes(as.url)) imageUrlList.push(as.url);
    });
    rawAudios.forEach(as => {
      if (!audioUrlList.includes(as.url)) audioUrlList.push(as.url);
    });

    // Compute firstFrame and lastFrame indices now that imageUrlList is populated
    if (image) {
      const rawUrl = typeof image === 'string' ? image : (image.data || image.url);
      const u = formatUrl(rawUrl);
      if (u) {
        firstFrameIdx = imageUrlList.indexOf(u) + 1;
      }
    }
    if (lastFrame) {
      const rawUrl = typeof lastFrame === 'string' ? lastFrame : (lastFrame.data || lastFrame.url);
      const u = formatUrl(rawUrl);
      if (u) {
        lastFrameIdx = imageUrlList.indexOf(u) + 1;
      }
    }

    const imageUrls = imageUrlList;
    const videoUrls = videoUrlList;
    const audioUrls = audioUrlList;
    
    if (finalPrompt) {
      // 2. Map history mentions if they were sent as referenceAssets
      // The frontend should have included these in referenceAssets, so they are already in the lists.
      // If the prompt has @历史图ID, we need to map that ID to its index in imageUrlList
      // However, the current regex .replace(/@(?:历史图)\s*(\d+)/, '@Image $1') is risky if $1 is a large ID.
      // Better strategy: the frontend should replace these names with indices before sending OR 
      // the server needs to know which ID maps to which index.
      // For now, let's assume simple labels like @图1 are the main user intent.
      
      // 3. Replace @首帧 / @尾帧 with actual indices in lowercase
      if (firstFrameIdx !== -1) {
        finalPrompt = finalPrompt.replace(/@(?:首帧|FirstFrame|start_frame)/g, `@image${firstFrameIdx}`);
      }
      if (lastFrameIdx !== -1) {
        finalPrompt = finalPrompt.replace(/@(?:尾帧|LastFrame|end_frame)/g, `@image${lastFrameIdx}`);
      }

      // Cleanup multi-spaces
      finalPrompt = finalPrompt.replace(/\s+/g, ' ').trim();
    }

    // Determine if we are using Workflow API or Standard Model API
    const workflowId = seedanceConfig?.model;
    let targetUrl = seedanceConfig?.endpoint || 'https://www.runninghub.cn/openapi/v2/rhart-video/seedance-2.0/multimodal';

    const isTextToVideo = imageUrlList.length === 0 && videoUrlList.length === 0;

    // If calling standard API (not workflow), adjust endpoint model path segment to match the selected frontend model
    if (!(workflowId && /^\d+$/.test(String(workflowId)))) {
      const selectedModel = model || 'seedance2.0';
      let modelSegment = 'sparkvideo-2.0';
      if (selectedModel === 'seedance-mini') {
        modelSegment = 'sparkvideo-2.0-mini';
      } else if (selectedModel === 'seedance2.1') {
        modelSegment = 'sparkvideo-2.1';
      } else if (selectedModel === 'seedance2.5') {
        modelSegment = 'sparkvideo-2.5';
      }

      const methodSegment = isTextToVideo ? 'text-to-video' : 'multimodal-video';

      if (targetUrl.includes('/rhart-video/')) {
        targetUrl = targetUrl.replace(/\/rhart-video\/[^/]+\/[^/?#]+/, `/rhart-video/${modelSegment}/${methodSegment}`);
      } else {
        // Fallback for custom endpoints that might not contain /rhart-video/
        if (isTextToVideo) {
          targetUrl = targetUrl
            .replace('/multimodal-video', '/text-to-video')
            .replace('/multimodal', '/text-to-video');
        } else {
          targetUrl = targetUrl
            .replace('/text-to-video', '/multimodal-video');
        }
      }
    }

    let body: any = {};

    if (workflowId && /^\d+$/.test(String(workflowId))) {
      // It's a RunningHub Workflow ID
      targetUrl = `https://www.runninghub.cn/openapi/v2/run/workflow/${workflowId}`;
      body = {
        addMetadata: true,
        instanceType: "default",
        usePersonalQueue: false,
        nodeInfoList: [] 
      };
      console.log(`>>> [DEBUG] Using RunningHub Workflow API: ${workflowId}`);
    } else {
      // Use Standard Model API
      const hasVideos = videoUrlList.length > 0;
      const slots: string[] = [];

      if (!isTextToVideo) {
        if (hasVideos) {
          slots.push('all');
          imageUrlList.slice(0, 9).forEach((_, i) => slots.push(`image${i + 1}`));
          videoUrlList.slice(0, 3).forEach((_, i) => slots.push(`video${i + 1}`));
        } else {
          // Only map available image slots if no videos are supplied
          imageUrlList.slice(0, 9).forEach((_, i) => slots.push(`image${i + 1}`));
        }
      }

      body = {
        // Normalize prompt labels by forcing lowercase and stripping any leftover spaces
        prompt: finalPrompt.replace(/@(image|video|audio|Image|Video|Audio)\s*(\d+)/gi, (match, type, num) => `@${type.toLowerCase()}${num}`),
        resolution: req.body.resolution || '720p',
        duration: String(duration || '5'),
        generateAudio: true,
        generate_audio: true,
        ratio: ratio || 'adaptive',
        returnLastFrame: req.body.returnLastFrame !== undefined ? req.body.returnLastFrame : true,
        seed: req.body.seed !== undefined ? req.body.seed : -1
      };

      if (!isTextToVideo) {
        body.imageUrls = imageUrlList.slice(0, 9);
        if (hasVideos) {
          body.videoUrls = videoUrlList.slice(0, 3);
        }
        if (slots.length > 0) {
          body.conversionSlots = slots;
        }
      }

      if (req.body.realPersonMode !== undefined) {
        body.realPersonMode = !!req.body.realPersonMode;
      } else {
        body.realPersonMode = true; // Default to true to prevent "Current mode does not support real-person content"
      }

      if (audioUrlList.length > 0) {
        body.audioUrls = audioUrlList.slice(0, 3);
      }
    }

    try {
      console.log(`>>> [DEBUG] RunningHub Request:`, JSON.stringify(body, null, 2));
      const rhResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const text = await rhResponse.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(500).json({ error: "RunningHub 返回了无效的 JSON 响应", details: text });
      }

      if (!rhResponse.ok || (data && data.errorCode && data.errorCode !== '0' && data.errorCode !== '')) {
        let errorMsg = (data && (data.errorMessage || data.message)) || text;
        if ((data && data.errorCode === '1014') || (typeof errorMsg === 'string' && errorMsg.includes('Enterprise-Shared'))) {
          errorMsg = "访问被拒绝：您的 API Key 权限不足。会员级 Key 仅支持调用 AI 应用或工作流接口。请在页面设置中录入工作流 ID (Workflow ID) 或更换企业级-共享 Key。";
        }
        return res.status(rhResponse.status === 200 ? 400 : rhResponse.status).json({ 
          error: errorMsg,
          errorCode: data ? data.errorCode : undefined 
        });
      }

      if (!data || !data.taskId) {
        return res.status(500).json({ error: "RunningHub 响应中缺失 taskId", details: data });
      }

      return res.json({ taskId: data.taskId });
    } catch (RhErr: any) {
      console.error("RunningHub generation error:", RhErr);
      return res.status(500).json({ error: RhErr.message });
    }
  });

  app.get('/api/status/:taskId', authenticateToken, async (req, res) => {
    const { taskId } = req.params;
    
    const globalConfig = await getGlobalApiConfig();
    let seedanceConfig = globalConfig?.videoSeedanceMini;
    if (!seedanceConfig?.apiKey && globalConfig?.videoSeedance?.apiKey) {
      seedanceConfig = globalConfig.videoSeedance;
    } else if (!seedanceConfig) {
      seedanceConfig = globalConfig?.videoSeedance;
    }
    
    let apiKey = seedanceConfig?.apiKey;
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      apiKey = process.env.SEEDANCE_API_KEY || process.env.RUNNINGHUB_API_KEY || '';
    }

    if (!apiKey) {
      return res.status(500).json({ error: "未配置 SEEDANCE API KEY，请在管理后台中设置" });
    }

    try {
      const queryUrl = 'https://www.runninghub.cn/openapi/v2/query';
      const rhResponse = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ taskId })
      });

      const text = await rhResponse.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(500).json({ error: "查询响应格式无效", details: text });
      }

      if (!rhResponse.ok || (data && data.errorCode && data.errorCode !== '0' && data.errorCode !== '')) {
         return res.status(rhResponse.status === 200 ? 500 : rhResponse.status).json({ 
           error: data?.errorMessage || data?.message || "查询任务失败", 
           errorCode: data?.errorCode 
         });
      }

      if (!data) {
        return res.status(500).json({ error: "RunningHub 返回为空" });
      }

      // Normalize RunningHub format
      const normalized = {
        ...data,
        status: data.status === 'SUCCESS' ? 'succeeded' : (data.status === 'FAILED' ? 'failed' : 'running'),
        results: data.results?.map((r: any) => ({
           ...r,
           video_url: r.url 
        }))
      };
      
      if (normalized.status === 'succeeded' && normalized.results?.[0]?.url) {
         (normalized as any).content = [{
            type: 'video_url',
            video_url: { url: normalized.results[0].url }
         }];
      }

      return res.json(normalized);
    } catch (rhErr: any) {
      console.error("RunningHub status error:", rhErr);
      return res.status(500).json({ error: rhErr.message });
    }
  });

  // --- Proxy Download ---
  app.get("/api/proxy-download", async (req, res) => {
    const fileUrl = req.query.url as string;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!fileUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    try {
      const parsedUrl = new URL(fileUrl);
      const allowedDomains = [
        'generativelanguage.googleapis.com', 
        'storage.googleapis.com', 
        'veo.googleapis.com', 
        'googleusercontent.com', 
        'google.com', 
        'googleapis.com',
        'aliyuncs.com',
        'luosheji.cn',
        'volces.com',
        'volcengine.com',
        'runninghub.cn',
        'myqcloud.com',
        'vectorengine.ai',
        'smart-image.ai',
        'openai.com',
        'dallecdn.com',
        'dalleproduce.blob.core.windows.net'
      ];
      if (!allowedDomains.some(domain => parsedUrl.hostname.endsWith(domain))) {
        return res.status(433).json({ error: "Domain not allowed for proxy" });
      }
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const headers: Record<string, string> = {};
      if (fileUrl.includes('googleapis.com')) {
        headers['x-goog-api-key'] = apiKey || '';
      }

      const response = await fetch(fileUrl, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch file: ${response.statusText}` });
      }

      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      if (contentType) res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      
      const requestedFilename = req.query.filename as string || "download";
      // Force direct download behavior instead of browser inline preview
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(requestedFilename)}"; filename*=UTF-8''${encodeURIComponent(requestedFilename)}`);
      
      if (response.body) {
        const reader = response.body.getReader();
        const stream = new ReadableStream({
          async start(controller) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
          },
        });
        
        const nodeStream = (stream as any);
        for await (const chunk of nodeStream) {
          res.write(chunk);
        }
        res.end();
      } else {
        res.status(500).json({ error: "Response body is empty" });
      }
    } catch (error: any) {
      console.error("Proxy download error:", error);
      const isTimeout = error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('ETIMEDOUT');
      res.status(isTimeout ? 504 : 500).json({ 
        error: isTimeout ? "Connection timed out while fetching the file." : error.message,
        code: error.code || (isTimeout ? 'ETIMEDOUT' : 'UNKNOWN')
      });
    }
  });

  // API 404 Handler
  app.all("/api/*all", (req, res) => {
    res.status(404).json({ error: "API Route Not Found" });
  });

  console.log(`>>> [SERVER] Routes and endpoints initialized.`);
  fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `[SERVER] Handlers registered at ${new Date().toISOString()}\n`);

  // Vite 中置件处理
  console.log('>>> [DEBUG] Setting up Vite/Static middleware...');
  if (process.env.NODE_ENV !== "production") {
    console.log('>>> [DEBUG] Starting Vite in development mode...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log('>>> [DEBUG] Vite middleware mounted.');
  } else {
    console.log('>>> [DEBUG] Serving static files in production mode...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 5 requires '*all' or '(.*)' to match everything
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(err.stack);
    res.status(500).json({ error: "内部服务器错误", details: err.message });
  });

  // --- Cleanup Task ---
  const startCleanupTask = () => {
    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    
    const cleanup = async () => {
      if (!dbInitialized) {
        console.warn('[Cleanup] Skipping scheduled cleanup: Database not initialized.');
        return;
      }
      console.log('[Cleanup] Starting scheduled cleanup of old assets...');
      const cutoff = Date.now() - TEN_DAYS_MS;
      
      try {
        const [historyResult]: any = await db.query("DELETE FROM history WHERE timestamp < ?", [cutoff]);
        const [pipelinesResult]: any = await db.query("DELETE FROM pipelines WHERE timestamp < ?", [cutoff]);
        
        console.log(`[Cleanup] Deleted ${historyResult.affectedRows} old history items and ${pipelinesResult.affectedRows} old pipelines.`);
      } catch (error) {
        console.error('[Cleanup] Error during asset cleanup:', error);
      }
    };

    // Run every hour
    setInterval(cleanup, 60 * 60 * 1000);
    // Run once on startup after a short delay
    setTimeout(cleanup, 5000);
  };

  startCleanupTask();
}

process.on('uncaughtException', (err: any) => {
  if (err.code === 'EPIPE') return; // Ignore EPIPE globally
  fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `UNCAUGHT EXCEPTION at ${new Date().toISOString()}: ${err.stack}\n`);
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason: any, promise) => {
  if (reason && reason.code === 'EPIPE') return; // Ignore EPIPE globally
  fs.appendFileSync(path.join(process.cwd(), 'startup_debug.log'), `UNHANDLED REJECTION at ${new Date().toISOString()}: ${reason}\n`);
  console.error('UNHANDLED REJECTION:', reason);
});

// Also handle stdout/stderr EPIPE
process.stdout.on('error', (err: any) => {
  if (err.code === 'EPIPE') return;
});
process.stderr.on('error', (err: any) => {
  if (err.code === 'EPIPE') return;
});

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
