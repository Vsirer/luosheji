import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  ShieldCheck, 
  Database, 
  Cpu, 
  HardDrive, 
  Terminal, 
  Clock, 
  Play, 
  Pause, 
  Trash2, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  RefreshCw, 
  Layers, 
  Radio, 
  Sparkles,
  Workflow,
  ArrowRight,
  Code,
  Sliders,
  Check,
  ChevronDown,
  Info,
  SlidersHorizontal,
  Bookmark,
  GitPullRequest,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { EventBus, SysEvent, Intent, Goal, Task, Actor, Capability, LifecycleState, BusinessState } from '../../lib/os/EventBus';
import { IntentRuntime, SystemContext } from '../../lib/os/IntentRuntime';

export const OSEngineTab: React.FC = () => {
  const [logs, setLogs] = useState<SysEvent[]>([]);
  const [activeModelTab, setActiveModelTab] = useState<'simulator' | 'context' | 'actors' | 'memory'>('simulator');
  const [isPaused, setIsPaused] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<SysEvent | null>(null);
  
  // Runtime States
  const [currentStates, setCurrentStates] = useState(IntentRuntime.getStates());
  const [context, setContext] = useState<SystemContext>(IntentRuntime.getContext());
  const [customPrompt, setCustomPrompt] = useState('请帮我策划一个科技感十足的 15秒 智能汽车宣传视频 分镜、脚本并生图');
  const [isSimulating, setIsSimulating] = useState(false);

  const [systemMetrics, setSystemMetrics] = useState({
    cpu: 12,
    memory: '1.24 GB / 8.0 GB',
    throughput: 0,
    status: 'HEALTHY'
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Sync state and listen to EventBus
  useEffect(() => {
    setLogs([...EventBus.getLogs()]);
    setContext(IntentRuntime.getContext());
    setCurrentStates(IntentRuntime.getStates());

    const unsubscribe = EventBus.subscribe('*', (evt) => {
      if (!isPaused) {
        setLogs(prev => [evt, ...prev]);
        setCurrentStates(IntentRuntime.getStates());
        
        // Auto update throughput metric
        setSystemMetrics(prev => ({
          ...prev,
          cpu: Math.min(95, Math.max(8, Math.round(Math.random() * 30 + 15))),
          throughput: prev.throughput + 1,
          status: IntentRuntime.getStates().lifecycle === 'RUNNING' ? 'PROCESSING' : 'HEALTHY'
        }));
      }
    });

    const interval = setInterval(() => {
      setSystemMetrics(prev => ({
        ...prev,
        cpu: IntentRuntime.getStates().lifecycle === 'RUNNING' 
          ? Math.min(90, Math.max(50, prev.cpu + Math.round(Math.random() * 12 - 6)))
          : Math.max(5, Math.min(20, prev.cpu + Math.round(Math.random() * 6 - 3))),
        throughput: Math.max(0, prev.throughput - (prev.throughput > 0 ? 1 : 0))
      }));
    }, 2500);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isPaused]);

  const handleClearLogs = () => {
    EventBus.clearLogs();
    setLogs([]);
  };

  const handleContextChange = <K extends keyof SystemContext>(key: K, value: SystemContext[K]) => {
    IntentRuntime.updateContext({ [key]: value });
    setContext(IntentRuntime.getContext());
  };

  const runSimulation = async (prompt: string) => {
    if (isSimulating) return;
    setIsSimulating(true);
    try {
      await IntentRuntime.simulateWorkflowExecution(prompt);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchFilter) return true;
    const filterLower = searchFilter.toLowerCase();
    return (
      log.message.toLowerCase().includes(filterLower) ||
      log.type.toLowerCase().includes(filterLower) ||
      log.source.toLowerCase().includes(filterLower)
    );
  });

  // Preset suggestions
  const presets = [
    { label: '智能汽车15秒分镜', text: '策划一个高科技智能汽车15秒短视频分镜，并自动匹配对应配音脚本。' },
    { label: '搞笑微短剧改写60秒', text: '根据企业爆笑日常生活，改写一个60秒反转段子的搞笑微短剧剧本。' },
    { label: '赛博朋克城市宣传CG', text: '创作一部30秒赛博朋克虚拟城市科幻宣传视频大纲，配置Flux极简生图分镜。' }
  ];

  // Lifecycle States Mapping for Double-Layer State Machine UI
  const lifecycleStatesList: { id: LifecycleState; label: string; desc: string }[] = [
    { id: 'CREATED', label: '已创建', desc: '意图捕获' },
    { id: 'PLANNING', label: '规划中', desc: 'DAG 任务编排' },
    { id: 'RUNNING', label: '执行中', desc: '模型/工具调用' },
    { id: 'PAUSED', label: '挂起中', desc: '等待审核/输入' },
    { id: 'COMPLETED', label: '已圆满', desc: '资产交付完毕' }
  ];

  // Business States Mapping for Double-Layer State Machine UI
  const businessStatesList: { id: BusinessState; label: string; desc: string; color: string }[] = [
    { id: 'NONE', label: '无挂起 (NONE)', desc: '内核处于自由运转状态', color: 'border-slate-800 text-slate-500' },
    { id: 'WAITING_MODEL', label: '等待模型 (LLM)', desc: '正在等待 Gemini 深度逻辑输出', color: 'border-amber-500/30 text-amber-400 bg-amber-500/5' },
    { id: 'WAITING_TOOL', label: '等待工具 (TOOL)', desc: '正在调用生图、渲染或沙盒等引擎', color: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5' },
    { id: 'WAITING_REVIEW', label: '等待校对 (REVIEW)', desc: '正等待人类创作者进行二次校对', color: 'border-rose-500/30 text-rose-400 bg-rose-500/5' },
    { id: 'WAITING_USER', label: '等待输入 (USER)', desc: '等待创作者追加额外物料、文字', color: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5' }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* 顶部 OS 内核监控板 */}
      <div className="flex-none bg-slate-900/90 border-b border-slate-800 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Radio className="w-4.5 h-4.5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-black tracking-wide uppercase text-indigo-300">XiaoLuo Agentic OS</span>
                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 rounded font-black">意图运行时内核 v2.0</span>
              </div>
              <h2 className="text-[10px] text-slate-400 font-bold">图2架构落地：解耦事件总线、多维层级上下文感知与双层状态机自愈体系</h2>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${systemMetrics.status === 'PROCESSING' ? 'bg-indigo-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${systemMetrics.status === 'PROCESSING' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className={`text-[10px] font-black uppercase tracking-wider ${systemMetrics.status === 'PROCESSING' ? 'text-indigo-400' : 'text-emerald-400'}`}>
              {systemMetrics.status}
            </span>
          </div>
        </div>

        {/* 系统内核关键监控指标 */}
        <div className="grid grid-cols-4 gap-2 text-[10px] bg-slate-950/40 p-2.5 rounded-2xl border border-slate-800/50">
          <div className="flex flex-col gap-0.5 border-r border-slate-900 pr-2">
            <span className="text-slate-500 font-bold flex items-center gap-1">
              <Cpu className="w-3 h-3 text-slate-400" /> CPU 物理算力
            </span>
            <span className="font-mono text-slate-200 font-black">{systemMetrics.cpu}%</span>
          </div>
          <div className="flex flex-col gap-0.5 border-r border-slate-900 pr-2">
            <span className="text-slate-500 font-bold flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-slate-400" /> 层级会话工作内存
            </span>
            <span className="font-mono text-slate-200 font-black">{systemMetrics.memory}</span>
          </div>
          <div className="flex flex-col gap-0.5 border-r border-slate-900 pr-2">
            <span className="text-slate-500 font-bold flex items-center gap-1">
              <Activity className="w-3 h-3 text-indigo-400 animate-pulse" /> 事件总线吞吐率
            </span>
            <span className="font-mono text-indigo-400 font-black">{systemMetrics.throughput} ev/sec</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-slate-500 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> 安全合规沙盒
            </span>
            <span className="font-mono text-emerald-400 font-black">
              {context.sandboxEnabled ? 'ENFORCED (已激活)' : 'DISABLED'}
            </span>
          </div>
        </div>
      </div>

      {/* 中部：双层状态机核心可视化（Figure 2: Double-Layer State Machine） */}
      <div className="flex-none bg-slate-950 px-4 py-3 border-b border-slate-800/70">
        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
          <GitPullRequest className="w-3.5 h-3.5 text-indigo-400" />
          双层生命周期与业务状态机 (Double-Layer State Machine)
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* 上层：生命周期状态机 Lifecycle State */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                1. 外部生命周期状态 (Lifecycle State)
              </span>
              <span className="text-[9px] font-mono font-black text-indigo-400 uppercase bg-indigo-500/10 px-1.5 rounded">
                Current: {currentStates.lifecycle}
              </span>
            </div>
            
            <div className="flex items-center justify-between relative mt-1 select-none">
              <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-800 -translate-y-1/2 z-0" />
              {lifecycleStatesList.map((state, sIdx) => {
                const isActive = currentStates.lifecycle === state.id;
                const isPassed = lifecycleStatesList.findIndex(x => x.id === currentStates.lifecycle) >= sIdx;
                
                return (
                  <div key={state.id} className="flex flex-col items-center z-10">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-[9px] font-black transition-all ${
                      isActive 
                        ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.5)] animate-pulse scale-110'
                        : isPassed
                          ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/60'
                          : 'bg-slate-900 text-slate-600 border-slate-800'
                    }`}>
                      {sIdx + 1}
                    </div>
                    <span className={`text-[9px] mt-1 font-bold ${isActive ? 'text-indigo-300' : 'text-slate-500'}`}>
                      {state.label}
                    </span>
                    <span className="text-[7px] text-slate-600 font-semibold">{state.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 下层：业务挂起状态 Business State */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                2. 业务运行时挂起状态 (Business State)
              </span>
              <span className="text-[9px] font-mono font-black text-amber-400 uppercase bg-amber-500/10 px-1.5 rounded">
                Current: {currentStates.business}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1 mt-1">
              {businessStatesList.map(item => {
                const isActive = currentStates.business === item.id;
                return (
                  <div 
                    key={item.id}
                    className={`border rounded-xl p-1.5 flex flex-col items-center justify-center text-center transition-all ${
                      isActive 
                        ? 'border-amber-400/80 text-amber-300 bg-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.3)]' 
                        : 'border-slate-900 text-slate-600 bg-slate-950/20'
                    }`}
                  >
                    <span className="text-[8px] font-black tracking-tighter truncate w-full">{item.label.split(' (')[0]}</span>
                    <span className="text-[6px] text-slate-500 leading-none mt-1 scale-90">{item.desc.substring(0, 6)}...</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 主体大区域：左右分栏 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* 左侧：9大核心对象及运行时配置面板 */}
        <div className="w-[60%] border-r border-slate-800/70 flex flex-col bg-slate-950">
          <div className="flex-none flex items-center justify-between border-b border-slate-800/70 bg-slate-900/40 px-3 py-2">
            <span className="text-[10px] font-black tracking-wide text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              统一内核控制中心 (OS Runtime Control)
            </span>
            <div className="flex space-x-1">
              {(['simulator', 'context', 'actors', 'memory'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveModelTab(tab)}
                  className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold transition-all border ${
                    activeModelTab === tab 
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-black' 
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab === 'simulator' && '意图流程/自愈模拟'}
                  {tab === 'context' && '上下文环境约束'}
                  {tab === 'actors' && '执行体/能力总线'}
                  {tab === 'memory' && '多级记忆中心'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {activeModelTab === 'simulator' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4"
                >
                  {/* 意图测试控制台 */}
                  <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-slate-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        内核意图发生器 (Prompt Pipeline Simulator)
                      </span>
                      <span className="text-[8px] text-slate-500">
                        1. Intent Gateway
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="在此输入需要执行的自然语言指令，模拟意图网关分拆与执行..."
                        rows={2}
                        className="flex-1 bg-slate-950 border border-slate-800 text-[10px] rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500 placeholder-slate-600 font-bold leading-normal text-slate-200 resize-none"
                      />
                      <button
                        onClick={() => runSimulation(customPrompt)}
                        disabled={isSimulating}
                        className={`px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black flex flex-col items-center justify-center gap-1 transition-all ${
                          isSimulating ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>一键执行</span>
                      </button>
                    </div>

                    {/* Preset buttons */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {presets.map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCustomPrompt(preset.text)}
                          className="px-2 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[8px] text-slate-400 hover:text-slate-200 rounded-lg font-bold transition-all"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* DAG 状态实时跟踪与自愈引擎监控 */}
                  <div className="bg-slate-900/20 border border-slate-800/40 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                      <span className="text-[10px] font-black text-slate-400 flex items-center gap-1.5">
                        <Workflow className="w-3.5 h-3.5 text-indigo-400" />
                        2. 目标与 3. 任务 (动态 DAG / 异常恢复执行器)
                      </span>
                      {isSimulating && (
                        <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded animate-pulse font-black">
                          正在模拟连接/异常自愈...
                        </span>
                      )}
                    </div>

                    {EventBus.currentGoals.length > 0 ? (
                      <div className="space-y-3">
                        {EventBus.currentGoals.map((goal) => (
                          <div key={goal.id} className="bg-slate-900/50 rounded-xl p-3 border border-slate-800/40">
                            <div className="flex items-center justify-between border-b border-slate-800/40 pb-1.5 mb-1.5">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 rounded font-black">GOAL</span>
                                <span className="text-[10px] font-black text-slate-200">{goal.name}</span>
                              </div>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${
                                goal.lifecycle === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse'
                              }`}>
                                {goal.lifecycle}
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-400 italic mb-2.5 leading-relaxed">{goal.rationale}</p>
                            
                            {/* DAG step lists */}
                            <div className="space-y-1.5">
                              {EventBus.currentTasks.map((task) => (
                                <div key={task.id} className="flex items-start gap-2 bg-slate-950 p-2 rounded-xl border border-slate-900">
                                  <div className="mt-0.5 shrink-0">
                                    {task.lifecycle === 'COMPLETED' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                                    {task.lifecycle === 'RUNNING' && <Activity className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
                                    {task.lifecycle === 'FAILED' && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                                    {task.lifecycle === 'PLANNING' && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-slate-200">{task.name}</span>
                                      <span className="text-[7px] bg-slate-800 text-slate-400 px-1 rounded">{task.type}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 truncate mt-0.5">{task.prompt}</p>
                                    
                                    {task.assignedActorId && (
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-[8px] text-indigo-300 font-bold bg-indigo-500/10 border border-indigo-500/20 px-1 rounded">
                                          执行体: {task.assignedActorId}
                                        </span>
                                        {task.output && (
                                          <span className="text-[8px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-1 rounded">
                                            数据载荷已注入 (Output Bound)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-500 italic text-[10px] p-6 text-center bg-slate-900/10 border border-slate-900/40 rounded-xl">
                        当前暂无活跃执行意图。在上方输入意图点击“一键执行”或直接在团队聊天中发送指令，即可实时在此处渲染 DAG 执行状态机。
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeModelTab === 'context' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4 text-[10px]"
                >
                  <div className="text-[10px] font-black text-slate-400 mb-1 flex items-center justify-between">
                    <span>7. Context Engine (上下文引擎 - 多维层级约束器)</span>
                    <span className="text-[8px] text-indigo-400 font-black">修改配置将发布 CONTEXT_UPDATED 事件</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Model Provider Config */}
                    <div className="bg-slate-900/40 border border-slate-800/60 p-3 rounded-2xl space-y-2">
                      <span className="font-bold text-indigo-400">模型总线核心提供商</span>
                      <p className="text-[8px] text-slate-500 leading-snug">绑定云端底层 Model Bus 提供商路由约束。</p>
                      <select
                        value={context.modelProvider}
                        onChange={(e: any) => handleContextChange('modelProvider', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-[9px] rounded-lg p-1.5 text-slate-300 font-bold focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Gemini 2.5 Flash">Gemini 2.5 Flash (轻量高效)</option>
                        <option value="Gemini 2.5 Pro">Gemini 2.5 Pro (深度逻辑推理)</option>
                        <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet (文字大师)</option>
                      </select>
                    </div>

                    {/* Brand Name Constraint */}
                    <div className="bg-slate-900/40 border border-slate-800/60 p-3 rounded-2xl space-y-2">
                      <span className="font-bold text-cyan-400">企业品牌规范约束 (Brand Constraint)</span>
                      <p className="text-[8px] text-slate-500 leading-snug">自动注入提示词规范中，确保生成的资产风格合规。</p>
                      <input
                        type="text"
                        value={context.brandName}
                        onChange={(e) => handleContextChange('brandName', e.target.value)}
                        placeholder="输入品牌约束名称..."
                        className="w-full bg-slate-950 border border-slate-800 text-[9px] rounded-lg p-1.5 text-slate-300 font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Aspect Ratio Config */}
                    <div className="bg-slate-900/40 border border-slate-800/60 p-3 rounded-2xl space-y-2">
                      <span className="font-bold text-emerald-400">画布/视频尺寸标准</span>
                      <p className="text-[8px] text-slate-500 leading-snug">渲染图像、视频大纲及剪辑分镜时的几何约束。</p>
                      <div className="grid grid-cols-3 gap-1">
                        {(['16:9', '9:16', '1:1'] as const).map(ratio => (
                          <button
                            key={ratio}
                            onClick={() => handleContextChange('videoRatio', ratio)}
                            className={`py-1 text-[9px] font-bold rounded-md border ${
                              context.videoRatio === ratio 
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' 
                                : 'bg-slate-950 border-slate-800 text-slate-500'
                            }`}
                          >
                            {ratio === '16:9' ? '16:9 横屏' : ratio === '9:16' ? '9:16 竖屏' : '1:1 方幅'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Safety Filter Sensitivity */}
                    <div className="bg-slate-900/40 border border-slate-800/60 p-3 rounded-2xl space-y-2">
                      <span className="font-bold text-amber-400">内容合规性过滤器灵敏度</span>
                      <p className="text-[8px] text-slate-500 leading-snug">控制多模态模型审核、沙盒隔离的警惕性阈值。</p>
                      <div className="grid grid-cols-3 gap-1">
                        {(['Low', 'Medium', 'High'] as const).map(level => (
                          <button
                            key={level}
                            onClick={() => handleContextChange('safetyFilterLevel', level)}
                            className={`py-1 text-[9px] font-bold rounded-md border ${
                              context.safetyFilterLevel === level 
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' 
                                : 'bg-slate-950 border-slate-800 text-slate-500'
                            }`}
                          >
                            {level === 'Low' ? '低过滤' : level === 'Medium' ? '中等合规' : '高安全性'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Auto Retry Limit */}
                    <div className="bg-slate-900/40 border border-slate-800/60 p-3 rounded-2xl space-y-2 col-span-2 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-purple-400">异常自愈自动重试上限 (Max Retries)</span>
                        <p className="text-[8px] text-slate-500 leading-snug">由自愈引擎监测，发生 Timeout、API 错误时自动重试候选节点的最大次数。</p>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0 bg-slate-950 p-1 border border-slate-800 rounded-lg">
                        {[1, 2, 3, 4, 5].map(val => (
                          <button
                            key={val}
                            onClick={() => handleContextChange('maxRetries', val)}
                            className={`w-6 h-6 rounded text-[9px] font-black ${
                              context.maxRetries === val ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sandbox Mode Toggle */}
                    <div className="bg-slate-900/40 border border-slate-800/60 p-3 rounded-2xl col-span-2 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-rose-400">沙盒化执行保护 (Execution Sandbox)</span>
                        <p className="text-[8px] text-slate-500 leading-snug">强制所有代码、工具调用在安全沙箱容器中虚拟运行，防止数据穿透泄漏。</p>
                      </div>
                      <button
                        onClick={() => handleContextChange('sandboxEnabled', !context.sandboxEnabled)}
                        className={`px-3 py-1 text-[9px] font-bold rounded-md border transition-all ${
                          context.sandboxEnabled 
                            ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-[0_0_8px_rgba(239,68,68,0.2)]' 
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}
                      >
                        {context.sandboxEnabled ? '沙盒机制已强制锁定' : '自由调试模式 (无安全沙盒)'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeModelTab === 'actors' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-4"
                >
                  {/* Actor列表 */}
                  <div>
                    <div className="text-[10px] font-black text-slate-400 mb-2">4. Actor Runtime (执行体多角色运行时)</div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {EventBus.currentActors.map(actor => (
                        <div key={actor.id} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-2.5 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-black text-slate-200">{actor.name}</span>
                              <span className={`text-[8px] px-1 rounded font-bold ${
                                actor.status === 'busy' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {actor.status === 'busy' ? 'BUSY (繁忙)' : 'IDLE (空闲)'}
                              </span>
                            </div>
                            <div className="text-[8px] text-slate-500 leading-normal">{actor.role}</div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2 border-t border-slate-800/40 pt-1.5">
                            {actor.capabilities.map(capId => (
                              <span key={capId} className="text-[7px] bg-slate-950 text-slate-400 px-1 border border-slate-800 rounded">
                                {capId.replace('cap_', '')}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Capability Bus */}
                  <div>
                    <div className="text-[10px] font-black text-slate-400 mb-2">5. Capability Bus (统一能力底层总线)</div>
                    <div className="space-y-1.5">
                      {EventBus.currentCapabilities.map(cap => (
                        <div key={cap.id} className="bg-slate-900/20 border border-slate-800/40 rounded-xl p-2 flex items-center justify-between text-[10px]">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-200">{cap.name}</span>
                              <span className="text-[8px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1 rounded">{cap.type}</span>
                            </div>
                            <p className="text-[8px] text-slate-500 mt-0.5">{cap.description}</p>
                          </div>
                          <span className="text-[8px] font-mono font-black text-slate-400">{cap.provider}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeModelTab === 'memory' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="space-y-3.5 text-[10px]"
                >
                  <div className="text-[10px] font-black text-slate-400">8. Memory Core (分级记忆核心)</div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-900/40 border border-slate-800/60 p-2.5 rounded-2xl">
                      <div className="font-bold text-slate-200 border-b border-slate-800/40 pb-1 mb-1.5">
                        Session Memory (会话瞬时记忆)
                      </div>
                      <div className="space-y-1 font-mono text-[9px] text-slate-400 leading-relaxed">
                        <div>• active_tab: "groupChat"</div>
                        <div>• logged_events_count: {logs.length}</div>
                        <div>• current_prompt_tokens: ~1,240</div>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800/60 p-2.5 rounded-2xl">
                      <div className="font-bold text-slate-200 border-b border-slate-800/40 pb-1 mb-1.5">
                        Working Memory (执行缓存)
                      </div>
                      <div className="space-y-1 font-mono text-[9px] text-slate-400 leading-relaxed">
                        <div>• active_brand_profile: "{context.brandName}"</div>
                        <div>• active_resolution: "{context.resolution}"</div>
                        <div>• active_ratio: "{context.videoRatio}"</div>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800/60 p-3 rounded-2xl col-span-2">
                      <div className="font-bold text-indigo-400 border-b border-slate-800/40 pb-1 mb-1.5 flex items-center justify-between">
                        <span>Long-term & Knowledge Base (长期记忆库 / 规则大纲)</span>
                        <span className="text-[8px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1 rounded">Vector DB</span>
                      </div>
                      <div className="font-mono text-[9px] text-slate-400 leading-relaxed space-y-1">
                        <div>• 已动态索引企业资产：<span className="text-slate-300 font-bold">"奇迹影业镜头运动分镜标准.doc"</span></div>
                        <div>• 已在生图、视频剪辑模型管线运行前自动读取该向量配置进行对其匹配。</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 右侧：9. 统一实时事件流总线终端 */}
        <div className="w-[40%] flex flex-col bg-slate-950 font-mono">
          <div className="flex-none bg-slate-900/60 border-b border-slate-800 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span className="text-[10px] font-black tracking-wide text-slate-300 uppercase">
                9. Unified Event Bus (实时事件流)
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="搜索日志..."
                className="bg-slate-900 border border-slate-800 text-[9px] rounded-lg px-2 py-0.5 w-24 focus:outline-none focus:border-indigo-500 placeholder-slate-600 font-bold text-slate-200"
              />
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`p-1 rounded-md transition-colors ${
                  isPaused ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                title={isPaused ? '恢复流监听' : '暂停流监听'}
              >
                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              </button>
              <button
                onClick={handleClearLogs}
                className="p-1 bg-slate-800 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 rounded-md transition-colors"
                title="清除所有事件"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 text-[9px] space-y-1.5 select-text">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => {
                let badgeColor = 'bg-slate-800 text-slate-400';
                if (log.type === 'INTENT_RECEIVED') badgeColor = 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
                else if (log.type === 'GOAL_PLANNED') badgeColor = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
                else if (log.type === 'TASK_STATUS_CHANGED') badgeColor = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                else if (log.type === 'CAPABILITY_CALLED') badgeColor = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
                else if (log.type === 'EVENT_TRIGGERED') badgeColor = 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
                else if (log.type === 'CONTEXT_UPDATED') badgeColor = 'bg-purple-500/20 text-purple-300 border border-purple-500/30';

                return (
                  <div 
                    key={log.id} 
                    onClick={() => setSelectedEvent(log)}
                    className="p-1.5 rounded-xl bg-slate-900/30 hover:bg-slate-900/70 border border-slate-900/10 hover:border-slate-800/60 cursor-pointer transition-all flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 shrink-0 font-normal">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`text-[8px] px-1 rounded shrink-0 font-black scale-90 origin-left ${badgeColor}`}>
                        {log.type}
                      </span>
                      <span className="text-indigo-400 font-bold shrink-0">
                        [{log.source}]
                      </span>
                    </div>
                    <span className="text-slate-200 font-semibold leading-relaxed">
                      {log.message}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-slate-600 italic text-[9px] p-4 text-center">
                {searchFilter ? '未搜索到匹配的系统事件。' : '正在实时监听系统内核事件总线中...'}
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

      </div>

      {/* 详细事件 Json 浮窗 modal */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-5 flex flex-col max-h-[80vh] text-[11px]"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center space-x-2">
                  <Info className="w-4 h-4 text-indigo-400" />
                  <span className="font-black text-slate-200">统一事件序列化数据负载 (Event Payload)</span>
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <span className="text-xs font-black">✕</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 font-mono">
                <div>
                  <span className="text-slate-500 font-bold">Event ID:</span> <span className="text-indigo-300 font-black">{selectedEvent.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">Event Type:</span> <span className="text-indigo-400 font-black">{selectedEvent.type}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">Timestamp:</span> <span className="text-slate-400">{new Date(selectedEvent.timestamp).toISOString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">Source Component:</span> <span className="text-slate-300 font-bold">{selectedEvent.source}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">Log Message:</span> <p className="text-slate-200 mt-0.5 bg-slate-950 p-2 rounded-xl border border-slate-800/60 leading-relaxed font-semibold">{selectedEvent.message}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">Payload:</span>
                  <pre className="text-[10px] text-emerald-400 bg-slate-950 p-2.5 rounded-2xl border border-slate-800/60 overflow-x-auto mt-1 leading-relaxed max-h-48 overflow-y-auto">
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
