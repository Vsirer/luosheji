import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Cpu, 
  Globe, 
  Lock, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Settings,
  HelpCircle,
  Network,
  Save,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { Config, ApiConfig } from '../types';
import { DEFAULT_CONFIG } from '../constants';

interface CustomModel {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
  type?: 'text' | 'image' | 'video' | 'all';
}

interface ApiInterfacePageProps {
  user: any;
}

export const ApiInterfacePage: React.FC<ApiInterfacePageProps> = ({ user }) => {
  const [activeSubTab, setActiveSubTab] = useState<'system' | 'custom'>('system');
  const [models, setModels] = useState<CustomModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Custom model form states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEndpoint, setFormEndpoint] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formType, setFormType] = useState<'text' | 'image' | 'video' | 'all'>('text');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Custom Model connection testing status
  const [testStatus, setTestStatus] = useState<Record<string, { loading: boolean; success?: boolean; error?: string }>>({});

  // Global system configs states
  const [globalConfig, setGlobalConfig] = useState<Config | null>(null);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [globalTestStatus, setGlobalTestStatus] = useState<Record<string, { loading: boolean; success?: boolean; error?: string }>>({});
  const [savingSections, setSavingSections] = useState<Record<string, boolean>>({});
  const [sectionSuccess, setSectionSuccess] = useState<Record<string, boolean>>({});
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});

  const isAdmin = user?.role === 'admin';

  const fetchModels = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/custom-models', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setModels(Array.isArray(data) ? data.filter((m: any) => m.model !== "gemini-3.1-pro") : []);
        } else {
          console.warn("ApiInterfacePage: Expected JSON from custom-models but received:", contentType);
          setModels([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch custom models:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalConfig = async () => {
    setLoadingGlobal(true);
    try {
      const token = localStorage.getItem('token');
      const url = isAdmin ? '/api/admin/settings/api-config' : '/api/user/global-api-config';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setGlobalConfig({ ...DEFAULT_CONFIG, ...data });
        } else {
          console.warn("ApiInterfacePage: Expected JSON from global-api-config but received:", contentType);
          setGlobalConfig(DEFAULT_CONFIG);
        }
      } else {
        setGlobalConfig(DEFAULT_CONFIG);
      }
    } catch (err) {
      console.error('Failed to fetch global API configuration:', err);
      setGlobalConfig(DEFAULT_CONFIG);
    } finally {
      setLoadingGlobal(false);
    }
  };

  useEffect(() => {
    fetchModels();
    fetchGlobalConfig();
  }, [isAdmin]);

  const handleTestConnection = async (modelItem: CustomModel) => {
    setTestStatus(prev => ({ ...prev, [modelItem.id]: { loading: true } }));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/test-custom-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          endpoint: modelItem.endpoint,
          apiKey: modelItem.apiKey,
          model: modelItem.model
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus(prev => ({ ...prev, [modelItem.id]: { loading: false, success: true } }));
      } else {
        setTestStatus(prev => ({ 
          ...prev, 
          [modelItem.id]: { 
            loading: false, 
            success: false, 
            error: data.error || data.message || '连接失败' 
          } 
        }));
      }
    } catch (err: any) {
      setTestStatus(prev => ({ 
        ...prev, 
        [modelItem.id]: { loading: false, success: false, error: '网络测试连接失败' } 
      }));
    }
  };

  const handleTestGlobalConnection = async (type: 'script' | 'image' | 'videoSeedance' | 'videoSeedanceMini' | 'gptImage' | 'claudeSonnet') => {
    if (!globalConfig) return;
    const section = globalConfig[type] || DEFAULT_CONFIG[type];
    
    if (!section?.apiKey) {
      setGlobalTestStatus(prev => ({ ...prev, [type]: { loading: false, error: '请先填写 API KEY' } }));
      return;
    }

    setGlobalTestStatus(prev => ({ ...prev, [type]: { loading: true } }));
    try {
      const token = localStorage.getItem('token');
      let url = '/api/admin/test-api-config';
      let options: any = {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, config: section })
      };

      if (type === 'videoSeedance' || type === 'videoSeedanceMini') {
        url = '/api/video/test-connection';
        options.body = JSON.stringify({ config: section });
      }

      const res = await fetch(url, options);
      const data = await res.json();
      if (res.ok && (data.success || data.status === 'ok')) {
        setGlobalTestStatus(prev => ({ ...prev, [type]: { loading: false, success: true } }));
      } else {
        setGlobalTestStatus(prev => ({ ...prev, [type]: { loading: false, success: false, error: data.error || data.message || '测试失败' } }));
      }
    } catch (e: any) {
      setGlobalTestStatus(prev => ({ ...prev, [type]: { loading: false, success: false, error: '网络错误' } }));
    }
  };

  const handleSaveGlobalConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMsg('只有管理员可修改全局系统接口配置');
      return;
    }
    if (!globalConfig) return;

    setSavingGlobal(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/settings/api-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(globalConfig)
      });
      if (res.ok) {
        setSuccessMsg('全局系统接口配置保存成功！所有用户可立即使用此默认配置。');
        fetchGlobalConfig();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || '保存失败');
      }
    } catch (err: any) {
      setErrorMsg('网络保存错误: ' + err.message);
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleSaveSectionConfig = async (type: 'script' | 'image' | 'gptImage' | 'videoSeedance' | 'videoSeedanceMini' | 'claudeSonnet', label: string) => {
    if (!isAdmin) {
      setErrorMsg('只有管理员可修改系统接口配置');
      return;
    }
    if (!globalConfig) return;

    setSavingSections(prev => ({ ...prev, [type]: true }));
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/settings/api-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(globalConfig)
      });
      if (res.ok) {
        setSectionSuccess(prev => ({ ...prev, [type]: true }));
        setSuccessMsg(`${label} 配置已独立保存成功！`);
        setTimeout(() => {
          setSectionSuccess(prev => ({ ...prev, [type]: false }));
        }, 2500);
        fetchGlobalConfig();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || '保存失败');
      }
    } catch (err: any) {
      setErrorMsg('网络保存错误: ' + err.message);
    } finally {
      setSavingSections(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setErrorMsg('只有管理员可修改 API 接口配置');
      return;
    }

    if (!formName.trim() || !formEndpoint.trim() || !formModel.trim() || !formApiKey.trim()) {
      setErrorMsg('请填写完整的配置信息');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    let updatedModels = [...models];

    if (isEditingId) {
      // Edit existing model
      updatedModels = updatedModels.map(m => {
        if (m.id === isEditingId) {
          return {
            ...m,
            name: formName.trim(),
            endpoint: formEndpoint.trim(),
            model: formModel.trim(),
            apiKey: formApiKey.trim(),
            type: formType
          };
        }
        return m;
      });
    } else {
      // Add new model
      const newModel: CustomModel = {
        id: 'model_' + Date.now(),
        name: formName.trim(),
        endpoint: formEndpoint.trim(),
        model: formModel.trim(),
        apiKey: formApiKey.trim(),
        type: formType
      };
      updatedModels.push(newModel);
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/custom-models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedModels)
      });

      if (res.ok) {
        setSuccessMsg(isEditingId ? 'API 接口修改成功！' : 'API 接口添加成功！');
        resetForm();
        fetchModels();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || '保存失败');
      }
    } catch (err: any) {
      setErrorMsg('网络连接错误: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteModel = async (id: string) => {
    if (!isAdmin) {
      setErrorMsg('只有管理员可删除 API 接口');
      return;
    }

    const updatedModels = models.filter(m => m.id !== id);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/custom-models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedModels)
      });

      if (res.ok) {
        setSuccessMsg('接口配置删除成功');
        fetchModels();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || '删除失败');
      }
    } catch (err: any) {
      setErrorMsg('网络错误: ' + err.message);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleEditFill = (modelItem: CustomModel) => {
    setIsEditingId(modelItem.id);
    setFormName(modelItem.name);
    setFormEndpoint(modelItem.endpoint);
    setFormModel(modelItem.model);
    setFormApiKey(modelItem.apiKey);
    setFormType(modelItem.type || 'text');
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setIsEditingId(null);
    setFormName('');
    setFormEndpoint('');
    setFormModel('');
    setFormApiKey('');
    setFormType('text');
    setShowAddForm(false);
  };

  const handleResetGlobalToDefault = () => {
    if (!isAdmin) return;
    const confirmReset = window.confirm('确定要将所有全局系统基础接口配置恢复为默认模版吗？这会覆盖当前未保存的修改。');
    if (confirmReset) {
      setGlobalConfig(DEFAULT_CONFIG);
      setSuccessMsg('已恢复基础接口默认值，请点击“保存系统配置”生效。');
    }
  };

  const renderGlobalSectionItem = (type: 'script' | 'image' | 'gptImage' | 'videoSeedance' | 'videoSeedanceMini' | 'claudeSonnet', label: string, desc: string, placeholderUrl: string, placeholderModel: string) => {
    if (!globalConfig) return null;
    const section = globalConfig[type] || DEFAULT_CONFIG[type];
    const status = globalTestStatus[type];
    const isSaving = savingSections[type];
    const isSuccess = sectionSuccess[type];
    const isEditingThis = !!editingSections[type] && isAdmin;

    return (
      <div 
        key={type}
        className={`bg-white p-5 border rounded-3xl shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-4 w-full relative overflow-hidden ${
          isEditingThis 
            ? 'border-indigo-200 ring-1 ring-indigo-200 bg-indigo-50/5' 
            : 'border-gray-100 hover:border-indigo-100/60'
        }`}
      >
        {/* Card Header & Compact Info */}
        <div className="space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 truncate">
              <h4 className="text-sm font-bold text-gray-950 flex items-center flex-wrap gap-1.5">
                <span>{label}</span>
                <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 font-extrabold px-1.5 py-0.5 rounded-md uppercase shrink-0">
                  SYSTEM
                </span>
              </h4>
              <p className="text-[10px] text-gray-400 font-medium">
                当前使用模型: <span className="font-bold text-indigo-600">{section.model || placeholderModel}</span>
              </p>
            </div>

            {/* Right Actions: Edit for admin */}
            {isAdmin && (
              <div className="flex items-center gap-1 shrink-0">
                {!isEditingThis ? (
                  <button
                    type="button"
                    onClick={() => setEditingSections(prev => ({ ...prev, [type]: true }))}
                    className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all cursor-pointer"
                    title="修改"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingSections(prev => ({ ...prev, [type]: false }))}
                    className="p-1.5 hover:bg-gray-100 text-slate-400 hover:text-gray-600 rounded-lg transition-all cursor-pointer text-xs font-bold"
                    title="取消"
                  >
                    取消
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Card Description */}
          <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
            {desc}
          </p>
        </div>

        {/* Content Body: Inputs inside a sliding panel or hidden box ONLY when admin clicked Edit */}
        {isEditingThis && (
          <div className="space-y-3 border-t border-dashed border-gray-100 pt-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* API Key Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 flex items-center justify-between">
                <span>API 授权密钥 (API KEY) <span className="text-red-500">*</span></span>
              </label>
              <input 
                type="password"
                disabled={!isAdmin}
                placeholder="输入密钥"
                value={section.apiKey || ''}
                onChange={e => {
                  const updated = { ...globalConfig };
                  updated[type] = { ...section, apiKey: e.target.value };
                  setGlobalConfig(updated);
                }}
                className="w-full text-xs py-2 px-3 bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 border border-gray-100 rounded-xl outline-none transition-all disabled:opacity-70 font-medium font-mono"
              />
            </div>

            {/* Model Name Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400">模型名称 (MODEL)</label>
              <input 
                type="text"
                disabled={!isAdmin}
                placeholder={placeholderModel}
                value={section.model || ''}
                onChange={e => {
                  const updated = { ...globalConfig };
                  updated[type] = { ...section, model: e.target.value };
                  setGlobalConfig(updated);
                }}
                className="w-full text-xs py-2 px-3 bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 border border-gray-100 rounded-xl outline-none transition-all disabled:opacity-70 font-medium"
              />
            </div>

            {/* Display Name & Model Type Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400">显示名称 (DISPLAY NAME)</label>
                <input 
                  type="text"
                  disabled={!isAdmin}
                  placeholder={placeholderModel}
                  value={section.displayName || ''}
                  onChange={e => {
                    const updated = { ...globalConfig };
                    updated[type] = { ...section, displayName: e.target.value };
                    setGlobalConfig(updated);
                  }}
                  className="w-full text-xs py-2 px-3 bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 border border-gray-100 rounded-xl outline-none transition-all disabled:opacity-70 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400">模型类型 (MODEL TYPE)</label>
                <select
                  disabled={!isAdmin}
                  value={section.modelType || (type === 'script' || type === 'claudeSonnet' ? 'text' : (type === 'image' || type === 'gptImage' ? 'image' : 'video'))}
                  onChange={e => {
                    const updated = { ...globalConfig };
                    updated[type] = { ...section, modelType: e.target.value as 'text' | 'image' | 'video' };
                    setGlobalConfig(updated);
                  }}
                  className="w-full text-xs py-2 px-3 bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 border border-gray-100 rounded-xl outline-none transition-all disabled:opacity-70 font-medium cursor-pointer"
                >
                  <option value="text">文本 (Text)</option>
                  <option value="image">图片 (Image)</option>
                  <option value="video">视频 (Video)</option>
                </select>
              </div>
            </div>

            {/* API Endpoint Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400">接口基础路径 (API ENDPOINT)</label>
              <input 
                type="text"
                disabled={!isAdmin}
                placeholder={placeholderUrl}
                value={section.endpoint || ''}
                onChange={e => {
                  const updated = { ...globalConfig };
                  let val = e.target.value.replace(/([^:])\/\//g, '$1/');
                  updated[type] = { ...section, endpoint: val, path: '' };
                  setGlobalConfig(updated);
                }}
                className="w-full text-xs py-2 px-3 bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 border border-gray-100 rounded-xl outline-none transition-all disabled:opacity-70 font-medium"
              />
            </div>
            
            {/* Save Buttons Row */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  await handleSaveSectionConfig(type, label);
                  setEditingSections(prev => ({ ...prev, [type]: false }));
                }}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center gap-1 transition-all shadow-xs cursor-pointer ${
                  isSuccess 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/60'
                    : isSaving 
                      ? 'bg-gray-50 text-gray-400 border border-gray-100'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white border border-transparent'
                }`}
              >
                {isSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>已保存</span>
                  </>
                ) : isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>保存并应用</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Card Footer: Connection Status & Test connection */}
        <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-1 shrink-0">
          <div className="flex items-center gap-1.5">
            {status?.loading ? (
              <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
                <span>测试中...</span>
              </span>
            ) : status?.success ? (
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/40">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>连接通过</span>
              </span>
            ) : status?.error ? (
              <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100/40" title={status.error}>
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>连接失败</span>
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-gray-300" />
                <span>未测试连通</span>
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!isAdmin || status?.loading}
            onClick={() => handleTestGlobalConnection(type)}
            className="px-3 py-1.5 text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100/75 rounded-lg border border-indigo-100/40 transition-all cursor-pointer uppercase tracking-wider disabled:opacity-50"
          >
            测试连接
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full bg-[#fcfcfd] flex flex-col overflow-y-auto p-8 font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        
        {/* Header Information Banner */}
        <div className="bg-gradient-to-r from-indigo-50/60 to-purple-50/60 border border-indigo-100/40 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-950 flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-500 animate-pulse" />
              <span>多模型通用 API 接口管理</span>
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
              此处集成管理全局系统基础默认 API (如文本生成、图片/视频节点) 和自定义 OpenAI 兼容接口，轻松支持多大模型热插拔。
              {!isAdmin && <span className="text-amber-600 block mt-1 font-bold">⚠️ 当前为普通用户查看状态，仅管理员可编辑/管理 API 密钥。</span>}
            </p>
          </div>
          
          {isAdmin && (
            <button
              onClick={() => { resetForm(); setShowAddForm(true); }}
              className="px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer self-start md:self-center shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>添加大模型接口</span>
            </button>
          )}
        </div>

        {/* Action feedback notifications */}
        {(errorMsg || successMsg) && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            {errorMsg && (
              <div className="text-red-600 text-xs font-semibold flex items-center bg-red-50/60 px-4 py-3 rounded-2xl border border-red-100/50">
                <AlertCircle className="w-4 h-4 mr-2 text-red-500 shrink-0" />
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="text-emerald-600 text-xs font-semibold flex items-center bg-emerald-50/60 px-4 py-3 rounded-2xl border border-emerald-100/50">
                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500 shrink-0" />
                {successMsg}
              </div>
            )}
          </div>
        )}

        {/* Modal Dialog Form for Adding/Editing Custom API Model */}
        <AnimatePresence>
          {showAddForm && isAdmin && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-xs" 
                onClick={resetForm} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white p-6 border border-gray-150 rounded-3xl shadow-2xl space-y-5 max-w-xl w-full relative z-10 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-500" />
                    <span>{isEditingId ? '修改自定义大模型 API 参数' : '配置新增 API 大模型'}</span>
                  </h3>
                  <button 
                    onClick={resetForm}
                    className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    取消返回
                  </button>
                </div>

                <form onSubmit={handleSaveModel} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-gray-600">API 接口类型 / 适用场景 <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { id: 'text', label: '📝 文本生成 API', desc: '用于剧本创作、创意提炼、问答对话等文本任务' },
                        { id: 'image', label: '🎨 图片生成 API', desc: '用于生图节点、场景角色设定图生成等视觉任务' },
                        { id: 'video', label: '🎬 视频生成 API', desc: '用于视频分镜、镜头渲染与影音生成等视频任务' },
                        { id: 'all', label: '🌐 文本、图片、视频', desc: '全场景联动通用，适用于所有任务' }
                      ].map((typeItem) => {
                        const isSelected = formType === typeItem.id;
                        return (
                          <button
                            key={typeItem.id}
                            type="button"
                            onClick={() => setFormType(typeItem.id as any)}
                            className={`p-3.5 border rounded-2xl text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200 text-indigo-950'
                                : 'bg-gray-50 border-gray-100 hover:border-gray-200 text-gray-500'
                            }`}
                          >
                            <span className="text-xs font-black">{typeItem.label}</span>
                            <span className="text-[9px] text-gray-400 font-medium leading-normal">{typeItem.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-600">模型自定义别名 <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      required
                      placeholder="例如: DeepSeek-V3 尊享版"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full text-xs py-3 px-4 bg-gray-50 border border-gray-100 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-600">模型标识符 (Model ID) <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      required
                      placeholder="例如: deepseek-chat 或 gpt-4o"
                      value={formModel}
                      onChange={e => setFormModel(e.target.value)}
                      className="w-full text-xs py-3 px-4 bg-gray-50 border border-gray-100 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-gray-600">API 基础路径 (Endpoint URL) <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      required
                      placeholder="例如: https://api.deepseek.com/v1 或 https://api.openai.com/v1"
                      value={formEndpoint}
                      onChange={e => setFormEndpoint(e.target.value)}
                      className="w-full text-xs py-3 px-4 bg-gray-50 border border-gray-100 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-gray-600">API 授权密钥 (API Key) <span className="text-red-500">*</span></label>
                    <input 
                      type="password"
                      required
                      placeholder="例如: sk-xxxxxxxxxxxxxxxxxxxxx"
                      value={formApiKey}
                      onChange={e => setFormApiKey(e.target.value)}
                      className="w-full text-xs py-3 px-4 bg-gray-50 border border-gray-100 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-xl outline-none transition-all"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center justify-end gap-3 pt-3 border-t border-gray-50 mt-2">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4.5 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      {submitting ? '保存中...' : '确认保存 API 接口'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Global System & Custom API Configurations Unified Grid List */}
        <form onSubmit={e => e.preventDefault()} className="space-y-6">
          {loadingGlobal ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
              <p className="text-xs text-gray-400 font-bold">正在加载全局系统接口配置...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderGlobalSectionItem(
                  'script', 
                  '文本生成 (SCRIPT API)', 
                  '配置剧本、创意提炼等脚本工作流调用的文本生成模型', 
                  'https://api.vectorengine.ai', 
                  'gemini-3.5-flash'
                )}
                {renderGlobalSectionItem(
                  'image', 
                  '图片生成 (IMAGE API)', 
                  '主要配置生图节点及常规角色、场景生图接口配置', 
                  'https://api.vectorengine.ai', 
                  'gemini-3.1-flash-image-preview'
                )}
                {renderGlobalSectionItem(
                  'gptImage', 
                  'GPT 图像生成接口 (GPT IMAGE API)', 
                  '主要用于 GPT-Image 节点图像生成、画质优化及风格化精绘支持配置', 
                  'https://api.vectorengine.ai', 
                  'gemini-3-flash-preview'
                )}
                {renderGlobalSectionItem(
                  'videoSeedance', 
                  '视频生成接口 (SEEDANCE API)', 
                  '视频节点渲染引擎（如 ComfyUI 或 SparkVideo-2.0）接口支持', 
                  'https://www.runninghub.cn/openapi/v2/rhart-video/sparkvideo-2.0/multimodal-video', 
                  'seedance2.0'
                )}
                {renderGlobalSectionItem(
                  'videoSeedanceMini', 
                  '视频生成接口 (RHSD2.0Mini API)', 
                  '视频分镜、极速渲染引擎（对应 RunningHub SparkVideo-2.0-Mini）标准模型接口支持', 
                  'https://www.runninghub.cn/openapi/v2/rhart-video/sparkvideo-2.0-mini/multimodal-video', 
                  'seedance-mini'
                )}
                {renderGlobalSectionItem(
                  'claudeSonnet', 
                  'Claude-sonnet-5 接口 (CLAUDE API)', 
                  '配置 Claude-sonnet-5 高阶文本生成与剧本/动作提炼模型', 
                  'https://api.vectorengine.ai', 
                  'Claude-sonnet-5'
                )}

                {/* Newly added custom models displayed dynamically in the same grid layout */}
                {models.map(item => {
                  const status = testStatus[item.id];
                  return (
                    <div 
                      key={item.id}
                      className="bg-white p-5 border border-gray-100 hover:border-indigo-100/60 rounded-3xl shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-4 w-full relative overflow-hidden"
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 truncate">
                            <h4 className="text-sm font-bold text-gray-950 flex items-center flex-wrap gap-1.5">
                              <span>{item.name}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200/40 font-black px-1.5 py-0.5 rounded-md">OpenAI 格式</span>
                              {item.type === 'image' ? (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 font-bold px-1.5 py-0.5 rounded-md">🎨 图片生成</span>
                              ) : item.type === 'video' ? (
                                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 font-bold px-1.5 py-0.5 rounded-md">🎬 视频生成</span>
                              ) : item.type === 'all' ? (
                                <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-100 font-bold px-1.5 py-0.5 rounded-md">🌐 文本、图片、视频</span>
                              ) : (
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold px-1.5 py-0.5 rounded-md">📝 文本生成</span>
                              )}
                            </h4>
                            <p className="text-[10px] text-gray-400 font-medium">模型 ID: <span className="font-bold text-indigo-600">{item.model}</span></p>
                          </div>

                          {isAdmin && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEditFill(item)}
                                className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all cursor-pointer"
                                title="修改"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(item.id)}
                                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-all cursor-pointer"
                                title="删除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Masked credentials block (ONLY shown when admin is editing this card, otherwise hidden for privacy & space efficiency) */}
                        {isAdmin && isEditingId === item.id && (
                          <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50 space-y-2 text-[11px] leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-gray-400 shrink-0 font-medium">基础路径:</span>
                              <span className="text-gray-600 font-mono text-right break-all">{item.endpoint}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-gray-400 shrink-0 font-medium">授权密钥:</span>
                              <span className="text-gray-600 font-mono text-right">••••••••••••••••</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-1 shrink-0">
                        <div className="flex items-center gap-1.5">
                          {status?.loading ? (
                            <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                              <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                              <span>测试中...</span>
                            </span>
                          ) : status?.success ? (
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/40">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>连接畅通</span>
                            </span>
                          ) : status?.error ? (
                            <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100/40" title={status.error}>
                              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                              <span>连通性失败</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                              <HelpCircle className="w-3.5 h-3.5 text-gray-300" />
                              <span>未测试连通</span>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTestConnection(item)}
                          disabled={status?.loading}
                          className="px-3 py-1.5 text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100/75 rounded-lg border border-indigo-100/40 transition-all cursor-pointer uppercase tracking-wider"
                        >
                          测试连接
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isAdmin && (
                <div className="flex items-center justify-end pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleResetGlobalToDefault}
                    className="px-5 py-3 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-gray-150 bg-white"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>重置默认模版</span>
                  </button>
                </div>
              )}
            </>
          )}
        </form>

      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100/80 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">确认删除该接口配置吗？</h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  您确定要永久删除此大模型接口配置吗？此操作不可逆，将无法恢复。
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4.5 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleDeleteModel(deleteConfirmId)}
                className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-100 transition-all cursor-pointer"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
