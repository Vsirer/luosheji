
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Film, 
  Upload, 
  Sparkles, 
  FileVideo, 
  AlertCircle, 
  RefreshCcw,
  Download,
  Copy,
  CheckCircle2,
  X,
  Video,
  Loader2,
  ListVideo
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Config } from '../types';
import { toBase64 } from '../lib/utils';
import { directorAgent } from '../services/directorAgent';

interface ScriptVideoDissectorProps {
  config: Config;
  userPoints: number;
  deductPoints: (amount: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  refundPoints?: (amount: number, reason: string) => Promise<boolean>;
  setHistory?: React.Dispatch<React.SetStateAction<any[]>>;
}

const DISSECTOR_SYSTEM_PROMPT = `你是一位顶级的视听语言分析师和分镜导演。你的核心任务是执行“影音拉片”：深度拆解视频内容，并将其还原为极其专业的视听剧本格式。

输出要求：
1. 必须包含：镜头序号、起始时间、镜头类型、运镜方式、动作/画面描述、台词/配音、音效/SFX。
2. 完整性：必须覆盖视频全片，从第一秒到最后一秒，不得中途截断。
3. 风格：专业、精炼、指令化。
4. 严禁出现背景音乐、字幕描述（除非特殊需要）。

输出格式示例：
镜头1（0-3s）：【镜头: 大特写】【运镜: 静态】[人物名]瞳孔骤缩，呼吸屏息，整个人愣在原地。
镜头2（3-6s）：【镜头: 近景】【运镜: 推镜头】[人物名]：“[台词内容]” [动作描述] SFX: [音效]。
...以此类推。

请对以下视频进行深度拉片分析，并严格遵守上述格式。`;

export const ScriptVideoDissector: React.FC<ScriptVideoDissectorProps> = ({ 
  config, 
  userPoints, 
  deductPoints, 
  refundPoints,
  setHistory
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [analysisResult, setAnalysisResult] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('请上传视频文件');
      return;
    }

    if (file.size > 20 * 1024 * 1024) { // 20MB Limit for base64 transport
      setError('为了分析效率，目前仅支持 20MB 以内的视频文件');
      return;
    }

    setError(null);
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    setAnalysisResult('');

    // Fetch video duration
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = url;
    tempVideo.onloadedmetadata = () => {
      setVideoDuration(tempVideo.duration);
    };
  };

