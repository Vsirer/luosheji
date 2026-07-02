
export const fetchWithProxy = async (url: string): Promise<Response> => {
  if (url.startsWith('data:')) return fetch(url);
  
  let fetchUrl = url;
  try {
    const parsedUrl = new URL(url);
    const isSameOrigin = typeof window !== 'undefined' && parsedUrl.origin === window.location.origin;
    if (!isSameOrigin) {
      fetchUrl = `/api/proxy-download?url=${encodeURIComponent(url)}`;
    }
  } catch (e) {
    // Not a valid URL or other error, proceed with original URL
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
  
  try {
    const response = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
};

export const urlToBase64 = async (url: string): Promise<{ base64: string, mimeType: string }> => {
  if (url.startsWith('data:')) {
    const [mimePart, base64String] = url.split(',');
    const mimeType = mimePart.split(':')[1].split(';')[0];
    return { base64: base64String, mimeType };
  }

  const response = await fetchWithProxy(url);
  if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
  const blob = await response.blob();
  
  if (!blob || !(blob instanceof Blob)) {
    throw new Error("Failed to get valid blob from response");
  }

  if (typeof FileReader === 'undefined') {
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      base64: buffer.toString('base64'),
      mimeType: blob.type
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (!result) {
        reject(new Error("FileReader result is empty"));
        return;
      }
      const [mimePart, base64String] = result.split(',');
      const mimeType = mimePart.split(':')[1].split(';')[0];
      resolve({ base64: base64String, mimeType });
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    try {
      reader.readAsDataURL(blob);
    } catch (e) {
      reject(new Error("Failed to read blob as DataURL"));
    }
  });
};

export const ensureBlobUrl = async (url: string): Promise<string> => {
  if (!url.startsWith('data:')) return url;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return url;
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("Blob optimization failed:", e);
    return url;
  }
};

export const cleanPrompt = (p: string) => {
  if (!p) return "";
  
  // Basic cleaning
  let cleaned = p.trim();
  
  // Strip out common copyrighted terms that trigger filters
  const blockedTerms = [
    "Disney", "Pixar", "Marvel", "Spider-Man", "SpiderMan", "Iron Man", "IronMan", 
    "Batman", "Superman", "Nintendo", "Mario", "Zelda", "Pokemon", "Star Wars", 
    "Harry Potter", "Mickey Mouse", "Donald Duck"
  ];
  
  blockedTerms.forEach(term => {
    const regex = new RegExp(term, 'gi');
    cleaned = cleaned.replace(regex, "");
  });

  const suffix = "无字幕，无背景音乐";
  if (cleaned && !cleaned.includes(suffix)) {
    cleaned = cleaned.endsWith('。') || cleaned.endsWith('.') 
      ? `${cleaned}${suffix}` 
      : `${cleaned}，${suffix}`;
  }
  return cleaned;
};

export const handleDownload = async (url: string, filename: string) => {
  if (typeof window === 'undefined') return;

  try {
    // 0. Handle blob URLs directly synchronously
    // This avoids sending blob: URLs to server proxies which will fail
    if (url.startsWith('blob:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // If it's a data URL, we convert the base64 directly to a Blob synchronously
    // This avoids using fetch() on data: URLs which is blocked by Chromium and iframe sandbox policies,
    // and avoids the insecure target="_blank" fallback which causes empty/corrupted file downloads.
    if (url.startsWith('data:')) {
      try {
        const arr = url.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mimeType });
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        return;
      } catch (decodeErr) {
        console.error('Failed to parse and download data URL:', decodeErr);
        // Fallback to direct anchor downloading without target="_blank" to avoid Chromium blocks
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
    }

    // For external URLs, use the proxy with force download headers
    // This is the most reliable way to prevent the browser from previewing text/images
    const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const link = document.createElement('a');
    link.href = proxyUrl;
    link.download = filename; // Still keep download attribute as double security
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error('Download failed:', error);
    // Absolute fallback
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    if (!url.startsWith('data:')) {
      link.target = '_blank';
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const getMediaDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const media = document.createElement(isVideo ? 'video' : 'audio');
    media.preload = 'metadata';
    media.src = url;
    media.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(media.duration);
    };
    media.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取媒体文件时长'));
    };
  });
};

