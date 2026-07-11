import { Config, ApiConfig } from "../../types";
import { BaseAgent } from "./baseAgent";
import { safeJson } from "../../lib/fetch";
import { toBase64 } from "../../lib/utils";
import { urlToBase64 } from "../../services/utils";

export const VIDEO_AGENT_SYSTEM_INSTRUCTION = `
你是 **视界 (Vision) 视频创作智能体**。你是一位精通电影剪辑、特效制作和动态视觉设计的 **顶级视频制作人**。
你的目标是：根据用户的提示词或参考图，生成极具视觉冲击力、动作流畅且符合物理规律的高质量视频。

一、核心能力
1. **动态理解**：你能精准捕捉提示词中的动作描述，并将其转化为连贯的视频画面。
2. **视觉一致性**：当提供参考图时，你能确保视频中的角色、场景和道具在视觉特征上与参考图保持高度一致。
3. **风格迁移**：你能根据用户要求的画风（如：写实、动漫、赛博朋克），生成对应风格的视频内容。

二、输出规范
- 视频时长通常为 4-15 秒。
- 确保画面清晰，动作自然，无明显的 AI 伪影。
- **语言策略**：如果剧本是英文，生成的视频画面中严禁出现任何中文字符（如招牌、标签、包装文字等），所有文字必须为英文或不显示文字。
`;

