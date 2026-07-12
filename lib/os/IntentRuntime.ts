import { EventBus, LifecycleState, BusinessState, Goal, Task, Intent } from './EventBus';
import { CapabilityBus } from './CapabilityBus';
import { MemoryCore } from './MemoryCore';

/**
 * Xiaoluo OS Core Intent Runtime Coordinator
 * Adheres strictly to Layer 3 (Intent Runtime Core) & Layer 2 (Actor Runtime) of Figure 2
 */

export interface SystemContext {
  brandName: string;
  videoRatio: '16:9' | '9:16' | '1:1';
  resolution: '1080p' | '4K';
  sandboxEnabled: boolean;
  maxRetries: number;
  safetyFilterLevel: 'Low' | 'Medium' | 'High';
  modelProvider: 'Gemini 2.5 Flash' | 'Gemini 2.5 Pro' | 'Claude 3.5 Sonnet';
}

class IntentRuntimeCoordinator {
  private currentLifecycle: LifecycleState = 'CREATED';
  private currentBusiness: BusinessState = 'NONE';
  
  private systemContext: SystemContext = {
    brandName: '奇迹影业 (Miracle Pictures)',
    videoRatio: '16:9',
    resolution: '1080p',
    sandboxEnabled: true,
    maxRetries: 3,
    safetyFilterLevel: 'Medium',
    modelProvider: 'Gemini 2.5 Pro'
  };

  constructor() {
    // Listen directly via EventBus to guarantee immediate synchronous state updates
    EventBus.subscribe('*', (event) => {
      const { type, payload } = event;
      
      if (type === 'INTENT_RECEIVED') {
        this.currentLifecycle = 'PLANNING';
        this.currentBusiness = 'WAITING_MODEL';
      } else if (type === 'GOAL_PLANNED') {
        const goal = payload as Goal;
        this.currentLifecycle = goal.lifecycle || 'RUNNING';
        this.currentBusiness = goal.businessState || 'NONE';
      } else if (type === 'TASK_STATUS_CHANGED') {
        const task = payload as Task;
        if (task.lifecycle === 'RUNNING') {
          this.currentLifecycle = 'RUNNING';
          if (task.type === 'script') {
            this.currentBusiness = 'WAITING_MODEL';
          } else if (task.type === 'image' || task.type === 'video') {
            this.currentBusiness = 'WAITING_TOOL';
          } else {
            this.currentBusiness = 'NONE';
          }
        } else if (task.lifecycle === 'COMPLETED') {
          this.currentBusiness = 'NONE';
        } else if (task.lifecycle === 'PAUSED') {
          this.currentLifecycle = 'PAUSED';
          this.currentBusiness = task.businessState || 'WAITING_REVIEW';
        } else if (task.lifecycle === 'FAILED') {
          this.currentLifecycle = 'FAILED';
          this.currentBusiness = 'NONE';
        }
      } else if (type === 'EVENT_TRIGGERED') {
        const stateUpdate = payload as any;
        if (stateUpdate && stateUpdate.lifecycle) {
          this.currentLifecycle = stateUpdate.lifecycle;
          this.currentBusiness = stateUpdate.business || 'NONE';
        }
      }
    });
  }

  public getContext(): SystemContext {
    return this.systemContext;
  }

  public updateContext(updated: Partial<SystemContext>) {
    this.systemContext = { ...this.systemContext, ...updated };
    EventBus.publish('CONTEXT_UPDATED', 'ContextEngine', this.systemContext, `上下文引擎：更新系统控制约束（${Object.keys(updated).join(', ')}）`);
  }

  public getStates() {
    return {
      lifecycle: this.currentLifecycle,
      business: this.currentBusiness
    };
  }

  /**
   * Set double-layer state machine status
   */
  public transitionState(lifecycle: LifecycleState, business: BusinessState, message: string) {
    this.currentLifecycle = lifecycle;
    this.currentBusiness = business;
    
    // Publish standard state update
    EventBus.publish('EVENT_TRIGGERED', 'StateMachine', {
      lifecycle,
      business,
      timestamp: Date.now()
    }, `[双层状态机] 切换状态 ➔ 生命周期的 [${lifecycle}] | 业务状态的 [${business}] - ${message}`);
  }

