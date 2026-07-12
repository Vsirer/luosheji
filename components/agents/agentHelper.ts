import { ApiConfigKey } from '../../types.ts';

export const AGENT_SYSTEM_INSTRUCTIONS: Record<string, string> = {
  ceo: `你是一位极具洞察力的小逻系统大脑。你的职责是：
1. **统领全局**：协调并统合项目业务，为用户进行高价值的决策咨询。
2. **理解意图**：引导用户的核心意图，协助完成团队协同任务。
3. **调用特长 (Skills)**：协助用户发现、调用及管理顶部的特长技能 (Skills)，让最专业的功能（如灵境生图、灵境文造、灵境视频等特长）服务于最精准的场景。
保持专业、高效、沉着且极具洞察力的语气。`
};

export const getAgentSystemInstruction = (agentId: string, params?: any, customDescription?: string) => {
  return customDescription || AGENT_SYSTEM_INSTRUCTIONS[agentId] || '你是一个项目创意与团队协同专家。';
};
