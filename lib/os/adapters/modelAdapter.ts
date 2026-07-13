import { ModelProviderDefinition, CapabilityKind } from '../types';

export function configToModelProvider(key: string, config: any): ModelProviderDefinition {
  let kind: CapabilityKind[] = ['text'];
  if (key.includes('image') || key.includes('gptImage')) {
    kind = ['image'];
  } else if (key.includes('video') || key.includes('seedance')) {
    kind = ['video'];
  }

  return {
    id: key,
    name: config.name || key,
    provider: config.provider || 'Custom',
    protocol: config.protocol || 'custom',
    capabilityKinds: kind,
    call: async (method, args, context) => {
      console.log(`Calling dynamic model ${key}`, method, args);
      return {};
    }
  };
}