  const clearInput = () => {
    setVideoFile(null);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    setVideoDuration(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setAnalysisResult('');
  };

  const handleAnalyze = async () => {
    if (!videoFile) {
      setError('请先上传视频文件');
      return;
    }

    const cost = 2;
    if (userPoints < cost) {
      setError("积分不足 (开始分析需账户内至少存有 2 积分)");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult('');

    try {
      // Convert video to base64 for Gemini
      const videoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(videoFile);
      });

      // Construct target URL
      let targetUrl = (config.script.endpoint || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
      const model = config?.script?.model || 'gemini-3-flash-preview';
      
      // Video analysis is best done via native Gemini API structure
      // directorAgent.callApi will handle the protocol switching (Google vs OpenAI)
      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              { text: DISSECTOR_SYSTEM_PROMPT },
              {
                inlineData: {
                  mimeType: videoFile.type,
                  data: videoBase64
                }
              }
            ]
          }
        ],
        config: {
          temperature: 0.2,
          maxOutputTokens: 8192
        }
      };

      const response = await directorAgent.callApi('script', 'generateContent', requestBody, config);

      const text = response.text || 
                  (response.candidates?.[0]?.content?.parts?.[0]?.text) || 
                  (response.choices?.[0]?.message?.content) || '';
      
      if (!text) {
        throw new Error('AI 未能从视频中提取有效信息，请确保视频清晰');
      }

      // Calculate the actual output cost based on output length
      const actualCost = Math.max(2, Math.ceil(text.length / 2000) * 2);
      const chargeCost = Math.min(actualCost, Math.max(2, userPoints));

      const deduction = await deductPoints(
        chargeCost, 
        `影音拉片量化结算(共 ${text.length} 字): ${videoFile.name}`
      );
      if (!deduction.success) {
        throw new Error(deduction.error || '积分扣除失败');
      }

      setAnalysisResult(text);
      await saveToHistory(text);
    } catch (err: any) {
      setError(err.message || '分析过程中发生错误');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveToHistory = async (resultText: string) => {
    const token = localStorage.getItem('token');
    if (!token || !resultText) return;

    setIsSaving(true);
    const historyItem = {
      id: `dissection-${Date.now()}`,
      type: 'gen_script',
      status: 'success',
      revisedPrompt: resultText,
      config: {
        isDissection: true,
        sourceFileName: videoFile?.name,
        title: `影音拉片报告: ${videoFile?.name || '未知视频'}`,
        userPrompt: 'Video analysis extraction'
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
      console.error('Failed to save to history:', err);
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
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50/50 rounded-bl-[100px] -z-0"></div>
            <h3 className="text-sm font-black text-gray-900 mb-5 flex items-center relative z-10">
              <Video className="w-4 h-4 mr-2 text-purple-600" />
              视频上传
            </h3>
            
            <div className="relative z-10 space-y-4">
              <div className="relative group">
                <div 
                  className={`w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center transition-all ${!videoPreviewUrl ? 'cursor-pointer hover:border-purple-200 hover:bg-white' : ''}`}
                  onClick={() => !videoPreviewUrl && fileInputRef.current?.click()}
                >
                  {videoPreviewUrl ? (
                    <div className="relative w-full h-full p-2">
                       <video 
                        src={videoPreviewUrl} 
                        className="w-full h-full object-contain rounded-2xl bg-black"
                        controls
                      />
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          clearInput();
                        }}
                        className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-black transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center p-8 text-center">
                      <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-4">
                        <Upload className="w-8 h-8 text-purple-400" />
                      </div>
                      <p className="text-sm font-bold text-gray-600">点击或将视频拖入此处</p>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium">支持 MP4, WebM (最大 20MB)</p>
                    </div>
                  )}
                </div>
                
                {videoFile && (
                  <div className="mt-4 flex flex-col space-y-1 px-4 py-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
                    <div className="flex items-center">
                      <FileVideo className="w-4 h-4 mr-2 shrink-0" />
                      <span className="text-xs font-black truncate flex-1">{videoFile.name}</span>
                      <span className="text-[10px] font-bold text-purple-400 ml-2">已就绪</span>
                    </div>
                    {videoDuration > 0 && (
                      <div className="text-[10px] text-purple-400 font-bold pl-6">
                        视频时长: {Math.round(videoDuration)}秒
                      </div>
                    )}
                  </div>
                )}
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleVideoUpload} 
                accept="video/*" 
                className="hidden" 
              />

              <div className="pt-4 flex items-center justify-between border-t border-gray-50">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">消耗积分</span>
                  <div className="flex items-center text-purple-600 font-black">
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    <span className="text-sm font-black text-amber-500 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                      2000字/2分
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !videoFile}
                  className={`px-10 py-5 rounded-2xl text-[16px] font-black shadow-xl transition-all flex items-center space-x-3 ${
                    isAnalyzing || !videoFile
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-[1.02] active:scale-95 shadow-purple-200'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCcw className="w-5 h-5 animate-spin" />
                      <span>视听深度拉片中...</span>
                    </>
                  ) : (
                    <>
                      <Film className="w-5 h-5" />
                      <span>开始影音拉片</span>
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

          <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
             <div className="flex items-start space-x-3">
               <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
               <div className="flex-1">
                 <p className="text-[11px] font-black text-amber-900 mb-1">拉片建议：</p>
                 <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                   上传画面清晰、台词完整、动作明确的短视频，分析效果最佳。建议视频长度在 15-60 秒之间。
                 </p>
               </div>
             </div>
          </div>
        </div>

        {/* Right: Output */}
        <div className="lg:col-span-7 flex flex-col h-[calc(100vh-200px)]">
           <div className="flex-1 bg-white rounded-[40px] border border-gray-100 shadow-xl shadow-gray-200/40 flex flex-col overflow-hidden relative">
            <div className="h-16 px-8 border-b border-gray-50 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                  <ListVideo className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-sm font-black text-gray-900">拉片剧本输出</span>
              </div>
              
              {analysisResult && (
                <div className="flex items-center space-x-3">
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
                    <span>{saveSuccess ? '已保存在资产管理' : '下载拉片剧本'}</span>
                  </button>
                  <div className="w-[1px] h-4 bg-gray-200" />
                  <button 
                    onClick={handleCopy}
                    className="p-2 hover:bg-gray-50 rounded-xl transition-all group flex items-center space-x-2 text-gray-400 hover:text-purple-600"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    <span className="text-[11px] font-bold">{copied ? '已复制' : '复制剧本'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-gray-50/30">
              {!analysisResult && !isAnalyzing && (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center mb-8 shadow-sm">
                    <Film className="w-10 h-10 text-gray-100" />
                  </div>
                  <h4 className="text-gray-400 font-black text-xl">等待视频拉片指令</h4>
                  <p className="text-gray-300 text-sm mt-4 max-w-sm font-medium leading-relaxed">
                    影音拉片专家将为您深度还原视频中的视听细节，生成标准分镜剧本。
                  </p>
                </div>
              )}

              {isAnalyzing && (
                <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center">
                  <div className="relative mb-8">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 rounded-full border-4 border-dashed border-purple-200"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="w-10 h-10 text-purple-600 animate-pulse" />
                    </div>
                  </div>
                  <h4 className="text-gray-900 font-black text-xl mb-3">AI 深度拉片扫描中...</h4>
                  <div className="flex flex-col space-y-2">
                    <motion.p 
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 3, repeat: Infinity, times: [0, 0.5, 1] }}
                      className="text-purple-600 text-sm font-bold tracking-widest uppercase"
                    >
                      正在识别镜头逻辑与台词
                    </motion.p>
                  </div>
                </div>
              )}

              {analysisResult && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="prose prose-purple max-w-none prose-headings:font-black prose-p:font-medium prose-p:text-gray-700 prose-p:leading-relaxed"
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
