import { EventBus } from './EventBus';
import { IntentRuntime } from './IntentRuntime';
import { AgentRegistry } from './registries/AgentRegistry';
import { ModelRegistry } from './registries/ModelRegistry';
import { SkillRegistry } from './registries/SkillRegistry';
import { Task, RuntimeTask, RuntimeContext, CapabilityResult, CanvasArtifact } from './types';

export interface CapabilityPayload {
  prompt?: string;
  action?: string;
  task?: Task;
  imageUrl?: string;
  aspectRatio?: string;
  duration?: string;
  systemInstruction?: string;
  [key: string]: any;
}

class CapabilityBusService {
  constructor() {}

  /**
   * Unified Capability Execution Gateway supporting both:
   * 1. CapabilityBus.execute(task, context)
   * 2. CapabilityBus.execute(capabilityId, payload, context)
   */
  public async execute(
    capabilityIdOrTask: string | Task,
    payloadOrContext?: CapabilityPayload | any,
    context?: any
  ): Promise<CapabilityResult> {
    let task: Task;
    let systemContext: any = {};

    if (typeof capabilityIdOrTask === 'object') {
      task = capabilityIdOrTask;
      systemContext = {
        ...IntentRuntime.getContext(),
        ...payloadOrContext
      };
    } else {
      const capId = capabilityIdOrTask;
      const payload = payloadOrContext || {};
      task = payload.task || {
        id: 'temp_task_' + Math.random().toString(36).substring(2, 7),
        goalId: 'temp_goal',
        name: payload.prompt || 'Temporary Task',
        title: payload.prompt || 'Temporary Task',
        type: capId === 'cap_action' ? (payload.action === 'generateVideo' ? 'video' : 'image') : (capId === 'cap_vision' ? 'vision' : 'text'),
        prompt: payload.prompt || '',
        status: 'running',
        dependsOn: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        skillId: payload.skillId
      };
      systemContext = {
        ...IntentRuntime.getContext(),
        ...context,
        imageUrl: payload.imageUrl,
        aspectRatio: payload.aspectRatio,
        duration: payload.duration
      };
    }

    // Publish TASK_STARTED
    task.lifecycle = 'RUNNING';
    task.status = 'running';
    EventBus.publish('TASK_STATUS_CHANGED' as any, 'CapabilityBus', { ...task }, `[运行时] 开始运行任务: ${task.name || task.title}`);

    let resultOutput: any = null;
    let providerUsed = '';
    let success = false;
    let errorMsg = '';

    try {
      // 1. If task.skillId exists, check SkillRegistry
      if (task.skillId) {
        const skill = SkillRegistry.get(task.skillId);
        if (skill) {
          if (skill.execute) {
            resultOutput = await skill.execute(task, systemContext);
            success = true;
            providerUsed = 'SkillExecutor';
          } else {
            // skill has only instruction -> prompt skill. Run with the best text model
            const modelProvider = ModelRegistry.selectBest('text', systemContext);
            if (!modelProvider) throw new Error('No text model available in registry');
            
            const systemInstruction = skill.instruction || '';
            const prompt = task.prompt || '';
            
            resultOutput = await modelProvider.call('generateContent', {
              model: modelProvider.id,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: { systemInstruction, temperature: 0.7 }
            }, systemContext.config);
            
            success = true;
            providerUsed = modelProvider.name;
          }
        } else {
          throw new Error(`Skill ${task.skillId} not found in SkillRegistry`);
        }
      }
      // 2. If task.agentId exists, use AgentRegistry
      else if (task.agentId && AgentRegistry.has(task.agentId)) {
        const agent = AgentRegistry.get(task.agentId)!;
        resultOutput = await agent.execute(task, systemContext);
        success = true;
        providerUsed = agent.name;
      }
      // 3. Find best agent by task.type (CapabilityKind)
      else {
        const bestAgent = AgentRegistry.findBestAgent(task, systemContext);
        if (bestAgent) {
          resultOutput = await bestAgent.execute(task, systemContext);
          success = true;
          providerUsed = bestAgent.name;
        } else {
          // Fallback to text model registry
          let taskType: any = task.type;
          if (taskType === 'script' || taskType === 'general') {
            taskType = 'text';
          }
          const modelProvider = ModelRegistry.selectBest(taskType, systemContext);
          if (modelProvider) {
            resultOutput = await modelProvider.call('generateContent', {
              model: modelProvider.id,
              contents: [{ role: 'user', parts: [{ text: task.prompt || '' }] }]
            }, systemContext.config);
            success = true;
            providerUsed = modelProvider.name;
          } else {
            throw new Error(`No available agent or model provider to execute task of type ${task.type}`);
          }
        }
      }
    } catch (err: any) {
      success = false;
      errorMsg = err.message || String(err);
    }

    if (success) {
      task.status = 'completed';
      task.lifecycle = 'COMPLETED';
      task.output = resultOutput;
      
      // Publish TASK_COMPLETED
      EventBus.publish('TASK_STATUS_CHANGED' as any, 'CapabilityBus', { ...task }, `[运行时] 任务 [${task.name || task.title}] 执行成功！`);

      // Create artifact and publish ARTIFACT_CREATED
      const artifact: CanvasArtifact = {
        id: `result_${task.id}`,
        taskId: task.id,
        goalId: task.goalId,
        type: task.type === 'script' ? 'code' : (task.type === 'image' || task.type === 'video' ? task.type : 'text') as any,
        status: 'success',
        imageUrl: task.type === 'image' ? (resultOutput?.url || resultOutput?.imageUrl) : undefined,
        videoUrl: task.type === 'video' ? (resultOutput?.url || resultOutput?.videoUrl) : undefined,
        prompt: task.prompt,
        revisedPrompt: resultOutput?.revisedPrompt,
        config: {
          title: task.name || task.title,
          skillId: task.skillId
        },
        timestamp: Date.now(),
        createdAt: Date.now()
      };
      
      EventBus.publish('ARTIFACT_CREATED' as any, 'ArtifactEngine', artifact, `[资产引擎] 生成新画布产物: ${task.name || task.title}`);
      
      return {
        success: true,
        output: resultOutput,
        providerUsed,
        attempts: 1
      };
    } else {
      task.status = 'failed';
      task.lifecycle = 'FAILED';
      task.error = errorMsg;
      
      // Publish TASK_FAILED
      EventBus.publish('TASK_STATUS_CHANGED' as any, 'CapabilityBus', { ...task }, `[运行时] 任务 [${task.name || task.title}] 执行失败: ${errorMsg}`);
      
      return {
        success: false,
        output: null,
        providerUsed,
        attempts: 1,
        error: errorMsg
      };
    }
  }
}

export const CapabilityBus = new CapabilityBusService();
export default CapabilityBus;
