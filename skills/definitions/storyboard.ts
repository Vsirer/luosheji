import { AiSkill } from "../types";

export const storyboardSkill: AiSkill = {
  id: "storyboard",
  name: "故事面板",
  desc: "自动分析剧情并生成故事分镜大面板",
  icon: "📋",
  instruction: `你是一位专业的分镜设计师。请根据用户输入的剧本/画面描述，自动分析并设计出一个结构完善、排版工整的故事分镜面板图（Storyboard Table）。

整个表格必须以一个干净整洁的横向分镜线稿表格形式呈现，背景为纯白色。
表格上方需带有精美的中文列标题：“镜头序号”、“景别”、“运镜”、“分镜素描图”、“提示词（剧情与分镜提示，使用工整排版的中文小黑体字）”、“时长 (s)”。

最关键要求：
1. 线条挺拔利落，构图精美饱满。
2. 表格内所有镜头的“时长 (s)”之和（累计总时长）必须严格控制在 15 秒以内（例如分散为 2s, 3s, 2s, 3s, 3s 等，总和不可超过 15s）。
3. 素描部分：人物A用粗重干净的蓝色马克笔线条勾勒，人物B用红色马克笔线条勾勒，场景和多余物件用炭黑或浅灰线勾勒，手绘素描风格。`,
  isSystem: true,
  isInstalled: true,
  isPublic: true,
  customOptions: [
    {
      id: "storyboardSegments",
      name: "格子数",
      choices: ["4格连贯连续镜头", "6格连贯连续镜头", "8格连贯连续镜头"]
    }
  ],
};
