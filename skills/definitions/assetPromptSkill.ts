import { AiSkill } from "../types";
import { ASSET_AGENT_SYSTEM_INSTRUCTION } from "../../components/agents/assetAgent";

export const assetPromptSkill: AiSkill = {
  id: "asset-prompt",
  name: "资产提示词",
  desc: "深度扫描剧本，精准提取核心角色、场景、道具资产，并建立标准的视觉基因（DNA）与生成提示词",
  icon: "📦",
  instruction: ASSET_AGENT_SYSTEM_INSTRUCTION,
  isSystem: true,
  isInstalled: true,
  isPublic: true,
  customOptions: [
    {
      id: "visualStyle",
      name: "视觉画风",
      choices: ["电影写实", "动漫插画", "赛博朋克", "复古颗粒"]
    }
  ],
};
