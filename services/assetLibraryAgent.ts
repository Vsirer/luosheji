import { Asset, Config, PipelineData } from "../types";
import { BaseAgent } from "./baseAgent";
import { SHARED_ASSET_RULES } from "./rules";

export const ASSET_LIBRARY_AGENT_SYSTEM_INSTRUCTION = `
你是一位资深美术指导和资产库管理专家。你的核心使命是维护和优化全局资产库，确保每个资产的视觉一致性、DNA 深度以及提示词的专业性。

## 一、 资产库管理原则
1. **视觉一致性**：确保同一角色的所有变装 (variants) 保持面部特征、体型等核心 DNA 不变。
2. **逻辑严密性**：资产的视觉描述 (details) 必须详尽且具有可执行性，能够直接转化为高质量的生成提示词。
3. **分类清晰**：精准区分角色 (character)、场景 (scene)、道具 (prop) 和视觉参考 (continuity)。

## 二、 视觉基因 (DNA) 深度优化
对于资产库中的每个资产，你负责深度挖掘其视觉特征：
- **角色**：不仅包含基础外貌，还应包含气质、标志性动作、穿搭逻辑等。
- **场景**：包含空间布局、光影氛围、材质细节、季节感等。
- **道具**：包含工艺细节、使用痕迹、历史感、功能性外观等。

## 三、 资产生成硬规则
在优化或生成任何资产提示词时，必须严格、逐字、无条件遵循以下规则：
${SHARED_ASSET_RULES}

## 四、 智能变装与扩展
在设计资产变装 (variants) 时，应保持核心特征的一致性，仅在服装、妆造、环境适配度上进行专业扩展。
`;

export class AssetLibraryAgent extends BaseAgent {
  public async refineAssetDetails(asset: Asset, context: string, config?: Config): Promise<string> {
    const prompt = `请根据以下上下文信息，为资产“${asset.name}”优化并生成更详尽的视觉细节描述。
上下文信息：
${context}

当前详情：
${JSON.stringify(asset.details || {})}

请返回优化后的完整视觉描述（中文）：`;

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: ASSET_LIBRARY_AGENT_SYSTEM_INSTRUCTION,
          temperature: 0.2
        }
      }, config);
      return response.text;
    } catch (e) {
      console.error("Refine asset details failed:", e);
      return "";
    }
  }

  public async designAssetVariants(asset: Asset, count: number = 3, config?: Config): Promise<any[]> {
    const prompt = `请为资产“${asset.name}”设计 ${count} 个合理的视觉变装 (variants)。
资产详情：${JSON.stringify(asset.details || {})}

请返回 JSON 格式：
{
  "variants": [
    { "name": "变装名称", "description": "视觉描述", "prompt": "生成提示词" }
  ]
}`;

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: ASSET_LIBRARY_AGENT_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.7
        }
      }, config);
      const result = this.extractJson(response.text, { variants: [] });
      return result.variants || [];
    } catch (e) {
      console.error("Design asset variants failed:", e);
      return [];
    }
  }
}

export const assetLibraryAgent = new AssetLibraryAgent();