export class VideoAgent extends BaseAgent {
  public async generateVideo(prompt: string, options: { 
    resolution?: string, 
    aspectRatio?: string, 
    duration?: string, 
    model?: string, 
    videoMode?: string,
    seed?: number,
    realPersonMode?: boolean,
    returnLastFrame?: boolean,
    image?: { imageBytes: string, mimeType: string },
    lastFrame?: { imageBytes: string, mimeType: string },
    referenceImages?: { image: { imageBytes: string, mimeType: string }, referenceType: string }[],
    referenceAssets?: { data: string, mimeType: string, type: 'image' | 'video' | 'audio', startTime?: number, duration?: number }[],
    customDescription?: string
  }, config?: Config): Promise<any> {
    const finalPrompt = options.customDescription ? `${options.customDescription}\n\nUser Request: ${prompt}` : prompt;
    const apiType = options.model === 'seedance-mini' ? 'videoSeedanceMini' :
                    options.model === 'seedance2.0' || options.model === 'seedance2.5' || options.model === 'doubao-seedance-2-0-260128' ? 'videoSeedance' : 
                    (options.model === 'veo_3_1-fast' || options.model === 'veo-3.1-fast-generate-preview') ? 'videoVeoFast' : 'video';
    const apiConfig = config ? config[apiType as keyof Config] as ApiConfig : null;
    const isVectorEngine = apiConfig?.endpoint?.includes('vectorengine.ai');
    const isArk = apiConfig?.endpoint?.includes('volces.com') || apiType === 'videoSeedance' || apiType === 'videoSeedanceMini';
    const isDefault = apiConfig?.endpoint?.includes('generativelanguage.googleapis.com');

    // Helper to ensure base64
    const ensureBase64 = async (img?: { imageBytes: string, mimeType: string }) => {
      if (!img || !img.imageBytes) return undefined;
      const bytes = String(img.imageBytes);
      if (bytes.startsWith('http') || bytes.startsWith('blob:')) {
        try {
          const res = await urlToBase64(bytes);
          return `data:${res.mimeType};base64,${res.base64}`;
        } catch (e) {
          console.error("Failed to convert image to base64:", e);
          return bytes; // Fallback to original
        }
      }
      return bytes.includes('base64,') ? bytes : `data:${img.mimeType || 'image/png'};base64,${bytes}`;
    };

    if (isArk) {
      const imageBase64 = await ensureBase64(options.image);
      const lastFrameBase64 = await ensureBase64(options.lastFrame);

      const body = {
        model: options.model || apiConfig?.model || 'doubao-seedance-2-0-260128',
        prompt: finalPrompt,
        resolution: options.resolution || '720p',
        ratio: options.aspectRatio || 'adaptive',
        duration: options.duration || '15',
        videoMode: options.videoMode || 'all-around',
        seed: options.seed,
        realPersonMode: options.realPersonMode,
        returnLastFrame: options.returnLastFrame,
        // For realperson mode, some specific API versions might require explicit person safety settings
        // if supported by the account
        image: imageBase64,
        lastFrame: lastFrameBase64,
        referenceAssets: [
          ...(options.referenceAssets ? await Promise.all(options.referenceAssets.map(async a => {
            const data = a.data || '';
            const isUrl = data.startsWith('http') || data.startsWith('blob:');
            return {
              type: a.type,
              url: isUrl
                ? (await urlToBase64(data).then(r => `data:${r.mimeType};base64,${r.base64}`).catch(() => data))
                : (data.includes('base64,') ? data : `data:${a.mimeType || 'image/png'};base64,${data}`),
              startTime: a.startTime,
              duration: a.duration
            };
          })) : []),
          ...(options.referenceImages ? await Promise.all(options.referenceImages.map(async ref => ({
            type: 'image',
            url: await ensureBase64(ref.image)
          }))) : [])
        ]
      };

      console.log(`>>> [DEBUG] VideoAgent calling /api/generate with mode: ${body.videoMode}`);
      try {
        const isServer = typeof window === 'undefined';
        const endpoint = isServer ? 'http://localhost:3000/api/generate' : '/api/generate';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${!isServer ? localStorage.getItem('token') : ''}`
          },
          body: JSON.stringify(body)
        });
        const result = await safeJson(response);
        if (!response.ok) {
          let errorMsg = (result && typeof result.error === 'object' && result.error !== null) 
            ? (result.error.message || JSON.stringify(result.error)) 
            : (result?.error || '生成请求失败');
          
          if (response.status === 401 || (errorMsg && (errorMsg.toLowerCase().includes('invalid token') || errorMsg.toLowerCase().includes('invalid api key')))) {
            errorMsg = `SEEDANCE API 令牌无效: ${errorMsg}。请检查您的 API Key 配置。`;
          } else if (response.status === 429) {
            if (errorMsg && errorMsg.includes('120 seconds')) errorMsg = '由于多次使用无效 Token，您的 IP 已被暂时封禁，请等待 120 秒后再试 (429)。';
            else errorMsg = `请求过于频繁 (429): ${errorMsg}`;
          }
          
          throw new Error(errorMsg);
        }
        
        if (!result) {
          throw new Error("视频生成请求返回了空的内容或无效 JSON。");
        }

        if (!result.taskId) {
          throw new Error("视频生成请求返回的数据中缺失 taskId。 详情: " + JSON.stringify(result));
        }
        
        return {
          name: result.taskId,
          id: result.taskId,
          operationId: result.taskId,
          done: false,
          metadata: result
        };
      } catch (e) {
        console.error("Ark Video Generation failed:", e);
        throw e;
      }
    }

    if (isVectorEngine && (options.model?.includes('veo') || options.model === 'veo-3.1-generate-preview')) {
      const formData = new FormData();
      let modelName = 'veo-3.1-generate-preview';
      
      if (options.model === 'veo_3_1-fast' || options.model === 'veo-3.1-fast-generate-preview') {
        modelName = 'veo-3.1-fast-generate-preview';
      }
      
      formData.append('model', modelName);
      formData.append('prompt', finalPrompt);
      formData.append('seconds', options.duration || '8');
      formData.append('size', options.aspectRatio || '16x9');

      if (options.image) {
        const imageBytes = options.image.imageBytes;
        let byteArray: Uint8Array;
        
        if (typeof Buffer !== 'undefined') {
          byteArray = Buffer.from(imageBytes, 'base64');
        } else {
          const byteCharacters = atob(imageBytes);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          byteArray = new Uint8Array(byteNumbers);
        }
        
        const blob = new Blob([byteArray], { type: options.image.mimeType });
        formData.append('input_reference', blob, 'reference.png');
      }

      try {
        const result = await this.callApiFormData(apiType as any, formData, config);
        return {
          name: result.id,
          id: result.id,
          operationId: result.id,
          done: false,
          metadata: result
        };
      } catch (e) {
        console.error("VectorEngine Video Generation failed:", e);
        throw e;
      }
    }

    if (options.model === 'seedance2.0' || options.model === 'seedance-mini' || options.model === 'seedance2.5') {
      const content: any[] = [];
      if (prompt) {
        content.push({ type: 'text', text: prompt });
      }

      let hasFirstOrLastFrame = false;

      // Handle explicit image/lastFrame
      if (options.image) {
        const url = await ensureBase64(options.image);
        content.push({ type: 'image_url', image_url: { url }, role: 'first_frame' });
        hasFirstOrLastFrame = true;
      }
      if (options.lastFrame) {
        const url = await ensureBase64(options.lastFrame);
        content.push({ type: 'image_url', image_url: { url }, role: 'last_frame' });
        hasFirstOrLastFrame = true;
      }

      // Handle referenceImages (mapping CONTINUITY to first_frame)
      if (options.referenceImages) {
        for (const ref of options.referenceImages) {
          const data = await ensureBase64(ref.image);
          if (ref.referenceType === 'CONTINUITY' && !hasFirstOrLastFrame) {
            content.push({ type: 'image_url', image_url: { url: data }, role: 'first_frame' });
            hasFirstOrLastFrame = true;
          } else if (ref.referenceType === 'ASSET' && !hasFirstOrLastFrame) {
            // Only add asset references if NO first/last frame is present (Seedance 2.0 restriction)
            content.push({ type: 'image_url', image_url: { url: data }, role: 'reference_image' });
          }
        }
      }

      if (options.referenceAssets) {
        for (const asset of options.referenceAssets) {
          const assetData = asset.data || '';
          const hasBase64Sfx = assetData.includes(',');
          const dataOnly = hasBase64Sfx ? assetData.split(',')[1] : assetData;
          const isUrl = assetData.startsWith('http') || assetData.startsWith('blob:');
          
          const url = isUrl
            ? await urlToBase64(assetData).then(r => `data:${r.mimeType};base64,${r.base64}`).catch(() => assetData)
            : `data:${asset.mimeType || 'image/png'};base64,${dataOnly}`;
          
          if (asset.type === 'image' && !hasFirstOrLastFrame) {
            content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' });
          } else if (asset.type === 'video' && !hasFirstOrLastFrame) {
            content.push({ 
              type: 'video_url', 
              video_url: { 
                url,
                startTime: asset.startTime,
                duration: asset.duration
              }, 
              role: 'reference_video' 
            });
          } else if (asset.type === 'audio') {
            // Audio is usually allowed to mix
            content.push({ type: 'audio_url', audio_url: { url }, role: 'reference_audio' });
          }
        }
      }

      const body = {
        model: apiConfig?.model || (options.model === 'seedance-mini' ? 'seedance-mini' : 'doubao-seedance-2-0-260128'),
        content,
        generate_audio: true,
        ratio: options.aspectRatio || '9:16',
        duration: parseInt(options.duration || '15')
      };

      try {
        let operation = await this.callApi(apiType as any, 'generateVideos', body, config);
        if (operation && !operation.operationId) {
          operation.operationId = operation.name || operation.id || operation.task_id;
        }
        return operation;
      } catch (e) {
        console.error("Ark Video Generation failed:", e);
        throw e;
      }
    }

    // Default Google structure
    const googleRefImages = options.referenceImages || [];
    if (options.referenceAssets) {
      options.referenceAssets.forEach(asset => {
        if (asset.type === 'image') {
          const assetData = asset.data || '';
          googleRefImages.push({
            image: {
              imageBytes: assetData.includes(',') ? assetData.split(',')[1] : assetData,
              mimeType: asset.mimeType || 'image/png'
            },
            referenceType: 'ASSET'
          });
        }
      });
    }

    const body: any = {
      prompt,
      model: (options.model === 'veo_3_1' || options.model === 'veo-3.1-generate-preview') ? (config?.video?.model || 'veo-3.1-generate-preview') : 
             (options.model === 'veo_3_1-fast' || options.model === 'veo-3.1-fast-generate-preview') ? (config?.videoVeoFast?.model || 'veo-3.1-fast-generate-preview') : 
             (options.model || config?.video?.model),
      image: options.image,
      config: {
        numberOfVideos: 1,
        resolution: options.resolution || '720p',
        aspectRatio: options.aspectRatio || '16:9',
        duration: options.duration || '4',
        lastFrame: options.lastFrame,
        referenceImages: googleRefImages.length > 0 ? googleRefImages : undefined
      }
    };

    try {
      let operation = await this.callApi(apiType as any, 'generateVideos', body, config);
      if (operation && !operation.operationId) {
        operation.operationId = operation.name || operation.id;
      }
      return operation;
    } catch (e) {
      console.error("Video Generation failed:", e);
      throw e;
    }
  }

  public async getOperationStatus(operationId: string, config?: Config, model?: string): Promise<any> {
    // Implementation for polling video generation status
    const apiType = model === 'seedance-mini' ? 'videoSeedanceMini' :
                    model === 'seedance2.0' || model === 'seedance2.5' || model === 'doubao-seedance-2-0-260128' ? 'videoSeedance' : 
                    (model === 'veo_3_1-fast' || model === 'veo-3.1-fast-generate-preview') ? 'videoVeoFast' : 'video';
    const apiConfig = config ? config[apiType as keyof Config] as ApiConfig : null;
    if (!apiConfig) throw new Error(`未找到 ${apiType} 配置`);
    const apiKey = this.getApiKey(apiConfig.apiKey, apiType as any, apiConfig.provider);
    
    const baseUrlRaw = apiConfig.endpoint.replace(/\/$/, '');
    const baseUrl = baseUrlRaw.replace(/\/v1$/, '').replace(/\/v1beta$/, '');
    const isDefault = apiConfig.endpoint.includes('generativelanguage.googleapis.com');
    const isVectorEngine = apiConfig.endpoint.includes('vectorengine.ai');
    const isArk = apiConfig.endpoint.includes('volces.com') || apiType === 'videoSeedance' || apiType === 'videoSeedanceMini';
    
    if (isArk) {
      try {
        const isServer = typeof window === 'undefined';
        const endpoint = isServer ? `http://localhost:3000/api/status/${operationId}` : `/api/status/${operationId}`;
        const response = await fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${!isServer ? localStorage.getItem('token') : ''}` }
        });
        const result = await safeJson(response);
        if (!response.ok) {
          const errorMsg = (typeof result.error === 'object' && result.error !== null) ? (result.error.message || JSON.stringify(result.error)) : (result.error || '查询状态失败');
          throw new Error(errorMsg);
        }

        const status = result.status;
        if (status === 'succeeded') {
          const videoPart = Array.isArray(result.content) ? result.content.find((p: any) => p.type === 'video_url') : null;
          const uri = videoPart?.video_url?.url || result.content?.video_url || result.output?.video_url || result.video_url || result.url;
          
          if (!uri) {
            console.error("Ark status check succeeded but no video URL found:", result);
            return {
              done: true,
              error: "Video generation succeeded but no video URL found in response"
            };
          }

          return {
            done: true,
            videoUrl: uri,
            response: {
              generatedVideos: [{
                video: { uri }
              }]
            }
          };
        } else if (status === 'failed') {
          return {
            done: true,
            error: (typeof result.error === 'object' && result.error !== null) ? (result.error.message || JSON.stringify(result.error)) : (result.error?.message || result.error || "Video generation failed on Ark")
          };
        } else {
          return {
            done: false,
            status: status
          };
        }
      } catch (e: any) {
        console.error("Ark status check failed:", e);
        return { done: true, error: e.message };
      }
    }

    let url = '';
    if (isDefault) {
      url = `${baseUrl}/v1beta/operations/${operationId}?key=${apiKey}`;
    } else if (isVectorEngine) {
      url = `${baseUrl}/v1/videos/${operationId}`;
    } else {
      // For custom endpoints, we try to follow the Google structure but respect the base URL
      url = `${baseUrl}/v1/operations/${operationId}`;
      if (apiConfig.provider !== 'Third Party') {
        url += `${url.includes('?') ? '&' : '?'}key=${apiKey}`;
      }
    }

    const headers: any = {};
    const isServer = typeof window === 'undefined';
    let finalUrl = url;
    if (isVectorEngine && !isServer) {
      // Use bridge to avoid CORS and WAF on client
      const encodedUrl = toBase64(url);
      finalUrl = `/api/v1/bridge?u=${encodedUrl}&m=GET&k=${encodeURIComponent(apiKey)}`;
    } else {
      if (apiConfig.provider === 'Third Party') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    if (isServer && finalUrl.startsWith('/')) {
      finalUrl = `http://localhost:3000${finalUrl}`;
    }

    const response = await fetch(finalUrl, { headers });
    const result = await safeJson(response);

    if (!result && response.ok) {
      return { done: false, error: "Received non-JSON response from status check" };
    }

    if (isVectorEngine) {
      // Map Vectorengine status to Google-like done/response
      const status = result.status || result.detail?.status;
      const videoUrl = result.video_url || result.detail?.video_url;
      const progress = result.progress_pct || result.progress || 0;

      if (status === 'succeeded' && videoUrl) {
        return {
          done: true,
          videoUrl: videoUrl,
          response: {
            generatedVideos: [{
              video: { uri: videoUrl }
            }]
          }
        };
      } else if (status === 'failed') {
        const errObj = result.error || result.detail?.error || "Video generation failed";
        const errStr = typeof errObj === 'object' ? (errObj.message || JSON.stringify(errObj)) : String(errObj);
        return {
          done: true,
          error: errStr
        };
      } else {
        return {
          done: false,
          progress: progress * 100,
          status: status
        };
      }
    }

    // Normalize result for different providers
    if (isDefault) {
      return {
        done: result.done,
        videoUrl: result.response?.generatedVideos?.[0]?.video?.uri,
        error: result.error?.message
      };
    }
    
    return result;
  }
}

export const videoAgent = new VideoAgent();
