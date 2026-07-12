import { EventBus, Capability } from './EventBus';
import { IntentRuntime } from './IntentRuntime';

export interface CapabilityPayload {
  prompt?: string;
  action?: string;
  [key: string]: any;
}

export interface CapabilityResult {
  success: boolean;
  output: any;
  providerUsed: string;
  attempts: number;
  error?: string;
}

class CapabilityBusService {
  private capabilities: Map<string, Capability> = new Map();

  constructor() {
    this.registerDefaultCapabilities();
  }

  private registerDefaultCapabilities() {
    const defaults: Capability[] = [
      { id: 'cap_think', name: '逻辑思考能力 (Think)', type: 'Think', provider: 'Gemini 3.5 / Claude 3.5', description: '自然语言深度逻辑推理、意图解析与DAG规划' },
      { id: 'cap_vision', name: '多模态感知能力 (Vision)', type: 'Vision', provider: 'Gemini 3.5 Multimodal', description: '视频帧分析、剧本分镜匹配、多视角视觉评估' },
      { id: 'cap_action', name: '数字资产创作能力 (Action)', type: 'Action', provider: 'Veo / Sora / Flux', description: '高品质生图、视频动画渲染、代码沙盒执行' },
      { id: 'cap_data', name: '数据存取持久化 (Data)', type: 'Data', provider: 'SQLite / OSS Storage', description: '向量库读写、会话记忆检索、数据库增删改查' },
      { id: 'cap_comm', name: '人机交互/团队协作 (Comm)', type: 'Comm', provider: 'Event Bus / Webhook', description: '协同空间实时推送、群组消息通知、任务挂起轮询' },
    ];
    defaults.forEach(cap => this.capabilities.set(cap.id, cap));
  }

  public register(capability: Capability) {
    this.capabilities.set(capability.id, capability);
    EventBus.publish('EVENT_TRIGGERED', 'CapabilityBus', capability, `[能力总线] 注册新系统能力 ➔ [${capability.name}] 由 [${capability.provider}] 驱动`);
  }

  public getCapability(id: string): Capability | undefined {
    return this.capabilities.get(id);
  }

  /**
   * Unified Capability Execution Gateway with context injection and fault-tolerance/recovery (自愈机制)
   */
  public async execute(capabilityId: string, payload: CapabilityPayload): Promise<CapabilityResult> {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      throw new Error(`Capability with id ${capabilityId} is not registered in the Capability Bus.`);
    }

    // Publish event indicating execution started
    EventBus.publish('CAPABILITY_CALLED', 'CapabilityBus', { capabilityId, payload }, `[能力总线] 调用能力 [${capability.name}] ➔ 承载方: ${capability.provider}`);

    // Context Engine Interceptor - Auto-enrich payload with system configurations (Brand, ratio, safety, model provider)
    const systemContext = IntentRuntime.getContext();
    const enrichedPayload = {
      ...payload,
      _context: {
        brandName: systemContext.brandName,
        ratio: systemContext.videoRatio,
        resolution: systemContext.resolution,
        safetyLevel: systemContext.safetyFilterLevel,
        modelProvider: systemContext.modelProvider,
        timestamp: Date.now()
      }
    };

    let attempts = 0;
    const maxRetries = systemContext.maxRetries;
    let success = false;
    let output: any = null;
    let errorMsg = '';
    let activeProvider = systemContext.modelProvider;

    // Simulate reliable Model Bus execution loop with multi-provider failover
    while (attempts < maxRetries && !success) {
      attempts++;
      try {
        // Simulate execution. In a real system, this connects to the actual Gemini/Claude API or tool framework
        if (capabilityId === 'cap_think') {
          // Simulate some intermittent failure on the first try if using high-tier models to demonstrate self-healing
          if (attempts === 1 && systemContext.modelProvider === 'Claude 3.5 Sonnet') {
            throw new Error('API Rate Limit Exceeded (429)');
          }
          output = {
            text: `[${activeProvider}] 成功对提示词进行深度解析并生成逻辑方案。融合品牌约束 "${systemContext.brandName}"。`,
            refinedPrompt: `${payload.prompt || '默认输入'} --style cinematic --ratio ${systemContext.videoRatio}`
          };
        } else if (capabilityId === 'cap_vision') {
          output = {
            aestheticScore: 94,
            integrityCheck: 'Passed',
            feedback: '构图饱满，色彩符合品牌基调。'
          };
        } else if (capabilityId === 'cap_action') {
          output = {
            assetUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
            resolution: systemContext.resolution,
            format: 'PNG'
          };
        } else if (capabilityId === 'cap_data') {
          output = {
            dbStatus: 'Success',
            recordsAffected: 1
          };
        } else {
          output = {
            status: 'Acknowledged',
            timestamp: Date.now()
          };
        }

        success = true;
      } catch (err: any) {
        errorMsg = err.message || String(err);
        
        // Dynamic Recovery: If primary model fails, switch to backup model (Model Bus routing)
        const fallbackProvider = activeProvider === 'Claude 3.5 Sonnet' ? 'Gemini 2.5 Pro' : 'Gemini 2.5 Flash';
        
        EventBus.publish('EVENT_TRIGGERED', 'RecoveryEngine', {
          error: errorMsg,
          attempt: attempts,
          failedProvider: activeProvider,
          fallbackProvider
        }, `[容灾自愈] 能力 [${capability.name}] 执行失败: ${errorMsg}。启动自动恢复机制 ➔ 尝试切换至备用模型 [${fallbackProvider}] (重试 ${attempts}/${maxRetries})`);
        
        activeProvider = fallbackProvider;
        await new Promise(r => setTimeout(r, 800)); // Delay for recovery stabilization
      }
    }

    if (success) {
      return {
        success: true,
        output,
        providerUsed: activeProvider,
        attempts
      };
    } else {
      EventBus.publish('EVENT_TRIGGERED', 'ReliabilityGuard', { capabilityId, error: errorMsg }, `[可靠性守卫] 能力 [${capability.name}] 经过 ${maxRetries} 次重试后彻底失败 ➔ 触发系统应急降级预案`);
      return {
        success: false,
        output: null,
        providerUsed: activeProvider,
        attempts,
        error: errorMsg
      };
    }
  }
}

export const CapabilityBus = new CapabilityBusService();
