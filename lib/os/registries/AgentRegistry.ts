import { AgentDefinition, Task, CapabilityKind, RuntimeTask, RuntimeContext } from '../types';
import { directorAgent } from '../../../components/agents/directorAgent';
import { imageAgent } from '../../../components/agents/imageAgent';
import { videoAgent } from '../../../components/agents/videoAgent';
import { aiDramaAgent } from '../../../components/agents/aiDramaAgent';
import { assetAgent } from '../../../components/agents/assetAgent';

class AgentRegistryService {
  private agents: Map<string, AgentDefinition> = new Map();

  constructor() {
    this.registerDefaultAgents();
  }

  private registerDefaultAgents() {
    const defaults: AgentDefinition[] = [
      {
        id: 'brainAgent',
        name: '小逻大脑 (BrainAgent)',
        role: '核心协调/总线调度',
        description: '系统中央大脑，进行意图路由与工作流规划',
        systemInstruction: '', // Populated by brainAgent
        capabilityKinds: ['text', 'workflow'],
        capabilities: ['cap_think', 'cap_comm'],
        skills: ['create-script', 'analyze-script', 'rewrite-script', 'office-pitch-deck', 'office-ad-script', 'office-brief-proposal'],
        modelPreference: 'gemini-3.5-flash',
        execute: async (task: Task, context: any) => {
          // Brain execution can trigger planning or run steps
          return { status: 'success', text: 'BrainAgent execute acknowledged.' };
        }
      },
      {
        id: 'directorAgent',
        name: '导演专家 (DirectorAgent)',
        role: '剧情分析与导演编排',
        description: '处理文本创意、故事脚本规划与拉片审计',
        systemInstruction: '',
        capabilityKinds: ['text', 'code'],
        capabilities: ['cap_think', 'cap_comm'],
        skills: ['create-script', 'analyze-script', 'rewrite-script'],
        modelPreference: 'gemini-3.5-flash',
        execute: async (task: Task, context: any) => {
          const model = context.config?.script?.model || 'gemini-3.5-flash';
          const response = await directorAgent.callApi('script', 'generateContent', {
            model,
            contents: [{ role: 'user', parts: [{ text: task.prompt }] }],
            config: { systemInstruction: context.systemInstruction || '', temperature: 0.7 }
          }, context.config);
          const text = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || "生成失败";
          return { text };
        }
      },
      {
        id: 'imageAgent',
        name: '生图专家 (ImageAgent)',
        role: '视觉插画与高精原画设计',
        description: '生成各种风格的分镜插画与设定原画',
        systemInstruction: '',
        capabilityKinds: ['image', 'vision'],
        capabilities: ['cap_vision', 'cap_action'],
        skills: ['six-view', 'scene-plan', 'grid-storyboard', 'panorama', 'camera-control'],
        modelPreference: 'gemini-3.1-flash-image-preview',
        execute: async (task: Task, context: any) => {
          const model = context.config?.image?.model || 'gemini-3.1-flash-image-preview';
          const imageConfig = {
            prompt: task.prompt,
            aspectRatio: (context.aspectRatio || '16:9') as any,
            model,
            imageSize: '1K' as any,
            referenceImages: []
          };
          const result = await imageAgent.generateSmartImage(imageConfig, context.config);
          const url = result.ossUrl || result.imageUrl;
          if (!url) throw new Error('Image creation returned empty URL');
          return { url, revisedPrompt: result.revisedPrompt };
        }
      },
      {
        id: 'videoAgent',
        name: '视频专家 (VideoAgent)',
        role: '动态合成与视效短片制作',
        description: '将原画或提示词合成为高物理一致性的精彩短视频',
        systemInstruction: '',
        capabilityKinds: ['video'],
        capabilities: ['cap_vision', 'cap_action'],
        skills: ['video-dissect'],
        modelPreference: 'seedance2.0',
        execute: async (task: Task, context: any) => {
          const model = context.config?.videoSeedance?.model || context.config?.video?.model || 'seedance2.0';
          const options = context.videoOptions || {
            aspectRatio: context.aspectRatio || '16:9',
            duration: context.duration || '5',
            model,
            image: context.imageUrl ? { imageBytes: '', mimeType: 'image/png' } : undefined,
            imageUrl: context.imageUrl
          };

          const result = await videoAgent.callApi('video', 'generateVideo', {
            prompt: task.prompt,
            ...options
          }, context.config);
          
          if (result && result.operationId) {
            let opStatus = { done: false, videoUrl: '', error: null as any, status: 'pending' };
            const startTime = Date.now();
            const timeout = 10 * 60 * 1000;
            
            while (!opStatus.done && (Date.now() - startTime < timeout)) {
              if (context.onProgress) {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                context.onProgress(`🎬 视频后台渲染中... 已经过 ${elapsed} 秒`);
              }
              await new Promise(r => setTimeout(r, 6000));
              opStatus = await videoAgent.getOperationStatus(result.operationId, context.config, model);
              if (opStatus.error) {
                throw new Error(`视频渲染引擎报错: ${opStatus.error}`);
              }
            }
            if (opStatus.videoUrl) {
              return { url: opStatus.videoUrl };
            } else {
              throw new Error("视频渲染超时，未获取到视频地址");
            }
          } else if (result && (result.videoUrl || result.url)) {
            return { url: result.videoUrl || result.url || result.ossUrl };
          }
          return { url: result.url || result.videoUrl || result.ossUrl || result };
        }
      },
      {
        id: 'aiDramaAgent',
        name: '剧组专家 (AIDramaAgent)',
        role: '剧组协同与演出调度',
        description: '协调多智能体剧组角色进行团队合作创作',
        systemInstruction: '',
        capabilityKinds: ['text', 'workflow'],
        capabilities: ['cap_think', 'cap_comm'],
        skills: [],
        modelPreference: 'gemini-3.5-flash',
        execute: async (task: Task, context: any) => {
          return (aiDramaAgent as any).executeTask ? (aiDramaAgent as any).executeTask(task, context) : { status: 'success' };
        }
      },
      {
        id: 'assetAgent',
        name: '资产专家 (AssetAgent)',
        role: '全局资产库智能管理',
        description: '分类与对齐数字资产、提供资产变装及状态扩展',
        systemInstruction: '',
        capabilityKinds: ['data'],
        capabilities: ['cap_data', 'cap_comm'],
        skills: ['asset-prompt', 'asset-library', 'dna-design'],
        modelPreference: 'gemini-3.5-flash',
        execute: async (task: Task, context: any) => {
          return (assetAgent as any).executeTask ? (assetAgent as any).executeTask(task, context) : { status: 'success' };
        }
      }
    ];

    defaults.forEach(a => this.register(a));
  }

