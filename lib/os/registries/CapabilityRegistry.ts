import { CapabilityDefinition, CapabilityKind } from '../types';

class CapabilityRegistryService {
  private items = new Map<string, CapabilityDefinition>();

  constructor() {
    this.registerDefaultCapabilities();
  }

  private registerDefaultCapabilities() {
    const defaults: CapabilityDefinition[] = [
      { 
        id: 'cap_think', 
        name: '逻辑思考能力 (Think)', 
        kind: 'text', 
        provider: 'Gemini 3.5 / Claude 3.5', 
        description: '自然语言深度逻辑推理、意图解析与DAG规划', 
        execute: async (input, context) => {
          return { status: 'success' };
        } 
      },
      { 
        id: 'cap_vision', 
        name: '多模态感知能力 (Vision)', 
        kind: 'vision', 
        provider: 'Gemini 3.5 Multimodal', 
        description: '视频帧分析、剧本分镜匹配、多视角视觉评估', 
        execute: async (input, context) => {
          return { status: 'success' };
        } 
      },
      { 
        id: 'cap_action', 
        name: '数字资产创作能力 (Action)', 
        kind: 'image', 
        provider: 'Veo / Sora / Flux', 
        description: '高品质生图、视频动画渲染、代码沙盒执行', 
        execute: async (input, context) => {
          return { status: 'success' };
        } 
      },
      { 
        id: 'cap_data', 
        name: '数据存取持久化 (Data)', 
        kind: 'data', 
        provider: 'SQLite / OSS Storage', 
        description: '向量库读写、会话记忆检索、数据库增删改查', 
        execute: async (input, context) => {
          return { status: 'success' };
        } 
      },
      { 
        id: 'cap_comm', 
        name: '人机交互/团队协作 (Comm)', 
        kind: 'browser', 
        provider: 'Event Bus / Webhook', 
        description: '协同空间实时推送、群组消息通知、任务挂起轮询', 
        execute: async (input, context) => {
          return { status: 'success' };
        } 
      },
    ];
    defaults.forEach(cap => this.register(cap));
  }

  public register(item: CapabilityDefinition) {
    this.items.set(item.id, item);
  }

  public unregister(id: string) {
    this.items.delete(id);
  }

  public get(id: string): CapabilityDefinition | undefined {
    return this.items.get(id);
  }

  public list(): CapabilityDefinition[] {
    return Array.from(this.items.values());
  }

  public has(id: string): boolean {
    return this.items.has(id);
  }

  public clear() {
    this.items.clear();
  }
}

export const CapabilityRegistry = new CapabilityRegistryService();
export default CapabilityRegistry;
