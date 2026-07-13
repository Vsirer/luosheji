import { ModelProviderDefinition, CapabilityKind } from '../types';
import { directorAgent } from '../../../components/agents/directorAgent';
import { imageAgent } from '../../../components/agents/imageAgent';
import { videoAgent } from '../../../components/agents/videoAgent';

class ModelRegistryService {
  private providers: Map<string, ModelProviderDefinition> = new Map();

  constructor() {
    this.registerDefaultProviders();
  }

  private registerDefaultProviders() {
    const defaults: ModelProviderDefinition[] = [
      {
        id: 'gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        provider: 'Google',
        protocol: 'google',
        capabilityKinds: ['text', 'vision'],
        capabilities: { text: true, vision: true, tools: true },
        call: async (method, args, config) => directorAgent.callApi('script', method as any, args, config),
        healthCheck: async () => true
      },
      {
        id: 'gemini-3.1-flash-image-preview',
        name: 'nano banana 2 (Gemini 3.1 Image)',
        provider: 'Google',
        protocol: 'google',
        capabilityKinds: ['image'],
        capabilities: { image: true },
        call: async (method, args, config) => imageAgent.callApi('image', method as any, args, config),
        healthCheck: async () => true
      },
      {
        id: 'gpt-image-2',
        name: 'GPT-Image-2',
        provider: 'OpenAI',
        protocol: 'openai',
        capabilityKinds: ['image'],
        capabilities: { image: true },
        call: async (method, args, config) => imageAgent.callApi('image', method as any, args, config),
        healthCheck: async () => true
      },
      {
        id: 'seedance2.0',
        name: 'RH-SD2.0 (Seedance)',
        provider: 'Seedance',
        protocol: 'custom',
        capabilityKinds: ['video'],
        capabilities: { video: true },
        call: async (method, args, config) => videoAgent.callApi('video', method as any, args, config),
        healthCheck: async () => true
      },
      {
        id: 'seedance-mini',
        name: 'RH-SD2.0mini (Seedance Mini)',
        provider: 'Seedance',
        protocol: 'custom',
        capabilityKinds: ['video'],
        capabilities: { video: true },
        call: async (method, args, config) => videoAgent.callApi('video', method as any, args, config),
        healthCheck: async () => true
      },
      {
        id: 'claude-3-5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        protocol: 'anthropic',
        capabilityKinds: ['text', 'vision', 'code'],
        capabilities: { text: true, vision: true, tools: true },
        call: async (method, args, config) => directorAgent.callApi('script', method as any, args, config),
        healthCheck: async () => true
      }
    ];

    defaults.forEach(p => this.register(p));
  }

  private loadCustomInterfacesFromLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      const savedConfigStr = localStorage.getItem('global_api_config');
      if (savedConfigStr) {
        const globalConfig = JSON.parse(savedConfigStr);
        const customInterfaces = globalConfig.customInterfaces || {};
        for (const [key, cust] of Object.entries(customInterfaces) as [string, any][]) {
          const providerId = key;
          if (!this.providers.has(providerId)) {
            let capabilityKinds: CapabilityKind[] = ['text'];
            if (key.toLowerCase().includes('image') || key.toLowerCase().includes('gptimage')) {
              capabilityKinds = ['image'];
            } else if (key.toLowerCase().includes('video') || key.toLowerCase().includes('seedance')) {
              capabilityKinds = ['video'];
            }
            
            this.providers.set(providerId, {
              id: providerId,
              name: cust.title || cust.displayName || key,
              provider: cust.provider || 'Custom',
              protocol: cust.protocol || 'custom',
              capabilityKinds,
              capabilities: {
                text: capabilityKinds.includes('text'),
                image: capabilityKinds.includes('image'),
                video: capabilityKinds.includes('video'),
                vision: capabilityKinds.includes('vision')
              },
              call: async (method, args, config) => {
                // Proxy the call directly to our dynamic agents
                if (capabilityKinds.includes('image')) {
                  return imageAgent.callApi('image', method as any, args, config);
                } else if (capabilityKinds.includes('video')) {
                  return videoAgent.callApi('video', method as any, args, config);
                } else {
                  return directorAgent.callApi('script', method as any, args, config);
                }
              },
              healthCheck: async () => true
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to load custom interfaces in ModelRegistry:', e);
    }
  }

  public register(provider: ModelProviderDefinition) {
    this.providers.set(provider.id, provider);
  }

  public unregister(id: string) {
    this.providers.delete(id);
  }

  public get(id: string): ModelProviderDefinition | undefined {
    this.loadCustomInterfacesFromLocalStorage();
    return this.providers.get(id);
  }

  public list(): ModelProviderDefinition[] {
    this.loadCustomInterfacesFromLocalStorage();
    return Array.from(this.providers.values());
  }

  public has(id: string): boolean {
    this.loadCustomInterfacesFromLocalStorage();
    return this.providers.has(id);
  }

  public findByCapability(capability: keyof ModelProviderDefinition['capabilities']): ModelProviderDefinition[] {
    return this.list().filter(p => p.capabilities?.[capability]);
  }

  public listByCapabilityKind(kind: CapabilityKind): ModelProviderDefinition[] {
    return this.list().filter(p => p.capabilityKinds?.includes(kind));
  }

  public selectBest(kind: CapabilityKind, context?: any): ModelProviderDefinition | undefined {
    const list = this.listByCapabilityKind(kind);
    if (list.length > 0) {
      return list[0];
    }
    
    // Fallbacks
    if (kind === 'image') {
      return this.get('gemini-3.1-flash-image-preview');
    }
    if (kind === 'video') {
      return this.get('seedance2.0');
    }
    return this.get('gemini-3.5-flash');
  }

  public async healthCheck(id: string): Promise<boolean> {
    const provider = this.get(id);
    if (!provider) return false;
    if (provider.healthCheck) {
      return provider.healthCheck();
    }
    return true;
  }
}

export const ModelRegistry = new ModelRegistryService();
export default ModelRegistry;
