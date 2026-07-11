import { PipelineData, Asset, Segment, Config, ScriptAnalysis } from "../../types";
import { BaseAgent } from "./baseAgent";
import { SHARED_ASSET_RULES } from "../../services/rules";
import { urlToBase64 } from "../../services/utils";

export const AI_DRAMA_AGENT_SYSTEM_INSTRUCTION = `
你是一位世界级的顶级“AI短剧智能体”（AI Drama Agent），融合了资深短剧导演与顶尖美术指导的灵魂。你的核心使命是深度解析短剧剧本，精准提取核心资产（角色及变装、场景、道具），并将其转化为视觉冲击力极强、人物神态极其生动、时长受控的专业短剧分镜脚本。

## 一、 资产提取与生成硬规则
当扫描剧本提取资产时，你必须严格遵循以下原则：
1. **资产分类**：
   - **角色 (Character)**：提取剧本中的核心角色。同一个角色在不同场景中的变化（如变装、换衣服、战损等）必须作为该角色的 \`variants\` 变体记录，绝对禁止作为独立角色拆分！
   - **场景 (Scene)**：提取发生故事的主要空间场景。
   - **道具 (Prop)**：提取具有关键叙事功能的物件。
2. **提示词格式**：
   - 资产名称必须与剧本主语言一致。
   - 资产的视觉细节描述 (details) 和提示词 (subAssets) **必须且只能统一使用中文描述**，以实现最佳的图像生成质量。
   - 严禁在资产提示词中使用英文占位标签（如 masterpiece, best quality ），必须使用具体的物理光影、材质和构图描述。
3. **功能裁剪**：
   - 只需提取最基础、实用的核心角色主图、场景图和道具图提示词。
   - 严禁在此生成任何三视图、六视图、角色设定图、720全景图或场景布局图等复杂图例（这些已由其他专业Skill完成）。

## 二、 镜头分镜脚本生成规则（核心灵魂）
将剧本拆解为分段分镜脚本时，必须遵循以下规则：
1. **时间轴控制**：每个分段（Segment）通常为 15 秒（若启用灵活时长则为 4-15 秒），每个分段内所有镜头的时间戳之和必须精确等于该段定义的总时长。
2. **排版格式 (每镜换行另起一行)**：
   - 为了极佳的可读性，每段分镜内，**每一个镜头必须换行独占一行**！新镜头另起一行（使用 \\n 分隔），绝不可连段。
   - **场景定位声明**：每一个段落的镜头序列开头，或者当空间场景切换时，必须单独新起一行书写场景锁定声明：\`场景：场景名=@场景N\`（导演模式下写为\`场景：场景名\`），以此明确镜头的空间定位。这一行必须是独立的，不能与镜头时间戳写在同一行。
   - **镜头行格式**：\`开始秒-结束秒s（景别、拍摄距离、拍摄方位与角度、运镜）：描述\`。
3. **内容密度与逻氏微表情演算法 (LuoDesign)**：
   - **禁止使用抽象情绪词**（如“愤怒”、“悲伤”、“开心”）。所有情感表达一律通过面部微肌肉变化、视线轨迹、身体重心及生理应激反应来呈现。
   - **五维微表情描写**：
     - *微表情与视线*：瞳孔微缩、下颌收紧、视线失焦或重新聚焦。
     - *肢体与重心*：重心随情绪缓急而偏移、肩膀或面部自然的呼吸起伏。
     - *动作中间态*：捕捉欲言又止、转身半滞、手在半空微顿的未完成瞬间。
     - *生理应激*：喉结滑动、鼻翼翕张、面部在隐忍下有微颤。
     - *光影呼吸*：人物微弱动作及呼吸，带动脖颈、面部阴影产生实时的、细腻的明暗漂移。
   - **绝对禁用代词**：严禁使用“他、她、它、他们”，必须使用具体的角色名称（如“林峰”），确保画面视觉描述绝无歧义。
   - **台词格式**：角色台词用 \`角色名：“台词”\` 包裹，关键音效用 \`[SFX: 音效名]\` 标注。
   - **强制后缀**：每段提示词最后一行必须是且只能是：\`无字幕，无背景音乐\`。
`;

export const DIRECTOR_AGENT_SYSTEM_INSTRUCTION = AI_DRAMA_AGENT_SYSTEM_INSTRUCTION;

export class AiDramaAgent extends BaseAgent {
  public getAssetDisplayId(id: string, type: string, assetsList: Asset[]): string {
    if (!id) return id;
    
    let cleanId = id;
    while (cleanId && typeof cleanId === 'string' && cleanId.startsWith('@')) {
      cleanId = cleanId.slice(1);
    }
    
    const filtered = assetsList.filter(a => a.type === type);
    
    const isSecondary = cleanId.endsWith('_v');
    let tempId = cleanId;
    if (isSecondary) tempId = cleanId.slice(0, -2);
    
    const isVariant = tempId && typeof tempId === 'string' && tempId.includes('_v') && !tempId.startsWith('图') && !tempId.startsWith('场景') && !tempId.startsWith('道具');
    let realId = tempId;
    let variantId = '';
    if (isVariant) {
      const parts = tempId.split('_v');
      realId = parts[0];
      variantId = parts[1];
    }
    
    const index = filtered.findIndex(a => a.id === realId);
    if (index === -1) return cleanId;
    
    const prefix = type === 'character' ? '图' : type === 'scene' ? '场景' : '道具';
    let displayId = `${prefix}${index + 1}`;
    
    if (isVariant) displayId += `_v${variantId}`;
    if (isSecondary) displayId += '_v';
    
    return displayId;
  }

  private findAssetByDisplayId(displayId: string, type: string, allAssets: Asset[]): Asset | undefined {
    if (!displayId) return undefined;
    const filtered = allAssets.filter(a => a.type === type);
    
    let asset = allAssets.find(a => a.id === displayId);
    if (asset) return asset;
    
    const prefix = type === 'character' ? '图' : type === 'scene' ? '场景' : '道具';
    if (displayId && typeof displayId === 'string' && (displayId.startsWith(prefix) || displayId.startsWith('角色'))) {
      const match = displayId.match(/^(?:图|角色|场景|道具)(\d+)/);
      if (match) {
        const index = parseInt(match[1]) - 1;
        if (index >= 0 && index < filtered.length) {
          return filtered[index];
        }
      }
    }
    
    return undefined;
  }

  public cleanPromptText(text: string): string {
    if (!text) return text;

    let cleaned = text.trim();

    if (cleaned && typeof cleaned === 'string' && (cleaned.includes('"prompt":') || cleaned.includes('"segments":'))) {
      try {
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          const jsonStr = cleaned.substring(start, end + 1);
          const json = JSON.parse(jsonStr);
          if (json.prompt) {
            cleaned = json.prompt;
          } else if (json.segments && Array.isArray(json.segments) && json.segments[0]?.prompt) {
            cleaned = json.segments[0].prompt;
          } else if (json.segments && typeof json.segments === 'object' && !Array.isArray(json.segments)) {
            const firstKey = Object.keys(json.segments)[0];
            if (json.segments[firstKey]?.prompt) cleaned = json.segments[firstKey].prompt;
          }
        }
      } catch (e) {}
    }

