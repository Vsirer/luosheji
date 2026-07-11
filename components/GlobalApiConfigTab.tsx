import React, { useState, useEffect } from 'react';
import { Settings, Plus, X, Globe, Key, Monitor, Layers, Shield } from 'lucide-react';
import { ConfigModal } from './ConfigModal';
import { DEFAULT_CONFIG } from '../constants';
import { Config, ApiConfig } from '../types';
import { safeJson } from '../lib/fetch';

interface GlobalApiConfigTabProps {
  onUserUpdate?: () => void;
}

export const GlobalApiConfigTab: React.FC<GlobalApiConfigTabProps> = ({ onUserUpdate }) => {
  const [globalApiConfig, setGlobalApiConfig] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Add Custom Interface modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newModelType, setNewModelType] = useState<'text' | 'image' | 'video'>('text');
  const [apiType, setApiType] = useState('gemini');
  const [newApiKey, setNewApiKey] = useState('');
  const [newEndpoint, setNewEndpoint] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');

  const fetchGlobalApiConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/api-config', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await safeJson(res);
      if (data && Object.keys(data).length > 0) {
        setGlobalApiConfig({ ...DEFAULT_CONFIG, ...data });
      } else {
        setGlobalApiConfig(DEFAULT_CONFIG);
      }
    } catch (err) {
      console.error('Fetch global API config failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalApiConfig();
  }, []);

  // Sync endpoint and models based on apiType
  useEffect(() => {
    if (apiType === 'gemini') {
      setNewEndpoint('https://api.vectorengine.ai');
      setNewModel('gemini-3.5-flash');
      setNewDisplayName('Gemini 3.5 Flash');
    } else if (apiType === 'openai') {
      setNewEndpoint('https://api.openai.com/v1');
      setNewModel('gpt-4o');
      setNewDisplayName('GPT-4o');
    } else if (apiType === 'claude') {
      setNewEndpoint('https://api.anthropic.com');
      setNewModel('claude-3-5-sonnet-latest');
      setNewDisplayName('Claude 3.5 Sonnet');
    } else if (apiType === 'gemini-image') {
      setNewEndpoint('https://api.vectorengine.ai');
      setNewModel('gemini-3.1-flash-image-preview');
      setNewDisplayName('Gemini 3.1 Image');
    } else if (apiType === 'gpt-image') {
      setNewEndpoint('https://api.openai.com/v1');
      setNewModel('dall-e-3');
      setNewDisplayName('DALL-E 3');
    } else if (apiType === 'google-video') {
      setNewEndpoint('https://api.vectorengine.ai');
      setNewModel('veo-2.0-generateVideo-preview');
      setNewDisplayName('Veo 2.0');
    } else if (apiType === 'seedance') {
      setNewEndpoint('https://www.runninghub.cn/openapi/v2/rhart-video/sparkvideo-2.0/multimodal-video');
      setNewModel('seedance2.0');
      setNewDisplayName('Seedance 2.0');
    }
  }, [apiType]);

  const handleModelTypeChange = (type: 'text' | 'image' | 'video') => {
    setNewModelType(type);
    if (type === 'text') {
      setApiType('gemini');
    } else if (type === 'image') {
      setApiType('gemini-image');
    } else if (type === 'video') {
      setApiType('google-video');
    }
  };

  const handleSaveGlobalApi = async (newConfig: Config) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/settings/api-config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newConfig)
      });
      const data = await safeJson(res);
      if (res.ok && data) {
        setGlobalApiConfig(newConfig);
        if (onUserUpdate) onUserUpdate();
      } else if (data) {
        alert(data.error || '保存失败');
      }
    } catch (err) {
      alert('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddInterface = () => {
    const cleanKey = newKey.trim();
    const cleanTitle = newTitle.trim();
    const cleanApiKey = newApiKey.trim();

    if (!cleanKey) {
      alert('请输入接口唯一 ID');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanKey)) {
      alert('接口唯一 ID 只能包含字母、数字和下划线');
      return;
    }
    if (!cleanTitle) {
      alert('请输入接口名称');
      return;
    }
    if (!cleanApiKey) {
      alert('请输入 API KEY');
      return;
    }

    // Check uniqueness
    if (DEFAULT_CONFIG[cleanKey as keyof Config] || globalApiConfig.customInterfaces?.[cleanKey]) {
      alert('接口唯一 ID 已存在，请更换其他 ID');
      return;
    }

    // Determine protocolType & provider
    let protocolType: 'google' | 'openai' | 'claude' = 'openai';
    let provider = 'Third Party';

    if (apiType === 'gemini' || apiType === 'gemini-image' || apiType === 'google-video') {
      protocolType = 'google';
      provider = 'Google gemini';
    } else if (apiType === 'claude') {
      protocolType = 'claude';
      provider = 'Third Party';
    } else if (apiType === 'seedance') {
      protocolType = 'openai';
      provider = 'Seedance';
    }

    const newInterfaceData: ApiConfig & { title: string; isCustom: boolean } = {
      provider,
      endpoint: newEndpoint.trim(),
      path: '',
      model: newModel.trim(),
      displayName: newDisplayName.trim() || cleanTitle,
      apiKey: cleanApiKey,
      protocolType,
      modelType: newModelType,
      title: cleanTitle,
      isCustom: true
    };

    const updatedConfig = {
      ...globalApiConfig,
      customInterfaces: {
        ...(globalApiConfig.customInterfaces || {}),
        [cleanKey]: newInterfaceData
      }
    };

    handleSaveGlobalApi(updatedConfig);
    setShowAddModal(false);

    // Reset fields
    setNewKey('');
    setNewTitle('');
    setNewApiKey('');
    setNewEndpoint('');
    setNewModel('');
    setNewDisplayName('');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden p-12 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden relative">
      <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
            <Settings className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">全局接口配置</h2>
            <p className="text-zinc-500 text-sm">设置系统默认的 API 接口配置，当用户未配置自己的接口时将使用此配置。</p>
          </div>
        </div>
        <div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-3 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-2xl transition-all shadow-md shadow-indigo-100 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>添加接口</span>
          </button>
        </div>
      </div>

      <ConfigModal 
        config={globalApiConfig} 
        setConfig={handleSaveGlobalApi} 
        isPage={true} 
      />

      {/* Add Custom Interface Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl border border-gray-100 max-w-xl w-full p-8 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar space-y-6 animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-800">添加自定义 API 接口</h3>
                  <p className="text-xs text-gray-400 font-bold">向全局配置中动态新增一类 API 接口，无需修改代码</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <div className="space-y-4">
              {/* Row 1: Key & Title */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">接口唯一 ID (KEY)</label>
                  <input
                    type="text"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="例如: deepseek_text"
                    className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                  <p className="text-[9px] text-gray-400 ml-1">仅能输入英文字母、数字和下划线</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">接口名称 (TITLE)</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="例如: 智谱 GLM-4 接口"
                    className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
              </div>

              {/* Row 2: Model Type & API Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">模型类型 (MODEL TYPE)</label>
                  <select
                    value={newModelType}
                    onChange={e => handleModelTypeChange(e.target.value as any)}
                    className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
                  >
                    <option value="text">文本 (Text)</option>
                    <option value="image">图片 (Image)</option>
                    <option value="video">视频 (Video)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">接口类型 (API TYPE)</label>
                  <select
                    value={apiType}
                    onChange={e => setApiType(e.target.value)}
                    className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
                  >
                    {newModelType === 'text' && (
                      <>
                        <option value="gemini">gemini</option>
                        <option value="openai">openai</option>
                        <option value="claude">claude</option>
                      </>
                    )}
                    {newModelType === 'image' && (
                      <>
                        <option value="gemini-image">gemini-image</option>
                        <option value="gpt-image">gpt-image</option>
                      </>
                    )}
                    {newModelType === 'video' && (
                      <>
                        <option value="google-video">google-video</option>
                        <option value="seedance">seedance</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Row 3: API KEY */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">密钥 (API KEY)</label>
                <div className="relative">
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={e => setNewApiKey(e.target.value)}
                    placeholder="输入您的 API Key"
                    className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Key className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Row 4: Endpoint */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">接口地址 (API ENDPOINT)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={newEndpoint}
                    onChange={e => setNewEndpoint(e.target.value)}
                    placeholder="请输入 API 地址"
                    className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Globe className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Row 5: Model & Display Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">模型名称 (MODEL)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newModel}
                      onChange={e => setNewModel(e.target.value)}
                      placeholder="如: deepseek-chat"
                      className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Monitor className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">显示名称 (DISPLAY NAME)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={e => setNewDisplayName(e.target.value)}
                      placeholder="如: DeepSeek-V3"
                      className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <Shield className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-100 pt-6 flex gap-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 h-12 rounded-2xl border border-gray-200 text-gray-600 font-black text-sm hover:bg-gray-50 transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleAddInterface}
                className="flex-1 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-lg shadow-indigo-100 active:scale-95 transition-all cursor-pointer"
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
