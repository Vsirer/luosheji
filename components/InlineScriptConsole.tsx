import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Send, 
  X, 
  Loader2, 
  Zap, 
  BookOpen, 
  Layers, 
  ChevronDown, 
  Check, 
  GitFork,
  PenTool,
  Film,
  Box,
  Cpu
} from "lucide-react";
import {
  SCRIPT_GENRES,
  RECOMMENDED_AUTHORS,
  SCRIPT_LENGTHS,
} from "../constants";

interface InlineScriptConsoleProps {
  item: {
    id: string;
    type?: string;
    parentId?: string;
    position?: { x: number; y: number };
  };
  scriptConfig: {
    prompt: string;
    creationType: "new" | "continue";
    genre: { id: string; name: string };
    author: { name: string; description: string };
    customAuthor: string;
    length: { id: string; label: string };
    duration: { id: string; label: string };
    activeSubTab: "create" | "analyze" | "rewrite" | "video" | "director";
  };
  setScriptConfig: React.Dispatch<React.SetStateAction<any>>;
  directorConfig?: any;
  setDirectorConfig?: React.Dispatch<React.SetStateAction<any>>;
  isGenerating: boolean;
  onGenerateScript: () => Promise<any>;
  userPoints: number;
  onClose?: () => void;
  localTextModel: string;
  setLocalTextModel: (val: string) => void;
  customModels: any[];
  workflowSkills: any[];
  removedSystemSkillIds: string[];
}

