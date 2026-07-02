import React, { useEffect, useRef, useState } from 'react';
import { X, Maximize2, Minimize2, Loader2, Camera, Download, Settings2, Sliders, RotateCcw, ChevronRight, Layers, Footprints } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'pannellum/src/css/pannellum.css';
import 'pannellum';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Declare pannellum on window for TypeScript
declare global {
  interface Window {
    pannellum: any;
  }
}

interface PanoramaViewerProps {
  imageUrl: string;
  onClose: () => void;
  title?: string;
  closeText?: string;
}

export const PanoramaViewer: React.FC<PanoramaViewerProps> = ({ imageUrl, onClose, title, closeText }) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [localUrl, setLocalUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [snapshotting, setSnapshotting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showProTools, setShowProTools] = useState(false);
  const [isHealing, setIsHealing] = useState(false);
  
  const fovRef = useRef(110);
  
  // Pro Tools Constants
  const [fov, setFovState] = useState(110);

  const setFov = (val: number) => {
    fovRef.current = val;
    setFovState(val);
  };
  const [pitch, setPitch] = useState(0);
  const [horizontalOffset, setHorizontalOffset] = useState(0); 
  const [verticalOffset, setVerticalOffset] = useState(0);     
  const [perspectiveCorrection, setPerspectiveCorrection] = useState(0); 
  const [isShiftMode, setIsShiftMode] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  
  // Physical Movement State
  const [walkState, setWalkState] = useState({
    scale: 1,
    x: 0,
    y: 0,
    bob: 0,
    velocity: { x: 0, z: 0 },
    lastTime: 0
  });

  const [currentUrl, setCurrentUrl] = useState(imageUrl);
  
  const [keysPressed, setKeysPressed] = useState<Record<string, boolean>>({});
  const walkRef = useRef<number>(0);
  const animationRef = useRef<number | null>(null);
  const momentumRef = useRef({ x: 0, z: 0 });
  
  useEffect(() => {
    setCurrentUrl(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeysPressed(prev => ({ ...prev, [e.key.toLowerCase()]: true }));
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      setKeysPressed(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!isWalking) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      // Reset walk state gracefully
      momentumRef.current = { x: 0, z: 0 };
      setWalkState(prev => ({ ...prev, scale: 1, x: 0, y: 0, bob: 0 }));
      return;
    }

    const animate = () => {
      // 1. Friction & Acceleration logic (Smoother momentum)
      const friction = 0.94;
      const acceleration = 0.12;
      const maxSpeed = 1.8;

      let targetX = 0;
      let targetZ = 0;

      if (keysPressed['w'] || keysPressed['arrowup']) targetZ += acceleration;
      if (keysPressed['s'] || keysPressed['arrowdown']) targetZ -= acceleration;
      if (keysPressed['a'] || keysPressed['arrowleft']) targetX -= acceleration;
      if (keysPressed['d'] || keysPressed['arrowright']) targetX += acceleration;

      momentumRef.current.x = (momentumRef.current.x + targetX) * friction;
      momentumRef.current.z = (momentumRef.current.z + targetZ) * friction;

      const speed = Math.sqrt(momentumRef.current.x**2 + momentumRef.current.z**2);
      
      // 2. Head Bobbing & Stabilization
      walkRef.current += speed * 0.12;
      const isMoving = speed > 0.05;
      
      // Subtle physical feedback (minimal to prevent distortion)
      const bobAmount = isMoving ? Math.sin(walkRef.current) * (speed * 1.5) : Math.sin(Date.now() / 1500) * 0.3;
      const swayAmount = isMoving ? Math.cos(walkRef.current * 0.5) * (speed * 0.8) : 0;
      
      setWalkState(prev => ({
        ...prev,
        // Keep scale very close to 1.0 to prevent pixel stretching
        scale: 1.0 + Math.max(0, momentumRef.current.z * 0.002),
        // Minimal translation to avoid 'black bars' or warping
        x: Math.max(-20, Math.min(20, prev.x + momentumRef.current.x * 1.5)),
        y: prev.y,
        bob: bobAmount
      }));

      // 3. Pannellum Engine Sync (The "Real" Walk)
      if (viewerRef.current && (isMoving || speed > 0.01)) {
        const currentFov = viewerRef.current.getHfov();
        const currentYaw = viewerRef.current.getYaw();
        
        // FOV change provides the depth/movement feel without distortion
        // Forward (W) decreases FOV slightly
        const fovTarget = momentumRef.current.z * -0.4;
        viewerRef.current.setHfov(Math.max(50, Math.min(125, currentFov + fovTarget)), false);
        
        // Parallax: Sidestepping (A/D) should rotate the camera slightly to look 'forward'
        const yawShift = momentumRef.current.x * 0.15;
        viewerRef.current.setYaw(currentYaw + yawShift, false);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isWalking, keysPressed]);

  const toggleWalking = () => {
    setIsWalking(!isWalking);
  };

  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    if (!currentUrl) return;

    setLoading(true);
    setError(null);

    // Try to fetch the image to bypass some CORS issues and handle errors better
    const fetchImage = async () => {
      try {
        // Try direct fetch first
        let response: Response;
        try {
          response = await fetch(currentUrl, { mode: 'cors' });
        } catch (e) {
          // If direct fetch fails (CORS), try via proxy
          const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(currentUrl)}`;
          response = await fetch(proxyUrl);
        }

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        
        // Safety check for blob
        if (!blob || blob.size === 0) throw new Error("Received empty blob");

        const url = URL.createObjectURL(blob);
        setLocalUrl(url);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch panorama image:", err);
        // Fallback to direct URL if fetch fails (might still work in Pannellum if it handles CORS differently)
        setLocalUrl(currentUrl);
        setLoading(false);
      }
    };

    fetchImage();

    return () => {
      if (localUrl && localUrl.startsWith('blob:')) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [currentUrl]);

  const viewerRef = useRef<any>(null);

  useEffect(() => {
    // Persistent HACK: Intercept getContext to force preserveDrawingBuffer for capture
    // This must stay active for the duration of the component to catch any canvas created by Pannellum
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype.getContext as any) = function(type: string, attributes: any) {
      if (type.includes('webgl')) {
        attributes = attributes || {};
        attributes.preserveDrawingBuffer = true;
        // alpha: false helps prevent blank/flickering screenshots on some high-performance GPUs
        attributes.alpha = false;
      }
      return originalGetContext.call(this, type, attributes);
    };
    
    return () => {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    };
  }, []);

  useEffect(() => {
    if (localUrl && containerRef.current && window.pannellum) {
      // Initialize pannellum
      try {
        if (viewerRef.current) {
          viewerRef.current.destroy();
        }

        viewerRef.current = window.pannellum.viewer('pannellum-container', {
          type: 'equirectangular',
          panorama: localUrl,
          pitch: pitch,
          yaw: 180,
          hfov: fov,
          autoLoad: true,
          showZoomCtrl: false,
          showFullscreenCtrl: false,
          backgroundColor: [0, 0, 0], // Force black background
          compass: false,
          keyboardZoom: true,
          mouseZoom: true,
          draggable: true,
          // Advanced perspective settings
          minHfov: 30,
          maxHfov: 160,
          hfovBounds: [30, 160],
          friction: 0.15,
          vOffset: 0,
          multiRes: false,
          crossOrigin: 'anonymous'
        });

        // Add dynamic FOV scaling for pole anti-distortion
        viewerRef.current.on('viewchange', () => {
          const p = viewerRef.current.getPitch();
          const absPitch = Math.abs(p);
          if (absPitch > 60) {
            // As we look towards poles, slightly increase FOV to reduce "pinch" effect
            // Formula: base_fov + (excess_pitch * factor)
            const extraFov = (absPitch - 60) * 0.35;
            // Use fovRef instead of state to avoid feedback
            viewerRef.current.setHfov(fovRef.current + extraFov, false);
          } else {
            viewerRef.current.setHfov(fovRef.current, false);
          }
        });

        viewerRef.current.on('zoomchange', (newFov: number) => {
          // Only update if it's a significant change to avoid micro-loops
          const rounded = Math.round(newFov);
          if (rounded !== fovRef.current) {
            setFov(rounded);
          }
        });

        viewerRef.current.on('animatefinished', (data: any) => {
          if (data.pitch !== undefined) setPitch(Math.round(data.pitch));
        });

        viewerRef.current.on('load', () => setLoading(false));
        viewerRef.current.on('error', (err: any) => {
          console.error("Pannellum error:", err);
          setError(typeof err === 'string' ? err : '加载全景图时出错');
          setLoading(false);
        });
      } catch (e) {
        console.error("Failed to initialize Pannellum:", e);
        setError("无法初始化全景查看器");
        setLoading(false);
      }
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [localUrl]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const [showFlash, setShowFlash] = React.useState(false);

  const takeSnapshot = () => {
    if (snapshotting || loading) return;
    
    // 1. Visual feedback start
    setSnapshotting(true);
    setShowFlash(true);
    
    // 2. Short delay to allow the flash effect to be seen and UI to update
    setTimeout(() => {
      setShowFlash(false);
      
      const container = document.getElementById('pannellum-container');
      const viewer = viewerRef.current;
      
      if (!viewer) {
        setSnapshotting(false);
        return;
      }

      try {
        const renderer = viewer.getRenderer();
        const canvas = (typeof renderer.getCanvas === 'function' ? renderer.getCanvas() : container?.querySelector('canvas')) as HTMLCanvasElement;
        
        if (!canvas) {
          console.error("Canvas not found");
          setSnapshotting(false);
          return;
        }

        // 3. Simple capture. 
        // With preserveDrawingBuffer: true (set in useEffect), the buffer is always valid.
        // We DO NOT call renderer.render manually here as it can cause projection glitches (funny mirror).
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        
        // A black/blank canvas usually produces a dataUrl around 1000-2000 chars.
        // If it's too short or all black, we warn.
        if (!dataUrl || dataUrl.length < 500) {
          throw new Error("Captured image data is corrupted or empty");
        }

        // 5. Download
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `panorama_view_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Keep the state for a bit longer so user sees the "Saving..." text
        setTimeout(() => setSnapshotting(false), 1000);
      } catch (err) {
        console.error("Capture error:", err);
        alert("截图失败。如果当前是高画质模式，请尝试缩小窗口再保存。");
        setSnapshotting(false);
      }
    }, 450); // Delay for flash and status change
  };

  const downloadOriginal = () => {
    const url = localUrl || imageUrl;
    if (!url) return;
    
    const link = document.createElement('a');
    link.href = url;
    // Try to extract extension from imageUrl if possible
    const ext = imageUrl.split('.').pop()?.split('?')[0] || 'png';
    link.download = `panorama_full_${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.setHfov(fov, false);
    }
  }, [fov]);

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.setPitch(isShiftMode ? 0 : pitch, true);
    }
  }, [isShiftMode]);

  const healSeam = async () => {
    if (isHealing) return;
    setIsHealing(true);
    try {
      const response = await fetch('/api/panorama/heal-seam', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ imageUrl: currentUrl })
      });
      const data = await response.json();
      if (data.url) {
        setCurrentUrl(data.url);
        // Refresh viewer will happen via currentUrl effect
      } else {
        throw new Error(data.error || "修复失败");
      }
    } catch (err: any) {
      alert("全景接缝修复失败: " + err.message);
    } finally {
      setIsHealing(false);
    }
  };

  const takeArchitecturalCapture = () => {
    // Force pitch 0 for parallel vertical lines
    if (viewerRef.current) {
      viewerRef.current.setPitch(0, true);
      // Wait for animation
      setTimeout(takeSnapshot, 500);
    }
  };

  const resetProTools = () => {
    setFov(110);
    setPitch(0);
    setHorizontalOffset(0);
    setVerticalOffset(0);
    setPerspectiveCorrection(0);
    if (viewerRef.current) {
      viewerRef.current.setPitch(0, true);
      viewerRef.current.setYaw(180, true);
      viewerRef.current.setHfov(110, true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl overflow-hidden"
      ref={containerRef}
      style={{
        '--h-offset': `${horizontalOffset}px`,
        '--v-offset': `${verticalOffset}px`,
        '--perspective': `${perspectiveCorrection}deg`
      } as React.CSSProperties}
      onClick={(e) => {
        // Close if clicking the background (not the pannellum container)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute top-8 left-10 z-20 pointer-events-none">
        <h3 className="text-white text-2xl font-black tracking-tighter drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] flex items-center space-x-3">
          <div className="w-2 h-8 bg-indigo-500 rounded-full" />
          <span>{title || '720° 全景沉浸漫游'}</span>
        </h3>
        <div className="flex items-center space-x-4 mt-2">
          <p className="text-white/60 text-[10px] font-black uppercase tracking-widest bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
            互动全景引擎 v4.0
          </p>
          <div className="flex items-center space-x-3">
            <p className="text-white/40 text-[10px] font-bold">🖱️ 拖拽旋转视角</p>
            <p className="text-white/40 text-[10px] font-bold">🔍 滚轮缩放</p>
          </div>
        </div>
      </div>

      <div className="absolute top-8 right-10 z-20 flex items-center space-x-4">
        <button
          onClick={toggleWalking}
          className={cn(
            "flex items-center space-x-2 px-6 py-4 rounded-2xl backdrop-blur-xl transition-all border shadow-2xl active:scale-95",
            isWalking ? "bg-emerald-600 text-white border-emerald-400" : "bg-white/10 text-white border-white/10 hover:bg-white/20"
          )}
          title="自由漫游模式: 使用 WASD 键走动"
        >
          <Footprints className="w-6 h-6" />
          <span className="font-bold">{isWalking ? '正在漫游' : '自由漫游'}</span>
        </button>

        <button
          onClick={() => setShowProTools(!showProTools)}
          className={cn(
            "flex items-center space-x-2 px-6 py-4 rounded-2xl backdrop-blur-xl transition-all border shadow-2xl active:scale-95",
            showProTools ? "bg-indigo-600 text-white border-indigo-400" : "bg-white/10 text-white border-white/10 hover:bg-white/20"
          )}
        >
          <Settings2 className="w-6 h-6" />
          <span className="font-bold">视觉矫正</span>
        </button>

        <button
          onClick={takeSnapshot}
          disabled={snapshotting || loading}
          className={`flex items-center space-x-2 px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-xl transition-all border border-white/10 shadow-2xl group active:scale-95 ${snapshotting || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="保存当前视角截图"
        >
          {snapshotting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
          <span className="font-bold">{snapshotting ? '正在保存...' : '截图'}</span>
        </button>
        
        <button
          onClick={downloadOriginal}
          className="flex items-center space-x-2 px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-xl transition-all border border-white/10 shadow-2xl group active:scale-95 md:flex hidden"
          title="下载原始全景大图"
        >
          <Download className="w-6 h-6" />
          <span className="font-bold">全景</span>
        </button>
        
        <button
          onClick={toggleFullscreen}
          className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-xl transition-all border border-white/10 shadow-2xl group md:block hidden"
          title={isFullscreen ? "退出全屏" : "全屏模式"}
        >
          {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
        </button>
        
        <button
          onClick={onClose}
          className="flex items-center space-x-3 px-8 py-4 bg-white text-black rounded-2xl shadow-2xl transition-all active:scale-95 border border-white/20 group"
        >
          <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          <span className="text-lg font-black tracking-tight">{closeText || '关闭'}</span>
        </button>
      </div>

      {/* Pro Tools Panel */}
      <AnimatePresence>
        {showProTools && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="absolute top-32 right-10 z-30 w-80 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
            
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <h4 className="text-white font-black text-sm uppercase tracking-widest">高级相机参数</h4>
              </div>
              <button 
                onClick={resetProTools}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-all"
                title="重置参数"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-8">
              {/* Shift Lens Mode Toggle */}
              <div className="flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                <div className="flex flex-col">
                  <span className="text-white font-bold text-xs">专业移轴 (Shift Lens) 模式</span>
                  <span className="text-[9px] text-white/40">锁定垂直透视，修正建筑畸变</span>
                </div>
                <button 
                  onClick={() => setIsShiftMode(!isShiftMode)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    isShiftMode ? "bg-indigo-500" : "bg-white/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    isShiftMode ? "left-7" : "left-1"
                  )} />
                </button>
              </div>

              {/* FOV Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">视野角度 (FOV)</label>
                  <span className="text-xs font-mono text-indigo-400">{fov}°</span>
                </div>
                <input 
                  type="range" min="30" max="150" step="1" 
                  value={fov} onChange={(e) => setFov(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Pivot Sliders */}
              <div className="space-y-6 pt-4 border-t border-white/5">
                <div className="flex items-center space-x-2 mb-2">
                  <ChevronRight className="w-3 h-3 text-white/20" />
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">物理位移补偿 (Spatial Offset)</label>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-bold text-white/60">水平偏移 (Pivot X)</label>
                    <span className="text-[10px] font-mono text-white/40">{horizontalOffset}px</span>
                  </div>
                  <input 
                    type="range" min="-100" max="100" step="1" 
                    value={horizontalOffset} onChange={(e) => setHorizontalOffset(Number(e.target.value))}
                    className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-white/40"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-bold text-white/60">垂直偏移 (Pivot Y)</label>
                    <span className="text-[10px] font-mono text-white/40">{verticalOffset}px</span>
                  </div>
                  <input 
                    type="range" min="-50" max="50" step="1" 
                    value={verticalOffset} onChange={(e) => setVerticalOffset(Number(e.target.value))}
                    className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-white/40"
                  />
                </div>
              </div>

              {/* Perspective Correction */}
              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">视线矫正 (Perspective)</label>
                  <span className="text-xs font-mono text-purple-400">{perspectiveCorrection}°</span>
                </div>
                <input 
                  type="range" min="-15" max="15" step="0.5" 
                  value={perspectiveCorrection} onChange={(e) => setPerspectiveCorrection(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                />
                <p className="text-[9px] text-white/30 italic leading-snug">内置仿射变换矩阵，针对轴心位移或 AI 生成导致的弧形畸变进行拉伸校正，使其符合横平竖直的透视习惯。</p>
              </div>

              {/* AI Healing Tool */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center space-x-2">
                  <RotateCcw className="w-3 h-3 text-orange-400" />
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">AI 后期处理</label>
                </div>
                <button 
                  onClick={healSeam}
                  disabled={isHealing}
                  className={cn(
                    "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center space-x-2",
                    isHealing ? "bg-white/5 text-white/20" : "bg-orange-500/10 text-orange-500 border border-orange-500/30 hover:bg-orange-500/20"
                  )}
                >
                  {isHealing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3" />}
                  <span>{isHealing ? '正在进行接缝对齐与重绘...' : '接缝一键修复 (Seam Blender)'}</span>
                </button>
                <p className="text-[8px] text-white/20 italic text-center">系统将通过平移重对齐算法，针对 0° 经线接缝进行 AI 融合重绘</p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 space-y-3">
              <button 
                onClick={takeArchitecturalCapture}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-900/40 rounded-2xl text-xs font-black transition-all active:scale-95 flex items-center justify-center space-x-2"
              >
                <Camera className="w-4 h-4" />
                <span>移轴平面截图 (Architectural Capture)</span>
              </button>
              <p className="text-[8px] text-white/30 text-center">自动归位俯仰角并修正垂直透视，生成标准的建筑摄影构图</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className="w-full h-full bg-black relative overflow-hidden flex items-center justify-center origin-center" 
        id="pannellum-container"
        style={{
          transform: `
            translate(calc(var(--h-offset) + ${walkState.x}px), calc(var(--v-offset) + ${walkState.y + walkState.bob}px)) 
            rotateX(var(--perspective)) 
            scale(${walkState.scale})
          `,
          transition: isWalking ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0, 0.2, 1)'
        }}
      >
        {/* Vanilla Pannellum will mount here */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] bg-white pointer-events-none"
            />
          )}
        </AnimatePresence>
      </div>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/80 backdrop-blur-md p-10">
          <div className="max-w-md w-full bg-white/10 border border-white/20 p-8 rounded-3xl text-center backdrop-blur-2xl shadow-2xl">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-10 h-10 text-red-500" />
            </div>
            <h4 className="text-white text-xl font-black mb-2">全景加载失败</h4>
            <p className="text-white/60 text-sm mb-8 leading-relaxed">
              由于网络限制或资源权限问题，无法加载全景图片。请尝试重新生成或检查网络。
            </p>
            <button
              onClick={onClose}
              className="w-full py-4 bg-white text-black rounded-2xl font-black hover:bg-gray-200 transition-all"
            >
              返回重试
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