  /**
   * Parse a raw natural language prompt into standardized Intent
   */
  public parseIntent(rawText: string, source = 'UserChat'): Intent {
    let standardizedIntent = 'General Task Process';
    if (rawText.includes('脚本') || rawText.includes('文案') || rawText.includes('故事')) {
      standardizedIntent = 'Create Video Script (剧本创作)';
    } else if (rawText.includes('生图') || rawText.includes('插画') || rawText.includes('分镜')) {
      standardizedIntent = 'Storyboard Image Generation (分镜生图)';
    } else if (rawText.includes('视频') || rawText.includes('拉片') || rawText.includes('剪辑')) {
      standardizedIntent = 'Video Composition & Synthesis (视频拉片合成)';
    } else if (rawText.includes('规则') || rawText.includes('优化') || rawText.includes('调优')) {
      standardizedIntent = 'Model Pipeline Tuning (模型流水线调优)';
    }

    const intent: Intent = {
      id: 'int_' + Math.random().toString(36).substring(2, 7),
      rawText,
      standardizedIntent,
      source,
      timestamp: Date.now()
    };

    EventBus.publish('INTENT_RECEIVED', 'IntentGateway', intent, `[意图网关] 收到输入文本，成功路由解析至 ➔ [${standardizedIntent}]`);
    return intent;
  }

