import React, { useState, useRef, useEffect } from "react";
import {
  ImageIcon,
  Download,
  RefreshCw,
  X,
  User,
  Box,
  Film,
  Clapperboard,
  LayoutDashboard,
  AlertCircle,
  Pause,
  Clock,
  Music,
  Play,
  Copy,
  Layout,
  Sparkles,
  Loader2,
  Trash2,
  Compass,
  Check,
  ChevronDown,
  Share2,
  Maximize2,
  Palette,
  Layers,
  FileText,
  Target,
  Quote,
  ClipboardList,
  PenTool,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { HistoryItem, SmartImageConfig, SmartVideoConfig } from "../types";
import { getThumbnailUrl } from "../services/utils";
import {
  getHistoryItemClassification,
  getActualCanvasCardSizeAndPort,
  getSemiAutoBorderStyles,
  getSemiAutoActiveStyles,
  safeParseParentIds,
} from "./workflow-utils";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HistoryCardProps {
  item: HistoryItem;
  onDragStart: () => void;
  onDragEnd: (offset: { x: number; y: number }) => void;
  onRemix: (item: HistoryItem) => void;
  onRegenerate: (item: HistoryItem) => void;
  onDownload: (item: HistoryItem) => void;
  onReference: (item: any) => void;
  onForward: (item: HistoryItem) => void;
  onMaximize: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onMakeVideo?: (item: HistoryItem) => void;
  onRefresh?: (item: HistoryItem) => void;
  onCopyLink?: (url: string) => void;
  isSelected?: boolean;
  isMultiSelected?: boolean;
  hasChildren?: boolean;
  onSelect?: (id: string) => void;
  onApplyMode?: (modeValue: string, item: HistoryItem) => void;
  setHistory?: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  generateImage?: (
    customConfig?: SmartImageConfig,
    position?: { x: number; y: number },
    parentId?: string,
  ) => Promise<any>;
  generateVideo?: (
    customConfig?: SmartVideoConfig,
    position?: { x: number; y: number },
    parentId?: string,
  ) => Promise<any>;
  setError?: (err: string | null) => void;
  isDragDisabled?: boolean;
  canvasScale?: number;
  onModeChange?: (mode: "image" | "video") => void;
  onDissect?: (item: HistoryItem) => void;
  onAssetDissection?: (item: HistoryItem) => void;
  onShotPromptDissection?: (item: HistoryItem) => void;
  isDissecting?: boolean;
  dockedItemId?: string | null;
  layoutMode?: string;
  handleRegenerateScriptSubtype?: (item: HistoryItem) => Promise<void>;
  isGenerating?: boolean;
  onDirectDecomposeScript?: (item: HistoryItem, mode: 'asset_prompt' | 'shot_prompt') => void;
  onRunSkillNode?: (id: string) => void;
  onRunIntegratedModelNode?: (id: string) => void;
  workflowSkills?: any[];
  syncToCloud?: (item: HistoryItem) => Promise<any>;
  history?: HistoryItem[];
  customModels?: any[];
}

export const HistoryCard = React.memo(
  ({
    item,
    onDragStart,
    onDragEnd,
    onRemix,
    onRegenerate,
    onDownload,
    onReference,
    onForward,
    onMaximize,
    onRemove,
    onMakeVideo,
    onRefresh,
    onCopyLink,
    isSelected,
    isMultiSelected,
    hasChildren,
    onSelect,
    onApplyMode,
    setHistory,
    generateImage,
    generateVideo,
    setError,
    isDragDisabled,
    canvasScale = 1,
    onModeChange,
    onDissect,
    onAssetDissection,
    onShotPromptDissection,
    isDissecting,
    dockedItemId,
    layoutMode,
    handleRegenerateScriptSubtype,
    isGenerating,
    onDirectDecomposeScript,
    onRunSkillNode,
    onRunIntegratedModelNode,
    workflowSkills = [],
    syncToCloud,
    history = [],
    customModels = [],
  }: HistoryCardProps) => {
    const [naturalAspectRatio, setNaturalAspectRatio] = useState<number | null>(item.naturalAspectRatio || null);
    const [isDraggingThisCard, setIsDraggingThisCard] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [localPos, setLocalPos] = useState({ x: item.position?.x || 0, y: item.position?.y || 0 });
    const [localText, setLocalText] = useState(item.revisedPrompt || "");

    useEffect(() => {
      setLocalText(item.revisedPrompt || "");
    }, [item.revisedPrompt]);
    const hasAssetResult = item.status === "success" || !!item.imageUrl || !!item.videoUrl || item.type === "gen_script" || item.type === "audio";
    const hasActiveParent = safeParseParentIds(item.parentId).length > 0;

    useEffect(() => {
      if (item.naturalAspectRatio) {
        setNaturalAspectRatio(item.naturalAspectRatio);
      }
    }, [item.naturalAspectRatio]);
    
    const dragStartPos = useRef({ pointerX: 0, pointerY: 0, cardX: 0, cardY: 0 });
    const lastParentPos = useRef({ x: item.position?.x || 0, y: item.position?.y || 0 });

    useEffect(() => {
      if (item.position?.x !== lastParentPos.current.x || item.position?.y !== lastParentPos.current.y) {
        lastParentPos.current = { x: item.position?.x || 0, y: item.position?.y || 0 };
        setLocalPos({ x: item.position?.x || 0, y: item.position?.y || 0 });
      }
    }, [item.position?.x, item.position?.y]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDragDisabled) return;
      if (e.button !== 0) return;
      
      const target = e.target as HTMLElement;
      if (
        target.closest("button") || 
        target.closest("input") || 
        target.closest("textarea") || 
        target.closest("a") || 
        target.closest(".no-drag") || 
        target.closest("select")
      ) {
        return;
      }

      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      setIsDraggingThisCard(true);
      setDragOffset({ x: 0, y: 0 });
      dragStartPos.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        cardX: item.position?.x || 0,
        cardY: item.position?.y || 0,
      };

      onDragStart();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingThisCard) return;
      e.stopPropagation();

      const dx = e.clientX - dragStartPos.current.pointerX;
      const dy = e.clientY - dragStartPos.current.pointerY;

      const localDx = dx / canvasScale;
      const localDy = dy / canvasScale;

      setLocalPos({
        x: dragStartPos.current.cardX + localDx,
        y: dragStartPos.current.cardY + localDy,
      });
      setDragOffset({ x: localDx, y: localDy });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingThisCard) return;
      e.stopPropagation();
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

      setIsDraggingThisCard(false);

      onDragEnd({
        x: dragOffset.x * canvasScale,
        y: dragOffset.y * canvasScale,
      });

      setDragOffset({ x: 0, y: 0 });
    };

    const cls = getHistoryItemClassification(item);
    const isDissectedScriptResult = Boolean(
      cls === "text_asset" ||
      cls === "shot_prompt" ||
      (item.id && (
        item.id.startsWith("director-") ||
        item.id.startsWith("assets-") ||
        item.id.startsWith("upl_") ||
        item.id.startsWith("text-") ||
        item.id.startsWith("script-")
      ))
    );

    useEffect(() => {
      if (item.imageUrl) {
        const img = new Image();
        img.src = getThumbnailUrl(item.imageUrl);
        img.onload = () => {
          if (img.naturalWidth && img.naturalHeight) {
            const ratio = img.naturalWidth / img.naturalHeight;
            setNaturalAspectRatio(ratio);
            if (setHistory) {
              setHistory((prev: HistoryItem[]) =>
                prev.map((h) =>
                  h.id === item.id && h.naturalAspectRatio !== ratio
                    ? { ...h, naturalAspectRatio: ratio }
                    : h
                )
              );
            }
          }
        };
      } else if (item.videoUrl && item.type === "video") {
        const video = document.createElement("video");
        video.src = item.videoUrl;
        video.onloadedmetadata = () => {
          if (video.videoWidth && video.videoHeight) {
            const ratio = video.videoWidth / video.videoHeight;
            setNaturalAspectRatio(ratio);
            if (setHistory) {
              setHistory((prev: HistoryItem[]) =>
                prev.map((h) =>
                  h.id === item.id && h.naturalAspectRatio !== ratio
                    ? { ...h, naturalAspectRatio: ratio }
                    : h
                )
              );
            }
          }
        };
      }
    }, [item.imageUrl, item.videoUrl, item.type, item.id, setHistory]);

    const getCardAspectRatioStyle = (): React.CSSProperties => {
      if (item.type === "gen_script") {
        return {};
      }
      if (naturalAspectRatio) {
        return { aspectRatio: `${naturalAspectRatio}` };
      }
      const ratioStr = item.config?.aspectRatio || item.config?.bananaAspectRatio || item.config?.ratio || "1:1";
      if (typeof ratioStr === "string") {
        const cleaned = ratioStr.replace("x", "/").replace(":", "/");
        if (item.config?.gridMode && item.config.gridMode !== "none") {
          if (item.config.gridMode === "panorama") {
            return { aspectRatio: "2/1" };
          }
        }
        return { aspectRatio: cleaned };
      }
      return { aspectRatio: "1/1" };
    };

    const getNumericAspectRatio = (): number => {
      if (naturalAspectRatio) {
        return naturalAspectRatio;
      }
      if (item.config?.gridMode && item.config.gridMode !== "none") {
        if (item.config.gridMode === "panorama") {
          return 2.0;
        }
      }
      const ratioStr = item.config?.aspectRatio || item.config?.bananaAspectRatio || item.config?.ratio || "1:1";
      if (typeof ratioStr === "string") {
        const parts = ratioStr.replace("x", "/").replace(":", "/").split("/");
        if (parts.length === 2) {
          const w = parseFloat(parts[0]);
          const h = parseFloat(parts[1]);
          if (!isNaN(w) && !isNaN(h) && h !== 0) {
            return w / h;
          }
        }
      }
      return 1.0;
    };

    const cardStyle = getCardAspectRatioStyle();
    const numericAspectRatio = getNumericAspectRatio();
    const isLandscape = item.type !== "gen_script" && numericAspectRatio > 1.1;
    const cardWidth = (item.config?.isSkillNode || item.config?.isIntegratedModelNode)
      ? 360
      : item.type === "gen_script" 
        ? 360 
        : isLandscape 
          ? 498 
          : 280;

    const spec = getActualCanvasCardSizeAndPort(item);

    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [showCreativeDropdown, setShowCreativeDropdown] = useState(false);
    const [showReferenceDropdown, setShowReferenceDropdown] = useState(false);
    const [showClassifyDropdown, setShowClassifyDropdown] = useState(false);
    const [showDissectDropdown, setShowDissectDropdown] = useState(false);
    const [showExportDropdown, setShowExportDropdown] = useState(false);
    const [showDecomposeDropdown, setShowDecomposeDropdown] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
      setDuration(e.currentTarget.duration);
    };

    const handleUpdateClassification = (newCls: 'character' | 'scene' | 'prop' | 'storyboard' | 'script' | 'text_asset' | 'shot_prompt') => {
      if (!setHistory) return;

      const updated = {
        ...item,
        classification: newCls,
        config: {
          ...(item.config || {}),
          classification: newCls
        }
      };

      setHistory((prev) =>
        prev.map((h) => (h.id === item.id ? updated : h))
      );

      const token = localStorage.getItem("token");
      if (token) {
        fetch("/api/user/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updated),
        }).catch((err) => {
          console.error("Failed to sync updated classification:", err);
        });
      }
    };
    const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
      setCurrentTime(e.currentTarget.currentTime);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const togglePlay = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error("Audio playback failed:", err);
        });
      }
    };

    const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (!audioRef.current || duration === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickPercent = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = clickPercent * duration;
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    };

    const waveformHeights = React.useMemo(() => {
      const heights: number[] = [];
      let hash = 0;
      const id = item.id;
      for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
      }
      for (let i = 0; i < 30; i++) {
        const factor = Math.sin((i / 30) * Math.PI) * 0.7 + 0.3;
        const rnd = Math.abs(Math.sin(hash + i * 1.5)) * 0.5 + 0.5;
        const h = Math.max(15, Math.min(95, factor * rnd * 100));
        heights.push(h);
      }
      return heights;
    }, [item.id]);

    const formatTime = (secs: number) => {
      if (isNaN(secs)) return "00:00";
      const m = Math.floor(secs / 60).toString().padStart(2, "0");
      const s = Math.floor(secs % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    };

    const cleanAudioName = (name: string) => {
      if (!name) return "音频素材";
      return name.replace(/\.(mp3|wav|m4a|ogg|aac|flac|wma)$/i, "");
    };

    useEffect(() => {
      if (!isSelected) {
        setShowCreativeDropdown(false);
        setShowReferenceDropdown(false);
        setShowClassifyDropdown(false);
        setShowDissectDropdown(false);
        setShowExportDropdown(false);
      }
    }, [isSelected]);

    useEffect(() => {
      if (!showCreativeDropdown) return;
      const handleDocumentClick = () => {
        setShowCreativeDropdown(false);
      };
      document.addEventListener("click", handleDocumentClick);
      return () => document.removeEventListener("click", handleDocumentClick);
    }, [showCreativeDropdown]);

    useEffect(() => {
      if (!showReferenceDropdown) return;
      const handleDocumentClick = () => {
        setShowReferenceDropdown(false);
      };
      document.addEventListener("click", handleDocumentClick);
      return () => document.removeEventListener("click", handleDocumentClick);
    }, [showReferenceDropdown]);

    useEffect(() => {
      if (!showClassifyDropdown) return;
      const handleDocumentClick = () => {
        setShowClassifyDropdown(false);
      };
      document.addEventListener("click", handleDocumentClick);
      return () => document.removeEventListener("click", handleDocumentClick);
    }, [showClassifyDropdown]);

    useEffect(() => {
      if (!showDissectDropdown) return;
      const handleDocumentClick = () => {
        setShowDissectDropdown(false);
      };
      document.addEventListener("click", handleDocumentClick);
      return () => document.removeEventListener("click", handleDocumentClick);
    }, [showDissectDropdown]);

    useEffect(() => {
      if (!showExportDropdown) return;
      const handleDocumentClick = () => {
        setShowExportDropdown(false);
      };
      document.addEventListener("click", handleDocumentClick);
      return () => document.removeEventListener("click", handleDocumentClick);
    }, [showExportDropdown]);

    useEffect(() => {
      if (!showDecomposeDropdown) return;
      const handleDocumentClick = () => {
        setShowDecomposeDropdown(false);
      };
      document.addEventListener("click", handleDocumentClick);
      return () => document.removeEventListener("click", handleDocumentClick);
    }, [showDecomposeDropdown]);

    useEffect(() => {
      if (!imageLoaded && !imageError && (item.imageUrl || item.videoUrl)) {
        const timer = setTimeout(() => {
          if (!imageLoaded) {
            console.warn("Image loading timed out:", item.imageUrl);
            setImageError(true);
            setImageLoaded(true);
          }
        }, 30000); // 30s timeout
        return () => clearTimeout(timer);
      }
    }, [imageLoaded, imageError, item.imageUrl, item.videoUrl]);

    const handleImageError = () => {
      console.warn("Image failed to load:", item.imageUrl);
      setImageError(true);
      setImageLoaded(true);
    };

    useEffect(() => {
      const calculateTimeLeft = () => {
        const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const startTime = item.timestamp || now;
        const deletionExpiryTime = startTime + SIXTY_DAYS_MS;

        if (now < deletionExpiryTime) {
          const diff = deletionExpiryTime - now;
          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
          if (days >= 1) {
            setTimeLeft(`${days}天后自动删除`);
          } else {
            const hours = Math.floor(diff / (60 * 60 * 1000));
            const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
            if (hours >= 1) {
              setTimeLeft(`${hours}小时${minutes}分后自动删除`);
            } else {
              setTimeLeft(`${minutes}分钟后自动删除`);
            }
          }
        } else {
          setTimeLeft("已自动删除");
        }
      };

      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 60000);
      return () => clearInterval(timer);
    }, [item.timestamp]);

    if ((item as any).status === "pipeline_pending" || (item as any).status === "pending" || (item as any).status === "running" || (item.config as any)?.isPipelineNode && ((item as any).status === "error" || (item as any).status === "failed")) {
      const isRunning = (item as any).status === "running";
      const isFailed = (item as any).status === "error" || (item as any).status === "failed";
      const nodeType = item.type; // 'image' | 'video' | 'gen_script' | 'audio'
      const title = item.config?.title || "意图执行节点";
      const prompt = item.config?.prompt || "";
      const aspectRatio = item.config?.aspectRatio || "1:1";
      const duration = item.config?.duration || "5";

      return (
        <motion.div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          initial={false}
          animate={{
            x: localPos.x,
            y: localPos.y,
            opacity: 1,
            scale: isDraggingThisCard ? 1.02 : 1,
          }}
          whileHover={{ scale: isDragDisabled ? 1 : 1.01, zIndex: 100 }}
          className={cn(
            "absolute w-[360px] h-[340px] group bg-zinc-950/95 backdrop-blur-md rounded-[32px] p-5 shadow-2xl border-2 will-change-transform history-card-drag-area transition-[border-color,box-shadow,background-color] duration-200 touch-none flex flex-col justify-between",
            isRunning 
              ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] animate-pulse" 
              : isFailed
                ? "border-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                : "border-zinc-800 hover:border-indigo-500/50 hover:shadow-indigo-500/10",
            isMultiSelected || isSelected
              ? "border-indigo-600 ring-4 ring-indigo-500/25 shadow-indigo-500/15"
              : ""
          )}
          style={{ cursor: isDragDisabled ? "default" : "grab" }}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelect) onSelect(item.id);
          }}
          transition={isDraggingThisCard ? { type: "tween", duration: 0 } : {
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 1,
            opacity: { duration: 0.2 },
          }}
        >
          {/* Connection Ports */}
          {layoutMode !== "bento" && layoutMode !== "semi_auto" && (
            <div className="absolute left-0 top-1/2 -translate-x-[15px] -translate-y-1/2 z-[50] flex items-center justify-center pointer-events-none">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 bg-zinc-950 border-indigo-500/40">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
              </div>
            </div>
          )}
          {layoutMode !== "bento" && layoutMode !== "semi_auto" && (
            <div className="absolute right-0 top-1/2 translate-x-[15px] -translate-y-1/2 z-[50] flex items-center justify-center pointer-events-none">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 bg-zinc-950 border-indigo-500/40">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
              </div>
            </div>
          )}

          {/* Card Main Body */}
          <div className="flex flex-col h-full space-y-3">
            {/* Header: Badge & Delete Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isRunning 
                    ? "bg-blue-400 animate-ping" 
                    : isFailed 
                      ? "bg-rose-500" 
                      : nodeType === "video" 
                        ? "bg-purple-500" 
                        : nodeType === "image" 
                          ? "bg-indigo-500" 
                          : "bg-teal-500"
                )} />
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest font-mono">
                  {nodeType === "video" ? "🎬 视频合成节点" : nodeType === "image" ? "🎨 原画生图节点" : "🧠 策划脚本节点"}
                </span>
              </div>
              
              {!isRunning && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 rounded-full transition-all"
                  title="删除节点"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Title / Tool */}
            <div className="flex items-center space-x-2 bg-zinc-900/50 border border-zinc-800/60 px-3 py-1.5 rounded-2xl">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[12px] font-bold text-zinc-100 truncate">{title}</span>
            </div>

            {/* Editable Prompt Textarea */}
            <div className="flex-1 flex flex-col space-y-1 min-h-0">
              <label className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase pl-1">创意描述词 (Prompt)</label>
              <textarea
                value={prompt}
                disabled={isRunning}
                onChange={(e) => {
                  const val = e.target.value;
                  setHistory?.(prev => prev.map(h => 
                    h.id === item.id 
                      ? { ...h, config: { ...h.config, prompt: val, revisedPrompt: val } } 
                      : h
                  ));
                }}
                className={cn(
                  "flex-1 w-full bg-zinc-900 border border-zinc-800/80 rounded-2xl p-3 text-[12px] text-zinc-200 resize-none focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all custom-scrollbar",
                  isRunning && "opacity-60 cursor-not-allowed"
                )}
                placeholder="输入或修改该步骤的生成提示词..."
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>

            {/* Node Controls / Micro-Tuning Parameters */}
            <div className="pt-2 border-t border-zinc-900 flex flex-col space-y-2">
              {nodeType === "image" && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 font-bold">画幅比例 (Ratio)</span>
                  <div className="flex items-center space-x-1.5">
                    {["1:1", "16:9", "9:16"].map((r) => {
                      const isActive = aspectRatio === r;
                      return (
                        <button
                          key={r}
                          disabled={isRunning}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistory?.(prev => prev.map(h => 
                              h.id === item.id 
                                ? { ...h, config: { ...h.config, aspectRatio: r } } 
                                : h
                            ));
                          }}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all border",
                            isActive 
                              ? "bg-indigo-600 border-indigo-500 text-white" 
                              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          )}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {nodeType === "video" && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 font-bold">生成时长 (Duration)</span>
                  <div className="flex items-center space-x-1.5">
                    {["4", "8", "15"].map((d) => {
                      const isActive = duration === d;
                      return (
                        <button
                          key={d}
                          disabled={isRunning}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistory?.(prev => prev.map(h => 
                              h.id === item.id 
                                ? { ...h, config: { ...h.config, duration: d } } 
                                : h
                            ));
                          }}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all border",
                            isActive 
                              ? "bg-purple-600 border-purple-500 text-white" 
                              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          )}
                        >
                          {d}s
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status / Message Alert */}
              {isRunning && (
                <div className="flex items-center space-x-2 justify-center py-2 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  <span className="text-[11px] font-bold text-indigo-300">正在生成此模块...</span>
                </div>
              )}

              {isFailed && (
                <div className="flex items-center justify-between py-1 px-2 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                  <span className="text-[10px] text-rose-400 font-bold max-w-[200px] truncate">{item.error || "执行出错"}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Trigger retry custom event
                      window.dispatchEvent(new CustomEvent('retry-pipeline-step', { detail: { stepId: item.id } }));
                    }}
                    className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-700 active:scale-95 transition-all"
                  >
                    重新执行
                  </button>
                </div>
              )}

              {!isRunning && !isFailed && (
                <div className="text-center text-[10px] text-zinc-600 font-medium py-1">
                  ⚔️ 已部署至作战沙盘，等待系统正式启动...
                </div>
              )}
            </div>
          </div>
        </motion.div>
      );
    }

    if (item.status === "draft_new") {
      return (
        <motion.div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          initial={false}
          animate={{
            x: localPos.x,
            y: localPos.y,
            opacity: 1,
            scale: isDraggingThisCard ? 1.02 : 1,
          }}
          whileHover={{ scale: isDragDisabled ? 1 : 1.01, zIndex: 50 }}
          className={cn(
            "absolute w-[360px] h-[340px] group bg-zinc-950/95 border-2 border-dashed rounded-[32px] shadow-2xl history-card-drag-area transition-[border-color,box-shadow,background-color] duration-200 flex flex-col justify-between touch-none",
            layoutMode === "semi_auto"
              ? getSemiAutoBorderStyles(item)
              : item.type === "video" 
                ? "hover:border-purple-500/50 hover:shadow-purple-500/5 border-zinc-800/80" 
                : "hover:border-indigo-500/50 hover:shadow-indigo-500/5 border-zinc-800/80",
            isMultiSelected || isSelected || dockedItemId === item.id
              ? layoutMode === "semi_auto"
                ? getSemiAutoActiveStyles(item)
                : item.type === "video"
                  ? "border-purple-500 ring-4 ring-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                  : "border-indigo-500 ring-4 ring-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
              : ""
          )}
          style={{ cursor: isDragDisabled ? "default" : "grab" }}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelect) onSelect(item.id);
          }}
          transition={isDraggingThisCard ? { type: "tween", duration: 0 } : {
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 1,
            opacity: { duration: 0.2 },
          }}
        >
          {layoutMode !== "bento" && layoutMode !== "semi_auto" && (
            <div
              className={cn(
                "absolute left-0 top-[170px] -translate-x-[15px] -translate-y-1/2 z-[50] flex items-center justify-center pointer-events-none transition-all duration-300",
                dockedItemId === item.id ? "scale-140" : "scale-100"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-full border-2 bg-zinc-950 transition-all duration-300",
                dockedItemId === item.id
                  ? item.type === "video" 
                    ? "border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.8)] scale-110" 
                    : "border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.8)] scale-110"
                  : item.type === "video"
                    ? "border-purple-500/40 group-hover:border-purple-500/70"
                    : "border-indigo-500/40 group-hover:border-indigo-500/70"
              )}>
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all duration-350",
                  dockedItemId === item.id
                    ? item.type === "video" ? "bg-purple-400 animate-ping" : "bg-indigo-400 animate-ping"
                    : item.type === "video" ? "bg-purple-500/40" : "bg-indigo-500/40"
                )} />
                <div className={cn(
                  "absolute w-2 h-2 rounded-full",
                  dockedItemId === item.id
                    ? item.type === "video" ? "bg-purple-400" : "bg-indigo-400"
                    : item.type === "video" ? "bg-purple-500/80" : "bg-indigo-500/80"
                )} />
              </div>

              {dockedItemId === item.id && (
                <div className="absolute left-[38px] bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white whitespace-nowrap px-2.5 py-1 rounded-xl shadow-xl pointer-events-none animate-pulse">
                  松开鼠标 添加为生成参考 ⚓
                </div>
              )}
            </div>
          )}

          {layoutMode !== "bento" && layoutMode !== "semi_auto" && (isSelected || isMultiSelected || dockedItemId === item.id || hasChildren) && (
            <div
              className={cn(
                "absolute right-0 top-[170px] translate-x-[15px] -translate-y-1/2 z-[50] flex items-center justify-center pointer-events-none transition-all duration-300",
                dockedItemId === item.id ? "scale-140" : "scale-100"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-full border-2 bg-zinc-950 transition-all duration-300",
                dockedItemId === item.id
                  ? item.type === "video"
                    ? "border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.8)] scale-110"
                    : "border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.8)] scale-110"
                  : item.type === "video"
                    ? "border-purple-500/40 group-hover:border-purple-500/70"
                    : "border-indigo-500/40 group-hover:border-indigo-500/70"
              )}>
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all duration-350",
                  dockedItemId === item.id
                    ? item.type === "video" ? "bg-purple-400 animate-ping" : "bg-indigo-400 animate-ping"
                    : item.type === "video" ? "bg-purple-500/40" : "bg-indigo-500/40"
                )} />
                <div className={cn(
                  "absolute w-2 h-2 rounded-full",
                  dockedItemId === item.id
                    ? item.type === "video" ? "bg-purple-400" : "bg-indigo-400"
                    : item.type === "video" ? "bg-purple-500/80" : "bg-indigo-500/80"
                )} />
              </div>

              {dockedItemId === item.id && (
                <div className="absolute right-[38px] bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white whitespace-nowrap px-2.5 py-1 rounded-xl shadow-xl pointer-events-none animate-pulse">
                  松开鼠标 添加为生成参考 ⚓
                </div>
              )}
            </div>
          )}
          <div className="p-6 h-full flex flex-col justify-between select-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  item.type === "video" ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" : "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                )} />
                <span className="text-[12px] font-black tracking-wider text-zinc-400 uppercase">
                  {item.type === "video" ? "待生成视频区域" : "待生成图片区域"}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                className="p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-full transition-all"
                title="删除区域"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center py-4 text-center space-y-3 flex-1">
              <div className={cn(
                "relative flex items-center justify-center w-14 h-14 rounded-full border border-dashed transition-all duration-350",
                item.type === "video" 
                  ? "border-purple-500/30 bg-purple-500/5 text-purple-400 group-hover:scale-105" 
                  : "border-indigo-500/30 bg-indigo-500/5 text-indigo-400 group-hover:scale-105"
              )}>
                <div className={cn(
                  "absolute inset-0 rounded-full animate-ping opacity-5",
                  item.type === "video" ? "bg-purple-500" : "bg-indigo-500"
                )} />
                {item.type === "video" ? (
                  <Film className="w-5 h-5 animate-pulse" />
                ) : (
                  <ImageIcon className="w-5 h-5 animate-pulse" />
                )}
              </div>

              <div className="space-y-1 px-4">
                <p className="text-[13px] font-bold text-zinc-200">
                  {item.type === "video" ? "视频生成占位" : "图片生成占位"}
                </p>
                <p className="text-[11px] text-zinc-500 leading-normal max-w-[240px]">
                  请在下方主输入框中输入描述词并发送，新内容将在此处加载。
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    if (item.type === "audio") {
      return (
        <motion.div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          initial={false}
          animate={{
            x: localPos.x,
            y: localPos.y,
            opacity: 1,
            scale: isDraggingThisCard ? 1.02 : 1,
          }}
          whileHover={{ scale: isDragDisabled ? 1 : 1.01, zIndex: 100 }}
          className={cn(
            "absolute w-[360px] h-[270px] group bg-white rounded-[32px] p-6 shadow-2xl border-2 will-change-transform history-card-drag-area transition-[border-color,box-shadow,background-color] duration-200 touch-none",
            layoutMode === "semi_auto"
              ? getSemiAutoBorderStyles(item)
              : "hover:shadow-indigo-500/10 border-gray-100/80",
            isMultiSelected || isSelected
              ? layoutMode === "semi_auto"
                ? getSemiAutoActiveStyles(item)
                : "border-indigo-600 ring-4 ring-indigo-500/25 shadow-indigo-500/15 shadow-xl"
              : ""
          )}
          style={{ cursor: isDragDisabled ? "default" : "grab" }}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelect) onSelect(item.id);
          }}
          transition={isDraggingThisCard ? { type: "tween", duration: 0 } : {
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 1,
            opacity: { duration: 0.2 },
          }}
        >
          {layoutMode !== "bento" && layoutMode !== "semi_auto" && (isSelected || isMultiSelected || dockedItemId === item.id || hasActiveParent) && (
            <div
              className={cn(
                "absolute left-0 top-1/2 -translate-x-[15px] -translate-y-1/2 z-[50] flex items-center justify-center pointer-events-none transition-all duration-300",
                dockedItemId === item.id ? "scale-140" : "scale-100"
              )}
            >
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 bg-zinc-950 border-indigo-500/40 group-hover:border-indigo-500/70 transition-all duration-300">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500/40 transition-all duration-350" />
                <div className="absolute w-2 h-2 rounded-full bg-indigo-500/80" />
              </div>
            </div>
          )}

          {layoutMode !== "bento" && layoutMode !== "semi_auto" && hasAssetResult && (isSelected || isMultiSelected || dockedItemId === item.id || hasChildren) && (
            <div
              className={cn(
                "absolute right-0 top-1/2 translate-x-[15px] -translate-y-1/2 z-[50] flex items-center justify-center pointer-events-none transition-all duration-300",
                dockedItemId === item.id ? "scale-140" : "scale-100"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-full border-2 bg-zinc-950 transition-all duration-300",
                dockedItemId === item.id
                  ? "border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.8)] scale-110"
                  : "border-indigo-500/40 group-hover:border-indigo-500/70"
              )}>
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all duration-350",
                  dockedItemId === item.id ? "bg-indigo-400 animate-ping" : "bg-indigo-500/40"
                )} />
                <div className={cn(
                  "absolute w-2 h-2 rounded-full",
                  dockedItemId === item.id ? "bg-indigo-400" : "bg-indigo-500/80"
                )} />
              </div>

              {dockedItemId === item.id && (
                <div className="absolute right-[38px] bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white whitespace-nowrap px-2.5 py-1 rounded-xl shadow-xl pointer-events-none animate-pulse">
                  松开鼠标 添加为生成参考 ⚓
                </div>
              )}
            </div>
          )}

          {item.videoUrl && (
            <audio
              ref={audioRef}
              src={item.videoUrl}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
            />
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            className="absolute top-5 right-5 p-1 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-all border border-gray-100 opacity-0 group-hover:opacity-100 z-30"
            title="删除音频素材"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center space-x-2.5 mb-3" onClick={(e) => e.stopPropagation()}>
            <div className="w-8 h-8 rounded-xl bg-indigo-5 flex items-center justify-center text-indigo-600 border border-indigo-100/30 shadow-sm">
              <Music className="w-4 h-4" />
            </div>
            <span className="text-[14px] font-black text-zinc-800 tracking-wide font-sans">
              {cleanAudioName(item.config?.originalName || item.config?.title)}
            </span>
          </div>

          <div className="relative w-full bg-zinc-950 border border-zinc-800/80 rounded-[24px] p-5 shadow-inner flex flex-col space-y-4">
            {onDownload && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(item);
                }}
                className="absolute top-4 right-4 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-full transition-all border border-zinc-700/40 active:scale-95 z-20"
                title="下载音频"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}

            <div 
              className="flex items-end justify-between h-20 w-full px-1 pt-6 relative group/waveform hover:opacity-100 opacity-95 transition-opacity" 
              onClick={handleWaveformClick}
            >
              {waveformHeights.map((height, i) => {
                const barPercent = (i / waveformHeights.length) * 100;
                const currentPercent = (currentTime / (duration || 1)) * 100;
                const isPlayed = barPercent <= currentPercent;
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-[2.5px] rounded-full transition-all duration-150",
                      isPlayed ? "bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]" : "bg-zinc-700"
                    )}
                    style={{ height: `${height}%` }}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] font-bold text-zinc-400 font-mono select-none">
                {formatTime(currentTime)} / {formatTime(duration || 4)}
              </div>

              <div className="flex justify-center pr-2">
                <button
                  onClick={togglePlay}
                  className="p-2.5 bg-zinc-800 hover:bg-indigo-600 hover:scale-105 active:scale-95 text-white rounded-full transition-all duration-200 border border-zinc-700/40 shadow-md flex items-center justify-center cursor-pointer"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-white fill-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white fill-white translate-x-[0.5px]" />
                  )}
                </button>
              </div>
              
              <div className="w-10" />
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        initial={false}
        animate={{
          x: localPos.x,
          y: localPos.y,
          opacity: 1,
          scale: isDraggingThisCard ? 1.02 : 1,
        }}
        whileHover={{ scale: isDragDisabled ? 1 : 1.01, zIndex: 50 }}
        className={cn(
          "absolute group rounded-[32px] shadow-2xl border flex flex-col will-change-transform history-card-drag-area transition-[border-color,box-shadow,background-color] duration-200 touch-none",
          item.type === "gen_script" ? "bg-white" : "bg-zinc-950",
          layoutMode === "semi_auto"
            ? getSemiAutoBorderStyles(item)
            : item.type === "gen_script"
              ? "border-purple-300 shadow-[0_4px_24px_rgba(168,85,247,0.12)] hover:border-purple-400 hover:shadow-purple-400/20"
              : "border-zinc-800/80",
          isMultiSelected || isSelected
            ? layoutMode === "semi_auto"
              ? getSemiAutoActiveStyles(item)
              : "border-indigo-600 ring-4 ring-indigo-500/25 shadow-indigo-500/15 shadow-xl"
            : ""
        )}
        style={{ 
          cursor: isDragDisabled ? "default" : "grab",
          width: `${cardWidth}px`,
          ...cardStyle
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (onSelect) onSelect(item.id);
        }}
        onMouseEnter={() => {
          if (item.type === "video" && videoRef.current) {
            videoRef.current.play().catch((err) => {
              console.log("Failed to play video on hover", err);
            });
          }
        }}
        onMouseLeave={() => {
          if (item.type === "video" && videoRef.current) {
            videoRef.current.pause();
          }
        }}
        transition={isDraggingThisCard ? { type: "tween", duration: 0 } : {
          type: "spring",
          stiffness: 400,
          damping: 30,
          mass: 1,
          opacity: { duration: 0.2 },
        }}
      >
        {layoutMode !== "bento" && layoutMode !== "semi_auto" && (isSelected || isMultiSelected || dockedItemId === item.id || hasActiveParent) && (
          <div
            className={cn(
              "absolute left-0 z-[50] flex items-center justify-center pointer-events-none transition-all duration-300",
              dockedItemId === item.id ? "scale-140" : "scale-100"
            )}
            style={{
              top: `${spec.portY}px`,
              transform: "translateX(-15px) translateY(-50%)"
            }}
          >
            <div className={cn(
              "relative flex items-center justify-center w-8 h-8 rounded-full border-2 bg-zinc-950 transition-all duration-300",
              item.type === "video" 
                ? "border-purple-500/40 group-hover:border-purple-500/70"
                : "border-indigo-500/40 group-hover:border-indigo-500/70"
            )}>
              <div className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-350",
                item.type === "video" ? "bg-purple-500/40" : "bg-indigo-500/40"
              )} />
              <div className={cn(
                "absolute w-2 h-2 rounded-full",
                item.type === "video" ? "bg-purple-500/80" : "bg-indigo-500/80"
              )} />
            </div>
          </div>
        )}

        {layoutMode !== "bento" && layoutMode !== "semi_auto" && hasAssetResult && (item.config?.isSkillNode || isSelected || isMultiSelected || dockedItemId === item.id || hasChildren) && (
          <div
            className={cn(
              "absolute right-0 z-[50] flex items-center justify-center pointer-events-none transition-all duration-300",
              dockedItemId === item.id ? "scale-140" : "scale-100"
            )}
            style={{
              top: `${spec.portY}px`,
              transform: "translateX(15px) translateY(-50%)"
            }}
          >
            <div className={cn(
              "relative flex items-center justify-center w-8 h-8 rounded-full border-2 bg-zinc-950 transition-all duration-300",
              dockedItemId === item.id
                ? item.type === "video" 
                  ? "border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.8)] scale-110" 
                  : "border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.8)] scale-110"
                : item.type === "video"
                  ? "border-purple-500/40 group-hover:border-purple-500/70"
                  : "border-indigo-500/40 group-hover:border-indigo-500/70"
            )}>
              <div className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-350",
                dockedItemId === item.id
                  ? item.type === "video" ? "bg-purple-400 animate-ping" : "bg-indigo-400 animate-ping"
                  : item.type === "video" ? "bg-purple-500/40" : "bg-indigo-500/40"
              )} />
              <div className={cn(
                "absolute w-2 h-2 rounded-full",
                dockedItemId === item.id
                  ? item.type === "video" ? "bg-purple-400" : "bg-indigo-400"
                  : item.type === "video" ? "bg-purple-500/80" : "bg-indigo-500/80"
              )} />
            </div>

            {dockedItemId === item.id && (
              <div className="absolute right-[38px] bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white whitespace-nowrap px-2.5 py-1 rounded-xl shadow-xl pointer-events-none animate-pulse">
                松开鼠标 添加为生成参考 ⚓
              </div>
            )}
          </div>
        )}

        {!item.config?.isSkillNode && !item.config?.isIntegratedModelNode && (
          <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
            <div
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/90 text-[10px] font-bold cursor-help select-none"
              title="注：生成的内容将在 10 天后自动从云端删除，建议在此期间下载保存。"
            >
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>{timeLeft}</span>
            </div>

            {(item.type as string) !== "video" && !item.videoUrl && (item.type as string) !== "audio" && (
              <div className="relative no-drag" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowClassifyDropdown(!showClassifyDropdown);
                  }}
                  className={cn(
                    "flex items-center space-x-1 px-3 py-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full border text-[10px] font-bold transition-all cursor-pointer active:scale-95",
                    showClassifyDropdown
                      ? "border-indigo-500/80 text-indigo-300"
                      : "border-white/10 text-white/90"
                  )}
                  title="修改分类"
                >
                  {(() => {
                    const currentCls = getHistoryItemClassification(item);
                    if (currentCls === "character") return <User className="w-3 h-3 text-amber-400" />;
                    if (currentCls === "scene") return <Layout className="w-3 h-3 text-purple-400" />;
                    if (currentCls === "prop") return <Box className="w-3 h-3 text-green-400" />;
                    if (currentCls === "storyboard") return <Film className="w-3 h-3 text-sky-400" />;
                    if (currentCls === "script") return <FileText className="w-3 h-3 text-amber-400" />;
                    if (currentCls === "text_asset") return <Layers className="w-3 h-3 text-emerald-400" />;
                    if (currentCls === "shot_prompt") return <Sparkles className="w-3 h-3 text-cyan-400" />;
                    return <Film className="w-3 h-3 text-sky-400" />;
                  })()}
                  <span>
                    {(() => {
                      const currentCls = getHistoryItemClassification(item);
                      if (currentCls === "character") return "角色";
                      if (currentCls === "scene") return "场景";
                      if (currentCls === "prop") return "道具";
                      if (currentCls === "storyboard") return "分镜";
                      if (currentCls === "script") return "剧本";
                      if (currentCls === "text_asset") return "资产";
                      if (currentCls === "shot_prompt") return "分镜提示词";
                      return "分镜";
                    })()}
                  </span>
                  <ChevronDown className="w-2.5 h-2.5 text-zinc-400" />
                </button>

                <AnimatePresence>
                  {showClassifyDropdown && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.1 }}
                      className="absolute top-full mt-1.5 left-0 z-50 w-28 bg-zinc-950/95 border border-zinc-800/80 shadow-2xl backdrop-blur-md rounded-xl p-1 flex flex-col gap-0.5"
                    >
                      {(item.type === "gen_script"
                        ? [
                            { key: "script", label: "剧本", icon: FileText, color: "text-amber-400 hover:bg-amber-500/10" },
                            { key: "text_asset", label: "资产", icon: Layers, color: "text-emerald-400 hover:bg-emerald-500/10" },
                            { key: "shot_prompt", label: "分镜提示词", icon: Sparkles, color: "text-cyan-400 hover:bg-cyan-500/10" },
                          ]
                        : [
                            { key: "character", label: "角色", icon: User, color: "text-amber-400 hover:bg-amber-500/10" },
                            { key: "scene", label: "场景", icon: Layout, color: "text-purple-400 hover:bg-purple-500/10" },
                            { key: "prop", label: "道具", icon: Box, color: "text-green-400 hover:bg-green-500/10" },
                            { key: "storyboard", label: "分镜", icon: Film, color: "text-sky-400 hover:bg-sky-500/10" },
                          ]
                      ).map((clsOption) => {
                        const IconComponent = clsOption.icon;
                        const isCurrent = getHistoryItemClassification(item) === clsOption.key;
                        return (
                          <button
                            key={clsOption.key}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateClassification(clsOption.key as any);
                              setShowClassifyDropdown(false);
                            }}
                            className={cn(
                              "w-full h-7 px-2 rounded-lg flex items-center justify-between transition-all text-[11px] font-semibold text-left cursor-pointer",
                              isCurrent 
                                ? "bg-zinc-800 text-white" 
                                : "text-zinc-400 hover:text-white bg-transparent"
                            )}
                          >
                            <div className="flex items-center space-x-1.5">
                              <IconComponent className={cn("w-3 h-3", isCurrent ? "text-indigo-400" : "text-zinc-500")} />
                              <span>{clsOption.label}</span>
                            </div>
                            {isCurrent && <Check className="w-2.5 h-2.5 text-indigo-400" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {(item.status === "loading" || item.status === "processing") &&
        !(item.imageUrl || item.videoUrl || item.type === "gen_script") ? (
          <div className="w-full h-full flex-1 flex flex-col items-center justify-center bg-zinc-900/60 backdrop-blur-sm space-y-4 relative overflow-hidden rounded-[30px]">
            <button
              onClick={() => onRemove(item.id)}
              className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-all z-10"
              title="取消生成"
            >
              <X className="w-4 h-4" />
            </button>
            <div
              className={cn(
                "w-12 h-12 border-4 rounded-full animate-spin",
                item.type === "video"
                  ? "border-purple-500 border-t-transparent"
                  : "border-indigo-500 border-t-transparent",
              )}
            />
            <div className="text-center px-6">
              <p
                className={cn(
                  "text-xs font-bold animate-pulse",
                  item.type === "video" ? "text-purple-400" : "text-gray-400",
                )}
              >
                {(item.config as any)?.isPlaceholder
                  ? "正在读取并载入外部媒体文件..."
                  : item.status === "processing"
                    ? "正在渲染视频..."
                    : "正在构思中..."}
              </p>
              {item.type === "video" ? (
                <p className="text-[10px] text-gray-400 mt-2">
                  {(item.config as any)?.isPlaceholder
                    ? "正在本地转换及保存，请稍等"
                    : "视频生成通常需要 1-3 分钟，请耐心等待"}
                </p>
              ) : (
                (item.config as any)?.isPlaceholder ? (
                  <p className="text-[10px] text-gray-400 mt-2">
                    正在本地读取图像并同步到协同画布，请稍等
                  </p>
                ) : (
                  (item.config as SmartImageConfig)?.imageSize === "4K" && (
                    <div className="mt-3 px-4 py-2 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                      <p className="text-[10px] text-indigo-400 font-medium leading-relaxed">
                        正在生成 4K 超清图片，这可能需要更长时间
                      </p>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        ) : item.type === "gen_script" ? (
            <div className="relative aspect-[3/4] sm:aspect-square overflow-hidden bg-white cursor-pointer group/script rounded-[30px]">
              <div className="w-full h-full p-6 flex flex-col bg-amber-50/20">
                <div className="flex items-center space-x-2 text-amber-600 mb-3 shrink-0">
                  {(() => {
                    const cls = getHistoryItemClassification(item);
                    if (cls === "text_asset") {
                      return (
                        <>
                          <Layers className="w-4 h-4 text-emerald-600" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">资产 (文本区域)</span>
                        </>
                      );
                    } else if (cls === "shot_prompt") {
                      return (
                        <>
                          <Sparkles className="w-4 h-4 text-cyan-600 animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-600">分镜提示词</span>
                        </>
                      );
                    } else if (item.id?.startsWith("upl_")) {
                      return (
                        <>
                          <FileText className="w-4 h-4 text-amber-600" />
                          <span className="text-[10px] font-black uppercase tracking-wider">拖入剧本</span>
                        </>
                      );
                    } else if (item.id?.startsWith("text-")) {
                      return (
                        <>
                          <FileText className="w-4 h-4 text-amber-600" />
                          <span className="text-[10px] font-black uppercase tracking-wider">自定义文本</span>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <PenTool className="w-4 h-4 text-amber-600" />
                          <span className="text-[10px] font-black uppercase tracking-wider">灵感剧本</span>
                        </>
                      );
                    }
                  })()}
                </div>
                <div className="flex-1 overflow-hidden relative">
                  <div className="absolute inset-0 overflow-hidden">
                    <textarea
                      value={localText}
                      onChange={(e) => {
                        const newText = e.target.value;
                        setLocalText(newText);
                        setHistory?.((prev) =>
                          prev.map((h) =>
                            h.id === item.id ? { ...h, revisedPrompt: newText } : h
                          )
                        );
                        syncToCloud?.({ ...item, revisedPrompt: newText });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      onKeyUp={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full h-full p-4 bg-white/70 rounded-2xl border border-amber-100/60 focus:border-indigo-400 focus:bg-white shadow-inner font-sans text-[12px] leading-relaxed text-gray-700 resize-none outline-none transition-all no-drag custom-scrollbar"
                      placeholder="在此处直接输入或编辑您的想法..."
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div
            className={cn(
              "relative w-full h-[100%] flex-1 overflow-hidden cursor-pointer rounded-[30px]",
              item.status === "error" ? "bg-zinc-900" : "bg-black",
            )}
          >
            {item.status === "error" ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 p-6 text-center space-y-4">
                <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center text-red-500 shadow-sm border border-red-100/50">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-200 tracking-wide">
                    生成失败
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">
                    模型服务异常或检测到提示词不符合安全规范
                  </p>
                </div>
                {item.error && (
                  <div className="bg-red-50/50 rounded-2xl p-3.5 border border-red-100/30 max-w-[85%]">
                    <p className="text-[11px] text-red-500/80 leading-relaxed break-all font-medium">
                      {item.error}
                    </p>
                  </div>
                )}
                <div className="flex items-center space-x-3 pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 rounded-xl text-[11px] font-bold transition-all active:scale-95 flex items-center space-x-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>删除记录</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegenerate(item);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold transition-all active:scale-95 flex items-center space-x-1.5 shadow-sm shadow-indigo-500/10"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>重新生成</span>
                  </button>
                </div>
              </div>
            ) : item.type === "video" ? (
              videoError ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 p-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                    <Film className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-zinc-300">
                    视频播放失败
                  </p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    可能是由于网络波动或媒体连接超时，请尝试重新加载。
                  </p>
                  <button
                    onClick={() => {
                      setVideoError(false);
                      if (onRefresh) onRefresh(item);
                    }}
                    className="px-4 py-1.5 bg-indigo-500 text-white rounded-xl text-[10px] font-bold hover:bg-indigo-600 transition-all active:scale-95 flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>重新加载</span>
                  </button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  src={item.videoUrl || null}
                  poster={getThumbnailUrl(item.videoUrl, "video")}
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  onError={() => setVideoError(true)}
                />
              )
            ) : (
              <div className="w-full h-full relative">
                {imageError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 p-6 text-center space-y-3">
                    <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-zinc-300">
                      图片加载失败
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      可能是由于网络波动或云端同步延迟，请尝试重新加载。
                    </p>
                    <button
                      onClick={() => {
                        setImageError(false);
                        setImageLoaded(false);
                        if (onRefresh) onRefresh(item);
                      }}
                      className="px-4 py-1.5 bg-indigo-500 text-white rounded-xl text-[10px] font-bold hover:bg-indigo-600 transition-all active:scale-95 flex items-center space-x-1.5"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>重新加载</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {item.imageUrl ? (
                      <img
                        src={getThumbnailUrl(item.imageUrl)}
                        alt="Generated"
                        className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                        onLoad={() => setImageLoaded(true)}
                        onError={handleImageError}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-200" />
                      </div>
                    )}
                    {!imageLoaded && item.imageUrl && (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-200" />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {item.type === "gen_script" && !isDissectedScriptResult && !item.config?.isSkillNode && !item.config?.isIntegratedModelNode && (
          <div className="p-6 space-y-4 bg-white rounded-b-[40px]">
            <div className="min-h-[56px]">
              <p className="text-[10px] text-amber-500 font-black uppercase tracking-[0.2em] mb-2">
                剧本预览
              </p>
              <p className="text-[14px] text-gray-600 line-clamp-2 italic leading-relaxed font-medium">
                剧本内容已生成，您可以进行二次修改或转发。
              </p>
            </div>
          </div>
        )}

        {!item.config?.isSkillNode && !item.config?.isIntegratedModelNode &&
          (item.status === "success" ||
            item.imageUrl ||
            item.videoUrl ||
            item.status === "error" ||
            item.type === "gen_script") && (
          <AnimatePresence>
            {isSelected && (
              <div
                className="absolute top-full mt-4 z-[100] pointer-events-none"
                style={{
                  left: "50%",
                  transform: `translate(-50%, 0) scale(${1 / canvasScale})`,
                  transformOrigin: "top center",
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="flex items-center bg-zinc-950/90 border border-zinc-800/80 hover:border-zinc-700/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.6),0_0_12px_rgba(99,102,241,0.06)] backdrop-blur-xl rounded-full px-3 py-1.5 gap-1 text-white whitespace-nowrap pointer-events-auto action-bar-click-target"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                >
                  {item.type === "gen_script" ? (
                    <>
                      {(() => {
                        const cls = getHistoryItemClassification(item);
                        const isAssets = cls === "text_asset";
                        const isDirector = cls === "shot_prompt";

                        if (isAssets) {
                          return (
                            <>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleRegenerateScriptSubtype?.(item);
                                }}
                                disabled={isGenerating}
                                className={cn(
                                  "h-8 px-2.5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-350 rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold",
                                  isGenerating && "opacity-50 cursor-not-allowed"
                                )}
                                title="根据剧本重新生成相应的资产"
                              >
                                <RefreshCw className={cn("w-3.5 h-3.5", isGenerating && "animate-spin")} />
                                <span>重新生成</span>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAssetDissection?.(item);
                                }}
                                className="h-8 px-2.5 hover:bg-violet-500/10 text-violet-400 hover:text-violet-350 rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold"
                                title="将资产一键生成对应的图片草稿"
                              >
                                <Box className="w-3.5 h-3.5" />
                                <span>资产拆分</span>
                              </button>
                            </>
                          );
                        } else if (isDirector) {
                          return (
                            <>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleRegenerateScriptSubtype?.(item);
                                }}
                                disabled={isGenerating}
                                className={cn(
                                  "h-8 px-2.5 hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-350 rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold",
                                  isGenerating && "opacity-50 cursor-not-allowed"
                                )}
                                title="根据剧本重新生成相应的分镜提示词"
                              >
                                <RefreshCw className={cn("w-3.5 h-3.5", isGenerating && "animate-spin")} />
                                <span>重新生成</span>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onShotPromptDissection?.(item);
                                }}
                                className="h-8 px-2.5 hover:bg-fuchsia-500/10 text-fuchsia-400 hover:text-fuchsia-350 rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold"
                                title="将分镜一键生成对应的视频草稿"
                              >
                                <Film className="w-3.5 h-3.5" />
                                <span>分镜提示词拆分</span>
                              </button>
                            </>
                          );
                        } else {
                          return (
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDecomposeDropdown(!showDecomposeDropdown);
                                }}
                                className={cn(
                                  "h-8 px-2.5 hover:bg-amber-400/10 text-amber-400 hover:text-amber-300 rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold",
                                  showDecomposeDropdown && "bg-amber-400/20 text-amber-300"
                                )}
                                title="智能拆解脚本/剧本内容"
                              >
                                <Clapperboard className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                <span>剧本拆解</span>
                                <ChevronDown
                                  className={cn(
                                    "w-3 h-3 text-amber-400/80 transition-transform duration-200",
                                    showDecomposeDropdown && "rotate-180"
                                  )}
                                />
                              </button>

                              <AnimatePresence>
                                {showDecomposeDropdown && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute bottom-full mb-2 left-0 z-[120] min-w-[155px] bg-zinc-950/95 border border-zinc-800/80 shadow-2xl backdrop-blur-md rounded-xl p-1 flex flex-col gap-0.5 whitespace-nowrap action-bar-click-target"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowDecomposeDropdown(false);
                                        onMakeVideo?.(item);
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-amber-400 hover:bg-zinc-800/80 rounded-lg transition-colors flex items-center space-x-2"
                                    >
                                      <Clapperboard className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                      <span>极速剧本拆解</span>
                                    </button>

                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setShowDecomposeDropdown(false);
                                        await onDirectDecomposeScript?.(item, "asset_prompt");
                                      }}
                                      disabled={isGenerating}
                                      className={cn(
                                        "w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2",
                                        isGenerating
                                          ? "text-zinc-500 cursor-not-allowed opacity-50"
                                          : "text-zinc-300 hover:text-violet-400 hover:bg-zinc-800/80"
                                      )}
                                    >
                                      <Box className="w-3.5 h-3.5 text-violet-400" />
                                      <span>资产提示词</span>
                                    </button>

                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setShowDecomposeDropdown(false);
                                        await onDirectDecomposeScript?.(item, "shot_prompt");
                                      }}
                                      disabled={isGenerating}
                                      className={cn(
                                        "w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2",
                                        isGenerating
                                          ? "text-zinc-500 cursor-not-allowed opacity-50"
                                          : "text-zinc-300 hover:text-fuchsia-400 hover:bg-zinc-800/80"
                                      )}
                                    >
                                      <Film className="w-3.5 h-3.5 text-fuchsia-400" />
                                      <span>分镜提示词</span>
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        }
                      })()}

                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowExportDropdown(!showExportDropdown);
                          }}
                          className={cn(
                            "h-8 px-2.5 hover:bg-zinc-800/80 text-zinc-300 hover:text-white rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold",
                            showExportDropdown && "bg-zinc-850 text-white"
                          )}
                          title="复制或下载剧本"
                        >
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                          <span>复制与下载</span>
                          <ChevronDown
                            className={cn(
                              "w-3 h-3 text-zinc-400 transition-transform duration-200",
                              showExportDropdown && "rotate-180"
                            )}
                          />
                        </button>

                        <AnimatePresence>
                          {showExportDropdown && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 8 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 8 }}
                              transition={{ duration: 0.15 }}
                              className="absolute bottom-full mb-2 left-0 z-[120] min-w-[140px] bg-zinc-950/95 border border-zinc-800/80 shadow-2xl backdrop-blur-md rounded-xl p-1 flex flex-col gap-0.5 whitespace-nowrap action-bar-click-target"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowExportDropdown(false);
                                  navigator.clipboard.writeText(item.revisedPrompt || "");
                                }}
                                className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-lg transition-colors flex items-center space-x-2"
                              >
                                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                <span>
                                  {cls === "text_asset"
                                    ? "复制资产内容"
                                    : cls === "shot_prompt"
                                    ? "复制分镜内容"
                                    : "复制剧本"}
                                </span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowExportDropdown(false);
                                  onDownload(item);
                                }}
                                className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-lg transition-colors flex items-center space-x-2"
                              >
                                <Download className="w-3.5 h-3.5 text-zinc-400" />
                                <span>下载 TXT</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onForward(item);
                        }}
                        className="h-8 px-2.5 hover:bg-zinc-800/80 text-zinc-300 hover:text-white rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold"
                        title="转发到协同创作"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>转发协作</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMaximize(item);
                        }}
                        className="h-8 px-2.5 hover:bg-zinc-800/80 text-zinc-300 hover:text-white rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold"
                        title="查看与修改剧本"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>查看与修改</span>
                      </button>

                      <div className="w-[1px] h-3.5 bg-zinc-800 mx-1 shrink-0" />

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(item.id);
                        }}
                        className="h-8 px-2.5 hover:bg-red-500/10 hover:text-red-300 text-red-400/90 rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>删除</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemix(item);
                        }}
                        className="h-8 px-3 hover:bg-amber-400/10 text-amber-400 hover:text-amber-300 rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold"
                        title="做同款"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>做同款</span>
                      </button>

                      {item.videoUrl && (
                        <button
                          disabled={isDissecting}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onDissect) onDissect(item);
                          }}
                          className="h-8 px-2.5 hover:bg-amber-500/10 text-amber-500 hover:text-amber-400 rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold relative disabled:opacity-50"
                          title="影音拉片"
                        >
                          <Film className={cn("w-3.5 h-3.5 text-orange-400", isDissecting && "animate-spin")} />
                          <span>{isDissecting ? "读取中..." : "影音拉片"}</span>
                        </button>
                      )}

                      {(item.status === "success" ||
                        item.imageUrl ||
                        item.videoUrl) && (
                        <>
                          {!item.videoUrl && (
                            <>
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowCreativeDropdown(
                                      !showCreativeDropdown,
                                    );
                                  }}
                                  className={cn(
                                    "h-8 px-2.5 hover:bg-indigo-500/10 text-indigo-300 hover:text-indigo-200 rounded-full flex items-center space-x-1 transition-all active:scale-95 text-xs font-semibold",
                                    showCreativeDropdown &&
                                      "bg-indigo-500/15 text-indigo-200",
                                  )}
                                  title="更多创意延展工具"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                                  <span>创意延展</span>
                                  <ChevronDown
                                    className={cn(
                                      "w-3 h-3 text-zinc-400 transition-transform duration-200",
                                      showCreativeDropdown && "rotate-180",
                                    )}
                                  />
                                </button>

                                <AnimatePresence>
                                  {showCreativeDropdown && (
                                    <motion.div
                                      initial={{
                                        opacity: 0,
                                        scale: 0.95,
                                        y: 8,
                                      }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: 8 }}
                                      transition={{ duration: 0.15 }}
                                      className="absolute bottom-full mb-2 left-0 z-[120] w-36 bg-zinc-950/95 border border-zinc-800/80 shadow-2xl backdrop-blur-md rounded-xl p-1 flex flex-col gap-0.5 whitespace-nowrap action-bar-click-target"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onApplyMode?.("six-view", item);
                                          setShowCreativeDropdown(false);
                                        }}
                                        className="w-full h-8 px-2.5 rounded-lg flex items-center space-x-2 text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-all text-xs font-semibold text-left"
                                        title="生成该角色的专业转面设定图"
                                      >
                                        <Box className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                                        <span>角色设定图</span>
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onApplyMode?.("scene-plan", item);
                                          setShowCreativeDropdown(false);
                                        }}
                                        className="w-full h-8 px-2.5 rounded-lg flex items-center space-x-2 text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-all text-xs font-semibold text-left"
                                        title="生成该场景的专业布局方案图"
                                      >
                                        <Palette className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                        <span>场景方案</span>
                                      </button>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onApplyMode?.(
                                              "grid-storyboard",
                                              item,
                                            );
                                            setShowCreativeDropdown(false);
                                          }}
                                          className="w-full h-8 px-2.5 rounded-lg flex items-center space-x-2 text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-all text-xs font-semibold text-left"
                                          title="生成 3X3 九宫格分镜"
                                        >
                                          <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                          <span>九宫格分镜</span>
                                        </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onApplyMode?.("panorama", item);
                                          setShowCreativeDropdown(false);
                                        }}
                                        className="w-full h-8 px-2.5 rounded-lg flex items-center space-x-2 text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-all text-xs font-semibold text-left"
                                        title="生成专业级 720° 全景 VR"
                                      >
                                        <Compass className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                        <span>VR全景世界</span>
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onApplyMode?.(
                                            "perspective-sim",
                                            item,
                                          );
                                          setShowCreativeDropdown(false);
                                        }}
                                        className="w-full h-8 px-2.5 rounded-lg flex items-center space-x-2 text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-all text-xs font-semibold text-left"
                                        title="精准控制3D场景与角色位置"
                                      >
                                        <Box className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                        <span>3D导演台</span>
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onApplyMode?.(
                                            "point-and-shoot",
                                            item,
                                          );
                                          setShowCreativeDropdown(false);
                                        }}
                                        className="w-full h-8 px-2.5 rounded-lg flex items-center space-x-2 text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-all text-xs font-semibold text-left"
                                        title="在场景中标记人物位置"
                                      >
                                        <Target className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                        <span>指哪打哪</span>
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onApplyMode?.("storyboard", item);
                                          setShowCreativeDropdown(false);
                                        }}
                                        className="w-full h-8 px-2.5 rounded-lg flex items-center space-x-2 text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-all text-xs font-semibold text-left"
                                        title="自动分析剧情并生成故事分镜大面板"
                                      >
                                        <ClipboardList className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                                        <span>故事面板</span>
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </>
                          )}

                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowReferenceDropdown(
                                  !showReferenceDropdown,
                                );
                              }}
                              className={cn(
                                "h-8 px-2.5 hover:bg-emerald-500/10 text-emerald-300 hover:text-emerald-200 rounded-full flex items-center space-x-1 transition-all active:scale-95 text-xs font-semibold",
                                showReferenceDropdown &&
                                  "bg-emerald-500/15 text-emerald-200",
                              )}
                              title="引用参考"
                            >
                              <Quote className="w-3.5 h-3.5 text-emerald-400" />
                              <span>引用参考</span>
                              <ChevronDown
                                className={cn(
                                  "w-3 h-3 text-zinc-400 transition-transform duration-200",
                                  showReferenceDropdown && "rotate-180",
                                )}
                              />
                            </button>

                            <AnimatePresence>
                              {showReferenceDropdown && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute bottom-full mb-2 left-0 z-[120] w-36 bg-zinc-950/95 border border-zinc-800/80 shadow-2xl backdrop-blur-md rounded-xl p-1 flex flex-col gap-0.5 whitespace-nowrap action-bar-click-target"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {!item.videoUrl && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onReference(item);
                                        setShowReferenceDropdown(false);
                                      }}
                                      className="w-full h-8 px-2.5 rounded-lg flex items-center space-x-2 text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-all text-xs font-semibold text-left"
                                      title="引用该图片"
                                    >
                                      <Quote className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      <span>图片参考</span>
                                    </button>
                                  )}

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMakeVideo?.(item);
                                      setShowReferenceDropdown(false);
                                    }}
                                    className="w-full h-8 px-2.5 rounded-lg flex items-center space-x-2 text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-all text-xs font-semibold text-left"
                                    title="作为视频参考素材"
                                  >
                                    <Clapperboard className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                    <span>视频参考</span>
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onForward(item);
                            }}
                            className="h-8 px-2.5 hover:bg-zinc-800/80 text-zinc-300 hover:text-white rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold"
                            title="转发到群聊"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>转发</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMaximize(item);
                            }}
                            className="h-8 px-2.5 hover:bg-zinc-800/80 text-zinc-300 hover:text-white rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold"
                            title="放大"
                          >
                            <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
                            <span>放大</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownload(item);
                            }}
                            className="h-8 px-2.5 hover:bg-zinc-800/80 text-zinc-300 hover:text-white rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold"
                            title="下载至本地"
                          >
                            <Download className="w-3.5 h-3.5 text-zinc-400" />
                            <span>下载</span>
                          </button>
                        </>
                      )}

                      {(item.status === "success" ||
                        item.imageUrl ||
                        item.videoUrl) && (
                        <div className="w-[1px] h-3.5 bg-zinc-800 mx-1 shrink-0" />
                      )}

                      {!(
                        item.status === "success" ||
                        item.imageUrl ||
                        item.videoUrl
                      ) && (
                        <div className="w-[1px] h-3.5 bg-zinc-800 mx-1 shrink-0" />
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(item.id);
                        }}
                        className="h-8 px-2.5 hover:bg-red-500/10 hover:text-red-300 text-red-400/90 rounded-full flex items-center space-x-1.5 transition-all active:scale-95 text-xs font-semibold"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>删除</span>
                      </button>
                    </>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        )}
      </motion.div>
    );
  },
);
