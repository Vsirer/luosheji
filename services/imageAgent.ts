import { SmartImageConfig, SmartImageResult, Config, Asset } from "../types";
import { BaseAgent } from "./baseAgent";
import { urlToBase64 } from "./utils";
import { SHARED_ASSET_RULES } from "./rules";

export const IMAGE_AGENT_SYSTEM_INSTRUCTION = `
你是 **绘智 (Smart Image) 创意绘图智能体**。你是一位精通各种画风、构图和光影的 **顶级视觉艺术家**。
你的目标是：根据用户的描述，创作出极具美感、细节丰富且符合物理规律的视觉作品。

一、核心能力
1. **风格提取与迁移 (Style Extraction & Transfer)**：你会深度分析用户提供的参考图（图1、图2等），提取其核心视觉风格（如：画风、光影氛围、色彩倾向、笔触质感等），并将其作为后续生成任务的基准风格。
2. **动态资产分析 (Dynamic Asset Analysis)**：在进行分镜设计时，你会首先深度分析用户提供的剧本，识别出所有出现的角色、核心场景和关键道具。
3. **忠实创作**：除非用户明确要求，否则请**严格遵循**用户的原始提示词，不要擅自增加或修改细节。如果用户提示词简略，请保持简洁，不要过度发散。
4. **多维视角**：你擅长从不同角度（俯拍、仰拍、侧拍）和不同焦距（广角、长焦、微距）来表现主体。
5. **分镜叙事**：在 9 宫格模式下，你能确保 9 个画面在视觉风格、角色形象和场景氛围上保持高度一致，并形成连贯的叙事逻辑。

${SHARED_ASSET_RULES}

三、资产绑定与生成规则（极其重要）
- **风格一致性**：生成的 9 宫格分镜必须与参考图展现的视觉风格保持高度统一。
- **灵活绑定**：用户提供的参考图会被标记为“图1”、“图2”等。
- **自主生成**：对于剧本中出现但用户**未提供**参考图的资产，你必须发挥你的艺术造诣，为它们生成一套**详细且具有高度一致性**的视觉描述（包括面部特征、发型、服装配色及 Hex 颜色代码），且这些描述必须符合提取出的基准风格。
- **强制一致性**：一旦资产（无论是绑定的还是自主生成的）在第一格确定，后续所有分镜必须保持 100% 的视觉一致性。

四、输出规范
- 你的回复应该是纯净的提示词描述，或者是符合要求的 JSON 格式。
- 严禁包含任何元描述或解释性文字。
`;

export class ImageAgent extends BaseAgent {
  private getNumericSize(q: string, aspect: string, isGemini: boolean = false) {
    const quality = (q || '').toLowerCase();
    
    // For Gemini/Imagen models, we use standardized HD/Ultra resolutions
    if (quality === '4k' || quality === 'ultra') {
      if (aspect === '9:16' || aspect === '2:3' || aspect === '3:4') return '2160x3840';
      if (aspect === '16:9' || aspect === '3:2' || aspect === '4:3' || aspect === '21:9') return '3840x2160';
      if (aspect === '1:1') return '2048x2048';
      return '3840x2160';
    }
    if (quality === '2k' || quality === 'high') {
      if (aspect === '16:9' || aspect === '3:2' || aspect === '4:3' || aspect === '21:9') return '2048x1152';
      if (aspect === '1:1') return '2048x2048';
      if (aspect === '9:16' || aspect === '2:3' || aspect === '3:4') return '2160x3840';
      return '2048x1152';
    }
    // Standard 1K/HD fallback
    if (aspect === '1:1') return '1024x1024';
    if (aspect === '16:9' || aspect === '3:2' || aspect === '4:3' || aspect === '21:9') return '1536x1024';
    if (aspect === '9:16' || aspect === '2:3' || aspect === '3:4') return '1024x1536';
    return '1024x1024';
  }