    cleaned = cleaned
      .replace(/\{[\s\S]*?"(segment_id|prompt|assets|id|index|duration)"[\s\S]*?\}/g, '')
      .replace(/\[\s*\{[\s\S]*?"(segment_id|prompt|assets|id|index|duration)"[\s\S]*?\}\s*\]/g, '')
      .replace(/,\s*\{\s*"(segment_id|prompt|assets|id|index|duration)"[\s\S]*?$/g, '')
      .replace(/^[\s\S]*?\{\s*"(segment_id|prompt|assets|id|index|duration)"\s*:\s*/g, '')
      .replace(/["']?(segment_id|prompt|assets|id|index|duration)["']?\s*:\s*/g, '')
      .replace(/[{}\[\]]/g, '')
      .replace(/"/g, '');

    cleaned = cleaned
      .replace(/【空间结构】[^。！？\n]*[。！？\n]/g, '')
      .replace(/\((图|场景|道具)\d+.*?\)/g, '')
      .replace(/\((char|scene|prop)_\w+\)/g, '')
      .replace(/--ar\s+\d+:\d+/g, '')
      .replace(/--v\s+\d+(\.\d+)?/g, '')
      .replace(/--stylize\s+\d+/g, '')
      .replace(/--s\s+\d+/g, '')
      .replace(/--chaos\s+\d+/g, '')
      .replace(/--tile/g, '')
      .replace(/--quality\s+\d+/g, '')
      .replace(/--q\s+\d+/g, '')
      .replace(/--seed\s+\d+/g, '')
      .replace(/--stop\s+\d+/g, '')
      .replace(/--video/g, '')
      .replace(/--repeat\s+\d+/g, '')
      .replace(/--no\s+[\w\s,]+/g, '')
      .replace(/8K分辨率/g, '')
      .replace(/4K分辨率/g, '');

    cleaned = cleaned.replace(/#\w{6}/g, '');

    return cleaned.trim();
  }

  public fuzzyBindAssets(data: any): PipelineData {
    if (Array.isArray(data)) {
      data = { segments: data, assets: [] };
    }

    if (!data.segments) return data;
    if (!data.assets) data.assets = [];

    if (typeof data.segments === 'string' && (data.segments.includes('[新起 镜头]') || data.segments.includes('[承接 尾帧'))) {
      const parsed = this.parseTextSegments(data.segments);
      data.segments = parsed.segments;
    }

    if (!Array.isArray(data.segments)) return data;

    const currentVariants = new Map<string, string>();
    const convertedPropNames = new Set<string>();

    const scoreVariant = (variant: any, prompt: string, charName: string) => {
      if (!prompt) return 0;
      let score = 0;
      const cleanVariantName = (variant.name || '').replace(/^变装[：:]\s*/, '').trim();
      if (!cleanVariantName) return 0;

      const variantKeywords = ['穿着', '身穿', '换上', '换了', '戴着', '披着', '一身', '一套', '装扮', '服饰', '衣服', '礼服', '制服', '套装', '模样', '形象', '打扮', '造型', '服装', '款式', '样式', '变装', '状态', '样子'];
      
      if (prompt.includes(cleanVariantName) || (variant.name && prompt.includes(variant.name))) score += 100;

      const hasKeyword = variantKeywords.some(kw => prompt.includes(kw));
      if (hasKeyword && prompt.includes(cleanVariantName)) score += 50;
      
      const charIndex = prompt.indexOf(charName);
      const variantIndex = prompt.indexOf(cleanVariantName);
      if (charIndex !== -1 && variantIndex !== -1) {
        const distance = Math.abs(charIndex - variantIndex);
        if (distance < 30) score += 40;
      }

      if (variant.prompt) {
        const parts = variant.prompt.split(/[，,。]/).map((p: string) => p.trim()).filter((p: string) => p.length > 1);
        parts.forEach((part: string) => {
          if (prompt.includes(part)) score += 25;
        });
      }

      const fuzzyName = cleanVariantName.replace(/[的了着]/g, '');
      const fuzzyPrompt = prompt.replace(/[的了着]/g, '');
      if (fuzzyName.length > 1 && fuzzyPrompt.includes(fuzzyName)) score += 45;

      const focusKeywords = ['居中', '剧中', '主体', '主角', '主要'];
      const focusKeyword = focusKeywords.find(kw => prompt.includes(kw));
      if (focusKeyword) {
        const focusIndex = prompt.indexOf(focusKeyword);
        const variantIndex = prompt.indexOf(cleanVariantName);
        if (variantIndex !== -1 && Math.abs(focusIndex - variantIndex) < 40) {
          score += 70;
        }
      }

      return score;
    };

    data.segments.forEach((seg: any, index: number) => {
      if (typeof seg === 'string') {
        const prompt = seg.trim();
        const lines = prompt.split('\n').filter(l => l.includes('：') || l.includes(':'));
        const plotAnchor = lines.join('\n') || prompt.substring(0, 100);

        data.segments[index] = {
          id: `seg_${index + 1}`,
          index: index,
          duration: "15s",
          assets: { characters: '', scenes: '', props: '' },
          prompt: prompt,
          plotAnchor: plotAnchor
        };
        seg = data.segments[index];
      }

      if (!seg.assets) seg.assets = { characters: '', scenes: '', props: '' };
      
      const explicitIds = { characters: new Set<string>(), scenes: new Set<string>(), props: new Set<string>() };
      const idRegex = /(?:\[(图\d+|场景\d+|道具\d+)(_v\d+)?\]|@(图\d+|场景\d+|道具\d+)(_v\d+)?)/g;
      let match;
      while ((match = idRegex.exec(seg.prompt || '')) !== null) {
        const fullId = (match[1] || match[3]) + (match[2] || match[4] || '');
        if (fullId.startsWith('图')) explicitIds.characters.add(fullId);
        else if (fullId.startsWith('场景')) explicitIds.scenes.add(fullId);
        else if (fullId.startsWith('道具')) explicitIds.props.add(fullId);
      }

      const hasCharacterBindings = seg.assets.characters && typeof seg.assets.characters === 'string' && seg.assets.characters.includes('=') && (seg.assets.characters.includes('图') || seg.assets.characters.includes('char_'));
      const hasSceneBindings = seg.assets.scenes && typeof seg.assets.scenes === 'string' && seg.assets.scenes.includes('=') && (seg.assets.scenes.includes('场景') || seg.assets.scenes.includes('scene_'));
      const hasPropBindings = seg.assets.props && typeof seg.assets.props === 'string' && seg.assets.props.includes('=') && (seg.assets.props.includes('道具') || seg.assets.props.includes('prop_'));
      
      const normalize = (str: string, type: string) => {
        if (!str) return '';
        const items = str.split(',').map(s => {
          const parts = s.split('=');
          if (parts.length < 2) return s;
          const idPartRaw = parts[1].trim();
          let id = idPartRaw.split(/[（(]/)[0].trim();
          const details = idPartRaw.includes('（') ? '（' + idPartRaw.split('（')[1] : idPartRaw.includes('(') ? '(' + idPartRaw.split('(')[1] : '';
          
          while (id.startsWith('@')) id = id.slice(1);
          
          return `${parts[0].trim()}=${this.getAssetDisplayId(id, type, data.assets)}${details}`;
        });

        const uniqueItems: string[] = [];
        const seenNames = new Set<string>();
        for (const item of items) {
          const name = item.split('=')[0].trim().split(' (')[0].split('（')[0].trim();
          if (!seenNames.has(name)) {
            seenNames.add(name);
            uniqueItems.push(item);
          }
        }
        return uniqueItems.join(', ');
      };

      if (hasCharacterBindings) seg.assets.characters = normalize(seg.assets.characters, 'character');
      if (hasSceneBindings) seg.assets.scenes = normalize(seg.assets.scenes, 'scene');
      if (hasPropBindings) seg.assets.props = normalize(seg.assets.props, 'prop');

      if (index > 0 && seg.prompt && typeof seg.prompt === 'string' && seg.prompt.includes(`[承接 尾帧-${index - 1}]`)) {
        seg.assets.continuity = `[承接 尾帧-${index - 1}]`;
      }

      const combinedText = (seg.prompt || '') + ' ' + (seg.plotAnchor || '');
      const matchedVariantNames = new Set<string>();

      const currentChars = seg.assets.characters ? seg.assets.characters.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      
      explicitIds.characters.forEach(eid => {
        const asset = this.findAssetByDisplayId(eid, 'character', data.assets);
        if (asset && !currentChars.some((c: string) => c.includes(`=${eid}`))) {
          currentChars.push(`${asset.name}=${eid}`);
        }
      });

      const hasExplicitAnchors = explicitIds.characters.size > 0 || explicitIds.scenes.size > 0 || explicitIds.props.size > 0;

      const foundChars = data.assets.filter((a: any) => {
        if (a.type !== 'character') return false;
        if (combinedText.includes(a.name) || (a.refName && combinedText.includes(a.refName))) return true;
        if (a.variants && a.variants.length > 0) {
          return a.variants.some((v: any) => {
            const cleanVName = (v.name || '').replace(/^变装[：:]\s*/, '').trim();
            return cleanVName.length > 1 && combinedText.includes(cleanVName);
          });
        }
        return false;
      }).map((a: any) => {
        const details = a.details;
        let detailStr = '';
        if (details) {
          const parts = [];
          if (details.dnaText) {
            const cleanDna = details.dnaText.split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => line && !line.includes('资产名称') && !line.includes('AI 引用名'))
              .join('，');
            parts.push(cleanDna);
          } else {
            if (details.height) {
              const h = details.height;
              const hStr = (typeof h === 'string' && h.includes('cm')) ? h : `${h}cm`;
              parts.push(`身高${hStr}`);
            }
            if (details.hairColor) parts.push(`发色${details.hairColor}`);
            if (details.clothing) parts.push(`穿着${details.clothing}`);
            if (details.clothingColor) parts.push(`服装颜色${details.clothingColor}`);
            if (details.appearance) parts.push(details.appearance);
          }
          if (parts.length > 0) detailStr = `（${parts.join('，')}）`;
          if (details.voiceName && combinedText && (combinedText.includes(`${a.name}：`) || combinedText.includes(`${a.name}:`))) {
            detailStr += `角色说话音色=${details.voiceName}`;
          }
        }
        
        let finalId = a.id;
        let matchedVariant = undefined;
        let subSuffix = '';
        if (combinedText.includes(`${a.name}六视图`) || combinedText.includes(`${a.name}角色设定图`)) subSuffix = '_v';
        
        if (a.variants && a.variants.length > 0) {
          const scoredVariants = a.variants.map((v: any) => ({
            variant: v,
            score: scoreVariant(v, combinedText, a.name)
          })).filter((sv: any) => sv.score > 0)
             .sort((a: any, b: any) => b.score - a.score);

          if (scoredVariants.length > 0) {
            matchedVariant = scoredVariants[0].variant;
            finalId = `${a.id}_v${matchedVariant.id.replace('v', '')}`;
            const cleanName = (matchedVariant.name || '').replace(/^变装[：:]\s*/, '').trim();
            matchedVariantNames.add(cleanName);
            matchedVariantNames.add(matchedVariant.name);
            currentVariants.set(a.id, matchedVariant.id);
          } else if (currentVariants.has(a.id)) {
            const lastVariantId = currentVariants.get(a.id)!;
            const lastVariant = a.variants.find((v: any) => v.id === lastVariantId);
            if (lastVariant) {
              matchedVariant = lastVariant;
              finalId = `${a.id}_v${lastVariantId.replace('v', '')}`;
            }
          }
        }
        
        if (subSuffix) finalId += subSuffix;
        
        const variantName = matchedVariant ? ` (${matchedVariant.name.replace(/^变装[：:]\s*/, '')})` : '';
        const subName = subSuffix === '_v' ? ' (角色设定图)' : '';
        const displayId = this.getAssetDisplayId(finalId, 'character', data.assets);
        return `${a.name}${variantName}${subName}=${displayId}${detailStr}`;
      });

      if (!hasCharacterBindings && foundChars.length > 0) {
        const allChars = Array.from(new Set([...foundChars, ...currentChars]));
        seg.assets.characters = normalize(allChars.join(','), 'character');
      } else if (hasCharacterBindings) {
        const updatedChars = currentChars.map((cStr: string) => {
          let [name, idPart] = cStr.split('=');
          if (!idPart) return cStr;
          let id = idPart.split(/[（(]/)[0].trim();
          let details = idPart.includes('（') ? '（' + idPart.split('（')[1] : idPart.includes('(') ? '(' + idPart.split('(')[1] : '';
          
          if ((name.includes('六视图') || name.includes('角色设定图')) && !id.endsWith('_v')) id += '_v';
          
          const asset = this.findAssetByDisplayId(id, 'character', data.assets) || data.assets.find((a: any) => a.name === name.split(' (')[0]);
          if (asset && asset.type === 'character' && asset.variants) {
            const scoredVariants = asset.variants.map((v: any) => ({
              variant: v,
              score: scoreVariant(v, combinedText, asset.name)
            })).filter((sv: any) => sv.score > 0)
               .sort((a: any, b: any) => b.score - a.score);

            if (scoredVariants.length > 0) {
              const matchedVariant = scoredVariants[0].variant;
              const newId = `${asset.id}_v${matchedVariant.id.replace('v', '')}${id.endsWith('_v') ? '_v' : ''}`;
              matchedVariantNames.add(matchedVariant.name);
              const variantName = ` (${(matchedVariant.name || '').replace(/^变装[：:]\s*/, '')})`;
              const baseName = name.split(' (')[0];
              const subName = id.endsWith('_v') ? ' (角色设定图)' : '';
              const displayId = this.getAssetDisplayId(newId, 'character', data.assets);
              return `${baseName}${variantName}${subName}=${displayId}${details}`;
            }
          }
          const displayId = this.getAssetDisplayId(id, 'character', data.assets);
          return `${name}=${displayId}${details}`;
        });
        seg.assets.characters = Array.from(new Set(updatedChars)).join(',');
      }
      
      const currentScenes = seg.assets.scenes ? seg.assets.scenes.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      
      explicitIds.scenes.forEach(eid => {
        const asset = this.findAssetByDisplayId(eid, 'scene', data.assets);
        if (asset && !currentScenes.some((c: string) => c.includes(`=${eid}`))) {
          currentScenes.push(`${asset.name}=${eid}`);
        }
      });

      const foundScenes = data.assets.filter((a: any) => {
        if (a.type !== 'scene') return false;
        return combinedText.includes(a.name);
      }).map((a: any) => `${a.name}=${this.getAssetDisplayId(a.id, 'scene', data.assets)}`);
      
      const mergedScenes = [...currentScenes];
      foundScenes.forEach((fs: string) => {
        const name = fs.split('=')[0];
        if (!mergedScenes.some((ms: string) => ms.startsWith(name + '='))) {
          mergedScenes.push(fs);
        }
      });
      if (mergedScenes.length > 0) seg.assets.scenes = normalize(mergedScenes.join(','), 'scene');

      const currentProps = seg.assets.props ? seg.assets.props.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      
      explicitIds.props.forEach(eid => {
        const asset = this.findAssetByDisplayId(eid, 'prop', data.assets);
        if (asset && !currentProps.some((c: string) => c.includes(`=${eid}`))) {
          currentProps.push(`${asset.name}=${eid}`);
        }
      });

      const foundProps = data.assets.filter((a: any) => {
        if (a.type !== 'prop') return false;
        return combinedText.includes(a.name);
      }).map((a: any) => `${a.name}=${this.getAssetDisplayId(a.id, 'prop', data.assets)}`);

      let mergedProps = [...currentProps];
      foundProps.forEach((fp: string) => {
        const name = fp.split('=')[0];
        if (!mergedProps.some((mp: string) => mp.startsWith(name + '='))) {
          mergedProps.push(fp);
        }
      });
      
      const propsInPrompt = data.assets.filter((a: any) => a.type === 'prop' && combinedText.includes(a.name));
      const charsInPrompt = data.assets.filter((a: any) => a.type === 'character' && combinedText.includes(a.name));
      
      propsInPrompt.forEach((p: any) => {
        charsInPrompt.forEach((c: any) => {
          const wearKeywords = ['穿着', '身穿', '戴着', '披着', '换上', '换了', '一身', '一套', '装扮', '服饰'];
          const isWearing = wearKeywords.some(kw => combinedText.includes(`${c.name}${kw}${p.name}`) || combinedText.includes(`${kw}${p.name}`));
          
          if (isWearing) {
            matchedVariantNames.add(p.name);
            convertedPropNames.add(p.name);
            
            if (!c.variants) c.variants = [];
            
            let v = c.variants.find((v: any) => 
              (v.name && v.name.includes(p.name)) || 
              (p.name && p.name.includes((v.name || '').replace(/^变装[：:]\s*/, ''))) ||
              (v.prompt && v.prompt.includes(p.name))
            );
            
            if (!v) {
              const finalVariantName = p.name.startsWith('变装') ? p.name : `变装：${p.name}`;
              v = {
                id: `v${c.variants.length + 1}`,
                name: finalVariantName,
                prompt: p.subAssets?.mainPrompt || ''
              };
              c.variants.push(v);
            }
            
            const charBindings = (seg.assets.characters || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            const updatedCharBindings = charBindings.map((cb: string) => {
              if (cb.startsWith(`${c.name}=${c.id}`)) {
                return `${c.name} (${v.name.replace(/^变装[：:]\s*/, '')})=${c.id}_v${v.id.replace('v', '')}`;
              }
              return cb;
            });
            seg.assets.characters = updatedCharBindings.join(',');
          }
        });
      });

      seg.assets.props = normalize(mergedProps.filter((pStr: string) => {
        const name = pStr.split('=')[0];
        return !convertedPropNames.has(name);
      }).join(','), 'prop');
    });

    data.assets = data.assets.filter((a: any) => {
      if (a.type === 'prop') {
        if (convertedPropNames.has(a.name)) return false;
        
        const clothingKeywords = ['衣服', '套装', '礼服', '西装', '裙子', '玩偶服', '变装', '服饰', '装扮', '造型', '服装', '款式', '样式', '模样', '形象', '样子', '大衣', '外套', '衬衫', '裤子', '鞋子', '帽子', '围巾', '手套', '制服', '运动服', '睡衣', '泳衣', '婚纱', '铠甲', '盔甲', '战袍', '披风', '斗篷', '面具', '头饰', '首饰', '项链', '耳环', '戒指', '手链', '手表', '眼镜', '墨镜', '领带', '领结', '腰带', '皮带', '袜子', '丝袜', '内衣', '内裤', '睡袍', '浴袍', '睡裙', '睡裤'];
        const isClothing = clothingKeywords.some(kw => a.name && a.name.includes(kw));
        if (isClothing) {
          const isAlreadyVariant = data?.assets?.some((c: any) => c.type === 'character' && c.variants?.some((v: any) => (v.name && v.name.includes(a.name)) || (a.name && a.name.includes((v.name || '').replace(/^变装[：:]\s*/, '')))));
          if (isAlreadyVariant) return false;
          
          const hasCharName = data?.assets?.some((c: any) => c.type === 'character' && a.name && a.name.includes(c.name));
          if (hasCharName) return false;
        }
      }
      return true;
    });

    data.segments.forEach((seg: any) => {
      if (seg.prompt) seg.prompt = this.cleanPromptText(seg.prompt);
      if (seg.plotAnchor) seg.plotAnchor = this.cleanPromptText(seg.plotAnchor);
    });

    return data;
  }

  public cleanupAssets(assets: Asset[]): Asset[] {
    const characters: Asset[] = [];
    const scenes = assets.filter(a => a.type === 'scene');
    const props = assets.filter(a => a.type === 'prop');
    
    const rawCharacters = assets.filter(a => a.type === 'character');
    rawCharacters.forEach(rc => {
      this.mergeAssetIntoList(characters, rc);
    });
    
    characters.forEach(char => {
      if (char.subAssets?.costumePrompt && char.subAssets.costumePrompt !== 'null' && typeof char.subAssets.costumePrompt === 'string' && char.subAssets.costumePrompt.trim()) {
        if (!char.variants) char.variants = [];
        const hasVariant = char.variants.some(v => v.prompt === char.subAssets.costumePrompt);
        if (!hasVariant) {
          char.variants.push({
            id: `v_${char.id}_costume`,
            name: "变装：新造型",
            prompt: char.subAssets.costumePrompt
          });
        }
      }
    });

    return [...characters, ...scenes, ...props];
  }

  public async analyzeScript(script: string, config?: Config): Promise<ScriptAnalysis> {
    const prompt = `你是一位顶级的电影/微短剧剧本分析师。请对以下剧本进行深度且多维度的分析，提取剧本的基础和高阶特征。

剧本内容如下：
${script}

请生成一份完整、专业且符合以下结构的 JSON 报告，严禁包含任何前导或后置的解释性文字，直接返回一个合法的 JSON 对象。
结构模板（所有属性均为必填项，空值可用空字符串或空数组代替）：
{
  "wordCount": ${script.length},
  "remainingWords": 0,
  "dramaType": "剧本题材类型（如：都市、悬疑等）",
  "suggestedStoryboardStyle": "建议的分镜风格",
  "suggestedDirectorStyle": "建议的导演风格",
  "suggestedVisualStyle": "建议的画面画风",
  "keyCharacters": ["角色1"],
  "keyScenes": ["场景1"],
  "estimatedSegments": 10,
  "suggestedNarrativeMode": "detailed",
  "videoTheme": "视频主题",
  "videoStyle": "视频风格描述",
  "sceneDescription": "核心场景描述",
  "storyboardStructure": "分镜结构建议",
  "characterSetting": "核心角色设置简述",
  "dialogueContent": "台词内容要点",
  "aspectRatio": "9:16",
  "language": "中文"
}`;
    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
          systemInstruction: DIRECTOR_AGENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json", 
          temperature: 0.1 
        }
      }, config);
      return this.extractJson(response.text, {});
    } catch (e) {
      console.error("Analyze script failed:", e);
      throw e;
    }
  }

  private mergeAssetIntoList(mergedAssets: Asset[], na: any) {
    if (!na || !na.name) return;

    const exactMatch = mergedAssets.find(ma => ma.id === na.id || ma.name === na.name);
    if (exactMatch) {
      if (na.details && !exactMatch.details) {
        exactMatch.details = na.details;
      }
      
      if (na.variants && Array.isArray(na.variants)) {
        if (!exactMatch.variants) exactMatch.variants = [];
        na.variants.forEach((nv: any) => {
          if (nv && nv.name && !exactMatch.variants!.find((ev: any) => ev.id === nv.id || ev.name === nv.name)) {
            exactMatch.variants!.push(nv);
          }
        });
      }
      return;
    }

    if (na.type === 'character') {
      const similarChar = mergedAssets.find(ma => 
        ma.type === 'character' && 
        (na.name.startsWith(ma.name) || ma.name.startsWith(na.name) || 
         na.name.includes(ma.name) || ma.name.includes(na.name))
      );

      if (similarChar) {
        const baseChar = na.name.length <= similarChar.name.length ? na : similarChar;
        const variantChar = na.name.length > similarChar.name.length ? na : similarChar;
        
        if (baseChar === na) {
          const index = mergedAssets.indexOf(similarChar);
          mergedAssets[index] = na;
          if (!na.variants) na.variants = [];
          na.variants.push({
            id: `v${na.variants.length + 1}`,
            name: similarChar.name,
            prompt: similarChar.subAssets?.mainPrompt || ''
          });
        } else {
          if (!similarChar.variants) similarChar.variants = [];
          similarChar.variants.push({
            id: `v${similarChar.variants.length + 1}`,
            name: na.name,
            prompt: na.subAssets?.mainPrompt || ''
          });
        }
        return;
      }
    }

    mergedAssets.push(na);
  }

  public async preScanAssets(script: string, visualStyle?: string, config?: Config, existingAssets: Asset[] = []): Promise<Asset[]> {
    const existingAssetsInstruction = existingAssets.length > 0 
      ? `\n\n【已有资产库参考（必须严格复用 ID）】：\n${existingAssets.map(a => {
          const variantsStr = a.variants && a.variants.length > 0 
            ? ` [已有变装: ${a.variants.map(v => `${v.name}(${this.getAssetDisplayId(a.id + '_v' + v.id.replace('v', ''), a.type, existingAssets)})`).join(', ')}]` 
            : '';
          return `${a.name}(${this.getAssetDisplayId(a.id, a.type, existingAssets)})${variantsStr}`;
        }).join('\n')}`
      : '';

    const prompt = `你是一位资深美术指导。请从剧本中提取所有核心资产（角色、场景、道具）。
【极其重要】：
1. **资产识别**：请逐行扫描剧本，确保不遗漏任何有台词或有重要动作的角色、场景和关键道具。
2. **语言策略**：资产名称 (name) 必须与剧本主语言一致。但资产的**视觉细节描述 (details) 和提示词 (subAssets)** **必须且只能**统一使用**中文**。严禁出现任何英文提示词。
3. **禁止拆分角色**：同一个角色在不同场景中的变化应放入 \`variants\`。
4. **提示词格式**：生成的提示词必须严格遵循下述【资产生成硬规则】。

${existingAssetsInstruction}

剧本内容：
${script}

【画面画风要求】：${visualStyle || '电影级写实摄影质感'}

${SHARED_ASSET_RULES}

请返回 JSON 格式，严禁包含任何前导或后置的解释性文字。
{
  "assets": [
    {
      "id": "图1",
      "name": "角色名",
      "type": "character",
      "details": { 
        "height": "身高",
        "tags": "标签"
      },
      "subAssets": {
        "mainPrompt": "核心身份：[此处描述角色的年龄、人种、身高、职业、眼神等核心特征]\\n服装细节：[描述具体的服装、材质等]\\n妆容细节：[此处详细描述面部细节]\\n发型发色：[此处详细描述发型、发色]\\n配饰细节：[此处详细描述首饰配件等]\\n要求：影棚拍摄,全身照,纯白背景,单人,单一视角,严禁拼图,手中不拿任何道具。",
        "secondaryPrompt": "核心身份：...\\n要求：正交视角,单人,严禁拼图,手中不拿任何道具",
        "costumePrompt": "null"
      },
      "variants": []
    }
  ]
}`;

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
          systemInstruction: DIRECTOR_AGENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json", 
          temperature: 0.1 
        }
      }, config);
      const data = this.extractJson(response.text, { assets: [] });
      const newAssets = Array.isArray(data.assets) ? data.assets : [];
      const mergedAssets = [...existingAssets];
      
      newAssets.forEach((na: any) => {
        if (!na.subAssets) {
          na.subAssets = {
            mainPrompt: '',
            secondaryPrompt: '',
            costumePrompt: ''
          };
        }

        if (na.subAssets.costumePrompt === 'null' || na.subAssets.costumePrompt === null || (typeof na.subAssets.costumePrompt === 'string' && na.subAssets.costumePrompt.includes('如果没有变装'))) {
          na.subAssets.costumePrompt = '';
        }

        if (na.variants && Array.isArray(na.variants)) {
          na.variants = na.variants.filter((v: any) => v && v.prompt && !v.prompt.includes('如果没有多套变装') && v.prompt !== 'null' && v.name && !v.name.includes('[描述]'));
        }
        
        if (na.type === 'character' && na.subAssets.mainPrompt) {
          const suffix = '\n要求：影棚拍摄,全身照,纯白背景,单人,单一视角,严禁拼图,手中不拿任何道具。';
          if (!na.subAssets.mainPrompt.includes('要求：') && !na.subAssets.mainPrompt.includes('要求:') && (!na.subAssets.mainPrompt.includes('影棚拍摄') || !na.subAssets.mainPrompt.includes('全身照') || !na.subAssets.mainPrompt.includes('手中不拿任何道具'))) {
            na.subAssets.mainPrompt = na.subAssets.mainPrompt.replace(/[，。！,.!]$/, '') + suffix;
          }
        }

        if (na.type === 'character' && na.subAssets.costumePrompt) {
          const costumeSuffix = '\n要求：专业时尚摄影质感,全身照,纯白背景,单人,单一视角,85mm焦段,f/1.8大光圈,极致皮肤细节,高端影棚3点式布光,严禁拼图,手中不拿任何道具。';
          if (!na.subAssets.costumePrompt.includes('要求：') && !na.subAssets.costumePrompt.includes('要求:') && !na.subAssets.costumePrompt.includes('影棚拍摄') && !na.subAssets.costumePrompt.includes('专业时尚摄影')) {
             na.subAssets.costumePrompt = na.subAssets.costumePrompt.replace(/[，。！,.!]$/, '') + costumeSuffix;
          }
        }

        if (na.type === 'character' && na.variants && Array.isArray(na.variants)) {
          na.variants = na.variants.map((v: any) => {
            const costumeSuffix = '\n要求：专业时尚摄影质感,全身照,纯白背景,单人,单一视角,85mm焦段,f/1.8大光圈,极致皮肤细节,高端影棚3点式布光,严禁拼图,手中不拿任何道具。';
            if (v.prompt && !v.prompt.includes('要求：') && !v.prompt.includes('要求:') && !v.prompt.includes('影棚拍摄') && !v.prompt.includes('专业时尚摄影')) {
              v.prompt = v.prompt.replace(/[，。！,.!]$/, '') + costumeSuffix;
            }
            return v;
          });
        }

        this.mergeAssetIntoList(mergedAssets, na);
      });
      return this.cleanupAssets(mergedAssets);
    } catch (e) {
      console.error("Pre-scan assets failed:", e);
      return existingAssets;
    }
  }

  public async generateSingleAssetPrompts(asset: Asset, visualStyle?: string, config?: Config, variantId?: string): Promise<Asset['subAssets']> {
    const variant = variantId ? asset.variants?.find(v => v.id === variantId) : null;
    const isSixView = variantId === 'secondary';

    const prompt = `你是一位资深美术指导。请为以下资产生成标准的视觉提示词。
【资产信息】：
名称：${asset.name}${variant ? ` (变体: ${variant.name})` : ''}
类型：${asset.type}
${asset.details ? `【视觉细节】：${JSON.stringify(asset.details)}` : ''}
${variant?.prompt ? `【变体要求】：${variant.prompt}` : ''}

【极其重要】：
1. **语言策略**：视觉提示词、材质说明、外貌特征描述**必须且只能**统一使用**中文**。
2. **结构化输出**：生成的提示词必须严格按照对应资产类型的结构分行输出，严禁写成一段话。
   - 角色：核心身份、妆容细节、发型发色、服装细节、配饰细节、要求。
   - 场景：核心身份、环境细节、建筑风格、空间布局、核心物件、光影与画风、要求。
   - 道具：核心身份、材质细节、光影表现、画风设定、要求。
3. **主图要求**：主图提示词必须在末尾包含对应的“要求”项。

${SHARED_ASSET_RULES}

请返回 JSON 格式：
{
  "mainPrompt": "核心身份：...\\n要求：影棚拍摄,全身照,纯白背景,单人,单一视角,严禁拼图,手中不拿任何道具。",
  "secondaryPrompt": "..."
}`;

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
          systemInstruction: DIRECTOR_AGENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json", 
          temperature: 0.1 
        }
      }, config);
      const result = this.extractJson(response.text, asset.subAssets);
      
      if (asset.type === 'character' && result.mainPrompt) {
        const suffix = '\n要求：影棚拍摄,全身照,纯白背景,单人,单一视角,严禁拼图,手中不拿任何道具。';
        if (!result.mainPrompt.includes('要求：') && !result.mainPrompt.includes('要求:') && (!result.mainPrompt.includes('影棚拍摄') || !result.mainPrompt.includes('全身照') || !result.mainPrompt.includes('手中不拿任何道具'))) {
          result.mainPrompt = result.mainPrompt.replace(/[，。！,.!]$/, '') + suffix;
        }
      }
      
      return result;
    } catch (e) {
      console.error("Generate single asset prompts failed:", e);
      return asset.subAssets;
    }
  }

  public async processScript(
    script: string, 
    directorStyle?: string, 
    aspectRatio: string = "1:1", 
    visualStyle?: string, 
    config?: Config, 
    onProgress?: (msg: string) => void,
    narrativeMode: 'detailed' | 'compact' = 'detailed', 
    targetSegments?: number,
    existingAssets: Asset[] = [],
    globalRule?: string,
    productionMode: 'director' | 'prompt' = 'director',
    isFlexibleDuration: boolean | string = false,
    spatialMode: 'strong' | 'standard' = 'strong'
  ): Promise<PipelineData> {
    onProgress?.("正在扫描剧本资产...");
    const assets = await this.preScanAssets(script, visualStyle, config, existingAssets);
    onProgress?.("正在生成分镜脚本...");
    return await this.callProcessScriptApi(script, directorStyle, aspectRatio, visualStyle, config, assets, false, narrativeMode, targetSegments, false, null, globalRule, false, productionMode, isFlexibleDuration, spatialMode);
  }

  public async callProcessScriptApi(
    script: string, 
    directorStyle?: string, 
    aspectRatio: string = "1:1", 
    visualStyle?: string, 
    config?: Config, 
    existingAssets: Asset[] = [], 
    isSubsequentChunk: boolean = false, 
    narrativeMode: 'detailed' | 'compact' = 'detailed', 
    targetSegments?: number, 
    skipFuzzyBind: boolean = false, 
    lastSegmentContext: Segment | null = null, 
    globalRule?: string,
    onlySegments: boolean = false,
    productionMode: 'director' | 'prompt' = 'director',
    isFlexibleDuration: boolean | string = false,
    spatialMode: 'strong' | 'standard' = 'strong'
  ): Promise<PipelineData> {
    const isPromptMode = productionMode === 'prompt';
    const spatialInstruction = `\n\n【Prompt 开场与场景定位标记要求】：为了标识镜头发生的具体物理场景，在提示词的每一个换景处或镜头序列开头，必须单独另起一行书写场景锁定声明：\`场景：场景名=@场景N\`（在导演模式下，格式直接写为\`场景：场景名\`），以此明确镜头的空间定位。这个场景描述必须是一行独立的文本，严禁与镜头的时间戳写在同一行。首个镜头的动作描述及后续所有镜头必须直接紧跟在换行的场景描述标记之后，后续每一个镜头必须换行新起一行单独占一行（用 \\n 换行分隔）。格式：\`开始秒-结束秒s（景别、拍摄距离、拍摄方位与角度、运镜）：描述\`，不要有任何 “镜头N” 或 “【镜头: 类型】” 或 “[新起 镜头]” 等任何非画面前缀字样。`;

    const modeInstruction = isPromptMode 
      ? `\n\n【制作模式：提示词模式】：你必须将剧本拆解为资产和符合特定时长的分段提示词。提示词必须是纯净的视觉语言，除了最开始和换景处的场景定位标记（例如 \`场景：宴会厅=@场景1\`）外，**严禁**包含任何 ID 标签（如 =@图1）。` 
      : `\n\n【制作模式：导演模式】：在提示词中，只需直接提及角色或场景名称，除了开头的场景定位标记外，**严禁**在动作细节中加上任何 [ID] 前缀。`;

    const styleInstruction = directorStyle ? `\n\n【导演分镜风格要求】：\n${directorStyle}` : '';
    const visualInstruction = visualStyle ? `\n\n【画面画风要求】：${visualStyle}` : '';
    const aspectInstruction = `\n\n【画面比例要求】：${aspectRatio}`;
    const narrativeInstruction = `\n\n【叙事模式：${narrativeMode === 'compact' ? '短剧模式（极简节奏）' : '深度叙事模式'}】`;
    
    let segmentsInstruction = '';
    if (targetSegments && targetSegments > 0) {
      segmentsInstruction = `\n\n【极其重要：目标段落数要求】：必须严格生成正好 ${targetSegments} 个段落（segments）。内容多则通过合并动作、精简视觉描写来压缩，但**严禁精简对白**；内容少则合理扩充细节，严禁多于 or 少于此数量。`;
    } else {
      segmentsInstruction = `\n\n【段落规划建议】：请根据剧本的冲突、转折与情感曲线，自动决定最合理的段落（segments）数量。`;
    }

    let isFlexible = false;
    let maxDurationStr = '15s';
    
    if (typeof isFlexibleDuration === 'string') {
      if (isFlexibleDuration === 'flexible-30' || isFlexibleDuration.includes('30')) {
        isFlexible = true;
        maxDurationStr = '30s';
      } else if (isFlexibleDuration === 'flexible-15' || isFlexibleDuration.includes('15') || isFlexibleDuration === 'flexible') {
        isFlexible = true;
        maxDurationStr = '15s';
      }
    } else {
      isFlexible = isFlexibleDuration;
      maxDurationStr = '15s';
    }

    const durationInstruction = isFlexible 
      ? `\n\n【时长规划要求】：单段时长可根据叙事内容动态决定，范围为 4s 到 ${maxDurationStr}。请在每段的 \`duration\` 字段中标注。`
      : `\n\n【时长规划要求】：每段时长必须严格固定为 15s。`;

    const existingAssetsInstruction = existingAssets.length > 0 
      ? `\n\n【已有资产库参考（必须严格遵守）】：\n${existingAssets.map(a => {
          const variantsStr = a.variants && a.variants.length > 0 
            ? ` [已有变装: ${a.variants.map(v => `${v.name}(${this.getAssetDisplayId(a.id + '_v' + v.id.replace('v', ''), a.type, existingAssets)})`).join(', ')}]` 
            : '';
          return `${a.name}(${this.getAssetDisplayId(a.id, a.type, existingAssets)}): ${this.sanitizePrompt(a.subAssets?.mainPrompt || '')}${a.subAssets?.costumePrompt ? ' [变装特征: ' + a.subAssets.costumePrompt + ']' : ''}${variantsStr}`;
        }).join('\n')}`
      : '';
    const globalRuleInstruction = globalRule ? `\n\n【全局强制规则】：\n${globalRule}` : '';
    const onlySegmentsInstruction = onlySegments ? `\n\n【重要提示】：全局资产库已由用户确认，请务必严格基于已有资产进行分镜拆解，不要随意修改已有资产的 ID 和核心描述。如果发现剧本中有未在资产库中的新角色或场景，可以在 assets 中补充，否则 assets 数组请返回空数组 []。` : '';
    const lastContextInstruction = lastSegmentContext 
      ? `\n\n【首尾帧衔接与视觉连续性参考】：\n上一段（Index: ${lastSegmentContext.index}）的结尾状态如下，请在当前段落的第一个镜头开头显式包含 “[承接 尾帧-${lastSegmentContext.index}]”，并描述画面如何平滑延续：\n${lastSegmentContext.prompt}`
      : '';

    const imageParts: any[] = [];
    if (spatialMode === 'strong') {
      const seenImageUrls = new Set<string>();
      for (const asset of existingAssets) {
        if (asset.type === 'scene' && asset.generatedMedia?.mainImageUrl) {
          const url = asset.generatedMedia.mainImageUrl;
          if (!seenImageUrls.has(url)) {
            seenImageUrls.add(url);
            try {
               const { base64, mimeType } = await urlToBase64(url);
               imageParts.push({ text: `【场景示例图 - ${this.getAssetDisplayId(asset.id, 'scene', existingAssets)} (${asset.name})】` });
               imageParts.push({ inlineData: { data: base64, mimeType } });
            } catch (e) {
               console.warn(`Failed to package scene image for coordinate inference: ${url}`, e);
            }
          }
        }
      }
    }

    const visualAnalysisInstruction = imageParts.length > 0 
      ? `\n\n【视觉一致性参考】：我已经提供了本剧涉及到的场景示例图。请认真分析图中的环境细节、空间布局、光影与色调，并在提示词中保持视觉风格的高度一致。只需使用自然语言描述布局，严禁使用 X, Y, Z 坐标。`
      : '';

    const prompt = `请基于【系统指令】中的导演标准，将以下剧本拆解为视频分镜脚本。${spatialInstruction}${modeInstruction}${styleInstruction}${visualInstruction}${aspectInstruction}${narrativeInstruction}${segmentsInstruction}${durationInstruction}${existingAssetsInstruction}${globalRuleInstruction}${onlySegmentsInstruction}${lastContextInstruction}${visualAnalysisInstruction}
剧本内容如下：
${script}

【核心任务（最高优先级）】：
1. 严格生成 ${targetSegments || '自动计算'} 个分段。
2. **Prompt 场景标记铁律**：每段 prompt 的镜头开始前，或者当场景（场景资产）发生切换时，必须单独新起一行插入场景标记 \`场景：场景名=@场景N\` (或是导演模式下的 \`场景：场景名\`) 锁定环境。然后再新起一行开始书写对应的第一个镜头画面描述。后续的每一个镜头**必须强制另起一行，以新空一行（用 \\n 换行分隔）独占一行**。
3. **时长铁律**：每段总时长必须精确等于该段定义的 duration (${isFlexible ? `4-${maxDurationStr}` : '15s'})。
4. **格式铁律**：每段 prompt 除了前面提到的 \`场景：场景名=@场景N\`（或 \`场景：场景名\`）标记之外，**严禁**包含 any “[新起 镜头]” or “[承接 尾帧-X]” 等任何非画面前缀。
5. **镜头铁律**：不使用“镜头N”等前缀。格式为：\`开始秒-结束秒s（景别、拍摄距离、拍摄方位与角度、运镜）：描述\`。
6. **台词铁律**：必须包含所有台词，格式为 \`角色名：“台词”\`。
7. **音效铁律**：关键动作后必须紧跟 \`[SFX: 音效]\`。
8. **后缀铁律**：每段末尾必须另起一行，内容必须且只能为 \`无字幕，无背景音乐\`。
9. **资产铁律（禁令）**：在视觉描述中，除了最前方的场景锁定描述外，镜头的具体动作描述中**严禁**包含任何资产 ID 标签（如 @图1、[图1]）。只需使用资产名。
10. **语言铁律**：视觉描述用中文，台词保留原语言。
11. **资产生成硬规则**：如果需要生成新资产（assets 字段），必须严格遵循【资产生成硬规则】。

${SHARED_ASSET_RULES}

请直接返回符合 Schema 要求的 JSON 对象，严禁包含任何解释性文字。`;

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ 
          role: 'user', 
          parts: [
            ...imageParts,
            { text: prompt }
          ] 
        }],
        config: {
          systemInstruction: DIRECTOR_AGENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              segments: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    index: { type: "INTEGER" },
                    duration: { type: "STRING" },
                    assets: {
                      type: "OBJECT",
                      properties: {
                        characters: { type: "STRING" },
                        scenes: { type: "STRING" },
                        props: { type: "STRING" },
                        continuity: { type: "STRING" }
                      },
                      required: ["characters", "scenes", "props"]
                    },
                    prompt: { type: "STRING" },
                    plotAnchor: { type: "STRING" }
                  },
                  required: ["id", "index", "duration", "assets", "prompt", "plotAnchor"]
                }
              },
              assets: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    name: { type: "STRING" },
                    type: { type: "STRING", enum: ["character", "scene", "prop"] },
                    details: { 
                      type: "OBJECT", 
                      properties: { 
                        height: { type: "STRING" }, 
                        nationality: { type: "STRING" }, 
                        ethnicity: { type: "STRING" },
                        race: { type: "STRING" }, 
                        gender: { type: "STRING" },
                        age: { type: "STRING" }
                      } 
                    },
                    subAssets: {
                      type: "OBJECT",
                      properties: {
                        mainPrompt: { type: "STRING" },
                        secondaryPrompt: { type: "STRING" }
                      },
                      required: ["mainPrompt"]
                    }
                  },
                  required: ["id", "name", "type", "subAssets"]
                }
              }
            },
            required: ["segments", "assets"]
          }
        }
      }, config);
      let data = this.extractJson(response.text);
      
      if (data._isTextFormat) {
        data = this.parseTextSegments(data.rawText);
      }
      
      const mergedAssets = [...existingAssets];
      if (data.assets && Array.isArray(data.assets)) {
        data.assets.forEach((na: any) => {
          this.mergeAssetIntoList(mergedAssets, na);
        });
      }
      data.assets = mergedAssets;

      if (skipFuzzyBind) return { ...data, assets: this.cleanupAssets(mergedAssets) };
      return this.fuzzyBindAssets({ ...data, assets: this.cleanupAssets(mergedAssets) });
    } catch (e) {
      console.error("Pipeline API failed:", e);
      throw e;
    }
  }

  private parseTextSegments(text: string): any {
    const segments: any[] = [];
    const blocks = text.split(/\[(?:新起 镜头|承接 尾帧-\d+)\]/).filter(b => b.trim());
    const markers = text.match(/\[(?:新起 镜头|承接 尾帧-\d+)\]/g) || [];

    blocks.forEach((block, i) => {
      const marker = markers[i] || '[新起 镜头]';
      let prompt = (marker + block).trim();
      let plotAnchor = "";

      if (block.includes('{') && block.includes('}')) {
        try {
          const json = this.extractJson(block);
          if (json.prompt) {
            prompt = json.prompt;
            if (!prompt.startsWith('[') && marker) prompt = marker + prompt;
          }
          if (json.plotAnchor) plotAnchor = json.plotAnchor;
          else if (json.segments && json.segments[0]?.prompt) {
            prompt = json.segments[0].prompt;
            if (!prompt.startsWith('[') && marker) prompt = marker + prompt;
            plotAnchor = json.segments[0].plotAnchor || "";
          }
        } catch (e) {
          prompt = this.cleanPromptText(prompt);
        }
      } else {
        const lines = block.split('\n').filter(l => l.includes('：') || l.includes(':'));
        plotAnchor = lines.join('\n');
      }

      segments.push({
        id: `seg_${i + 1}`,
        index: i,
        duration: "15s",
        assets: { characters: "", scenes: "", props: "" },
        prompt: prompt,
        plotAnchor: plotAnchor || block.substring(0, 100) + "..."
      });
    });

    return { segments, assets: [] };
  }

  public async regenerateSegmentPrompt(
    segment: Segment, 
    script: string, 
    directorStyle?: string, 
    aspectRatio: string = "1:1", 
    visualStyle?: string, 
    config?: Config, 
    allAssets: Asset[] = [], 
    globalRule?: string,
    lastSegmentContext: Segment | null = null,
    productionMode: 'director' | 'prompt' = 'director',
    spatialMode: 'strong' | "standard" = 'strong'
  ): Promise<string> {
    const isPromptMode = productionMode === 'prompt';
    const spatialInstruction = `\n\n【Prompt 开场与场景定位标记要求】：为了标识镜头发生的具体物理场景，在提示词的每一个换景处或镜头序列开头，必须单独另起一行书写场景锁定声明：\`场景：场景名=@场景N\`（在导演模式下，格式直接写为\`场景：场景名\`），以此明确镜头的空间定位。这个场景描述必须是一行独立的文本，严禁与镜头的时间戳写在同一行。首个镜头的动作描述及后续所有镜头必须直接紧跟在换行的场景描述标记之后。`;

    const modeInstruction = isPromptMode 
      ? `\n\n【制作模式：提示词模式】：在提示词中，资产引用的格式必须严格按照 “名称=@ID” 的形式，例如：“林峰=@图1”、“宴会厅=@场景1”。` 
      : `\n\n【制作模式：导演模式】：在提示词中，资产引用的格式为 “[ID]名称”，例如：“[图1]林峰”。`;

    const globalRuleInstruction = globalRule ? `\n\n【全局强制规则】：\n${globalRule}` : '';
    const lastContextInstruction = lastSegmentContext 
      ? `\n\n【首尾帧衔接与视觉连续性参考】：\n上一段（Index: ${lastSegmentContext.index}）的结尾状态如下，请在当前段落的第一个镜头中，以纯净的镜头动作描述画面如何平滑延续：\n${lastSegmentContext.prompt}`
      : '';

    const assetDetailsInstruction = allAssets.length > 0 ? `\n\n【资产视觉细节参考】：\n${allAssets.map(a => {
      const displayId = this.getAssetDisplayId(a.id, a.type, allAssets);
      return `[${displayId}] ${a.name} (${a.type === 'character' ? '角色' : a.type === 'scene' ? '场景' : '道具'}):\n${this.sanitizePrompt(JSON.stringify(a.details || {}))}`;
    }).join('\n\n')}` : '';

    const prompt = `你是一位世界级导演。请为剧本中的一个特定 15 秒分段重新生成一个视觉冲击力极强的分镜提示词。${modeInstruction}${spatialInstruction}${globalRuleInstruction}${lastContextInstruction}${assetDetailsInstruction}
【极其重要】：
1. **时间轴铁律（死命令）**：每个分段的时间轴必须从 0s 开始，到 15s 结束。**严禁出现任何超过 15s 的时间戳（如 16s, 18s 等）**。
2. **Prompt 场景标记铁律**：每段 prompt 的镜头开始前，或者当场景发生切换时，必须单独新起一行插入场景标记 \`场景：场景名=@场景N\` (或是导演模式下的 \`场景：场景名\`) 锁定环境。然后再新起一行开始书写对应的第一个镜头画面描述。
3. **Prompt 纯净度铁律**：严禁在提示词中出现 any 颜色代码或具体身高数值。
4. **视觉一致性铁律**：必须严格遵循上述【资产视觉细节参考】中的描述。
5. **语言规则**：无论剧本语言如何，重新生成的提示词视觉描述**必须且只能**使用**中文**。
6. **首尾帧衔接**：在内容上确保与前段视觉动作 and 场景的平滑连续，整个提示词中严禁使用 “[承接]”、“[接戏]” 等任何非画面前缀。
7. **强制后缀**：提示词的末尾必须强制包含 “无字幕，无背景音乐”。
8. **【绝对禁止使用代词】**：严禁使用“他/她/它”，必须使用具体角色姓名。
9. **【台词格式强制化】**：严禁使用 \`[台词: ]\` 前缀，必须严格采用“角色名：‘台词内容’”的格式。
10. **资产纯净度（铁律）**：在视觉描述中，除了最前方的场景锁定描述（如开头的 \`场景：场景名称=@场景N\`）外，具体镜头的画面动作描述中**严禁**包含任何资产 ID 标签。
11. **JSON 响应**：必须返回符合 Schema 的 JSON 对象。

【目标分段剧本内容】：
${segment.plotAnchor}
【当前已绑定的资产】：
角色：${this.sanitizePrompt(segment.assets.characters)}
场景：${this.sanitizePrompt(segment.assets.scenes)}
道具：${this.sanitizePrompt(segment.assets.props)}

请直接返回提示词字符串。**必须包含该分段内的所有剧本台词，并遵循“角色名：‘台词内容’”的格式。**`;

    const imageParts: any[] = [];
    if (spatialMode === 'strong') {
      const seenImageUrls = new Set<string>();
      for (const asset of allAssets) {
        if (asset.type === 'scene' && asset.generatedMedia?.mainImageUrl) {
          const url = asset.generatedMedia.mainImageUrl;
          if (!seenImageUrls.has(url)) {
            seenImageUrls.add(url);
            try {
               const { base64, mimeType } = await urlToBase64(url);
               imageParts.push({ text: `【场景示例图 - ${this.getAssetDisplayId(asset.id, 'scene', allAssets)} (${asset.name})】` });
               imageParts.push({ inlineData: { data: base64, mimeType } });
            } catch (e) {
               console.warn(`Failed to package scene image for coordinate inference in regenerate: ${url}`, e);
            }
          }
        }
      }
    }

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ 
          role: 'user', 
          parts: [
            ...imageParts,
            { text: prompt }
          ] 
        }],
        config: { 
          systemInstruction: DIRECTOR_AGENT_SYSTEM_INSTRUCTION, 
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              prompt: { type: "STRING" }
            },
            required: ["prompt"]
          }
        }
      }, config);
      
      let newPrompt = '';
      try {
        const json = this.extractJson(response.text || '{}');
        newPrompt = json.prompt || response.text || '';
      } catch (e) {
        newPrompt = response.text || '';
      }
      
      return this.cleanPromptText(newPrompt.trim());
    } catch (e) {
      console.error("Regenerate prompt failed:", e);
      throw e;
    }
  }

  public async generateDetailedDNA(asset: Asset, script: string, config?: Config): Promise<string> {
    const prompt = `你是一位资深编剧和美术指导。请根据剧本内容，为以下资产生成一份极其详尽的“DNA 详细资料”。
【资产信息】：
名称：${asset.name}
类型：${asset.type === 'character' ? '角色' : asset.type === 'scene' ? '场景' : '道具'}

【剧本参考】：
${script}

【极其重要】：
1. **格式要求**：请严格按照以下模板生成，不要包含任何 Markdown 格式（如 ## 或 **），直接输出纯文本。
2. **内容要求**：基于剧本内容进行合理推断和扩充。
3. **视觉一致性**：确保所有视觉特征（如人种、年龄、体型、脸型、发色等）在逻辑上是自洽的。
4. **语言要求**：统一使用**中文**。

【角色 DNA 模板】：
演员名称：[角色名]
角色定位：[如：主角/反派/神秘人/关键配角]
人种 / 民族：[如：黄种人/汉族/白人]
真实年龄：[具体数字]
性别：[男/女]
职业 / 身份：[详尽描述]
身高：[如：180cm]
发色：[如：黑色/金发]
发型：[详尽描述，如：高马尾]
标志性特征：[如：泪痣]
穿搭风格：[如：优雅高定]
妆容风格：[如：战损妆]
角色标签：[如：优雅 / 腹黑]

【场景 DNA 模板】：
场景名称：[场景名]
地点：[具体位置描述]
时间：[如：清晨/深夜/黄昏]
天气：[如：晴朗/阴雨]
氛围：[如：压抑/温馨]
环境描述：[详尽的视觉元素描述]
灯光：[如：冷色调强光]

【道具 DNA 模板】：
道具名称：[道具名]
材质：[如：金属/木质]
尺寸：[具体尺寸描述]
外观描述：[详尽的细节描述]

请直接输出生成的 DNA 文本：`;

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
          systemInstruction: DIRECTOR_AGENT_SYSTEM_INSTRUCTION,
          temperature: 0.7 
        }
      }, config);
      return response.text.trim();
    } catch (e) {
      console.error("Generate detailed DNA failed:", e);
      throw e;
    }
  }
}

export const aiDramaAgent = new AiDramaAgent();
export const directorAgent = aiDramaAgent;
