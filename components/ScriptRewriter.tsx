
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { 
  PenTool, 
  Upload, 
  Sparkles, 
  FileText, 
  AlertCircle, 
  RefreshCcw,
  Download,
  Copy,
  CheckCircle2,
  X,
  Languages,
  Loader2,
  RotateCcw,
  ChevronDown,
  Clock,
  Layers
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Config, HistoryItem } from '../types';
import { toBase64 } from '../lib/utils';
import { 
  EPISODE_OPTIONS, 
  SCRIPT_DURATIONS, 
  REWRITE_SYSTEM_PROMPT 
} from '../constants';

// Set up PDF.js worker
const safePdfjsLib = (pdfjsLib as any).GlobalWorkerOptions ? (pdfjsLib as any) : ((pdfjsLib as any).default || pdfjsLib);
if (typeof window !== 'undefined' && safePdfjsLib && safePdfjsLib.GlobalWorkerOptions) {
  safePdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${safePdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

interface ScriptRewriterProps {
  config: Config;
  userPoints: number;
  deductPoints: (amount: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  refundPoints?: (amount: number, reason: string) => Promise<boolean>;
  inputText: string;
  setInputText: (text: string) => void;
  fileName: string | null;
  setFileName: (name: string | null) => void;
  rewriteResult: string;
  setRewriteResult: (result: string) => void;
  setHistory?: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
}

const EPISODE_OPTIONS_LABELS = EPISODE_OPTIONS.map(opt => opt.label);
const DURATION_OPTIONS_LABELS = SCRIPT_DURATIONS.map(opt => opt.label);

export const ScriptRewriter: React.FC<ScriptRewriterProps> = ({ 
  config, 
  userPoints, 
  deductPoints, 
  refundPoints,
  inputText,
  setInputText,
  fileName,
  setFileName,
  rewriteResult,
  setRewriteResult,
  setHistory
}) => {
  const [isRewriting, setIsRewriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  
  const [episodes, setEpisodes] = useState("1集");
  const [duration, setDuration] = useState("1.5min");
  const [showEpisodesDropdown, setShowEpisodesDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
    setIsParsing(true);

    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setInputText(content);
          setIsParsing(false);
        };
        reader.readAsText(file);
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = safePdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n\n';
        }
        
        setInputText(fullText);
        setIsParsing(false);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setInputText(result.value);
        setIsParsing(false);
      } else {
        throw new Error('目前仅支持 .txt, .pdf, .docx 格式的剧本文件');
      }
    } catch (err: any) {
      setError(err.message || '文件解析失败');
      setFileName(null);
      setIsParsing(false);
    }
  };

  const clearInput = () => {
    setInputText('');
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRewrite = async () => {
    if (!inputText.trim()) {
      setError('请先输入剧本内容或上传剧本文件');
      return;
    }

    const wordCount = inputText.length;
    const cost = Math.max(2, Math.ceil(wordCount / 2000) * 2);
    if (userPoints < cost) {
      setError(`积分不足，本次改写需要 ${cost} 积分，请先充值`);
      return;
    }

    setIsRewriting(true);
    setError(null);
    setRewriteResult('');

    try {
      const deduction = await deductPoints(cost, `剧本洗稿改写: ${fileName || inputText.substring(0, 20)}`);
      if (!deduction.success) {
        throw new Error(deduction.error || '积分扣除失败');
      }

      let targetUrl = (config.script.endpoint || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
      const model = config?.script?.model || 'gemini-1.5-pro-latest';
      
      if (targetUrl.includes('generativelanguage.googleapis.com')) {
        targetUrl += `/v1beta/models/${model}:generateContent`;
      } else if (!targetUrl.includes(':generateContent') && !targetUrl.includes('/v1/chat/completions')) {
         if (targetUrl.includes('api.openai.com') || model.toLowerCase().includes('gpt')) {
          targetUrl += '/v1/chat/completions';
        } else {
          targetUrl += `/v1/models/${model}:generateContent`;
        }
      }

      const isChatMode = targetUrl.includes('/v1/chat/completions');
      
      const userPrompt = `请帮我改写以下剧本，确保结构保留但内容彻底原创且规避版权。
设定要求：
- 剧本篇幅：${episodes}
- 每集时长：${duration}

原剧本内容：
${inputText}`;

      const requestBody = isChatMode ? {
        model,
        messages: [
          { role: 'system', content: REWRITE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
      } : {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${REWRITE_SYSTEM_PROMPT}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 8192
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
        throw new Error('改写失败，请稍后重试');
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                  data.choices?.[0]?.message?.content || 
                  data.text || '';
      
      if (!text) {
        throw new Error('AI 未返回内容，请检查接口配置');
      }

      setRewriteResult(text);

      // Auto-save to history
      await saveToHistory(text);
    } catch (err: any) {
      setError(err.message || '改写过程中发生错误');
      if (refundPoints) {
        await refundPoints(cost, '剧本改写重写失败退款');
      }
    } finally {
      setIsRewriting(false);
    }
  };

  const saveToHistory = async (resultText: string) => {
    const token = localStorage.getItem('token');
    if (!token || !resultText) return;

    setIsSaving(true);
    const historyItem: HistoryItem = {
      id: `rewrite-${Date.now()}`,
      type: 'gen_script',
      status: 'success' as const,
      revisedPrompt: resultText,
      config: {
        isRewrite: true,
        sourceFileName: fileName,
        title: `剧本改写稿: ${fileName || inputText.substring(0, 15)}`,
        userPrompt: inputText,
        episodes,
        duration
      },
      timestamp: Date.now()
    };

    try {
      const res = await fetch('/api/user/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(historyItem)
      });
      
      if (res.ok && setHistory) {
        setHistory(prev => [historyItem, ...prev]);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save rewrite to history:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rewriteResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Input */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50/50 rounded-bl-[100px] -z-0"></div>
            <h3 className="text-sm font-black text-gray-900 mb-5 flex items-center relative z-10">
              <RotateCcw className="w-4 h-4 mr-2 text-purple-600" />
              原剧本输入
            </h3>
            
            <div className="relative z-10 space-y-4">
              <div className="relative group">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="在此粘贴原剧本内容，或者上传剧本文件..."
                  className="w-full h-80 bg-gray-50 border-2 border-dashed border-gray-100 rounded-3xl p-6 text-sm text-gray-700 placeholder-gray-300 focus:border-purple-200 focus:bg-white transition-all resize-none font-medium leading-relaxed"
                />
                
                {fileName && (
                  <div className="absolute top-4 right-4 flex items-center bg-purple-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black shadow-lg shadow-purple-200">
                    <FileText className="w-3 h-3 mr-1.5" />
                    <span className="max-w-[120px] truncate">{fileName}</span>
                    {(isParsing || isRewriting) ? (
                      <div className="ml-2 bg-white/20 rounded-full p-0.5 animate-spin">
                        <RefreshCcw className="w-3 h-3" />
                      </div>
                    ) : (
                      <button onClick={clearInput} className="ml-2 hover:bg-white/20 rounded-full p-0.5 transition-all">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing}
                  className="flex-1 flex items-center justify-center space-x-2 py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl text-xs font-black transition-all border border-gray-100 disabled:opacity-50"
                >
                  {isParsing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{isParsing ? '解析中...' : '上传原剧本文件 (.txt, .pdf, .docx)'}</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".txt,.pdf,.docx" 
                  className="hidden" 
                />
              </div>

              {/* Added Config Selectors */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                {/* Episodes Selector */}
                <div className="space-y-2 relative">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider ml-1">剧本篇幅</label>
                  <button 
                    onClick={() => setShowEpisodesDropdown(!showEpisodesDropdown)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-700 hover:bg-white hover:border-purple-200 transition-all"
                  >
                    <div className="flex items-center">
                      <Layers className="w-3.5 h-3.5 mr-2 text-purple-500" />
                      {episodes}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showEpisodesDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showEpisodesDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute bottom-full mb-2 left-0 w-full bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 max-h-48 overflow-y-auto custom-scrollbar"
                      >
                        {EPISODE_OPTIONS_LABELS.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setEpisodes(opt);
                              setShowEpisodesDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-xs font-bold transition-all ${episodes === opt ? 'bg-purple-50 text-purple-600' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Duration Selector */}
                <div className="space-y-2 relative">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider ml-1">每集时长</label>
                  <button 
                    onClick={() => setShowDurationDropdown(!showDurationDropdown)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-700 hover:bg-white hover:border-purple-200 transition-all"
                  >
                    <div className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-2 text-purple-500" />
                      {duration}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDurationDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showDurationDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute bottom-full mb-2 left-0 w-full bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 max-h-48 overflow-y-auto custom-scrollbar"
                      >
                        {DURATION_OPTIONS_LABELS.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setDuration(opt);
                              setShowDurationDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-xs font-bold transition-all ${duration === opt ? 'bg-purple-50 text-purple-600' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-gray-50">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">消耗积分</span>
                  <div className="flex items-center text-purple-600 font-black">
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    <span className="text-lg">{Math.max(2, Math.ceil(inputText.length / 2000) * 2)} 积分</span>
                  </div>
                </div>

                <button
                  onClick={handleRewrite}
                  disabled={isRewriting || !inputText.trim()}
                  className={`px-10 py-5 rounded-2xl text-[16px] font-black shadow-xl transition-all flex items-center space-x-3 ${
                    isRewriting || !inputText.trim()
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-[1.02] active:scale-95 shadow-purple-200/50'
                  }`}
                >
                  {isRewriting ? (
                    <>
                      <RefreshCcw className="w-5 h-5 animate-spin" />
                      <span>正在深度改写中...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-5 h-5" />
                      <span>开始剧本改写</span>
                    </>
                  )}
                </button>
              </div>
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

          <div className="bg-amber-50/50 border border-amber-100 rounded-3xl p-6">
            <h4 className="text-xs font-black text-amber-900 mb-3 uppercase tracking-wider flex items-center">
              <AlertCircle className="w-3.5 h-3.5 mr-2" />
              改写规则说明
            </h4>
            <ul className="text-[11px] text-amber-800/80 space-y-2 font-medium">
              <li>• 保留原剧本结构：开端、高潮、结局节拍完全一致。</li>
              <li>• 规避版权：角色姓名、场景细节、台词完全重新撰写。</li>
              <li>• 独立原创：生成内容可直接用于拍摄而不构成侵权。</li>
              <li>• 格式还原：自动保持剧本标准排版格式。</li>
            </ul>
          </div>
        </div>

        {/* Right: Output */}
        <div className="lg:col-span-7 flex flex-col h-[calc(100vh-200px)]">
           <div className="flex-1 bg-white rounded-[40px] border border-gray-100 shadow-xl shadow-gray-200/40 flex flex-col overflow-hidden relative">
            <div className="h-16 px-8 border-b border-gray-50 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                  <RotateCcw className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-sm font-black text-gray-900">原创改写稿</span>
              </div>
              
              {rewriteResult && (
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => saveToHistory(rewriteResult)}
                    disabled={isSaving}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      saveSuccess 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : saveSuccess ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{saveSuccess ? '已保存在资产管理' : '保存改写稿'}</span>
                  </button>
                  <div className="w-[1px] h-4 bg-gray-200" />
                  <button 
                    onClick={handleCopy}
                    className="p-2 hover:bg-gray-50 rounded-xl transition-all group flex items-center space-x-2 text-gray-400 hover:text-purple-600"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    <span className="text-[11px] font-bold">{copied ? '已复制' : '复制'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-gray-50/30">
              {!rewriteResult && !isRewriting && (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center mb-8 shadow-sm">
                    <RotateCcw className="w-10 h-10 text-gray-100" />
                  </div>
                  <h4 className="text-gray-400 font-black text-xl">等待改写指令</h4>
                  <p className="text-gray-300 text-sm mt-4 max-w-sm font-medium leading-relaxed">
                    在这里上传您的参考剧本，我们的改写专家将为您保留其精妙结构，并输出一份完全原创、无版权争议的新作品。
                  </p>
                </div>
              )}

              {isRewriting && (
                <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center">
                  <div className="relative mb-8">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 rounded-full border-4 border-dashed border-purple-200"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <RotateCcw className="w-10 h-10 text-purple-600 animate-pulse" />
                    </div>
                  </div>
                  <h4 className="text-gray-900 font-black text-xl mb-3">极致洗稿改写中...</h4>
                  <div className="flex flex-col space-y-2">
                    <motion.p 
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 3, repeat: Infinity, times: [0, 0.5, 1] }}
                      className="text-purple-600 text-sm font-bold tracking-widest uppercase"
                    >
                      正在彻底重构台词与场景
                    </motion.p>
                    <p className="text-gray-400 text-[13px] font-medium max-w-[280px]">
                      改写专家正在严格遵守结构保留与版权规避的双重标准，为您打造全新的原创剧本。
                    </p>
                  </div>
                </div>
              )}

              {rewriteResult && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="prose prose-purple max-w-none prose-headings:font-black prose-p:font-medium prose-p:text-gray-700 prose-p:leading-relaxed"
                >
                  <ReactMarkdown>{rewriteResult}</ReactMarkdown>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

