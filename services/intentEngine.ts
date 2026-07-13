import { brainAgent, BrainAgent, IntentStep, IntentPlan } from "../components/agents/brainAgent.ts";
import { IntentRuntime } from "../lib/os/IntentRuntime.ts";
import { Task } from "../lib/os/types.ts";

export type { IntentStep, IntentPlan };

export class IntentEngine extends BrainAgent {
  public async analyzeUserIntent(rawText: string, config?: any): Promise<IntentPlan> {
    // Transition IntentRuntime state to PLANNING / WAITING_MODEL
    IntentRuntime.transitionState('PLANNING', 'WAITING_MODEL', '调度大脑进行步骤规划与 DAG 依赖分析');
    
    try {
      const plan = await brainAgent.analyzeUserIntent(rawText, config);
      
      // Sync plan with IntentRuntime
      if (plan.isPipeline && plan.steps) {
        const intent = IntentRuntime.parseIntent(rawText, 'Codex');
        const goalId = 'goal_' + intent.id;
        const goal = {
          id: goalId,
          intentId: intent.id,
          title: plan.rationale || 'AI Intent Execution Plan',
          name: plan.rationale || 'AI Intent Execution Plan',
          rationale: plan.rationale || '按 DAG 顺序执行流程步骤',
          status: 'created',
          lifecycle: 'RUNNING' as any,
          businessState: 'NONE' as any,
          taskIds: plan.steps.map((s: any) => s.id),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          timestamp: Date.now(),
          dependencies: []
        };
        // Transition state to indicate running
        IntentRuntime.transitionState('RUNNING', 'NONE', '意图规划完成，接入工作流 DAG 调度');
      } else {
        IntentRuntime.transitionState('COMPLETED', 'NONE', '纯文本意图执行完成');
      }
      
      return plan;
    } catch (error: any) {
      IntentRuntime.transitionState('FAILED', 'NONE', `意图规划失败: ${error.message || error}`);
      throw error;
    }
  }

  public async executeStep(
    step: IntentStep,
    previousOutputs: Record<string, any>,
    config?: any,
    onProgress?: (progressMsg: string) => void
  ): Promise<any> {
    // Notify IntentRuntime of the current task execution
    const osTask: Task = {
      id: step.id,
      goalId: 'current_goal',
      type: step.type,
      title: step.label,
      name: step.label,
      prompt: step.prompt,
      status: 'pending',
      lifecycle: 'CREATED',
      businessState: 'NONE',
      dependsOn: [],
      assignedActorId: step.type === 'script' ? 'directorAgent' : step.type === 'image' ? 'imageAgent' : step.type === 'video' ? 'videoAgent' : 'brainAgent',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      timestamp: Date.now(),
      skillId: step.skillId
    };

    const businessState = step.type === 'script' ? 'WAITING_MODEL' : (step.type === 'image' || step.type === 'video' ? 'WAITING_TOOL' : 'NONE');
    IntentRuntime.transitionState('RUNNING', businessState as any, `执行步骤: [${step.label}]`);

    try {
      const result = await brainAgent.executeStep(step, previousOutputs, config, onProgress);
      
      // Update state upon completion
      IntentRuntime.transitionState('RUNNING', 'NONE', `步骤 [${step.label}] 执行成功`);
      
      // Optionally output to memory or build artifact
      try {
        IntentRuntime.createArtifact(osTask, result);
      } catch (e) {
        console.warn("Failed to create artifact in IntentRuntime inside executeStep:", e);
      }
      
      return result;
    } catch (error: any) {
      IntentRuntime.transitionState('FAILED', 'NONE', `步骤 [${step.label}] 执行失败: ${error.message || error}`);
      throw error;
    }
  }
}

export const intentEngine = new IntentEngine();

