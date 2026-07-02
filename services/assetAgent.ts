import { Asset, Config, PipelineData, Segment } from "../types";
import { BaseAgent } from "./baseAgent";
import { SHARED_ASSET_RULES } from "./rules";
import { urlToBase64, expandVisualStyle } from "./utils";

export const ASSET_AGENT_SYSTEM_INSTRUCTION = `
你是一位资深美术指导和资产管理专家。你的核心使命是从剧本中精准提取资产，并为每个资产建立深度的视觉基因（DNA）和标准化的生成提示词。

## 一、 资产识别与提取原则
1. **资产识别**：逐行扫描剧本，识别所有核心角色、场景和关键道具。
2. **禁止拆分角色**：同一个角色在不同场景中的变化（如变装、受伤）应放入 \`variants\`，严禁作为独立角色。
3. **变装归属**：角色的服装、套装必须作为该角色的 \`variants\` 提取，严禁作为独立道具。
4. **语言策略**：资产名称 (name) 必须与剧本主语言一致。但资产的视觉细节描述 (details) 和提示词 (subAssets) **必须统一使用中文视觉指令集格式**。严禁在提示词中使用英文标签或长难句。

## 二、 视觉基因 (DNA) 提取
对于每个资产，必须提取详尽的视觉特征：
- **角色**：身高、人种（**绝对必须明确**：如白人、黑人、黄种人/亚裔等，严禁遗漏）、年龄、性别、职业、体型、脸型、发色发型、瞳色、标志性特征、穿搭风格等。
- **强制检查**：在生成角色提示词前，必须自检“核心身份”是否包含了明确的人种声明。如果剧本未提及，请根据语境合理推断一个最合适的人种并明确标注。
- **场景**：地点、时间段、天气、氛围、环境细节、灯光效果等。
- **道具**：材质、尺寸感、外观细节、成色状态等。

## 三、 资产生成硬规则
必须严格、逐字、无条件遵循以下规则生成提示词，严禁将多项细节合并为一段话，必须保持分行结构：

1. **角色 (Character)**：
   核心身份：[年龄/性别/人种/职业/性格眼神等核心特征。必须包含具体的面部特征描述，如高颧骨、深邃眼眸、皮肤质感等]
   妆容细节：[眉形/眼影/眼线/口红质地/底妆质感/腮红等具体描述。强调妆容的质感，如哑光、高光点缀、烟熏妆等]
   发型发色：[发型结构/颜色/发饰及其功能/细节修饰。描述发丝的质感，如根根分明、光泽感、逆光边缘发丝、凌乱美等]
   服装细节：[材质/款式/剪裁/色彩/暗纹等描述。必须包含具体的材质描述，如手工钩织、雪纺、丝绸、皮革纹理等]
   配饰细节：[鞋履/首饰/随身物件及其隐藏功能。描述配饰的材质与风格，如金色锁骨链、极简主义风格等]
   要求：专业时尚摄影质感,全身照,纯白背景,单人,单一视角,85mm焦段,f/1.8大光圈,极致皮肤细节(超写实毛孔),高端影棚3点式布光,严禁拼图,手中不拿任何道具

2. **场景 (Scene)**：
   核心身份：[场景名称]
   环境细节：[环境描述。包含具体的材质、纹理、植被、天气细节等]
   建筑风格：[建筑风格。具体的流派、材质、年代感等]
   空间布局：[空间布局。透视感、层次感描述]
   核心物件：[核心物件。具体的细节描述]
   光影与画风：[光影与画风描写。深度融合并拟合折射具体的光影氛围渲染（如灯光类型、冷暖对比、体积光等）与画面色彩比例、漫反射及质感表现。严格禁止直接照抄名词占位词（如“虚幻引擎5”、“好莱坞级电影调色”），必须写出具体的物理漫反射、冷暖色对比调子等细节表现，让绘图引擎能直接执行并富有艺术表现力]
   要求：广角镜头,全景/远景构图,严禁拼图

3. **道具 (Prop)**：
   核心身份：[道具名称]
   材质细节：[材质细节。具体的物理属性，如金属拉丝、磨砂质感、透明度、划痕细节等]
   光影表现：[光影表现. 影棚级布光，强调高光与阴影的对比，反射效果等]
   画风设定：[根据画面风格要点进行深度细化拟合的具体材质、光泽、颗粒及物理反射表现，绝对禁止直接使用通用大类名词占位]
   要求：影棚拍摄,严禁出现人物,严禁出现手部,仅展示道具主体,纯白背景,单一视角,微距摄影质感,极致细节,严禁拼图

4. **设定图/全景/布局 (Specialized Views)**：
   当目标是生成衍生资产时，必须遵循以下规则：
   - **角色设定图**：遵循【角色设定图指令集标准格式】。
   - **场景720全景**：遵循【场景720全景指令集标准格式】。
   - **场景布局图**：遵循【场景布局图指令集标准格式】。

## 四、 资产绑定与逻辑惯性
在将资产绑定到分镜时，必须考虑剧情的连续性。如果角色状态发生改变，后续段落应自动切换到对应的变体 ID。
`;

