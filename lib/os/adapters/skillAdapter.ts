import { SkillDefinition, CapabilityKind } from '../types';
import { AiSkill } from '../../../skills/types';

export function aiSkillToSkillDefinition(aiSkill: AiSkill): SkillDefinition {
  const acceptedUploadTypes: string[] = [];
  if (aiSkill.enableUpload && aiSkill.uploadType) {
    acceptedUploadTypes.push(aiSkill.uploadType);
  }

  // Map category to CapabilityKind or default
  let category: CapabilityKind | "all" | string = aiSkill.category || 'all';

  return {
    id: aiSkill.id,
    name: aiSkill.name,
    description: aiSkill.desc || '',
    instruction: aiSkill.instruction || '',
    category,
    acceptedUploadTypes,
    metadata: {
      customOptions: aiSkill.customOptions
    },
    icon: (aiSkill as any).icon || '🔧',
    isSystem: aiSkill.isSystem !== false,
    isInstalled: aiSkill.isInstalled !== false,
    isPublic: aiSkill.isPublic !== false,
    customOptions: aiSkill.customOptions,
    enableUpload: aiSkill.enableUpload,
    uploadType: aiSkill.uploadType,
    promptLabel: aiSkill.promptLabel,
    promptPlaceholder: aiSkill.promptPlaceholder
  };
}
