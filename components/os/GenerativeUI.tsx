import React, { useState, useEffect, useRef } from 'react';
import { WebSandbox } from './WebSandbox';
import { Bot, Loader2, Sparkles, Maximize2, Minimize2, Save, X } from 'lucide-react';

interface GenerativeUIProps {
  intent: string;
  uiSchema?: string; // Pre-generated React code
  className?: string;
}

export const GenerativeUI: React.FC<GenerativeUIProps> = ({ intent, uiSchema, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState<string | null>(uiSchema || null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(!uiSchema);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pluginName, setPluginName] = useState('');
  const [pluginDesc, setPluginDesc] = useState('');
  const [pluginIcon, setPluginIcon] = useState('✨');
  const [pluginCategory, setPluginCategory] = useState<'text'|'image'|'video'|'all'>('all');

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement && document.fullscreenElement === containerRef.current;
      setIsFullscreen(isFull);
      window.dispatchEvent(new CustomEvent('generative-ui-fullscreen-change', {
        detail: { isFullscreen: isFull }
      }));
      if (isFull) {
        document.body.classList.add('generative-ui-fullscreen');
      } else {
        document.body.classList.remove('generative-ui-fullscreen');
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.body.classList.remove('generative-ui-fullscreen');
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen API failed", err);
      setIsFullscreen(!isFullscreen);
    }
  };
  
  const handleSavePlugin = () => {
    if (!pluginName.trim() || !code) return;
    
    const newPlugin = {
      id: 'custom_' + Date.now().toString(),
      name: pluginName,
      desc: pluginDesc,
      icon: pluginIcon,
      instruction: `[Generative UI Plugin: ${pluginName}] Please use the following code as reference: ${code}`,
      isPublic: true,
      isSystem: false,
      isInstalled: true,
      category: pluginCategory,
      status: 'approved' // Approved directly
    };
    
    const userPluginsStr = localStorage.getItem('user_plugins');
    const userPlugins = userPluginsStr ? JSON.parse(userPluginsStr) : [];
    userPlugins.push(newPlugin);
    localStorage.setItem('user_plugins', JSON.stringify(userPlugins));
    
    // Also save category for UI filtering
    localStorage.setItem(`plugin_category_${newPlugin.id}`, pluginCategory);
    
    setShowSaveModal(false);
    alert('插件添加成功！已直接启用并公开共享。');
    
    // force other components to sync and re-fetch plugins
    window.dispatchEvent(new CustomEvent('skills-changed'));
  };

  useEffect(() => {
    if (uiSchema) {
      setCode(uiSchema);
      setIsGenerating(false);
      return;
    }

    // In a real OS, this would call the intent engine to generate UI code
    const generate = async () => {
      setIsGenerating(true);
      // Simulate network request to AI
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const generatedCode = `
        const { useState } = React;
        
        function App() {
          const [count, setCount] = useState(0);
          return (
            <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
              <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center space-y-6">
                <h1 className="text-2xl font-bold text-gray-800">Generative UI for:</h1>
                <p className="text-gray-600 text-sm">{${JSON.stringify(intent)}}</p>
                
                <div className="flex justify-center items-center space-x-4 pt-4">
                  <button 
                    onClick={() => setCount(c => c - 1)}
                    className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center hover:bg-indigo-200 transition-colors"
                  >
                    -
                  </button>
                  <span className="text-3xl font-bold text-indigo-900 w-16">{count}</span>
                  <button 
                    onClick={() => setCount(c => c + 1)}
                    className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-md"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
      `;
      setCode(generatedCode);
      setIsGenerating(false);
    };

    generate();
  }, [intent, uiSchema]);

  return (
    <div ref={containerRef} className={`relative w-full border border-indigo-100 rounded-xl overflow-hidden ${className || ''} bg-gray-50 flex flex-col ${isFullscreen ? 'h-full' : ''}`}>
      <div className="h-10 border-b border-indigo-100 bg-white flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-medium text-gray-700">Generative UI Render Engine</span>
        </div>
        <div className="flex items-center space-x-3">
          {isGenerating ? (
            <span className="flex items-center text-[10px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating Code...
            </span>
          ) : (
            <>
              <button 
                onClick={() => setShowSaveModal(true)}
                className="flex items-center space-x-1 text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-full transition-colors font-medium"
              >
                <Save className="w-3 h-3" />
                <span>保存为插件</span>
              </button>
              <span className="flex items-center text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"> 
                Live
              </span>
            </>
          )}
          <button 
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
            title={isFullscreen ? "退出全屏" : "全屏预览"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      <div className="flex-1 relative min-h-[300px]">
        {isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-white/50 backdrop-blur-sm">
            <div className="relative">
              <div className="absolute inset-0 border-4 border-indigo-200 rounded-full animate-pulse"></div>
              <Bot className="w-12 h-12 text-indigo-600 relative z-10 animate-bounce" />
            </div>
            <p className="text-sm font-medium text-gray-600">Composing dynamic interface...</p>
          </div>
        ) : code ? (
          <WebSandbox code={code} className="border-none rounded-none" />
        ) : null}
      </div>

      {/* Save Plugin Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-800 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>保存为自定义插件</span>
              </h3>
              <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">插件名称</label>
                <input 
                  type="text" 
                  value={pluginName} 
                  onChange={e => setPluginName(e.target.value)}
                  placeholder="例如: 待办事项工具"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">功能描述</label>
                <textarea 
                  value={pluginDesc} 
                  onChange={e => setPluginDesc(e.target.value)}
                  placeholder="简短描述该插件的功能..."
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex space-x-4">
                <div className="w-1/3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">图标 (Emoji)</label>
                  <input 
                    type="text" 
                    value={pluginIcon} 
                    onChange={e => setPluginIcon(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="w-2/3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">适用场景 (分类)</label>
                  <select 
                    value={pluginCategory} 
                    onChange={e => setPluginCategory(e.target.value as any)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="all">通用 (All)</option>
                    <option value="text">文本生成 (Text)</option>
                    <option value="image">图像处理 (Image)</option>
                    <option value="video">视频剪辑 (Video)</option>
                  </select>
                </div>
              </div>
              <div className="bg-emerald-50 text-emerald-600 text-[11px] p-3 rounded-lg border border-emerald-100 flex items-start space-x-2">
                <span>✅</span>
                <span>此插件将直接添加并启用，对所有用户公开共享，无需管理员审核。</span>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
              <button 
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleSavePlugin}
                disabled={!pluginName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                直接添加启用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
