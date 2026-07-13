import { AgentDefinition, Task, RuntimeContext } from '../types';

export function wrapAgentToDefinition(
  id: string,
  name: string,
  role: string,
  executeFn: (task: Task, context: any) => Promise<any>
): AgentDefinition {
  return {
    id,
    name,
    role,
    capabilityKinds: ['text'],
    execute: executeFn
  };
}