  public register(agent: AgentDefinition) {
    this.agents.set(agent.id, agent);
  }

  public unregister(id: string) {
    this.agents.delete(id);
  }

  public get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  public list(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  public has(id: string): boolean {
    return this.agents.has(id);
  }

  public findByCapability(capabilityId: string): AgentDefinition[] {
    return this.list().filter(a => a.capabilities?.includes(capabilityId));
  }

  public findByCapabilityKind(kind: CapabilityKind): AgentDefinition[] {
    return this.list().filter(a => a.capabilityKinds?.includes(kind));
  }

  public findBestAgent(task: RuntimeTask, context?: RuntimeContext): AgentDefinition | undefined {
    // 1. Specific agent assigned
    if (task.agentId && this.has(task.agentId)) {
      return this.get(task.agentId);
    }
    if (task.assignedActorId && this.has(task.assignedActorId)) {
      return this.get(task.assignedActorId);
    }

    // 2. Map task type to CapabilityKind
    let taskType: any = task.type;
    if (taskType === 'script' || taskType === 'general') {
      taskType = 'text';
    }

    // 3. Find candidates
    const candidates = this.findByCapabilityKind(taskType as CapabilityKind);
    if (candidates.length > 0) {
      return candidates[0];
    }

    // 4. Default fallback
    if (taskType === 'image') {
      return this.get('imageAgent');
    }
    if (taskType === 'video') {
      return this.get('videoAgent');
    }
    return this.get('brainAgent') || this.list()[0];
  }
}

export const AgentRegistry = new AgentRegistryService();
export default AgentRegistry;
