import { Asset, Config } from "../types";
import { urlToBase64 } from "./utils";
import { imageAgent } from "./imageAgent";

export const DNA_AGENT_SYSTEM_INSTRUCTION = `你是一位资深的电影美术指导、选角导演和编剧。
你的核心任务是为影视作品中的资产（角色、场景、道具）建立极其详尽、具有高度视觉一致性的“视觉基因（DNA）”。

你擅长：
1. **深度图像分析**：从一张参考图中精准提取角色的外貌特征、场景的氛围灯光、道具的材质细节。
2. **剧本推断**：根据剧本中寥寥数语的描述，推断出角色应有的职业背景、体态特征、穿搭风格，并将其转化为具体的视觉参数。
3. **视觉标准化**：将感性的描述转化为标准化的提示词，确保 AI 绘图模型能够稳定地还原这些特征。

在分析或生成 DNA 时，你必须确保：
- 细节丰富：不放过任何一个微小的视觉特征。
- 逻辑自洽：角色的年龄、职业、穿着、体态必须符合逻辑。
- 格式严谨：严格遵守要求的 JSON 或 文本模板格式。`;

export class DnaAgent {
  private async callApi(type: 'script' | 'image' | 'video', method: string, body: any, config?: Config): Promise<any> {
    return imageAgent.callApi(type, method, body, config);
  }

  private extractJson(text: string, fallback: any = {}): any {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return fallback;
    } catch (e) {
      console.error("Failed to extract JSON:", e);
      return fallback;
    }
  }

  /**
   * 从参考图中分析并提取 DNA
   */
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
- appearance (核心长相特征描述)

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
  "suggestedMainPrompt": "基于此图生成的标准化主图提示词（中文）"
}`;

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
          systemInstruction: DNA_AGENT_SYSTEM_INSTRUCTION,
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

  /**
   * 根据剧本生成详细 DNA 文本
   */
  public async generateDetailedDNA(asset: Asset, script: string, config?: Config): Promise<string> {
    const prompt = `你是一位资深编剧和美术指导。请根据剧本内容，为以下资产生成一份极其详尽的“DNA 详细资料”。
【资产信息】：
名称：${asset.name}
类型：${asset.type === 'character' ? '角色' : asset.type === 'scene' ? '场景' : '道具'}

【剧本参考】：
${script}

【极其重要】：
1. **格式要求**：请严格按照以下模板生成，不要包含任何 Markdown 格式（如 ## 或 **），直接输出纯文本。
2. **内容要求**：基于剧本内容进行合理推断和扩充。**即使剧本中没有明确提到某些细节，你也必须根据角色的人设、职业、剧本背景进行合理的、符合逻辑的推断，确保所有字段都被详尽填充，严禁留空。**
3. **视觉一致性**：确保所有视觉特征（如人种、年龄、体型、脸型、发色等）在逻辑上是自洽的，并具有极高的视觉参考价值。
4. **语言要求**：统一使用**中文**。

【角色 DNA 模板】：
演员名称：[角色名]
角色定位：[如：主角/反派/神秘人/关键配角]
国籍 / 地区：[如：中国/欧美/日韩]
人种 / 民族：[如：黄种人/汉族/白人]
真实年龄：[具体数字]
视觉年龄：[具体数字]
性别：[男/女]
职业 / 身份：[详尽描述]
身高：[如：180cm]
体重：[如：75kg]
体型：[如：匀称/魁梧/纤细/健硕]
体态特征：[如：身姿挺拔/步履蹒跚/习惯性耸肩]
脸型：[如：鹅蛋脸/方脸/棱角分明]
眼睛：[描述颜色、形状、神态，如：深棕色、丹凤眼、目光锐利]
鼻子：[如：高挺/鹰钩鼻/小巧]
嘴唇：[如：薄唇/厚实/嘴角微翘]
皮肤：[如：冷白皮/古铜色/粗糙/细腻]
发色：[如：黑色/金发/银灰]
发型：[详尽描述，如：高马尾/寸头/波浪卷]
标志性特征：[如：左耳耳钉/眼角泪痣/刀疤/纹身]
穿搭风格：[如：优雅高定/街头潮流/复古武侠]
穿搭色系：[如：黑白灰/莫兰迪色/鲜艳撞色]
妆容风格：[如：伪素颜/浓妆/战损妆]
配饰：[如：金丝眼镜/十字架项链]
角色标签：[如：优雅 / 腹黑 / 刚正不阿]

【场景 DNA 模板】：
场景名称：[场景名]
地点：[详尽描述]
时间：[如：清晨/深夜/黄昏]
天气：[如：晴朗/暴雨/迷雾]
氛围：[如：压抑/温馨/神秘/赛博朋克]
环境描述：[详尽描述环境细节]
灯光：[如：冷色调强光/暖色调微光/霓虹灯]

【道具 DNA 模板】：
道具名称：[道具名]
材质：[如：金属/木质/玉石]
尺寸：[如：掌心大小/一人高]
成色/状态：[如：崭新/破旧/生锈]
外观描述：[详尽描述外观细节]`;

    try {
      const response = await this.callApi('script', 'generateContent', {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction: DNA_AGENT_SYSTEM_INSTRUCTION,
          temperature: 0.7
        }
      }, config);
      return response.text || "";
    } catch (e) {
      console.error("Generate detailed DNA failed:", e);
      return "";
    }
  }
}

export const dnaAgent = new DnaAgent();
