import { AiSkill } from '../skills/types';
import { SYSTEM_PLUGINS } from './definitions';

export * from './definitions';

export const PLUGINS: AiSkill[] = new Proxy(SYSTEM_PLUGINS, {
  get(target, prop, receiver) {
    if (typeof window !== 'undefined') {
      try {
        const deletedIds = JSON.parse(localStorage.getItem('deleted_system_plugins') || '[]');
        const editedPlugins = JSON.parse(localStorage.getItem('edited_system_plugins') || '{}');
        const userPlugins = JSON.parse(localStorage.getItem('user_plugins') || '[]');
        const active = SYSTEM_PLUGINS
          .filter(p => !deletedIds.includes(p.id))
          .map(p => {
            if (editedPlugins[p.id]) {
              return { ...p, ...editedPlugins[p.id], isPublic: true };
            }
            return { ...p, isPublic: true };
          }).concat(userPlugins.map((p: any) => ({ ...p, isPublic: true })));
        const val = Reflect.get(active, prop, receiver);
        if (typeof val === 'function') {
          return val.bind(active);
        }
        return val;
      } catch (e) {
        console.error('Failed to resolve dynamic PLUGINS in proxy:', e);
      }
    }
    return Reflect.get(target, prop, receiver);
  }
});

