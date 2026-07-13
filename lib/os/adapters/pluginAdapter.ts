import { PluginDefinition, SkillDefinition } from '../types';
import { AiSkill } from '../../../skills/types';
import { aiSkillToSkillDefinition } from './skillAdapter';

export function aiSkillToPluginDefinition(aiSkill: AiSkill): PluginDefinition {
  const skill = aiSkillToSkillDefinition(aiSkill);
  return {
    id: aiSkill.id,
    name: aiSkill.name,
    version: '1.0.0',
    description: aiSkill.desc || '',
    icon: (aiSkill as any).icon || '🔌',
    category: aiSkill.category || 'image',
    permissions: [],
    contributes: {
      skills: [skill]
    },
    enabled: true
  };
}