export class AssetAgent extends BaseAgent {
  public getAssetDisplayId(id: string, type: string, assetsList: Asset[]) {
    if (!id) return id;
    
    // Clean redundant @ prefixes
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

  public cleanPromptText(text: string): string {
    if (!text) return text;
    let cleaned = text
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
      .replace(/4K分辨率/g, '')
      .replace(/#\w{6}/g, '');

    return cleaned.trim();
  }

  public fuzzyBindAssets(data: any): PipelineData {
    if (Array.isArray(data)) {
      data = { segments: data, assets: [] };
    }

    if (!data.segments) return data;
    if (!data.assets) data.assets = [];

    if (!Array.isArray(data.segments)) return data;

    const currentVariants = new Map<string, string>();
    const convertedPropNames = new Set<string>();

    const scoreVariant = (variant: any, prompt: string, charName: string) => {
      if (!prompt) return 0;
      let score = 0;
      const cleanVariantName = (variant.name || '').replace(/^变装[：:]\s*/, '').trim();
      if (!cleanVariantName) return 0;

      const variantKeywords = ['穿着', '身穿', '换上', '换了', '戴着', '披着', '一身', '一套', '装扮', '服饰', '衣服', '礼服', '制服', '套装', '模样', '形象', '打扮', '造型', '服装', '款式', '样式', '变装', '形象', '状态', '样子'];
      
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

    data.segments.forEach((seg: Segment, index: number) => {
      if (typeof seg === 'string') {
        const prompt = (seg as string).trim();
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
      
      const hasCorrectBindings = (seg.assets.characters && seg.assets.characters.includes('=') && seg.assets.characters.includes('图')) ||
                                (seg.assets.scenes && seg.assets.scenes.includes('=') && seg.assets.scenes.includes('场景'));
      
      if (hasCorrectBindings) {
        const normalize = (str: string, type: string) => {
          if (!str) return '';
          const items = str.split(',').map(s => {
            const parts = s.split('=');
            if (parts.length < 2) return s;
            const idPartRaw = parts[1].trim();
            let id = idPartRaw.split(/[（(]/)[0].trim();
            const details = idPartRaw.includes('（') ? '（' + idPartRaw.split('（')[1] : idPartRaw.includes('(') ? '(' + idPartRaw.split('(')[1] : '';
            
            while (id && id.startsWith('@')) id = id.slice(1);
            
            return `${parts[0].trim()}=${this.getAssetDisplayId(id, type, data.assets)}${details}`;
          });

          // Deduplicate by name
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
        seg.assets.characters = normalize(seg.assets.characters, 'character');
        seg.assets.scenes = normalize(seg.assets.scenes, 'scene');
        seg.assets.props = normalize(seg.assets.props, 'prop');
      } else {
        if (index > 0 && seg.prompt.includes(`[承接 尾帧-${index - 1}]`)) {
          seg.assets.continuity = `[承接 尾帧-${index - 1}]`;
        }
      }

      const matchedVariantNames = new Set<string>();

      const currentChars = seg.assets.characters ? seg.assets.characters.split(',').map(s => s.trim()).filter(Boolean) : [];
      const foundChars = data.assets.filter((a: Asset) => {
        if (a.type !== 'character') return false;
        if (seg.prompt && (seg.prompt.includes(a.name) || (a.refName && seg.prompt.includes(a.refName)))) return true;
        if (a.variants && a.variants.length > 0) {
          return a.variants.some(v => {
            const cleanVName = (v.name || '').replace(/^变装[：:]\s*/, '').trim();
            return cleanVName.length > 1 && seg.prompt && seg.prompt.includes(cleanVName);
          });
        }
        return false;
      }).map((a: Asset) => {
        const details = a.details;
        let detailStr = '';
        if (details) {
          const parts = [];
          if (details.height) {
            const h = details.height;
            const hStr = (typeof h === 'string' && h.includes('cm')) ? h : `${h}cm`;
            parts.push(`身高${hStr}`);
          }
          if (details.clothing) parts.push(`穿着${details.clothing}`);
          if (details.appearance) parts.push(details.appearance);
          if (details.tags) parts.push(`标签：${details.tags}`);
          
          if (parts.length > 0) detailStr = `（${parts.join('，')}）`;
          if (details.voiceName && seg.prompt && (seg.prompt.includes(`${a.name}：`) || seg.prompt.includes(`${a.name}:`))) {
            detailStr += `角色说话音色=${details.voiceName}`;
          }
        }
        
        let finalId = a.id;
        let matchedVariant: any = undefined;
        let subSuffix = '';
        if (seg.prompt && (seg.prompt.includes(`${a.name}六视图`) || seg.prompt.includes(`${a.name}角色设定图`))) subSuffix = '_v';
        
        if (a.variants && a.variants.length > 0) {
          const scoredVariants = a.variants.map(v => ({
            variant: v,
            score: scoreVariant(v, seg.prompt, a.name)
          })).filter(sv => sv.score > 0)
             .sort((a, b) => b.score - a.score);

          if (scoredVariants.length > 0) {
            matchedVariant = scoredVariants[0].variant;
            finalId = `${a.id}_v${matchedVariant.id.replace('v', '')}`;
            const cleanName = (matchedVariant.name || '').replace(/^变装[：:]\s*/, '');
            matchedVariantNames.add(cleanName);
            matchedVariantNames.add(matchedVariant.name);
            currentVariants.set(a.id, matchedVariant.id);
          } else if (currentVariants.has(a.id)) {
            const lastVariantId = currentVariants.get(a.id)!;
            const lastVariant = a.variants.find(v => v.id === lastVariantId);
            if (lastVariant) {
              matchedVariant = lastVariant;
              finalId = `${a.id}_v${lastVariantId.replace('v', '')}`;
            }
          }
        }
        
        if (subSuffix) finalId += subSuffix;
        const variantName = matchedVariant ? ` (${matchedVariant.name.replace(/^变装[：:]\s*/, '')})` : '';
        const subName = subSuffix === '_v' ? ' (六视图)' : '';
        const displayId = this.getAssetDisplayId(finalId, 'character', data.assets);
        return `${a.name}${variantName}${subName}=${displayId}${detailStr}`;
      });

      const uniqueFoundChars = Array.from(new Set(foundChars));

      if (currentChars.length === 0 && uniqueFoundChars.length > 0) {
        seg.assets.characters = uniqueFoundChars.join(',');
      } else if (currentChars.length > 0) {
        const updatedChars = currentChars.map(cStr => {
          let [name, idPart] = cStr.split('=');
          if (!idPart) return cStr;
          let id = idPart.split(/[（(]/)[0].trim();
          let details = idPart.includes('（') ? '（' + idPart.split('（')[1] : idPart.includes('(') ? '(' + idPart.split('(')[1] : '';
          
          if (name.includes('六视图') && !id.endsWith('_v')) id += '_v';
          
          const asset = data.assets.find((a: Asset) => a.id === id || a.name === name.split(' (')[0]);
          if (asset && asset.type === 'character' && asset.variants) {
            const scoredVariants = asset.variants.map((v: any) => ({
              variant: v,
              score: scoreVariant(v, seg.prompt, asset.name)
            })).filter((sv: any) => sv.score > 0)
               .sort((a: any, b: any) => b.score - a.score);

            if (scoredVariants.length > 0) {
              const matchedVariant = scoredVariants[0].variant;
              const newId = `${asset.id}_v${matchedVariant.id.replace('v', '')}${id.endsWith('_v') ? '_v' : ''}`;
              matchedVariantNames.add(matchedVariant.name);
              const variantName = ` (${(matchedVariant.name || '').replace(/^变装[：:]\s*/, '')})`;
              const baseName = name.split(' (')[0];
              const subName = id.endsWith('_v') ? ' (六视图)' : '';
              const displayId = this.getAssetDisplayId(newId, 'character', data.assets);
              return `${baseName}${variantName}${subName}=${displayId}${details}`;
            }
          }
          const displayId = this.getAssetDisplayId(id, 'character', data.assets);
          return `${name}=${displayId}${details}`;
        });
        seg.assets.characters = Array.from(new Set(updatedChars)).join(',');
      }
      
      const currentScenes = seg.assets.scenes ? seg.assets.scenes.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (currentScenes.length === 0) {
        const firstScene = data.assets.find((a: Asset) => a.type === 'scene');
        if (firstScene) {
          let sceneDetail = '';
          if (firstScene.details) {
            const parts = [];
            if (firstScene.details.environment) parts.push(firstScene.details.environment);
            if (firstScene.details.lighting) parts.push(firstScene.details.lighting);
            if (parts.length > 0) sceneDetail = `（${parts.join('，')}）`;
          }
          
          let finalId = firstScene.id;
          let subName = '';
          
          const displayId = this.getAssetDisplayId(finalId, 'scene', data.assets);
          seg.assets.scenes = `${firstScene.name}${subName}=${displayId}${sceneDetail}`;
        }
      } else {
        const updatedScenes = currentScenes.map(sStr => {
          let [name, idPart] = sStr.split('=');
          if (!idPart) return sStr;
          let id = idPart.split(/[（(]/)[0].trim();
          let details = idPart.includes('（') ? '（' + idPart.split('（')[1] : idPart.includes('(') ? '(' + idPart.split('(')[1] : '';
          
          const displayId = this.getAssetDisplayId(id, 'scene', data.assets);
          return `${name}=${displayId}${details}`;
        });
        seg.assets.scenes = updatedScenes.join(', ');
      }

      const currentProps = seg.assets.props ? seg.assets.props.split(',').map(s => s.trim()).filter(Boolean) : [];
      const propsInPrompt = data.assets.filter((a: Asset) => a.type === 'prop' && seg.prompt && seg.prompt.includes(a.name));
      const charsInPrompt = data.assets.filter((a: Asset) => a.type === 'character' && seg.prompt && seg.prompt.includes(a.name));
      
      propsInPrompt.forEach(p => {
        charsInPrompt.forEach(c => {
          const wearKeywords = ['穿着', '身穿', '戴着', '披着', '换上', '换了', '一身', '一套', '装扮', '服饰'];
          const isWearing = wearKeywords.some(kw => seg.prompt && (seg.prompt.includes(`${c.name}${kw}${p.name}`) || seg.prompt.includes(`${kw}${p.name}`)));
          
          if (isWearing) {
            matchedVariantNames.add(p.name);
            convertedPropNames.add(p.name);
            if (!c.variants) c.variants = [];
            let v = c.variants.find(v => 
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
            
            const charBindings = seg.assets.characters.split(',').map(s => s.trim()).filter(Boolean);
            const updatedCharBindings = charBindings.map(cb => {
              if (cb.startsWith(`${c.name}=${c.id}`)) {
                return `${c.name} (${v!.name.replace(/^变装[：:]\s*/, '')})=${c.id}_v${v!.id.replace('v', '')}`;
              }
              return cb;
            });
            seg.assets.characters = updatedCharBindings.join(', ');
          }
        });
      });

      const foundProps = data.assets.filter((a: Asset) => 
        a.type === 'prop' && 
        seg.prompt && seg.prompt.includes(a.name) && 
        !matchedVariantNames.has(a.name)
      ).map((a: Asset) => `${a.name}=${this.getAssetDisplayId(a.id, 'prop', data.assets)}`);

      if (currentProps.length === 0 && foundProps.length > 0) {
        seg.assets.props = foundProps.join(',');
      } else if (currentProps.length > 0) {
        const filteredProps = currentProps.filter(pStr => {
          const name = pStr.split('=')[0];
          return !matchedVariantNames.has(name);
        });
        seg.assets.props = filteredProps.join(',');
      }
    });

    data.assets = data.assets.filter((a: Asset) => {
      if (a.type === 'prop') {
        if (convertedPropNames.has(a.name)) return false;
        const clothingKeywords = ['衣服', '套装', '礼服', '西装', '裙子', '玩偶服', '变装', '服饰', '装扮', '造型', '服装', '款式', '样式', '模样', '形象', '样子', '大衣', '外套', '衬衫', '裤子', '鞋子', '帽子', '围巾', '手套', '制服', '运动服', '睡衣', '泳衣', '婚纱', '铠甲', '盔甲', '战袍', '披风', '斗篷', '面具', '头饰', '首饰', '项链', '耳环', '戒指', '手链', '手表', '眼镜', '墨镜', '领带', '领结', '腰带', '皮带', '袜子', '丝袜', '内衣', '内裤', '睡袍', '浴袍', '睡裙', '睡裤'];
        return !clothingKeywords.some(kw => a.name.includes(kw));
      }
      return true;
    });

    return data;
  }

  public mergeAssetIntoList(mergedAssets: Asset[], na: any) {
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

  public async analyzeImageForDNA(imageUrl: string, assetType: string, config?: Config): Promise<any> {
    const prompt = `你是一位资深美术指导。请深度分析这张参考图，并提取其核心视觉基因（DNA）。
【极其重要】：
1. **分析维度**：请根据资产类型（${assetType}）提取详细的视觉特征。
2. **输出格式**：必须返回 JSON 格式，包含 details 字段。
3. **语言要求**：所有描述必须使用**中文**。

如果是角色 (character)，请提取：
- height (身高，如 175)
- nationality (国籍/人种)
- race (人种/民族)
- age (真实年龄)
- visualAge (视觉年龄)
- gender (性别)
- role (角色定位)
- occupation (职业/身份)
- weight (体重)
- bodyType (体型)
- posture (体态特征)
- faceShape (脸型)
- eyeColor (眼睛/瞳色)
- nose (鼻子特征)
- lips (嘴唇特征)
- skinColor (皮肤特征)
- hairColor (发色)
- hairStyle (发型)
- features (标志性特征)
- clothing (穿搭风格描述)
- clothingColor (穿搭色系描述)
- makeup (妆容风格)
- accessories (配饰)
- tags (角色标签)
- appearance (核心长体特征描述)

如果是场景 (scene)，请提取：
- location (地点)
- timeOfDay (时间段)
- weather (天气)
- atmosphere (氛围)
- environment (环境细节描述)
- lighting (灯光效果)

如果是道具 (prop)，请提取：
- material (材质)
- size (尺寸感)
- appearance (外观细节描述)
- condition (成色/状态)

请返回 JSON：
{
  "details": { ... },
  "suggestedMainPrompt": "基于此图生成的标准化主图提示词（必须使用中文）"
}
【极其重要】：所有描述和提示词必须使用中文。`;

    try {
      const { base64, mimeType } = await urlToBase64(imageUrl);
      const response = await this.callApi('script', 'generateContent', {
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: prompt }
          ]
        }],
        config: {
          systemInstruction: ASSET_AGENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.1
        }
      }, config);
      return this.extractJson(response.text, { details: {}, suggestedMainPrompt: "" });
    } catch (e) {
      console.error("Analyze image for DNA failed:", e);
      return { details: {}, suggestedMainPrompt: "" };
    }
  }

  public async preScanAssets(script: string, visualStyle?: string, config?: Config, existingAssets: Asset[] = [], styleImageUrl?: string): Promise<Asset[]> {
    const expandedStyle = expandVisualStyle(visualStyle);

    const existingAssetsInstruction = existingAssets.length > 0 
      ? `\n\n【已有资产库参考（必须严格复用 ID）】：\n${existingAssets.map(a => {
          const variantsStr = a.variants && a.variants.length > 0 
            ? ` [已有变装: ${a.variants.map(v => `${v.name}(${this.getAssetDisplayId(a.id + '_v' + v.id.replace('v', ''), a.type, existingAssets)})`).join(', ')}]`
            : '';
          return `- ID: ${a.id} (展示型ID: ${this.getAssetDisplayId(a.id, a.type, existingAssets)}), 类别: ${a.type}, 名称: ${a.name}${variantsStr}`;
        }).join('\n')}`
      : '';

    const styleInstruction = styleImageUrl 
      ? `\n\n【视觉风格参考图】：你现在可以直接“看到”用户上传的风格参考图。在提取资产时，请深度集成该图的视觉特征：
1. **角色 DNA**：从参考图中提取发型结构、肤色质感、标志性特征，并与剧本描述融合。
2. **场景细节**：场景的建筑流派、光影氛围（如丁达尔效应、冷暖对比）、材质细节必须从参考图中精准平移。
3. **配色方案**：强制提取参考图的色调逻辑，确保所有资产的色彩基调统一。`
      : '';

    const prompt = `你是一位资深美术指导。请从剧本中提取所有核心资产（角色、场景、道具）。${styleInstruction}
【极其重要】：
1. **画面画风与画风设定拆解（最高优先级）**：
   - 当前总体的【画面画风要点】为：\`${expandedStyle}\`。
   - 在生成场景(scene)和道具(prop)的「画风设定」字段时，**严禁**直接照抄简单的画风名词或高层风格总结（如“好莱坞级电影调色”、“虚幻引擎5渲染质感”、“极简主义”等占位占空符）。
   - 你必须根据当前的总体【画面画风要点】，为场景/道具定制具体可让 AI 图像生成引擎（如 Midjourney、Stable Diffusion）直接执行并渲染的物理漫反射、冷暖色对比调子、摄像机质感描述！
   - 例如：如果画面风格中有“好莱坞电影级调色”，你应该拆解描述为色彩对比和电影感光照（如青橙反差调子、高动态范围对比等），绝对不能在「画风设定」中简单写一个名词大类，必须极细致地铺陈开具有高度艺术自洽的视觉指令！
2. **资产识别**：请逐行扫描剧本，确保不遗漏任何有台词或有重要动作的角色、场景和关键道具。
3. **语言策略**：资产名称 (name) 必须与剧本主语言一致。但资产的视觉细节描述 (details) 和提示词 (subAssets) **必须统一使用中文视觉指令集格式**。严禁在提示词中使用英文标签或长难句。
4. **禁止拆分角色**：同一个角色在不同场景中的变化应放入 \`variants\`。
5. **变装归属**：角色的服装、套装必须作为该角色的 \`variants\` 提取，严禁作为独立道具。
6. **视觉指令集生成 (subAssets & variants)**：必须严格遵循以下【视觉指令集标准】生成所有提示词。严禁生成英文标签，严禁生成长难句。

【角色视觉指令集标准格式】：
核心身份：[年龄/性别/人种/职业/性格眼神等核心特征。必须包含具体的面部特征描述，如高颧骨、深邃眼眸、皮肤质感等]
妆容细节：[眉形/眼影/眼线/口红质地/底妆质感/腮红等具体描述。强调妆容的质感，如哑光、高光点缀、烟熏妆等]
发型发色：[发型结构/颜色/发饰及其功能/细节修饰。描述发丝的质感，如根根分明、光泽感、凌乱美等]
服装细节：[材质/款式/剪裁/色彩/暗纹等描述。必须包含具体的材质描述，如手工钩织、雪纺、丝绸、皮革纹理等]
配饰细节：[鞋履/首饰/随身物件及其隐藏功能。描述配饰的材质与风格，如金色锁骨链、极简主义风格等]
要求：专业时尚摄影质感,全身照,纯白背景,单人,单一视角,85mm焦段,f/1.8大光圈,极致皮肤细节(超写实毛孔),高端影棚3点式布光,严禁拼图,手中不拿任何道具

【场景标准格式】：
核心身份：[场景名称]
环境细节：[环境描述。包含具体的材质、纹理、植被、天气细节等]
建筑风格：[建筑风格。具体的流派、材质、年代感等]
空间布局：[空间布局。透视感、层次感描述]
核心物件：[核心物件。具体的细节描述]
光影与画风：[根据目前画面画风要点【${expandedStyle}】深度拟合拆解，将光影氛围环境（灯光类型、冷暖色对比等）及渲染画风（色彩比例、漫反射与质感表现等）融合成一个完整句段，严禁套用普通的通用画风名字（如“虚幻引擎5”、“好莱坞电影级调色”）等名词占位，写出精细真实的物理反光与大师电影镜头调控细节]
要求：广角镜头,全景/远景构图,严禁拼图

【道具标准格式】：
核心身份：[道具名称]
材质细节：[材质细节。具体的物理属性，如金属拉丝、磨砂质感、等理化细节]
光影表现：[光影表现。影棚级布光，强调高光与阴影时的对比，反射效果等]
画风设定：[根据画面风格要点【${expandedStyle}】深度细化描述的具体材质与打光纹理表现描述，切勿使用普通的分类名词占位，必须铺陈极其硬核的漫反射及金属/玻璃高级感纹路质地描述]
要求：影棚拍摄,严禁出现人物,严禁出现手部,仅展示道具主体,纯白背景,单一视角,微距摄影质感,极致细节,严禁拼图

【场景720全景标准格式】：
核心身份：[场景名称]
环境细节：[环境描述]
画风设定：Generate a high-quality 720-degree equirectangular projection panorama based on ${expandedStyle}...
要求：720全景,广角镜头,全景构图

【场景布局图标准格式】：
核心身份：[场景名称]
环境细节：[环境描述]
布局规范：上面是四向视图（2x2网格），下面是俯视布局图。
画风设定：电影级写实摄影质感，基于：${expandedStyle}，写出精细真实的物理反光与纹路凹凸等。
要求：布局图,俯视图,顶视角,高质感渲染,严禁黑白线条稿

${existingAssetsInstruction}

剧本内容：
${script}

请返回 JSON 格式：
{
  "assets": [
    {
      "id": "char_1",
      "name": "角色名",
      "type": "character",
      "details": { 
        "appearance": "中文描述面部、人种、年龄等", 
        "clothing": "中文描述服装细节",
        "height": "身高，如 175cm",
        "tags": "核心关键词"
      },
      "subAssets": { 
        "mainPrompt": "核心身份：...\n妆容细节：...\n发型发色：...\n服装细节：...\n配饰细节：...\n要求：全身照,纯白背景,单人,单一视角,严禁拼图,手中不拿任何道具", 
        "secondaryPrompt": "核心身份：...\n妆容细节：...\n发型发色：...\n服装细节：...\n配饰细节：...\n要求：六视图,纯白背景,单人,严禁拼图,手中不拿任何道具",
        "costumePrompt": "核心身份：[必须保留主图核心特征]\n变装内容：[描述剧本中特定的不同服装变化]\n妆容调整：[根据当前剧情调整，如战损、晕妆等]\n要求：专业时尚摄影质感,全身照,纯白背景,单人,单一视角,85mm焦段,f/1.8大光圈,极致皮肤细节,高端影棚3点式布光,严禁拼图,手中不拿任何道具"
      },
      "variants": [
        { "id": "v1", "name": "变装名称", "prompt": "核心身份：[必须保留主图核心特征]\n变装内容：[描述具体服装变化，需符合剧本当前情境]\n妆容调整：[根据当前剧情调整，如战损、晕妆等]\n要求：全身照,纯白背景,单人,单一视角,严禁拼图" }
      ]
    }
  ]
}
【极其重要】：如果剧本中角色在不同场景穿着不同（如：从礼服换成泳装），或者状态不同（如：从整洁变为凌乱/受伤），你必须提取为该角色的 costumePrompt 或 variants 变体，并在 prompt 中写出完整的、符合变体要求的提示词词组，严禁作为独立角色或忽略。`;

    try {
      const parts: any[] = [{ text: prompt }];
      if (styleImageUrl) {
        try {
          const { base64, mimeType } = await urlToBase64(styleImageUrl);
          parts.unshift({ inlineData: { data: base64, mimeType } });
        } catch (err) {
          console.error("Failed to load style image for pre-scan:", err);
        }
      }

      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: ASSET_AGENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.1
        }
      }, config);
      const result = this.extractJson(response.text, { assets: [] });
      
      const parsedAssets = Array.isArray(result.assets) ? result.assets : [];
      
      parsedAssets.forEach((na: any) => {
        // Ensure subAssets has required fields
        if (!na.subAssets) {
          na.subAssets = {
            mainPrompt: '',
            secondaryPrompt: '',
            costumePrompt: ''
          };
        }

        // Clean up costumePrompt if it has placeholder annotations
        if (na.subAssets.costumePrompt === 'null' || na.subAssets.costumePrompt === null || (typeof na.subAssets.costumePrompt === 'string' && (na.subAssets.costumePrompt.includes('如果没有变装') || na.subAssets.costumePrompt.trim() === ''))) {
          na.subAssets.costumePrompt = '';
        }

        // Clean up variants list
        if (na.variants && Array.isArray(na.variants)) {
          na.variants = na.variants.filter((v: any) => v && v.prompt && !v.prompt.includes('如果没有多套变装') && v.prompt !== 'null' && v.name && !v.name.includes('[描述]'));
        }

        // Safety check: force standard photo requirement suffix for characters' mainPrompts
        if (na.type === 'character' && na.subAssets.mainPrompt) {
          const suffix = '\n要求：影棚拍摄,全身照,纯白背景,单人,单一视角,严禁拼图,手中不拿任何道具。';
          if (!na.subAssets.mainPrompt.includes('要求：') && !na.subAssets.mainPrompt.includes('要求:') && (!na.subAssets.mainPrompt.includes('影棚拍摄') || !na.subAssets.mainPrompt.includes('全身照') || !na.subAssets.mainPrompt.includes('手中不拿任何道具'))) {
            na.subAssets.mainPrompt = na.subAssets.mainPrompt.replace(/[，。！,.!]$/, '') + suffix;
          }
        }

        // Apply visual suffix to costumePrompt if present
        if (na.type === 'character' && na.subAssets.costumePrompt) {
          const costumeSuffix = '\n要求：专业时尚摄影质感,全身照,纯白背景,单人,单一视角,85mm焦段,f/1.8大光圈,极致皮肤细节,高端影棚3点式布光,严禁拼图,手中不拿任何道具。';
          if (!na.subAssets.costumePrompt.includes('要求：') && !na.subAssets.costumePrompt.includes('要求:') && !na.subAssets.costumePrompt.includes('影棚拍摄') && !na.subAssets.costumePrompt.includes('专业时尚摄影')) {
            na.subAssets.costumePrompt = na.subAssets.costumePrompt.replace(/[，。！,.!]$/, '') + costumeSuffix;
          }
        }

        // Apply visual suffix to variants prompts
        if (na.type === 'character' && na.variants && Array.isArray(na.variants)) {
          na.variants = na.variants.map((v: any) => {
            const costumeSuffix = '\n要求：专业时尚摄影质感,全身照,纯白背景,单人,单一视角,85mm焦段,f/1.8大光圈,极致皮肤细节,高端影棚3点式布光,严禁拼图,手中不拿任何道具。';
            if (v.prompt && !v.prompt.includes('要求：') && !v.prompt.includes('要求:') && !v.prompt.includes('影棚拍摄') && !v.prompt.includes('专业时尚摄影')) {
              v.prompt = v.prompt.replace(/[，。！,.!]$/, '') + costumeSuffix;
            }
            return v;
          });
        }
      });
      
      return this.cleanupAssets(parsedAssets);
    } catch (e) {
      console.error("Pre-scan assets failed:", e);
      throw e;
    }
  }

  public async generateSingleAssetPrompts(asset: Asset, visualStyle?: string, config?: Config, styleImageUrl?: string): Promise<Asset['subAssets']> {
    const expandedStyle = expandVisualStyle(visualStyle);
    let formatRequirement = "";

    if (asset.type === 'character') {
      formatRequirement = `必须严格按照以下结构分行输出：
核心身份：[年龄/性别/人种/职业/性格眼神等核心特征。必须包含具体的面部特征描述，如高颧骨、深邃眼眸、皮肤质感等]
妆容细节：[眉形/眼影/眼线/口红质地/底妆质感/腮红等具体描述。强调妆容的质感，如哑光、高光点缀、烟熏妆等]
发型发色：[发型结构/颜色/发饰及其功能/细节修饰。描述发丝的质感，如根根分明、光泽感、凌乱美等]
服装细节：[材质/款式/剪裁/色彩/暗纹等描述。必须包含具体的材质描述，如手工钩织、雪纺、丝绸、皮革纹理等]
配饰细节：[鞋履/首饰/随身物件及其隐藏功能。描述配饰的材质与风格，如金色锁骨链、极简主义风格等]
要求：专业时尚摄影质感,全身照,纯白背景,单人,单一视角,85mm焦段,f/1.8大光圈,极致皮肤细节(超写实毛孔),高端影棚3点式布光,严禁拼图,手中不拿任何道具`;
    } else if (asset.type === 'scene') {
      formatRequirement = `必须严格按照以下结构分行输出：
核心身份：[场景名称]
环境细节：[环境描述。包含具体的材质、纹理、植被、天气细节等]
建筑风格：[建筑风格。具体的流派、材质、年代感等]
空间布局：[空间布局。透视感、层次感描述]
核心物件：[核心物件。具体的细节描述]
光影与画风：[根据目前选择的画面画风【${expandedStyle}】深度拆解，转化为对图像引擎直接有指令性、深度融合光影氛围环境（灯光类型、冷暖色对比等）与渲染画风（色彩比例、漫反射与质感表现等）的完整中文描述段落。绝对禁止使用类似“好莱坞电影级调色”、“虚幻引擎5渲染质感”等高层名词占位符，写出让绘图引擎能直接执行、极富艺术表现力的具体绘图与质感参数细节]
要求：广角镜头,全景/远景构图,严禁拼图`;
    } else if (asset.type === 'prop') {
      formatRequirement = `必须严格按照以下结构分行输出：
核心身份：[道具名称]
材质细节：[材质细节。具体的物理属性，如金属拉丝、磨砂质感、透明度、划痕细节等]
光影表现：[光影表现. 影棚级布光，强调高光与阴影的对比，反射效果等]
画风设定：[根据目前选择的画面画风【${expandedStyle}】进行深度折射拟合拆解的具体材质表面与质地反射，绝对不可以直接照抄通用的风格大类名词]
要求：影棚拍摄,严禁出现人物,严禁出现手部,仅展示道具主体,纯白背景,单一视角,微距摄影质感,极致细节,严禁拼图`;
    }

    const styleInstruction = styleImageUrl ? `\n\n【视觉参考图已附带】：请务必使生成的提示词逻辑与参考图中的风格、材质、光影、配色保持高度一致。` : '';

    const prompt = `请为资产“${asset.name}”优化并生成标准化的生成提示词。${styleInstruction}
资产类型：${asset.type}
总体画面画风要点：${expandedStyle}
当前提示词：${this.sanitizePrompt(asset.subAssets?.mainPrompt || '无')}
资产详情参考：${this.sanitizePrompt(JSON.stringify(asset.details || {}))}

【极其重要】：
1. 必须严格遵守【资产生成硬规则 (拆解剧本标准)】。
2. 语言策略：资产的视觉细节描述 (details) 可以使用中文，但生成的提示词 (subAssets) **必须且只能使用中文**。严禁出现任何英文标签。
3. 提示词必须严格按照以下结构分行输出，严禁写成一段话：
${formatRequirement}
4. 如果已有“当前提示词”，请在其基础上进行润色和标准化，使其更符合绘图引擎的要求，同时确保包含所有关键视觉特征。
5. 每一项细节描述必须具有高度的视觉表现力。

请返回 JSON 格式：
{
  "mainPrompt": "...",
  "secondaryPrompt": "..."
}`;

    try {
      const parts: any[] = [{ text: prompt }];
      if (styleImageUrl) {
        try {
          const { base64, mimeType } = await urlToBase64(styleImageUrl);
          parts.unshift({ inlineData: { data: base64, mimeType } });
        } catch (err) {
          console.error("Failed to load style image for single asset gen:", err);
        }
      }

      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: ASSET_AGENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.1
        }
      }, config);
      return this.extractJson(response.text, { mainPrompt: "" });
    } catch (e) {
      console.error("Generate single asset prompts failed:", e);
      return { mainPrompt: "" };
    }
  }