  /**
   * Simulate a DAG execution sequence complete with API errors, 
   * auto-retries, and dynamic replanning
   */
  public async simulateWorkflowExecution(promptText: string) {
    // 1. Receive Intent
    const intent = this.parseIntent(promptText, 'Simulator');
    
    // Memory Core: Store Intent in Working Memory
    MemoryCore.save('Working', 'active_intent', intent, '保存活跃意图对象');
    
    // Memory Core: Query Knowledge Base for brand and design policies
    const contextKnowledge = MemoryCore.queryKnowledge(`品牌 ${this.systemContext.brandName} ${this.systemContext.videoRatio}`);
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 2. Goal Planning
    this.transitionState('PLANNING', 'WAITING_MODEL', '目标引擎开始分析并生成 DAG 任务依赖图');
    
    const goalId = 'goal_' + Math.random().toString(36).substring(2, 7);
    const mockGoal: Goal = {
      id: goalId,
      intentId: intent.id,
      name: `创作流程 - ${intent.standardizedIntent.split(' (')[0]}`,
      rationale: `根据多维品牌约束 "${this.systemContext.brandName}" 规划 ${this.systemContext.videoRatio} 尺寸的最佳创作管线。`,
      lifecycle: 'PLANNING',
      businessState: 'WAITING_MODEL',
      dependencies: [],
      timestamp: Date.now()
    };
    
    // Memory Core: Store Goal in Working Memory
    MemoryCore.save('Working', 'active_goal', mockGoal, `初始化 DAG 目标: ${mockGoal.name}`);
    
    EventBus.publish('GOAL_PLANNED', 'GoalPlanner', mockGoal, `[目标引擎] 依赖分析完成，生成 DAG 规划，已结合专业知识库 ➔ [${contextKnowledge.length ? '已命中品牌基调与构图标准' : '使用系统默认配置'}]`);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 3. Task 1: Prompt optimization & compliance check
    this.transitionState('RUNNING', 'WAITING_MODEL', '调度模块执行首个子任务：提示词优化与安全合规核对');
    const taskId1 = 'task_' + Math.random().toString(36).substring(2, 7);
    const mockTask1: Task = {
      id: taskId1,
      goalId,
      name: '多维上下文合规核对',
      type: 'code',
      prompt: `核对生图提示词是否满足 ${this.systemContext.safetyFilterLevel} 安全级别要求`,
      lifecycle: 'RUNNING',
      businessState: 'WAITING_MODEL',
      dependsOn: [],
      assignedActorId: 'actor_brain',
      timestamp: Date.now()
    };
    EventBus.publish('TASK_STATUS_CHANGED', 'ActorRuntime', mockTask1, `[执行体运行时] 小逻大脑已接单：执行安全合规核对...`);
    
    // Capability Bus: Execute "cap_think" to optimize prompts and verify safety rules
    const result1 = await CapabilityBus.execute('cap_think', { prompt: mockTask1.prompt });
    
    // Memory Core: Store intermediate task result
    MemoryCore.save('Working', 'task_1_result', result1, '存储合规核对运行输出');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Finish Task 1
    mockTask1.lifecycle = 'COMPLETED';
    mockTask1.output = result1.output;
    EventBus.publish('TASK_STATUS_CHANGED', 'ActorRuntime', mockTask1, `[安全合规通过] 安全过滤器 [${this.systemContext.safetyFilterLevel}] 核对无误，注入安全沙盒模式。(执行器: ${result1.providerUsed})`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Task 2: Core Asset Creation (Simulate Error & Retry through CapabilityBus)
    this.transitionState('RUNNING', 'WAITING_TOOL', `正在调用模型生成核心资产，模型：${this.systemContext.modelProvider}`);
    const taskId2 = 'task_' + Math.random().toString(36).substring(2, 7);
    const mockTask2: Task = {
      id: taskId2,
      goalId,
      name: '核心插画/生图制作',
      type: 'image',
      prompt: `Futuristic cinematic scene, styled for ${this.systemContext.brandName}, cinematic light, ratio ${this.systemContext.videoRatio}`,
      lifecycle: 'RUNNING',
      businessState: 'WAITING_TOOL',
      dependsOn: [taskId1],
      assignedActorId: 'actor_image',
      timestamp: Date.now()
    };
    EventBus.publish('TASK_STATUS_CHANGED', 'ActorRuntime', mockTask2, `[模型总线] 调用 ${this.systemContext.modelProvider} 生图插画引擎，等待云端响应...`);
    
    // Capability Bus: Execute "cap_action" which triggers the built-in self-healing retry flow if rate limits occur!
    const result2 = await CapabilityBus.execute('cap_action', { prompt: mockTask2.prompt });
    
    // Memory Core: Store asset creation result
    MemoryCore.save('Working', 'task_2_result', result2, '存储生图制作输出');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Second Attempt Success (Reflect outcome from CapabilityBus)
    mockTask2.lifecycle = result2.success ? 'COMPLETED' : 'FAILED';
    mockTask2.output = result2.output ? { image_url: result2.output.assetUrl, resolution: result2.output.resolution } : null;
    
    if (result2.success) {
      EventBus.publish('TASK_STATUS_CHANGED', 'ActorRuntime', mockTask2, `[自愈成功] 最终执行成功！核心插画生成完毕！分辨率：${this.systemContext.resolution} (通过 ${result2.providerUsed} 恢复)`);
    } else {
      EventBus.publish('TASK_STATUS_CHANGED', 'ActorRuntime', mockTask2, `[执行失败] 核心插画生成失败: ${result2.error}`);
      this.transitionState('FAILED', 'NONE', '工作流运行由于不可恢复的模型错误而中断');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 5. Task 3: Quality Check
    this.transitionState('RUNNING', 'WAITING_REVIEW', '进入人工/审核挂起状态，等待二次多模态评估');
    const taskId3 = 'task_' + Math.random().toString(36).substring(2, 7);
    const mockTask3: Task = {
      id: taskId3,
      goalId,
      name: '多重视角质量评估',
      type: 'general',
      prompt: '评估视频拉片分镜的视觉统一性与流畅度',
      lifecycle: 'RUNNING',
      businessState: 'WAITING_REVIEW',
      dependsOn: [taskId2],
      assignedActorId: 'actor_human',
      timestamp: Date.now()
    };
    EventBus.publish('TASK_STATUS_CHANGED', 'ActorRuntime', mockTask3, `[任务状态挂起] 已分发至创作者协同空间，处于 WAITING_REVIEW 状态...`);
    
    // Capability Bus: Execute "cap_vision" to run aesthetic review
    const result3 = await CapabilityBus.execute('cap_vision', { prompt: mockTask3.prompt });
    
    // Memory Core: Store feedback
    MemoryCore.save('Working', 'task_3_result', result3, '存储视觉审查多模态评估');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Auto pass review for simulation flow
    mockTask3.lifecycle = 'COMPLETED';
    mockTask3.output = { score: result3.output.aestheticScore, approved: true };
    EventBus.publish('TASK_STATUS_CHANGED', 'ActorRuntime', mockTask3, `[审核通过] 创作者及多模态协同二次校对通过，质量评分: ${result3.output.aestheticScore}/100！`);
    
    // Memory Core: Promote current assets to LongTerm memory for persistence
    MemoryCore.save('LongTerm', `history_session_${Date.now()}`, {
      intent: intent.standardizedIntent,
      brand: this.systemContext.brandName,
      assetUrl: result2.output.assetUrl,
      score: result3.output.aestheticScore
    }, '持久化归档优秀数字资产');

    // Complete Goal
    mockGoal.lifecycle = 'COMPLETED';
    EventBus.publish('GOAL_PLANNED', 'GoalPlanner', mockGoal, `[工作管线结束] 目标 "${mockGoal.name}" 已圆满达成，释放系统 CPU/GPU 算力。`);
    
    // Memory Core: Clean transient working memory
    MemoryCore.clearWorkingMemory();
    
    this.transitionState('COMPLETED', 'NONE', '意图运行时圆满完成所有 DAG 任务，工作空间已重置，空闲中。');
  }
}

export const IntentRuntime = new IntentRuntimeCoordinator();
