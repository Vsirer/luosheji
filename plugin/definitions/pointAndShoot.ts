import { AiSkill } from "../../skills/types.ts";

export const pointAndShootSkill: AiSkill = {
  id: "point-and-shoot",
  name: "指哪打哪",
  desc: "在场景中标记人物位置",
  icon: "🎯",
  instruction: "在场景中标记人物位置",
  isSystem: true,
  isInstalled: true,
  isPublic: true
};
