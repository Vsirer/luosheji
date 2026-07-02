
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  PenTool, 
  Sparkles, 
  Type, 
  BookOpen, 
  Layers, 
  Zap, 
  RefreshCcw,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  FileSearch
} from 'lucide-react';
import { 
  SCRIPT_GENRES, 
  RECOMMENDED_AUTHORS, 
  SCRIPT_LENGTHS, 
  SCRIPT_DURATIONS,
  GENERATION_COSTS 
} from '../constants';
import { toBase64, logUsage } from '../lib/utils';
import { Config, HistoryItem } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ScriptGeneratorProps {
  config: Config;
  userPoints: number;
  deductPoints: (amount: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  refundPoints?: (amount: number, reason: string) => Promise<boolean>;
  data?: any;
  setHistory?: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  appliedStyle?: string | null;
  onClearStyle?: () => void;
  // Lifted States
  selectedGenre: any;
  setSelectedGenre: (genre: any) => void;
  selectedAuthor: any;
  setSelectedAuthor: (author: any) => void;
  customAuthor: string;
  setCustomAuthor: (author: string) => void;
  selectedLength: any;
  setSelectedLength: (length: any) => void;
  selectedDuration: any;
  setSelectedDuration: (duration: any) => void;
}

export const ScriptGenerator: React.FC<ScriptGeneratorProps> = ({ 
  config, 
  userPoints, 
  deductPoints, 
  refundPoints,
  data, 
  setHistory,
  appliedStyle,
  onClearStyle,
  selectedGenre,
  setSelectedGenre,
  selectedAuthor,
  setSelectedAuthor,
  customAuthor,
  setCustomAuthor,
  selectedLength,
  setSelectedLength,
  selectedDuration,
  setSelectedDuration
}) => {
  const [prompt, setPrompt] = useState(data?.config?.userPrompt || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState(data?.revisedPrompt || '');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const calculateCost = () => {
    // This is no longer used for upfront charge, but left as a general helper
    return 2;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入剧本主题或大纲描述');
      return;
    }

    if (userPoints < 2) {
      setError('积分不足 (开始创作需账户内至少存有 2 积分)');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedScript('');

    const authorDisplayName = customAuthor.trim() || selectedAuthor.name;
    const numEpisodes = parseInt(selectedLength.id) || 1;
    let episodePrompt = '';
    if (numEpisodes === 1) {
      episodePrompt = `提供第一集完整正文（确保符合每集${selectedDuration.label}的时长要求，大约${Math.round(parseFloat(selectedDuration.id) * 1200)}字以上，内容极其详尽、生动且富有张力，包含极其饱满有深度的台词、对白描述，以及细节表现丰富的动作和神态，拒绝用缩写或空泛的情节概述带过）。`;
    } else if (numEpisodes <= 5) {
      episodePrompt = `提供第1集至第${numEpisodes}集全部${numEpisodes}集的完整剧本正文（每集之间用 "---" 进行清晰分割，每集都包含完整、详实、无缩水的台词与对白、极具镜头感的场景和动作设计，并确保每集独立且都完全满足每集${selectedDuration.label}的时长长度，每集实际字数都必须在${Math.round(parseFloat(selectedDuration.id) * 1200)}字以上，整部作品内容必须极其丰富生动，杜绝任何敷衍了事的大纲概括）。`;
    } else {
      episodePrompt = `由于篇幅较长，请先提供前5集（第1集至第5集）的完整剧本正文（每集之间用 "---" 进行清晰分割，每集都包含高密度的台词对白与精细入微的镜头画面感描述。说明后续各集数可使用“续写剧本”生成。确保每一集都充实饱满，实际每集字数均达到${Math.round(parseFloat(selectedDuration.id) * 1200)}字以上，杜绝空洞的几百字短剧情节描绘）。`;
    }

    try {
      let targetUrl = (config.script.endpoint || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
      const model = config?.script?.model || 'gemini-3.1-pro-preview';
      
      if (config.script.path) {
        const path = config.script.path.startsWith('/') ? config.script.path : `/${config.script.path}`;
        targetUrl += path;
      } else if (targetUrl.includes('generativelanguage.googleapis.com')) {
        targetUrl += `/v1beta/models/${model}:generateContent`;
      } else if (!targetUrl.includes(':generateContent') && !targetUrl.includes('/v1/chat/completions')) {
        if (targetUrl.includes('api.openai.com') || model.toLowerCase().includes('gpt')) {
          targetUrl += '/v1/chat/completions';
        } else {
          targetUrl += `/v1/models/${model}:generateContent`;
        }
      }

      const isChatMode = targetUrl.includes('/v1/chat/completions');
      
      const requestBody = isChatMode ? {
        model,
        messages: [
          { role: 'system', content: `你是一位殿堂级编剧。${appliedStyle ? `\n【核心创作规范】：\n${appliedStyle}` : `擅长类型：${selectedGenre.name}，模仿风格：${authorDisplayName}。`}` },
          { role: 'user', content: `请根据以下要求创作一份${selectedLength.label}（每集时长${selectedDuration.label}）的短剧剧本大纲及部分正文：
风格背景：${appliedStyle ? '请遵循上述核心创作规范' : (selectedAuthor?.name === '自定义' ? '自定义作者风格' : (selectedAuthor?.description || ''))}
剧本主题/大纲：${prompt}

要求：
1. 包含剧本名称。
2. 包含核心人物小传（3-5人）。
3. 包含整体剧情大纲及${selectedLength.label}的分集剧情简介。
4. ${episodePrompt}
5. 严格遵循所要求的作者风格和遣词造句方式。` }
        ],
        temperature: 0.7,
        max_tokens: 4000
      } : {
        contents: [{
          parts: [{
            text: `你是一位殿堂级编剧。${appliedStyle ? `\n【核心创作规范】：\n${appliedStyle}` : `擅长类型：${selectedGenre.name}，模仿风格：${authorDisplayName}。建议参考背景：${selectedAuthor?.name === '自定义' ? '自定义作者风格' : (selectedAuthor?.description || '')}`}
请根据以下要求创作一份${selectedLength.label}（每集时长${selectedDuration.label}）的短剧剧本大纲及部分正文：
剧本主题/大纲：${prompt}

要求：
1. 包含剧本名称。
2. 包含核心人物小传（3-5人）。
3. 包含整体剧情大纲及${selectedLength.label}的分集剧情简介。
4. ${episodePrompt}
5. 严格遵循所要求的套路、结构 and 遣词造句方式。`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 8000
        }
      };

      const response = await fetch('/api/v1/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          u: toBase64(targetUrl),
          m: 'POST',
          b: toBase64(JSON.stringify(requestBody)),
          k: config.script.apiKey
        })
      });

      if (!response.ok) {
        throw new Error('AI 生成失败，请稍后重试');
      }

      const responseData = await response.json();
      const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text || 
                  responseData.choices?.[0]?.message?.content || 
                  responseData.text || 
                  responseData.content || '';
      
      if (!text) {
        throw new Error('AI 未返回内容，请检查接口配置');
      }

      // Dynamic billing based on generated content length: 2 points per 2000 characters
      const actualCost = Math.max(2, Math.ceil(text.length / 2000) * 2);
      const chargeCost = Math.min(actualCost, Math.max(2, userPoints));

      const deduction = await deductPoints(chargeCost, `灵境文造(按量字数结算, 共 ${text.length} 字): ${selectedGenre.name}-${authorDisplayName}`);
      if (!deduction.success) {
        throw new Error(deduction.error || '积分扣除失败');
      }

      setGeneratedScript(text);

      const token = localStorage.getItem('token');
      if (token) {
        const historyItem: HistoryItem = {
          id: `script-${Date.now()}`,
          type: 'gen_script',
          status: 'success',
          revisedPrompt: text,
          config: {
            genre: selectedGenre.id,
            genreName: selectedGenre.name,
            author: authorDisplayName,
            length: selectedLength.id,
            lengthLabel: selectedLength.label,
            duration: selectedDuration.id,
            durationLabel: selectedDuration.label,
            userPrompt: prompt
          },
          timestamp: Date.now()
        };

        try {
          const historyRes = await fetch('/api/user/history', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(historyItem)
          });
          
          if (historyRes.ok && setHistory) {
            setHistory(prev => [historyItem, ...prev]);
          }
        } catch (historyErr) {
          console.error('Failed to save script to history:', historyErr);
        }
      }
      
      await logUsage('script_gen', chargeCost, {
        genre: selectedGenre.id,
        author: authorDisplayName,
        length: selectedLength.id,
        prompt: prompt.substring(0, 100)
      });
    } catch (err: any) {
      setError(err.message || '生成过程中发生错误');
    } finally {
      setIsGenerating(false);
    }
  };


  const handleCopy = () => {
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    if (!generatedScript) return;
    const blob = new Blob([generatedScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `剧本_${selectedGenre.name}_${new Date().toLocaleDateString()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Control Panel */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-8 flex flex-col h-[calc(100vh-200px)]">
          {/* Creative Input Panel */}
          <section className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-xl shadow-gray-100/50 relative overflow-hidden flex-1 flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50/30 rounded-bl-[128px] -z-0"></div>
            
            <div className="mb-8 relative z-10 text-left">
              <h3 className="text-xl font-black text-gray-900 flex items-center mb-2">
                <Sparkles className="w-6 h-6 mr-3 text-purple-600" />
                剧本创意灵感
              </h3>
              <p className="text-xs text-gray-400 font-medium ml-9">
                在这里输入您的故事核心、关键词或一段背景描述。
              </p>
            </div>

            <div className="flex-1 flex flex-col space-y-6 relative z-10">
              <div className="relative group flex-1">
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="请输入您的剧本创意或大概剧情...&#10;例如：在一个赛博朋克的未来，一名退役特工接到了最后一个寻找失踪 AI 的任务..."
                  className="w-full h-full bg-gray-50/50 border border-gray-100 rounded-[24px] p-6 text-sm font-medium text-gray-700 placeholder:text-gray-300 focus:ring-4 focus:ring-purple-100/50 focus:border-purple-200 focus:bg-white transition-all resize-none custom-scrollbar leading-relaxed"
                />
              </div>

              <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-[24px] flex items-center justify-between">
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-amber-600/60 font-bold uppercase tracking-widest mb-1">积分结算规则</span>
                  <div className="flex items-center text-amber-600">
                    <Zap className="w-5 h-5 mr-2 fill-amber-500" />
                    <span className="text-sm font-black tracking-tight">按输出字数扣除 <span className="opacity-60">(每2000字/2积分)</span></span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">账户剩余</span>
                  <span className="text-sm font-black text-gray-600">{userPoints} <span className="text-xs font-bold opacity-40">积分</span></span>
                </div>
              </div>

              <button 
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className={cn(
                  "w-full h-20 rounded-[24px] flex items-center justify-center space-x-4 transition-all font-black text-lg shadow-2xl relative overflow-hidden group shrink-0",
                  isGenerating || !prompt.trim() 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none" 
                    : "bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white shadow-purple-200 hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                {isGenerating ? (
                  <RefreshCcw className="w-6 h-6 animate-spin" />
                ) : (
                  <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                )}
                <span>{isGenerating ? "正在构思剧情..." : "立即生成剧本大纲"}</span>
              </button>
            </div>
          </section>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center text-red-600"
            >
              <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </motion.div>
          )}
        </div>

        {/* Right Output Area */}
        <div className="lg:col-span-12 xl:col-span-7 flex flex-col h-[calc(100vh-200px)]">
          <div className="flex-1 bg-white rounded-[32px] border border-gray-100 shadow-xl shadow-gray-200/40 flex flex-col overflow-hidden relative group">
            {/* Output Header */}
            <div className="h-14 px-6 border-b border-gray-50 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center space-x-2">
                <Type className="w-4 h-4 text-indigo-500" />
                <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">剧本正文</span>
              </div>
              
              {generatedScript && (
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={handleCopy}
                    className="p-2 hover:bg-gray-50 rounded-xl transition-all group flex items-center space-x-2 text-gray-400 hover:text-indigo-600"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    <span className="text-[11px] font-bold">{copied ? '已复制' : '复制'}</span>
                  </button>
                  <button 
                    onClick={handleExport}
                    className="p-2 hover:bg-gray-50 rounded-xl transition-all group flex items-center space-x-2 text-gray-400 hover:text-indigo-600"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-[11px] font-bold">导出</span>
                  </button>
                </div>
              )}
            </div>

            {/* Output Content */}
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative">
              {!generatedScript && !isGenerating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-[24px] flex items-center justify-center mb-6">
                    <PenTool className="w-10 h-10 text-gray-200" />
                  </div>
                  <h4 className="text-gray-300 font-black text-lg">等待大作开启</h4>
                  <p className="text-gray-200 text-sm mt-2 max-w-sm font-medium leading-relaxed">
                    在下方选择您心仪的编剧风格和篇幅规模，输入您的灵感碰撞，我们将为您呈现最专业的剧本文稿。
                  </p>
                </div>
              )}

              {isGenerating && (
                <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center">
                  <div className="relative mb-8">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 rounded-full border-4 border-dashed border-purple-200"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-purple-600 animate-bounce" />
                    </div>
                  </div>
                  <h4 className="text-gray-900 font-black text-xl mb-3">AI 剧本构思中...</h4>
                  <div className="flex flex-col space-y-2">
                    <motion.p 
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 3, repeat: Infinity, times: [0, 0.5, 1] }}
                      className="text-purple-600 text-sm font-bold tracking-widest uppercase"
                    >
                      正在拆解戏剧冲突
                    </motion.p>
                    <p className="text-gray-400 text-[13px] font-medium max-w-[280px]">
                      我们的大模型正在根据指定的风格调性，为您构建人物小传并编撰剧本正文。
                    </p>
                  </div>
                </div>
              )}

              {generatedScript && (
                <div className="prose prose-indigo max-w-none">
                  <div className="whitespace-pre-wrap text-gray-700 font-medium leading-[1.8] text-[15px] text-left">
                    {generatedScript}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
