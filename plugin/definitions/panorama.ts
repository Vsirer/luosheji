import { AiSkill } from "../../skills/types";

export const panoramaSkill: AiSkill = {
  id: "panorama",
  name: "VR全景世界",
  desc: "生成专业级 720° 全景 VR 素材",
  icon: "🧭",
  instruction: `生成专业 720° 沉浸式全景图。

生成指令需引导AI输出：
1. 360度全景横向无缝拼接，水平轴向可完美漫游，无接缝畸变。
2. 采用等距柱状投影（Equirectangular projection）格式，以便渲染球体 3D VR。
3. 电影级真实材质，写实摄影或精美手绘风格，高空、宏大自然、室内家居、科幻机械等视觉主题均可完美诠释。`,
  isSystem: true,
  isInstalled: true,
  isPublic: true,
  customOptions: [
    {
      id: "panoramaRatio",
      name: "全景比例",
      choices: ["2:1 标准广域全景", "3:1 电影级宽景全画幅"]
    }
  ],
};
