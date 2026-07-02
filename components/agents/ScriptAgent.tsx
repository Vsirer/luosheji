import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Send, Paperclip, Plus, Command, ChevronDown, RefreshCcw, AlertCircle } from 'lucide-react';
import { directorAgent } from '../../services/directorAgent';
import { Config } from '../../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ScriptAgentProps {
  config: Config;
  userPoints: number;
  deductPoints: (amount: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  refundPoints?: (amount: number, reason: string) => Promise<boolean>;
  customDescription?: string;
}

const SCRIPT_AGENT_SYSTEM_INSTRUCTION = `你是一位世界级的顶级编剧助理，专注于短剧和影视剧本的创意开发。
你的任务是协助用户构思核心创意、完善剧本大纲、设计人物小传以及创作剧本正文。

## 执行原则：
1. **专业性**：使用专业的影视术语（如：视觉钩子、节奏点、人物弧光等）。
2. **互动性**：不要一次性给出整篇剧本，除非用户明确要求。先从创意探讨开始，通过提问引导用户完善细节。
3. **风格化**：根据用户的需求调整写作风格（如：科幻、甜宠、悬疑等）。
4. **简洁高效**：回复要重点突出，避免过多的废话。

## 关键流程：
1. **创意碰撞**：当用户提出想法时，分析其创新点和核心冲突点，给出 2-3 个扩展方向。
2. **大纲构建**：协助用户梳理起承转合，建立清晰的结构。
3. **正文创作**：在用户确认大纲后，开始创作高张力的剧本对白和画面描述。

请全程使用中文交流。`;

export const ScriptAgent: React.FC<ScriptAgentProps> = ({ config, userPoints, deductPoints, refundPoints, customDescription }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: '您好！我是灵境文造。我可以帮您构思创意剧本、剧本大纲以及填充细节。您想聊聊什么题材？' }
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

    const cost = 2; // Fixed cost for agent interaction
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
      // Deduct points
      const deduction = await deductPoints(cost, `编剧专家咨询: ${input.substring(0, 20)}...`);
      if (!deduction.success) {
        throw new Error(deduction.error || '积分扣除失败');
      }

      // Prepare contents for Gemini API
      const contents = currentMessages.map(m => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.content }]
      }));

      const response = await directorAgent.callApi('script', 'generateContent', {
        model: config.script.model || 'gemini-1.5-pro',
        contents,
        config: {
          systemInstruction: customDescription || SCRIPT_AGENT_SYSTEM_INSTRUCTION,
          temperature: 0.7,
        }
      }, config);

      const aiContent = response.text || '抱歉，我暂时无法处理您的请求。';
      
      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: aiContent
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('ScriptAgent Error:', err);
      setError(err.message || '生成失败，请检查网络或配置');
      if (refundPoints) {
        await refundPoints(cost, '编剧专家咨询失败退款');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">✍️</div>
          <div>
            <h3 className="text-base font-bold text-gray-900">灵境文造</h3>
            <p className="text-[10px] text-gray-400 font-medium">核心创意、剧本大纲及细节创作</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-600">接入中</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar h-[400px]" ref={scrollRef}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] px-5 py-3 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-gray-100 text-gray-700 rounded-tl-none border border-gray-200'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-100 px-5 py-3 rounded-2xl rounded-tl-none flex items-center space-x-3 text-sm text-gray-400">
              <RefreshCcw className="w-4 h-4 animate-spin" />
              <span>正在构思中...</span>
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

      {/* Input Area */}
      <div className="p-6 border-t border-gray-50 bg-white">
        <div className="flex items-center space-x-3 overflow-x-auto pb-4 no-scrollbar">
          <button className="flex-none flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-gray-100 hover:bg-gray-50 text-gray-600 transition-all">
            <span className="text-xs font-medium">角色: <b>罗帅-女装搭配</b></span>
            <ChevronDown className="w-3 h-3 opacity-40" />
          </button>
          <button className="flex-none flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-gray-100 hover:bg-gray-50 text-gray-600 transition-all">
            <span className="text-xs font-medium">模型: <b>{config?.script?.model || 'Gemini'}</b></span>
          </button>
        </div>
        
        <div className="relative group">
          <div className={`absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[24px] blur transition-opacity duration-300 ${isGenerating ? 'opacity-5' : 'opacity-0 group-focus-within:opacity-10'}`} />
          <div className={`relative bg-gray-50 rounded-[24px] border transition-all duration-300 p-2 ${isGenerating ? 'border-blue-100' : 'border-gray-100 group-focus-within:border-blue-200'}`}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isGenerating}
              placeholder={isGenerating ? "灵境文造正在执行中..." : "与灵境文造交流剧本创意..."}
              className="w-full bg-transparent border-none focus:ring-0 resize-none min-h-[80px] px-4 py-2 text-sm placeholder:text-gray-300 font-medium disabled:opacity-50"
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <div className="flex items-center space-x-1">
                <button 
                  disabled={isGenerating}
                  className="p-2 rounded-xl hover:bg-white text-gray-400 hover:text-blue-600 transition-all disabled:opacity-30"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button 
                  disabled={isGenerating}
                  className="p-2 rounded-xl hover:bg-white text-gray-400 hover:text-blue-600 transition-all disabled:opacity-30"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <div className="flex items-center space-x-1 text-[10px] text-gray-300 font-bold uppercase tracking-widest px-2">
                  <Command className="w-3 h-3" />
                  <span>Enter 发送</span>
                </div>
              </div>
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${
                  input.trim() && !isGenerating
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-100 hover:bg-blue-700' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isGenerating ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="text-xs">{isGenerating ? '生成中' : '发送指令'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
