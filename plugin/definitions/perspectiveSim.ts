import { AiSkill } from "../../skills/types";

export const perspectiveSimSkill: AiSkill = {
  id: "perspective-sim",
  name: "3D导演台",
  desc: "精准控制3D场景与角色位置",
  icon: "🎥",
  instruction: "精准控制3D场景与角色位置",
  isSystem: true,
  isInstalled: true,
  isPublic: true,
  customOptions: [
    {
      id: "perspectiveFocalLength",
      name: "焦段",
      choices: ["24mm", "50mm", "85mm"]
    }
  ]
};
