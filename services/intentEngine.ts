import { brainAgent, BrainAgent, IntentStep, IntentPlan } from "../components/agents/brainAgent.ts";

export type { IntentStep, IntentPlan };
export class IntentEngine extends BrainAgent {}
export const intentEngine = brainAgent;