  public async generateSmartImage(imageConfig: SmartImageConfig, config?: Config): Promise<SmartImageResult> {
    // Robustly preprocess prompt to extract actual text if a JSON block, array, or structured prompt was passed downstream
    let finalPrompt = imageConfig.prompt || '';
    const trimmedPrompt = finalPrompt.trim();
    if (
      trimmedPrompt.startsWith('{') || 
      trimmedPrompt.startsWith('[') || 
      trimmedPrompt.includes('```') || 
      trimmedPrompt.includes("'''") || 
      trimmedPrompt.includes('"""')
    ) {
      try {
        let cleanText = trimmedPrompt;
        
        // 1. Match code blocks of any style (```, ''', or """)
        const codeBlockMatch = cleanText.match(/(?:```|'''|""")(?:json)?\s*([\s\S]*?)\s*(?:```|'''|""")/i);
        if (codeBlockMatch && codeBlockMatch[1]) {
          cleanText = codeBlockMatch[1].trim();
        } else {
          // 2. Fallback: Find first curly brace or square bracket and last corresponding closer to isolate JSON substring
          const firstBrace = cleanText.indexOf('{');
          const firstBracket = cleanText.indexOf('[');
          let startIndex = -1;
          let endIndex = -1;
          
          if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            startIndex = firstBrace;
            endIndex = cleanText.lastIndexOf('}');
          } else if (firstBracket !== -1) {
            startIndex = firstBracket;
            endIndex = cleanText.lastIndexOf(']');
          }
          
          if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            cleanText = cleanText.substring(startIndex, endIndex + 1).trim();
          }
        }

        let parsed = null;
        let isJson = false;
        try {
          parsed = JSON.parse(cleanText);
          isJson = true;
        } catch (je) {
          console.warn(`[ImageAgent] JSON.parse failed during preprocessing. cleanText was:`, cleanText, je);
        }

        if (isJson && parsed) {
          if (Array.isArray(parsed)) {
            // If it's an array of scenes/prompts, extract from each element and join them
            const prompts = parsed.map(item => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object') {
                return item.prompt || item.Prompt || 
                       item.description || item.Description || 
                       item.scene_description || item.sceneDescription || 
                       item.image_prompt || item.imagePrompt ||
                       item.visual_description || item.visualDescription ||
                       item.content || item.Content;
              }
              return '';
            }).filter(Boolean);

            if (prompts.length > 0) {
              finalPrompt = prompts.join('\n');
              imageConfig.prompt = finalPrompt;
              console.log(`[ImageAgent] Successfully extracted prompts from JSON Array (length: ${parsed.length}):`, finalPrompt);
            }
          } else if (typeof parsed === 'object') {
            const extractedPrompt = parsed.prompt || parsed.Prompt || 
                                    parsed.instruction || parsed.Instruction || 
                                    parsed.description || parsed.Description || 
                                    parsed.scene_description || parsed.sceneDescription ||
                                    parsed.image_prompt || parsed.imagePrompt ||
                                    parsed.visual_description || parsed.visualDescription ||
                                    parsed.content || parsed.Content;
            if (extractedPrompt && typeof extractedPrompt === 'string') {
              finalPrompt = extractedPrompt;
              imageConfig.prompt = finalPrompt;
              console.log(`[ImageAgent] Successfully extracted prompt from JSON Object:`, finalPrompt);
            }

            // Also check for nested arrays of scenes or storyboard frames
            const possibleArrayKeys = ['scenes', 'storyboard', 'panels', 'segments', 'variants', 'list'];
            for (const key of possibleArrayKeys) {
              if (Array.isArray(parsed[key])) {
                const nestedPrompts = parsed[key].map((item: any) => {
                  if (typeof item === 'string') return item;
                  if (item && typeof item === 'object') {
                    return item.prompt || item.Prompt || 
                           item.description || item.Description || 
                           item.scene_description || item.sceneDescription || 
                           item.image_prompt || item.imagePrompt ||
                           item.visual_description || item.visualDescription ||
                           item.content || item.Content;
                  }
                  return '';
                }).filter(Boolean);
                if (nestedPrompts.length > 0) {
                  finalPrompt = nestedPrompts.join('\n');
                  imageConfig.prompt = finalPrompt;
                  console.log(`[ImageAgent] Successfully extracted nested prompts from key "${key}":`, finalPrompt);
                  break;
                }
              }
            }

            if (parsed.aspectRatio || parsed.aspect_ratio || parsed["Aspect Ratio"]) {
              imageConfig.aspectRatio = parsed.aspectRatio || parsed.aspect_ratio || parsed["Aspect Ratio"];
            }
            if (parsed.negativePrompt || parsed.negative_prompt || parsed["Negative Prompt"]) {
              imageConfig.negativePrompt = parsed.negativePrompt || parsed.negative_prompt || parsed["Negative Prompt"];
            }
          }
        } else {
          // If JSON parsing was unsuccessful, perform regex extraction of common keys
          const regexes = [
            /"(?:prompt|Prompt|instruction|Instruction|description|Description|scene_description|sceneDescription|image_prompt|imagePrompt|visual_description|visualDescription)"\s*:\s*"((?:[^"\\]|\\.)*)"/g,
          ];
          const extractedTexts: string[] = [];
          for (const regex of regexes) {
            let match;
            while ((match = regex.exec(finalPrompt)) !== null) {
              if (match[1]) {
                extractedTexts.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'));
              }
            }
          }
          if (extractedTexts.length > 0) {
            finalPrompt = extractedTexts.join('\n');
            imageConfig.prompt = finalPrompt;
            console.log(`[ImageAgent] Successfully extracted prompt text via regex fallbacks:`, finalPrompt);
          }
        }
      } catch (e) {
        console.warn(`[ImageAgent] Failed to preprocess structured prompt, falling back to original:`, e);
      }
    }

    const aspectSuffix = imageConfig.aspectRatio && imageConfig.aspectRatio !== '1:1' 
      ? `\nAspect Ratio: ${imageConfig.aspectRatio}` 
      : '';
    
    const quality = (imageConfig.imageSize || 'auto').toLowerCase();
    const aspectRatio = imageConfig.aspectRatio || '1:1';
    
    const is4K = quality === '4k' || quality === 'ultra' || (typeof quality === 'string' && (quality.includes('4096') || quality.includes('4k')));
    const is2K = quality === '2k' || quality === 'high' || (typeof quality === 'string' && (quality.includes('2048') || quality.includes('2k')));

    const referenceImages = [...(imageConfig.referenceImages || [])];

    let targetModel = imageConfig.model || 'gemini-3.1-flash-image-preview';
    if (targetModel.startsWith('gpt-image-2') && referenceImages.length > 0) {
      console.log(`[ImageAgent] Detected 'gpt-image-2' with ${referenceImages.length} reference images. GPT models do not support image-to-image/multi-image reference. Automatically routing to 'gemini-3.1-flash-image-preview' (nano banana 2) to achieve high-quality reference and style transfer.`);
      targetModel = 'gemini-3.1-flash-image-preview';
    }

    const isHighRes = is4K || is2K;
    if (isHighRes && (targetModel.includes('gpt') && !targetModel.startsWith('gpt-image-2'))) {
      targetModel = 'gemini-3.1-flash-image-preview';
    }
    const isGemini = targetModel.toLowerCase().includes('gemini');
    
    const numericSize = this.getNumericSize(quality, aspectRatio, isGemini);

    const qualitySuffix = is4K
      ? '\nQuality: 4K Ultra High Definition (4096x4096 pixels), extremely detailed, cinematic 4K resolution, masterwork, highly intricate details' 
      : (is2K ? '\nQuality: 2K High Definition (2048x2048 pixels), extremely detailed, high resolution, sharp focus' : '');
    
    const isDesaturatedOnPurpose = /(黑白|单色|灰度|极简灰|画素|素描|black and white|monochrome|grayscale|sketch|retro grayish|low saturation style)/i.test(imageConfig.prompt);
    
    let parts: any[];
    if (isDesaturatedOnPurpose) {
      parts = [{ text: imageConfig.prompt + aspectSuffix + qualitySuffix }];
      if (imageConfig.negativePrompt) {
        parts.push({ text: `\nNegative Prompt: ${imageConfig.negativePrompt}` });
      }
    } else {
      const defaultNegative = "gray, grayish, desaturated, washed-out, muddy, dusty, foggy, hazy, gloomy, low contrast, low saturation, draft, blurry, bad quality, dim, overcast";
      const mergedNegative = imageConfig.negativePrompt 
        ? `${imageConfig.negativePrompt}, ${defaultNegative}`
        : defaultNegative;
      
      const vibrancyEnhancer = "\n【画面色彩与高光阴影强化】：强烈要求生成极具立体感、高对比度的画面，阴影深邃，高光通透，色彩丰富饱满且真实。绝对严禁输出色彩昏暗、灰蒙蒙、低饱和度、偏灰、多雾气多霾（grayish, muddy, dusty, foggy, hazy, washed-out, overcast）的低质量及灰暗作品。画面整体色调应呈现高级且动人的高保真画面，突出主体细节和真实的材质反光与色彩饱和度。";
      
      parts = [{ text: imageConfig.prompt + aspectSuffix + qualitySuffix + vibrancyEnhancer }];
      parts.push({ text: `\nNegative Prompt: ${mergedNegative}` });
    }
    
    // Detect explicit character/scene bindings in the prompt
    // Format: "图1=@Wang Wei", "图1 @Wang Wei", "Wang Wei=@图1"
    const explicitBindings: { name: string; index: number }[] = [];
    const bindingRegex = /(?:([^\s=@]+)=@|@(图|历史图)(\d+)\s*=@\s*)([^\s=@]+)|@(图|历史图)(\d+)\s+@([^\s=@]+)/g;
    let bMatch;
    while ((bMatch = bindingRegex.exec(imageConfig.prompt)) !== null) {
      let name = '';
      let index = -1;
      if (bMatch[1] && bMatch[4] && bMatch[4].includes('图')) {
        name = bMatch[1];
        index = parseInt(bMatch[4].replace(/\D/g, '')) - 1;
      } else if (bMatch[2] && bMatch[4]) {
        index = parseInt(bMatch[3]) - 1;
        name = bMatch[4];
      } else if (bMatch[5] && bMatch[7]) {
        index = parseInt(bMatch[6]) - 1;
        name = bMatch[7];
      }
      if (index >= 0 && index < referenceImages.length) {
        explicitBindings.push({ name, index });
      }
    }
    
    if (referenceImages.length > 0) {
      for (let idx = 0; idx < referenceImages.length; idx++) {
        const ref = referenceImages[idx];
        let base64Data = ref.data;
        let mimeType = ref.mimeType;
        
        if (base64Data.startsWith('blob:') || base64Data.startsWith('/') || (base64Data.startsWith('http') && !base64Data.includes('data:'))) {
          try {
            const res = await urlToBase64(base64Data);
            base64Data = res.base64;
            mimeType = res.mimeType;
          } catch (e) {
            console.error(`Failed to convert reference image ${idx + 1} to base64:`, e);
            continue;
          }
        } else if (base64Data.startsWith('data:')) {
          const [mimePart, b64] = base64Data.split(',');
          mimeType = mimePart.split(':')[1].split(';')[0];
          base64Data = b64;
        }

        if (base64Data.startsWith('blob:') || base64Data.startsWith('http') || (base64Data.startsWith('/') && base64Data.length < 500)) {
          continue;
        }

        // Determine type, check explicit bindings first
        const binding = explicitBindings.find(b => b.index === idx);
        let type = binding ? 'character' : (ref.type as string);
        const name = binding ? binding.name : '';

        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
        parts.push({ text: `\n@图${idx + 1} (${name ? `${name}` : `Ref Image ${idx + 1}`}, type: ${type})` });
        
        if (type === 'character') {
          parts.push({ text: `\n【核心指令】：此图（图${idx + 1}${name ? ` - ${name}` : ''}）为角色基因参考。请深度分析并提取该角色的面部特征（五官形状、比例、眼神）、发型、体型。
【极其重要】：
1. **视觉一致性**：在不冲突的前提下，必须保持五官比例和神态与参考图（图${idx + 1}）高度一致，确保是同一个角色${name ? `（${name}）` : ''}的不同表现。
2. **提示词绝对优先**：如果提示词中明确要求改变角色的核心特征（如人种、国籍、肤色、年龄感、性别等），请【完全忽略】参考图中的对应特征，并严格遵循提示词。
3. **细节变化**：仅根据提示词改变服装、动作、视角 or 环境。` });
        } else if (type === 'environment') {
          parts.push({ text: `\n【核心指令】：此图为环境/场景参考。请深度分析并提取该场景的建筑风格、空间布局、核心物件、色调氛围。生成的结果（如布局图、四向图等）必须在视觉元素和空间逻辑上与此图保持高度一致，确保是同一个地点的不同表现形式。` });
        } else if (type === 'prop') {
          parts.push({ text: `\n【核心指令】：此图为道具/物体参考。请深度分析并提取该道具的材质、结构、光影、细节特征。生成的结果（如六视图、细节图等）必须在视觉上与此图保持 100% 的一致性。如果文字描述与此图冲突，必须【完全以此图为准】。` });
        }
      }
    }

    const aspectInst = imageConfig.aspectRatio ? `\n- **比例要求**：必须严格按照 ${imageConfig.aspectRatio} 的比例生成。` : '';
    const colorContrInst = isDesaturatedOnPurpose ? "" : "\n2. **色彩与对比度强化**：请生成对比度高、色彩饱满艳丽、光影通透的高清大片，严禁生成色彩灰暗、灰蒙蒙、偏灰、多雾、低饱和度（washed-out / desaturated / grayish）的低质量及灰暗图片。";
    parts.push({ text: `\n\n【最终指令】：请严格遵循上述提示词（Prompt）中心思想，并融入以下技术规范：\n"${imageConfig.prompt}"${qualitySuffix}\n【极其重要】：
1. 如果提示词与参考图（Reference Images）在任何视觉特征（包括但不限于人种、国籍、肤色、年龄感、性别、发色、发型、面部特征、体型、服装等）上存在任何冲突，必须【完全以提示词为准】。${aspectInst}${colorContrInst}` });

    let resolvedImageSize = numericSize;
    if (isGemini) {
      if (is4K) {
        resolvedImageSize = '4K';
      } else if (is2K) {
        resolvedImageSize = '2K';
      } else if (quality === '512px') {
        resolvedImageSize = '512px';
      } else {
        resolvedImageSize = '1K';
      }
    }

    const body: any = {
      model: targetModel,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: IMAGE_AGENT_SYSTEM_INSTRUCTION,
        seed: imageConfig.seed,
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: resolvedImageSize
        }
      }
    };

    if (targetModel?.startsWith('gpt-image-2')) {
      body.prompt = imageConfig.prompt;
      body.size = imageConfig.gptSize || 'auto';
      // Map 2k/4k back to 'high' for standard API compatibility, keeping UI specs separate
      body.quality = (imageConfig.gptQuality === '4k' || imageConfig.gptQuality === '2k') ? 'high' : (imageConfig.gptQuality || 'auto');
      body.format = imageConfig.gptFormat || 'png';
    }

    if (imageConfig.searchQuery) {
      body.config.tools = [{
        googleSearch: {
          searchTypes: {
            webSearch: {},
            imageSearch: {}
          }
        }
      }];
      parts.push({ text: `\nSearch Query: ${imageConfig.searchQuery}` });
    }

    console.log(`[DEBUG] generateSmartImage: model=${body.model}, imageSize=${body.config.imageConfig.imageSize}, aspectRatio=${aspectRatio}`);

    try {
      const response = await this.callApi('image', 'generateContent', body, config);
      
      let imageUrl = '';
      let revisedPrompt = '';

      if (response.images?.[0]?.url) {
        imageUrl = response.images[0].url;
        revisedPrompt = response.images[0].revisedPrompt || response.images[0].revised_prompt || '';
      } else if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          } else if (part.text) {
            revisedPrompt += part.text;
          }
        }
      }

      if (!imageUrl) {
        console.error("Image generation failed. Response:", JSON.stringify(response, null, 2));
        const finishReason = response.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY') {
          throw new Error("生图失败：内容被安全过滤器拦截。请尝试修改提示词。");
        } else if (finishReason === 'RECITATION') {
          throw new Error("生图失败：内容涉及版权保护。请尝试修改提示词。");
        } else if (revisedPrompt) {
          throw new Error(`生图失败：模型仅返回了文本描述："${(revisedPrompt || '').substring(0, 100)}..."`);
        }
        throw new Error("生图失败：模型未返回图片数据。");
      }

      return { imageUrl, revisedPrompt: (revisedPrompt || '').trim() };
    } catch (e) {
      console.error("Smart Image Generation failed:", e);
      throw e;
    }
  }

  public async generateCharacterVariants(script: string, characterName: string, visualStyle?: string, config?: Config, mainImageUrl?: string, mainPrompt?: string): Promise<any[]> {
    const prompt = `你是一位资深美术指导。请为剧本中的角色“${characterName}”设计 4 个不同的视觉变体。
【极其重要】：
1. **变装核心**：变体主要用于“变装”场景（不同服装、不同发型、不同状态）。
2. **输出格式（新规）**：每个变体的 prompt 必须严格遵循以下“三行式”极简格式，严禁使用长篇大论：
   **角色基准：** [简要描述角色核心特征，如：${characterName}，金发白人女性，淡妆]
   **变装内容：** [具体描述本次变装的服装、配饰、发型变化]
   **画面规格：** [全身照，纯白背景，单人]
3. **语言要求**：变体名称 (name) 和 提示词 (prompt) 均使用中文。
4. **严禁包含表情变化**，所有变体应保持与主图一致的神态。
5. **基因绑定**：所有变体必须在面部特征、五官比例上与参考图保持高度一致，仅改变服装、配饰或环境。

画风设定：${visualStyle || '写实风格'}

角色主提示词参考：
${mainPrompt || '无'}

剧本背景：
${(script || '').substring(0, 5000)}

请返回 JSON 格式：
{
  "variants": [
    { "id": "v1", "name": "变装：变体名称", "prompt": "**角色基准：** [描述]\\n**变装内容：** [描述]\\n**画面规格：** [描述]" }
  ]
}`;

    const parts: any[] = [{ text: prompt }];
    if (mainImageUrl) {
      let base64Data = mainImageUrl;
      let mimeType = 'image/png';

      if (base64Data.startsWith('blob:') || base64Data.startsWith('/') || (base64Data.startsWith('http') && !base64Data.includes('data:'))) {
        try {
          const res = await urlToBase64(mainImageUrl);
          base64Data = res.base64;
          mimeType = res.mimeType;
        } catch (e) {
          console.error("Failed to convert mainImageUrl to base64:", e);
        }
      } else if (base64Data.startsWith('data:')) {
        const [mimePart, b64] = base64Data.split(',');
        mimeType = mimePart.split(':')[1].split(';')[0];
        base64Data = b64;
      }
      
      // Only add as inlineData if it's actually base64 (not a URL)
      if (base64Data && !base64Data.startsWith('blob:') && !base64Data.startsWith('http') && !(base64Data.startsWith('/') && base64Data.length < 500)) {
        parts.push({ inlineData: { data: base64Data, mimeType } });
      } else {
        // Fallback to text reference if base64 conversion failed but we have a URL
        parts.push({ text: `\n【核心基因参考图】：${mainImageUrl}` });
      }
      parts.push({ text: `\n【核心指令】：
1. 请深度分析参考图中的角色特征（面部、发型、体型、人种、年龄感）。
2. 在设计变装时，必须 100% 继承这些核心特征。
3. 如果剧本中的文字描述与参考图的视觉特征存在冲突（例如剧本说 60 岁但图里是 20 岁），请以【参考图】为准。
4. 变装仅限于：服装款式、配色、配饰、环境背景及光影。` });
    }

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.7
        }
      }, config);
      const data = this.extractJson(response.text, { variants: [] });
      return data.variants || [];
    } catch (e) {
      console.error("Generate variants failed:", e);
      return [];
    }
  }

  public async generateSixView(asset: Asset, referenceImageUrl: string, config?: Config, variantId?: string): Promise<SmartImageResult> {
    const variant = variantId ? asset.variants?.find(v => v.id === variantId) : null;
    const secondaryPrompt = variant ? (variant.secondaryPrompt || variant.prompt) : (asset.subAssets.secondaryPrompt || asset.subAssets.mainPrompt);

    const prompt = `你是一位角色设计师。请【深度分析并提取】参考图（@图1 主体立绘）中的所有视觉基因（面部特征、五官比例、发型、体型、服装款式、材质感）。
【极其重要】：
1. **视觉一致性**：生成的六视图必须与参考图（@图1 主体立绘）在视觉上 100% 一致。严禁根据文字描述改变参考图中已确定的长相、身材或服装。
2. **布局规范**：生成专业角色设定图 (Character Sheet) 与角色转面图 (Turnaround)。图片布局严格分为上下两层：上层为该角色的半身三视图（正面、侧面、背面）；下层为该角色的全身三视图（正面、侧面、背面）。
3. **画风设定**：**电影级写实质感**，真实摄影质感，影棚拍摄，专业摄影大师作品。严禁生成 2D 插画、漫画或 3D 渲染感。
4. **环境设定**：纯灰色背景 (#808080)，无阴影，平光照明，角色正交视角 (Orthographic)，影棚拍摄，带有中文设计标注文字，左上角标注“姓名：”。
5. **提示词冲突处理**：如果下方的“参考描述”与“参考图”存在任何冲突，请【完全以参考图为准】。

【参考描述（仅供风格参考）】：${secondaryPrompt || ''}`;

    return this.generateSmartImage({
      prompt,
      aspectRatio: '9:16',
      imageSize: '2K',
      referenceImages: [{
        data: referenceImageUrl,
        mimeType: 'image/png',
        type: 'character'
      }]
    }, config);
  }

  public async generatePropSixView(asset: Asset, referenceImageUrl: string, config?: Config): Promise<SmartImageResult> {
    const secondaryPrompt = asset.subAssets.secondaryPrompt || asset.subAssets.mainPrompt;
    const prompt = `你是一位道具设计师。请【深度分析并提取】参考图（@图1 主体立绘）中的所有视觉细节（材质、结构、光影、细节）。
【极其重要】：
1. **视觉一致性**：生成的六视图必须与参考图（@图1 主体立绘）在视觉上 100% 一致。严禁根据文字描述改变参考图中已确定的形态 or 材质。
2. **布局规范**：在一张图片中展示该道具的六个主要正交角度（正面、背面、左侧、右侧、顶部、底部）。
3. **环境设定**：纯白背景，无阴影，影棚拍摄，影棚摄影质感，高清细节。
4. **提示词冲突处理**：如果下方的“参考描述”与“参考图”存在任何冲突，请【完全以参考图为准】。

【参考描述（仅供风格参考）】：${secondaryPrompt || ''}`;

    return this.generateSmartImage({
      prompt,
      aspectRatio: '9:16',
      imageSize: '2K',
      referenceImages: [{
        data: referenceImageUrl,
        mimeType: 'image/png',
        type: 'prop'
      }]
    }, config);
  }

  public async analyzeImage(imageUrl: string, prompt: string, config?: Config): Promise<any> {
    let base64Data = imageUrl;
    let mimeType = 'image/png';

    if (imageUrl.startsWith('blob:') || imageUrl.startsWith('/') || (imageUrl.startsWith('http') && !imageUrl.includes('data:'))) {
      const res = await urlToBase64(imageUrl);
      base64Data = res.base64;
      mimeType = res.mimeType;
    } else if (imageUrl.startsWith('data:')) {
      const [mimePart, b64] = imageUrl.split(',');
      mimeType = mimePart.split(':')[1].split(';')[0];
      base64Data = b64;
    }

    const parts = [
      { text: prompt },
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ];

    const result = await this.callApi('image', 'generateContent', {
      contents: [{ parts }]
    }, config);
    
    return result;
  }
}

export const imageAgent = new ImageAgent();