export const InlineScriptConsole: React.FC<InlineScriptConsoleProps> = ({
  item,
  scriptConfig,
  setScriptConfig,
  directorConfig,
  setDirectorConfig,
  isGenerating,
  onGenerateScript,
  userPoints,
  onClose,
  localTextModel,
  setLocalTextModel,
  customModels,
  workflowSkills,
  removedSystemSkillIds,
}) => {
  const [promptText, setPromptText] = useState("");
  const [showCreationTypeMenu, setShowCreationTypeMenu] = useState(false);
  const [showGenreStyleMenu, setShowGenreStyleMenu] = useState(false);
  const [showLengthMenu, setShowLengthMenu] = useState(false);
  const [showSkillMenu, setShowSkillMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [hoverGenreId, setHoverGenreId] = useState(scriptConfig.genre.id);

  // Sync prompt text
  useEffect(() => {
    setPromptText(scriptConfig.prompt || "");
  }, [scriptConfig.prompt]);

  const handlePromptChange = (val: string) => {
    setPromptText(val);
    setScriptConfig((prev: any) => ({ ...prev, prompt: val }));
  };

  const handleGenerateSubmit = async () => {
    if (isGenerating) return;
    await onGenerateScript();
  };

  const getPointsText = () => {
    return "2000字/2分";
  };

  const activeId = scriptConfig.activeSubTab === "director" ? directorConfig?.generationMode : scriptConfig.activeSubTab;
  const customWs = workflowSkills?.find((s: any) => s.id === activeId);
  const isCreate = activeId === "create" || activeId === "createScript" || activeId === "create-script";
  const hasExtraParams = isCreate || (customWs && customWs.customOptions && customWs.customOptions.length > 0);

  return (
    <div 
      className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800/90 rounded-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.12)] p-6 w-[640px] flex flex-col gap-4 text-zinc-800 dark:text-zinc-100 font-sans cursor-default select-none transition-all duration-300"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header Row: Agent Badge & Close button */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 font-bold text-[10px] px-2.5 py-1 rounded-full shadow-sm">
          <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
          <span>小逻: 灵境创生</span>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Prompt Area */}
      <div className="flex flex-col gap-1.5 w-full">
        <span className="text-zinc-400 dark:text-zinc-500 font-bold text-[11px] uppercase tracking-wider">
          剧本大纲与主题
        </span>

        <div className="relative w-full">
          <textarea
            value={promptText}
            onChange={(e) => handlePromptChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleGenerateSubmit();
              }
            }}
            placeholder={
              scriptConfig.creationType === "continue"
                ? "请粘贴您已有的剧本内容，并写下续写剧本的要求或剧情反转..."
                : "请输入剧本主题或故事大纲..."
            }
            className="w-full min-h-[96px] max-h-[160px] border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl p-4 text-[14px] leading-relaxed text-zinc-800 dark:text-zinc-100 placeholder-zinc-350 dark:placeholder-zinc-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 bg-zinc-50/50 dark:bg-zinc-950/20 resize-none transition-all"
          />
          {promptText.length > 0 && (
            <div className="absolute bottom-2 right-3 text-[10px] text-zinc-400 font-mono">
              {promptText.length} 字符
            </div>
          )}
        </div>
      </div>

      {/* Bottom Settings & Generation trigger button */}
      <div className="flex flex-wrap items-center justify-between border-t border-zinc-100 dark:border-zinc-800/80 pt-4 mt-1 w-full gap-2">
        {/* Settings Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Skill Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSkillMenu(!showSkillMenu);
                setShowCreationTypeMenu(false);
                setShowGenreStyleMenu(false);
                setShowLengthMenu(false);
              }}
              className="px-2.5 py-1.5 text-[11px] font-bold flex items-center space-x-1 rounded-xl transition-all text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100/80 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 dark:border-blue-900/30 whitespace-nowrap shrink-0"
            >
              {(() => {
                 const activeId = scriptConfig.activeSubTab === "director" ? directorConfig?.generationMode : scriptConfig.activeSubTab;
                 if (activeId === "create") return <PenTool className="w-3 h-3" />;
                 if (activeId === "analyze") return <BookOpen className="w-3 h-3" />;
                 if (activeId === "video") return <Layers className="w-3 h-3" />;
                 if (activeId === "shot_prompt") return <Film className="w-3 h-3" />;
                 if (activeId === "asset_prompt") return <Box className="w-3 h-3" />;
                 if (activeId === "prompt") return <Sparkles className="w-3 h-3" />;
                 if (activeId === "rewrite") return <GitFork className="w-3 h-3" />;
                 const customWs = workflowSkills?.find(s => s.id === activeId);
                 if (customWs) {
                    if (customWs.id === "createScript" || customWs.id === "create-script") return <PenTool className="w-3 h-3" />;
                    if (customWs.id === "analyzeScript" || customWs.id === "analyze-script") return <BookOpen className="w-3 h-3" />;
                    if (customWs.id === "rewriteScript" || customWs.id === "rewrite-script") return <GitFork className="w-3 h-3" />;
                    if (customWs.id === "videoDissect" || customWs.id === "video-dissect") return <Layers className="w-3 h-3" />;
                    if (customWs.id === "shotPromptSkill" || customWs.id === "shot-prompt-skill") return <Film className="w-3 h-3" />;
                    if (customWs.id === "assetPromptSkill" || customWs.id === "asset-prompt-skill") return <Box className="w-3 h-3" />;
                 }
                 return <Sparkles className="w-3 h-3" />;
              })()}
              <span>
                技能 {(() => {
                  const targetIdMap: Record<string, { baseId: string, altId: string, altId2?: string, defaultName: string }> = {
                    "create": { baseId: "createScript", altId: "create-script", defaultName: "创作剧本" },
                    "analyze": { baseId: "analyzeScript", altId: "analyze-script", defaultName: "分析剧本" },
                    "rewrite": { baseId: "rewriteScript", altId: "rewrite-script", defaultName: "改写剧本" },
                    "video": { baseId: "videoDissect", altId: "video-dissect", defaultName: "影音拉片" },
                    "shot_prompt": { baseId: "shotPromptSkill", altId: "shot-prompt-skill", altId2: "shot_prompt", defaultName: "分镜提示词" },
                    "asset_prompt": { baseId: "assetPromptSkill", altId: "asset-prompt-skill", altId2: "asset_prompt", defaultName: "资产提示词" },
                    "prompt": { baseId: "promptSkill", altId: "prompt-skill", altId2: "prompt", defaultName: "提示词" }
                  };
                  const activeId = scriptConfig.activeSubTab === "director" ? directorConfig?.generationMode : scriptConfig.activeSubTab;
                  const def = targetIdMap[activeId as string];
                  if (def) {
                    const ws = workflowSkills?.find(s => s.id === def.baseId || s.id === def.altId || s.id === def.altId2);
                    return ws ? ws.name : def.defaultName;
                  }
                  const customWs = workflowSkills?.find(s => s.id === activeId);
                  return customWs ? customWs.name : "未知技能";
                })()}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            <AnimatePresence>
              {showSkillMenu && (
                <div className="absolute bottom-full left-0 mb-2 z-[150]">
                  <div
                    className="fixed inset-0"
                    onClick={() => setShowSkillMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="relative w-[140px] bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-850 p-2 flex flex-col gap-1 overflow-hidden"
                  >
                    {(() => {
                      const textSkills = workflowSkills?.filter((s: any) => {
                        const isRemoved = removedSystemSkillIds?.includes(s.id) ||
                                          (s.id === "create-script" && removedSystemSkillIds?.includes("createScript")) ||
                                          (s.id === "analyze-script" && removedSystemSkillIds?.includes("analyzeScript")) ||
                                          (s.id === "rewrite-script" && removedSystemSkillIds?.includes("rewriteScript")) ||
                                          (s.id === "video-dissect" && removedSystemSkillIds?.includes("videoDissect"));
                        if (isRemoved) return false;
                        return (s.category === "text" || s.category === "all" || s.category === "video") && s.id !== "general" && s.id !== "promptSkill" && s.id !== "prompt-skill";
                      }).map((s: any) => {
                         let icon = Sparkles;
                         let isDirector = false;
                         let targetMode = s.id;
                         if (s.id === "createScript" || s.id === "create-script") { icon = PenTool; targetMode = "create"; }
                         else if (s.id === "analyzeScript" || s.id === "analyze-script") { icon = BookOpen; targetMode = "analyze"; }
                         else if (s.id === "rewriteScript" || s.id === "rewrite-script") { icon = GitFork; targetMode = "rewrite"; }
                         else if (s.id === "videoDissect" || s.id === "video-dissect") { icon = Layers; targetMode = "video"; }
                         else if (s.id === "shotPromptSkill" || s.id === "shot-prompt-skill") { icon = Film; isDirector = true; targetMode = "shot_prompt"; }
                         else if (s.id === "assetPromptSkill" || s.id === "asset-prompt-skill") { icon = Box; isDirector = true; targetMode = "asset_prompt"; }
                         return {
                           id: targetMode,
                           originalId: s.id,
                           name: s.name,
                           icon,
                           isDirector
                         };
                      }) || [];
                      
                      const promptSkill = workflowSkills?.find(s => s.id === "promptSkill" || s.id === "prompt-skill");
                      if (promptSkill && !removedSystemSkillIds?.includes("promptSkill") && !removedSystemSkillIds?.includes("prompt-skill")) {
                         textSkills.push({
                           id: "prompt",
                           originalId: promptSkill.id,
                           name: promptSkill.name,
                           icon: Sparkles,
                           isDirector: true
                         });
                      }
                      
                      return textSkills;
                    })().map((opt: any) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          if (opt.isDirector) {
                            setScriptConfig((prev: any) => ({
                              ...prev,
                              activeSubTab: "director",
                            }));
                            if (setDirectorConfig) {
                              setDirectorConfig((prev: any) => ({
                                ...prev,
                                generationMode: opt.id
                              }));
                            }
                          } else {
                            setScriptConfig((prev: any) => ({
                              ...prev,
                              activeSubTab: opt.id as any,
                            }));
                          }
                          setShowSkillMenu(false);
                        }}
                        className={`w-full p-2 rounded-lg text-left text-[11px] transition-colors flex items-center space-x-2 ${
                          (opt.isDirector ? (scriptConfig.activeSubTab === "director" && directorConfig?.generationMode === opt.id) : scriptConfig.activeSubTab === opt.id)
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold"
                            : "hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-500 dark:text-zinc-400"
                        }`}
                      >
                        <opt.icon className="w-3.5 h-3.5" />
                        <span className="truncate">{opt.name}</span>
                      </button>
                    ))}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {hasExtraParams && (
            <>
              {/* Creation Type */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowCreationTypeMenu(!showCreationTypeMenu);
                    setShowGenreStyleMenu(false);
                    setShowLengthMenu(false);
                  }}
              className="px-2.5 py-1.5 text-[11px] font-bold flex items-center space-x-1 rounded-xl transition-all text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="shrink-0">
                {scriptConfig.creationType === "continue" ? "剧情续写" : "全新创作"}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            <AnimatePresence>
              {showCreationTypeMenu && (
                <div className="absolute bottom-full left-0 mb-2 z-[150]">
                  <div
                    className="fixed inset-0"
                    onClick={() => setShowCreationTypeMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="relative w-32 bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-850 p-2 flex flex-col gap-1 overflow-hidden"
                  >
                    {[
                      { id: "new", name: "全新创作", desc: "全新故事脚本", icon: Sparkles },
                      { id: "continue", name: "剧情续写", desc: "已有剧本延续", icon: GitFork }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setScriptConfig((prev: any) => ({
                            ...prev,
                            creationType: opt.id as any,
                          }));
                          setShowCreationTypeMenu(false);
                        }}
                        className={`w-full p-2 rounded-lg text-left text-[11px] transition-colors flex flex-col items-start ${
                          scriptConfig.creationType === opt.id
                            ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold"
                            : "hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-500 dark:text-zinc-400"
                        }`}
                      >
                        <div className="flex items-center space-x-1.5">
                          <opt.icon className="w-3.5 h-3.5" />
                          <span className="text-xs">{opt.name}</span>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Style / Genre */}
          <div className="relative">
            <button
              onClick={() => {
                setShowGenreStyleMenu(!showGenreStyleMenu);
                setHoverGenreId(scriptConfig.genre.id);
                setShowCreationTypeMenu(false);
                setShowLengthMenu(false);
              }}
              className="px-2.5 py-1.5 text-[11px] font-bold flex items-center space-x-1 rounded-xl transition-all text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800 whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="text-gray-400 dark:text-zinc-500 shrink-0">风格：</span>
              <span className="truncate max-w-[120px] shrink-0">
                {scriptConfig.genre.name} · {scriptConfig.author.name === "自定义" ? (scriptConfig.customAuthor || "自定义") : scriptConfig.author.name}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            <AnimatePresence>
              {showGenreStyleMenu && (
                <div className="absolute bottom-full left-0 mb-2 z-[150]">
                  <div
                    className="fixed inset-0"
                    onClick={() => setShowGenreStyleMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="relative w-[440px] bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-850 p-1 flex h-[260px] overflow-hidden"
                  >
                    {/* Left Column: Genre List */}
                    <div className="w-[120px] border-r border-gray-100 dark:border-zinc-850 p-1 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 select-none bg-slate-50/50 dark:bg-zinc-900/30">
                      <div className="px-2 py-1 mb-1">
                        <span className="text-[9px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">
                          剧本类型
                        </span>
                      </div>
                      {SCRIPT_GENRES.map((genre) => {
                        const isActive = hoverGenreId === genre.id;
                        return (
                          <button
                            key={genre.id}
                            type="button"
                            onMouseEnter={() => setHoverGenreId(genre.id)}
                            onClick={() => setHoverGenreId(genre.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-[11px] transition-colors ${
                              isActive
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold"
                                : "hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-500 dark:text-zinc-400"
                            }`}
                          >
                            <span>{genre.name}</span>
                            {scriptConfig.genre.id === genre.id && (
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right Column: Style & Authors */}
                    <div className="flex-1 p-2 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-950">
                      <div className="px-2 py-1 mb-1.5 flex items-center justify-between border-b border-gray-50 dark:border-zinc-850 pb-1.5">
                        <span className="text-[9px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest block">
                          选择创作风格
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 pr-1">
                        {(RECOMMENDED_AUTHORS[hoverGenreId] || []).map((author: any) => {
                          const isSelected =
                            scriptConfig.genre.id === hoverGenreId &&
                            scriptConfig.author.name === author.name;
                          return (
                            <button
                              key={author.name}
                              type="button"
                              onClick={() => {
                                const matchedGenre =
                                  SCRIPT_GENRES.find((g) => g.id === hoverGenreId) ||
                                  SCRIPT_GENRES[0];
                                setScriptConfig((prev: any) => ({
                                  ...prev,
                                  genre: matchedGenre,
                                  author,
                                  customAuthor: "",
                                }));
                                setShowGenreStyleMenu(false);
                              }}
                              className={`w-full p-2 rounded-lg text-left text-[11px] transition-all border ${
                                isSelected
                                  ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 font-bold shadow-sm"
                                  : "border-transparent hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-700 dark:text-zinc-300"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-semibold text-[11.5px]">
                                  {author.name}
                                </span>
                              </div>
                              <p className={`text-[9.5px] leading-relaxed line-clamp-1 ${
                                isSelected ? "text-amber-700/80 dark:text-amber-400/80" : "text-slate-400"
                              }`}>
                                {author.description}
                              </p>
                            </button>
                          );
                        })}

                        <div className="border-t border-slate-100 dark:border-zinc-850 my-1 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              const matchedGenre =
                                SCRIPT_GENRES.find((g) => g.id === hoverGenreId) ||
                                SCRIPT_GENRES[0];
                              setScriptConfig((prev: any) => ({
                                ...prev,
                                genre: matchedGenre,
                                author: {
                                  name: "自定义",
                                  description: "指定特定作者风格...",
                                },
                              }));
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-[11px] transition-colors border ${
                              scriptConfig.genre.id === hoverGenreId &&
                              scriptConfig.author.name === "自定义"
                                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-bold border-amber-200/50 dark:border-amber-900/50"
                                : "border-transparent hover:bg-slate-50 dark:hover:bg-zinc-900 text-gray-500 dark:text-zinc-400"
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold text-[11.5px]">
                                自定义作者风格
                              </span>
                            </div>
                          </button>

                          {scriptConfig.genre.id === hoverGenreId &&
                            scriptConfig.author.name === "自定义" && (
                              <div className="mt-1 px-1 py-1">
                                <input
                                  type="text"
                                  placeholder="如：马伯庸 / 三毛..."
                                  value={scriptConfig.customAuthor}
                                  onChange={(e) =>
                                    setScriptConfig((prev: any) => ({
                                      ...prev,
                                      customAuthor: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      setShowGenreStyleMenu(false);
                                    }
                                  }}
                                  className="w-full px-2.5 py-1.5 text-[11px] border border-amber-200/80 rounded-lg bg-amber-50/20 focus:outline-none focus:ring-1 focus:ring-amber-400 font-medium placeholder:text-slate-400 text-amber-900 dark:text-amber-100"
                                />
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Length */}
          <div className="relative">
            <button
              onClick={() => {
                setShowLengthMenu(!showLengthMenu);
                setShowCreationTypeMenu(false);
                setShowGenreStyleMenu(false);
              }}
              className="px-2.5 py-1.5 text-[11px] font-bold flex items-center space-x-1 rounded-xl transition-all text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800 whitespace-nowrap shrink-0"
            >
              <Layers className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="shrink-0">篇幅 {scriptConfig.length.label}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            <AnimatePresence>
              {showLengthMenu && (
                <div className="absolute bottom-full left-0 mb-2 z-[150]">
                  <div
                    className="fixed inset-0"
                    onClick={() => setShowLengthMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="relative w-32 bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-850 p-2 flex flex-col gap-1 overflow-hidden"
                  >
                    {SCRIPT_LENGTHS.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => {
                          setScriptConfig((prev: any) => ({
                            ...prev,
                            length: l,
                          }));
                          setShowLengthMenu(false);
                        }}
                        className={`w-full p-2 rounded-lg text-left text-[11px] transition-colors ${
                          scriptConfig.length.id === l.id
                            ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold"
                            : "hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-500 dark:text-zinc-400"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
            </>
          )}

          {/* Points indicator */}
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-xl whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 shrink-0" />
            <span className="shrink-0">{getPointsText()}</span>
          </div>
        </div>

        {/* Generate Button & Model selection */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex items-center px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Cpu className="w-3.5 h-3.5 text-zinc-400 mr-1.5" />
              <span className="text-[11px] text-zinc-400 font-medium">
                模型: {
                  localTextModel === "gemini-3.5-flash"
                    ? "Gemini 3.5 Flash"
                    : localTextModel === "claude-sonnet-5"
                      ? "Claude-sonnet-5"
                      : (customModels.find(m => m.model === localTextModel)?.name || localTextModel)
                }
              </span>
            </button>
            <AnimatePresence>
              {showModelMenu && (
                <div key="model-menu-inline-script">
                  <div
                    className="fixed inset-0 z-[150]"
                    onClick={() => setShowModelMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full mb-2 right-0 z-[160] w-48 bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-850 p-1 flex flex-col gap-1 max-h-60 overflow-y-auto custom-scrollbar"
                  >
                    {(() => {
                      const baseTextModels = [
                        {
                          id: "gemini-3.5-flash",
                          name: "Gemini 3.5 Flash (推荐)",
                          icon: Cpu,
                        },
                        {
                          id: "claude-sonnet-5",
                          name: "Claude-sonnet-5",
                          icon: Cpu,
                        }
                      ];
                      const customTextModels = customModels
                        .filter((m: any) => m.type === "text" || m.type === "all" || !m.type)
                        .map((m: any, idx: number) => ({
                          id: m.model || m.id || m.name || `custom-text-${idx}`,
                          name: m.name || m.model || "Unnamed Model",
                          icon: Cpu,
                        }));
                      return [...baseTextModels, ...customTextModels].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setLocalTextModel(m.id);
                            setShowModelMenu(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-[10px] font-bold text-left transition-colors flex items-center space-x-2 ${
                            localTextModel === m.id
                              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                              : "hover:bg-gray-50 dark:hover:bg-zinc-900 text-gray-500 dark:text-zinc-400"
                          }`}
                        >
                          <m.icon className="w-3 h-3 animate-none shrink-0" />
                          <span className="truncate">{m.name}</span>
                        </button>
                      ));
                    })()}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleGenerateSubmit}
            disabled={isGenerating}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer ${
              isGenerating
                ? "bg-amber-400/80 cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-600 text-white hover:shadow-amber-500/10"
            }`}
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-4 h-4 translate-x-px -translate-y-px" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
