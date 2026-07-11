import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  ChevronLeft,
  ChevronRight,
  Share2,
  Maximize2,
  Palette,
  Layers,
  FileText,
  Target,
  Quote,
  ClipboardList,
  PenTool,
  Code,
  Wand2,
  TableProperties,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { HistoryItem, SmartImageConfig, SmartVideoConfig } from "../types";
import { getThumbnailUrl } from "../services/utils";
import { generatePPT, generatePDF, generateExcel, parseDocumentContent } from "../lib/documentGenerator";
import {
  getHistoryItemClassification,
  getActualCanvasCardSizeAndPort,
  getSemiAutoBorderStyles,
  getSemiAutoActiveStyles,
  safeParseParentIds,
} from "./workflow-utils";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { WebSandbox } from "./os/WebSandbox";
import { GenerativeUI } from "./os/GenerativeUI";
import { PLUGINS } from "../plugin";
import { CameraControl } from "./CameraControl";
import { PointAndShootEditor } from "./PointAndShootEditor";
import { PerspectiveSim } from "./PerspectiveSim";
import { PanoramaCreationModal } from "./PanoramaCreationModal";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HistoryCardProps {
  item: HistoryItem;
  onDragStart: () => void;
  onDragEnd: (offset: { x: number; y: number }) => void;
  onDragMove?: (offset: { x: number; y: number }) => void;
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
  onCardContextMenu?: (e: React.MouseEvent, item: HistoryItem) => void;
}

