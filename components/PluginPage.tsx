import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Check, 
  ArrowRight, 
  User as UserIcon, 
  Globe, 
  Lock, 
  Bot 
} from 'lucide-react';
import { AiSkill } from '../skills/types';
import { PLUGINS } from '../plugin';
import { safeJson } from '../lib/fetch';

interface PluginPageProps {
  user: any;
}

export const PluginPage: React.FC<PluginPageProps> = ({ user }) => {
  const [customSkills, setCustomSkills] = useState<AiSkill[]>([]);
  const [activeSkillId, setActiveSkillId] = useState<string>(() => {
    return localStorage.getItem('selected_ai_skill') || 'general';
  });
  const [searchQuery, setSearchQuery] = useState('');

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

  const aiStudioList = PLUGINS.filter(skill => {
    const q = searchQuery.toLowerCase();
    return skill.name.toLowerCase().includes(q) || skill.desc.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#fcfcfd]">
      {/* Sub header for searching */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex justify-end shrink-0 shadow-2xs">
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
                  <div className="truncate">
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
    </div>
  );
};
