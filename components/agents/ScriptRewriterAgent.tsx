import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Send, Paperclip, Plus, Command, ChevronDown, RefreshCcw, AlertCircle, Edit } from 'lucide-react';
import { scriptRewriterAgent } from '../../services/scriptRewriterAgent';
import { Config } from '../../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ScriptRewriterAgentProps {
  config: Config;
  userPoints: number;
  deductPoints: (amount: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  refundPoints?: (amount: number, reason: string) => Promise<boolean>;
  customDescription?: string;
}

export const ScriptRewriterAgent: React.FC<ScriptRewriterAgentProps> = ({ config, userPoints, deductPoints, refundPoints, customDescription }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: '您好！我是剧本改写专家。我可以帮您彻底重写剧本，保留核心冲突但完全规避版权风险。请提供原剧本。' }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const cost = 3;
    if (userPoints < cost) {
      setError('积分不足，请先充值');
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setInput('');
    setIsGenerating(true);
    setError(null);

    try {
      const deduction = await deductPoints(cost, `剧本深度改写: ${input.substring(0, 20)}...`);
      if (!deduction.success) {
        throw new Error(deduction.error || '积分扣除失败');
      }

      const response = await scriptRewriterAgent.callApi('script', 'generateContent', {
        model: config.script.model || 'gemini-3.5-flash',
        contents: currentMessages.map(m => ({
          role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction: customDescription || "你是一位拥有20年经验的专业剧本改写师。彻底规避任何版权风险，生成全新的剧本。",
          temperature: 0.8,
        }
      }, config);

      const aiContent = response.text || '抱歉，我暂时无法进行重写。';
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: aiContent }]);
    } catch (err: any) {
      console.error('ScriptRewriterAgent Error:', err);
      setError(err.message || '重写失败，请检查网络或配置');
      if (refundPoints) {
        await refundPoints(cost, '剧本改写专家咨询失败退款');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-24">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">✍️</div>
          <div>
            <h3 className="text-base font-bold text-gray-900">剧本改写专家</h3>
            <p className="text-[10px] text-gray-400 font-medium">规避版权风险、原创改写与深度创作</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
          <span className="text-[10px] font-bold text-teal-600">正在重写</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar h-[400px]" ref={scrollRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] px-5 py-3 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
              msg.role === 'user' ? 'bg-teal-600 text-white rounded-tr-none' : 'bg-gray-100 text-gray-700 rounded-tl-none border border-gray-200'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-teal-50 border border-teal-100 px-5 py-3 rounded-2xl rounded-tl-none flex items-center space-x-3 text-sm text-gray-400">
              <RefreshCcw className="w-4 h-4 animate-spin" />
              <span>正在进行原创规避改写...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 border border-red-100 px-4 py-2 rounded-xl flex items-center space-x-2 text-xs text-red-600 shadow-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-gray-50 bg-white">
        <div className="relative group">
          <div className={`absolute inset-0 bg-gradient-to-br from-teal-500 to-green-600 rounded-[24px] blur transition-opacity duration-300 ${isGenerating ? 'opacity-5' : 'opacity-0 group-focus-within:opacity-10'}`} />
          <div className={`relative bg-gray-50 rounded-[24px] border transition-all duration-300 p-2 ${isGenerating ? 'border-teal-100' : 'border-gray-100 group-focus-within:border-teal-200'}`}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              disabled={isGenerating}
              placeholder={isGenerating ? "正在规避版权风险..." : "输入剧本，我们将为您重写一个原创版本..."}
              className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[80px] px-4 py-2 text-sm placeholder:text-gray-300 font-medium disabled:opacity-50"
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <div className="flex items-center space-x-1">
                <button disabled={isGenerating} className="p-2 rounded-xl hover:bg-white text-gray-400 hover:text-teal-600 transition-all disabled:opacity-30"><Plus className="w-4 h-4" /></button>
                <button disabled={isGenerating} className="p-2 rounded-xl hover:bg-white text-gray-400 hover:text-teal-600 transition-all disabled:opacity-30"><Paperclip className="w-4 h-4" /></button>
              </div>
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${
                  input.trim() && !isGenerating ? 'bg-teal-600 text-white shadow-xl shadow-teal-100 hover:bg-teal-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isGenerating ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="text-xs">开始重写</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