const extractGenerativeUiCode = (text: string): string | null => {
  if (!text) return null;
  const marker = "Please use the following code as reference:";
  const index = text.indexOf(marker);
  if (index !== -1) {
    return text.substring(index + marker.length).trim();
  }
  // Try fallback in case of direct code or markdown wrappers
  if (text.includes("```jsx") || text.includes("```tsx") || text.includes("```javascript") || text.includes("```js")) {
    const match = text.match(/```(?:jsx|tsx|javascript|js)?([\s\S]*?)```/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  // If it doesn't contain [Generative UI Plugin] but looks like javascript/react code
  if (text.includes("useState") && text.includes("React")) {
    return text;
  }
  return null;
};

export const HistoryCard = React.memo(
  ({
    item,
    onDragStart,
    onDragEnd,
    onDragMove,
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
    onCardContextMenu,
  }: HistoryCardProps) => {
    const [naturalAspectRatio, setNaturalAspectRatio] = useState<number | null>(item.naturalAspectRatio || null);
    const [isDraggingThisCard, setIsDraggingThisCard] = useState(false);
    const [localPos, setLocalPos] = useState({ x: item.position?.x || 0, y: item.position?.y || 0 });
    const [localText, setLocalText] = useState(item.revisedPrompt || "");
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [pptViewMode, setPptViewMode] = useState<"slides" | "outline">("slides");
    const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
    const [excelActiveSheet, setExcelActiveSheet] = useState(0);
    const [excelSearch, setExcelSearch] = useState("");
    const [excelViewMode, setExcelViewMode] = useState<"sheets" | "outline">("sheets");
    const [isPPTExcelMaximized, setIsPPTExcelMaximized] = useState(false);

    const isPPT = item.config?.skillId === "office-pitch-deck" || 
                  (item.revisedPrompt && (
                    item.revisedPrompt.includes("【幻灯片") || 
                    item.revisedPrompt.includes("# 幻灯片") || 
                    item.revisedPrompt.includes("Slide") ||
                    item.revisedPrompt.includes("逐字稿") ||
                    item.revisedPrompt.includes("Speaker Notes")
                  ));

    const isExcel = item.config?.skillId === "office-excel-report" || 
                    (item.revisedPrompt && (
                      item.revisedPrompt.includes("【工作表") || 
                      item.revisedPrompt.includes("|---") || 
                      item.revisedPrompt.includes("| Column") ||
                      /\|\s*:?-+:?\s*\|/.test(item.revisedPrompt)
                    ));

    const isInlineConsoleActive = isSelected && !item.config?.isPipelineNode && (
      (item.status === "draft_new" && (item.type === "image" || item.type === "video")) ||
      (item.type === "gen_script" && (!item.revisedPrompt || item.revisedPrompt.trim() === ""))
    );

    useEffect(() => {
      setLocalText(item.revisedPrompt || "");
    }, [item.revisedPrompt]);
    const hasAssetResult = item.status === "success" || !!item.imageUrl || !!item.videoUrl || item.type === "gen_script" || item.type === "audio" || item.type === "code" || item.type === "ui";
    const hasActiveParent = safeParseParentIds(item.parentId).length > 0;

    useEffect(() => {
      if (item.naturalAspectRatio) {
        setNaturalAspectRatio(item.naturalAspectRatio);
      }
    }, [item.naturalAspectRatio]);
    
    const dragStartPos = useRef({ pointerX: 0, pointerY: 0, cardX: 0, cardY: 0 });
    const lastParentPos = useRef({ x: item.position?.x || 0, y: item.position?.y || 0 });

    useEffect(() => {
      if (isDraggingThisCard) return;
      if (item.position?.x !== lastParentPos.current.x || item.position?.y !== lastParentPos.current.y) {
        lastParentPos.current = { x: item.position?.x || 0, y: item.position?.y || 0 };
        setLocalPos({ x: item.position?.x || 0, y: item.position?.y || 0 });
      }
    }, [item.position?.x, item.position?.y, isDraggingThisCard]);

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

      setIsDraggingThisCard(true);
      dragStartPos.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        cardX: item.position?.x || 0,
        cardY: item.position?.y || 0,
      };

      onDragStart();
    };

    useEffect(() => {
      if (!isDraggingThisCard) return;

      // Smooth cursor feedback across iframe boundaries and viewport
      const originalBodyCursor = document.body.style.cursor;
      const originalUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      const handleGlobalPointerMove = (e: PointerEvent) => {
        const dx = e.clientX - dragStartPos.current.pointerX;
        const dy = e.clientY - dragStartPos.current.pointerY;

        const localDx = dx / canvasScale;
        const localDy = dy / canvasScale;

        const absoluteX = dragStartPos.current.cardX + localDx;
        const absoluteY = dragStartPos.current.cardY + localDy;

        setLocalPos({
          x: absoluteX,
          y: absoluteY,
        });

        if (onDragMove) {
          onDragMove({ x: absoluteX, y: absoluteY });
        }
      };

      const handleGlobalPointerUp = (e: PointerEvent) => {
        setIsDraggingThisCard(false);

        const dx = e.clientX - dragStartPos.current.pointerX;
        const dy = e.clientY - dragStartPos.current.pointerY;
        const localDx = dx / canvasScale;
        const localDy = dy / canvasScale;

        const absoluteX = dragStartPos.current.cardX + localDx;
        const absoluteY = dragStartPos.current.cardY + localDy;

        onDragEnd({
          x: absoluteX,
          y: absoluteY,
        });
      };

      window.addEventListener("pointermove", handleGlobalPointerMove);
      window.addEventListener("pointerup", handleGlobalPointerUp);
      return () => {
        document.body.style.cursor = originalBodyCursor;
        document.body.style.userSelect = originalUserSelect;
        window.removeEventListener("pointermove", handleGlobalPointerMove);
        window.removeEventListener("pointerup", handleGlobalPointerUp);
      };
    }, [isDraggingThisCard, canvasScale, onDragEnd, onDragMove]);

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
    const [isRetrying, setIsRetrying] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const [pluginMode, setPluginMode] = useState<"info" | "run" | "code">("info");
    const [sandboxKey, setSandboxKey] = useState(0);
    const [showFullscreenSandbox, setShowFullscreenSandbox] = useState(false);

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
      const status = (item as any).status;
      if (status === "running" || status === "pipeline_completed" || status === "success" || status === "failed" || status === "error") {
        setIsRetrying(false);
      }
    }, [(item as any).status]);

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

    if ((item as any).status === "pipeline_pending" || (item as any).status === "pending" || (item as any).status === "running" || (item as any).status === "pipeline_completed" || (item.config as any)?.isPipelineNode && ((item as any).status === "error" || (item as any).status === "failed")) {
      const isRunning = (item as any).status === "running" || isRetrying;
      const isFailed = ((item as any).status === "error" || (item as any).status === "failed") && !isRetrying;
      const isCompleted = (item as any).status === "pipeline_completed" && !isRetrying;
      const isPending = (item as any).status === "pipeline_pending" || (item as any).status === "pending";
      const nodeType = item.type; // 'image' | 'video' | 'gen_script' | 'audio'
      const title = item.config?.title || "意图执行节点";
      const prompt = item.config?.prompt || "";
      const aspectRatio = item.config?.aspectRatio || "1:1";
      const duration = item.config?.duration || "5";

      if (isPending) {
        return (
          <motion.div
            onPointerDown={handlePointerDown}
            initial={false}
            animate={{
              x: localPos.x,
              y: localPos.y,
              opacity: 1,
              scale: isDraggingThisCard ? 1.02 : 1,
            }}
            whileHover={{ scale: isDragDisabled ? 1 : 1.01, zIndex: 100 }}
            className={cn(
              "absolute w-[360px] h-[340px] group bg-zinc-900/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border-2 will-change-transform history-card-drag-area transition-[border-color,box-shadow,background-color] duration-200 touch-none flex flex-col justify-between",
              isCompleted ? "border-emerald-500/50 hover:border-emerald-400" : "border-dashed",
              !isCompleted && (
                nodeType === "video" 
                  ? "border-purple-500/60 hover:border-purple-400 hover:bg-zinc-900/100" 
                  : nodeType === "image" 
                    ? "border-indigo-500/60 hover:border-indigo-400 hover:bg-zinc-900/100" 
                    : "border-teal-500/60 hover:border-teal-400 hover:bg-zinc-900/100"
              ),
              isMultiSelected || isSelected
                ? "border-rose-500 ring-4 ring-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.3)]"
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

            {/* Placeholder Card Main Body */}
            <div className="flex flex-col h-full space-y-3 justify-between">
              {/* Header: Badge & Delete Button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isCompleted
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      : (nodeType === "video" 
                        ? "bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" 
                        : nodeType === "image" 
                          ? "bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" 
                          : "bg-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.8)]")
                  )} />
                  <span className={cn(
                    "text-[11px] font-bold uppercase tracking-widest font-mono",
                    isCompleted
                      ? "text-emerald-300"
                      : (nodeType === "video"
                        ? "text-purple-300"
                        : nodeType === "image"
                          ? "text-indigo-300"
                          : "text-teal-300")
                  )}>
                    {isCompleted 
                      ? "✅ 需求蓝图 (已完成)" 
                      : (nodeType === "video" ? "🎬 视频合成占位" : nodeType === "image" ? "🎨 原画生图占位" : "🧠 策划脚本占位")}
                  </span>
                </div>
                
                {!isRunning && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded-full transition-all cursor-pointer"
                    title="删除占位节点"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Dotted Center Illustration for blueprint slot */}
              <div className="flex-1 flex flex-col items-center justify-center space-y-3 py-2">
                <div className={cn(
                  "w-14 h-14 rounded-2xl border flex items-center justify-center transition-transform duration-300 group-hover:scale-105",
                  isCompleted
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                    : (nodeType === "video" 
                      ? "border-purple-500/50 bg-purple-500/10 text-purple-300" 
                      : nodeType === "image" 
                        ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300" 
                        : "border-teal-500/50 bg-teal-500/10 text-teal-300")
                )}>
                  {nodeType === "video" && <Film className="w-7 h-7" />}
                  {nodeType === "image" && <ImageIcon className="w-7 h-7" />}
                  {nodeType !== "video" && nodeType !== "image" && <FileText className="w-7 h-7" />}
                </div>

                <div className="text-center flex flex-col space-y-1">
                  <span className="text-[14px] font-bold text-zinc-100 tracking-wide">{title}</span>
                  <span className={cn(
                    "text-[11px] font-medium px-2",
                    isCompleted ? "text-emerald-400 font-semibold" : "text-zinc-300"
                  )}>
                    {isCompleted 
                      ? "✅ 策划方案及渲染生成任务已圆满完成！"
                      : (nodeType === "video" ? "⏳ 等待生图原画就绪后开启合成..." : nodeType === "image" ? "⏳ 等待分镜脚本确立后开启渲染..." : "⏳ 等待品牌创意策略确立中...")
                    }
                  </span>
                </div>
              </div>

              {/* Collapsed view of prompt */}
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 max-h-[80px] overflow-hidden flex flex-col space-y-1">
                <span className="text-[9px] font-bold text-zinc-400 font-mono uppercase tracking-wider">设计蓝图 (Prompt Blueprint)</span>
                <p className="text-[11px] text-zinc-200 leading-relaxed font-medium line-clamp-2">
                  "{prompt || "无描述词蓝图"}"
                </p>
              </div>

              {isCompleted ? (
                <div className="text-center text-[10px] text-emerald-400 font-bold py-1.5 border-t border-zinc-800 bg-emerald-950/20 rounded-b-xl">
                  🟢 需求蓝图及多模态渲染已圆满完成
                </div>
              ) : (
                <div className="text-center text-[10px] text-zinc-300 font-bold py-1.5 border-t border-zinc-800 bg-zinc-950/40 rounded-b-xl">
                  ⚔️ 已部署至作战沙盘，等待系统正式启动...
                </div>
              )}
            </div>
          </motion.div>
        );
      }

      return (
        <motion.div
          onPointerDown={handlePointerDown}
          initial={false}
          animate={{
            x: localPos.x,
            y: localPos.y,
            opacity: 1,
            scale: isDraggingThisCard ? 1.02 : 1,
          }}
          whileHover={{ scale: isDragDisabled ? 1 : 1.01, zIndex: 100 }}
          className={cn(
            "absolute w-[360px] h-[340px] group bg-zinc-950/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border-2 will-change-transform history-card-drag-area transition-[border-color,box-shadow,background-color] duration-200 touch-none flex flex-col justify-between",
            isRunning 
              ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] animate-pulse" 
              : isFailed
                ? "border-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                : isCompleted
                  ? "border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.15)] bg-zinc-950/98"
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
                      : isCompleted
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                        : nodeType === "video" 
                          ? "bg-purple-500" 
                          : nodeType === "image" 
                            ? "bg-indigo-500" 
                            : "bg-teal-500"
                )} />
                <span className={cn(
                  "text-[11px] font-black uppercase tracking-widest font-mono",
                  isCompleted ? "text-emerald-400" : "text-zinc-400"
                )}>
                  {nodeType === "video" ? "🎬 视频合成节点" : nodeType === "image" ? "🎨 原画生图节点" : "🧠 策划脚本节点"}
                  {isCompleted && " (已完成)"}
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
                  <span className="text-[10px] text-rose-400 font-bold max-w-[200px] truncate">
                    {typeof item.error === "object" ? (item.error?.message || JSON.stringify(item.error)) : String(item.error || "执行出错")}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRetrying(true);
                      // Trigger retry custom event with current edit state
                      window.dispatchEvent(new CustomEvent('retry-pipeline-step', { 
                        detail: { 
                          stepId: item.id,
                          pipelineId: (item.config as any)?.pipelineId,
                          prompt: prompt,
                          aspectRatio: aspectRatio,
                          duration: duration
                        } 
                      }));
                    }}
                    className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-700 active:scale-95 transition-all cursor-pointer"
                  >
                    重新执行
                  </button>
                </div>
              )}

              {isCompleted && (
                <div className="flex items-center justify-between py-1 px-2 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-400 font-bold">🟢 模块执行圆满完成</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRetrying(true);
                      // Trigger retry custom event with current edit state
                      window.dispatchEvent(new CustomEvent('retry-pipeline-step', { 
                        detail: { 
                          stepId: item.id,
                          pipelineId: (item.config as any)?.pipelineId,
                          prompt: prompt,
                          aspectRatio: aspectRatio,
                          duration: duration
                        } 
                      }));
                    }}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold active:scale-95 transition-all cursor-pointer"
                  >
                    重新执行
                  </button>
                </div>
              )}

              {!isRunning && !isFailed && !isCompleted && (
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
      // Choose icon and label based on item type
      let cardIcon = <Sparkles className="w-5 h-5 text-indigo-400" />;
      let cardTitle = "文本意图";
      let cardDesc = "一键唤醒小逻生成文本";
      let cardTag = "Text Node";
      let tagBg = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      let centralDetail = "✍️ 键入创意指令，编译剧本文案";

      if (item.type === "image") {
        cardIcon = <ImageIcon className="w-5 h-5 text-teal-400" />;
        cardTitle = "画面意图";
        cardDesc = "一键唤醒小逻生图";
        cardTag = "Image Node";
        tagBg = "bg-teal-500/10 text-teal-400 border-teal-500/20";
        centralDetail = "🎨 描述画面构图，绘制精美艺术";
      } else if (item.type === "video") {
        cardIcon = <Film className="w-5 h-5 text-purple-400" />;
        cardTitle = "镜头意图";
        cardDesc = "一键唤醒小逻生视频";
        cardTag = "Video Node";
        tagBg = "bg-purple-500/10 text-purple-400 border-purple-500/20";
        centralDetail = "🎬 规划运镜构想，渲染震撼视频";
      } else if (item.type === "code" || item.type === "ui") {
        cardIcon = <Code className="w-5 h-5 text-blue-400" />;
        cardTitle = "运行沙盒";
        cardDesc = "智能编译动态 UI 组件";
        cardTag = "Component Node";
        tagBg = "bg-blue-500/10 text-blue-400 border-blue-500/20";
        centralDetail = "⚡ 实时渲染高保真、交互式前端沙盒";
      }

      return (
        <motion.div
          onPointerDown={handlePointerDown}
          initial={false}
          animate={{
            x: localPos.x,
            y: localPos.y,
            opacity: 1,
            scale: isDraggingThisCard ? 1.02 : 1,
          }}
          whileHover={{ scale: isDragDisabled ? 1 : 1.01, zIndex: 50 }}
          className={cn(
            "absolute group bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl transition-[border-color,box-shadow,background-color] duration-200 flex flex-col justify-between touch-none overflow-hidden history-card-drag-area",
            layoutMode === "semi_auto"
              ? getSemiAutoBorderStyles(item)
              : "hover:border-zinc-700 hover:shadow-2xl hover:shadow-black/60",
            isMultiSelected || isSelected || dockedItemId === item.id
              ? layoutMode === "semi_auto"
                ? getSemiAutoActiveStyles(item)
                : "border-indigo-500/80 ring-4 ring-indigo-500/10 shadow-2xl shadow-indigo-500/10"
              : ""
          )}
          style={{ 
            cursor: isDragDisabled ? "default" : "grab",
            width: `${spec.width}px`,
            height: `${spec.height}px`
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelect) onSelect(item.id);
          }}
          onContextMenu={(e) => {
            if (onCardContextMenu) {
              onCardContextMenu(e, item);
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
          {layoutMode !== "bento" && layoutMode !== "semi_auto" && (
            <div
              className={cn(
                "absolute left-0 -translate-x-[15px] -translate-y-1/2 z-[50] flex items-center justify-center pointer-events-none transition-all duration-300",
                dockedItemId === item.id ? "scale-140" : "scale-100"
              )}
              style={{ top: `${spec.height / 2}px` }}
            >
              <div className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-full border border-zinc-800 bg-zinc-950 transition-all duration-300",
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
                "absolute right-0 translate-x-[15px] -translate-y-1/2 z-[50] flex items-center justify-center pointer-events-none transition-all duration-300",
                dockedItemId === item.id ? "scale-140" : "scale-100"
              )}
              style={{ top: `${spec.height / 2}px` }}
            >
              <div className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-full border border-zinc-800 bg-zinc-950 transition-all duration-300",
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
            {/* Header section */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-zinc-950/60 rounded-lg border border-zinc-800/40 flex items-center justify-center">
                  {cardIcon}
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-100 font-bold text-xs leading-tight tracking-wide">{cardTitle}</span>
                  <span className="text-zinc-400 text-[10px] scale-90 origin-left mt-0.5">{cardDesc}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={cn("text-[9px] px-2 py-0.5 rounded-full border font-mono font-medium tracking-wide shadow-sm scale-90", tagBg)}>
                  {cardTag}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  className="p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 rounded-full transition-all cursor-pointer active:scale-95"
                  title="删除占位卡片"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Central High-Contrast Minimalist Guiding Section */}
            <div className="flex-1 flex flex-col items-center justify-center py-4 text-center space-y-3">
              <div className="p-4 bg-zinc-950/40 rounded-2xl border border-zinc-800/50 flex items-center justify-center">
                {item.type === "gen_script" ? (
                  <span className="text-3xl filter drop-shadow-md">✍️</span>
                ) : item.type === "image" ? (
                  <span className="text-3xl filter drop-shadow-md">🎨</span>
                ) : (
                  <span className="text-3xl filter drop-shadow-md">🎬</span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[12px] text-zinc-200 font-medium tracking-wide">
                  {centralDetail}
                </p>
                <p className="text-[10px] text-zinc-400 scale-95">
                  {isSelected ? "👉 请在下方控制面板直接输入生成指令" : "💡 点击卡片可唤醒小逻指令编译面板"}
                </p>
              </div>
            </div>

            {/* Card Footer Status */}
            <div className="pt-2 border-t border-zinc-800/40 flex items-center justify-between text-[10px]">
              <span className="text-zinc-400 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-medium">等待激活意图</span>
              </span>
              <span className="text-zinc-500 font-mono text-[9px]">ID: {item.id.slice(0, 8)}</span>
            </div>
          </div>
        </motion.div>
      );
    }

    if (item.type === "audio") {
      return (
        <motion.div
          onPointerDown={handlePointerDown}
          initial={false}
          animate={{
            x: localPos.x,
            y: localPos.y,
            opacity: 1,
            scale: isDraggingThisCard ? 1.02 : 1,
          }}
          whileHover={{ scale: isDragDisabled ? 1 : 1.01, zIndex: 100 }}
          className={cn(
            "absolute w-[360px] h-[270px] group bg-white rounded-2xl p-6 shadow-2xl border-2 will-change-transform history-card-drag-area transition-[border-color,box-shadow,background-color] duration-200 touch-none",
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

          <div className="relative w-full bg-zinc-950 border border-zinc-800/80 rounded-2xl p-5 shadow-inner flex flex-col space-y-4">
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
        initial={false}
        animate={{
          x: localPos.x,
          y: localPos.y,
          opacity: 1,
          scale: isDraggingThisCard ? 1.02 : 1,
        }}
        whileHover={{ scale: isDragDisabled ? 1 : 1.01, zIndex: 50 }}
        className={cn(
          "absolute group rounded-2xl shadow-2xl border flex flex-col will-change-transform history-card-drag-area transition-[border-color,box-shadow,background-color] duration-200 touch-none",
          (item.type === "gen_script" && !isExcel && !isPPT) ? "bg-white" : "bg-zinc-950",
          layoutMode === "semi_auto"
            ? getSemiAutoBorderStyles(item)
            : (item.type === "gen_script" && !isExcel && !isPPT)
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
        onContextMenu={(e) => {
          if (onCardContextMenu) {
            onCardContextMenu(e, item);
          }
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

        {!item.config?.isSkillNode && !item.config?.isIntegratedModelNode && !isExcel && !isPPT && (
          <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
            <div
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/90 text-[10px] font-bold cursor-help select-none"
              title="注：生成的内容将在 10 天后自动从云端删除，建议在此期间下载保存。"
            >
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>{timeLeft}</span>
            </div>

            {(item.type as string) !== "audio" && (
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
                      {((item.type === "gen_script" ||
                        getHistoryItemClassification(item) === "script" ||
                        getHistoryItemClassification(item) === "text_asset" ||
                        getHistoryItemClassification(item) === "shot_prompt")
                        ? [
                            { key: "script", label: "剧本", icon: FileText, color: "text-amber-400 hover:bg-amber-500/10" },
                            { key: "shot_prompt", label: "分镜提示词", icon: Sparkles, color: "text-cyan-400 hover:bg-cyan-500/10" },
                            { key: "text_asset", label: "资产", icon: Layers, color: "text-emerald-400 hover:bg-emerald-500/10" },
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

        {(item.status === "loading" || item.status === "processing" || item.status === "running" || item.status === "pipeline_pending" || item.status === "pending") &&
        !(item.imageUrl || item.videoUrl || item.type === "gen_script" || ((item.type === "code" || item.type === "ui") && (item as any).code)) ? (
          <div className="w-full h-full flex-1 flex flex-col items-center justify-center bg-zinc-900/60 backdrop-blur-sm space-y-4 relative overflow-hidden rounded-2xl">
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
        ) : item.type === "gen_script" ? (() => {
          const skillId = item.config?.skillId;
          const plugin = PLUGINS.find((p) => p.id === skillId);
          const isSystemModalPlugin = !!(
            skillId && 
            (skillId === "perspective-sim" || skillId === "point-and-shoot" || skillId === "camera-control" || skillId === "panorama")
          );
          
          const isGenerativeUIPlugin = !!(
            item.config?.isSkillNode && 
            (
              (item.revisedPrompt && item.revisedPrompt.includes("[Generative UI Plugin:")) ||
              (plugin && plugin.instruction && plugin.instruction.includes("[Generative UI Plugin:")) ||
              (skillId && (skillId.startsWith("custom_") || skillId === "贪吃蛇" || isSystemModalPlugin))
            )
          );

          // Force system modal plugins to always be displayed in "info" mode within the history card layout
          const activeMode = isSystemModalPlugin ? "info" : pluginMode;

          const pluginCode = extractGenerativeUiCode(item.revisedPrompt || (plugin?.instruction || ""));

          if (isGenerativeUIPlugin) {
            return (
              <div className="relative aspect-[3/4] sm:aspect-square overflow-hidden bg-white cursor-pointer group/script rounded-2xl flex flex-col h-full border border-indigo-100 shadow-sm">
                {/* Card header */}
                <div className="px-4 py-3 bg-gradient-to-r from-indigo-50/50 to-purple-50/30 border-b border-indigo-50/60 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <span className="text-sm shrink-0">{item.config?.icon || plugin?.icon || "🧩"}</span>
                    <span className="text-[12px] font-bold text-slate-800 truncate">
                      {item.config?.title || plugin?.name || "工作流插件"}
                    </span>
                  </div>
                  
                  {/* View options hidden for clean canvas presentation */}
                </div>

                {/* Card body content */}
                <div className="flex-1 overflow-hidden relative bg-slate-50/40 p-4">
                  {activeMode === "info" && (
                    <div className="w-full h-full flex flex-col justify-between items-center text-center p-2">
                      <div className="my-auto flex flex-col items-center">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-indigo-100/50 mb-3 animate-pulse">
                          {item.config?.icon || plugin?.icon || "🧩"}
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-800 tracking-wide mb-1">
                          {item.config?.title || plugin?.name || "未知插件"}
                        </h4>
                        {skillId === "camera-control" && item.config?.cameraParams ? (
                          <div className="mt-1 w-full text-left bg-slate-100/60 dark:bg-zinc-900/60 p-2 rounded-xl border border-slate-200/50 dark:border-zinc-800 font-sans text-[10px] text-slate-600 dark:text-zinc-300 space-y-1">
                            <div className="flex justify-between border-b border-slate-200/30 dark:border-zinc-800/30 pb-0.5">
                              <span className="font-semibold text-slate-400 dark:text-zinc-500">📷 机型:</span>
                              <span className="font-medium truncate max-w-[130px] text-slate-700 dark:text-zinc-200">{item.config.cameraParams.model}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200/30 dark:border-zinc-800/30 pb-0.5">
                              <span className="font-semibold text-slate-400 dark:text-zinc-500">🔍 镜头:</span>
                              <span className="font-medium truncate max-w-[130px] text-slate-700 dark:text-zinc-200">{item.config.cameraParams.lensType}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200/30 dark:border-zinc-800/30 pb-0.5">
                              <span className="font-semibold text-slate-400 dark:text-zinc-500">📏 焦段:</span>
                              <span className="font-medium truncate max-w-[130px] text-slate-700 dark:text-zinc-200">{item.config.cameraParams.focalLength}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200/30 dark:border-zinc-800/30 pb-0.5">
                              <span className="font-semibold text-slate-400 dark:text-zinc-500">🔆 光圈:</span>
                              <span className="font-medium truncate max-w-[130px] text-slate-700 dark:text-zinc-200">{item.config.cameraParams.aperture}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold text-slate-400 dark:text-zinc-500">🎨 影调:</span>
                              <span className="font-medium truncate max-w-[130px] text-slate-700 dark:text-zinc-200">{item.config.cameraParams.colorTone}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 max-w-[240px] leading-relaxed line-clamp-3">
                            {plugin?.desc || "点击“直接运行”可以在画布中直接体验并交互此插件。"}
                          </p>
                        )}
                      </div>

                      <div className="w-full mt-auto shrink-0 flex justify-center pb-1" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            if (isSystemModalPlugin) {
                              onApplyMode?.(skillId, item);
                            } else {
                              setShowFullscreenSandbox(true);
                              setSandboxKey(prev => prev + 1);
                            }
                          }}
                          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-[11px] transition-all active:scale-95 shadow-sm hover:shadow-md flex items-center justify-center space-x-1.5 mx-auto"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>打开{item.config?.title || plugin?.name || "插件"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeMode === "run" && (
                    <div className="w-full h-full flex flex-col" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                      {pluginCode ? (
                        <div className="flex-1 relative rounded-xl overflow-hidden border border-slate-100 shadow-inner bg-white h-full">
                          <WebSandbox 
                            key={sandboxKey} 
                            code={pluginCode} 
                            className="w-full h-full border-none" 
                          />
                        </div>
                      ) : isSystemModalPlugin ? (
                        <div className="flex-1 w-full h-full relative absolute inset-0 bg-slate-950">
                          {skillId === "camera-control" && (
                            <CameraControl
                              isEmbedded={true}
                              initialParams={item.config?.cameraParams}
                              onClose={() => setPluginMode("info")}
                              onConfirm={(params) => {
                                setHistory?.((prev) => prev.map((h) => {
                                  if (h.id === item.id) {
                                    const parts = [
                                      `Camera: ${params.model}`,
                                      params.lensType !== "无特定镜头" ? `Lens: ${params.lensType}` : "",
                                      params.focalLength !== "自动" ? `Focal: ${params.focalLength}` : "",
                                      params.aperture !== "自动" ? `Aperture: ${params.aperture}` : "",
                                      params.colorTone !== "默认" ? `Tone: ${params.colorTone}` : "",
                                      params.lighting !== "默认" ? `Lighting: ${params.lighting}` : "",
                                      params.lightingType !== "默认" ? `LightType: ${params.lightingType}` : "",
                                    ].filter(Boolean);
                                    const cameraDesc = `${parts.join(", ")}.`;
                                    const basePrompt = h.config?.prompt || h.revisedPrompt || "";
                                    // If basePrompt contains the boilerplate instructions, discard it and use only cameraDesc.
                                    // Otherwise, we can still use cameraDesc as the absolute source of truth.
                                    const newPrompt = cameraDesc;
                                    return {
                                      ...h,
                                      revisedPrompt: newPrompt,
                                      config: {
                                        ...h.config,
                                        prompt: newPrompt,
                                        cameraParams: params
                                      }
                                    };
                                  }
                                  return h;
                                }));
                              }}
                            />
                          )}
                          {(() => {
                            const parentIds = safeParseParentIds(item.parentId);
                            const parentItem = parentIds.length > 0 && history ? history.find(h => parentIds.includes(h.id) && (h.imageUrl || h.config?.referenceImages?.[0]?.data)) : null;
                            const resolvedInitialImage = item.imageUrl || item.config?.referenceImages?.[0]?.data || (parentItem ? (parentItem.imageUrl || parentItem.config?.referenceImages?.[0]?.data) : null);
                            const resolvedParentRefs = item.config?.referenceImages || (parentItem ? (parentItem.config?.referenceImages || (parentItem.imageUrl ? [{ id: parentItem.id, data: parentItem.imageUrl, mimeType: "image/png", type: "general" }] : [])) : []);

                            return (
                              <>
                                {skillId === "point-and-shoot" && (
                                  <PointAndShootEditor
                                    isOpen={true}
                                    isEmbedded={true}
                                    initialImage={resolvedInitialImage}
                                    onClose={() => setPluginMode("info")}
                                    onSave={(markedData) => {
                                      setHistory?.((prev) => prev.map((h) => {
                                        if (h.id === item.id) {
                                          return {
                                            ...h,
                                            imageUrl: markedData,
                                            config: {
                                              ...h.config,
                                              markedImage: markedData,
                                              referenceImages: [
                                                {
                                                  id: "marked-scene-" + Date.now(),
                                                  data: markedData,
                                                  mimeType: "image/png",
                                                  type: "environment",
                                                }
                                              ]
                                            }
                                          };
                                        }
                                        return h;
                                      }));
                                    }}
                                  />
                                )}
                                {skillId === "perspective-sim" && (
                                  <PerspectiveSim
                                    isEmbedded={true}
                                    initialImage={resolvedInitialImage}
                                    onClose={() => setPluginMode("info")}
                                    onGenerate={(params) => {
                                      setHistory?.((prev) => prev.map((h) => {
                                        if (h.id === item.id) {
                                          return {
                                            ...h,
                                            revisedPrompt: params.prompt,
                                            config: {
                                              ...h.config,
                                              prompt: params.prompt,
                                              perspectiveParams: params
                                            }
                                          };
                                        }
                                        return h;
                                      }));
                                    }}
                                  />
                                )}
                                {skillId === "panorama" && (
                                  <PanoramaCreationModal
                                    isOpen={true}
                                    isEmbedded={true}
                                    initialPrompt={item.config?.prompt || item.revisedPrompt}
                                    initialReferenceImages={resolvedParentRefs}
                                    onClose={() => setPluginMode("info")}
                                    onGenerate={async (p, refs, neg) => {
                                      if (generateImage) {
                                        const res = await generateImage({
                                          prompt: p,
                                          negativePrompt: neg || item.config?.negativePrompt,
                                          gridMode: "panorama",
                                          aspectRatio: "2:1",
                                          imageSize: "4K",
                                          referenceImages: refs && refs.length > 0 ? refs : resolvedParentRefs,
                                        }, item.position, item.id);
                                        
                                        if (res && res.imageUrl) {
                                          setHistory?.((prev) => prev.map((h) => {
                                            if (h.id === item.id) {
                                              return {
                                                ...h,
                                                imageUrl: res.imageUrl,
                                                revisedPrompt: p,
                                                config: {
                                                  ...h.config,
                                                  prompt: p,
                                                  negativePrompt: neg,
                                                  referenceImages: refs
                                                }
                                              };
                                            }
                                            return h;
                                          }));
                                          return res.imageUrl;
                                        }
                                        return null;
                                      }
                                      return null;
                                    }}
                                  />
                                )}
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                          <AlertCircle className="w-6 h-6 text-amber-500 mb-1" />
                          <p className="text-[10px] text-slate-600 font-semibold">未检测到有效的可运行代码</p>
                        </div>
                      )}
                      
                      {/* Runner footer */}
                      {!isSystemModalPlugin && (
                        <div className="flex items-center justify-between pt-1 px-1 shrink-0">
                          <button
                            onClick={() => setSandboxKey(prev => prev + 1)}
                            className="p-1 text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center space-x-0.5 transition-all"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>重试</span>
                          </button>
                          <button
                            onClick={() => setShowFullscreenSandbox(true)}
                            className="p-1 text-[9px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg flex items-center space-x-0.5 transition-all"
                          >
                            <Maximize2 className="w-2.5 h-2.5" />
                            <span>全屏</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeMode === "code" && (
                    <div className="w-full h-full flex flex-col relative" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                      <div className="flex-1 overflow-hidden relative">
                        <div className="absolute inset-0">
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
                            className="w-full h-full p-2 bg-white rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 font-mono text-[9px] leading-relaxed text-slate-700 resize-none outline-none transition-all no-drag custom-scrollbar"
                            placeholder="在此处直接输入或编辑代码..."
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-1 shrink-0">
                        <button
                          onClick={() => setPluginMode("info")}
                          className="px-2 py-0.5 text-[9px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-all"
                        >
                          确定
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fullscreen Modal Portal for Sandbox inside card structure */}
                {showFullscreenSandbox && createPortal(
                  <div className="fixed inset-0 z-[999999] flex flex-col bg-slate-900/90 backdrop-blur-sm p-4 sm:p-6" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                    <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
                      {/* Modal header */}
                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-xl">{item.config?.icon || plugin?.icon || "🧩"}</span>
                          <div className="text-left">
                            <h3 className="text-sm font-bold text-slate-800">
                              {item.config?.title || plugin?.name || "工作流插件"}
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {plugin?.desc || "正在运行此交互式插件组件"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSandboxKey(prev => prev + 1)}
                            className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-indigo-600 transition-all flex items-center space-x-1"
                            title="重载"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span className="text-xs font-semibold pr-1">重置</span>
                          </button>
                          <button
                            onClick={() => setShowFullscreenSandbox(false)}
                            className="p-1.5 hover:bg-red-50 hover:text-red-600 text-slate-400 rounded-xl transition-all"
                            title="退出全屏"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Modal Sandbox */}
                      <div className="flex-1 bg-slate-100/50 p-4 relative">
                        {pluginCode ? (
                          <WebSandbox 
                            key={`fs-${sandboxKey}`} 
                            code={pluginCode} 
                            className="w-full h-full border-none shadow-sm rounded-xl" 
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-center">
                            <AlertCircle className="w-12 h-12 text-amber-500 mb-2" />
                            <p className="text-sm font-bold text-slate-700">未检测到有效的可运行代码</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            );
          }

          // Detect if this is a PPT slide node
          const isPPT = item.config?.skillId === "office-pitch-deck" || 
                        (item.revisedPrompt && (
                          item.revisedPrompt.includes("【幻灯片") || 
                          item.revisedPrompt.includes("# 幻灯片") || 
                          item.revisedPrompt.includes("Slide") ||
                          item.revisedPrompt.includes("逐字稿") ||
                          item.revisedPrompt.includes("Speaker Notes")
                        ));

          if (isPPT) {
            const parsed = parseDocumentContent(localText);
            const slidesCount = parsed.sections.length + 1; // Slide 0 is Cover, Slides 1..N are Sections

            // Ensure slide index is in bounds
            const activeSlideIndex = Math.min(Math.max(0, currentSlideIndex), slidesCount - 1);

            return (
              <div className="relative aspect-[3/4] sm:aspect-square overflow-hidden bg-zinc-950 cursor-pointer group/script rounded-2xl flex flex-col border border-zinc-800 shadow-xl">
                {/* PPT Top Bar */}
                <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-1.5 overflow-hidden">
                    <span className="text-sm shrink-0">📊</span>
                    <span className="text-[11px] font-black text-zinc-100 truncate max-w-[120px] sm:max-w-[150px]">
                      {parsed.title || "商业演示文稿"}
                    </span>
                  </div>

                  {/* Mode switcher tabs */}
                  <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800/80 shrink-0">
                    <button
                      onClick={() => setPptViewMode("slides")}
                      className={cn(
                        "px-2 py-1 rounded text-[9px] font-extrabold transition-all",
                        pptViewMode === "slides"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      放映
                    </button>
                    <button
                      onClick={() => setPptViewMode("outline")}
                      className={cn(
                        "px-2 py-1 rounded text-[9px] font-extrabold transition-all",
                        pptViewMode === "outline"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      编辑大纲
                    </button>
                  </div>

                  {/* Export Trigger */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await generatePPT(localText, `pptx-${item.id}`);
                        } catch (err) {
                          console.error("PPT generation failed", err);
                        }
                      }}
                      className="p-1.5 bg-zinc-950 hover:bg-indigo-900/60 hover:text-indigo-300 text-zinc-400 rounded-lg border border-zinc-800 transition-all flex items-center space-x-1 cursor-pointer"
                      title="下载 PPT 文件"
                    >
                      <Download className="w-3 h-3 text-indigo-400" />
                      <span className="hidden sm:inline text-[9px] font-bold">下载</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPPTExcelMaximized(true);
                      }}
                      className="p-1.5 bg-zinc-950 hover:bg-indigo-900/60 hover:text-indigo-300 text-zinc-400 rounded-lg border border-zinc-800 transition-all flex items-center space-x-1 cursor-pointer"
                      title="全屏放大"
                    >
                      <Maximize2 className="w-3 h-3 text-indigo-400" />
                      <span className="hidden sm:inline text-[9px] font-bold">放大</span>
                    </button>
                  </div>
                </div>

                {/* PPT Content Card Area */}
                <div className="flex-1 overflow-hidden relative flex flex-col bg-zinc-950 p-3">
                  {pptViewMode === "outline" ? (
                    // Outline / Text Editor Mode
                    <div className="w-full h-full relative" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
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
                        onKeyDown={(e) => e.stopPropagation()}
                        className="w-full h-full p-3 bg-zinc-900 rounded-xl border border-zinc-800 focus:border-indigo-500 font-mono text-[10px] sm:text-[11px] leading-relaxed text-zinc-300 resize-none outline-none transition-all no-drag custom-scrollbar"
                        placeholder="在此处直接输入或编辑 PPT 内容大纲..."
                      />
                    </div>
                  ) : (
                    // Interactive Slide Preview Mode
                    <div className="flex-1 flex flex-col relative overflow-hidden bg-zinc-900 rounded-xl border border-zinc-800/60 shadow-inner">
                      {activeSlideIndex === 0 ? (
                        // Cover Slide Render
                        <div className="flex-1 flex flex-col justify-center p-6 text-left relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-950 to-indigo-900">
                          {/* Grid background pattern */}
                          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e1b4b_1px,transparent_1px),linear-gradient(to_bottom,#1e1b4b_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />
                          
                          <div className="relative z-10 space-y-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black text-indigo-400 tracking-wider uppercase">
                              意图操作系统 • 商业中心
                            </span>
                            
                            <h2 className="text-sm sm:text-lg font-black text-white leading-tight tracking-tight drop-shadow-md">
                              {parsed.title || "商业演示策划案"}
                            </h2>
                            
                            <div className="w-12 h-1 bg-amber-500 rounded-full" />
                            
                            <p className="text-[10px] text-zinc-400 font-medium">
                              演示文稿一键编译 • 由小逻智脑协助创作
                            </p>
                          </div>
                        </div>
                      ) : (() => {
                        // Content Slide Render
                        const sec = parsed.sections[activeSlideIndex - 1];
                        if (!sec) {
                          return (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                              <Loader2 className="w-6 h-6 text-zinc-500 animate-spin mb-1" />
                              <p className="text-xs text-zinc-400">正在生成设计中...</p>
                            </div>
                          );
                        }

                        return (
                          <div className="flex-1 flex flex-col justify-between p-4 text-left bg-zinc-900 relative">
                            {/* Slide Title */}
                            <div className="shrink-0 mb-2.5 border-b border-zinc-800 pb-1.5">
                              <h3 className="text-xs font-black text-zinc-100 flex items-center space-x-1.5">
                                <span className="text-indigo-400 font-mono">0{activeSlideIndex}</span>
                                <span className="truncate">{sec.title}</span>
                              </h3>
                            </div>

                            {/* Slide Content Body */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-2">
                              {sec.table && sec.table.headers.length > 0 ? (
                                // Table layout
                                <div className="overflow-x-auto my-1 border border-zinc-800 rounded-lg no-drag" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                                  <table className="w-full text-[9px] sm:text-[10px] text-left border-collapse">
                                    <thead>
                                      <tr className="bg-zinc-800 border-b border-zinc-800">
                                        {sec.table.headers.map((h, hIdx) => (
                                          <th key={hIdx} className="p-1.5 font-bold text-zinc-200">
                                            {h}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sec.table.rows.map((row, rIdx) => (
                                        <tr key={rIdx} className="border-b border-zinc-800/40 hover:bg-zinc-800/10">
                                          {row.map((cell, cIdx) => (
                                            <td key={cIdx} className="p-1.5 text-zinc-400">
                                              {cell}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : sec.bullets.length > 0 ? (
                                // Bullets layout
                                <ul className="space-y-1.5 text-[10px] sm:text-xs">
                                  {sec.bullets.map((bullet, bIdx) => (
                                    <li key={bIdx} className="flex items-start space-x-1.5 text-zinc-300">
                                      <span className="text-indigo-400 mt-1 shrink-0">✦</span>
                                      <span className="leading-relaxed">{bullet}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                // Plain text layout
                                <div className="space-y-1.5 text-[10px] sm:text-xs text-zinc-300 leading-relaxed">
                                  {sec.content.map((p, pIdx) => (
                                    <p key={pIdx}>{p}</p>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Optional Speaker Notes Overlay */}
                            {showSpeakerNotes && (
                              <div className="absolute inset-x-0 bottom-0 max-h-[55%] bg-zinc-950/95 border-t border-zinc-800 p-3 overflow-y-auto animate-in slide-in-from-bottom duration-150 rounded-b-xl z-20 no-drag" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-1 mb-1.5">
                                  <span className="text-[8px] font-black tracking-wider text-amber-400 uppercase">🎙️ 宣讲逐字稿 (Speaker Notes)</span>
                                  <button onClick={() => setShowSpeakerNotes(false)} className="text-[8px] text-zinc-500 hover:text-zinc-300 font-extrabold">隐藏</button>
                                </div>
                                <p className="text-[10px] leading-relaxed text-zinc-400 font-medium">
                                  {sec.content.length > 0 ? sec.content.join("\n") : "（幻灯片提纲已备好，宣讲稿正在提炼中...）"}
                                </p>
                              </div>
                            )}

                            {/* Slide footer */}
                            <div className="shrink-0 flex items-center justify-between text-[8px] font-bold text-zinc-500 pt-1.5 border-t border-zinc-800/40">
                              <span>小逻 AI 商业脑</span>
                              <span>{activeSlideIndex} / {slidesCount - 1}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Slide Interactive Controller */}
                      <div className="bg-zinc-950/90 border-t border-zinc-800 px-3 py-1.5 flex items-center justify-between shrink-0">
                        <div className="flex items-center space-x-1">
                          <button
                            disabled={activeSlideIndex === 0}
                            onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                            className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400 rounded bg-zinc-900 border border-zinc-800 transition-all cursor-pointer"
                            title="上一页"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[9px] font-black text-zinc-400 px-1.5 select-none min-w-[36px] text-center">
                            {activeSlideIndex === 0 ? "封面" : `${activeSlideIndex} / ${slidesCount - 1}`}
                          </span>
                          <button
                            disabled={activeSlideIndex === slidesCount - 1}
                            onClick={() => setCurrentSlideIndex(prev => Math.min(slidesCount - 1, prev + 1))}
                            className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400 rounded bg-zinc-900 border border-zinc-800 transition-all cursor-pointer"
                            title="下一页"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {activeSlideIndex > 0 && (
                          <button
                            onClick={() => setShowSpeakerNotes(prev => !prev)}
                            className={cn(
                              "px-2 py-1 rounded text-[8px] font-black border transition-all flex items-center space-x-1 cursor-pointer",
                              showSpeakerNotes
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                            )}
                          >
                            <span>🎙️ 逐字稿</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Fullscreen PPT Portal */}
                {isPPTExcelMaximized && createPortal(
                  <div 
                    className="fixed inset-0 z-[9999] bg-zinc-950/98 backdrop-blur-md flex flex-col p-4 md:p-8 animate-in fade-in duration-200"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Maximize Mode Top Bar */}
                    <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0 mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">📊</span>
                        <div>
                          <h3 className="text-base font-black text-zinc-100">
                            {parsed.title || "商业演示文稿"}
                          </h3>
                          <p className="text-xs text-zinc-400">正在全屏放映与设计大纲预览中</p>
                        </div>
                      </div>

                      {/* Controls inside Maximize Mode */}
                      <div className="flex items-center space-x-4">
                        {/* Mode Switcher */}
                        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 shrink-0">
                          <button
                            onClick={() => setPptViewMode("slides")}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all",
                              pptViewMode === "slides"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200"
                            )}
                          >
                            放映幻灯片
                          </button>
                          <button
                            onClick={() => setPptViewMode("outline")}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all",
                              pptViewMode === "outline"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200"
                            )}
                          >
                            编辑大纲
                          </button>
                        </div>

                        {/* Download */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await generatePPT(localText, `pptx-${item.id}`);
                            } catch (err) {
                              console.error("PPT generation failed", err);
                            }
                          }}
                          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-indigo-900/60 hover:text-indigo-300 text-zinc-400 rounded-xl border border-zinc-800 transition-all flex items-center space-x-2 cursor-pointer text-xs font-bold"
                          title="下载 PPT 文件"
                        >
                          <Download className="w-4 h-4 text-indigo-400" />
                          <span>下载文件</span>
                        </button>

                        {/* Close button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsPPTExcelMaximized(false);
                          }}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all border border-red-500/20 animate-pulse"
                          title="退出全屏"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Main content in Maximize Mode */}
                    <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden min-h-0">
                      {pptViewMode === "outline" ? (
                        <div className="flex-1 h-full relative bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
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
                            className="w-full h-full p-4 bg-transparent font-mono text-xs sm:text-sm leading-relaxed text-zinc-200 resize-none outline-none custom-scrollbar"
                            placeholder="在此处直接输入或编辑 PPT 内容大纲..."
                          />
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col h-full bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden relative shadow-2xl">
                          {activeSlideIndex === 0 ? (
                            // Cover slide maximized view
                            <div className="flex-1 flex flex-col justify-center p-12 text-left relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-950 to-indigo-900">
                              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e1b4b_1px,transparent_1px),linear-gradient(to_bottom,#1e1b4b_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />
                              <div className="relative z-10 space-y-6 max-w-3xl mx-auto w-full">
                                <span className="inline-flex items-center px-3.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-xs font-black text-indigo-400 tracking-wider uppercase">
                                  意图操作系统 • 商业中心
                                </span>
                                <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight drop-shadow-md">
                                  {parsed.title || "商业演示策划案"}
                                </h2>
                                <div className="w-20 h-1.5 bg-amber-500 rounded-full" />
                                <p className="text-sm sm:text-base text-zinc-400 font-medium">
                                  演示文稿一键编译 • 由小逻智脑协助创作
                                </p>
                              </div>
                            </div>
                          ) : (() => {
                            // Content slide maximized view
                            const sec = parsed.sections[activeSlideIndex - 1];
                            if (!sec) {
                              return (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                  <Loader2 className="w-8 h-8 text-zinc-500 animate-spin mb-2" />
                                  <p className="text-sm text-zinc-400">正在生成设计中...</p>
                                </div>
                              );
                            }

                            return (
                              <div className="flex-1 flex flex-col justify-between p-8 sm:p-12 text-left bg-zinc-900 relative animate-in fade-in zoom-in-95 duration-200">
                                <div className="shrink-0 mb-4 border-b border-zinc-800 pb-3">
                                  <h3 className="text-lg sm:text-2xl font-black text-zinc-100 flex items-center space-x-3">
                                    <span className="text-indigo-400 font-mono">0{activeSlideIndex}</span>
                                    <span>{sec.title}</span>
                                  </h3>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
                                  {sec.table && sec.table.headers.length > 0 ? (
                                    <div className="overflow-x-auto my-3 border border-zinc-800 rounded-xl">
                                      <table className="w-full text-xs sm:text-sm text-left border-collapse">
                                        <thead>
                                          <tr className="bg-zinc-800 border-b border-zinc-800">
                                            {sec.table.headers.map((h, hIdx) => (
                                              <th key={hIdx} className="p-3 font-bold text-zinc-200">
                                                {h}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {sec.table.rows.map((row, rIdx) => (
                                            <tr key={rIdx} className="border-b border-zinc-800/40 hover:bg-zinc-800/10">
                                              {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="p-3 text-zinc-400">
                                                  {cell}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : sec.bullets.length > 0 ? (
                                    <ul className="space-y-3.5 text-sm sm:text-base max-w-4xl">
                                      {sec.bullets.map((bullet, bIdx) => (
                                        <li key={bIdx} className="flex items-start space-x-2.5 text-zinc-300 animate-in fade-in slide-in-from-left duration-200" style={{ animationDelay: `${bIdx * 50}ms` }}>
                                          <span className="text-indigo-400 mt-1.5 shrink-0 text-sm">✦</span>
                                          <span className="leading-relaxed">{bullet}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="space-y-3.5 text-sm sm:text-base text-zinc-300 leading-relaxed max-w-4xl">
                                      {sec.content.map((p, pIdx) => (
                                        <p key={pIdx}>{p}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Slide maximized footer */}
                                <div className="shrink-0 flex items-center justify-between text-xs font-bold text-zinc-500 pt-3 border-t border-zinc-800/40">
                                  <span>小逻 AI 商业脑</span>
                                  <span>{activeSlideIndex} / {slidesCount - 1}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Fullscreen Speaker Notes Panel (rendered side-by-side or overlaid elegantly) */}
                          {showSpeakerNotes && activeSlideIndex > 0 && (() => {
                            const sec = parsed.sections[activeSlideIndex - 1];
                            return (
                              <div className="absolute inset-x-0 bottom-16 max-h-[45%] bg-zinc-950 border-t border-zinc-800 p-4 overflow-y-auto animate-in slide-in-from-bottom duration-150 rounded-t-2xl z-20">
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-2">
                                  <span className="text-[10px] font-black tracking-wider text-amber-400 uppercase">🎙️ 宣讲逐字稿 (Speaker Notes)</span>
                                  <button onClick={() => setShowSpeakerNotes(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300 font-extrabold">隐藏</button>
                                </div>
                                <p className="text-xs sm:text-sm leading-relaxed text-zinc-400 font-medium">
                                  {sec && sec.content.length > 0 ? sec.content.join("\n") : "（幻灯片提纲已备好，宣讲稿正在提炼中...）"}
                                </p>
                              </div>
                            );
                          })()}

                          {/* Slide maximized controller */}
                          <div className="bg-zinc-950 border-t border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0">
                            <div className="flex items-center space-x-2">
                              <button
                                disabled={activeSlideIndex === 0}
                                onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                                className="p-2 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400 rounded-lg bg-zinc-900 border border-zinc-800 transition-all cursor-pointer"
                                title="上一页"
                              >
                                <ChevronLeft className="w-5 h-5" />
                              </button>
                              <span className="text-xs font-black text-zinc-400 px-3 select-none min-w-[50px] text-center">
                                {activeSlideIndex === 0 ? "封面" : `${activeSlideIndex} / ${slidesCount - 1}`}
                              </span>
                              <button
                                disabled={activeSlideIndex === slidesCount - 1}
                                onClick={() => setCurrentSlideIndex(prev => Math.min(slidesCount - 1, prev + 1))}
                                className="p-2 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400 rounded-lg bg-zinc-900 border border-zinc-800 transition-all cursor-pointer"
                                title="下一页"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            </div>

                            {activeSlideIndex > 0 && (
                              <button
                                onClick={() => setShowSpeakerNotes(prev => !prev)}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-black border transition-all flex items-center space-x-2 cursor-pointer",
                                  showSpeakerNotes
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                                )}
                              >
                                🎙️ <span>宣讲逐字稿</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            );
          }

          // Detect if this is an Excel spreadsheet node
          const isExcel = item.config?.skillId === "office-excel-report" || 
                          (item.revisedPrompt && (
                            item.revisedPrompt.includes("【工作表") || 
                            item.revisedPrompt.includes("|---") || 
                            item.revisedPrompt.includes("| Column") ||
                            /\|\s*:?-+:?\s*\|/.test(item.revisedPrompt)
                          ));

          if (isExcel) {
            const parsed = parseDocumentContent(localText);
            const sheetsWithTables = parsed.sections.filter(sec => sec.table);
            const activeSheetIndex = Math.min(Math.max(0, excelActiveSheet), Math.max(0, sheetsWithTables.length - 1));
            const activeSheet = sheetsWithTables[activeSheetIndex];

            // Filter rows based on search
            const filteredRows = activeSheet && activeSheet.table
              ? activeSheet.table.rows.filter(row =>
                  excelSearch === "" ||
                  row.some(cell => cell.toLowerCase().includes(excelSearch.toLowerCase()))
                )
              : [];

            return (
              <div className="relative aspect-[3/4] sm:aspect-square overflow-hidden bg-zinc-950 cursor-pointer group/script rounded-2xl flex flex-col border border-zinc-800 shadow-xl">
                {/* Excel Top Bar */}
                <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-1.5 overflow-hidden">
                    <span className="text-sm shrink-0">📈</span>
                    <span className="text-[11px] font-black text-zinc-100 truncate max-w-[120px] sm:max-w-[150px]">
                      {parsed.title || "商业数据报表"}
                    </span>
                  </div>

                  {/* Mode switcher tabs */}
                  <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800/80 shrink-0">
                    <button
                      onClick={() => setExcelViewMode("sheets")}
                      className={cn(
                        "px-2 py-1 rounded text-[9px] font-extrabold transition-all",
                        excelViewMode === "sheets"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      表格
                    </button>
                    <button
                      onClick={() => setExcelViewMode("outline")}
                      className={cn(
                        "px-2 py-1 rounded text-[9px] font-extrabold transition-all",
                        excelViewMode === "outline"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      大纲
                    </button>
                  </div>

                  {/* Export Trigger */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await generateExcel(localText, `excel-${item.id}`);
                        } catch (err) {
                          console.error("Excel generation failed", err);
                        }
                      }}
                      className="p-1.5 bg-zinc-950 hover:bg-emerald-900/60 hover:text-emerald-300 text-zinc-400 rounded-lg border border-zinc-800 transition-all flex items-center space-x-1 cursor-pointer"
                      title="下载 Excel 文件"
                    >
                      <Download className="w-3 h-3 text-emerald-400" />
                      <span className="hidden sm:inline text-[9px] font-bold">下载</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPPTExcelMaximized(true);
                      }}
                      className="p-1.5 bg-zinc-950 hover:bg-emerald-900/60 hover:text-emerald-300 text-zinc-400 rounded-lg border border-zinc-800 transition-all flex items-center space-x-1 cursor-pointer"
                      title="全屏放大"
                    >
                      <Maximize2 className="w-3 h-3 text-emerald-400" />
                      <span className="hidden sm:inline text-[9px] font-bold">放大</span>
                    </button>
                  </div>
                </div>

                {/* Excel Content Card Area */}
                <div className="flex-1 overflow-hidden relative flex flex-col bg-zinc-950 p-3">
                  {excelViewMode === "outline" ? (
                    // Outline / Text Editor Mode
                    <div className="w-full h-full relative" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
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
                        onKeyDown={(e) => e.stopPropagation()}
                        className="w-full h-full p-3 bg-zinc-900 rounded-xl border border-zinc-800 focus:border-emerald-500 font-mono text-[10px] sm:text-[11px] leading-relaxed text-zinc-300 resize-none outline-none transition-all no-drag custom-scrollbar"
                        placeholder="在此处直接输入或编辑 Excel 内容大纲或 markdown 表格..."
                      />
                    </div>
                  ) : (
                    // Interactive Grid View Mode
                    <div className="flex-1 flex flex-col relative overflow-hidden bg-zinc-900 rounded-xl border border-zinc-800/60 shadow-inner">
                      {/* Grid Headers & Search */}
                      <div className="bg-zinc-950 border-b border-zinc-800 px-3 py-1.5 flex items-center justify-between shrink-0">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="搜索表格..."
                            value={excelSearch}
                            onChange={(e) => setExcelSearch(e.target.value)}
                            className="w-28 sm:w-36 pl-6 pr-2 py-0.5 bg-zinc-900 rounded border border-zinc-800 focus:border-emerald-500 text-[9px] text-zinc-300 placeholder-zinc-600 outline-none transition-all"
                          />
                          <Search className="w-2.5 h-2.5 text-zinc-600 absolute left-2 top-2" />
                        </div>
                        <span className="text-[8px] font-mono text-zinc-500">
                          {activeSheet ? activeSheet.title : "无表格数据"}
                        </span>
                      </div>

                      {/* Actual Cells Area */}
                      <div className="flex-1 overflow-auto custom-scrollbar no-drag" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        {activeSheet && activeSheet.table ? (
                          <table className="w-full text-[9px] sm:text-[10px] text-left border-collapse min-w-[300px]">
                            <thead className="sticky top-0 bg-zinc-950 z-10">
                              <tr className="border-b border-zinc-800">
                                <th className="w-8 p-1 text-center font-bold text-zinc-600 border-r border-zinc-800 bg-zinc-900 select-none">/</th>
                                {activeSheet.table.headers.map((h, hIdx) => (
                                  <th key={hIdx} className="p-1 font-black text-zinc-400 border-r border-zinc-800 text-center bg-zinc-900">
                                    {String.fromCharCode(65 + (hIdx % 26))}
                                  </th>
                                ))}
                              </tr>
                              <tr className="border-b border-zinc-800/60 bg-zinc-900/40">
                                <th className="p-1 bg-zinc-950"></th>
                                {activeSheet.table.headers.map((h, hIdx) => (
                                  <th key={hIdx} className="p-1 font-bold text-zinc-300 truncate max-w-[100px] border-r border-zinc-800">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRows.length === 0 ? (
                                <tr>
                                  <td colSpan={activeSheet.table.headers.length + 1} className="py-12 text-center text-zinc-600 text-xs">
                                    无匹配数据行
                                  </td>
                                </tr>
                              ) : (
                                filteredRows.map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b border-zinc-800/40 hover:bg-zinc-800/10">
                                    <td className="p-1 text-center font-mono text-zinc-600 bg-zinc-950 border-r border-zinc-800 sticky left-0 z-0 select-none">{rIdx + 1}</td>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="p-1.5 text-zinc-300 border-r border-zinc-800/30 truncate max-w-[120px]" title={cell}>
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                            <TableProperties className="w-8 h-8 text-zinc-700 mb-1.5" />
                            <p className="text-[10px] text-zinc-500">
                              未发现符合要求的结构化表格数据，您可以切换到【大纲】模式，直接输入 Markdown 表格内容。
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Sheet tabs at the bottom of the card */}
                      {sheetsWithTables.length > 0 && (
                        <div className="bg-zinc-950/90 border-t border-zinc-800 px-3 py-1.5 flex items-center justify-between shrink-0">
                          <div className="flex items-center space-x-1 overflow-x-auto custom-scrollbar max-w-[80%]">
                            {sheetsWithTables.map((sheet, idx) => (
                              <button
                                key={idx}
                                onClick={() => setExcelActiveSheet(idx)}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[8px] font-black border transition-all flex items-center space-x-1 cursor-pointer",
                                  excelActiveSheet === idx
                                    ? "bg-emerald-600/25 border-emerald-500/40 text-emerald-400"
                                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                                )}
                              >
                                <span>{sheet.title}</span>
                              </button>
                            ))}
                          </div>
                          <span className="text-[8px] font-mono text-zinc-600">
                            共 {sheetsWithTables.length} 张工作表
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fullscreen Excel Portal */}
                {isPPTExcelMaximized && createPortal(
                  <div 
                    className="fixed inset-0 z-[9999] bg-zinc-950/98 backdrop-blur-md flex flex-col p-4 md:p-8 animate-in fade-in duration-200"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Maximize Mode Top Bar */}
                    <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0 mb-4 bg-transparent">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">📈</span>
                        <div>
                          <h3 className="text-base font-black text-zinc-100">
                            {parsed.title || "商业数据报表"}
                          </h3>
                          <p className="text-xs text-zinc-400">正在全屏查看与多维数据报表编辑中</p>
                        </div>
                      </div>

                      {/* Controls inside Maximize Mode */}
                      <div className="flex items-center space-x-4">
                        {/* Interactive Grid Search */}
                        {excelViewMode === "sheets" && (
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="搜索工作表数据..."
                              value={excelSearch}
                              onChange={(e) => setExcelSearch(e.target.value)}
                              className="w-48 sm:w-64 pl-8 pr-3 py-1.5 bg-zinc-900 rounded-xl border border-zinc-800 focus:border-emerald-500 text-xs text-zinc-300 placeholder-zinc-500 outline-none transition-all"
                            />
                            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                          </div>
                        )}

                        {/* Mode Switcher */}
                        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 shrink-0">
                          <button
                            onClick={() => setExcelViewMode("sheets")}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all",
                              excelViewMode === "sheets"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200"
                            )}
                          >
                            表格视图
                          </button>
                          <button
                            onClick={() => setExcelViewMode("outline")}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all",
                              excelViewMode === "outline"
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200"
                            )}
                          >
                            编辑大纲
                          </button>
                        </div>

                        {/* Download */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await generateExcel(localText, `excel-${item.id}`);
                            } catch (err) {
                              console.error("Excel generation failed", err);
                            }
                          }}
                          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-emerald-900/60 hover:text-emerald-300 text-zinc-400 rounded-xl border border-zinc-800 transition-all flex items-center space-x-2 cursor-pointer text-xs font-bold"
                          title="下载 Excel 文件"
                        >
                          <Download className="w-4 h-4 text-emerald-400" />
                          <span>下载报表</span>
                        </button>

                        {/* Close button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsPPTExcelMaximized(false);
                          }}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all border border-red-500/20 animate-pulse"
                          title="退出全屏"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Main content in Maximize Mode */}
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-zinc-900 rounded-2xl border border-zinc-800">
                      {excelViewMode === "outline" ? (
                        <div className="flex-1 h-full relative p-4">
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
                            className="w-full h-full p-4 bg-transparent font-mono text-xs sm:text-sm leading-relaxed text-zinc-200 resize-none outline-none custom-scrollbar"
                            placeholder="在此处直接输入或编辑 Excel 内容大纲或 markdown 表格..."
                          />
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col relative overflow-hidden h-full">
                          {/* Active sheet indicator in fullscreen */}
                          <div className="bg-zinc-950/50 border-b border-zinc-800 px-6 py-2.5 flex items-center justify-between shrink-0">
                            <div className="flex items-center space-x-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-xs font-mono font-bold text-zinc-300">
                                当前工作表：{activeSheet ? activeSheet.title : "无数据"}
                              </span>
                            </div>
                            {excelSearch && (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-black">
                                筛选中：找到 {filteredRows.length} 行数据
                              </span>
                            )}
                          </div>

                          {/* Large Grid View */}
                          <div className="flex-1 overflow-auto custom-scrollbar p-4">
                            {activeSheet && activeSheet.table ? (
                              <table className="w-full text-xs sm:text-sm text-left border-collapse border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
                                <thead className="sticky top-0 bg-zinc-950 z-10 shadow-md">
                                  <tr className="border-b border-zinc-800">
                                    <th className="w-12 p-2.5 text-center font-bold text-zinc-500 border-r border-zinc-800 bg-zinc-900 select-none">/</th>
                                    {activeSheet.table.headers.map((h, hIdx) => (
                                      <th key={hIdx} className="p-2.5 font-black text-zinc-400 border-r border-zinc-800 text-center bg-zinc-900">
                                        {String.fromCharCode(65 + (hIdx % 26))}
                                      </th>
                                    ))}
                                  </tr>
                                  <tr className="border-b border-zinc-800 bg-zinc-900/60">
                                    <th className="p-2.5 bg-zinc-950"></th>
                                    {activeSheet.table.headers.map((h, hIdx) => (
                                      <th key={hIdx} className="p-3 font-bold text-zinc-200 border-r border-zinc-800">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredRows.length === 0 ? (
                                    <tr>
                                      <td colSpan={activeSheet.table.headers.length + 1} className="py-24 text-center text-zinc-500 text-sm">
                                        无匹配工作表数据行
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredRows.map((row, rIdx) => (
                                      <tr key={rIdx} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors">
                                        <td className="p-2.5 text-center font-mono text-zinc-500 bg-zinc-950 border-r border-zinc-800 sticky left-0 z-0 select-none">{rIdx + 1}</td>
                                        {row.map((cell, cIdx) => (
                                          <td key={cIdx} className="p-3 text-zinc-300 border-r border-zinc-800/30 truncate max-w-[200px]" title={cell}>
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                <TableProperties className="w-12 h-12 text-zinc-700 mb-3" />
                                <p className="text-sm text-zinc-400 max-w-md">
                                  未发现符合要求的结构化表格数据，您可以切换到【大纲】模式，直接输入 Markdown 表格内容。
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Interactive sheet selector tabs */}
                          {sheetsWithTables.length > 0 && (
                            <div className="bg-zinc-950/90 border-t border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0">
                              <div className="flex items-center space-x-2 overflow-x-auto custom-scrollbar max-w-[80%] pb-1">
                                {sheetsWithTables.map((sheet, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setExcelActiveSheet(idx)}
                                    className={cn(
                                      "px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all flex items-center space-x-2 cursor-pointer",
                                      excelActiveSheet === idx
                                        ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-950/20"
                                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                                    )}
                                  >
                                    <span>{sheet.title}</span>
                                  </button>
                                ))}
                              </div>
                              <span className="text-xs font-mono text-zinc-500">
                                共 {sheetsWithTables.length} 张工作表
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            );
          }

          // Otherwise return standard custom script card
          return (
            <div className="relative aspect-[3/4] sm:aspect-square overflow-hidden bg-white cursor-pointer group/script rounded-2xl">
              <div className={cn(
                "w-full h-full p-6 flex flex-col",
                item.config?.isSkillNode ? "bg-indigo-50/10 border-t-2 border-indigo-500 rounded-t-2xl" : "bg-amber-50/20"
              )}>
                <div className={cn(
                  "flex items-center space-x-2 mb-3 shrink-0",
                  item.config?.isSkillNode ? "text-indigo-600" : "text-amber-600"
                )}>
                  {(() => {
                    if (item.config?.isSkillNode) {
                      return (
                        <>
                          <span className="text-sm shrink-0 mr-1">{item.config?.icon || "🧩"}</span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 truncate max-w-[150px]">
                            {item.config?.title || "工作流插件"}
                          </span>
                        </>
                      );
                    }
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
          );
        })() : (
          <div
            className={cn(
              "relative w-full h-[100%] flex-1 overflow-hidden cursor-pointer rounded-2xl",
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
                      {typeof item.error === "object" ? (item.error?.message || JSON.stringify(item.error)) : String(item.error)}
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
            ) : item.type === "code" && (item as any).code ? (
              <div className="w-full h-full bg-zinc-950 overflow-hidden flex flex-col no-drag p-2 rounded-2xl relative" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                <WebSandbox code={(item as any).code} />
              </div>
            ) : item.type === "ui" && (item as any).code ? (
              <div className="w-full h-full bg-white overflow-hidden flex flex-col no-drag p-2 rounded-2xl relative" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                <GenerativeUI intent={(item as any).config?.title || ""} uiSchema={(item as any).code} />
              </div>
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

        {item.type === "gen_script" && !isExcel && !isPPT && !isDissectedScriptResult && !item.config?.isSkillNode && !item.config?.isIntegratedModelNode && (
          <div className="p-6 space-y-4 bg-white rounded-b-2xl">
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
          !isInlineConsoleActive &&
          (item.status === "success" ||
            item.imageUrl ||
            item.videoUrl ||
            item.status === "error" ||
            (item.type === "gen_script" && item.revisedPrompt && item.revisedPrompt.trim() !== "")) && (
          <AnimatePresence>
            {isSelected && (
              <div
                className="absolute bottom-full mb-4 z-[100] pointer-events-none"
                style={{
                  left: "50%",
                  transform: `translate(-50%, 0) scale(${1 / canvasScale})`,
                  transformOrigin: "bottom center",
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
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
                          return null;
                        }
                      })()}

                      {!(isPPT || isExcel) && (
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
                                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                                transition={{ duration: 0.15 }}
                                className="absolute top-full mt-2 left-0 z-[120] min-w-[200px] bg-zinc-950/95 border border-zinc-800/80 shadow-2xl backdrop-blur-md rounded-xl p-1 flex flex-col gap-0.5 whitespace-nowrap action-bar-click-target"
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
                                      : "复制剧本内容"}
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
                                  <span>下载标准 TXT 文档</span>
                                </button>
                                
                                <div className="h-[1px] bg-zinc-800/60 my-1" />
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowExportDropdown(false);
                                    generatePPT(item.revisedPrompt || "", `pptx-${item.id}`);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-[#c084fc] hover:text-white hover:bg-purple-900/40 rounded-lg transition-colors flex items-center space-x-2"
                                >
                                  <Layout className="w-3.5 h-3.5 text-[#c084fc]" />
                                  <span>📊 转换为商业幻灯片 (PPT)</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowExportDropdown(false);
                                    generatePDF(item.revisedPrompt || "", `pdf-${item.id}`);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-[#818cf8] hover:text-white hover:bg-indigo-900/40 rounded-lg transition-colors flex items-center space-x-2"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#818cf8]" />
                                  <span>📄 转换为商业白皮书 (PDF)</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowExportDropdown(false);
                                    generateExcel(item.revisedPrompt || "", `excel-${item.id}`);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-[#34d399] hover:text-white hover:bg-emerald-900/40 rounded-lg transition-colors flex items-center space-x-2"
                                >
                                  <ClipboardList className="w-3.5 h-3.5 text-[#34d399]" />
                                  <span>📈 转换为数据报表 (Excel)</span>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

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


                    </>
                  ) : (
                    <>
                      {(item.status === "success" ||
                        item.imageUrl ||
                        item.videoUrl) && (
                        <>




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
