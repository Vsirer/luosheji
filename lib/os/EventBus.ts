/**
 * Xiaoluo OS Core Event Bus & Core Object Model definitions
 * Adheres strictly to Figure 2 (Layered Agentic OS with Intent Runtime Core)
 */

export type LifecycleState = 'CREATED' | 'PLANNING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export type BusinessState = 'WAITING_USER' | 'WAITING_MODEL' | 'WAITING_TOOL' | 'WAITING_AGENT' | 'WAITING_REVIEW' | 'WAITING_PAYMENT' | 'NONE';

// 9 Core Object Models (9大核心对象模型)

/** 1. Intent (意图) - 用户的原始表达与标准化意图 */
export interface Intent {
  id: string;
  rawText: string;
  standardizedIntent: string;
  source: string; // e.g. 'chat', 'api', 'schedule'
  timestamp: number;
}

/** 2. Goal (目标) - 拆解、规划并可持续进化的 DAG 目标 */
export interface Goal {
  id: string;
  intentId: string;
  name: string;
  rationale: string;
  lifecycle: LifecycleState;
  businessState: BusinessState;
  dependencies: string[]; // Parent goals if any
  timestamp: number;
}

/** 3. Task (任务) - 最小可执行单元 */
export interface Task {
  id: string;
  goalId: string;
  name: string;
  type: 'script' | 'image' | 'video' | 'code' | 'ui' | 'general';
  prompt: string;
  lifecycle: LifecycleState;
  businessState: BusinessState;
  dependsOn: string[]; // Task IDs
  assignedActorId?: string;
  output?: any;
  error?: string;
  timestamp: number;
}

/** 4. Actor (执行体) - 包含 Agent、工作流、人工等 */
export interface Actor {
  id: string;
  name: string;
  role: string;
  type: 'Agent' | 'Workflow' | 'Human' | 'Script' | 'API' | 'Robot';
  status: 'idle' | 'busy' | 'suspended';
  capabilities: string[]; // Associated capability ids
}

/** 5. Capability (能力) - 统一封装的模型、工具和服务 */
export interface Capability {
  id: string;
  name: string;
  type: 'Think' | 'Vision' | 'Action' | 'Data' | 'Comm';
  provider: string; // e.g. 'Gemini 3.5', 'Veo', 'SDXL', 'SQL'
  description: string;
}

/** 6. State (状态) - 存储和查询全局生命周期与业务挂起状态 */
export interface State {
  objectId: string;
  objectType: 'Intent' | 'Goal' | 'Task' | 'Actor';
  lifecycle: LifecycleState;
  business: BusinessState;
  updatedAt: number;
}

/** 7. Context (上下文) - 多维感知上下文引擎 */
export interface Context {
  id: string;
  userContext?: Record<string, any>;
  projectContext?: Record<string, any>;
  brandContext?: Record<string, any>;
  environmentContext?: Record<string, any>;
  permissionContext?: Record<string, any>;
}

/** 8. Memory (记忆) - 多层次会话/长期存储 */
export interface Memory {
  id: string;
  type: 'Session' | 'Working' | 'LongTerm' | 'Knowledge';
  key: string;
  value: any;
  timestamp: number;
}

/** 9. Event (事件) - 内部系统发生的解耦通知 */
export interface SysEvent {
  id: string;
  type: 'INTENT_RECEIVED' | 'GOAL_PLANNED' | 'TASK_STATUS_CHANGED' | 'ACTOR_ACTIVATED' | 'CAPABILITY_CALLED' | 'MEMORY_STORED' | 'CONTEXT_UPDATED' | 'EVENT_TRIGGERED' | 'ARTIFACT_CREATED';
  source: string; // Component or service that emitted it
  payload: any; // Associated core object detail
  timestamp: number;
  message: string; // Human-friendly description of the event
}

// Event Bus subscription type
export type EventListener = (event: SysEvent) => void;

class EventBusService {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private eventLogs: SysEvent[] = [];
  private maxLogs = 200;

  // Track state of current active objects in runtime
  public currentIntent: Intent | null = null;
  public currentGoals: Goal[] = [];
  public currentTasks: Task[] = [];
  public currentActors: Actor[] = [];
  public currentCapabilities: Capability[] = [];

  constructor() {
    this.initializeDefaultActorsAndCapabilities();
  }