export const formatErrorMessage = (error: any, defaultMsg: string = '操作失败'): string => {
  if (!error) return defaultMsg;
  
  let msg = '';
  if (typeof error === 'string') {
    msg = error;
  } else if (error instanceof Error) {
    msg = error.message || String(error);
  } else if (typeof error === 'object' && error !== null) {
    // Handle nested error objects from various APIs
    const rawMsg = error.message || 
                  (error.error && typeof error.error === 'object' ? error.error.message : error.error) || 
                  (error.details) ||
                  JSON.stringify(error);
    msg = String(rawMsg);
  } else {
    msg = String(error);
  }

  if (!msg || msg === '[object Object]' || msg === 'undefined' || msg === 'null') {
    msg = defaultMsg;
  }
  
  const lowerMsg = msg.toLowerCase();
  
  if (lowerMsg.includes('privacyinformation') || lowerMsg.includes('real person') || lowerMsg.includes('sensitive content')) {
    return '生成失败：参考素材中疑似包含真实人物信息 (Real Person Detected)。API 策略禁止生成或模拟真实人物。请尝试更换参考视频或图片，或确保画面中不包含清晰的可辨识真实人脸。';
  }

  if (lowerMsg.includes('copyright') || lowerMsg.includes('版权')) {
    return '生成失败：脚本或描述中可能包含受版权保护的内容（如知名品牌、虚构角色名等）。请尝试修改脚本，移除具体品牌或角色名称。';
  }

  if (lowerMsg.includes('prohibited_content') || lowerMsg.includes('safety') || lowerMsg.includes('blocked')) {
    return '生成失败：内容因触发安全策略被拦截 (Prohibited Content)。请检查您的剧本是否包含暴力、色情或其他敏感违规内容，并尝试修改文本。';
  }

  if (lowerMsg.includes('429') || lowerMsg.includes('rate limit') || lowerMsg.includes('quota')) {
    return '请求过于频繁 (Rate Limit)。请稍等片刻再试，或检查您的相关服务配额。';
  }
  
  if (lowerMsg.includes('403') || lowerMsg.includes('permission_denied') || lowerMsg.includes('permission')) {
    return '访问权限不足或 API Key 无效。请检查您的账号权限或 API 配置。';
  }

  if (lowerMsg.includes('503') || lowerMsg.includes('service unavailable')) {
    return '服务暂时不可用 (503 Service Unavailable)，请稍后再试。';
  }

  if (lowerMsg.includes('network') || lowerMsg.includes('fetch') || lowerMsg.includes('etimedout') || lowerMsg.includes('timeout')) {
    return '网络连接异常或超时。请检查您的网络设置及 API 代理是否稳定。';
  }

  return msg;
};

export const getVideoThumbnail = (fileOrUrl: File | string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    
    video.onloadeddata = () => {
      // Seek to 1 second (or duration/2) to get a good frame
      video.currentTime = 1;
    };
    
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        if (typeof fileOrUrl !== 'string') URL.revokeObjectURL(url);
        resolve(dataUrl);
      } else {
        if (typeof fileOrUrl !== 'string') URL.revokeObjectURL(url);
        reject(new Error('Canvas context failed'));
      }
    };
    
    video.onerror = () => {
      if (typeof fileOrUrl !== 'string') URL.revokeObjectURL(url);
      reject(new Error('Failed to load video for thumbnail'));
    };
  });
};

export const getThumbnailUrl = (url: string | undefined | null, type: 'image' | 'video' = 'image') => {
  if (!url) return null;
  // For now, just return the original URL. 
  // In a real app, this might call a thumbnail service or return a frame for videos.
  return url;
};

export const logUsage = async (type: 'image_gen' | 'video_gen' | 'text_ai' | 'points_spent' | 'script_gen' | 'gpt_image_gen', amount: number = 0, details: any = {}) => {
  if (typeof localStorage === 'undefined') {
    // If on server, we can't easily log to client-facing API without token.
    // For now, let's just log to console.
    console.log(`[Server logUsage] ${type}:`, { amount, ...details });
    return;
  }
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    await fetch('/api/user/log-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type, amount, details })
    });
  } catch (e) {
    console.error('Failed to log usage:', e);
  }
};

