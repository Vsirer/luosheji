import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Check, 
  ArrowRight, 
  User as UserIcon, 
  Globe, 
  Lock, 
  Bot,
  Edit2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { AiSkill } from '../skills/types';
import { PLUGINS } from '../plugin';
import { safeJson } from '../lib/fetch';

const getPluginCategory = (id: string): 'text' | 'image' | 'video' => {
  const saved = localStorage.getItem(`plugin_category_${id}`);
  if (saved === 'text' || saved === 'image' || saved === 'video') {
    return saved;
  }
  if (id === 'camera-control') return 'video';
  return 'image';
};

interface PluginPageProps {
  user: any;
}

export const PluginPage: React.FC<PluginPageProps> = ({ user }) => {
  const [customSkills, setCustomSkills] = useState<AiSkill[]>([]);
  const [activeSkillId, setActiveSkillId] = useState<string>(() => {
    return localStorage.getItem('selected_ai_skill') || 'general';
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Admin Controls State
  const [editingPlugin, setEditingPlugin] = useState<AiSkill | null>(null);
  const [deletingPluginId, setDeletingPluginId] = useState<string | null>(null);

  // Form State
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editCategory, setEditCategory] = useState<'text' | 'image' | 'video'>('image');

  const fetchSkills = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/skills', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeJson(res);
        if (data && data.success && Array.isArray(data.skills)) {
          setCustomSkills(data.skills);
        }
      }
    } catch (e) {
      console.error('Failed to fetch custom skills in PluginPage:', e);
    }
  };

  useEffect(() => {
    fetchSkills();
    
    // Sync active skill id changes
    const handleSkillChange = (e: any) => {
      if (e.detail && e.detail.skillId) {
        setActiveSkillId(e.detail.skillId);
      }
    };
    window.addEventListener('selected-skill-changed', handleSkillChange);
    return () => {
      window.removeEventListener('selected-skill-changed', handleSkillChange);
    };
  }, []);

  const handleSelectSkill = (id: string) => {
    setActiveSkillId(id);
    localStorage.setItem('selected_ai_skill', id);
    window.dispatchEvent(new CustomEvent('selected-skill-changed', { detail: { skillId: id } }));
  };

  const handleStartEdit = (plugin: AiSkill) => {
    setEditingPlugin(plugin);
    setEditName(plugin.name);
    setEditDesc(plugin.desc);
    setEditIcon(plugin.icon || '⚙️');
    setEditCategory(getPluginCategory(plugin.id));
  };

  const handleSaveEdit = () => {
    if (!editingPlugin) return;
    try {
      const editedPlugins = JSON.parse(localStorage.getItem('edited_system_plugins') || '{}');
      editedPlugins[editingPlugin.id] = {
        ...editedPlugins[editingPlugin.id],
        name: editName,
        desc: editDesc,
        icon: editIcon,
      };
      localStorage.setItem('edited_system_plugins', JSON.stringify(editedPlugins));
      localStorage.setItem(`plugin_category_${editingPlugin.id}`, editCategory);
      setEditingPlugin(null);
      window.dispatchEvent(new CustomEvent('skills-changed'));
      window.dispatchEvent(new CustomEvent('selected-skill-changed', { detail: { skillId: activeSkillId } }));
    } catch (e) {
      console.error('Failed to save edited plugin:', e);
    }
  };

  const handleDeleteConfirm = (id: string) => {
    try {
      const deletedIds = JSON.parse(localStorage.getItem('deleted_system_plugins') || '[]');
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem('deleted_system_plugins', JSON.stringify(deletedIds));
      }
      setDeletingPluginId(null);
      if (activeSkillId === id) {
        handleSelectSkill('general');
      }
      window.dispatchEvent(new CustomEvent('skills-changed'));
      window.dispatchEvent(new CustomEvent('selected-skill-changed', { detail: { skillId: 'general' } }));
    } catch (e) {
      console.error('Failed to delete plugin:', e);
    }
  };

  const hasLocalOverrides = () => {
    try {
      const deleted = localStorage.getItem('deleted_system_plugins');
      const edited = localStorage.getItem('edited_system_plugins');
      const hasDeleted = deleted && JSON.parse(deleted).length > 0;
      const hasEdited = edited && Object.keys(JSON.parse(edited)).length > 0;
      return !!(hasDeleted || hasEdited);
    } catch {
      return false;
    }
  };

  const handleResetAllPlugins = () => {
    if (window.confirm('确认要恢复所有官方插件的默认设置吗？')) {
      localStorage.removeItem('deleted_system_plugins');
      localStorage.removeItem('edited_system_plugins');
      window.dispatchEvent(new CustomEvent('skills-changed'));
      window.dispatchEvent(new CustomEvent('selected-skill-changed', { detail: { skillId: activeSkillId } }));
      window.location.reload();
    }
  };

  const aiStudioList = PLUGINS.filter(skill => {
    const q = searchQuery.toLowerCase();
    return skill.name.toLowerCase().includes(q) || skill.desc.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#fcfcfd]">
      {/* Sub header for searching & actions */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between shrink-0 shadow-2xs">
        <div>
          {user?.role === 'admin' && hasLocalOverrides() && (
            <button
              onClick={handleResetAllPlugins}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/60 rounded-xl transition-colors cursor-pointer"
              title="恢复所有被删除或修改的官方默认插件"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="font-semibold">重置官方插件</span>
            </button>
          )}
        </div>
        <div className="relative flex items-center w-full sm:w-64 md:w-72 group">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 transition-colors group-focus-within:text-indigo-500 pointer-events-none" />
          <input
            type="text"
            placeholder="搜索 plugin 功能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/40 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 focus:outline-none rounded-xl transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Grid view content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
          {aiStudioList.map((skill) => (
            <div 
              key={skill.id}
              className={`p-5 bg-white border rounded-2xl shadow-xs transition-all flex flex-col justify-between hover:shadow-md hover:translate-y-[-2px] ${
                activeSkillId === skill.id 
                  ? 'border-indigo-200 ring-1 ring-indigo-200 bg-indigo-50/5' 
                  : 'border-gray-100'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="truncate pr-2">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center flex-wrap gap-1.5">
                      <span>{skill.name}</span>
                      {skill.isSystem && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100/55 rounded-md shrink-0">
                          官方默认
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center">
                      <UserIcon className="w-3 h-3 mr-1 text-gray-300" />
                      {skill.isSystem ? '朱睿 开发团队' : `${skill.creatorName || '团队自制'}`}
                    </p>
                  </div>

                  {user?.role === 'admin' && (
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(skill);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="编辑插件"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingPluginId(skill.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="删除插件"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                
                <p className="text-[12px] text-gray-600 mt-4 leading-relaxed bg-gray-50/50 p-3.5 rounded-2xl border border-gray-100/40 min-h-[64px] block">
                  {skill.desc || '暂无描述。'}
                </p>

                {skill.customOptions && skill.customOptions.length > 0 ? (
                  <div className="mt-3 p-3 bg-indigo-50/30 rounded-2xl border border-indigo-100/30 space-y-1.5">
                    <div className="text-[10px] font-bold text-indigo-600 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                      <span>🧩 专属功能配置参数</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {skill.customOptions.map((opt: any) => (
                        <span key={opt.id} className="text-[9px] font-medium px-2 py-0.5 bg-white text-gray-600 border border-gray-100 rounded-lg shadow-2xs" title={opt.choices.join(', ')}>
                          {opt.name}: <span className="text-indigo-600 font-bold">{opt.choices.length} 个选项</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center space-x-1 text-slate-400 select-none">
                    <span className="text-[10px]">⚙️ 标准通用模式（无额外参数）</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-gray-50 mt-5 pt-3.5">
                <span className="text-[10px] text-gray-400 flex items-center font-semibold">
                  {skill.isPublic ? <Globe className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Lock className="w-3.5 h-3.5 mr-1 text-gray-400" />}
                  {skill.isPublic ? '公开共享中' : '仅自己可见'}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      handleSelectSkill(skill.id);
                    }}
                    className="px-4 py-1.5 text-[11px] font-bold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100/55 cursor-default flex items-center space-x-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>已添加</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {aiStudioList.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white border border-gray-100 rounded-3xl">
              <Bot className="w-14 h-14 text-gray-300 mx-auto stroke-1" />
              <p className="text-sm text-gray-400 mt-4 font-medium">没有匹配的功能技能！</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingPluginId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 mx-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900">确认删除插件</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              您确定要删除该插件吗？删除后此插件将不再显示在插件列表和控制台中。此操作可随时重置恢复。
            </p>
            <div className="flex items-center justify-end space-x-2 mt-5">
              <button
                onClick={() => setDeletingPluginId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteConfirm(deletingPluginId)}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                确定删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plugin Modal */}
      {editingPlugin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 mx-4 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">修改插件属性</h3>
              <button
                onClick={() => setEditingPlugin(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <span className="text-lg">×</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Plugin Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">插件名称</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  placeholder="请输入插件名称"
                />
              </div>

              {/* Plugin Icon */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">插件图标</label>
                <input
                  type="text"
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  placeholder="请输入表情或图标名称 (例如: 🎥, 🎯)"
                />
              </div>

              {/* Plugin Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">描述信息</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full text-xs px-3.5 py-2 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
                  placeholder="请输入描述信息"
                />
              </div>

              {/* Plugin Type / Category */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">插件类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'image', label: '图片类型', icon: '🖼️', desc: '用于生成/控制图像' },
                    { id: 'text', label: '文本类型', icon: '✍️', desc: '用于文本处理/提示' },
                    { id: 'video', label: '视频类型', icon: '🎥', desc: '用于视频运镜/调节' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setEditCategory(cat.id as 'text' | 'image' | 'video')}
                      className={`flex flex-col items-center justify-center p-3.5 border rounded-xl transition-all cursor-pointer text-center ${
                        editCategory === cat.id
                          ? 'border-indigo-500 bg-indigo-50/40 text-indigo-700 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-base mb-1">{cat.icon}</span>
                      <span className="text-[11px] font-bold">{cat.label}</span>
                      <span className="text-[9px] text-slate-400 mt-1 leading-tight block">
                        {cat.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditingPlugin(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