  private initializeDefaultActorsAndCapabilities() {
    // Standard Actors as defined in Layer 2 (Actor Runtime)
    this.currentActors = [
      { id: 'actor_brain', name: '小逻大脑 (BrainAgent)', role: '核心协调/总线调度', type: 'Agent', status: 'idle', capabilities: ['cap_think', 'cap_comm'] },
      { id: 'actor_script', name: '编剧专家 (ScriptAgent)', role: '文案与故事规划', type: 'Agent', status: 'idle', capabilities: ['cap_think', 'cap_comm'] },
      { id: 'actor_image', name: '生图专家 (ImageAgent)', role: '视觉插画/生图制作', type: 'Agent', status: 'idle', capabilities: ['cap_vision', 'cap_action'] },
      { id: 'actor_video', name: '视频专家 (VideoAgent)', role: '动效视频/生片合成', type: 'Agent', status: 'idle', capabilities: ['cap_vision', 'cap_action'] },
      { id: 'actor_human', name: '创作者 (Human)', role: '人类协同与二次校对', type: 'Human', status: 'idle', capabilities: ['cap_comm'] },
    ];

    // Standard Capabilities as defined in Layer 2 & 1 (Capability & Model Bus)
    this.currentCapabilities = [
      { id: 'cap_think', name: '逻辑思考能力 (Think)', type: 'Think', provider: 'Gemini 3.5 / Claude 3.5', description: '自然语言深度逻辑推理、意图解析与DAG规划' },
      { id: 'cap_vision', name: '多模态感知能力 (Vision)', type: 'Vision', provider: 'Gemini 3.5 Multimodal', description: '视频帧分析、剧本分镜匹配、多视角视觉评估' },
      { id: 'cap_action', name: '数字资产创作能力 (Action)', type: 'Action', provider: 'Veo / Sora / Flux', description: '高品质生图、视频动画渲染、代码沙盒执行' },
      { id: 'cap_data', name: '数据存取持久化 (Data)', type: 'Data', provider: 'SQLite / OSS Storage', description: '向量库读写、会话记忆检索、数据库增删改查' },
      { id: 'cap_comm', name: '人机交互/团队协作 (Comm)', type: 'Comm', provider: 'Event Bus / Webhook', description: '协同空间实时推送、群组消息通知、任务挂起轮询' },
    ];
  }

  /** Subscribe to all events or specific event type */
  public subscribe(type: string | '*', listener: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get(type);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(type);
        }
      }
    };
  }

  /** Publish an event into the System Event Bus */
  public publish(type: SysEvent['type'], source: string, payload: any, message: string) {
    const event: SysEvent = {
      id: 'evt_' + Math.random().toString(36).substring(2, 11),
      type,
      source,
      payload,
      timestamp: Date.now(),
      message
    };

    // Store in history
    this.eventLogs.unshift(event);
    if (this.eventLogs.length > this.maxLogs) {
      this.eventLogs.pop();
    }

    // Update local caches based on payload to reflect real-time State Machine
    this.processEventSideEffects(event);

    // Notify type-specific listeners
    const specificListeners = this.listeners.get(type);
    if (specificListeners) {
      specificListeners.forEach(listener => {
        try {
          listener(event);
        } catch (e) {
          console.error(`Error in event listener for ${type}:`, e);
        }
      });
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(listener => {
        try {
          listener(event);
        } catch (e) {
          console.error(`Error in wildcard event listener:`, e);
        }
      });
    }

    // Also dispatch as custom window event for React updates
    if (typeof window !== 'undefined') {
      const sysEvent = new CustomEvent('xiaoluo-os-event', { detail: event });
      window.dispatchEvent(sysEvent);
    }
  }

  private processEventSideEffects(event: SysEvent) {
    const { type, payload } = event;

    if (type === 'INTENT_RECEIVED') {
      this.currentIntent = payload as Intent;
      this.currentGoals = [];
      this.currentTasks = [];
    } 
    else if (type === 'GOAL_PLANNED') {
      const plannedGoal = payload as Goal;
      const index = this.currentGoals.findIndex(g => g.id === plannedGoal.id);
      if (index >= 0) {
        this.currentGoals[index] = plannedGoal;
      } else {
        this.currentGoals.push(plannedGoal);
      }
    } 
    else if (type === 'TASK_STATUS_CHANGED') {
      const updatedTask = payload as Task;
      const index = this.currentTasks.findIndex(t => t.id === updatedTask.id);
      if (index >= 0) {
        this.currentTasks[index] = updatedTask;
      } else {
        this.currentTasks.push(updatedTask);
      }

      // Update associated Actor status if assigned
      if (updatedTask.assignedActorId) {
        const actorIndex = this.currentActors.findIndex(a => a.id === updatedTask.assignedActorId);
        if (actorIndex >= 0) {
          this.currentActors[actorIndex].status = 
            updatedTask.lifecycle === 'RUNNING' ? 'busy' : 'idle';
        }
      }
    }
    else if (type === 'ACTOR_ACTIVATED') {
      const actorInfo = payload as Partial<Actor>;
      if (actorInfo.id) {
        const index = this.currentActors.findIndex(a => a.id === actorInfo.id);
        if (index >= 0) {
          this.currentActors[index] = { ...this.currentActors[index], ...actorInfo as Actor };
        }
      }
    }
  }

  public getLogs(): SysEvent[] {
    return this.eventLogs;
  }

  public clearLogs() {
    this.eventLogs = [];
  }
}

export const EventBus = new EventBusService();