  public async generateMainImage(asset: Asset, visualStyle?: string, config?: Config): Promise<{ imageUrl: string }> {
    const prompt = asset.subAssets.mainPrompt || "";
    if (!prompt) throw new Error("缺少资产提示词");

    try {
      const response = await this.callApi('image', 'generateImages', {
        prompt: prompt,
        config: {
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: '1024px'
          }
        }
      }, config);

      const imageUrl = response.images?.[0]?.url || "";
      if (!imageUrl) throw new Error("生成图片失败，未获取到 URL");
      return { imageUrl };
    } catch (e) {
      console.error("AssetAgent generateMainImage failed:", e);
      throw e;
    }
  }

  public cleanupAssets(assets: Asset[]): Asset[] {
    if (!assets || !Array.isArray(assets)) return [];
    
    const characters: Asset[] = [];
    const scenes = assets.filter(a => a && a.type === 'scene');
    const props = assets.filter(a => a && a.type === 'prop');
    
    // 1. Deduplicate and merge characters first
    const rawCharacters = assets.filter(a => a && a.type === 'character');
    rawCharacters.forEach(rc => {
      this.mergeAssetIntoList(characters, rc);
    });
    
    // Promote costumePrompt to character variants if present
    characters.forEach(char => {
      if (char.subAssets?.costumePrompt && char.subAssets.costumePrompt !== 'null' && typeof char.subAssets.costumePrompt === 'string' && char.subAssets.costumePrompt.trim()) {
        if (!char.variants) char.variants = [];
        const isAlreadyAdded = char.variants.some(v => v.prompt === char.subAssets.costumePrompt || v.name.includes('变装') || v.name === '换装');
        if (!isAlreadyAdded) {
          char.variants.push({
            id: `v${char.variants.length + 1}`,
            name: `变装：换装`,
            prompt: char.subAssets.costumePrompt
          });
        }
      }
    });

    const clothingKeywords = ['衣服', '套装', '礼服', '西装', '裙子', '玩偶服', '变装', '服饰', '装扮', '造型', '服装', '款式', '样式', '模样', '形象', '样子', '大衣', '外套', '衬衫', '裤子', '鞋子', '帽子', '围巾', '手套', '制服', '运动服', '睡衣', '泳衣', '婚纱', '铠甲', '盔甲', '战袍', '披风', '斗篷', '面具', '头饰', '首饰', '项链', '耳环', '戒指', '手链', '手表', '眼镜', '墨镜', '领带', '领结', '腰带', '皮带', '袜子', '丝袜', '内衣', '内裤', '睡袍', '浴袍', '睡裙', '睡裤'];

    const finalProps: Asset[] = [];

    // 2. Process props and move clothing to character variants
    props.forEach(p => {
      let movedToVariant = false;
      
      // Check if prop name includes a character name
      const ownerChar = characters.find(c => (p.name && c.name && (p.name.includes(c.name) || c.name.includes(p.name))));
      if (ownerChar) {
        if (!ownerChar.variants) ownerChar.variants = [];
        const variantName = (p.name || '').replace(ownerChar.name, '').replace(/[的's\s]+/g, '').trim() || p.name;
        const finalVariantName = variantName.startsWith('变装') ? variantName : `变装：${variantName}`;
        
        if (!ownerChar.variants.find(v => v.name === finalVariantName || v.name === p.name)) {
          ownerChar.variants.push({
            id: `v${ownerChar.variants.length + 1}`,
            name: finalVariantName,
            prompt: p.subAssets?.mainPrompt || ''
          });
        }
        movedToVariant = true;
      } else {
        const isClothing = clothingKeywords.some(kw => p.name && p.name.includes(kw));
        if (isClothing) {
          const targetChar = characters.length > 0 ? characters[0] : null;
          if (targetChar) {
            if (!targetChar.variants) targetChar.variants = [];
            const finalVariantName = p.name.startsWith('变装') ? p.name : `变装：${p.name}`;
            if (!targetChar.variants.find(v => v.name === finalVariantName)) {
              targetChar.variants.push({
                id: `v${targetChar.variants.length + 1}`,
                name: finalVariantName,
                prompt: p.subAssets?.mainPrompt || ''
              });
            }
            movedToVariant = true;
          }
        }
      }

      if (!movedToVariant) {
        finalProps.push(p);
      }
    });

    return [...characters, ...scenes, ...finalProps].filter(a => a && a.id && a.name);
  }

  protected sanitizePrompt(text: string): string {
    if (!text) return "";
    return text.replace(/[\n\r]/g, ' ');
  }
}

export const assetAgent = new AssetAgent();
