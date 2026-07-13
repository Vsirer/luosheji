import { PluginDefinition, SkillDefinition } from '../types';
import { SkillRegistry } from './SkillRegistry';

class PluginRegistryService {
  private plugins: Map<string, PluginDefinition> = new Map();

  constructor() {
    this.registerDefaultPlugins();
    this.loadCustomAndUserPlugins();
    if (typeof window !== 'undefined') {
      window.addEventListener('skills-changed', () => {
        this.loadCustomAndUserPlugins();
      });
    }
  }

  private registerDefaultPlugins() {
    const defaultPlugins: PluginDefinition[] = [
      {
        id: 'panorama',
        name: 'VR全景世界',
        version: '1.0.0',
        description: '生成专业级 720° 全景 VR 素材',
        icon: '🧭',
        category: 'image',
        permissions: [],
        contributes: {
          skills: [SkillRegistry.get('panorama')!].filter(Boolean)
        },
        enabled: true
      },
      {
        id: 'camera-control',
        name: '相机调整',
        version: '1.0.0',
        description: '配置镜头焦段、光圈、色调等专业参数',
        icon: '🎬',
        category: 'image',
        permissions: [],
        contributes: {
          skills: [SkillRegistry.get('camera-control')!].filter(Boolean)
        },
        enabled: true
      },
      {
        id: 'perspective-sim',
        name: '透视模拟',
        version: '1.0.0',
        description: '三维空间透视网格模拟',
        icon: '📐',
        category: 'image',
        permissions: [],
        contributes: {
          skills: [SkillRegistry.get('perspective-sim')!].filter(Boolean)
        },
        enabled: true
      },
      {
        id: 'point-and-shoot',
        name: '指哪打哪',
        version: '1.0.0',
        description: '在场景中标记人物位置',
        icon: '🎯',
        category: 'image',
        permissions: [],
        contributes: {
          skills: [SkillRegistry.get('point-and-shoot')!].filter(Boolean)
        },
        enabled: true
      },
      {
        id: 'ai-creative-director',
        name: 'AI 创意总监 (Creative Director)',
        version: '1.0.0',
        description: '全自研即插即用插件，负责自动剧本扩写与画风匹配',
        icon: '🎨',
        category: 'text',
        permissions: [],
        contributes: {
          skills: [
            {
              id: 'creative-expand',
              name: '🪄 剧本高阶扩写',
              description: '自动对极简文本提示进行戏剧冲突扩写与多角色场景编排',
              category: 'text',
              instruction: '你是一位精通戏剧冲突的高级剧作总监，请对用户提供的主题，进行至少200字的生动场景描述与画风匹配建议。',
              execute: async (task, context) => {
                const prompt = typeof task === 'string' ? task : (task.prompt || '');
                return { text: `【创意润色】${prompt}\n\n在光影斑驳的都市一角，戏剧冲突正悄然拉开序幕... (即插即用 Skill 创意总监执行成功！)` };
              }
            }
          ]
        },
        enabled: true
      }
    ];

    defaultPlugins.forEach(p => this.register(p));
  }

  private loadCustomAndUserPlugins() {
    if (typeof window === 'undefined') return;

    try {
      // 1. Read deleted system plugins
      const deletedIds = JSON.parse(localStorage.getItem('deleted_system_plugins') || '[]');
      deletedIds.forEach((id: string) => {
        this.plugins.delete(id);
      });

      // 2. Read edited system plugins
      const editedPlugins = JSON.parse(localStorage.getItem('edited_system_plugins') || '{}');
      for (const [id, editedData] of Object.entries(editedPlugins)) {
        const existing = this.plugins.get(id);
        if (existing) {
          this.plugins.set(id, { ...existing, ...(editedData as any) });
        }
      }

      // 3. Migrate and load old user_plugins (AiSkill format) to user_plugins_v2 (PluginDefinition format)
      const oldUserPluginsRaw = localStorage.getItem('user_plugins');
      let v2Plugins: PluginDefinition[] = [];

      const v2Raw = localStorage.getItem('user_plugins_v2');
      if (v2Raw) {
        v2Plugins = JSON.parse(v2Raw);
      } else if (oldUserPluginsRaw) {
        // Convert old user_plugins format to v2
        const oldUserPlugins = JSON.parse(oldUserPluginsRaw);
        v2Plugins = oldUserPlugins.map((oldP: any) => {
          // Convert to SkillDefinition
          const skill: SkillDefinition = {
            id: oldP.id,
            name: oldP.name,
            description: oldP.desc || oldP.description || '',
            instruction: oldP.instruction || '',
            category: oldP.category || 'all',
            icon: oldP.icon,
            isSystem: false,
            isInstalled: true,
            isPublic: true,
            customOptions: oldP.customOptions,
            enableUpload: oldP.enableUpload,
            uploadType: oldP.uploadType,
            promptLabel: oldP.promptLabel,
            promptPlaceholder: oldP.promptPlaceholder
          };
          
          // Register the skill dynamically as well
          SkillRegistry.register(skill);

          return {
            id: oldP.id,
            name: oldP.name,
            version: '1.0.0',
            description: oldP.desc || oldP.description || '',
            icon: oldP.icon || '🔌',
            category: oldP.category || 'image',
            permissions: [],
            contributes: {
              skills: [skill]
            },
            enabled: true
          };
        });

        // Save migrated plugins to localStorage_v2
        localStorage.setItem('user_plugins_v2', JSON.stringify(v2Plugins));
      }

      // Register all v2 plugins
      v2Plugins.forEach((p: PluginDefinition) => {
        this.register(p);
        // Also register any skills contributed by custom user plugins
        if (p.contributes?.skills) {
          p.contributes.skills.forEach(s => SkillRegistry.register(s));
        }
      });

    } catch (e) {
      console.error('Failed to load user and custom plugins in PluginRegistry:', e);
    }
  }

  public register(plugin: PluginDefinition) {
    this.plugins.set(plugin.id, plugin);
    // Auto-register contributed skills
    if (plugin.contributes?.skills) {
      plugin.contributes.skills.forEach(s => SkillRegistry.register(s));
    }
  }

  public unregister(id: string) {
    const plugin = this.plugins.get(id);
    if (plugin && plugin.contributes?.skills) {
      plugin.contributes.skills.forEach(s => SkillRegistry.unregister(s.id));
    }
    this.plugins.delete(id);
    this.saveUserPluginsV2();
  }

  public get(id: string): PluginDefinition | undefined {
    return this.plugins.get(id);
  }

  public list(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }

  public has(id: string): boolean {
    return this.plugins.has(id);
  }

  public saveUserPluginsV2() {
    if (typeof window === 'undefined') return;
    try {
      // Find all custom (non-system) plugins
      const customPlugins = this.list().filter(p => !['panorama', 'camera-control', 'perspective-sim', 'point-and-shoot'].includes(p.id));
      localStorage.setItem('user_plugins_v2', JSON.stringify(customPlugins));
    } catch (e) {
      console.error('Failed to save user_plugins_v2 to localStorage:', e);
    }
  }
}

export const PluginRegistry = new PluginRegistryService();
export default PluginRegistry;
