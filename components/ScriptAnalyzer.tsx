
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { 
  FileSearch, 
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
  PenTool
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Config } from '../types';
import { toBase64 } from '../lib/utils';

// Set up PDF.js worker
const safePdfjsLib = (pdfjsLib as any).GlobalWorkerOptions ? (pdfjsLib as any) : ((pdfjsLib as any).default || pdfjsLib);
if (typeof window !== 'undefined' && safePdfjsLib && safePdfjsLib.GlobalWorkerOptions) {
  safePdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${safePdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

interface ScriptAnalyzerProps {
  config: Config;
  userPoints: number;
  deductPoints: (amount: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  refundPoints?: (amount: number, reason: string) => Promise<boolean>;
  onApplyStyle?: (styleManifesto: string) => void;
  inputText: string;
  setInputText: (text: string) => void;
  fileName: string | null;
  setFileName: (name: string | null) => void;
  analysisResult: string;
  setAnalysisResult: (result: string) => void;
  setHistory?: React.Dispatch<React.SetStateAction<any[]>>;
}

const ANALYZER_SYSTEM_PROMPT = `你是一位拥有20年经验的顶级好莱坞剧本医生和编剧导师。你精通罗伯特·麦基、布莱克·斯奈德等经典编剧理论。你的核心任务是执行“剧本拉片”：深度拆解优秀剧本的逻辑、结构、台词与视听密度。

分析维度要求：
1. 【骨架】宏观结构与节拍：识别叙事节点（中点、反转、灵魂黑夜等）。
2. 【血肉】人物弧光与权力关系：提炼 Want/Fear 与潜台词。
3. 【皮相】视听调度与描写风格：分析 Action Line 的文学性与切入逻辑。
4. 【声音】台词韵律与语言肖像：分析对白的句式长短、节奏。

【特别任务 - 创作规范总结】：
在分析报告的最后，请务必增加一个名为“AI剧本创作规范手册”的模块。这个模块需要将上述分析提炼成一套【可被AI直接执行的操作指令】，包括：
- 结构套路：如何布局冲突。
- 人物设定范式：角色必须具备的特征。
- 描写规范：描写动作时的特定词汇偏好。
- 对白规范： dialogue 的风格准则。

输出格式：
请按照以下格式输出深度分析报告：

# 深度拉片报告：《[剧本名]》

## 1. 结构节拍拆解
[分析内容...]

## 2. 人物弧光与关系
[分析内容...]

## 3. 视听语言与场景逻辑
[分析内容...]

## 4. 台词风格画像
[分析内容...]

## 5. 核心亮点总结
- [亮点1...]
- [亮点2...]

## 6. 【重点】AI 剧本创作规范手册（可作为创作模板）
[请在此处用极其精炼、指令化的语言总结出该剧本的“创作套路”。例如：
- 结构逻辑：采用[xx]式结构，前30%必须发生[xx]事件。
- 人物内核：主角必须带有[xx]的性格反差，动机必须是[xx]。
- 描写风格：使用[xx]式的短句，专注描写[xx]细节。
- 对白法则：句式长度控制在[xx]，潜台词严禁直说。]
`;

export const ScriptAnalyzer: React.FC<ScriptAnalyzerProps> = ({ 
  config, 
  userPoints, 
  deductPoints, 
  refundPoints,
  onApplyStyle,
  inputText,
  setInputText,
  fileName,
  setFileName,
  analysisResult,
  setAnalysisResult,
  setHistory
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractStyleManifesto = (text: string) => {
    const parts = text.split(/## 6\. 【重点】AI 剧本创作规范手册/i);
    if (parts.length > 1) return parts[1].trim();
    const altParts = text.split(/AI 剧本创作规范手册/i);
    if (altParts.length > 1) return altParts[1].trim();
    return "";
  };

  const handleApplyStyle = () => {
    const style = extractStyleManifesto(analysisResult);
    if (style && onApplyStyle) {
      onApplyStyle(style);
    } else {
      setError('未能识别到明确的创作规范，无法应用。请尝试重新分析。');
    }
  };

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

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      setError('请先输入剧本内容或上传剧本文件');
      return;
    }

    const wordCount = inputText.length;
    const cost = Math.max(2, Math.ceil(wordCount / 2000) * 2);
    if (userPoints < cost) {
      setError(`积分不足，本次分析需要 ${cost} 积分，请先充值`);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult('');

    try {
      const deduction = await deductPoints(cost, `剧本深度分析: ${fileName || inputText.substring(0, 20)}`);
      if (!deduction.success) {
        throw new Error(deduction.error || '积分扣除失败');
      }

      let targetUrl = (config.script.endpoint || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
      const model = config?.script?.model || 'gemini-3.1-pro-preview';
      
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
      
      const requestBody = isChatMode ? {
        model,
        messages: [
          { role: 'system', content: ANALYZER_SYSTEM_PROMPT },
          { role: 'user', content: `请对以下剧本内容进行深度拉片与剧本分析：\n\n${inputText}` }
        ],
        temperature: 0.7,
      } : {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${ANALYZER_SYSTEM_PROMPT}\n\n请对以下剧本内容进行深度拉片与剧本分析：\n\n${inputText}` }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
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
        throw new Error('分析失败，请稍后重试');
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                  data.choices?.[0]?.message?.content || 
                  data.text || '';
      
      if (!text) {
        throw new Error('AI 未返回内容，请检查接口配置');
      }

      setAnalysisResult(text);

      // Auto-save to history
      await saveToHistory(text);
    } catch (err: any) {
      setError(err.message || '分析过程中发生错误');
      if (refundPoints) {
        await refundPoints(cost, '剧本深度分析失败退款');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveToHistory = async (resultText: string) => {
    const token = localStorage.getItem('token');
    if (!token || !resultText) return;

    setIsSaving(true);
    const historyItem = {
      id: `analysis-${Date.now()}`,
      type: 'gen_script',
      status: 'success',
      revisedPrompt: resultText,
      config: {
        isAnalysis: true,
        sourceFileName: fileName,
        title: `剧本分析报告: ${fileName || inputText.substring(0, 15)}`,
        userPrompt: inputText
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
      console.error('Failed to save analysis to history:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Input */}
        <div className="lg:col-span-5 space-y-8">
          <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-bl-[100px] -z-0"></div>
            <h3 className="text-sm font-black text-gray-900 mb-5 flex items-center relative z-10">
              <Languages className="w-4 h-4 mr-2 text-blue-600" />
              剧本输入
            </h3>
            
            <div className="relative z-10 space-y-4">
              <div className="relative group">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="在此粘贴剧本片段，或者上传剧本文件..."
                  className="w-full h-80 bg-gray-50 border-2 border-dashed border-gray-100 rounded-3xl p-6 text-sm text-gray-700 placeholder-gray-300 focus:border-blue-200 focus:bg-white transition-all resize-none font-medium leading-relaxed"
                />
                
                {fileName && (
                  <div className="absolute top-4 right-4 flex items-center bg-blue-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black shadow-lg">
                    <FileText className="w-3 h-3 mr-1.5" />
                    <span className="max-w-[120px] truncate">{fileName}</span>
                    {(isParsing || isAnalyzing) ? (
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
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{isParsing ? '解析中...' : '上传剧本文件 (.txt, .pdf, .docx)'}</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".txt,.pdf,.docx" 
                  className="hidden" 
                />
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-gray-50">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">消耗积分</span>
                  <div className="flex items-center text-blue-600 font-black">
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    <span className="text-lg">{Math.max(2, Math.ceil(inputText.length / 2000) * 2)} 积分</span>
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !inputText.trim()}
                  className={`px-10 py-5 rounded-2xl text-[16px] font-black shadow-xl transition-all flex items-center space-x-3 ${
                    isAnalyzing || !inputText.trim()
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02] active:scale-95 shadow-blue-200'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCcw className="w-5 h-5 animate-spin" />
                      <span>正在深度分析中...</span>
                    </>
                  ) : (
                    <>
                      <FileSearch className="w-5 h-5" />
                      <span>开始拉片分析</span>
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
        </div>

        {/* Right: Output */}
        <div className="lg:col-span-7 flex flex-col h-[calc(100vh-200px)]">
           <div className="flex-1 bg-white rounded-[40px] border border-gray-100 shadow-xl shadow-gray-200/40 flex flex-col overflow-hidden relative">
            <div className="h-16 px-8 border-b border-gray-50 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FileSearch className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-black text-gray-900">分析报告</span>
              </div>
              
              {analysisResult && (
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={handleApplyStyle}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition-all group"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>按照此规范编写</span>
                  </button>
                  <div className="w-[1px] h-4 bg-gray-200" />
                  <button 
                    onClick={() => saveToHistory(analysisResult)}
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
                    <span>{saveSuccess ? '已保存在资产管理' : '保存分析报告'}</span>
                  </button>
                  <div className="w-[1px] h-4 bg-gray-200" />
                  <button 
                    onClick={handleCopy}
                    className="p-2 hover:bg-gray-50 rounded-xl transition-all group flex items-center space-x-2 text-gray-400 hover:text-blue-600"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    <span className="text-[11px] font-bold">{copied ? '已复制' : '复制'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-gray-50/30">
              {!analysisResult && !isAnalyzing && (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center mb-8 shadow-sm">
                    <FileSearch className="w-10 h-10 text-gray-100" />
                  </div>
                  <h4 className="text-gray-400 font-black text-xl">等待分析指令</h4>
                  <p className="text-gray-300 text-sm mt-4 max-w-sm font-medium leading-relaxed">
                    输入您想要研究的剧本片段，剧本拉片专家将从结构、人物、场景等多个专业维度为您提供深度解析。
                  </p>
                </div>
              )}

              {isAnalyzing && (
                <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center">
                  <div className="relative mb-8">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 rounded-full border-4 border-dashed border-blue-200"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileSearch className="w-10 h-10 text-blue-600 animate-pulse" />
                    </div>
                  </div>
                  <h4 className="text-gray-900 font-black text-xl mb-3">剧本深度拉片中...</h4>
                  <div className="flex flex-col space-y-2">
                    <motion.p 
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 3, repeat: Infinity, times: [0, 0.5, 1] }}
                      className="text-blue-600 text-sm font-bold tracking-widest uppercase"
                    >
                      正在拆解叙事节拍
                    </motion.p>
                    <p className="text-gray-400 text-[13px] font-medium max-w-[280px]">
                      剧本拉片专家正在基于经典编剧理论，对您的文本进行骨架、血肉与灵魂的深度扫描。
                    </p>
                  </div>
                </div>
              )}

              {analysisResult && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="prose prose-blue max-w-none prose-headings:font-black prose-p:font-medium prose-p:text-gray-700 prose-p:leading-relaxed"
                >
                  <ReactMarkdown>{analysisResult}</ReactMarkdown>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