/**
 * 将用户选择的高层视觉风格、调色名字等，拆解拆成可让AI绘图/渲染引擎深度理解并完美执行的具体风格、色彩、光影说明。
 * 解决AI简单照抄名字无法理解视觉实质的问题。
 */
export const expandVisualStyle = (styleName: string | undefined): string => {
  if (!styleName) return "电影级写实摄影质感";
  const trimmed = styleName.trim();
  
  // 1. 标准画风字典全量映射
  const styleMap: { [key: string]: string } = {
    '好莱坞商业大片风': '电影级写实摄影质感，好莱坞级电影调色（经典青橙对比 Teal & Orange，高对比度低调光影，金属/胶片颗粒），极致写实，电影大片级画幅，影院级景深，阿莱Alexa/RED摄影机质感，真实镜头畸变与光晕表现',
    '文艺独立电影风': '手持纪实摄影风格，柔和自然光，低饱和度色调，温暖柔和色彩，极具叙事感的细腻人物和背景细节，16mm胶片质感，微弱噪点，生活化纪实感',
    '黑色电影悬疑风': '高对比度单色/低色调（Low-key lighting），经典黑色电影光影（Film Noir），强烈的明暗对照（Chiaroscuro），阴影交错（硬调光），悬疑烟雾弥漫，雨夜街影，极致悬念氛围',
    '现代新黑色电影风': '新黑色电影风格（Neo-Noir），赛博冷郁色调，霓虹冷光，高饱和度冷色交织暗部阴影，大雨浸湿路面的反射，现代城市疏离感，极致摄影对比度',
    '35mm 复古胶片风': '经典柯达/富士35mm胶片，明显的胶片颗粒感（film grain），温暖而柔美的高光表现，略微泛黄的复古影调，经典胶片色彩还原，极具电影故事性',
    '70 年代复古电影风': '70年代古典电影风格，复古暖调色，颗粒感明显，低对比度，柔焦边缘，泛黄胶片底片感，浓郁复古时代印记',
    '80/90 年代港风电影': '怀旧港风电影质感，高对比度，饱和色彩与冷暖调交织，旧香港灯红酒绿的霓虹模糊，略带柔焦与朦胧质感，90年代胶片底噪，港片黄金时代独特影调',
    '王家卫氛围感电影风': '王家卫标志性电影美学，抽帧动感模糊，高饱和色彩纠缠，冷绿与暖橘的迷离对立色调，失焦散景，雨天潮湿反射，慵懒、忧郁与梦幻的宿命氛围',
    '纪实伪纪录片风': '纪实主义（Cinéma vérité），手持晃动感摄影（shaky cam），粗糙颗粒，极度还原真实自然光，生活化凌乱布景，没有任何刻意布光的现场临场强写实',
    '硬科幻写实风': '硬科幻超写实主义，精细重工业美学，深空冷灰色，高反差金属拉丝与工程塑料触感，冷光LED线条，极致科幻结构层次，严谨硬朗的工业设计表现',
    '太空史诗电影风': '太空史诗（Space Epic）级景宽，冷色与幽深星空背景，电影感宏伟构图，高光雕刻飞船边缘（RIM LIGHT），精细透视感，星光折射，庄严肃穆',
    '赛博朋克写实风': '极致写实赛博美学，高对比饱和霓虹，雨夜潮湿柏油马路的反光（Neon wet reflections），浮华全息投影与贫民窟凌乱对比，高科技低生活质感',
    '西部荒野电影风': '粗犷黄沙大漠质感，经典西部片炎热强烈偏黄光影，高反差，逆光下尘土飞扬，沙石、皮革与斑驳木纹的精细细节表现',
    '战争写实风': '残酷写实战争色调，冷灰色与沙尘黄混合（低饱和度），弥漫的硝烟烟雾，地面的泥泞、废墟残垣写实，战场紧迫感，纪实摄影视角',
    '暗调高级质感风': '低调奢华暗调（Low-key style），哑光面精细材质，柔和漫反射，深邃而有层次的阴影细节，极窄高光亮线，冷灰/哑黑/哑金极高级质感',
    '明亮清新甜宠风': '高调明亮暖白影调，高亮度低反差，马卡龙色与温暖浅粉浅橙，柔和通透感，温馨浪漫甜蜜空气感',
    '欧式古典文艺风': '文艺复兴古典油画质感（Chiaroscuro），柔和侧光（伦勃朗光），复古油画笔触与厚重色彩，奢华高贵，雕像般的古典比例与精细质感',
    '北欧极简冷淡风': '北欧极简主义冷调风格，纯净冷灰/冷白配色，柔和无影均匀自然光，极慢透视感，大片留白与空间感，宁静致远，极度克制与理性的纯粹感',
    '乡村田园治愈风': '金黄色自然阳光，温润清新的乡村原野，柔和绿色与大地色系，风吹麦浪的治愈质感，日系温情田园风',
    '末世灾难写实风': '荒凉废墟美学，废土风格（Wasteland style），满地黄沙碎石，斑驳铁锈与混凝土断层，烟雾迷蒙沙尘暴天气，孤寂而苍凉的写实质感',
    '警匪黑帮冷峻风': '冷色调高对比，利落硬朗，沥青地、混凝土灰色，金属反光，极富张力的中低视角，阴郁清冷，高冷犯罪现场级纪实质感',
    '职场医疗写实风': '极度专业质感，无影冷白LED布光，不锈钢与晶莹玻璃反光，冷静、专业、克制简约，写实的高规格工业/职场设备细节',
    '青橙经典电影风': '经典青橙电影调色（Teal and Orange color scheme），冷色暗部（深蓝/青），暖色亮部（橙/金），强烈视觉对比，标准好莱坞大片影院质感',
    '莫兰迪写实质感风': '高级灰色调莫兰迪色系（Morandi palette），低饱和柔和灰色，温润哑面反射，柔和环境散溢光，宁静优雅极高级质感',
    '逆光唯美写实风': '梦幻唯美逆光（Rim lighting），金色太阳光晕（Lens flare），空气微尘，温暖金边勾勒主体边缘，柔美空灵的视觉质感',
    '丁达尔光束氛围风': '神圣丁达尔光束（God rays / Crepuscular rays），空气粒子感特写，强体积光，冷暗背景中投射出清晰温暖的光芒，极强氛围感',
    '雨夜城市情绪风': '雨夜城市街景，潮湿而反光的黑色柏油路，霓虹灯五彩斑斓的在地面融化倒影，空气中飘舞的水雾，极致忧郁寂静的情绪美感',
    '黄金时刻柔光风': '温暖夕阳落日时刻（Golden Hour），长长的金色拉伸投影，温暖的金黄橘红光芒笼罩，高光点缀，温馨唯美的光影变迁',
    '哥特暗黑写实风': '神秘阴郁哥特暗黑，高对比冷黑与猩红暗紫色调，古老繁复的木石雕刻，沉重阴森的建筑边缘，冷酷极致的暗黑美学叙事',
    '柯达复古胶片风': '经典柯达Kodachrome色调，浓郁饱满的暖红色、暖黄色调，高清晰度与细腻特有胶片颗粒，经典时代人文叙事记录感',
    '港式警匪黑帮风': '硬朗港式犯罪题材，高对比高反差偏绿/蓝色调，阴暗的小巷，霓虹灯下的追逐，真实的血汗尘土混合质感，具有生动的社会画幅质感',
    '韩式温情电影风': '首尔现代唯美色调，柔和低对比暖白，细腻无瑕 of 肤色质感，生活化明净温馨场景，柔焦高光，清纯而又治愈心灵的细腻情感表达',
    '日式静谧写实风': '典型的现代日系清新（Quiet Japanese aesthetic），微曝光，低饱和度，温润木质家具与暖白棉麻，柔和淡光，极其静谧自然的空灵感',
    '高对比戏剧光影风': '强烈的戏剧化光影舞台感，大反差单侧聚光灯（Spotlight），高光极其锐利，阴影极其深沉（Chiaroscuro shader），极高视觉对峙张力',
    '柔焦朦胧文艺风': '唯美复古柔焦散景（Dreamy soft focus style），朦胧柔滑，温暖环境散光，怀旧底蕴，梦境般不真实的文艺诗意',
    '墨西哥 / 拉美黑帮写实风': '经典高饱和炎热干热风格，明黄与土橙色调笼罩，刺眼强日光（Hard shadows），沙尘飘散，粗犷混凝土墙与生锈铁门，狂野张力',
    '加勒比阳光明亮风': '加勒比热带岛屿高亮明艳，蔚蓝晴空与明澈海水，椰林斑驳，浓烈的饱和绿与亮金阳光，度假愉悦明快的空气质感',
    '南美殖民复古风': '古朴复古殖民地建筑风，饱满的淡黄色/朱红色粉刷墙面，古老木雕门窗与铸铁围栏，温暖夕阳，充满历史印记的欧式古典与拉美野性融合',
    '拉美街头纪实风': '真实而热烈的拉美市井，低照度自然街灯，极度热闹浓烈的色彩交织，涂鸦砖墙，充满人烟气息的手持纪实摄影'
  };

  // 2. 长短匹配：整词完全匹配或包含匹配
  for (const [key, val] of Object.entries(styleMap)) {
    if (trimmed === key || trimmed.includes(key) || key.includes(trimmed)) {
      return val;
    }
  }

  // 3. 关键词段落替换字典（用于处理混合画风逗号分隔的场景，如 "虚幻引擎5渲染质感，好莱坞电影级调色，极简主义。"）
  const termMap: { [key: string]: string } = {
    '好莱坞电影级调色': '好莱坞级电影级青橙（Teal and Orange）调色（暗部呈稳重的冷青蓝色/深蓝色，而亮部如皮肤和火光呈温暖的橙色、金黄色，形成极佳冷暖色彩调子，具有极高动态范围与大片级宽色域影院调色）',
    '电影感调色': '电影级情绪调色（经典的数字影院青橘色调 Teal & Orange，高动态范围，高对比，柔和的高光阴影过渡）',
    '电影级调色': '经典青橙对比（Teal and Orange）调色，院线级大师级画面质感，高反差电影情绪色彩体系',
    '虚幻引擎5渲染质感': '三维物理渲染写实材质质感（物理反射与镜面漫折射，真实微观物理凹凸感，高精度流式阴影，顶级次表面介质光子反散射，完美呈现各种特殊材质极其逼真的真实表现）',
    '虚幻引擎5': '物理写实高精度三维渲染（高保真光线追踪，极其拟真的体积阴影与物理表面凹凸微粒细节）',
    '虚幻5': '超真实物理镜头摄影与材质折射渲染表现（真实的反射与环境遮挡阴影，极致表面纹路，顶级纯正实感表现）',
    '极简主义': '极简主义视觉构图（大面积高级留白空间，干净利落的极简几何造型与环境线条，色彩克制典雅，剔除一切杂乱视觉干扰）',
    'Octane渲染质感': 'Octane Render大师级写实渲染（极精细的物理折射、金属漫反射与SSS次表面散射半透明材质，棚拍般晶莹剔透的高反差美感）',
    'Octane渲染': 'Octane Render高品质渲染质感（写实高精度物理质感，逼真的漫反射与微观材质表现）',
    '超写实': '极致超写实表现（True-to-life hyperrealism, 显微级别的微小细节纹理，毫无任何人工渲染虚幻质感）',
    '胶片颗粒': '35mm经典电影胶片颗粒模拟（逼真的模拟卤化银颗粒底噪，温暖而具有情绪厚重感的复古胶片光影）'
  };

  // 按照中英文常见分隔符拆分
  const segments = trimmed.split(/[，,。、；;|\s+]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  if (segments.length > 1) {
    const expandedSegments = segments.map(segment => {
      // 遍历 termMap 匹配当前成分
      for (const [key, value] of Object.entries(termMap)) {
        if (segment.includes(key) || key.includes(segment)) {
          return value;
        }
      }
      return segment;
    });
    return expandedSegments.join('，');
  }

  // 单一词匹配备用
  for (const [key, value] of Object.entries(termMap)) {
    if (trimmed.includes(key) || key.includes(trimmed)) {
      return value;
    }
  }

  return trimmed;
};

