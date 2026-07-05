import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  FileText, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Settings, 
  Play, 
  Layout as LayoutIcon, 
  Film, 
  ImageIcon, 
  User, 
  RefreshCw, 
  Edit3, 
  ChevronDown,
  ChevronUp,
  Copy,
  Plus, 
  Download, 
  Maximize2, 
  Minimize2,
  Info,
  X,
  Clock,
  Zap,
  Sparkles,
  Search,
  ArrowRight,
  ArrowLeft,
  Monitor,
  Smartphone,
  Clapperboard,
  Palette,
  Wand2,
  Layers,
  Video,
  Shirt,
  Type as TypeIcon,
  Scissors,
  Minus,
  Bot,
  Mic,
  Volume2,
  Eye,
  EyeOff,
  MoreVertical,
  ExternalLink,
  Save,
  History,
  Library,
  UserPlus,
  MapPin,
  Package,
  Loader2,
  ChevronLeft,
  Share2,
  GripVertical,
  BarChart3,
  TrendingUp,
  SkipBack,
  SkipForward,
  Pause,
  Lock,
  ImagePlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { AssetCard } from './AssetCard';
import { GlobalAssetLibrary } from './AssetLibrary/GlobalAssetLibrary';
import { 
  CHARACTER_VARIANT_RULES, 
  CHARACTER_SIX_VIEW_RULES, 
  SCENE_PANORAMA_RULES, 
  SCENE_LAYOUT_RULES 
} from '../services/rules';
import { assetAgent, ASSET_AGENT_SYSTEM_INSTRUCTION } from '../services/assetAgent';
import { pipelineService } from '../services/geminiService';
import { GENERATION_COSTS } from '../constants';
import { 
  Step, 
  PipelineData, 
  Asset, 
  Segment, 
  Config, 
  AutomationMode, 
  ScriptAnalysis, 
  AssetVariant, 
  Task, 
  Genre, 
  Director, 
  VisualStyle,
  SmartImageResult,
  HistoryItem
} from '../types';
import JSZip from 'jszip';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { GENRES, VISUAL_STYLES, DEFAULT_CONFIG } from '../constants';
import { handleDownload, cleanPrompt, urlToBase64, fetchWithProxy, logUsage, formatErrorMessage, getMediaDuration } from '../services/utils';
import { safeJson } from '../lib/fetch';

import { TimelineSwitcher } from './TimelineSwitcher';

// Set worker source for pdfjs
const safePdfjsLib = (pdfjsLib as any).GlobalWorkerOptions ? (pdfjsLib as any) : ((pdfjsLib as any).default || pdfjsLib);
if (typeof window !== 'undefined' && safePdfjsLib && safePdfjsLib.GlobalWorkerOptions) {
  safePdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${safePdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

interface DirectorScriptingProps {
  config: Config;
  hasPlatformKey: boolean;
  handleOpenSelectKey: () => Promise<void>;
  initialData?: PipelineData | null;
  deductPoints: (amount: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  refundPoints: (amount: number, reason: string) => Promise<boolean>;
  userPoints: number;
  onNavigate: (tab: string) => void;
  history?: HistoryItem[];
  videoConfig?: any;
  setImageConfig?: React.Dispatch<React.SetStateAction<any>>;
}

export const DirectorScripting: React.FC<DirectorScriptingProps> = ({
  config,
  hasPlatformKey,
  handleOpenSelectKey,
  initialData = null,
  deductPoints,
  refundPoints,
  userPoints,
  onNavigate,
  history = [],
  videoConfig,
  setImageConfig
}) => {
  const [step, setStep] = useState<Step>(initialData ? Step.RESULT : Step.INPUT);
  const isCancelledRef = useRef(false);
  const [script, setScript] = useState(initialData?.originalScript || '');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileContent, setUploadedFileContent] = useState<string | null>(null);
  const [selectedGenreId, setSelectedGenreId] = useState<string>('short_drama');
  const [contentMode, setContentMode] = useState<'movie' | 'short_drama'>('short_drama');
  const [selectedDirectorName, setSelectedDirectorName] = useState<string>('罗导(短剧导演)');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>(initialData?.aspectRatio || '9:16');
  const [selectedVisualStyle, setSelectedVisualStyle] = useState<string>(VISUAL_STYLES?.[0]?.name || '');
  const [selectedQuality, setSelectedQuality] = useState<string>(initialData?.imageQuality || '2K');
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>(initialData?.videoModel || 'seedance2.0');
  const [selectedVideoDuration, setSelectedVideoDuration] = useState<string>(initialData?.videoDuration || '15');
  const [selectedVideoResolution, setSelectedVideoResolution] = useState<string>(initialData?.videoResolution || '720p');
  const [productionMode, setProductionMode] = useState<'director' | 'prompt'>(initialData?.productionMode || 'prompt');
  const [spatialMode, setSpatialMode] = useState<'strong' | 'standard'>(initialData?.spatialMode || 'strong');
  const [automationMode, setAutomationMode] = useState<AutomationMode>(AutomationMode.SEMI);
  const [customDirectorStyle, setCustomDirectorStyle] = useState('');
  const [customVisualStyle, setCustomVisualStyle] = useState('');
  const [styleImageUrl, setStyleImageUrl] = useState<string | undefined>(initialData?.styleImageUrl);
  const [data, _setData] = useState<PipelineData | null>(initialData);
  const [lastLocalUpdate, setLastLocalUpdate] = useState(0);
  const dataRef = useRef<PipelineData | null>(initialData);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Custom setData that updates dataRef immediately to prevent race conditions in async callbacks
  const setData = useCallback((update: any, shouldSync = true) => {
    _setData(prev => {
      let next = typeof update === 'function' ? update(prev) : update;
      
      // Ensure sync between top-level segments and task-level segments if they exist
      // This prevents data being lost if some parts of the code only update one
      if (next && next.tasks && next.tasks[0] && next.tasks[0].segments) {
        if (!next.segments || next.segments.length === 0) {
          // Return a new object for immutability
          next = { ...next, segments: next.tasks[0].segments };
        }
      }

      dataRef.current = next;
      if (shouldSync && next !== prev) {
        setLastLocalUpdate(Date.now());
      }
      return next;
    });
  }, []);

  const [newTaskScript, setNewTaskScript] = useState('');
  const [isGeneratingTask, setIsGeneratingTask] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('正在解析剧本结构...');
  const [generatingAssets, setGeneratingAssets] = useState<Record<string, string>>({});
  const [assetErrors, setAssetErrors] = useState<Record<string, string>>({});
  const [generatingSegments, setGeneratingSegments] = useState<Record<string, string>>({});
  const [optimizingPrompts, setOptimizingPrompts] = useState<Record<string, boolean>>({});
  const [segmentErrors, setSegmentErrors] = useState<Record<string, string>>({});
  const [editingAssetName, setEditingAssetName] = useState<string | null>(null);
  const [editingAssetRefName, setEditingAssetRefName] = useState<string | null>(null);
  const [editingSegments, setEditingSegments] = useState<Record<number, boolean>>({});
  const [editingTaskScripts, setEditingTaskScripts] = useState<Record<string, boolean>>({});
  const [editingPrompt, setEditingPrompt] = useState<{ 
    id?: string; 
    taskId?: string; 
    segmentId?: string; 
    type: 'main' | 'secondary' | 'variant' | 'segment' | 'layout'; 
    variantId?: string 
  } | null>(null);
  const [tempPromptValue, setTempPromptValue] = useState('');

  // Sync tempPromptValue when editingPrompt changes
  useEffect(() => {
    if (editingPrompt) {
      if (editingPrompt.type === 'segment') {
        const task = data?.tasks?.find(t => t.id === editingPrompt.taskId);
        const segment = task?.segments?.find(s => s.id === editingPrompt.segmentId);
        setTempPromptValue(segment?.prompt || '');
      } else if (editingPrompt.id) {
        const asset = data?.assets?.find(a => a.id === editingPrompt.id);
        if (asset) {
          if (editingPrompt.variantId) {
            const variant = asset.variants?.find(v => v.id === editingPrompt.variantId);
            setTempPromptValue(variant?.prompt || '');
          } else {
            const prompt = editingPrompt.type === 'main' ? asset.subAssets.mainPrompt : 
                          editingPrompt.type === 'layout' ? asset.subAssets.layoutPrompt :
                          asset.subAssets.secondaryPrompt;
            setTempPromptValue(prompt || '');
          }
        }
      }
    }
  }, [editingPrompt, data]);

  const assetScrollRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scriptFileInputRef = useRef<HTMLInputElement>(null);
  const [activeAssetUpload, setActiveAssetUpload] = useState<{ id: string | number; type: 'main' | 'secondary' | 'segment' | 'variant' | 'layout'; variantId?: string } | null>(null);
  const [activeAssetLibraryCall, setActiveAssetLibraryCall] = useState<{ id: string | number; type: 'main' | 'secondary' | 'layout' | 'variant'; variantId?: string } | null>(null);
  const [scriptAnalysis, setScriptAnalysis] = useState<ScriptAnalysis | null>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [activeSegId, setActiveSegId] = useState<string | null>(null);
  const [lastActiveSegId, setLastActiveSegId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const scrollTimeline = (direction: 'left' | 'right') => {
    if (timelineRef.current) {
      const scrollAmount = direction === 'left' ? -500 : 500;
      timelineRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Update lastActiveSegId when entering focus mode
  useEffect(() => {
    if (activeSegId) {
      setLastActiveSegId(activeSegId);
    }
  }, [activeSegId]);

  // Reset focus state if all tasks are cleared
  useEffect(() => {
    if (!data?.tasks || data.tasks.length === 0) {
      setActiveSegId(null);
      setLastActiveSegId(null);
    }
  }, [data?.tasks]);

  const filteredGenres = useMemo(() => {
    if (contentMode === 'short_drama') {
      return GENRES.filter(g => g.id === 'short_drama');
    }
    // For movie mode, exclude short drama
    return GENRES.filter(g => g.id !== 'short_drama');
  }, [contentMode]);

  // Sync selection when mode changes
  useEffect(() => {
    if (contentMode === 'short_drama') {
      setSelectedGenreId('short_drama');
      setSelectedDirectorName('罗导(短剧导演)');
      setNarrativeMode('compact');
      setSelectedAspectRatio('9:16');
    } else {
      // Default to first master in movie mode
      setSelectedGenreId('chinese_masters');
      setSelectedDirectorName('王家卫');
      setNarrativeMode('detailed');
      setSelectedAspectRatio('16:9');
    }
  }, [contentMode]);

  const allSegments = useMemo(() => {
    if (!data?.tasks) return [];
    return (data.tasks || []).flatMap(task => task.segments || []);
  }, [data]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayIdx, setCurrentPlayIdx] = useState<number | null>(null);

  const segmentsToPlay = useMemo(() => {
    return allSegments.filter(s => s.generatedVideoUrl);
  }, [allSegments]);

  useEffect(() => {
    if (isPlaying && currentPlayIdx === null) {
      if (segmentsToPlay.length > 0) {
        setCurrentPlayIdx(0);
      } else {
        setIsPlaying(false);
        setToast({ message: '暂无可播放的已生成视频', type: 'info' });
      }
    } else if (!isPlaying) {
      setCurrentPlayIdx(null);
    }
  }, [isPlaying, segmentsToPlay]);

  const totalDurationSeconds = useMemo(() => {
    return allSegments.reduce((acc, seg) => {
      const d = parseInt(seg.duration) || 0;
      return acc + d;
    }, 0);
  }, [allSegments]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDurationStr = formatTime(totalDurationSeconds);
  const styleFileInputRef = useRef<HTMLInputElement>(null);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [isAssetExtractionComplete, setIsAssetExtractionComplete] = useState(false);
  const [revealIndex, setRevealIndex] = useState(0);
  const [draggedAssetId, setDraggedAssetId] = useState<{ id: string | number; type: string; variantId?: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [draggedAssetFromList, setDraggedAssetFromList] = useState<Asset | null>(null);
  const [dragTargetSegment, setDragTargetSegment] = useState<{ index: number; type: string } | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; isVideo?: boolean; type?: string } | null>(null);

  const [mentionMenu, setMentionMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    query: string;
    taskId: string;
    segId: string;
    cursorPosition: number;
  } | null>(null);

  const lastProcessedInitialDataRef = useRef<string | null>(null);

  useEffect(() => {
    // Only auto-focus the first segment if there are tasks and we've NEVER focused a segment yet.
    // This allows the user to manually exit to the task list without being forced back in.
    if (data?.tasks?.length && !activeSegId && !lastActiveSegId) {
      const firstSegId = data.tasks[0]?.segments?.[0]?.id;
      if (firstSegId) setActiveSegId(firstSegId);
    }
  }, [data, activeSegId, lastActiveSegId]);

  const checkTimeOverflow = (prompt: string) => {
    if (!prompt) return false;
    const matches = prompt.match(/（(\d+)-(\d+)s）/g) || prompt.match(/\((\d+)-(\d+)s\)/g);
    if (!matches) return false;
    return matches.some(m => {
      const times = m.match(/\d+/g);
      if (!times || times.length < 2) return false;
      return parseInt(times[1]) > 15;
    });
  };

  // Save to cloud whenever data changes (with debounce)
  useEffect(() => {
    let isMounted = true;

    const syncPipeline = async (dataToSync: PipelineData) => {
      // Skip sync if an asset is being generated or a manual save is in progress
      if (Object.keys(generatingAssets).length > 0 || isSavingRef.current) return;

      const token = localStorage.getItem('token');
      if (dataToSync && token) {
        // Cancel previous sync request
        if (syncAbortControllerRef.current) {
          syncAbortControllerRef.current.abort();
        }
        syncAbortControllerRef.current = new AbortController();

        try {
          const res = await fetch('/api/user/pipelines', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dataToSync),
            signal: syncAbortControllerRef.current.signal
          });
          
          if (res.ok && isMounted) {
            const result = await safeJson(res);
            if (result) {
              setData(prev => {
                if (!prev || prev.id !== dataToSync.id) return prev;
                
                // If an asset is being generated, skip updating from server to avoid flicker
                if (Object.keys(generatingAssets).length > 0) return prev;

                const isPermanent = (url?: string) => url?.startsWith('http') && !url?.includes('blob:');

                // 1. Merge Assets
                let mergedAssets = prev.assets;
                if (result.assets) {
                  mergedAssets = result.assets.map((serverAsset: any) => {
                    const localAsset = prev.assets.find(a => a.id === serverAsset.id);
                    if (!localAsset) return serverAsset;
                    
                    const mergeMedia = (localMedia: any, serverMedia: any) => {
                      if (!serverMedia) return localMedia;
                      const merged = { ...localMedia };
                      if (isPermanent(serverMedia.mainImageUrl)) merged.mainImageUrl = serverMedia.mainImageUrl;
                      if (isPermanent(serverMedia.secondaryMediaUrl)) merged.secondaryMediaUrl = serverMedia.secondaryMediaUrl;
                      if (isPermanent(serverMedia.layoutUrl)) merged.layoutUrl = serverMedia.layoutUrl;
                      if (isPermanent(serverMedia.combinedUrl)) merged.combinedUrl = serverMedia.combinedUrl;
                      return merged;
                    };

                    return {
                      ...serverAsset,
                      generatedMedia: mergeMedia(localAsset.generatedMedia, serverAsset.generatedMedia),
                      variants: (serverAsset.variants || []).map((sv: any) => {
                        const lv = localAsset.variants?.find(v => v.id === sv.id);
                        if (!lv) return sv;
                        return {
                          ...sv,
                          imageUrl: isPermanent(sv.imageUrl) ? sv.imageUrl : lv.imageUrl,
                          threeViewUrl: isPermanent(sv.threeViewUrl) ? sv.threeViewUrl : lv.threeViewUrl
                        };
                      })
                    };
                  });
                }

                // 2. Merge Tasks & Segments (This prevents videos disappearing during sync)
                let mergedTasks = prev.tasks;
                if (result.tasks && result.tasks.length > 0) {
                  mergedTasks = result.tasks.map((serverTask: any) => {
                    const localTask = prev.tasks.find(t => t.id === serverTask.id);
                    if (!localTask) return serverTask;

                    // Merge segments within the task
                    const mergedSegments = (serverTask.segments || []).map((serverSeg: any) => {
                      const localSeg = (localTask.segments || []).find(s => s.id === serverSeg.id);
                      if (!localSeg) return serverSeg;

                      // Prioritize server video URL if it's permanent, otherwise keep local
                      return {
                        ...serverSeg,
                        generatedVideoUrl: isPermanent(serverSeg.generatedVideoUrl) ? serverSeg.generatedVideoUrl : localSeg.generatedVideoUrl,
                        status: serverSeg.status || localSeg.status
                      };
                    });

                    return {
                      ...serverTask,
                      segments: mergedSegments
                    };
                  });
                }

                return { 
                  ...prev, 
                  assets: mergedAssets,
                  tasks: mergedTasks,
                  segments: (mergedTasks[0]?.segments || prev.segments) // Sync top-level segments too
                };
              }, false); 
            }
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.error('同步流水线到云端失败:', err);
        }
      }
    };
    
    // Debounce sync to prevent too many large requests
    if (data) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => syncPipeline(data), 500);
    }
    
    return () => { 
      isMounted = false; 
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [lastLocalUpdate]);

  // Handle initialData changes (when navigating from TaskManager)
  useEffect(() => {
    if (initialData) {
      const dataId = (initialData as any).id + ((initialData as any)._navId || '');
      if (lastProcessedInitialDataRef.current === dataId) return;
      lastProcessedInitialDataRef.current = dataId;

      const processedData = {
        ...initialData,
        id: (initialData.id && initialData.id !== 'null' && initialData.id !== 'undefined') ? initialData.id : `pipeline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      };
      setData(processedData);
      setStep(Step.RESULT);
      setScript(processedData.originalScript || '');
      setSelectedAspectRatio(processedData.aspectRatio || '9:16');
      setSelectedVisualStyle(VISUAL_STYLES?.[0]?.name || '');
      setSelectedGenreId('short_drama');
      setSelectedDirectorName('罗导(短剧导演)');
      setNarrativeMode('compact');
      setSelectedQuality(processedData.imageQuality || '2K');
      setSelectedVideoModel(processedData.videoModel || 'seedance2.0');
      setProductionMode(processedData.productionMode || 'prompt');
    } else {
      // If initialData is null and we were showing a task, reset to input step
      if (lastProcessedInitialDataRef.current === 'null') return;
      lastProcessedInitialDataRef.current = 'null';
      
      setData(null);
      setStep(Step.INPUT);
      setScript('');
      setScriptAnalysis(null);
      setAutomationError(null);
      setGlobalProgress(0);
      setSelectedAspectRatio('9:16');
      setSelectedVisualStyle(VISUAL_STYLES?.[0]?.name || '');
      setSelectedGenreId('short_drama');
      setSelectedDirectorName('罗导(短剧导演)');
      setNarrativeMode('compact');
      setSelectedQuality('2K');
      setSelectedVideoModel('seedance2.0');
      setSelectedVideoDuration('15');
    }
  }, [initialData]);

  const [narrativeMode, setNarrativeMode] = useState<'detailed' | 'compact'>('compact');
  const [targetSegments, setTargetSegments] = useState<number>(4);
  const [isAutoTargetSegments, setIsAutoTargetSegments] = useState<boolean>(true);
  const [isFlexibleDuration, setIsFlexibleDuration] = useState<string>('flexible-15');
  const [isDownloading, setIsDownloading] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);

  useEffect(() => {
    (window as any).setAssetToDelete = setAssetToDelete;
    return () => { delete (window as any).setAssetToDelete; };
  }, []);
  const [activeTaskFileUpload, setActiveTaskFileUpload] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generateAllProgress, setGenerateAllProgress] = useState({ current: 0, total: 0, phase: '' });
  const [activeBindingDropdown, setActiveBindingDropdown] = useState<{taskId: string, segId: string} | null>(null);
  const cancelledAssetsRef = useRef<Set<string>>(new Set());
  const taskScriptFileInputRef = useRef<HTMLInputElement>(null);
  const syncAbortControllerRef = useRef<AbortController | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (step === Step.ANALYZING) {
      const interval = setInterval(() => {
        const assetsCount = data?.assets?.length || 0;
        const totalItems = 8 + assetsCount;
        
        if (revealIndex >= totalItems) {
          if (isAssetExtractionComplete) {
            clearInterval(interval);
            // Auto-transition removed as per user request to allow manual entry
          }
          return;
        }
        
        setRevealIndex(prev => prev + 1);
      }, 600);
      return () => clearInterval(interval);
    }
  }, [step, data?.assets, isAssetExtractionComplete, revealIndex]);

  // Auto-analysis useEffect removed as per user request to make selections user-driven.

  // handleAnalyzeScript removed as it was only used for auto-analysis in the input stage.

  useEffect(() => {
    const handleClickOutside = () => setActiveBindingDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleAnalyzeStyleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingStyle(true);
    setLoadingMsg('正在分析参考图风格...');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const styleDescription = await pipelineService.analyzeStyleImage(base64, config);
          setCustomVisualStyle(styleDescription);
          setStyleImageUrl(base64);
          setToast({ message: '风格分析完成', type: 'success' });
        } catch (error: any) {
          console.error('Failed to analyze style image:', error);
          setToast({ message: '风格分析失败，请重试', type: 'error' });
        } finally {
          setIsAnalyzingStyle(false);
          setLoadingMsg('');
          // Reset file input
          if (styleFileInputRef.current) styleFileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading file:', error);
      setIsAnalyzingStyle(false);
      setLoadingMsg('');
    }
  };

  const checkApiKey = (type: 'image' | 'video' | 'script') => {
    const apiConfig = config[type];
    if (!apiConfig) return true;
    const isDefaultEndpoint = apiConfig.endpoint?.includes('generativelanguage.googleapis.com');
    const hasCustomKey = !!apiConfig.apiKey && (apiConfig.apiKey || '').trim().length > 0;
    
    if (isDefaultEndpoint && !hasCustomKey && !hasPlatformKey) {
      handleOpenSelectKey();
      return false;
    }
    return true;
  };

  const handleNewScript = () => {
    setData(null);
    setStep(Step.INPUT);
    setScript('');
    setScriptAnalysis(null);
    setAutomationError(null);
    setGlobalProgress(0);
    setUploadedFileContent('');
    setUploadedFileName('');
    setTargetSegments(4);
    setSelectedAspectRatio('9:16');
    setSelectedVisualStyle(VISUAL_STYLES?.[0]?.name || '');
    setSelectedQuality('2K');
    setSelectedVideoModel('seedance2.0');
    setSelectedVideoDuration('15');
    lastProcessedInitialDataRef.current = 'null';
  };

  const handleGenerate = async (fullAuto = false) => {
    if (!checkApiKey('script')) return;
    if (!checkApiKey('image')) return;
    if (fullAuto && !checkApiKey('video')) return;
    
    isCancelledRef.current = false;
    let scriptToProcess = script;
    if (uploadedFileContent) {
      scriptToProcess = (script || '').trim() 
        ? `${uploadedFileContent}\n\n【用户补充说明】：\n${script}` 
        : uploadedFileContent;
    }

    if (!(scriptToProcess || '').trim()) {
      setToast({ message: "请输入剧本内容或上传有效的剧本文件。", type: 'error' });
      return;
    }

    // 计算总消耗积分：仅计算剧本资产扫描 (输入)
    // 输入：每2000字 2积分
    const inputCost = Math.ceil(scriptToProcess.length / 2000) * (GENERATION_COSTS.DIRECTOR as any).SCRIPT_INPUT_PER_2000;
    const totalCost = inputCost;
    
    setStep(Step.GENERATING);
    setLoadingMsg('正在核对积分...');

    const result = await deductPoints(totalCost, `剧本资产扫描 (输入: ${scriptToProcess.length}字)`);
    if (isCancelledRef.current) return;
    if (!result.success) {
      setToast({ message: result.error || '积分核对失败，请稍后重试', type: 'error' });
      setStep(Step.INPUT);
      return;
    }

    setAutomationError(null);
    setLoadingMsg('正在深度解析剧本...');
    
    try {
      let finalVisualStyle = selectedVisualStyle;
      if (selectedVisualStyle === '自定义') {
        finalVisualStyle = customVisualStyle;
      }

      // 第一步：启动分析与资产扫描
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("分析超时，剧本可能过长，请重试或尝试分段处理")), 1200000)
      );

      // 启动两个异步任务
      const analysisPromise = pipelineService.analyzeScript(scriptToProcess, config);
      const assetsPromise = Promise.race([
        pipelineService.preScanAssets(
          scriptToProcess,
          finalVisualStyle,
          config,
          data?.assets || [],
          styleImageUrl
        ),
        timeoutPromise
      ]) as Promise<Asset[]>;

      // 等待分析结果，以便尽快进入 ANALYZING 界面展示创意要点
      const analysis = await analysisPromise;
      if (isCancelledRef.current) return;
      
      setScriptAnalysis(analysis);
      
      // 初始化基础数据
      const initialData: PipelineData = {
        id: (data?.id && data.id !== 'null' && data.id !== 'undefined') ? data.id : `pipeline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: data?.name || `剧本任务_${new Date().toLocaleString()}`,
        timestamp: data?.timestamp || Date.now(),
        originalScript: scriptToProcess,
        directorStyle: selectedDirectorName === '自定义' ? customDirectorStyle : selectedDirectorName,
        aspectRatio: selectedAspectRatio,
        visualStyle: finalVisualStyle,
        imageQuality: selectedQuality,
        videoModel: selectedVideoModel,
        videoDuration: selectedVideoDuration,
        videoResolution: selectedVideoResolution,
        narrativeMode: narrativeMode,
        targetSegments: isAutoTargetSegments ? 0 : targetSegments,
        productionMode: productionMode,
        globalRule: '',
        styleImageUrl: styleImageUrl,
        assets: [], // 初始为空，等 assetsPromise 完成后更新
        tasks: [] 
      };

      setData(initialData);
      setIsAssetExtractionComplete(false);
      setStep(Step.ANALYZING);
      setRevealIndex(0); // 重置揭示索引

      // 在后台继续等待资产扫描完成
      assetsPromise.then(async (assets) => {
        if (isCancelledRef.current) return;
        
        setData(prev => {
          if (!prev) return null;
          const updated = { ...prev, assets };
          // 异步保存一次
          handleSaveTask(updated);
          return updated;
        });
        setIsAssetExtractionComplete(true);
      }).catch(err => {
        console.error("Background asset scan failed:", err);
        setIsAssetExtractionComplete(true);
        const errorMsg = formatErrorMessage(err, '资产扫描失败');
        setAutomationError(errorMsg);
        setToast({ message: errorMsg, type: 'error' });
      });
      
      if (fullAuto) {
        // 全自动模式下，我们需要等待 assets 完成才能继续
        const finalAssets = await assetsPromise;
        const finalData = { ...initialData, assets: finalAssets };
        const dataWithSegments = await handleConfirmAssets(finalData);
        if (dataWithSegments) {
          handleFullAutomation(dataWithSegments);
        }
      }
    } catch (error: any) {
      // Refund points on failure
      await refundPoints(totalCost, `资产扫描失败退款`);
      
      console.error('Asset scan failed:', error);
      setAutomationError(formatErrorMessage(error, '资产扫描失败'));
      // Stay in GENERATING step to show the error UI
    } finally {
      if (!fullAuto) {
        setLoadingMsg('');
      }
    }
  };

  const handleRescanAssetsOnly = async () => {
    if (!checkApiKey('script')) return;
    
    let scriptToProcess = script;
    if (uploadedFileContent) {
      scriptToProcess = (script || '').trim() 
        ? `${uploadedFileContent}\n\n【用户补充说明】：\n${script}` 
        : uploadedFileContent;
    }

    if (!(scriptToProcess || '').trim()) {
      setToast({ message: "请输入剧本内容或上传有效的剧本文件。", type: 'error' });
      return;
    }

    // Deduct points based on input length: 2 credits per 2000 characters
    const inputCost = Math.ceil(scriptToProcess.length / 2000) * (GENERATION_COSTS.DIRECTOR as any).SCRIPT_INPUT_PER_2000;
    const result = await deductPoints(inputCost, '重新扫描资产');
    if (!result.success) {
      setToast({ message: result.error || '积分不足', type: 'error' });
      return;
    }

    setStep(Step.GENERATING);
    setLoadingMsg('正在深度解析剧本...');
    
    try {
      // 启动两个异步任务
      const analysisPromise = pipelineService.analyzeScript(scriptToProcess, config);
      const assetsPromise = pipelineService.preScanAssets(
        scriptToProcess,
        selectedVisualStyle === '自定义' ? customVisualStyle : selectedVisualStyle,
        config,
        data?.assets || [],
        styleImageUrl
      );

      // 等待分析结果，以便尽快进入 ANALYZING 界面展示创意要点
      const analysis = await analysisPromise;
      setScriptAnalysis(analysis);
      
      setStep(Step.ANALYZING);
      setIsAssetExtractionComplete(false);
      setRevealIndex(0); // 重置揭示索引

      // 在后台继续等待资产扫描完成
      assetsPromise.then(async (newAssets) => {
        setData(prev => {
          if (!prev) return null;
          
          // CRITICAL: Merge newAssets with existing assets to preserve generatedMedia
          const mergedAssets = newAssets.map(newAsset => {
            const existing = prev.assets.find(a => a.id === newAsset.id || a.name === newAsset.name);
            if (existing) {
              return {
                ...newAsset,
                id: existing.id, // Keep existing ID if name matched
                generatedMedia: existing.generatedMedia,
                variants: newAsset.variants?.map(newV => {
                  const existingV = existing.variants?.find(v => v.id === newV.id || v.name === newV.name);
                  if (existingV) {
                    return { ...newV, id: existingV.id, generatedMedia: existingV.generatedMedia };
                  }
                  return newV;
                }) || []
              };
            }
            return newAsset;
          });

          const updated = { ...prev, assets: mergedAssets };
          handleSaveTask(updated);
          return updated;
        });
        setIsAssetExtractionComplete(true);
        setToast({ message: '资产库更新成功', type: 'success' });
      }).catch(err => {
        console.error("Background rescan failed:", err);
        setIsAssetExtractionComplete(true);
        setToast({ message: `资产扫描失败: ${err?.message || '未知错误'}`, type: 'error' });
      });

    } catch (error: any) {
      // Refund points on failure
      await refundPoints(inputCost, '重新扫描资产失败退款');
      
      console.error('Rescan failed:', error);
      setToast({ message: `分析失败: ${error?.message || '未知错误'}`, type: 'error' });
      setStep(Step.RESULT);
    } finally {
      setLoadingMsg('');
    }
  };

  const handleConfirmAssets = async (overrideData?: PipelineData): Promise<PipelineData | null> => {
    isCancelledRef.current = false;
    const currentData = overrideData || data;
    if (!currentData) return null;
    
    if (step !== Step.RESULT) {
      setStep(Step.GENERATING);
    }
    setLoadingMsg('正在核对积分...');
    
    // Deduct points: 0 credits per 1000 characters of script for output
    const cost = Math.ceil(currentData.originalScript.length / 1000) * (GENERATION_COSTS.DIRECTOR as any).STORYBOARD_OUTPUT_PER_1000;
    if (cost > 0) {
      const result = await deductPoints(cost, `分镜生成 (剧本长度: ${currentData.originalScript.length}字)`);
      if (isCancelledRef.current) return null;
      if (!result.success) {
        setToast({ message: result.error || '积分不足', type: 'error' });
        setStep(Step.RESULT);
        return null;
      }
    }

    setIsGeneratingTask(true);
    setLoadingMsg(`正在为初始剧本生成${isFlexibleDuration !== 'fixed' ? '灵活时长' : ' 15s'}分段...`);
    
    try {
      const result = await pipelineService.callProcessScriptApi(
        currentData.originalScript, 
        currentData.directorStyle, 
        currentData.aspectRatio || '9:16', 
        currentData.visualStyle, 
        config, 
        currentData.assets, 
        false, 
        currentData.narrativeMode || 'detailed', 
        isAutoTargetSegments ? 0 : (targetSegments || 4),
        false,
        null,
        '',
        true, // onlySegments
        productionMode,
        isFlexibleDuration === 'fixed' ? false : isFlexibleDuration,
        spatialMode
      );

      const mergedAssets = [...(currentData.assets || [])];
      if (result.assets && Array.isArray(result.assets)) {
        result.assets.forEach((na: any) => {
          if (!mergedAssets.find(ma => ma.id === na.id || ma.name === na.name)) {
            mergedAssets.push(na);
          }
        });
      }

      const sanitizedSegments = sanitizeSegmentAssets(result.segments || [], mergedAssets);

      const newTask: Task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        script: currentData.originalScript,
        segments: sanitizedSegments,
        status: 'segments_generated',
        isExpanded: true
      };

      const updatedData = {
        ...currentData,
        id: (currentData.id && currentData.id !== 'null' && currentData.id !== 'undefined') ? currentData.id : `pipeline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: currentData.name || `剧本任务_${new Date().toLocaleString()}`,
        timestamp: currentData.timestamp || Date.now(),
        assets: mergedAssets,
        tasks: [newTask],
        segments: sanitizedSegments
      };

      setData(updatedData);
      handleSaveTask();
      setAutomationError(null); // Clear any previous error
      
      setStep(Step.RESULT);
      
      setTimeout(() => {
        taskListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return updatedData;
    } catch (error: any) {
      // Refund points on failure
      await refundPoints(cost, `分镜生成失败退款 (剧本长度: ${currentData.originalScript.length}字)`);
      
      const errorMsg = formatErrorMessage(error, '分段生成失败');
      setAutomationError(errorMsg);
      
      // If we were already in RESULT, stay there to show error in the box
      if (step !== Step.RESULT) {
        setStep(Step.GENERATING);
      }
      return null;
    } finally {
      setIsGeneratingTask(false);
      setLoadingMsg('');
    }
  };

  const updateTaskScript = (taskId: string, newScript: string) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tasks: (prev.tasks || []).map(t => t.id === taskId ? { ...t, script: newScript } : t)
      };
    });
  };

  const toggleTaskScriptExpansion = (taskId: string) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tasks: (prev.tasks || []).map(t => t.id === taskId ? { ...t, isExpanded: !t.isExpanded } : t)
      };
    });
  };

  const handleRegenerateSegmentsForTask = async (taskId: string) => {
    if (!checkApiKey('script')) return;
    const task = data?.tasks?.find(t => t.id === taskId);
    if (!task || !data) return;
    
    // Deduct points: 0 credits per 1000 characters of script for output
    const cost = Math.ceil(task.script.length / 1000) * (GENERATION_COSTS.DIRECTOR as any).STORYBOARD_OUTPUT_PER_1000;
    if (cost > 0) {
      const result = await deductPoints(cost, `重新生成分段 (剧本长度: ${task.script.length}字)`);
      if (!result.success) {
        setToast({ message: result.error || '积分不足', type: 'error' });
        return;
      }
    }

    setData(prev => prev ? {
      ...prev,
      tasks: (prev.tasks || []).map(t => t.id === taskId ? { ...t, status: 'generating' } : t)
    } : null);
    
    // Clear existing errors for this task's segments
    setSegmentErrors(prev => {
      const next = { ...prev };
      task.segments?.forEach(s => {
        delete next[s.id || `seg_${s.index}`];
      });
      return next;
    });
    
    try {
      const result = await pipelineService.processScript(
        task.script, 
        data.directorStyle, 
        data.aspectRatio || '9:16', 
        data.visualStyle, 
        config, 
        (msg) => console.log(msg),
        data.narrativeMode || 'detailed', 
        isAutoTargetSegments ? 0 : (targetSegments || 4),
        data?.assets || [], 
        '',
        productionMode,
        isFlexibleDuration === 'fixed' ? false : isFlexibleDuration,
        spatialMode
      );

      setData(prev => {
        if (!prev) return null;
        
        // Merge any new assets found in this task's script into the global library
        const mergedAssets = [...(prev.assets || [])];
        if (result.assets && Array.isArray(result.assets)) {
          result.assets.forEach((na: any) => {
            if (!mergedAssets.find(ma => ma.id === na.id || ma.name === na.name)) {
              mergedAssets.push(na);
            }
          });
        }

        const updatedData = {
          ...prev,
          assets: mergedAssets,
          tasks: (prev.tasks || []).map(t => 
            t.id === taskId 
              ? { ...t, segments: sanitizeSegmentAssets(result.segments || [], mergedAssets), status: 'segments_generated' as const }
              : t
          )
        };

        // Defer side effect to avoid React state update conflicts
        setTimeout(() => handleSaveTask(), 0);
        return updatedData;
      });
    } catch (error: any) {
      // Refund points on failure
      await refundPoints(cost, `重新生成分段失败退款 (剧本长度: ${task.script.length}字)`);
      
      setToast({ message: `重新生成分段失败: ${error?.message || '未知错误'}`, type: 'error' });
      setData(prev => prev ? {
        ...prev,
        tasks: (prev.tasks || []).map(t => t.id === taskId ? { ...t, status: 'segments_generated' } : t)
      } : null);
    }
  };

  const handleRegenerateSegmentPrompt = async (segmentId: string, taskId?: string) => {
    if (!checkApiKey('script')) return;
    if (!data) return;
    
    const seg = data.segments?.find(s => s.id === segmentId) || (data?.tasks || []).flatMap(t => t.segments || []).find(s => s.id === segmentId);
    if (!seg) return;

    const key = segmentId;
    setGeneratingSegments(p => ({ ...p, [key]: "正在优化提示词..." }));
    
    try {
      const result = await pipelineService.callProcessScriptApi(
        seg.plotAnchor || seg.prompt, 
        data.directorStyle, 
        data.aspectRatio || '9:16', 
        data.visualStyle, 
        config, 
        data?.assets || [], 
        true, 
        data.narrativeMode || 'detailed', 
        data.targetSegments || 4,
        false,
        null,
        '',
        false,
        productionMode
      );

      if (result.segments && result.segments.length > 0) {
        const newPrompt = result.segments?.[0]?.prompt;
        
        const mergedAssets = [...(data?.assets || [])];
        if (result.assets && Array.isArray(result.assets)) {
          result.assets.forEach((na: any) => {
            if (!mergedAssets.find(ma => ma.id === na.id || ma.name === na.name)) {
              mergedAssets.push(na);
            }
          });
        }

        const updatedSegments = (data?.segments || []).map(s => s.id === segmentId ? { ...s, prompt: newPrompt } : s);
        const updatedTasks = (data?.tasks || []).map(t => ({
          ...t,
          segments: (t.segments || []).map(s => s.id === segmentId ? { ...s, prompt: newPrompt } : s)
        }));

        setData(prev => {
          if (!prev) return null;
          const updated = {
            ...prev,
            assets: mergedAssets,
            segments: updatedSegments,
            tasks: updatedTasks
          };
          handleSaveTask();
          return updated;
        });
      }
    } catch (error: any) {
      console.error('Regenerate segment prompt failed:', error);
      setSegmentErrors(p => ({ ...p, [key]: error?.message || '优化失败' }));
    } finally {
      setGeneratingSegments(p => ({ ...p, [key]: '' }));
    }
  };

  const handleOptimizeSegmentPrompt = async (taskId: string, segmentId: string) => {
    if (!checkApiKey('script')) return;
    if (!data) return;
    
    const task = data.tasks?.find(t => t.id === taskId);
    const segments = task?.segments || [];
    const segIndex = segments.findIndex(s => s.id === segmentId);
    const seg = segments[segIndex];
    if (!seg || !task) return;

    const lastSegmentContext = segIndex > 0 ? segments[segIndex - 1] : null;

    const key = `${taskId}_${segmentId}`;
    setOptimizingPrompts(p => ({ ...p, [key]: true }));
    
    try {
      const newPrompt = await pipelineService.regenerateSegmentPrompt(
        seg, 
        task.script, 
        data.directorStyle, 
        data.aspectRatio || '9:16', 
        data.visualStyle, 
        config, 
        data.assets || [], 
        '',
        lastSegmentContext,
        productionMode,
        spatialMode
      );

      if (newPrompt) {
        setData(prev => {
          if (!prev) return null;
          
          // Create a temporary data object to run fuzzyBindAssets on
          const tempData: PipelineData = {
            ...prev,
            tasks: (prev.tasks || []).map(t => 
              t.id === taskId 
                ? { ...t, segments: (t.segments || []).map(s => s.id === segmentId ? { ...s, prompt: newPrompt } : s) }
                : t
            )
          };
          
          // Re-run fuzzy binding for the entire task (or just the segment if possible, but fuzzyBindAssets takes PipelineData)
          const boundData = pipelineService.fuzzyBindAssets(tempData);
          
          handleSaveTask();
          return boundData;
        });
        setToast({ message: '提示词优化成功', type: 'success' });
      }
    } catch (error: any) {
      console.error('Optimize segment prompt failed:', error);
      setToast({ message: `提示词优化失败: ${error?.message || '未知错误'}`, type: 'error' });
    } finally {
      setOptimizingPrompts(p => ({ ...p, [key]: false }));
    }
  };

  // handleRefineAssetPrompts removed as per user request to delete prompt optimization function.

  const handleAssetGen = async (id: string, isMain = true, overridePrompt?: string, forceRegen = false, referenceUrl?: string, variantId?: string) => {
    const type = isMain ? 'main' : 'secondary';
    const key = `${id}-${type}${variantId ? `-${variantId}` : ''}`;
    
    if (generatingAssets[key]) return;

    const currentData = dataRef.current || data;
    const asset = currentData?.assets?.find(a => a.id === id);
    if (!asset || !currentData) return;

    cancelledAssetsRef.current.delete(key);
    setGeneratingAssets(p => ({ ...p, [key]: "正在生成视觉指令..." }));
    setAssetErrors(p => ({ ...p, [key]: '' }));
    setToast({ message: `正在为 ${asset.name} 生成${variantId ? '变体' : '主体'}指令...`, type: 'info' });

    try {
      const generatedSubAssets = await pipelineService.generateSingleAssetPrompts(asset, data?.visualStyle, config, styleImageUrl);

      if (cancelledAssetsRef.current.has(key)) return;

      if (generatedSubAssets && generatedSubAssets.mainPrompt) {
        setData(prev => {
          if (!prev) return null;
          const updated = {
            ...prev,
            assets: prev.assets.map(a => {
              if (a.id !== id) return a;
              if (variantId) {
                const variantExists = prev.assets.find(ax => ax.id === id)?.variants?.some(v => v.id === variantId || v.name === variantId);
                
                return {
                  ...a,
                  variants: variantExists 
                    ? a.variants?.map(v => (v.id === variantId || v.name === variantId) ? { ...v, prompt: generatedSubAssets.mainPrompt } : v)
                    : [...(a.variants || []), { id: variantId, name: variantId, prompt: generatedSubAssets.mainPrompt }]
                };
              }
              const isLayout = a.details?.clothing === '布局图';
              return {
                ...a,
                subAssets: {
                  ...a.subAssets,
                  [isLayout ? 'layoutPrompt' : (isMain ? 'mainPrompt' : 'secondaryPrompt')]: generatedSubAssets.mainPrompt
                }
              };
            })
          };
          setTimeout(() => handleSaveTask(updated), 0);
          return updated;
        });
      }
    } catch (error) {
      console.error("Asset Gen Error:", error);
      setAssetErrors(p => ({ ...p, [key]: error instanceof Error ? error.message : String(error) }));
    } finally {
      setGeneratingAssets(p => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

  const handleAssetImageGen = async (assetId: string, isMain: boolean, variantId?: string, force: boolean = false) => {
    const asset = dataRef.current?.assets.find(a => a.id === assetId);
    if (!asset) return;
    
    let prompt = '';
    let target = '';
    const isLayout = asset.details?.clothing === '布局图';
    
    if (variantId) {
      const v = asset.variants?.find(vx => vx.id === variantId);
      prompt = v?.prompt || '';
      target = 'variant';
    } else if (isLayout) {
      prompt = asset.subAssets.layoutPrompt || asset.subAssets.secondaryPrompt || '';
      target = 'layout';
    } else {
      prompt = isMain ? asset.subAssets.mainPrompt : asset.subAssets.secondaryPrompt;
      target = isMain ? 'main' : 'secondary';
    }

    if (!prompt) return;

    const key = `${assetId}-${target}${variantId ? `-${variantId}` : ''}`;
    if (generatingAssets[key]) return;

    if (!force) {
      if (variantId) {
        const vx = asset.variants?.find(v => v.id === variantId);
        if (vx?.imageUrl) return;
      } else if (isMain) {
        if (asset.generatedMedia?.mainImageUrl) return;
      } else {
        if (asset.generatedMedia?.secondaryMediaUrl) return;
      }
    }

    setGeneratingAssets(prev => ({ ...prev, [key]: 'image' }));

    try {
      const refImage = !isMain ? asset.generatedMedia?.mainImageUrl : undefined;
      
      // Handle specialized grid modes based on category (stored in clothing)
      let gridMode: any = 'none';
      if (asset.details?.clothing === '角色设定图') {
        gridMode = 'six-view';
      } else if (asset.details?.clothing === '三视图') {
        gridMode = 'three-view';
      }

      // Special prompt enhancement for specific categories
      let finalPrompt = prompt;
      let aspectRatio: any = '1:1';
      if (asset.type === 'scene') {
        if (asset.details?.clothing === '布局图') {
          finalPrompt += ' -- 这是一个场景布局图，俯视图，顶视角，Blueprint, Top-down architectural floor plan, technical drawing.';
          aspectRatio = '16:9';
        } else if (asset.details?.clothing === '720全景') {
          finalPrompt += ' -- 这是一个720全景图，等距柱状投影，Equirectangular 360 panorama projection, wide view.';
          aspectRatio = '16:9'; // Or '21:9' if supported by the model
        }
      }

      const imageConfig = {
        prompt: finalPrompt,
        aspectRatio,
        imageSize: '1K' as any,
        model: config.image.model,
        gridMode,
        referenceImages: [
          ...(refImage ? [{ data: refImage, mimeType: 'image/png', type: asset.type as any }] : []),
          ...(styleImageUrl ? [{ data: styleImageUrl, mimeType: 'image/png', type: 'environment' as any }] : [])
        ]
      };

      let result;
      if (gridMode === 'six-view' && refImage) {
        // Use specialized six-view generation for characters
        result = await pipelineService.generateSixView(asset, refImage, config, variantId);
      } else if (gridMode === 'three-view' && refImage && asset.type === 'prop') {
        // Use specialized triple-view generation for props
        result = await pipelineService.generatePropSixView(asset, refImage, config);
      } else if (gridMode === 'scene-plan' && refImage && asset.type === 'scene') {
        // Use specialized six-view generation for scenes
        result = await pipelineService.generateSixView(asset, refImage, config);
      } else {
        result = await pipelineService.generateSmartImage(imageConfig, config);
      }

      setData(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          assets: prev.assets.map(a => {
            if (a.id !== assetId) return a;
            if (variantId) {
              const variantExists = a.variants?.some(v => v.id === variantId || v.name === variantId);
              return {
                ...a,
                variants: variantExists
                  ? a.variants?.map(v => (v.id === variantId || v.name === variantId) ? { ...v, imageUrl: result.imageUrl } : v)
                  : [...(a.variants || []), { id: variantId, name: variantId, imageUrl: result.imageUrl }]
              };
            }
            const isLayout = a.details?.clothing === '布局图';
            return {
              ...a,
              generatedMedia: {
                ...a.generatedMedia,
                [isLayout ? 'layoutUrl' : (isMain ? 'mainImageUrl' : 'secondaryMediaUrl')]: result.imageUrl
              }
            };
          })
        };
        handleSaveTask(updated);
        return updated;
      });
    } catch (error) {
      console.error("Asset Image Gen Error:", error);
      setAssetErrors(p => ({ ...p, [key]: error instanceof Error ? error.message : String(error) }));
    } finally {
      setGeneratingAssets(p => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

  const handleGenerateAllAssets = async () => {
    if (!checkApiKey('image')) return;
    if (isGeneratingAll) return;

    setIsGeneratingAll(true);
    setToast({ message: '正在启动全量生成，请保持网络连接...', type: 'info' });

    const runBatch = async (items: any[], batchSize: number, taskFn: (item: any) => Promise<void>) => {
      for (let i = 0; i < items.length; i += batchSize) {
        if (syncAbortControllerRef.current?.signal.aborted) break;
        const chunk = items.slice(i, i + batchSize);
        await Promise.all(chunk.map(item => taskFn(item)));
      }
    };

    try {
      const currentData = dataRef.current;
      if (!currentData || !currentData.assets) return;
      const assets = currentData.assets;

      // Phase 1: Basic Prompts
      setGenerateAllProgress({ current: 0, total: assets.length, phase: '生成指令' });
      await runBatch(assets, 3, async (asset) => {
        const freshAsset = dataRef.current?.assets.find(a => a.id === asset.id);
        if (freshAsset && !freshAsset.subAssets?.mainPrompt) {
          await handleAssetGen(asset.id, true);
        }
        setGenerateAllProgress(prev => ({ ...prev, current: prev.current + 1 }));
      });

      // Phase 2: Basic Main Images
      setGenerateAllProgress({ current: 0, total: assets.length, phase: '生成主图' });
      await runBatch(assets, 2, async (asset) => {
        const freshAsset = dataRef.current?.assets.find(a => a.id === asset.id);
        if (freshAsset && freshAsset.subAssets?.mainPrompt && !freshAsset.generatedMedia?.mainImageUrl) {
          await handleAssetImageGen(asset.id, true);
        }
        setGenerateAllProgress(prev => ({ ...prev, current: prev.current + 1 }));
      });

      // Phase 3: Secondary Assets (Derivative)
      const secondaryTasks: any[] = [];
      dataRef.current?.assets.forEach(asset => {
        secondaryTasks.push({ id: asset.id, type: 'secondary' });
        if (asset.type === 'scene') {
          secondaryTasks.push({ id: asset.id, type: 'layout' });
        }
      });

      setGenerateAllProgress({ current: 0, total: secondaryTasks.length, phase: '生成衍生资产' });
      await runBatch(secondaryTasks, 2, async (task) => {
        const asset = dataRef.current?.assets.find(a => a.id === task.id);
        if (!asset) return;

        if (task.type === 'secondary') {
           if (asset.type === 'scene') {
             await handleSceneSecondaryGen(asset.id);
           } else {
             const freshAsset = dataRef.current?.assets.find(a => a.id === task.id);
             if (freshAsset) {
               if (!freshAsset.subAssets?.secondaryPrompt) {
                 await handleAssetGen(asset.id, false);
               }
               await handleAssetImageGen(asset.id, false);
             }
           }
        } else if (task.type === 'layout') {
          await handleSceneLayoutGen(asset.id);
        }
        setGenerateAllProgress(prev => ({ ...prev, current: prev.current + 1 }));
      });

      // Phase 4: Variant Images
      const variantTasks: any[] = [];
      dataRef.current?.assets.forEach(asset => {
        asset.variants?.forEach(v => {
          if (!v.imageUrl) variantTasks.push({ assetId: asset.id, variantId: v.id });
        });
      });

      if (variantTasks.length > 0) {
        setGenerateAllProgress({ current: 0, total: variantTasks.length, phase: '生成变体图片' });
        await runBatch(variantTasks, 2, async (task) => {
          await handleAssetImageGen(task.assetId, false, task.variantId);
          setGenerateAllProgress(prev => ({ ...prev, current: prev.current + 1 }));
        });
      }

      setToast({ message: '所有资产生成任务已完成', type: 'success' });
    } catch (error) {
      console.error('Generate all failed:', error);
      setToast({ message: '部分生成任务失败，请手动重试', type: 'error' });
    } finally {
      setIsGeneratingAll(false);
      setGenerateAllProgress({ current: 0, total: 0, phase: '' });
    }
  };

  const handleVariantGen = async (assetId: string, variantId: string) => {
    // Redirect to handleAssetGen for instruction generation
    return handleAssetGen(assetId, true, undefined, true, undefined, variantId);
  };

  const handleAIVariantDesign = async (assetId: string) => {
    if (!checkApiKey('script')) return;
    const asset = data?.assets?.find(a => a.id === assetId);
    if (!asset || !data) return;

    setGeneratingAssets(p => ({ ...p, [`${assetId}_design`]: "生成更多形象中..." }));
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("生成超时，请重试")), 600000)
      );
      const variants = await Promise.race([
        pipelineService.generateCharacterVariants(
          data.originalScript, 
          asset.name, 
          data.visualStyle, 
          config, 
          asset.generatedMedia?.mainImageUrl,
          asset.subAssets?.mainPrompt
        ),
        timeoutPromise
      ]) as AssetVariant[];
      
      const variantsWithUniqueIds = variants.map((v, idx) => ({
        ...v,
        id: `${assetId}_v${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      }));
      
      if (!data) return;
      setData(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          assets: prev.assets.map(a => a.id === assetId ? {
            ...a,
            variants: (() => {
              const existingPrompts = new Set((a.variants || []).map(v => v.prompt?.trim()));
              const existingNames = new Set((a.variants || []).map(v => v.name?.trim()));
              const newVariants = variantsWithUniqueIds.filter(v => {
                const p = v.prompt?.trim();
                if (p && existingPrompts.has(p)) return false;
                if (p) existingPrompts.add(p);
                return true;
              }).map(v => {
                let finalName = v.name?.trim() || '新形象';
                let counter = 1;
                const baseName = finalName;
                while (existingNames.has(finalName)) {
                  counter++;
                  finalName = `${baseName} (${counter})`;
                }
                existingNames.add(finalName);
                return { ...v, name: finalName };
              });
              return [...(a.variants || []), ...newVariants];
            })()
          } : a)
        };
        // Defer side effect to avoid React state update conflicts
        setTimeout(() => handleSaveTask(), 0);
        return updated;
      });
    } catch (e: any) {
      setAssetErrors(p => ({ ...p, [`${assetId}_design`]: e?.message || '设计失败' }));
    } finally {
      setGeneratingAssets(p => ({ ...p, [`${assetId}_design`]: '' }));
    }
  };

  const handleDeleteVariant = (assetId: string, variantId: string) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        assets: prev.assets.map(a => a.id === assetId ? {
          ...a,
          variants: a.variants?.filter(v => v.id !== variantId)
        } : a)
      };
    });
  };

  const handleAddManualVariant = (assetId: string) => {
    setData(prev => {
      if (!prev) return null;
      const asset = prev.assets.find(a => a.id === assetId);
      if (!asset) return prev;
      
      const newVariant: AssetVariant = {
        id: `variant_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: `新形象 ${ (asset.variants?.length || 0) + 1 }`,
        prompt: '',
        imageUrl: '',
        threeViewUrl: ''
      };
      
      return {
        ...prev,
        assets: prev.assets.map(a => a.id === assetId ? {
          ...a,
          variants: [...(a.variants || []), newVariant]
        } : a)
      };
    });
  };

  const handleDownloadAllAssetImages = async (asset: Asset) => {
    const zip = new JSZip();
    const folder = zip.folder(`${asset.name}_${asset.id}`);
    
    const addFileToZip = async (url: string, name: string) => {
      try {
        const response = await fetchWithProxy(url);
        const blob = await response.blob();
        folder?.file(name, blob);
      } catch (e) {
        console.error(`添加 ${name} 到压缩包失败`, e);
      }
    };

    const tasks: Promise<void>[] = [];
    if (asset.generatedMedia?.mainImageUrl) tasks.push(addFileToZip(asset.generatedMedia.mainImageUrl, "主图.png"));
    if (asset.generatedMedia?.secondaryMediaUrl) tasks.push(addFileToZip(asset.generatedMedia.secondaryMediaUrl, asset.type === 'scene' ? "四向视图.png" : "角色设定图.png"));
    if (asset.generatedMedia?.layoutUrl) tasks.push(addFileToZip(asset.generatedMedia.layoutUrl, "布局图.png"));
    if (asset.generatedMedia?.combinedUrl) tasks.push(addFileToZip(asset.generatedMedia.combinedUrl, "场景方案.png"));
    
    asset.variants?.forEach(v => {
      if (v.imageUrl) tasks.push(addFileToZip(v.imageUrl, `${v.name}_主图.png`));
      if (v.threeViewUrl) tasks.push(addFileToZip(v.threeViewUrl, `${v.name}_角色设定图.png`));
    });

    if (tasks.length === 0) {
      setToast({ message: '没有可下载的图片', type: 'error' });
      return;
    }

    await Promise.all(tasks);
    const content = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${asset.name}_资产包.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSceneSecondaryGen = async (id: string, forceRegen = false) => {
    if (!checkApiKey('image')) return;
    const asset = data?.assets?.find(a => a.id === id);
    if (!asset || !data || asset.type !== 'scene') return;

    if (!forceRegen && asset.generatedMedia?.secondaryMediaUrl) return;

    const key = `${id}-secondary`;
    cancelledAssetsRef.current.delete(key);
    setGeneratingAssets(p => ({ ...p, [key]: "正在生成四向视图..." }));
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("生成超时，请重试")), 600000)
      );
      const basePrompt = asset.subAssets.secondaryPrompt || asset.subAssets.mainPrompt || '';
      const prompt = `你是一位场景设计师。请【深度分析并提取】参考图（图1）中的所有视觉细节（建筑风格、空间布局、核心物件、色调氛围）。
【极其重要】：
1. **视觉一致性**：生成的四向视图必须与参考图（图1）在视觉和空间逻辑上高度一致。
2. **布局规范**：展示该场景的四个主要角度（正视、背视、左视、右视）的 2x2 拼图。
3. **画风设定**：**电影级写实摄影质感**，真实摄影质感，专业摄影大师作品。风格必须与参考图（图1）完全一致。
4. **环境设定**：纯白背景，无阴影或极简阴影，高清细节。
5. **提示词冲突处理**：如果下方的“参考描述”与“参考图”存在任何冲突，请【完全以参考图为准】。

【参考描述（仅供风格参考）】：${basePrompt}`;
      const refImage = asset.generatedMedia?.mainImageUrl;
      
      const result = await Promise.race([
        pipelineService.generateSmartImage({
          prompt,
          aspectRatio: '9:16',
          imageSize: (data.imageQuality as any) || '2K',
          referenceImages: refImage ? [{
            data: refImage,
            mimeType: 'image/png',
            type: 'environment'
          }] : undefined
        }, config),
        timeoutPromise
      ]) as SmartImageResult;

      if (cancelledAssetsRef.current.has(key)) return;

      if (!data) return;
      setData(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          assets: prev.assets.map(a => a.id === id ? {
            ...a,
            generatedMedia: {
              ...a.generatedMedia,
              secondaryMediaUrl: result.imageUrl
            }
          } : a)
        };
        // Defer side effect to avoid React state update conflicts
        setTimeout(() => handleSaveTask(), 0);
        return updated;
      });
    } catch (e: any) {
      if (cancelledAssetsRef.current.has(key)) return;
      const errorMsg = (e.message && e.message !== '[object Object]') ? e.message : (typeof e === 'object' ? (e.message || JSON.stringify(e)) : String(e)) || '生成失败';
      setAssetErrors(p => ({ ...p, [key]: errorMsg }));
    } finally {
      cancelledAssetsRef.current.delete(key);
      setGeneratingAssets(p => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

  const handleSceneLayoutGen = async (id: string, forceRegen = false) => {
    if (!checkApiKey('image')) return;
    const asset = data?.assets?.find(a => a.id === id);
    if (!asset || !data || asset.type !== 'scene') return;

    if (!forceRegen && asset.generatedMedia?.layoutUrl) return;

    // Deduct points
    const cost = GENERATION_COSTS.IMAGE[data.imageQuality as keyof typeof GENERATION_COSTS.IMAGE] || 6;
    const result = await deductPoints(cost, `场景布局图生成 (${asset.name})`);
    if (!result.success) {
      setToast({ message: result.error || '积分不足', type: 'error' });
      return;
    }

    const key = `${id}-layout`;
    cancelledAssetsRef.current.delete(key);
    setGeneratingAssets(p => ({ ...p, [key]: "正在生成布局图..." }));
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("生成超时，请重试")), 600000)
      );
      const prompt = asset.subAssets.layoutPrompt || `你是一位场景设计师。请【深度分析并提取】参考图（图1）中的空间布局和家具位置。
【极其重要】：
1. **空间一致性**：生成的布局图必须与参考图（图1）展示的空间逻辑完全一致。
2. **布局规范**：场景俯视布局图，展示家具、门窗的相对位置，线条清晰。
3. **画风设定**：**电影级写实摄影质感**，真实摄影质感。
4. **提示词冲突处理**：如果下方的“参考描述”与“参考图”存在任何冲突，请【完全以参考图为准】。

【参考描述（仅供风格参考）】：${asset.subAssets.mainPrompt || ''}`;
      const refImage = asset.generatedMedia?.mainImageUrl;
      
      const result = await Promise.race([
        pipelineService.generateSmartImage({
          prompt,
          aspectRatio: '9:16',
          imageSize: (data.imageQuality as any) || '2K',
          referenceImages: refImage ? [{
            data: refImage,
            mimeType: 'image/png',
            type: 'environment'
          }] : undefined
        }, config),
        timeoutPromise
      ]) as SmartImageResult;
      
      if (cancelledAssetsRef.current.has(key)) return;

      if (!data) return;
      setData(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          assets: prev.assets.map(a => a.id === id ? {
            ...a,
            generatedMedia: {
              ...a.generatedMedia,
              layoutUrl: result.imageUrl
            }
          } : a)
        };
        // Defer side effect to avoid React state update conflicts
        setTimeout(() => handleSaveTask(), 0);
        return updated;
      });
    } catch (e: any) {
      if (cancelledAssetsRef.current.has(key)) return;
      
      // Refund points on failure
      await refundPoints(cost, `场景布局图生成失败退款 (${asset.name})`);
      
      const errorMsg = (e.message && e.message !== '[object Object]') ? e.message : (typeof e === 'object' ? (e.message || JSON.stringify(e)) : String(e)) || '生成失败';
      setAssetErrors(p => ({ ...p, [key]: errorMsg }));
    } finally {
      cancelledAssetsRef.current.delete(key);
      setGeneratingAssets(p => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

  const handleSceneCombinedGen = async (id: string, forceRegen = false) => {
    if (!checkApiKey('image')) return;
    const asset = data?.assets?.find(a => a.id === id);
    if (!asset || !data || asset.type !== 'scene') return;

    if (!forceRegen && asset.generatedMedia?.combinedUrl) return;

    // Deduct points
    const cost = GENERATION_COSTS.IMAGE[data.imageQuality as keyof typeof GENERATION_COSTS.IMAGE] || 6;
    const result = await deductPoints(cost, `场景方案生成 (${asset.name})`);
    if (!result.success) {
      setToast({ message: result.error || '积分不足', type: 'error' });
      return;
    }

    const key = `${id}-combined`;
    cancelledAssetsRef.current.delete(key);
    setGeneratingAssets(p => ({ ...p, [key]: "正在生成场景方案..." }));
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("生成超时，请重试")), 600000)
      );
      const basePrompt = asset.subAssets.combinedPrompt || asset.subAssets.mainPrompt || '';
      const prompt = `你是一位场景设计师。请【深度分析并提取】参考图（图1）中的所有视觉细节和空间布局。
【极其重要】：
1. **视觉一致性**：生成的场景方案必须与参考图（图1）在视觉风格和空间逻辑上高度一致。
2. **布局规范**：一张组合图，展示两个部分：上半部分是该场景的四向视图（2x2网格，包含正视、背视、左视、右视），下半部分是该场景的俯视布局图（展示家具 and 空间布局）。
3. **画风设定**：**电影级写实摄影质感**，真实摄影质感，专业摄影大师作品。风格必须与参考图（图1）完全一致。
4. **提示词冲突处理**：如果下方的“参考描述”与“参考图”存在任何冲突，请【完全以参考图为准】。

【参考描述（仅供风格参考）】：${basePrompt}`;
      const refImage = asset.generatedMedia?.mainImageUrl;
      
      const result = await Promise.race([
        pipelineService.generateSmartImage({
          prompt,
          aspectRatio: '9:16',
          imageSize: (data.imageQuality as any) || '2K',
          referenceImages: refImage ? [{
            data: refImage,
            mimeType: 'image/png',
            type: 'environment'
          }] : undefined
        }, config),
        timeoutPromise
      ]) as SmartImageResult;
      
      if (cancelledAssetsRef.current.has(key)) return;

      if (!data) return;
      setData(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          assets: prev.assets.map(a => a.id === id ? {
            ...a,
            generatedMedia: {
              ...a.generatedMedia,
              combinedUrl: result.imageUrl
            }
          } : a)
        };
        // Defer side effect to avoid React state update conflicts
        setTimeout(() => handleSaveTask(), 0);
        return updated;
      });
    } catch (e: any) {
      if (cancelledAssetsRef.current.has(key)) return;
      
      // Automatic point refund on scene plan generation failure
      await refundPoints(cost, `场景方案生成失败退款 (${asset.name})`);
      
      const errorMsg = (e.message && e.message !== '[object Object]') ? e.message : (typeof e === 'object' ? (e.message || JSON.stringify(e)) : String(e)) || '生成失败';
      setAssetErrors(p => ({ ...p, [key]: errorMsg }));
    } finally {
      cancelledAssetsRef.current.delete(key);
      setGeneratingAssets(p => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

  const handleCancelAssetGen = (id: string, type: string, variantId?: string) => {
    const key = `${id}-${type}${variantId ? `-${variantId}` : ''}`;
    cancelledAssetsRef.current.add(key);
    setGeneratingAssets(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleConfirmPendingImage = (assetId: string, isMain: boolean, variantId?: string) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        assets: prev.assets.map(a => {
          if (a.id !== assetId) return a;
          if (variantId) {
            const variant = a.variants?.find(v => v.id === variantId);
            if (!variant || !variant.pendingImageUrl) return a;
            const history = [...(variant.history || []), variant.imageUrl].filter(Boolean) as string[];
            return {
              ...a,
              variants: a.variants?.map(v => v.id === variantId ? { 
                ...v, 
                imageUrl: v.pendingImageUrl, 
                pendingImageUrl: undefined,
                history 
              } : v)
            };
          }
          const media = a.generatedMedia;
          if (!media) return a;
          const pendingUrl = isMain ? media.pendingMainImageUrl : media.pendingSecondaryMediaUrl;
          if (!pendingUrl) return a;
          
          const history = a.history || {};
          if (isMain) {
            const mainHistory = [...(history.mainImageHistory || []), media.mainImageUrl].filter(Boolean) as string[];
            return {
              ...a,
              generatedMedia: { ...media, mainImageUrl: pendingUrl, pendingMainImageUrl: undefined },
              history: { ...history, mainImageHistory: mainHistory }
            };
          } else {
            const secondaryHistory = [...(history.secondaryMediaHistory || []), media.secondaryMediaUrl].filter(Boolean) as string[];
            return {
              ...a,
              generatedMedia: { ...media, secondaryMediaUrl: pendingUrl, pendingSecondaryMediaUrl: undefined },
              history: { ...history, secondaryMediaHistory: secondaryHistory }
            };
          }
        })
      };
    });
    setToast({ message: '已确认为主图', type: 'success' });
  };

  const handleDiscardPendingImage = (assetId: string, isMain: boolean, variantId?: string) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        assets: prev.assets.map(a => {
          if (a.id !== assetId) return a;
          if (variantId) {
            return {
              ...a,
              variants: a.variants?.map(v => v.id === variantId ? { ...v, pendingImageUrl: undefined } : v)
            };
          }
          return {
            ...a,
            generatedMedia: {
              ...a.generatedMedia,
              [isMain ? 'pendingMainImageUrl' : 'pendingSecondaryMediaUrl']: undefined
            }
          };
        })
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAssetUpload) return;

    // Duration check for video
    if (file.type.startsWith('video/')) {
      try {
        const duration = await getMediaDuration(file);
        const roundedDuration = parseFloat(duration.toFixed(1));
        if (roundedDuration < 5 || roundedDuration > 15) {
          setToast({ message: `视频时长必须在 5-15 秒之间 (当前: ${roundedDuration.toFixed(1)}s)`, type: 'error' });
          e.target.value = '';
          return;
        }
      } catch (err) {
        setToast({ message: '无法读取视频时长', type: 'error' });
        e.target.value = '';
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const url = event.target?.result as string;
      const { id, type, variantId } = activeAssetUpload;

      if (!data) return;

      let newData: PipelineData | null = null;

      if (type === 'segment') {
        const updatedSegments = (data.segments || []).map(s => s.id === id ? { ...s, generatedVideoUrl: url } : s);
        const updatedTasks = data.tasks?.map(t => ({
          ...t,
          segments: (t.segments || []).map(s => s.id === id ? { ...s, generatedVideoUrl: url } : s)
        }));
        newData = { ...data, segments: updatedSegments, tasks: updatedTasks };
      } else {
        newData = {
          ...data,
          assets: data.assets?.map(a => a.id === id ? {
            ...a,
            generatedMedia: type !== 'variant' ? {
              ...a.generatedMedia,
              [type === 'main' ? 'mainImageUrl' : type === 'layout' ? 'layoutUrl' : 'secondaryMediaUrl']: url
            } : a.generatedMedia,
            variants: type === 'variant' ? a.variants?.map(v => v.id === variantId ? { ...v, imageUrl: url } : v) : a.variants
          } : a)
        };
      }

      if (newData) {
        setData(newData);
        handleSaveTask();
      }
      setActiveAssetUpload(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Reuse handleScriptFileUpload logic
      const mockEvent = { target: { files: [file] } } as any;
      handleScriptFileUpload(mockEvent);
    }
  };

  const handleAssetListDragStart = (e: React.DragEvent, asset: Asset, subType?: 'main' | 'secondary' | 'variant' | 'layout', variantId?: string) => {
    setDraggedAssetFromList(asset);
    let fullId = asset.id;
    if (variantId) {
      fullId = `${asset.id}_v${variantId}`;
    }
    if (subType === 'secondary') fullId += '_v';
    
    e.dataTransfer.setData('assetId', fullId);
    e.dataTransfer.setData('assetType', asset.type);
  };

  const handleAssetDragOver = (e: React.DragEvent, id: string | number, type: string, variantId?: string) => {
    e.preventDefault();
    setDragTargetSegment({ index: id as number, type });
    setDraggedAssetId({ id: id as string, type, variantId });
  };

  const handleAssetDragLeave = () => {
    setDragTargetSegment(null);
    setDraggedAssetId(null);
  };

  const handleAssetDrop = (e: React.DragEvent, targetId: string | number, targetType: string, variantId?: string) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    const asset = draggedAssetFromList || data?.assets?.find(a => a.id === assetId || (assetId && typeof assetId === 'string' && assetId.includes('_v') && !assetId.startsWith('图') && a.id === assetId.split('_v')[0]));
    
    if (asset && targetType === 'segment') {
      handleUpdateBinding(targetId as string, asset.type, 'new', assetId);
    }
    
    setDragTargetSegment(null);
    setDraggedAssetId(null);
    setDraggedAssetFromList(null);
  };

  const triggerUpload = (id: string | number, type: 'main' | 'secondary' | 'segment' | 'variant' | 'layout', variantId?: string) => {
    setActiveAssetUpload({ id, type, variantId });
    fileInputRef.current?.click();
  };

  const parseScriptFile = async (file: File): Promise<string> => {
    let content = '';
    if (file.name.endsWith('.txt')) {
      content = await file.text();
    } else if (file.name.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      content = result.value;
    } else if (file.name.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await safePdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => {
          if ('str' in item) return item.str;
          return '';
        }).join(' ');
        fullText += pageText + '\n';
      }
      content = fullText;
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      let fullText = '';
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = XLSX.utils.sheet_to_csv(worksheet);
        if (sheetText.trim()) {
          fullText += `--- Sheet: ${sheetName} ---\n${sheetText}\n\n`;
        }
      });
      content = fullText;
    } else {
      throw new Error('不支持的文件格式');
    }
    return content;
  };

  const handleScriptFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    try {
      const content = await parseScriptFile(file);
      setUploadedFileContent(content);
    } catch (err: any) {
      console.error('File read error:', err);
      setToast({ message: err.message || '文件读取失败', type: 'error' });
    }
  };

  const handleTaskScriptFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTaskFileUpload) return;

    try {
      const content = await parseScriptFile(file);
      const fileName = file.name;
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          tasks: (prev.tasks || []).map(t => t.id === activeTaskFileUpload ? { ...t, script: content, fileName } : t)
        };
      });
      setToast({ message: '剧本上传成功', type: 'success' });
    } catch (err: any) {
      console.error('Task file read error:', err);
      setToast({ message: err.message || '文件读取失败', type: 'error' });
    } finally {
      setActiveTaskFileUpload(null);
      if (taskScriptFileInputRef.current) taskScriptFileInputRef.current.value = '';
    }
  };

  const handleFullAutomation = async (initialData: PipelineData) => {
    if (!checkApiKey('image')) return;
    if (!checkApiKey('video')) return;

    setAutomationMode(AutomationMode.FULL);
    setStep(Step.GENERATING);
    setGlobalProgress(0);
    
    try {
      // 1. 生成资产主图 (30%)
      setLoadingMsg('正在生成全局资产主图...');
      const assets = initialData.assets;
      for (let i = 0; i < assets.length; i++) {
        if (isCancelledRef.current) return;
        setGlobalProgress(Math.floor((i / assets.length) * 30));
        await handleAssetGen(assets[i].id, true);
      }
      
      // 2. 生成资产次要媒体 (20%)
      setLoadingMsg('正在生成资产次要媒体 (角色设定图/场景方案)...');
      for (let i = 0; i < assets.length; i++) {
        if (isCancelledRef.current) return;
        setGlobalProgress(30 + Math.floor((i / assets.length) * 20));
        if (assets[i].type === 'scene') {
          await handleSceneSecondaryGen(assets[i].id);
          await handleSceneLayoutGen(assets[i].id);
          await handleSceneCombinedGen(assets[i].id);
        } else {
          await handleAssetGen(assets[i].id, false);
        }
      }

      // 3. 生成分段视频 (50%)
      setLoadingMsg('正在生成 15s 分段视频...');
      const latestSegments = dataRef.current?.tasks?.[0]?.segments || initialData?.tasks?.[0]?.segments || [];
      console.log(`[Diagnostic] Starting full automation for ${latestSegments.length} segments.`);
      for (let i = 0; i < latestSegments.length; i++) {
        if (isCancelledRef.current) return;
        setGlobalProgress(50 + Math.floor((i / latestSegments.length) * 50));
        // Use the most up-to-date data from current state instead of the stale initialData snapshot
        await handleSegGen(latestSegments[i].id, dataRef.current || undefined);
        console.log(`[Diagnostic] Finished generating segment ${i + 1}/${latestSegments.length}. Local state sync check.`);
      }

      setGlobalProgress(100);
      setStep(Step.RESULT);
    } catch (e: any) {
      setAutomationError(formatErrorMessage(e, '全自动化流程中断'));
    }
  };

  const extractLastFrame = async (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoUrl;
      video.onloadedmetadata = () => {
        video.currentTime = Math.max(0, video.duration - 0.1); // Go to near the end
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        } else {
          reject(new Error("Failed to get canvas context"));
        }
      };
      video.onerror = (e) => reject(e);
    });
  };

  const handleSegGen = async (segmentId: string, overrideData?: PipelineData) => {
    const currentData = overrideData || data;
    const seg = currentData?.segments?.find(s => s.id === segmentId) || currentData?.tasks?.flatMap(t => t.segments || [])?.find(s => s.id === segmentId);
    if (!seg) return;

    if (seg.generatedVideoUrl) return;

    // Deduct points
    // Use selected model for cost calculation
    const modelKey = `seedance2.0-${selectedVideoResolution}-ref`;
    let cost = 10;
    const modelCost = GENERATION_COSTS.VIDEO[modelKey as keyof typeof GENERATION_COSTS.VIDEO];
    if (typeof modelCost === 'number') {
      cost = modelCost;
    } else if (typeof modelCost === 'object' && modelCost !== null) {
      cost = (modelCost as any)[selectedVideoDuration] || 75;
    }
    const result = await deductPoints(cost, `分段视频生成 (分段 ID: ${segmentId}, 模型: ${selectedVideoModel}, 时长: ${selectedVideoDuration}s)`);
    if (!result.success) {
      setToast({ message: result.error || '积分不足', type: 'error' });
      return;
    }

    const key = segmentId;
    setGeneratingSegments(p => ({ ...p, [key]: "正在排队..." }));
    setSegmentErrors(p => ({ ...p, [key]: '' }));
    try {

      if (seg.generatedVideoUrl) return;

      const allSegs = currentData?.segments || currentData?.tasks?.flatMap(t => t.segments || []) || [];
      const segIndex = allSegs.findIndex(s => s.id === segmentId);
      const prevSeg = segIndex > 0 ? allSegs[segIndex - 1] : null;

      const refImages: any[] = [];
      const refVideos: any[] = [];

      // Add continuity reference if available
      if (seg.assets.continuity) {
        const match = seg.assets.continuity.match(/\[承接 (尾帧-\d+)\]/);
        if (match) {
          const assetName = match[1];
          const asset = currentData?.assets.find(a => a.name === assetName);
          const mediaUrl = asset?.subAssets?.mainPrompt;
          if (mediaUrl) {
            try {
              const res = await urlToBase64(mediaUrl);
              refImages.push({
                image: {
                  imageBytes: res.base64,
                  mimeType: res.mimeType || 'image/png'
                },
                referenceType: "CONTINUITY"
              });
            } catch (err) {
              console.warn("Failed to load continuity asset", err);
            }
          }
        } else if (seg.assets.continuity === 'PREV_FINAL_FRAME=上一段结尾帧') {
          // Legacy support
          if (prevSeg && (prevSeg.generatedVideoUrl || prevSeg.imageUrl)) {
            const mediaUrl = prevSeg.generatedVideoUrl || prevSeg.imageUrl;
            if (mediaUrl) {
              try {
                const res = await urlToBase64(mediaUrl);
                if (res.mimeType?.startsWith('image/')) {
                  refImages.push({
                    image: {
                      imageBytes: res.base64,
                      mimeType: res.mimeType
                    },
                    referenceType: "CONTINUITY"
                  });
                } else if (res.mimeType?.startsWith('video/')) {
                  refVideos.push({
                    video: {
                      videoBytes: res.base64,
                      mimeType: res.mimeType
                    },
                    referenceType: "CONTINUITY"
                  });
                }
              } catch (err) {
                console.warn("Failed to load continuity media", err);
              }
            }
          }
        }
      } else if (prevSeg && (prevSeg.generatedVideoUrl || prevSeg.imageUrl)) {
        // Fallback to previous segment's media if no explicit continuity asset
        const mediaUrl = prevSeg.generatedVideoUrl || prevSeg.imageUrl;
        if (mediaUrl) {
          try {
            const res = await urlToBase64(mediaUrl);
            if (res.mimeType?.startsWith('image/')) {
              refImages.push({
                image: {
                  imageBytes: res.base64,
                  mimeType: res.mimeType
                },
                referenceType: "CONTINUITY"
              });
            } else if (res.mimeType?.startsWith('video/')) {
              refVideos.push({
                video: {
                  videoBytes: res.base64,
                  mimeType: res.mimeType
                },
                referenceType: "CONTINUITY"
              });
            }
          } catch (err) {
            console.warn("Failed to load continuity media", err);
          }
        }
      }

      const boundAssets = [
        ...parseBindings(seg.assets.scenes).map(b => ({ ...b, type: 'scene' })),
        ...parseBindings(seg.assets.characters).map(b => ({ ...b, type: 'character' })),
        ...parseBindings(seg.assets.props).map(b => ({ ...b, type: 'prop' }))
      ];

      for (const b of boundAssets) {
        if (refImages.length + refVideos.length >= 12) break;
        
        const asset = findAssetByIdOrDisplayId(b.id, b.type);
        if (!asset) continue;

        const aid = b.id;
        const isSecondary = aid.endsWith('_v');
        const isVariant = aid.includes('_v') && !aid.startsWith('图');
        
        let variantId = '';
        if (isVariant) {
          const variantId = aid.split('_v')[1]?.split('_')?.[0];
        }

        let mediaUrl = isSecondary ? asset?.generatedMedia?.secondaryMediaUrl : asset?.generatedMedia?.mainImageUrl;
        
        if (isVariant && asset?.variants) {
          const variant = asset?.variants?.find(v => v.id === variantId);
          if (variant?.imageUrl) mediaUrl = variant.imageUrl;
        }
        
        if ((isSecondary || isVariant) && !mediaUrl && asset?.generatedMedia?.mainImageUrl) {
          mediaUrl = asset.generatedMedia.mainImageUrl;
        }
        
        if (mediaUrl) {
          try {
            if (mediaUrl.startsWith('blob:') && isSecondary && asset?.type === 'scene') {
              if (refVideos.length < 3) {
                const res = await urlToBase64(mediaUrl);
                refVideos.push({
                  video: {
                    videoBytes: res.base64,
                    mimeType: res.mimeType || 'video/mp4'
                  },
                  referenceType: "ASSET"
                });
                continue;
              }
            }
            
            if (refImages.length < 9) {
              const res = await urlToBase64(mediaUrl);
              refImages.push({
                image: {
                  imageBytes: res.base64,
                  mimeType: res.mimeType || 'image/png'
                },
                referenceType: "ASSET"
              });
            }
          } catch (err) {
            console.warn(`转换资产 ${aid} 为 base64 失败`, err);
          }
        }
      }

      const fullPrompt = `【角色资产绑定】${formatBindings(seg.assets.characters, 'character')}
【场景资产绑定】${formatBindings(seg.assets.scenes, 'scene')}
【道具资产绑定】${formatBindings(seg.assets.props, 'prop')}
${seg.assets.continuity ? `【视觉连续性参考】${seg.assets.continuity}\n` : ''}【分段综合提示词】
${cleanPrompt(seg.prompt)}`;

      let op = await pipelineService.generateVideo(fullPrompt, {
        aspectRatio: currentData?.aspectRatio || '9:16',
        resolution: selectedVideoResolution as any,
        duration: selectedVideoDuration,
        model: selectedVideoModel,
        referenceImages: refImages,
        referenceAssets: refVideos.length > 0 ? refVideos : undefined
      }, config);

      const opId = op.operationId || op.name || op.id || op.task_id;
      setGeneratingSegments(p => ({ ...p, [key]: "正在渲染..." }));
      
      let attempts = 0;
      const maxAttempts = 60;
      while (!op.done && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 30000));
        attempts++;
        op = await pipelineService.getVideoOperationStatus(opId, config, selectedVideoModel);
        
        if (op.error) {
          const errorMsg = (typeof op.error === 'object' && op.error !== null) ? (op.error.message || JSON.stringify(op.error)) : op.error;
          throw new Error(errorMsg);
        }

        if (attempts % 2 === 0) {
          setGeneratingSegments(p => ({ ...p, [key]: `正在渲染 (${Math.floor(attempts/2)}分钟)...` }));
        }
      }
      if (!op.done) throw new Error("视频生成超时");

      setGeneratingSegments(p => ({ ...p, [key]: "正在下载..." }));
      const uri = op.videoUrl;
      if (!uri) throw new Error("无法获取视频下载链接");
      
      const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(uri)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`视频下载失败: ${res.statusText}`);
      
      const blob = await res.blob();
      const reader = new FileReader();
      const url = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      // Upload to OSS immediately to reduce payload size of main save
      let finalUrl = url;
      try {
        const uploadRes = await fetch('/api/user/upload-to-oss', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ 
            data: url, 
            filename: `segments/${segmentId}_video_${Date.now()}.mp4` 
          })
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          if (uploadData.url) finalUrl = uploadData.url;
        }
      } catch (uploadErr) {
        console.warn("Failed to upload segment video to OSS immediately, falling back to base64", uploadErr);
      }

      setData(prev => {
        if (!prev) return null;
        const updatedSegments = (prev.segments || []).map(s => s.id === segmentId ? { ...s, generatedVideoUrl: finalUrl } : s);
        const updatedTasks = (prev.tasks || []).map(t => ({
          ...t,
          segments: (t.segments || []).map(s => s.id === segmentId ? { ...s, generatedVideoUrl: finalUrl } : s)
        }));
        const updated = { ...prev, segments: updatedSegments, tasks: updatedTasks };
        
        console.log(`[Diagnostic] Segment ${segmentId} video updated. URL: ${finalUrl.substring(0, 50)}...`);
        
        // Extract last frame and save as asset
        const extractAndSaveLastFrame = async () => {
          try {
            const lastFrameDataUrl = await extractLastFrame(finalUrl);
            const assetName = `尾帧-${segIndex}`;
            
            // Upload last frame to OSS too
            let finalFrameUrl = lastFrameDataUrl;
            try {
              const frameUploadRes = await fetch('/api/user/upload-to-oss', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ 
                  data: lastFrameDataUrl, 
                  filename: `frames/${segmentId}_lastframe_${Date.now()}.png` 
                })
              });
              if (frameUploadRes.ok) {
                const frameUploadData = await frameUploadRes.json();
                if (frameUploadData.url) finalFrameUrl = frameUploadData.url;
              }
            } catch (fErr) {
               console.warn("Failed to upload frame to OSS", fErr);
            }

            setData(current => {
              if (!current) return null;
              const existingAssetIndex = current.assets.findIndex(a => a.name === assetName);
              const newAsset: Asset = {
                id: existingAssetIndex >= 0 ? current.assets[existingAssetIndex].id : `asset_${Date.now()}`,
                name: assetName,
                type: 'prop',
                details: { atmosphere: '上一段视频的尾帧' },
                subAssets: {
                  mainPrompt: finalFrameUrl,
                  secondaryPrompt: ''
                },
                variants: []
              };
              
              let newAssets = [...current.assets];
              if (existingAssetIndex >= 0) {
                newAssets[existingAssetIndex] = newAsset;
              } else {
                newAssets.push(newAsset);
              }
              
              const finalData = { ...current, assets: newAssets };
              setTimeout(() => handleSaveTask(), 0);
              return finalData;
            });
          } catch (err) {
            console.warn("Failed to extract last frame", err);
          }
        };
        
        extractAndSaveLastFrame();

        // Defer save to ensure data is persisted
        setTimeout(() => handleSaveTask(), 0);
        return updated;
      });
      setSegmentErrors(p => ({ ...p, [key]: '' }));
      return url;
    } catch (e: any) {
      console.error("Segment Video Gen Error:", e);
      
      // Refund points on failure
      await refundPoints(cost, `视频生成失败退款 (分段 ID: ${segmentId}, 模型: ${selectedVideoModel})`);
      
      const errorMsg = formatErrorMessage(e, '视频生成失败');
      setSegmentErrors(p => ({ ...p, [key]: errorMsg }));
      if (automationMode === AutomationMode.FULL) throw e;
    } finally {
      setGeneratingSegments(p => ({ ...p, [key]: '' }));
    }
  };

  const updateAssetName = (id: string, value: string) => {
    setData(prev => prev ? {
      ...prev,
      assets: (prev.assets || []).map(a => a.id === id ? { ...a, name: value } : a)
    } : null);
  };

  const updateAssetRefName = (id: string, value: string) => {
    setData(prev => prev ? {
      ...prev,
      assets: (prev.assets || []).map(a => a.id === id ? { ...a, refName: value.startsWith('@') ? value : '@' + value } : a)
    } : null);
  };

  const updateAssetDetails = (id: string, details: Partial<Asset['details']>) => {
    setData(prev => prev ? {
      ...prev,
      assets: prev.assets.map(a => a.id === id ? {
        ...a,
        details: { ...(a.details || {}), ...details }
      } : a)
    } : null);
  };

  const updateAssetPrompt = (id: string, type: 'main' | 'secondary' | 'variant' | 'layout', value: string, variantId?: string) => {
    setData(prev => prev ? {
      ...prev,
      assets: prev.assets.map(a => a.id === id ? {
        ...a,
        subAssets: !variantId ? { 
          ...a.subAssets, 
          [type === 'main' ? 'mainPrompt' : 'secondaryPrompt']: value 
        } : a.subAssets,
        variants: variantId ? a.variants?.map(v => v.id === variantId ? { 
          ...v, 
          [type === 'variant' ? 'prompt' : 'secondaryPrompt']: value 
        } : v) : a.variants
      } : a)
    } : null);
  };

  const scanPromptForAssets = (prompt: string, allAssets: Asset[]) => {
    const results: { asset: Asset; variant?: AssetVariant }[] = [];
    const matchedVariantNames = new Set<string>();

    // First pass: find characters and their variants
    allAssets.filter(a => a.type === 'character').forEach(a => {
      const mentionedVariant = a?.variants?.find(v => prompt.includes(v.name));
      if (mentionedVariant) {
        results.push({ asset: a, variant: mentionedVariant });
        matchedVariantNames.add(mentionedVariant.name);
      } else if (prompt.includes(a.name)) {
        results.push({ asset: a });
      }
    });

    // Second pass: find scenes and props, excluding those already matched as variants
    allAssets.filter(a => a.type !== 'character').forEach(a => {
      if (prompt.includes(a.name)) {
        // If this asset's name was already matched as a variant of a character, skip it
        if (a.type === 'prop' && matchedVariantNames.has(a.name)) {
          return;
        }
        results.push({ asset: a });
      }
    });
    return results;
  };

  // Pre-index assets for faster lookups in getCombinedPrompt
  const assetIndex = useMemo(() => {
    const index: Record<string, Asset> = {};
    if (!data?.assets) return index;
    
    data.assets.forEach(a => {
      index[a.id] = a;
      if (a.type === 'character' && a.refName) index[a.refName] = a;
      index[a.name] = a;
    });
    
    // Index by display ID
    const characters = data.assets.filter(a => a.type === 'character');
    const scenes = data.assets.filter(a => a.type === 'scene');
    const props = data.assets.filter(a => a.type === 'prop');
    
    characters.forEach((a, i) => { index[`图${i + 1}`] = a; index[`角色${i + 1}`] = a; });
    scenes.forEach((a, i) => { index[`场景${i + 1}`] = a; });
    props.forEach((a, i) => { index[`道具${i + 1}`] = a; });
    
    return index;
  }, [data?.assets]);

  const getCombinedPrompt = useCallback((seg: Segment) => {
    const lines: string[] = [];
    
    const formatBinding = (bindingStr: string, type: string) => {
      if (!bindingStr) return [];
      return parseBindings(bindingStr).map(b => {
        const displayId = getAssetDisplayId(b.id, type);
        
        // Only include height for characters, skip other DNA info
        let extra = '';
        if (type === 'character') {
          const asset = assetIndex[b.id] || assetIndex[displayId];
          if (asset?.details?.height) {
            const h = (typeof asset.details.height === 'string' && asset.details.height.includes('cm')) ? asset.details.height : `${asset.details.height}cm`;
            extra = `（身高${h}）`;
          }
        }
        
        return `${b.name}=@${displayId}${extra}`;
      });
    };

    lines.push(...formatBinding(seg.assets.characters, 'character'));
    lines.push(...formatBinding(seg.assets.scenes, 'scene'));
    lines.push(...formatBinding(seg.assets.props, 'prop'));
    if (seg.assets.continuity) {
      lines.push(...formatBinding(seg.assets.continuity, 'continuity'));
    }

    const prompt = seg.prompt || '';
    if (lines.length > 0) {
      return lines.join('\n') + '\n\n' + prompt;
    }
    return prompt;
  }, [assetIndex]);

  const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
    const { scrollLeft, scrollTop } = element;
    const style = window.getComputedStyle(element);
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.width = style.width;
    div.style.font = style.font;
    div.style.padding = style.padding;
    div.style.border = style.border;
    div.style.boxSizing = style.boxSizing;
    div.style.lineHeight = style.lineHeight;
    
    const content = element.value.substring(0, position);
    div.textContent = content;
    
    const span = document.createElement('span');
    span.textContent = element.value.substring(position, position + 1) || '.';
    div.appendChild(span);
    
    document.body.appendChild(div);
    const { offsetLeft: spanLeft, offsetTop: spanTop } = span;
    document.body.removeChild(div);
    
    return {
      top: spanTop - scrollTop,
      left: spanLeft - scrollLeft
    };
  };

  const handleCombinedPromptChange = (taskId: string, segId: string, value: string) => {
    const lines = value.split('\n');
    const characters: string[] = [];
    const scenes: string[] = [];
    const props: string[] = [];
    const continuity: string[] = [];
    const promptLines: string[] = [];
    
    let inPrompt = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        if (promptLines.length > 0) promptLines.push('');
        return;
      }
      
      if (!inPrompt && trimmed && typeof trimmed === 'string' && trimmed.includes('=@')) {
        // It's a binding
        const parts = trimmed.split('=@');
        const name = parts[0].trim();
        const idPart = parts[1].trim();
        
        // Extract ID and extra
        // Format: ID（Extra）
        let id = idPart.startsWith('@') ? idPart.slice(1) : idPart;
        let extra = '';
        const extraMatch = id.match(/[（(](.*?)[）)]/);
        if (extraMatch) {
          id = id.replace(extraMatch[0], '').trim();
          extra = extraMatch[1].trim();
        }
        
        // Convert display ID back to internal ID if needed
        const isSecondary = id.endsWith('_v');
        const isLayout = id.endsWith('_layout');
        const isVar = id.includes('_v') && !id.startsWith('图') && !isSecondary;
        
        let baseId = id;
        if (isSecondary) baseId = id.slice(0, -2);
        else if (isLayout) baseId = id.slice(0, -7);
        else if (isVar) baseId = id.split('_v')[0];

        const asset = findAssetByIdOrDisplayId(baseId, 'character') || findAssetByIdOrDisplayId(baseId, 'scene') || findAssetByIdOrDisplayId(baseId, 'prop');
        const type = asset?.type || (id.startsWith('角色') || id.startsWith('图') || id.startsWith('char_') ? 'character' : id.startsWith('场景') || id.startsWith('scene_') ? 'scene' : id.startsWith('prop_') || id.startsWith('道具') ? 'prop' : 'character');
        
        let internalId = asset?.id || baseId;
        if (isVar) {
          const variantId = id.split('_v')[1].split('_')[0];
          internalId += `_v${variantId}`;
        }
        if (isSecondary) internalId += '_v';
        if (isLayout) internalId += '_layout';

        const binding = `${name} = ${internalId}${extra ? `（${extra}）` : ''}`;
        
        if (type === 'character') characters.push(binding);
        else if (type === 'scene') scenes.push(binding);
        else if (type === 'prop') props.push(binding);
        else if (type === 'continuity') continuity.push(binding);
        else characters.push(binding);
      } else {
        inPrompt = true;
        promptLines.push(line);
      }
    });

    setData(prev => {
      if (!prev) return null;
      const tempData: PipelineData = {
        ...prev,
        tasks: (prev.tasks || []).map(t => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            segments: (t.segments || []).map(s => {
              if (s.id !== segId) return s;
              return {
                ...s,
                assets: {
                  characters: formatAssetBinding('character', characters.join(', '), promptLines.join('\n').trim(), prev.assets),
                  scenes: formatAssetBinding('scene', scenes.join(', '), promptLines.join('\n').trim(), prev.assets),
                  props: formatAssetBinding('prop', props.join(', '), promptLines.join('\n').trim(), prev.assets),
                  continuity: continuity.join(', ')
                },
                prompt: promptLines.join('\n').trim()
              };
            })
          };
        })
      };

      // Re-run fuzzy binding to catch any new mentions in the prompt
      return pipelineService.fuzzyBindAssets(tempData);
    });
  };

  const updateSegmentPrompt = (segmentId: string, value: string) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        segments: (prev.segments || []).map(s => {
          if (s.id !== segmentId) return s;
          const mentioned = scanPromptForAssets(value, prev.assets);
          const currentAssets = (typeof s.assets === 'object' && s.assets !== null) ? s.assets : {};
          const newAssets = { ...currentAssets } as any;
          ['character', 'scene', 'prop'].forEach(type => {
            const field = type === 'character' ? 'characters' : type === 'scene' ? 'scenes' : 'props';
            const currentBindings = parseBindings(newAssets[field]);
            let updatedBindings = [...currentBindings];
            const mentionedOfType = mentioned.filter(m => m.asset.type === type);
            mentionedOfType.forEach(m => {
              const targetId = m.variant ? `${m.asset.id}_v${m.variant.id}` : m.asset.id;
              const targetName = m.variant ? m.variant.name : m.asset.name;
              const isAlreadyBound = updatedBindings.some(b => {
                const baseId = b.id.startsWith('@') 
                  ? prev.assets?.find(a => a.refName === b.id)?.id 
                  : (b.id.endsWith('_v') ? b.id.slice(0, -2) : (b.id.endsWith('_layout') ? b.id.slice(0, -7) : (b.id.includes('_v') && !b.id.startsWith('图') ? b.id.split('_v')[0] : b.id)));
                return baseId === m.asset.id;
              });
              if (!isAlreadyBound) {
                updatedBindings.push({ id: targetId, name: targetName });
              }
            });
            const finalBindingsMap = new Map<string, { id: string, name: string }>();
            updatedBindings.forEach(b => {
              const baseId = b.id.startsWith('@') 
                ? prev.assets?.find(a => a.refName === b.id)?.id 
                : (b.id.endsWith('_v') ? b.id.slice(0, -2) : (b.id.endsWith('_layout') ? b.id.slice(0, -7) : (b.id.includes('_v') && !b.id.startsWith('图') ? b.id.split('_v')[0] : b.id)));
              if (baseId) finalBindingsMap.set(baseId, b);
            });
            const finalBindings = Array.from(finalBindingsMap.values()) as { id: string, name: string }[];
            (newAssets as any)[field] = finalBindings.map(b => `${b.name}=${getAssetDisplayId(b.id, type)}`).join(', ');
          });
          return { ...s, prompt: value, assets: newAssets };
        })
      };
    });
  };

  const toggleTaskCollapse = (taskId: string) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tasks: (prev.tasks || []).map(t => t.id === taskId ? { ...t, isCollapsed: !t.isCollapsed } : t)
      };
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId);
  };


  const handleDownloadPreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!previewMedia?.url) return;
    
    try {
      const response = await fetchWithProxy(previewMedia.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `seedance_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      setToast({ message: '下载失败', type: 'error' });
    }
  };



  const handleAddTask = () => {
    if (data && (data?.tasks?.length || 0) > 0) {
      const firstTask = data?.tasks?.[0];
      if (firstTask.status !== 'segments_generated') {
        setToast({ message: '请等待首个剧本任务执行完成后再新增。', type: 'error' });
        return;
      }
    }

    // 新增任务时退出精修模式，以便用户看到新任务
    setActiveSegId(null);

    setData(prev => {
      if (!prev) return null;
      const newTask: Task = {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        script: '',
        segments: [],
        status: 'assets_pending',
        isExpanded: true,
        isCollapsed: false
      };
      return { ...prev, tasks: [...prev.tasks, newTask] };
    });
  };

  const handleSegmentGenIndividual = async (taskId: string, segmentId: string, force = false) => {
    if (!data) return;
    const task = data?.tasks?.find(t => t.id === taskId);
    const segment = task?.segments?.find(s => s.id === segmentId);
    if (!segment) return;

    if (segment.generatedVideoUrl && !force) return;
    await handleSegGen(segment.id);
  };

  const handleExportAll = async () => {
    if (!data) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      const zip = new JSZip();
      const videoFolder = zip.folder("SEEDANCE_Videos");
      const imageFolder = zip.folder("SEEDANCE_Images");
      
      const allSegments = (data?.tasks || []).flatMap(t => t.segments || []);
      const total = allSegments.length;
      let count = 0;

      for (const seg of allSegments) {
        if (seg.generatedVideoUrl) {
          try {
            const response = await fetchWithProxy(seg.generatedVideoUrl);
            const blob = await response.blob();
            videoFolder?.file(`segment_${seg.index}.mp4`, blob);
          } catch (err) {
            console.error(`获取分段 ${seg.index} 的视频失败`, err);
          }
        }
        if (seg.imageUrl) {
          try {
            const response = await fetchWithProxy(seg.imageUrl);
            const blob = await response.blob();
            imageFolder?.file(`segment_${seg.index}.png`, blob);
          } catch (err) {
            console.error(`获取分段 ${seg.index} 的图片失败`, err);
          }
        }
        count++;
        setExportProgress(Math.round((count / total) * 100));
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SEEDANCE_Export_${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleDownloadAllVideos = async () => {
    if (!data) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      const zip = new JSZip();
      const videoFolder = zip.folder("SEEDANCE_Videos");
      
      const allSegments = (data?.tasks || []).flatMap(t => t.segments || []);
      const segmentsWithVideo = allSegments.filter(seg => seg.generatedVideoUrl);
      const total = segmentsWithVideo.length;
      
      if (total === 0) {
      setToast({ message: "没有可下载的视频", type: 'error' });
        return;
      }

      let count = 0;
      for (const seg of segmentsWithVideo) {
        try {
          const response = await fetchWithProxy(seg.generatedVideoUrl!);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const blob = await response.blob();
          videoFolder?.file(`segment_${seg.index}.mp4`, blob);
          // Add a small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`下载分段 ${seg.index} 的视频失败`, err);
        }
        count++;
        setExportProgress(Math.round((count / total) * 100));
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SEEDANCE_Videos_${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Video export failed:", error);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleCopySegment = (seg: Segment) => {
    const formattedText = getCombinedPrompt(seg);
    navigator.clipboard.writeText(formattedText).then(() => {
      setToast({ message: '分段方案已复制', type: 'success' });
    });
  };

  const updateVariantPrompt = (assetId: string, variantId: string, prompt: string) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        assets: prev.assets.map(a => a.id === assetId ? {
          ...a,
          variants: a.variants?.map(v => v.id === variantId ? { ...v, prompt } : v)
        } : a)
      };
    });
  };

  const handleHistoryClear = async () => {
    if (confirm('确定要清除所有制剧任务吗？')) {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        await fetch('/api/user/pipelines', { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setData(null);
        setStep(Step.INPUT);
        setToast({ message: '所有任务已清除', type: 'success' });
      } catch (err) {
        console.error('清空流水线失败:', err);
        setToast({ message: '清除任务失败', type: 'error' });
      }
    }
  };

  const handleAddAsset = (type: 'character' | 'scene' | 'prop' | 'continuity') => {
    const prefix = type === 'character' ? 'char' : type === 'scene' ? 'scene' : type === 'continuity' ? 'cont' : 'prop';
    const existingIds = data?.assets?.filter(a => a.id.startsWith(prefix + '_'))
      .map(a => parseInt(a.id.split('_')[1] || '0')) || [];
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const nextIdNum = maxId + 1;
    
    const newId = `${prefix}_${nextIdNum.toString().padStart(2, '0')}`;
    const displayPrefix = type === 'character' ? '图' : type === 'scene' ? '场景' : type === 'continuity' ? '尾帧' : '道具';
    const defaultName = `${displayPrefix}${nextIdNum}`;
    
    const newAsset: Asset = {
      id: newId,
      name: defaultName,
      type,
      refName: type === 'character' ? defaultName : undefined,
      details: type === 'character' ? {
        height: "180cm",
        appearance: "20岁男性，东亚黄种人，洒脱不羁的江湖侠客气质。",
        clothing: "浅米色亚麻长袖内搭，深色复古皮质战裙式下装，深棕色做旧纹理皮质背心，皮质护腕，雕花装饰腰带。",
        tags: "古风,侠客"
      } : {},
      subAssets: {
        mainPrompt: type === 'character' ? `核心身份：26岁女性，人种：美国白人，身高170cm，记者，眼神锐利。
妆容细节：柳叶眉（眉尾微扬）+大地色眼影（眼尾叠加深棕营造深邃感）+内眼线（眼尾微微上挑）+豆沙色口红（哑光质地，显气质不张扬）+底妆轻薄服帖（遮盖瑕疵却不假面）+两颊淡淡腮红（似自然好气色）。
发型发色：低盘发+深棕发色+发丝贴颅，右侧插一支珍珠发簪（可拆解为开锁工具），鬓角留两缕碎发修饰脸型。
服装细节：酒红色丝绒吊带裙（裙摆开叉至膝盖）+米白色真丝披肩（边缘绣暗纹）
配饰细节：黑色缎面高跟鞋（鞋跟内藏微型刀片）+珍珠项链（颗粒大小不均，为伪装道具）+鎏金耳坠（内藏微型窃听器）。
要求：影棚拍摄,全身照,纯白背景,单人,单一视角,严禁拼图,手中不拿任何道具。` : 
                    type === 'scene' ? "核心身份：古风客栈内部\n环境细节：木质结构，光影斑驳，充满江湖气息。\n建筑风格：中式传统木构建筑\n空间布局：宽敞的大堂，错落有致的桌椅\n核心物件：柜台、酒坛、长凳\n光影与画风：昏暗而温暖的烛光氛围，写实风格\n要求：全景/远景构图。" : 
                    type === 'continuity' ? "尾帧资产：通常为上一场戏的最后一帧图片，用于保持视觉连续性。" : 
                    "核心身份：青钢剑\n材质细节：做旧的青钢材质，剑身有细微划痕\n光影表现：冷冽的金属反光\n画风设定：写实风格，产品摄影，棚拍白底质感\n要求：影棚拍摄,严禁出现人物,严禁出现手部,仅展示道具主体,纯白背景,单一视角,严禁拼图。",
        secondaryPrompt: type === 'character' ? "专业角色设定图 (Character Sheet)，角色转面图 (Turnaround)，包含该角色的多个正交视角。图片布局严格分为上下两层：上层为该角色的半身三视图（正面、侧面、背面）；下层为该角色的全身三视图（正面、侧面、背面）。写实画风，角色形象、五官、发型、服装必须与参考图（图1）100% 保持一致。纯灰色背景 (#808080)，无阴影，平光照明，带有中文设计标注文字，左上角标注“姓名：”。提示词中严禁包含颜色代码或具体颜色描述。必须包含“影棚拍摄”、“棚拍白底”、“正交视图”字样。" : undefined
      },
      generatedMedia: { mainImageUrl: undefined, secondaryMediaUrl: undefined }
    };

    setData(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        assets: [...(prev.assets || []), newAsset]
      };
      // Defer save
      setTimeout(() => handleSaveTask(), 0);
      return updated;
    });

    setToast({ message: `已添加${type === 'character' ? '角色' : type === 'scene' ? '场景' : type === 'continuity' ? '尾帧' : '道具'}: ${defaultName}`, type: 'success' });
    
    // Scroll to the new asset
    setTimeout(() => {
      const element = document.getElementById(`asset-card-${newId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleDownloadAllGlobalAssets = async (filename: string = '全局资产库') => {
    if (!data?.assets || (data?.assets?.length || 0) === 0) {
      setToast({ message: '资产库中没有可下载的资产', type: 'error' });
      return;
    }
    setIsDownloading(true);
    const zip = new JSZip();
    const rootFolder = zip.folder(`${filename}_${new Date().toISOString().split('T')[0]}`);
    
    // Add project info file
    let projectInfo = `项目名称: ${data?.name || '未命名项目'}\n`;
    projectInfo += `导出时间: ${new Date().toLocaleString()}\n`;
    projectInfo += `导演风格: ${data?.directorStyle || '默认'}\n`;
    projectInfo += `画面画风: ${data?.visualStyle || '默认'}\n`;
    projectInfo += `画面比例: ${data?.aspectRatio || '16:9'}\n\n`;
    
    projectInfo += `========================================\n`;
    projectInfo += `原始剧本内容:\n`;
    projectInfo += `========================================\n\n`;
    projectInfo += `${data?.originalScript || '无剧本'}\n\n`;
    
    if (data?.tasks && data.tasks.length > 0) {
      projectInfo += `========================================\n`;
      projectInfo += `分段提示词 (Storyboards & Prompts):\n`;
      projectInfo += `========================================\n\n`;
      
      data.tasks.forEach((task, tIdx) => {
        projectInfo += `任务 ${tIdx + 1}${task.fileName ? ` (${task.fileName})` : ''}:\n`;
        task.segments.forEach((seg, sIdx) => {
          projectInfo += `  [分段 ${seg.index + 1}] (${seg.duration})\n`;
          projectInfo += `  资产绑定: 角色(${seg.assets.characters}) 场景(${seg.assets.scenes}) 道具(${seg.assets.props})\n`;
          projectInfo += `  AI 提示词: ${seg.prompt}\n\n`;
        });
        projectInfo += `----------------------------------------\n\n`;
      });
    }
    
    rootFolder?.file("00_项目剧本与分段提示词.txt", projectInfo);
    // Also add a structured JSON for potential re-import or data analysis
    rootFolder?.file("project_data.json", JSON.stringify(data, null, 2));

    const addFileToZip = async (folder: any, url: string, name: string) => {
      try {
        const response = await fetchWithProxy(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        folder.file(name, blob);
        // Add a small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.error(`添加 ${name} 到压缩包失败`, e);
      }
    };

    for (const asset of (data?.assets || [])) {
      const assetFolder = rootFolder?.folder(`${asset.name}_${asset.id}`);
      if (asset.generatedMedia?.mainImageUrl) await addFileToZip(assetFolder, asset.generatedMedia.mainImageUrl, "01_主图.png");
      if (asset.generatedMedia?.secondaryMediaUrl) {
        if (asset.type !== 'scene') await addFileToZip(assetFolder, asset.generatedMedia.secondaryMediaUrl, `03_角色设定图.png`);
      }
      if (asset.variants && asset.variants.length > 0) {
        const variantsFolder = assetFolder?.folder("04_变装系列");
        for (const v of asset.variants) {
          if (v.imageUrl) await addFileToZip(variantsFolder, v.imageUrl, `${v.name}_主图.png`);
        }
      }
    }
    
    try {
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('打包资产失败:', error);
      setToast({ message: '打包失败', type: 'error' });
    } finally {
      setIsDownloading(false);
    }
  };





  const getAssetDisplayId = (id: string, type: string, currentAssets?: Asset[]) => {
    if (!id) return id;
    
    // Clean redundant @ prefixes
    let cleanId = id;
    while (cleanId.startsWith('@')) {
      cleanId = cleanId.slice(1);
    }
    
    if (cleanId === 'PREV_FINAL_FRAME') return 'PREV_FINAL_FRAME';
    
    const assets = currentAssets || data?.assets || [];
    const filtered = assets.filter(a => a.type === type);
    
    const isSecondary = cleanId.endsWith('_v');
    const isLayout = cleanId.endsWith('_layout');
    let tempId = cleanId;
    if (isSecondary) tempId = cleanId.slice(0, -2);
    else if (isLayout) tempId = cleanId.slice(0, -7);
    
    const isVariant = tempId.includes('_v') && !tempId.startsWith('图') && !tempId.startsWith('场景') && !tempId.startsWith('道具');
    let realId = tempId;
    let variantId = '';
    if (isVariant) {
      const parts = tempId.split('_v');
      realId = parts[0];
      variantId = parts[1];
    }
    
    const index = filtered.findIndex(a => a.id === realId);
    if (index === -1) return cleanId;
    
    const prefix = type === 'character' ? '图' : type === 'scene' ? '场景' : '道具';
    let displayId = `${prefix}${index + 1}`;
    
    if (isVariant) displayId += `_v${variantId}`;
    if (isSecondary) displayId += '_v';
    if (isLayout) displayId += '_layout';
    
    return displayId;
  };

  const findAssetByIdOrDisplayId = (id: string, type: string, currentAssets?: Asset[]) => {
    if (!id) return null;
    const assets = currentAssets || data?.assets || [];
    const filtered = assets.filter(a => a.type === type);
    
    // 1. Try direct ID, refName, or name
    let asset = assets.find(a => a.id === id || (a.type === 'character' && a.refName === id) || a.name === id);
    if (asset) return asset;
    
    // 2. Try display ID (图1, 场景1, etc.)
    const prefix = type === 'character' ? '图' : type === 'scene' ? '场景' : '道具';
    if (id.startsWith(prefix) || id.startsWith('角色')) {
      // Extract the base number before any suffix like _v1 or _v
      const match = id.match(/^(?:图|角色|场景|道具)(\d+)/);
      if (match) {
        const index = parseInt(match[1]) - 1;
        if (index >= 0 && index < filtered.length) {
          return filtered[index];
        }
      }
    }
    
    return asset;
  };

  const parseBindings = (s: string, assetsOverride?: Asset[]) => {
    if (!s) return [];
    const assets = assetsOverride || data?.assets;
    const rawItems: string[] = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s[i];
      if (char === '（' || char === '(') depth++;
      if (char === '）' || char === ')') depth--;
      if ((char === ',' || char === '，') && depth === 0) {
        rawItems.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) rawItems.push(current.trim());
    const parsed = rawItems.map(i => {
      const parts = i.trim().split('=');
      if (parts.length < 2) {
        let id = parts[0].trim();
        if (!id) return null;
        
        // Clean @ prefixes
        while (id.startsWith('@')) id = id.slice(1);
        
        // Try to find the asset to get its real name
        const asset = findAssetByIdOrDisplayId(id, 'character', assets) || findAssetByIdOrDisplayId(id, 'scene', assets) || findAssetByIdOrDisplayId(id, 'prop', assets);
        return { name: asset?.name || id, id: id };
      }
      let idPart = parts[1].trim();
      let id = idPart;
      let extra = '';
      let voiceName = '';

      // Handle voice info if present
      if (idPart.includes('角色说话音色=')) {
        const voiceParts = idPart.split('角色说话音色=');
        idPart = voiceParts[0].trim();
        voiceName = voiceParts[1].trim();
      }

      if (idPart.includes('（')) {
        const subParts = idPart.split('（');
        id = subParts[0].trim();
        extra = subParts[1].replace('）', '').trim();
      } else if (idPart.includes('(')) {
        const subParts = idPart.split('(');
        id = subParts[0].trim();
        extra = subParts[1].replace(')', '').trim();
      } else {
        id = idPart;
      }
      
      // Clean leading @ from ID
      while (id.startsWith('@')) id = id.slice(1);

      return { name: parts[0].trim(), id, extra, voiceName };
    }).filter(v => v !== null) as { name: string; id: string; extra?: string; voiceName?: string }[];

    // Ensure unique items by name or ID
    const unique: { name: string; id: string; extra?: string; voiceName?: string }[] = [];
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();
    
    for (const item of parsed) {
      if (!item) continue;
      
      // Clean name for deduplication (strip variant suffix in parens)
      const cleanName = item.name.split(' (')[0].split('（')[0].trim();
      
      const existingIdx = unique.findIndex(u => u.name.startsWith(cleanName) || cleanName.startsWith(u.name.split(' (')[0].split('（')[0].trim()));
      
      if (existingIdx !== -1) {
        // Prefer the one with more info
        const existing = unique[existingIdx];
        const currentScore = (item.extra ? 1 : 0) + (item.voiceName ? 2 : 0) + (item.id.includes('_v') ? 1 : 0);
        const existingScore = (existing.extra ? 1 : 0) + (existing.voiceName ? 2 : 0) + (existing.id.includes('_v') ? 1 : 0);
        
        if (currentScore > existingScore) {
          unique[existingIdx] = item;
        }
      } else if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        unique.push(item);
      }
    }
    return unique;
  };

  const formatAssetBinding = (type: 'character' | 'scene' | 'prop', bindingStr: string, segPrompt?: string, assetsOverride?: Asset[]) => {
    if (!bindingStr) return '';
    const assets = assetsOverride || data?.assets || [];
    const items = parseBindings(bindingStr, assets);
    return items.map(i => {
      const baseId = i.id.endsWith('_v') ? i.id.slice(0, -2) : (i.id.includes('_v') && !i.id.startsWith('图') ? i.id.split('_v')[0] : i.id);
      const asset = assets.find(a => a.id === baseId || (a.type === 'character' && a.refName === baseId)) || findAssetByIdOrDisplayId(i.id, type, assets);
      
      let extras: string[] = [];
      if (asset) {
        if (type === 'character') {
          if (asset.details?.height) {
            const h = asset.details.height.includes('cm') ? asset.details.height : `${asset.details.height}cm`;
            extras.push(`身高${h}`);
          }
        }
      }
      
      let voiceInfo = i.voiceName ? `角色说话音色=${i.voiceName}` : '';
      if (!voiceInfo && type === 'character' && asset?.details?.voiceName && segPrompt && (segPrompt.includes(`${i.name}：`) || segPrompt.includes(`${i.name}:`))) {
        voiceInfo = `角色说话音色=${asset.details.voiceName}`;
      }

      const extraStr = extras.length > 0 ? `（${extras.join('，')}）` : '';
      const displayId = asset ? (type === 'character' ? (asset.refName || asset.id) : asset.id) : i.id;
      return `${i.name} = ${displayId}${extraStr}${voiceInfo}`;
    }).join(', ');
  };

  const sanitizeSegmentAssets = (segments: Segment[], assets: Asset[]) => {
    return (segments || []).map((seg, idx) => {
      const segId = seg.id || `seg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Ensure duration is set, default to 15s if missing or 0
      let duration = seg.duration;
      if (!duration || parseInt(duration) === 0) {
        duration = '15s';
      }

      return {
        ...seg,
        id: segId,
        index: idx, // Add index for backward compatibility and server-side matching
        duration,
        assets: {
          characters: formatAssetBinding('character', seg.assets.characters, seg.prompt, assets),
          scenes: formatAssetBinding('scene', seg.assets.scenes, seg.prompt, assets),
          props: formatAssetBinding('prop', seg.assets.props, seg.prompt, assets),
          continuity: seg.assets.continuity || ''
        }
      };
    });
  };

  const handleUpdateBinding = (segmentId: string, type: string, oldId: string, newId: string, isDelete = false) => {
    setData(prev => {
      if (!prev) return null;
      const updateSegments = (segments: Segment[]) => (segments || []).map(s => {
        if (s.id !== segmentId) return s;
        const field = type === 'character' ? 'characters' : type === 'scene' ? 'scenes' : type === 'continuity' ? 'continuity' : 'props';
        const items = parseBindings((s.assets as any)[field]);

            const getDisplayName = (id: string, baseAsset: any) => {
          if (id === 'PREV_FINAL_FRAME') return '上一段结尾';
          if (!baseAsset) return '未知';
          
          const isSecondary = id.endsWith('_v');
          const isLayout = id.endsWith('_layout');
          const isVar = id.includes('_v') && !id.startsWith('图') && !isSecondary;

          if (isVar) {
            const variantId = id.split('_v')[1]?.split('_')?.[0];
            const variant = baseAsset.variants?.find((v: any) => v.id === variantId);
            if (variant) {
              const suffix = isSecondary ? (baseAsset.type === 'scene' ? ' (720全景)' : ' (角色设定图)') : '';
              return `${baseAsset.name} (${variant.name || '变装'})${suffix}`;
            }
          } else {
            let suffix = '';
            if (isSecondary) {
              suffix = baseAsset.type === 'scene' ? ' (720全景)' : ' (角色设定图)';
            } else if (isLayout) {
              suffix = ' (布局图)';
            }
            return `${baseAsset.name}${suffix}`;
          }
          return baseAsset.name;
        };

        const updated = isDelete ? items.filter(i => i.id !== oldId) : 
                        oldId === 'new' ? (() => {
                          const isVar = newId.includes('_v') && !newId.startsWith('图') && !newId.endsWith('_v');
                          const isSecondary = newId.endsWith('_v');
                          const isLayout = newId.endsWith('_layout');
                          
                          const baseIdFromNewId = isVar 
                            ? newId.split('_v')[0] 
                            : (isSecondary ? newId.slice(0, -2) : (isLayout ? newId.slice(0, -7) : newId));
                          
                          const asset = prev?.assets?.find(a => a.id === baseIdFromNewId || (a.type === 'character' && a.refName === baseIdFromNewId) || (a.type === 'character' && a.refName === newId));
                          const baseNewId = newId.startsWith('@') ? asset?.id : baseIdFromNewId;
                          
                          // 拆解剧本规则：角色主图、六视图、@演员 互斥；变装可共存
                          const existingIdx = items.findIndex(i => {
                            const isItemSecondary = i.id.endsWith('_v');
                            const isItemLayout = i.id.endsWith('_layout');
                            const isItemVar = i.id.includes('_v') && !i.id.startsWith('图') && !isItemSecondary;
                            
                            const itemBaseId = i.id.startsWith('@') 
                              ? prev.assets?.find(a => a.refName === i.id)?.id 
                              : (isItemVar ? i.id.split('_v')[0] : (isItemSecondary ? i.id.slice(0, -2) : (isItemLayout ? i.id.slice(0, -7) : i.id)));
                            
                            if (itemBaseId !== baseNewId) return false;

                            if (type === 'character') {
                              if (isVar) {
                                // 如果是变装，只替换完全相同的变装ID
                                return i.id === newId;
                              } else {
                                // 如果是主图/六视图/@演员，替换任何非变装的同角色绑定
                                return !isItemVar;
                              }
                            }
                            return true; // 其他类型（场景/道具）默认替换同ID
                          });
                          
                          const displayName = getDisplayName(newId, asset);

                          if (type === 'continuity') {
                            return [{ id: newId, name: displayName, extra: '' }];
                          }

                          if (existingIdx !== -1) {
                            const newItems = [...items];
                            newItems[existingIdx] = { ...items[existingIdx], id: newId, name: displayName };
                            return newItems;
                          }
                          return [...items, { id: newId, name: displayName, extra: '' }];
                        })() :
                        items.map(i => {
                          if (i.id !== oldId) return i;
                          const isVar = newId.includes('_v') && !newId.startsWith('图');
                          const baseIdFromNewId = isVar ? newId.split('_v')[0] : (newId.endsWith('_v') ? newId.slice(0, -2) : newId);
                          const asset = prev?.assets?.find(a => a.id === baseIdFromNewId || (a.type === 'character' && a.refName === baseIdFromNewId) || (a.type === 'character' && a.refName === newId));
                          return { ...i, id: newId, name: getDisplayName(newId, asset) };
                        }).filter((item, index, self) => {
                          if (type !== 'character') return true;
                          
                          // 再次应用互斥规则，防止通过下拉菜单修改导致冲突
                          const isItemVar = item.id.includes('_v') && !item.id.startsWith('图');
                          const itemBaseId = item.id.startsWith('@') 
                            ? prev.assets?.find(a => a.refName === item.id)?.id 
                            : (isItemVar ? item.id.split('_v')[0] : (item.id.endsWith('_v') ? item.id.slice(0, -2) : item.id));
                          
                          if (!itemBaseId || isItemVar) return true;
                          
                          // 如果不是变装，只保留第一个出现的非变装绑定
                          const firstTypeAIdx = self.findIndex(s => {
                            const isSVar = s.id.includes('_v') && !s.id.startsWith('图');
                            const sBaseId = s.id.startsWith('@') 
                              ? prev.assets?.find(a => a.refName === s.id)?.id 
                              : (isSVar ? s.id.split('_v')[0] : (s.id.endsWith('_v') ? s.id.slice(0, -2) : s.id));
                            return sBaseId === itemBaseId && !isSVar;
                          });
                          return index === firstTypeAIdx;
                        });
        
        const updatedBindingStr = updated.map(i => {
          const baseId = i.id.endsWith('_v') ? i.id.slice(0, -2) : (i.id.includes('_v') && !i.id.startsWith('图') ? i.id.split('_v')[0] : i.id);
          const asset = prev.assets.find(a => a.id === baseId || (a.type === 'character' && a.refName === baseId)) || findAssetByIdOrDisplayId(i.id, type as any, prev.assets);
          
          let extras: string[] = [];
          if (asset) {
            if (type === 'character') {
              if (asset.details?.height) extras.push(asset.details.height.includes('cm') ? asset.details.height : `${asset.details.height}cm`);
            } else if (type === 'scene') {
              if (asset.details?.environment) extras.push(asset.details.environment);
              if (asset.details?.lighting) extras.push(asset.details.lighting);
            }
          }
          
          if (i.extra) {
            i.extra.split(/[，,]/).forEach(e => {
              const trimmed = e.trim();
              if (trimmed && !extras.includes(trimmed)) extras.push(trimmed);
            });
          }

          let voiceInfo = i.voiceName ? `角色说话音色=${i.voiceName}` : '';
          if (!voiceInfo && type === 'character' && asset?.details?.voiceName && s.prompt && (s.prompt.includes(`${i.name}：`) || s.prompt.includes(`${i.name}:`))) {
            voiceInfo = `角色说话音色=${asset.details.voiceName}`;
          }

          const extraStr = extras.length > 0 ? `（${extras.join('，')}）` : '';
          const displayId = getAssetDisplayId(i.id, type, prev.assets);
          return `${i.name}=${displayId}${extraStr}${voiceInfo}`;
        }).join(', ');

        const finalAssets = { ...s.assets, [field]: updatedBindingStr };

        // If we just added/updated a character variant, check if we should remove a prop with the same name
        if (type === 'character' && !isDelete && newId.includes('_v') && !newId.startsWith('图')) {
          const variantId = newId.split('_v')[1];
          const assetId = newId.split('_v')[0];
          const asset = prev.assets.find(a => a.id === assetId || (a.type === 'character' && a.refName === assetId));
          let variant = asset?.variants?.find(v => v.id === variantId);
          if (!variant && variantId.startsWith('v')) {
            const idx = parseInt(variantId.slice(1)) - 1;
            if (idx >= 0 && asset?.variants && asset.variants[idx]) variant = asset.variants[idx];
          }
          if (variant) {
            const propBindings = parseBindings(s.assets.props);
            const filteredProps = propBindings.filter(p => p.name !== variant.name);
            if (filteredProps.length !== propBindings.length) {
              finalAssets.props = filteredProps.map(i => `${i.name}=${i.id}${i.extra ? `（${i.extra}）` : ''}`).join(', ');
            }
          }
        }

        return { ...s, assets: finalAssets };
      });
      return { ...prev, segments: updateSegments(prev.segments || []), tasks: (prev.tasks || []).map(t => ({ ...t, segments: updateSegments(t.segments || []) })) };
    });
  };

  const handleBatchRegeneratePrompts = async () => {
    if (!data) return;
    if (!confirm('确定要重新生成所有未生成视频的分段提示词吗？')) return;
    for (const seg of (data?.segments || [])) {
      if (!seg.generatedVideoUrl) {
        await handleRegenerateSegmentPrompt(seg.id);
        await new Promise(r => setTimeout(r, 500));
      }
    }
  };




  const formatBindings = (bindingStr: string, type: 'character' | 'scene' | 'prop', segPrompt?: string) => {
    return formatAssetBinding(type, bindingStr, segPrompt);
  };

  const handleCopyPrompt = (seg: Segment) => {
    const formattedText = `【角色资产绑定】${formatBindings(seg.assets.characters, 'character', seg.prompt)}\n【场景资产绑定】${formatBindings(seg.assets.scenes, 'scene', seg.prompt)}\n【道具资产绑定】${formatBindings(seg.assets.props, 'prop', seg.prompt)}\n【分段综合提示词】\n${cleanPrompt(seg.prompt)}`;
    navigator.clipboard.writeText(formattedText);
    setToast({ message: '分段方案已复制', type: 'success' });
  };

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSaveTask = useCallback(async (dataToSave?: PipelineData | any, silent = true) => {
    // Check if it's a manual event call (e.g. onClick={handleSaveTask})
    const isEvent = !!(dataToSave && (dataToSave.nativeEvent || dataToSave.preventDefault));
    const actualData = isEvent ? undefined : dataToSave;
    
    // Toast should only show if explicitly requested (silent=false) OR if it's a manual event
    const shouldShowToast = (silent === false) || isEvent;
    
    // CRITICAL: Always prefer the latest data from dataRef.current if no specific snapshot is provided
    const targetData = actualData || dataRef.current || data;
    if (!targetData) return;

    // If we are already saving, queue another save for later to ensure latest changes are captured
    if (isSavingRef.current) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => handleSaveTask(), 1000);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setToast({ message: '请先登录以保存任务。', type: 'error' });
      return;
    }

    isSavingRef.current = true;
    // Cancel any pending sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    if (syncAbortControllerRef.current) {
      syncAbortControllerRef.current.abort();
    }

    // Function to clean data from non-serializable parts and handle circular references
    const getCleanData = (obj: any, ancestors = new Set()): any => {
      if (obj === null || typeof obj !== 'object') return obj;
      
      try {
        // Handle circular references - only if object is an ancestor
        if (ancestors.has(obj)) return '[Circular]';
        
        // Handle Window objects
        if (obj === window || (obj.window === obj)) return '[Window]';

        // Handle DOM nodes
        if (obj.nodeType && typeof obj.nodeType === 'number') {
          return undefined; // Skip DOM nodes
        }
        
        // Handle Date objects
        if (obj instanceof Date) return obj.toISOString();
        
        const newAncestors = new Set(ancestors);
        newAncestors.add(obj);

        // Handle Arrays
        if (Array.isArray(obj)) {
          const cleanedArr = obj
            .map(item => getCleanData(item, newAncestors))
            .filter(item => item !== undefined);
          return cleanedArr;
        }
        
        // Handle Objects
        const cleanedObj: any = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // Skip React internal properties
            if (key.startsWith('__react') || key.startsWith('_react')) continue;
            
            const cleanedValue = getCleanData(obj[key], newAncestors);
            if (cleanedValue !== undefined) {
              cleanedObj[key] = cleanedValue;
            }
          }
        }
        return cleanedObj;
      } catch (e) {
        // Handle cross-origin or other inaccessible objects
        return '[Inaccessible]';
      }
    };

    try {
      const cleanedData = getCleanData(targetData);
      const response = await fetch('/api/user/pipelines', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cleanedData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || '保存任务失败');
      }
      
      const result = await response.json().catch(() => ({}));
      if (result && result.assets) {
        setData(prev => {
          if (!prev || prev.id !== targetData.id) return prev;
          
          // Map over prev.assets to ensure we don't lose any local assets that might be missing from server response
          const mergedAssets = (prev.assets || []).map(localAsset => {
            const serverAsset = result.assets.find((a: any) => a.id === localAsset.id);
            if (!serverAsset) return localAsset;
            
            const isPermanent = (url?: string) => url?.startsWith('http') && !url.includes('blob:');

            // Be defensive: don't let the server revert a valid image to empty or old
            const mergedMedia = { ...localAsset.generatedMedia };
            if (serverAsset.generatedMedia) {
              if (isPermanent(serverAsset.generatedMedia.mainImageUrl)) mergedMedia.mainImageUrl = serverAsset.generatedMedia.mainImageUrl;
              if (isPermanent(serverAsset.generatedMedia.secondaryMediaUrl)) mergedMedia.secondaryMediaUrl = serverAsset.generatedMedia.secondaryMediaUrl;
              if (isPermanent(serverAsset.generatedMedia.layoutUrl)) mergedMedia.layoutUrl = serverAsset.generatedMedia.layoutUrl;
              if (isPermanent(serverAsset.generatedMedia.combinedUrl)) mergedMedia.combinedUrl = serverAsset.generatedMedia.combinedUrl;
            }

            return { 
              ...serverAsset, 
              generatedMedia: mergedMedia,
              variants: (serverAsset.variants || []).map((sv: any) => {
                const lv = localAsset.variants?.find(v => v.id === sv.id);
                if (!lv) return sv;
                return {
                  ...sv,
                  imageUrl: isPermanent(sv.imageUrl) ? sv.imageUrl : lv.imageUrl,
                  threeViewUrl: isPermanent(sv.threeViewUrl) ? sv.threeViewUrl : lv.threeViewUrl
                };
              })
            };
          });

          return { ...prev, assets: mergedAssets };
        }, false);
      }

      if (shouldShowToast) {
        setToast({ message: '资产已成功保存到资产管理！', type: 'success' });
      }
    } catch (err: any) {
      console.error('保存任务失败:', err);
      const errorMsg = formatErrorMessage(err, '保存任务失败');
      setToast({ message: errorMsg, type: 'error' });
    } finally {
      isSavingRef.current = false;
    }
  }, [data]);

  const confirmDeleteTask = useCallback(() => {
    if (!taskToDelete) return;
    
    setData(prev => {
      if (!prev) return null;
      
      // 1. Identify if we need to exit focus mode
      const taskBeingDeleted = prev.tasks.find(t => String(t.id) === String(taskToDelete));
      if (taskBeingDeleted?.segments?.some(s => s.id === activeSegId)) {
        setActiveSegId(null);
      }

      // 2. Filter out the task
      const nextTasks = (prev.tasks || []).filter(t => String(t.id) !== String(taskToDelete));
      const nextData = { ...prev, tasks: nextTasks };
      
      // 3. Persist to server
      setTimeout(() => handleSaveTask(nextData), 300);
      
      return nextData;
    });

    setTaskToDelete(null);
    setToast({ message: '任务已删除', type: 'success' });
  }, [taskToDelete, activeSegId, setData, handleSaveTask]);

  const confirmDeleteAsset = useCallback(() => {
    if (!assetToDelete) return;
    
    setData(prev => {
      if (!prev) return null;
      
      // 1. 删除资产列表中的项
      const newAssets = prev.assets.filter(a => String(a.id) !== String(assetToDelete));
      
      // 2. 清理所有任务分段中对该资产的绑定
      const newTasks = (prev.tasks || []).map(t => ({
        ...t,
        segments: (t.segments || []).map(s => {
          const filterBinding = (bindingStr: string) => {
            if (!bindingStr) return '';
            return bindingStr.split(',')
              .map(x => x.trim())
              .filter(x => {
                if (!x) return false;
                const parts = x.split('=@');
                if (parts.length < 2) return true;
                const bindingId = parts[1];
                return bindingId !== assetToDelete && !bindingId.startsWith(`${assetToDelete}_v`);
              })
              .join(', ');
          };

          return {
            ...s,
            assets: {
              ...s.assets,
              characters: filterBinding(s.assets.characters),
              scenes: filterBinding(s.assets.scenes),
              props: filterBinding(s.assets.props)
            }
          };
        })
      }));

      const nextData = { ...prev, assets: newAssets, tasks: newTasks };
      
      // 3. Persist to server
      setTimeout(() => handleSaveTask(nextData), 300);
      
      return nextData;
    });

    setAssetToDelete(null);
    setToast({ message: '资产已删除', type: 'success' });
  }, [assetToDelete, setData, handleSaveTask]);

  const handleCleanUnusedBindings = (segmentId: string) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        segments: (prev.segments || []).map(s => {
          if (s.id !== segmentId) return s;
          const cleanType = (type: 'character' | 'scene' | 'prop') => {
            const field = type === 'character' ? 'characters' : type === 'scene' ? 'scenes' : 'props';
            const items = parseBindings((s.assets as any)[field]);
            const filtered = items.filter(item => {
              if (type === 'scene') return true;
              let asset = prev?.assets?.find(a => a.id === item.id);
              if (!asset) asset = prev?.assets?.find(a => a.name === item.name && a.type === type);
              if (!asset && type === 'character') asset = prev?.assets?.find(a => a.refName === item.id);
              return s.prompt && (s.prompt.toLowerCase().includes((asset?.name || item.name || "").toLowerCase()));
            });
            return filtered.map(i => `${i.name}=${getAssetDisplayId(i.id, type)}`).join(', ');
          };
          return { ...s, assets: { ...s.assets, characters: cleanType('character'), props: cleanType('prop') } };
        })
      };
    });
  };



  const handleConfirmPromptEdit = () => {
    if (!editingPrompt || !data) return;
    
    let newData: PipelineData | null = null;

    if (editingPrompt.type === 'segment') {
      const task = data.tasks?.find(t => t.id === editingPrompt.taskId);
      const segment = task?.segments?.find(s => s.id === editingPrompt.segmentId);
      if (segment) {
        newData = {
          ...data,
          tasks: data.tasks?.map(t => t.id === editingPrompt.taskId ? {
            ...t,
            segments: t.segments?.map(s => s.id === editingPrompt.segmentId ? { ...s, prompt: tempPromptValue } : s)
          } : t)
        };
      }
    } else if (editingPrompt.id) {
      newData = {
        ...data,
        assets: data.assets?.map(a => a.id === editingPrompt.id ? {
          ...a,
          subAssets: !editingPrompt.variantId ? { 
            ...a.subAssets, 
            [editingPrompt.type === 'main' ? 'mainPrompt' : 'secondaryPrompt']: tempPromptValue 
          } : a.subAssets,
          variants: editingPrompt.variantId ? a.variants?.map(v => v.id === editingPrompt.variantId ? { 
            ...v, 
            [editingPrompt.type === 'variant' ? 'prompt' : 'secondaryPrompt']: tempPromptValue 
          } : v) : a.variants
        } : a)
      };
    }
    
    if (newData) {
      setData(newData);
      handleSaveTask();
    }
    
    setEditingPrompt(null);
    setTempPromptValue('');
  };

  const AssetTag: React.FC<{ item: { name: string; id: string; extra?: string }; type: string; segmentId: string; prompt: string }> = ({ item, type, segmentId, prompt }) => {
    const asset = findAssetByIdOrDisplayId(item.id, type);

    const colors = type === 'character' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                   type === 'scene' ? 'bg-green-50 text-green-700 border-green-100' : 
                   type === 'continuity' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                   'bg-purple-50 text-purple-600 border-purple-100';
    
    const formatDisplayId = (id: string) => {
      if (type === 'continuity') return 'PREV_FINAL_FRAME';
      return getAssetDisplayId(id, type);
    };

    return (
      <div className={`flex items-center space-x-1.5 px-2 py-1 rounded-full border ${colors} shadow-sm group relative hover:scale-105 transition-transform`}>
        <div className="w-5 h-5 rounded-full bg-white overflow-hidden border border-gray-100 flex-shrink-0 relative">
          {(() => {
            if (type === 'continuity') {
              const allSegs = data?.segments || data?.tasks?.flatMap(t => t.segments || []) || [];
              const segIndex = allSegs.findIndex(s => s.id === segmentId);
              const prevSeg = segIndex > 0 ? allSegs[segIndex - 1] : null;
              const displayUrl = prevSeg?.generatedVideoUrl || prevSeg?.imageUrl;
              return (
                <>
                  {displayUrl && <img src={displayUrl} className="w-full h-full object-contain" />}
                  {prevSeg?.generatedVideoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <svg className="w-2 h-2 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  )}
                </>
              );
            }
            const isSecondary = item.id.endsWith('_v');
            let tempId = item.id;
            if (isSecondary) tempId = item.id.slice(0, -2);
            const isVariant = tempId.includes('_v') && !tempId.startsWith('图') && !tempId.startsWith('场景') && !tempId.startsWith('道具');
            let realId = tempId;
            let variantId = '';
            if (isVariant) {
              const parts = tempId.split('_v');
              realId = parts[0];
              variantId = parts[1];
            }
            const a = data?.assets?.find(x => x.id === realId || (x.type === 'character' && x.refName === realId));
            let url = isSecondary ? a?.generatedMedia?.secondaryMediaUrl : a?.generatedMedia?.mainImageUrl;
            if (isVariant && a?.variants) {
              let v = a?.variants?.find(v => v.id === variantId);
              if (!v && variantId.startsWith('v')) {
                const idx = parseInt(variantId.slice(1)) - 1;
                if (idx >= 0 && a.variants && a.variants[idx]) v = a.variants[idx];
              }
              if (v) {
                if (isSecondary) url = v.secondaryMediaUrl;
                else url = v.imageUrl;
              }
            }
            const displayUrl = (isSecondary && a?.type === 'scene') ? a?.generatedMedia?.mainImageUrl : (url || a?.generatedMedia?.mainImageUrl);
            return (
              <>
                {displayUrl && <img src={displayUrl} className="w-full h-full object-contain" />}
                {isSecondary && a?.type === 'scene' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <svg className="w-2 h-2 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                )}
              </>
            );
          })()}
        </div>
        <span className="text-[11px] font-bold truncate max-w-[60px]">{item.name || asset?.name || '未知'}</span>
        <span className="text-[9px] opacity-40">=</span>
        <div className="flex items-center space-x-1 bg-white/60 px-2 py-0.5 rounded-lg border border-black/5 relative cursor-pointer max-w-[400px]">
          <span className="text-[9px] font-black tracking-tighter whitespace-nowrap flex-shrink-0">{formatDisplayId(item.id)}</span>
          {item.extra && (
            <span className="text-[8px] opacity-60 font-medium truncate border-l border-black/5 pl-1 ml-1" title={item.extra}>
              {item.extra}
            </span>
          )}
          {type !== 'continuity' && <svg className="w-2 h-2 opacity-30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeWidth={3} /></svg>}
          {type !== 'continuity' && (
            <select 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={e => handleUpdateBinding(segmentId, type, item.id, e.target.value)} 
              value={(() => {
              if (!asset) return item.id;
              
              const isSecondary = item.id.endsWith('_v');
              let tempId = item.id;
              if (isSecondary) tempId = item.id.slice(0, -2);
              const isVariant = tempId.includes('_v') && !tempId.startsWith('图') && !tempId.startsWith('场景') && !tempId.startsWith('道具');
              
              if (isVariant) {
                const variantId = tempId.split('_v')[1];
                let v = asset.variants?.find(v => v.id === variantId);
                if (!v && variantId.startsWith('v')) {
                  const idx = parseInt(variantId.slice(1)) - 1;
                  if (idx >= 0 && asset.variants && asset.variants[idx]) v = asset.variants[idx];
                }
                if (v) return `${asset.id}_v${v.id}${isSecondary ? '_v' : ''}`;
                return `${asset.id}_v${variantId}${isSecondary ? '_v' : ''}`;
              }
              
              // 如果已经是标准ID格式，直接返回
              if (item.id.startsWith('char_') || item.id.startsWith('scene_') || item.id.startsWith('prop_')) return item.id;
              // 如果是角色引用名
              if (type === 'character' && (item.id === asset.refName || item.id === `@${asset.name}`)) return item.id;
              
              return `${asset.id}${isSecondary ? '_v' : ''}`;
            })()}
          >
            {data?.assets?.filter(a => a.type === type).map(a => (
              <React.Fragment key={a.id}>
                {a.type === 'character' ? (
                  <>
                    <option value={a.id}>{a.name} (角色主图)</option>
                    <option value={a.id + "_v"}>{a.name} (角色设定图)</option>
                    {a.variants?.map(v => (
                      <React.Fragment key={v.id}>
                        <option value={`${a.id}_v${v.id}`}>{a.name} ({v.name || '多形象'})</option>
                        <option value={`${a.id}_v${v.id}_v`}>{a.name} ({v.name || '形象图'} - 角色设定图)</option>
                      </React.Fragment>
                    ))}
                    <option value={a.refName || `@${a.name}`}>{a.name} (@演员)</option>
                  </>
                ) : a.type === 'scene' ? (
                  <>
                    <option value={a.id}>{a.name} (场景图)</option>
                    <option value={a.id + "_v"}>{a.name} (场景方案)</option>
                  </>
                ) : (
                  <option value={a.id}>{a.name} (图片)</option>
                )}
              </React.Fragment>
            ))}
          </select>
          )}
        </div>
        <button onClick={() => handleUpdateBinding(segmentId, type, item.id, '', true)} className="w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button>
      </div>
    );
  };
  
  return (
    <div className={`h-full w-full flex flex-col min-h-0 relative ${productionMode === 'prompt' ? 'bg-white' : ''}`}>
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={scriptFileInputRef} 
        className="hidden" 
        accept=".txt,.docx,.pdf,.xlsx,.xls"
        onChange={handleScriptFileUpload}
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,video/*"
        onChange={handleFileUpload}
      />
      <input 
        type="file" 
        ref={styleFileInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleAnalyzeStyleImage}
      />

      
      {step === Step.INPUT && (
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 flex flex-col overflow-y-auto px-4 pb-12 pt-4 max-w-7xl mx-auto w-full no-scrollbar animate-fadeIn text-left">
            {/* 制作模式切换隐藏，默认提示词模式 */}
            <div className="flex items-center space-x-2 mb-6 hidden pointer-events-none opacity-0">
              <button
                onClick={() => setProductionMode('prompt')}
                className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300 flex items-center space-x-2 ${
                  productionMode === 'prompt' 
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-200' 
                    : 'bg-white border border-gray-100 text-gray-400 hover:border-purple-200 hover:text-purple-500'
                }`}
              >
                <Wand2 className={`w-4 h-4 ${productionMode === 'prompt' ? 'animate-pulse' : ''}`} />
                <span>提示词模式</span>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6 text-left">
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-pink-400 uppercase tracking-widest ml-1">分段规格</h4>
                <div className="relative group">
                  <select 
                    value={contentMode}
                    onChange={(e) => setContentMode(e.target.value as 'movie' | 'short_drama')}
                    className="w-full h-12 bg-white border border-pink-100 rounded-2xl px-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-pink-500/10 shadow-sm appearance-none cursor-pointer group-hover:border-pink-300 transition-colors"
                  >
                    <option value="movie">电影模式 (横屏/深度)</option>
                    <option value="short_drama">短剧模式 (竖屏/高密)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-pink-300">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">空间指令</h4>
                <div className="relative group">
                  <select 
                    value={spatialMode}
                    onChange={(e) => setSpatialMode(e.target.value as 'strong' | 'standard')}
                    className="w-full h-12 bg-white border border-indigo-100 rounded-2xl px-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/10 shadow-sm appearance-none cursor-pointer group-hover:border-indigo-300 transition-colors"
                  >
                    <option value="strong">强空间结构 (含坐标)</option>
                    <option value="standard">常规提示词 (无坐标)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-1">画面画风</h4>
                <div className="relative group">
                  <select 
                    id="visual-style-select"
                    name="visual-style-select"
                    value={selectedVisualStyle}
                    onChange={(e) => setSelectedVisualStyle(e.target.value)}
                    className="w-full h-12 bg-white border border-purple-100 rounded-2xl px-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500/10 shadow-sm appearance-none cursor-pointer group-hover:border-purple-300 transition-colors"
                  >
                    {Array.from(new Set(VISUAL_STYLES.map(s => s.category || '其他'))).map(category => (
                      <optgroup key={category} label={category}>
                        {VISUAL_STYLES.filter(s => (s.category || '其他') === category).map(style => (
                          <option key={style.id} value={style.name}>{style.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-purple-300">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">分镜导演风格</h4>
                </div>
                <div className="relative group">
                  <select 
                    id="style-select"
                    name="style-select"
                    value={`${selectedGenreId}|${selectedDirectorName}`}
                    onChange={(e) => {
                      const [genreId, directorName] = e.target.value.split('|');
                      setSelectedGenreId(genreId);
                      setSelectedDirectorName(directorName);
                    }}
                    className={`w-full h-12 bg-white border border-blue-100 rounded-2xl px-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/10 shadow-sm appearance-none transition-colors cursor-pointer`}
                  >
                    {filteredGenres.map(genre => (
                      <optgroup key={genre.id} label={genre.name}>
                        {genre.directors.map(director => (
                          <option key={`${genre.id}|${director.name}`} value={`${genre.id}|${director.name}`}>
                            {director.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-blue-300">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">段落规划</h4>
                <div className="relative group">
                  <select 
                    value={isAutoTargetSegments ? 'auto' : 'manual'}
                    onChange={(e) => setIsAutoTargetSegments(e.target.value === 'auto')}
                    className="w-full h-12 bg-white border border-blue-100 rounded-2xl px-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/10 shadow-sm appearance-none cursor-pointer group-hover:border-blue-300 transition-colors"
                  >
                    <option value="auto">AI 自动规划</option>
                    <option value="manual">手动设定段数</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                {!isAutoTargetSegments && (
                  <div className="flex items-center justify-between px-2 py-1.5 bg-blue-50/50 rounded-xl border border-blue-100/50 animate-fadeIn">
                    <span className="text-[10px] font-bold text-blue-400">目标数</span>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => setTargetSegments(Math.max(4, targetSegments - 1))}
                        className="w-6 h-6 rounded-full bg-white border border-blue-100 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black text-blue-600 w-4 text-center">{targetSegments}</span>
                      <button 
                        onClick={() => setTargetSegments(Math.min(200, targetSegments + 1))}
                        className="w-6 h-6 rounded-full bg-white border border-blue-100 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest ml-1">每段时长</h4>
                <div className="relative group">
                  <select 
                    value={isFlexibleDuration}
                    onChange={(e) => setIsFlexibleDuration(e.target.value)}
                    className="w-full h-12 bg-white border border-cyan-100 rounded-2xl px-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-cyan-500/10 shadow-sm appearance-none cursor-pointer group-hover:border-cyan-300 transition-colors"
                  >
                    <option value="fixed">固定 15s</option>
                    <option value="flexible-15">4-15s 随机 (推荐)</option>
                    <option value="flexible-30">4-30s 随机</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {selectedDirectorName === '自定义' && (
                <div className="col-span-2 md:col-span-full space-y-2 animate-fadeIn mt-2">
                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">自定义导演风格</h4>
                  <div className="relative">
                    <textarea 
                      className="w-full h-12 bg-white border border-indigo-100 rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/10 shadow-sm placeholder-gray-300 resize-none transition-all focus:h-24"
                      placeholder="请输入导演风格描述..."
                      value={customDirectorStyle}
                      onChange={e => setCustomDirectorStyle(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {selectedVisualStyle === '自定义' && (
              <div className="animate-fadeIn relative group">
                <textarea 
                  className="w-full h-24 bg-white border border-purple-100 rounded-2xl p-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-purple-500/10 shadow-inner placeholder-gray-300"
                  placeholder="请输入自定义画风描述，例如：皮克斯风格的3D渲染，明亮的色彩，圆润的角色设计..."
                  value={customVisualStyle}
                  onChange={e => setCustomVisualStyle(e.target.value)}
                />
                <button
                  onClick={() => styleFileInputRef.current?.click()}
                  disabled={isAnalyzingStyle}
                  className="absolute right-4 top-4 p-2 bg-purple-50 text-purple-500 rounded-xl hover:bg-purple-500 hover:text-white transition-all shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  title="上传参考图分析风格"
                >
                  {isAnalyzingStyle ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ImageIcon className="w-5 h-5" />
                  )}
                </button>
                {isAnalyzingStyle && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center z-10">
                    <div className="flex flex-col items-center space-y-2">
                      <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                      <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">AI 正在分析风格...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <motion.div 
            layout
            className={`flex-1 relative flex flex-col bg-white border-2 rounded-[28px] shadow-sm overflow-hidden min-h-[320px] transition-all duration-300 ${isDragging ? 'border-blue-400 bg-blue-50/30 scale-[1.005]' : 'border-gray-200 hover:border-gray-300'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <AnimatePresence>
              {isDragging && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none"
                >
                  <motion.div 
                    initial={{ scale: 0.5, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="w-20 h-20 bg-white rounded-full shadow-2xl flex items-center justify-center mb-4"
                  >
                    <Upload className="w-10 h-10 text-blue-500 animate-bounce" />
                  </motion.div>
                  <p className="text-blue-600 font-black text-xl tracking-widest">释放以导入剧本</p>
                  <p className="text-blue-400 text-sm mt-2">支持 .txt, .docx, .pdf 格式</p>
                </motion.div>
              )}
            </AnimatePresence>
            {(uploadedFileName || (script || '').trim()) && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-8 pt-8"
              >
                <div className="bg-[#f0f7ff] border border-[#dbeafe] rounded-[24px] p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <FileText className="w-7 h-7 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-800">{uploadedFileName || '手动输入剧本'}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-widest flex items-center">
                            <Zap className="w-3 h-3 mr-1" />
                            字数: <span className="text-blue-600 ml-1">{(uploadedFileContent || script).length.toLocaleString()}</span>
                          </span>
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            剩余额度: <span className={`ml-1 ${((uploadedFileContent || script).length > 90000) ? 'text-red-500' : 'text-gray-500'}`}>
                              {Math.max(0, 100000 - (uploadedFileContent || script).length).toLocaleString()}
                            </span>
                          </span>
                          <span className="text-[11px] font-bold text-red-500 uppercase tracking-widest flex items-center">
                            <Zap className="w-3 h-3 mr-1" />
                            预计扣除: <span className="ml-1">{Math.ceil((uploadedFileContent || script).length / 2000) * (GENERATION_COSTS.DIRECTOR as any).SCRIPT_INPUT_PER_2000} 积分</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            <textarea 
              className={`flex-1 bg-transparent p-8 text-lg leading-relaxed outline-none resize-none placeholder-gray-300 ${(uploadedFileName || (script || '').trim()) ? 'pt-6' : 'pt-8'}`} 
              placeholder={uploadedFileName ? "已上传文件，您也可以在此输入补充说明（可选）..." : "在此输入剧本内容..."} 
              value={script} 
              onChange={e => setScript(e.target.value)} 
            />
            <div className="absolute bottom-6 right-8 flex items-center space-x-2 pointer-events-none">
              <span className={`text-[10px] font-black tracking-widest uppercase ${script.length >= 9500 ? 'text-red-400' : 'text-gray-300'}`}>
                {script.length.toLocaleString()} / 10,000
              </span>
            </div>
          </motion.div>
          <div className="flex justify-end items-center mt-6 space-x-4">
            {uploadedFileName && (
              <div className="flex items-center space-x-2 px-4 py-3 bg-green-50 border border-green-200 rounded-2xl animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-sm font-bold text-green-600 truncate max-w-[300px]">{uploadedFileName}</span>
                <button onClick={() => { setUploadedFileName(null); setUploadedFileContent(null); }} className="text-green-400 hover:text-green-600 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <button 
              onClick={() => scriptFileInputRef.current?.click()}
              className="flex items-center space-x-2 px-8 py-4 bg-blue-50 text-blue-600 border border-blue-100 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-all shadow-lg shadow-blue-500/5"
            >
              <Upload className="w-5 h-5" />
              <span>导入剧本文件</span>
            </button>
          </div>
          <div className="flex flex-col md:flex-row gap-4 mt-6">
            <button 
              onClick={() => handleGenerate(false)} 
              disabled={!(script || '').trim() && !uploadedFileContent} 
              className={`flex-1 h-16 rounded-2xl font-black text-lg tracking-[0.2em] uppercase transition-all ${((script || '').trim() || uploadedFileContent) ? 'bg-[#1a73e8] text-white shadow-2xl shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              扫描资产
            </button>

            {/* 
            <div className="flex flex-col flex-1 space-y-2">
              <button 
                onClick={() => handleGenerate(true)} 
                disabled={!(script || '').trim() && !uploadedFileContent} 
                className={`w-full h-16 rounded-2xl font-black text-lg tracking-[0.2em] uppercase transition-all ${((script || '').trim() || uploadedFileContent) ? 'bg-[#1a73e8] text-white shadow-2xl shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <Sparkles className="w-5 h-5" />
                  <span>一键制剧</span>
                </div>
              </button>
              <div className="flex items-center justify-center space-x-2 text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                <Zap className="w-3 h-3 fill-amber-500" />
                <span>全自动流程：资产 -&gt; 分段 -&gt; 媒体 -&gt; 视频</span>
              </div>
            </div>
            */}
            
            {data && (
              <button 
                onClick={() => setStep(Step.RESULT)} 
                className="flex-1 h-16 rounded-2xl font-black text-lg tracking-[0.2em] uppercase bg-white border-2 border-gray-200 text-gray-400 hover:bg-gray-50 transition-all"
              >
                查看当前结果
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {step === Step.ANALYZING && (
        <div className="flex-1 flex flex-col items-center justify-start animate-fadeIn px-4 py-12 bg-white overflow-y-auto no-scrollbar">
          <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-10 border-b border-gray-50 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">💡</span>
                <h3 className="text-xl font-black text-gray-800 tracking-tight">创意要点</h3>
              </div>
            </div>

            <div className="p-10 space-y-10 flex-1 overflow-y-auto no-scrollbar">
              {/* Creative Points Section */}
              <div className="space-y-10">
                {[
                  { label: '视频主题', value: scriptAnalysis?.videoTheme },
                  { label: '视频风格', value: scriptAnalysis?.videoStyle },
                  { label: '场景描述', value: scriptAnalysis?.sceneDescription },
                  { label: '分镜结构', value: scriptAnalysis?.storyboardStructure },
                  { label: '角色设置', value: scriptAnalysis?.characterSetting },
                  { label: '台词内容', value: scriptAnalysis?.dialogueContent },
                  { label: '画面比例', value: scriptAnalysis?.aspectRatio },
                  { label: '语言', value: scriptAnalysis?.language },
                ].map((item, idx) => (
                  <AnimatePresence key={idx}>
                    {revealIndex > idx && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">{item.label}</p>
                        <p className="text-lg font-bold text-gray-800 leading-relaxed">
                          {item.value ? item.value : (
                            <div className="flex items-center space-x-2">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              <span className="text-gray-400 font-medium">分析中...</span>
                            </div>
                          )}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                ))}
              </div>

              {/* Assets Section */}
              {revealIndex >= 8 && data?.assets && data.assets.length > 0 && (
                <div className="pt-10 border-t border-gray-50 space-y-8">
                  <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">已提取核心资产</p>
                  <div className="grid grid-cols-2 gap-6">
                    {data?.assets?.map((asset, idx) => (
                      <AnimatePresence key={asset.id}>
                        {revealIndex > (8 + idx) && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-5 bg-gray-50 rounded-2xl border border-gray-100 flex items-center space-x-4"
                          >
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
                              {asset.type === 'character' ? <User className="w-6 h-6 text-indigo-500" /> : 
                               asset.type === 'scene' ? <MapPin className="w-6 h-6 text-green-500" /> : 
                               <Package className="w-6 h-6 text-amber-500" />}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                {asset.type === 'character' ? '图' : asset.type === 'scene' ? '场景' : '道具'}{idx + 1}
                              </p>
                              <p className="text-sm font-bold text-gray-700 truncate max-w-[140px]">{asset.name}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ))}
                  </div>


                </div>
              )}
            </div>

            <div className="p-8 bg-white border-t border-gray-50 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-4">
                <div className="flex space-x-1.5">
                  {!isAssetExtractionComplete || revealIndex < (8 + (data?.assets?.length || 0)) ? (
                    [0, 1, 2].map(i => (
                      <motion.div 
                        key={i}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        className="w-2 h-2 bg-blue-500 rounded-full"
                      />
                    ))
                  ) : (
                    <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    {revealIndex < (8 + (data?.assets?.length || 0)) ? '资产深度分析中...' : '剧本资产提取完成'}
                  </span>
                  
                  {isAssetExtractionComplete && revealIndex >= (8 + (data?.assets?.length || 0)) && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setStep(Step.RESULT)}
                      className="px-5 py-2 bg-blue-600 text-white text-[12px] font-black rounded-full shadow-lg shadow-blue-200 flex items-center gap-2 transition-all"
                    >
                      <span>进入资产编排</span>
                      <ChevronRight className="w-3 h-3" />
                    </motion.button>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setStep(Step.RESULT)}
                className="flex items-center space-x-1 text-[11px] font-bold text-gray-400 hover:text-blue-500 transition-colors uppercase tracking-widest"
              >
                <span>收起</span>
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === Step.GENERATING && (
        <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn px-4 pb-12">
          {automationError ? (
            <div className="text-center space-y-8 max-w-lg p-10 bg-white border border-red-100 rounded-[40px] shadow-2xl shadow-red-500/5">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight">剧本拆解中断</h3>
                <p className="text-sm font-bold text-red-500 bg-red-50/50 py-3 px-6 rounded-2xl border border-red-100/50">{automationError}</p>
              </div>
              <div className="flex flex-col space-y-3">
                <button 
                  onClick={async () => {
                    setAutomationError(null);
                    if (!data) {
                      handleGenerate(automationMode === AutomationMode.FULL);
                    } else if ((data?.tasks?.length || 0) === 0) {
                      const dataWithSegments = await handleConfirmAssets(data);
                      if (dataWithSegments) {
                        if (automationMode === AutomationMode.FULL) {
                          handleFullAutomation(dataWithSegments);
                        } else {
                          setStep(Step.RESULT);
                        }
                      }
                    } else {
                      handleFullAutomation(data);
                    }
                  }}
                  className="w-full h-14 bg-blue-500 text-white rounded-2xl font-black text-sm tracking-widest uppercase shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  继续尝试未完成步骤
                </button>
                <button 
                  onClick={() => {
                    setAutomationError(null);
                    setStep(Step.RESULT);
                  }}
                  className="w-full h-14 bg-white border border-gray-200 text-gray-600 rounded-2xl font-black text-sm tracking-widest uppercase hover:bg-gray-50 transition-all"
                >
                  转为预览模式 (查看已生成内容)
                </button>
                <button 
                  onClick={() => {
                    setAutomationError(null);
                    setStep(Step.INPUT);
                  }}
                  className="w-full h-14 bg-transparent text-gray-400 font-bold text-xs tracking-widest uppercase hover:text-gray-600 transition-all"
                >
                  取消并返回
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden flex flex-col animate-fadeIn max-h-[80vh]">
              <div className="p-8 border-b border-gray-50 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">💡</span>
                  <h3 className="text-xl font-black text-gray-800 tracking-tight">创意要点</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    {[0, 1, 2].map(i => (
                      <motion.div 
                        key={i}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        className="w-1.5 h-1.5 bg-blue-500 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8 flex-1 overflow-y-auto no-scrollbar">
                {[
                  '视频主题', '视频风格', '场景描述', '分镜结构', 
                  '角色设置', '台词内容', '画面比例', '语言'
                ].map((label, idx) => (
                  <div key={idx} className="space-y-1.5 opacity-40">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                    <div className="h-4 w-2/3 bg-gray-100 rounded-lg animate-pulse" />
                  </div>
                ))}
              </div>

              <div className="p-6 bg-white border-t border-gray-50 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">
                    {loadingMsg || '正在深度解析剧本...'}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    isCancelledRef.current = true;
                    setStep(Step.INPUT);
                    setLoadingMsg('');
                  }}
                  className="flex items-center space-x-1 text-[10px] font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                >
                  <span>取消并返回</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === Step.RESULT && data && (
        <div className={`flex-1 relative min-h-0 ${productionMode === 'prompt' ? 'bg-white' : ''}`}>
          {productionMode === 'prompt' ? (
            <div className="absolute inset-0 flex flex-col overflow-y-auto no-scrollbar bg-white">
              <div className="max-w-4xl mx-auto w-full px-8 py-16 space-y-16 text-left">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-8">
                  <div>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">提示词模式结果</h2>
                    <p className="text-sm font-bold text-gray-400 mt-2 uppercase tracking-widest">Asset Decomposition & Prompt Generation</p>
                  </div>
                  <button 
                    onClick={() => setStep(Step.INPUT)}
                    className="px-6 py-2 border-2 border-gray-100 rounded-xl text-xs font-black text-gray-400 hover:border-gray-200 hover:text-gray-600 transition-all uppercase tracking-widest"
                  >
                    返回输入
                  </button>
                </div>

                {/* 资产列表 */}
                <div className="space-y-8">
                  <h3 className="text-xl font-black text-gray-800 flex items-center space-x-3">
                    <span className="w-2 h-8 bg-purple-500 rounded-full" />
                    <span>核心资产库 (Assets)</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-8">
                    {data?.assets?.map((asset, idx) => {
                      const typeConfig = {
                        character: { text: 'text-blue-500', bg: 'bg-blue-50/30', border: 'border-blue-100', icon: <User className="w-8 h-8" /> },
                        scene: { text: 'text-green-500', bg: 'bg-green-50/30', border: 'border-green-100', icon: <MapPin className="w-8 h-8" /> },
                        prop: { text: 'text-purple-500', bg: 'bg-purple-50/30', border: 'border-purple-100', icon: <Package className="w-8 h-8" /> },
                        continuity: { text: 'text-gray-500', bg: 'bg-gray-50/30', border: 'border-gray-100', icon: <RefreshCw className="w-8 h-8" /> }
                      };
                      const config = typeConfig[asset.type] || typeConfig.prop;

                      return (
                        <div key={asset.id} className="p-10 bg-white rounded-[40px] border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col space-y-8">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-6">
                              <div className={`w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 ${config.text}`}>
                                {config.icon}
                              </div>
                              <div>
                                <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${config.text}`}>
                                  {asset.type === 'character' ? '角色' : asset.type === 'scene' ? '场景' : '道具'} (@{asset.id})
                                </p>
                                <p className="text-xl font-black text-gray-900">{asset.name}</p>
                              </div>
                            </div>

                            {/* 图片展示与上传区 - 仅场景保留上传功能 */}
                            {asset.type === 'scene' && (
                              <div className="flex items-center space-x-4">
                                <div 
                                  className={`w-28 h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all group relative cursor-pointer ${
                                    asset.generatedMedia?.mainImageUrl 
                                      ? 'border-blue-200' 
                                      : 'border-orange-200 bg-orange-50/10'
                                  }`}
                                >
                                  {asset.generatedMedia?.mainImageUrl ? (
                                    <>
                                      <img src={asset.generatedMedia.mainImageUrl} className="w-full h-full object-cover" alt={asset.name} referrerPolicy="no-referrer" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity space-x-2">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = (ev) => {
                                              const file = (ev.target as HTMLInputElement).files?.[0];
                                              if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (re) => {
                                                  const url = re.target?.result as string;
                                                  const updatedAssets = data.assets?.map(a => 
                                                    a.id === asset.id ? { ...a, generatedMedia: { ...a.generatedMedia, mainImageUrl: url } } : a
                                                  );
                                                  setData({ ...data, assets: updatedAssets });
                                                };
                                                reader.readAsDataURL(file);
                                              }
                                            };
                                            input.click();
                                          }}
                                          className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-all"
                                          title="重新上传"
                                        >
                                          <Upload className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const updatedAssets = data.assets?.map(a => 
                                              a.id === asset.id ? { ...a, generatedMedia: { ...a.generatedMedia, mainImageUrl: undefined } } : a
                                            );
                                            setData({ ...data, assets: updatedAssets });
                                          }}
                                          className="p-2 bg-white/20 hover:bg-red-500/60 rounded-full text-white backdrop-blur-sm transition-all"
                                          title="删除图片"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center w-full h-full space-y-2 p-4">
                                      <button 
                                        onClick={() => {
                                          const input = document.createElement('input');
                                          input.type = 'file';
                                          input.accept = 'image/*';
                                          input.onchange = (ev) => {
                                            const file = (ev.target as HTMLInputElement).files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onload = (re) => {
                                                const url = re.target?.result as string;
                                                const updatedAssets = data.assets?.map(a => 
                                                  a.id === asset.id ? { ...a, generatedMedia: { ...a.generatedMedia, mainImageUrl: url } } : a
                                                );
                                                setData({ ...data, assets: updatedAssets });
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          };
                                          input.click();
                                        }}
                                        className="w-10 h-10 bg-orange-100/50 rounded-xl flex items-center justify-center text-orange-500 hover:bg-orange-100 transition-colors"
                                      >
                                        <ImagePlus className="w-5 h-5" />
                                      </button>
                                      <span className="text-[9px] font-black uppercase tracking-tighter text-center leading-tight text-orange-500">
                                        上传场景参考图
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                            <div className={`p-8 rounded-[32px] ${config.bg} border ${config.border}`}>
                              <div className="flex items-center justify-between mb-4">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${config.text}`}>
                                  视觉特征提示词 (Asset Characteristics)
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-white/50 border border-current opacity-30 rounded-md text-[8px] font-bold">可编辑</span>
                                </div>
                              </div>
                              <textarea
                                value={asset.subAssets?.mainPrompt || ''}
                                onChange={(e) => {
                                  const updatedAssets = data.assets?.map(a => 
                                    a.id === asset.id ? { ...a, subAssets: { ...a.subAssets, mainPrompt: e.target.value } } : a
                                  );
                                  setData({ ...data, assets: updatedAssets });
                                }}
                                className="w-full bg-transparent text-base text-gray-700 leading-relaxed font-mono whitespace-pre-wrap outline-none border-none resize-none min-h-[120px] focus:ring-0 p-0"
                                placeholder="输入特征描述..."
                              />
                            </div>

                            {/* 变装图提示词 (仅角色) */}
                            {asset.type === 'character' && (asset.subAssets?.costumePrompt || (asset.variants && asset.variants.length > 0)) && (
                              <div className="space-y-4 mt-4">
                                {asset.subAssets?.costumePrompt && (
                                  <div className={`p-8 rounded-[32px] ${config.bg} border ${config.border}`}>
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center space-x-2">
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${config.text}`}>
                                          变装图提示词 (Costume / Outfit)
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black flex items-center gap-1 shadow-sm uppercase tracking-tighter">
                                            <Sparkles className="w-2 h-2" />
                                            已继承基础特征
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <textarea
                                      value={asset.subAssets?.costumePrompt || ''}
                                      onChange={(e) => {
                                        const updatedAssets = data.assets?.map(a => 
                                          a.id === asset.id ? { ...a, subAssets: { ...a.subAssets, costumePrompt: e.target.value } } : a
                                        );
                                        setData({ ...data, assets: updatedAssets });
                                      }}
                                      className="w-full bg-transparent text-base text-gray-700 leading-relaxed font-mono whitespace-pre-wrap outline-none border-none resize-none min-h-[100px] focus:ring-0 p-0"
                                      placeholder="在此输入变装详情提示词 (例如：穿着丝绸浴袍, 湿发, 展现清晨惺忪感)..."
                                    />
                                  </div>
                                )}
                                
                                {asset.variants && asset.variants.map((variant, vIdx) => (
                                  <div key={variant.id} className={`p-8 rounded-[32px] ${config.bg} border ${config.border}`}>
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center space-x-2">
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${config.text}`}>
                                          变装变体 #{vIdx + 1}: {variant.name}
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black flex items-center gap-1 shadow-sm uppercase tracking-tighter">
                                            <Sparkles className="w-2 h-2" />
                                            已继承基础特征
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <textarea
                                      value={variant.prompt || ''}
                                      onChange={(e) => {
                                        const updatedVariants = asset.variants!.map(v => 
                                          v.id === variant.id ? { ...v, prompt: e.target.value } : v
                                        );
                                        const updatedAssets = data.assets?.map(a => 
                                          a.id === asset.id ? { ...a, variants: updatedVariants } : a
                                        );
                                        setData({ ...data, assets: updatedAssets });
                                      }}
                                      className="w-full bg-transparent text-base text-gray-700 leading-relaxed font-mono whitespace-pre-wrap outline-none border-none resize-none min-h-[100px] focus:ring-0 p-0"
                                      placeholder="在此输入变装详情提示词..."
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 分段提示词 */}
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-gray-800 flex items-center space-x-3">
                      <span className="w-2 h-8 bg-blue-500 rounded-full" />
                      <span>分段提示词 (Prompts)</span>
                    </h3>
                    {(!data?.tasks || data.tasks.length === 0) && (
                      <div className="flex flex-col items-end space-y-2">
                        {spatialMode === 'strong' && data?.assets?.some(a => a.type === 'scene' && !a.generatedMedia?.mainImageUrl) ? (
                          <div className="flex flex-col items-end space-y-2 animate-pulse">
                            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              强空间结构模式：必须先补充所有场景参考图，才能生成分段提示词
                            </p>
                            <button 
                              disabled={true}
                              className="flex items-center space-x-2 px-6 py-3 bg-gray-200 text-gray-400 rounded-2xl text-xs font-black uppercase tracking-widest cursor-not-allowed"
                            >
                              <Lock className="w-4 h-4" />
                              <span>待补充场景图</span>
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleConfirmAssets()}
                            disabled={isGeneratingTask}
                            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                          >
                            {isGeneratingTask ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                            <span>{isGeneratingTask ? '正在生成...' : '立即生成分段提示词'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-12">
                    {(data.tasks || []).flatMap(t => t.segments || []).map((seg, idx) => (
                      <div key={seg.id} className="group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gray-900 text-white rounded-xl shadow-lg flex items-center justify-center text-sm font-black">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">分段 #{idx + 1}</p>

                            </div>
                          </div>
                          <button 
                            onClick={() => handleCopySegment(seg)}
                            className="bg-white border border-gray-100 px-6 py-2.5 rounded-xl text-xs font-black text-gray-400 hover:text-blue-500 hover:border-blue-100 transition-all uppercase tracking-widest shadow-sm"
                          >
                            复制完整提示词
                          </button>
                        </div>
                        <div className="p-8 bg-white border-2 border-gray-50 rounded-[40px] shadow-sm hover:shadow-md transition-shadow">
                          <div className="text-lg text-gray-700 leading-relaxed font-mono whitespace-pre-wrap break-words">
                            {seg.prompt}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="pt-20 text-center">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.5em]">End of Generation Report</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="absolute inset-0 flex flex-col overflow-y-auto no-scrollbar px-8 pb-[250px] space-y-8 pt-6">
            {/* 全局资产库 */}
            <GlobalAssetLibrary 
              data={data}
              setData={setData}
              history={history}
              generatingAssets={generatingAssets}
            assetErrors={assetErrors}
            draggedAssetId={draggedAssetId}
            handleAssetListDragStart={handleAssetListDragStart}
            handleAssetGen={handleAssetGen}
            handleAssetImageGen={handleAssetImageGen}
            handleSceneSecondaryGen={handleSceneSecondaryGen}
            handleAssetDragOver={handleAssetDragOver}
            handleAssetDragLeave={handleAssetDragLeave}
            handleAssetDrop={handleAssetDrop}
            triggerUpload={triggerUpload}
            setEditingPrompt={setEditingPrompt}
            setTempPromptValue={setTempPromptValue}
            updateAssetName={updateAssetName}
            updateAssetRefName={updateAssetRefName}
            updateAssetDetails={updateAssetDetails}
            handleVariantGen={handleVariantGen}
            handleDeleteVariant={handleDeleteVariant}
            handleAddManualVariant={handleAddManualVariant}
            handleAIVariantDesign={handleAIVariantDesign}
            handleCancelAssetGen={handleCancelAssetGen}
            editingAssetName={editingAssetName}
            setEditingAssetName={setEditingAssetName}
            editingAssetRefName={editingAssetRefName}
            setEditingAssetRefName={setEditingAssetRefName}
            handleSaveTask={handleSaveTask}
            config={config}
            handleAddAsset={handleAddAsset}
            handleRescanAssetsOnly={handleRescanAssetsOnly}
            handleDownloadAllGlobalAssets={handleDownloadAllGlobalAssets}
            setStep={setStep}
            handleGenerate={handleGenerate}
            handleGenerateAllAssets={handleGenerateAllAssets}
            isGeneratingAll={isGeneratingAll}
            generateAllProgress={generateAllProgress}
            setToast={setToast}
            setImageConfig={setImageConfig}
            onNavigate={onNavigate}
            onOpenImageDrawer={(id: string | number, type: 'main' | 'secondary' | 'layout' | 'variant', variantId?: string) => {
              setActiveAssetLibraryCall({ id, type, variantId });
            }}
          />

          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center">
                  <Film className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-800 tracking-tight">分段任务列表</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Segmented Task List</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {!activeSegId && (data?.tasks?.length || 0) === 0 && (
                  <button 
                    onClick={() => handleConfirmAssets()}
                    disabled={isGeneratingTask || (data?.assets?.length || 0) === 0}
                    className="flex items-center space-x-2 px-8 py-2.5 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all border border-purple-500 shadow-lg shadow-purple-600/20 disabled:opacity-50"
                  >
                    {isGeneratingTask ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    <span>{(data?.assets?.length || 0) === 0 ? '请先提交资产' : '智能拆解分段'}</span>
                  </button>
                )}

                {!activeSegId && (data?.tasks?.length || 0) > 0 && allSegments?.some(s => !s.generatedVideoUrl) && (
                  <button 
                    onClick={() => handleFullAutomation(data)}
                    disabled={isGeneratingTask}
                    className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all border border-blue-500 shadow-lg shadow-blue-600/20"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>补全未生成视频</span>
                  </button>
                )}

                {!activeSegId && (data?.tasks?.length || 0) > 0 && (
                  <button 
                    onClick={() => {
                      if (window.confirm("确定要永久删除当前全部分段任务吗？")) {
                        setData(prev => ({ ...prev, tasks: [] }));
                      }
                    }}
                    className="flex items-center space-x-2 px-6 py-2.5 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 group shadow-sm"
                  >
                    <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>永久删除全部分段</span>
                  </button>
                )}

                {!activeSegId && lastActiveSegId && (
                  <button 
                    onClick={() => setActiveSegId(lastActiveSegId)}
                    className="flex items-center space-x-2 px-6 py-2.5 bg-purple-50 text-purple-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-100 transition-all border border-purple-100 group shadow-sm"
                  >
                    <Maximize2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>返回内容精修</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-6 no-scrollbar overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {(!activeSegId && (data?.tasks?.length || 0) === 0) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white rounded-2xl border-2 border-dashed border-gray-100 p-12 text-center space-y-6"
                  >
                    <div className={`w-20 h-20 ${automationError ? 'bg-red-50' : 'bg-purple-50'} rounded-full flex items-center justify-center mx-auto`}>
                      {automationError ? (
                        <AlertCircle className="w-10 h-10 text-red-400" />
                      ) : (
                        <Zap className="w-10 h-10 text-purple-400" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <h4 className={`text-lg font-black ${automationError ? 'text-red-500' : 'text-gray-800'}`}>
                        {automationError ? '分段生成失败' : '请从时间轴选择片段或开始分段'}
                      </h4>
                      <p className="text-sm font-bold text-gray-400 max-w-xs mx-auto">
                        {automationError ? automationError : '请确保已确认资产。'}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleConfirmAssets()}
                      disabled={isGeneratingTask || (data?.assets?.length || 0) === 0}
                      className={`px-10 py-4 ${automationError ? 'bg-red-500 shadow-red-500/20' : 'bg-purple-600 shadow-purple-600/20'} text-white rounded-2xl font-black text-sm tracking-widest uppercase shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                    >
                      {isGeneratingTask ? (
                        <div className="flex items-center space-x-3">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>正在生成分段...</span>
                        </div>
                      ) : (
                        automationError ? "重新生成分段" : ((data?.assets?.length || 0) === 0 ? "请先添加资产" : "开始智能分段")
                      )}
                    </button>
                  </motion.div>
                )}
                {activeSegId && (data?.tasks?.length || 0) > 0 ? (
                  (() => {
                    const task = data?.tasks?.find(t => t.segments?.some(s => s.id === activeSegId));
                    const segIdx = task?.segments?.findIndex(s => s.id === activeSegId) ?? -1;
                    const seg = task?.segments?.[segIdx];
                    if (!task || !seg) return null;
                    return (
                      <motion.div 
                        key={seg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-[40px]"
                      >
                         {/* Header */}
                         <div className="px-10 py-6 flex items-center justify-between">
                            <div className="flex items-center space-x-5">
                               <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-lg shadow-blue-100">
                                 {segIdx + 1}
                               </div>
                               <div>
                                 <h3 className="text-xl font-black text-gray-900 tracking-tight">内容分段精修</h3>
                                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Focus Mode Workflow</p>
                               </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <button 
                                onClick={() => setActiveSegId(null)}
                               className="flex items-center space-x-2 px-6 py-2.5 bg-gray-50 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 hover:text-gray-900 transition-all border border-gray-100 group"
                              >
                                <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                                <span>返回任务列表</span>
                              </button>
                            </div>
                         </div>

                         {/* Side-by-side Layout (Video + Prompt) */}
                         <div className="px-10 pb-4 grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Left: Video Preview */}
                            <div className="lg:col-span-4 space-y-4">
                               <div className="aspect-[9/16] max-h-[400px] bg-slate-900 rounded-[32px] overflow-hidden relative group shadow-2xl border-4 border-white mx-auto">
                                  {seg.generatedVideoUrl ? (
                                    <video src={seg.generatedVideoUrl} className="w-full h-full object-cover" controls loop muted />
                                  ) : seg.imageUrl ? (
                                    <img src={seg.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-800">
                                      <Clapperboard className="w-12 h-12 opacity-20 mb-4" />
                                      <p className="text-[10px] font-black uppercase tracking-widest opacity-30">等待生成</p>
                                    </div>
                                  )}
                                  
                                  <div className={`absolute inset-0 bg-black/40 transition-all flex items-center justify-center backdrop-blur-sm ${seg.generatedVideoUrl ? 'hidden' : (generatingSegments[seg.id] ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}`}>
                                    <button 
                                      onClick={() => handleSegmentGenIndividual(task.id, seg.id, true)}
                                      disabled={!!generatingSegments[seg.id]}
                                      className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-2xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                      {generatingSegments[seg.id] ? <Loader2 className="w-10 h-10 animate-spin" /> : <Play className="w-10 h-10 fill-current translate-x-1" />}
                                    </button>
                                  </div>
                               </div>
                               
                               <div className="flex items-stretch gap-4">
                                  <div className="flex-1 bg-gray-50 rounded-2xl p-4 text-center">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">时长</p>
                                    <p className="text-sm font-black text-gray-900">{String(seg.duration || '').replace(/s$/i, '')}s</p>
                                  </div>
                                  <div className="flex-1 bg-gray-50 rounded-2xl p-4 text-center">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">画幅</p>
                                    <p className="text-sm font-black text-gray-900">9:16</p>
                                  </div>
                                  <button 
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="flex-1 bg-red-50/50 hover:bg-red-50 rounded-2xl p-4 flex flex-col items-center justify-center text-red-300 hover:text-red-500 transition-all border border-dashed border-red-100 hover:border-red-200 group"
                                    title="永久删除本分段任务"
                                  >
                                     <Trash2 className="w-5 h-5 mb-1 transition-transform group-hover:scale-110" />
                                     <span className="text-[9px] font-black uppercase tracking-widest">删除任务</span>
                                  </button>
                               </div>
                            </div>

                            {/* Right: Assets & Prompts */}
                            <div className="lg:col-span-8 space-y-6">
                               <div className="space-y-2">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">智能资产绑定</label>
                                  <div className="flex flex-wrap gap-3">
                                     {(() => {
                                        const boundAssets = [
                                          ...parseBindings(seg.assets.characters).map(b => ({ ...b, type: 'character' })),
                                          ...parseBindings(seg.assets.scenes).map(b => ({ ...b, type: 'scene' })),
                                          ...parseBindings(seg.assets.props).map(b => ({ ...b, type: 'prop' })),
                                          ...parseBindings(seg.assets.continuity || '').map(b => ({ ...b, type: 'continuity' }))
                                        ];
                                        
                                        return boundAssets.map((b, idx) => {
                                          const baseId = b.id.endsWith('_v') ? b.id.slice(0, -2) : (b.id.endsWith('_layout') ? b.id.slice(0, -7) : (b.id.includes('_v') && !b.id.startsWith('图') ? b.id.split('_v')[0] : b.id));
                                          const asset = data.assets.find(a => a.id === baseId || (a.type === 'character' && a.refName === baseId));
                                          const displayId = getAssetDisplayId(b.id, b.type as any);
                                          
                                          return (
                                            <div 
                                              key={`${b.id}_${idx}`}
                                              className={`flex items-center space-x-2 px-4 py-2 rounded-2xl border shadow-sm transition-all hover:scale-105 group/tag ${
                                                b.type === 'character' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                                b.type === 'scene' ? 'bg-green-50 border-green-100 text-green-700' :
                                                'bg-purple-50 border-purple-100 text-purple-700'
                                              }`}
                                            >
                                              <div className="w-6 h-6 rounded-lg overflow-hidden bg-white/50 flex-shrink-0">
                                                {asset?.generatedMedia?.mainImageUrl ? (
                                                  <img src={asset.generatedMedia.mainImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                ) : (
                                                  <div className="w-full h-full flex items-center justify-center opacity-40">
                                                    {b.type === 'character' ? <User className="w-3 h-3" /> : b.type === 'scene' ? <MapPin className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                                                  </div>
                                                )}
                                              </div>
                                              <div className="flex flex-col -space-y-0.5">
                                                <span className="text-[10px] font-black truncate max-w-[100px]">{b.name}</span>
                                                <span className="text-[8px] font-bold opacity-60 uppercase tracking-tighter">{displayId}</span>
                                              </div>
                                              <button 
                                                onClick={() => handleUpdateBinding(seg.id, b.type as any, b.id, '', true)}
                                                className="p-1 hover:bg-white/50 rounded-md transition-colors"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            </div>
                                          );
                                        });
                                     })()}
                                     
                                     <div className="relative">
                                       <button 
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setActiveBindingDropdown(prev => 
                                             prev?.segId === seg.id && prev?.taskId === task.id ? null : {taskId: task.id, segId: seg.id}
                                           );
                                         }}
                                         className={`w-10 h-10 rounded-2xl border border-dashed flex items-center justify-center transition-all ${
                                           activeBindingDropdown?.segId === seg.id && activeBindingDropdown?.taskId === task.id
                                             ? 'border-blue-500 text-blue-600 bg-blue-50'
                                             : 'border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50'
                                         }`}
                                       >
                                         <Plus className={`w-5 h-5 transition-transform ${activeBindingDropdown?.segId === seg.id && activeBindingDropdown?.taskId === task.id ? 'rotate-45' : ''}`} />
                                       </button>
                                       
                                       <AnimatePresence>
                                          {activeBindingDropdown?.segId === seg.id && activeBindingDropdown?.taskId === task.id && (
                                            <motion.div 
                                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                              animate={{ opacity: 1, y: 0, scale: 1 }}
                                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                              onClick={(e) => e.stopPropagation()}
                                              className="absolute top-full left-0 mt-3 w-72 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 z-[100] p-3 max-h-96 overflow-y-auto no-scrollbar"
                                            >
                                              <div className="px-3 py-2 border-b border-gray-50 mb-3">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">选择智能资产</p>
                                              </div>
                                              {data.assets.length === 0 ? (
                                                <div className="p-10 text-center">
                                                  <Package className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">暂无可用资产</p>
                                                </div>
                                              ) : (
                                                data.assets?.map(asset => {
                                                  const virtualVariants = [];
                                                  if (asset.type === 'character') {
                                                    virtualVariants.push({ id: `${asset.id}_v`, name: '角色设定图', icon: <Shirt className="w-3 h-3" /> });
                                                  } else if (asset.type === 'scene') {
                                                    virtualVariants.push({ id: `${asset.id}_v`, name: '720全景', icon: <MapPin className="w-3 h-3" /> });
                                                    virtualVariants.push({ id: `${asset.id}_layout`, name: '布局图', icon: <LayoutIcon className="w-3 h-3" /> });
                                                  } else if (asset.type === 'prop') {
                                                    virtualVariants.push({ id: `${asset.id}_v`, name: '道具设定图', icon: <Package className="w-3 h-3" /> });
                                                  }

                                                  return (
                                                    <React.Fragment key={asset.id}>
                                                      <button
                                                        onClick={() => {
                                                          handleUpdateBinding(seg.id, asset.type, 'new', asset.id);
                                                          setActiveBindingDropdown(null);
                                                        }}
                                                        className="w-full px-3 py-2.5 hover:bg-blue-50 rounded-2xl flex items-center space-x-3 transition-colors text-left mb-1 group/asset"
                                                      >
                                                        <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 border-2 border-transparent group-hover/asset:border-blue-200 transition-all">
                                                          {asset.generatedMedia?.mainImageUrl ? (
                                                            <img src={asset.generatedMedia.mainImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                          ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                              {asset.type === 'character' ? <User className="w-5 h-5" /> : asset.type === 'scene' ? <MapPin className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                                                            </div>
                                                          )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                          <p className="text-[12px] font-black text-gray-800 truncate">{asset.name}</p>
                                                          <p className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">{getAssetDisplayId(asset.id, asset.type)}</p>
                                                        </div>
                                                      </button>
                                                      
                                                      {virtualVariants.map(vv => (
                                                        <button
                                                          key={vv.id}
                                                          onClick={() => {
                                                            handleUpdateBinding(seg.id, asset.type, 'new', vv.id);
                                                            setActiveBindingDropdown(null);
                                                          }}
                                                          className="w-full px-3 py-2 pl-10 hover:bg-blue-50 rounded-2xl flex items-center space-x-3 transition-colors text-left mb-1"
                                                        >
                                                          <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                                                            {vv.icon}
                                                          </div>
                                                          <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] font-black text-gray-600 truncate">{vv.name}</p>
                                                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">{getAssetDisplayId(vv.id, asset.type)}</p>
                                                          </div>
                                                        </button>
                                                      ))}

                                                      {asset.variants?.map(v => (
                                                        <button
                                                          key={`${asset.id}_${v.id}`}
                                                          onClick={() => {
                                                            handleUpdateBinding(seg.id, asset.type, 'new', `${asset.id}_v${v.id}`);
                                                            setActiveBindingDropdown(null);
                                                          }}
                                                          className="w-full px-3 py-2 pl-10 hover:bg-blue-50 rounded-2xl flex items-center space-x-3 transition-colors text-left mb-1"
                                                        >
                                                          <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                                                            <Shirt className="w-3 h-3" />
                                                          </div>
                                                          <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] font-black text-gray-600 truncate">{v.name || '形象'}</p>
                                                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">{getAssetDisplayId(`${asset.id}_v${v.id}`, asset.type)}</p>
                                                          </div>
                                                        </button>
                                                      ))}
                                                    </React.Fragment>
                                                  );
                                                })
                                              )}
                                            </motion.div>
                                          )}
                                       </AnimatePresence>
                                     </div>
                                  </div>
                               </div>

                               <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">分段提示词剧本</label>
                                    <div className="flex items-center space-x-6">
                                      <button onClick={() => handleOptimizeSegmentPrompt(task.id, seg.id)} className="text-[10px] font-black text-blue-500 flex items-center hover:scale-105 transition-all">
                                         <Sparkles className="w-4 h-4 mr-1.5" /> AI 优化补全
                                      </button>
                                      <button onClick={() => handleCopySegment(seg)} className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600">复制</button>
                                    </div>
                                  </div>
                                  <textarea 
                                    value={seg.prompt}
                                    onChange={(e) => updateSegmentPrompt(seg.id, e.target.value)}
                                     className="w-full h-[320px] bg-gray-50 border border-gray-100 rounded-2xl p-6 text-sm text-gray-700 font-mono focus:bg-white focus:border-blue-200 outline-none transition-all shadow-inner resize-none leading-relaxed"
                                    placeholder="在此输入分段提示词内容..."
                                  />
                               </div>
                            </div>
                         </div>

                      </motion.div>
                    );
                  })()
                ) : data?.tasks?.map((task, taskIdx) => (
                  <motion.div 
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group"
                  >
                    {/* 任务头部 */}
                    <div className="p-8 border-b border-gray-50 flex items-start justify-between bg-gradient-to-r from-gray-50/50 to-transparent">
                      <div className="flex-1 mr-8">
                        <div className="flex items-center space-x-3 mb-4">
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-black uppercase tracking-widest">Task {taskIdx + 1}</span>
                          {task.status === 'generating' && (
                            <span className="flex items-center space-x-1.5 text-blue-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>智能拆解中...</span>
                            </span>
                          )}
                          {task.fileName && (
                            <span className="flex items-center space-x-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-bold">
                              <FileText className="w-3 h-3" />
                              <span className="truncate max-w-[120px]">{task.fileName}</span>
                            </span>
                          )}
                        </div>
                        {!task.isCollapsed && (
                          <div className="relative group/script">
                            <textarea 
                              value={task.script || ''}
                              onChange={(e) => updateTaskScript(task.id, e.target.value)}
                              className={`w-full bg-transparent text-gray-600 text-sm leading-relaxed outline-none resize-none transition-all ${task.isExpanded ? 'h-32' : 'h-10 overflow-hidden'}`}
                              placeholder="输入任务剧本..."
                            />
                            {!task.isExpanded && (task.script || '').length > 50 && (
                              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-50/50 to-transparent pointer-events-none" />
                            )}
                          </div>
                        )}
                        {task.isCollapsed && task.script && (
                          <p className="text-xs text-gray-400 truncate max-w-md italic">
                            {(task.script || '').substring(0, 100)}...
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {!task.isCollapsed && (
                          <>
                            <button 
                              onClick={() => {
                                setActiveTaskFileUpload(task.id);
                                taskScriptFileInputRef.current?.click();
                              }}
                              className="p-3 hover:bg-gray-100 text-gray-400 rounded-2xl transition-all"
                              title="上传剧本文件"
                            >
                              <Upload className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => toggleTaskScriptExpansion(task.id)}
                              className="p-3 hover:bg-gray-100 text-gray-400 rounded-2xl transition-all"
                              title={task.isExpanded ? "收起剧本" : "展开剧本"}
                            >
                              {task.isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            <button 
                              onClick={() => handleRegenerateSegmentsForTask(task.id)}
                              disabled={task.status === 'generating'}
                              className="p-3 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-2xl transition-all disabled:opacity-50"
                              title="重新拆解此任务"
                            >
                              <RefreshCw className={`w-5 h-5 ${task.status === 'generating' ? 'animate-spin' : ''}`} />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => toggleTaskCollapse(task.id)}
                          className="p-3 hover:bg-gray-100 text-gray-400 rounded-2xl transition-all"
                          title={task.isCollapsed ? "展开任务" : "折叠任务"}
                        >
                          {task.isCollapsed ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
                        </button>
                        <button 
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-3 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-2xl transition-all"
                          title="删除任务"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* 分段详情 */}
                    <AnimatePresence>
                      {!task.isCollapsed && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-8 space-y-8">
                            {task.segments?.map((seg, segIdx) => (
                        <div key={seg.id || `seg_${segIdx}`} className="relative pl-8 border-l-2 border-gray-100 last:border-0 pb-6 last:pb-0">
                          {/* 序号 */}
                          <div className="absolute -left-[13px] top-0 w-6 h-6 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center">
                            <span className="text-[10px] font-black text-gray-400">{segIdx + 1}</span>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* 预览区域 */}
                            <div className="lg:col-span-3 space-y-3">
                              <div className="aspect-[9/16] bg-gray-900 rounded-3xl overflow-hidden relative group/media shadow-xl shadow-black/10">
                                {seg.generatedVideoUrl ? (
                                  <video 
                                    src={seg.generatedVideoUrl || null} 
                                    className="w-full h-full object-cover"
                                    controls
                                    loop
                                    muted
                                    playsInline
                                  />
                                ) : seg.imageUrl ? (
                                  <img 
                                    src={seg.imageUrl || null} 
                                    className="w-full h-full object-cover cursor-pointer"
                                    onClick={() => setActiveSegId(seg.id)}
                                  />
                                ) : (
                                  <div 
                                    className="w-full h-full flex flex-col items-center justify-center text-gray-600 cursor-pointer"
                                    onClick={() => setActiveSegId(seg.id)}
                                  >
                                    <Clapperboard className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">等待生成</p>
                                  </div>
                                )}

                                {/* 生成按钮 */}
                                <div className={`absolute inset-0 bg-black/40 transition-all flex items-center justify-center backdrop-blur-sm ${!!generatingSegments[seg.id] ? 'opacity-100' : 'opacity-0 group-hover/media:opacity-100'}`}>
                                  {!!generatingSegments[seg.id] ? (
                                    <div className="flex flex-col items-center justify-center space-y-4">
                                      <Loader2 className="w-12 h-12 text-white animate-spin" />
                                      <span className="text-[10px] font-black text-white uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full backdrop-blur-md">
                                        {generatingSegments[seg.id]}
                                      </span>
                                    </div>
                                  ) : seg.generatedVideoUrl ? (
                                    <>
                                      <button 
                                        onClick={() => setActiveSegId(seg.id)}
                                        className="w-14 h-14 bg-white rounded-full flex flex-col items-center justify-center text-gray-900 hover:scale-110 transition-all shadow-xl group/btn"
                                      >
                                        <Maximize2 className="w-5 h-5 mb-0.5" />
                                        <span className="text-[8px] font-black uppercase tracking-tighter">进入精修</span>
                                      </button>
                                      <button 
                                        onClick={() => setPreviewMedia({ type: 'video', url: seg.generatedVideoUrl! })}
                                        className="w-14 h-14 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white hover:scale-110 transition-all backdrop-blur-md"
                                        title="播放视频"
                                      >
                                        <Play className="w-6 h-6 fill-current" />
                                      </button>
                                      <button 
                                        onClick={() => handleDownload(seg.generatedVideoUrl!, `seg_${segIdx + 1}.mp4`)}
                                        className="w-14 h-14 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white hover:scale-110 transition-all backdrop-blur-md"
                                        title="下载视频"
                                      >
                                        <Download className="w-6 h-6" />
                                      </button>
                                      <button 
                                        onClick={() => handleSegmentGenIndividual(task.id, seg.id, true)}
                                        disabled={!!generatingSegments[seg.id]}
                                        className="w-14 h-14 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white hover:scale-110 transition-all backdrop-blur-md disabled:opacity-50"
                                        title="重新生成"
                                      >
                                        {!!generatingSegments[seg.id] ? (
                                          <Loader2 className="w-6 h-6 animate-spin" />
                                        ) : (
                                          <RefreshCw className="w-6 h-6" />
                                        )}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={() => handleSegmentGenIndividual(task.id, seg.id, true)}
                                        disabled={!!generatingSegments[seg.id]}
                                        className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-gray-900 hover:scale-110 transition-all shadow-xl disabled:opacity-50"
                                        title="生成视频"
                                      >
                                        {!!generatingSegments[seg.id] ? (
                                          <Loader2 className="w-6 h-6 animate-spin" />
                                        ) : (
                                          <Play className="w-6 h-6 fill-current" />
                                        )}
                                      </button>
                                      {seg.imageUrl && (
                                        <button 
                                          onClick={() => handleDownload(seg.imageUrl!, `seg_${segIdx + 1}.png`)}
                                          className="w-14 h-14 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white hover:scale-110 transition-all backdrop-blur-md"
                                          title="下载图片"
                                        >
                                          <Download className="w-6 h-6" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* 状态标签 */}
                                {generatingSegments[seg.id] && (
                                  <div className="absolute top-6 left-6 px-3 py-1 bg-blue-500 text-white text-[10px] font-black rounded-lg uppercase tracking-widest animate-pulse">
                                    {generatingSegments[seg.id]}
                                  </div>
                                )}
                                {segmentErrors[seg.id] && (
                                  <div className="absolute bottom-6 left-6 right-6 p-3 bg-red-500/90 text-white text-[10px] font-bold rounded-xl backdrop-blur-md">
                                    {typeof (segmentErrors[seg.id] as any) === 'object' ? ((segmentErrors[seg.id] as any).message || JSON.stringify(segmentErrors[seg.id])) : segmentErrors[seg.id]}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 内容编辑区域 */}
                            <div className="lg:col-span-9 space-y-4">
                              {/* 资产绑定可视化标签 */}
                              <div className="flex flex-wrap gap-2 px-1">
                                {(() => {
                                  const boundAssets = [
                                    ...parseBindings(seg.assets.characters).map(b => ({ ...b, type: 'character' })),
                                    ...parseBindings(seg.assets.scenes).map(b => ({ ...b, type: 'scene' })),
                                    ...parseBindings(seg.assets.props).map(b => ({ ...b, type: 'prop' }))
                                  ];
                                  
                                  return boundAssets.map((b, idx) => {
                                    const baseId = b.id.endsWith('_v') ? b.id.slice(0, -2) : (b.id.endsWith('_layout') ? b.id.slice(0, -7) : (b.id.includes('_v') && !b.id.startsWith('图') ? b.id.split('_v')[0] : b.id));
                                    const asset = data.assets.find(a => a.id === baseId || (a.type === 'character' && a.refName === baseId));
                                    const displayId = getAssetDisplayId(b.id, b.type);
                                    
                                    return (
                                      <div 
                                        key={`${b.id}_${idx}`}
                                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border shadow-sm transition-all hover:scale-105 group/tag ${
                                          b.type === 'character' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                          b.type === 'scene' ? 'bg-green-50 border-green-100 text-green-700' :
                                          'bg-purple-50 border-purple-100 text-purple-700'
                                        }`}
                                      >
                                        <div className="w-5 h-5 rounded-lg overflow-hidden bg-white/50 flex-shrink-0">
                                          {asset?.generatedMedia?.mainImageUrl ? (
                                            <img src={asset.generatedMedia.mainImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center opacity-40">
                                              {b.type === 'character' ? <User className="w-3 h-3" /> : b.type === 'scene' ? <MapPin className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-col -space-y-0.5">
                                          <span className="text-[10px] font-black truncate max-w-[80px]">{b.name}</span>
                                          <span className="text-[8px] font-bold opacity-60 uppercase tracking-tighter">{displayId}</span>
                                        </div>
                                        <button 
                                          onClick={() => handleUpdateBinding(seg.id, b.type, b.id, '', true)}
                                          className="p-1 hover:bg-white/50 rounded-md opacity-0 group-hover/tag:opacity-100 transition-opacity"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    );
                                  });
                                })()}
                                
                                {/* 添加资产按钮 */}
                                <div className="relative">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveBindingDropdown(prev => 
                                        prev?.segId === seg.id && prev?.taskId === task.id ? null : {taskId: task.id, segId: seg.id}
                                      );
                                    }}
                                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-dashed transition-all text-[10px] font-black uppercase tracking-widest ${
                                      activeBindingDropdown?.segId === seg.id && activeBindingDropdown?.taskId === task.id
                                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                                        : 'border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50'
                                    }`}
                                  >
                                    <Plus className={`w-3 h-3 transition-transform ${activeBindingDropdown?.segId === seg.id && activeBindingDropdown?.taskId === task.id ? 'rotate-45' : ''}`} />
                                    <span>绑定资产</span>
                                  </button>
                                  
                                  <AnimatePresence>
                                    {activeBindingDropdown?.segId === seg.id && activeBindingDropdown?.taskId === task.id && (
                                      <motion.div 
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 p-2 max-h-80 overflow-y-auto no-scrollbar"
                                      >
                                        <div className="px-3 py-2 border-b border-gray-50 mb-2">
                                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">选择要绑定的资产</p>
                                        </div>
                                        {data?.assets?.map(asset => {
                                          const virtualVariants = [];
                                          if (asset.type === 'character') {
                                            virtualVariants.push({ id: `${asset.id}_v`, name: '角色设定图', icon: <Shirt className="w-3 h-3" /> });
                                          } else if (asset.type === 'scene') {
                                            virtualVariants.push({ id: `${asset.id}_v`, name: '720全景', icon: <MapPin className="w-3 h-3" /> });
                                            virtualVariants.push({ id: `${asset.id}_layout`, name: '布局图', icon: <LayoutIcon className="w-3 h-3" /> });
                                          } else if (asset.type === 'prop') {
                                            virtualVariants.push({ id: `${asset.id}_v`, name: '道具设定图', icon: <Package className="w-3 h-3" /> });
                                          }

                                          return (
                                            <React.Fragment key={asset.id}>
                                              <button
                                                onClick={() => {
                                                  handleUpdateBinding(seg.id, asset.type, 'new', asset.id);
                                                  setActiveBindingDropdown(null);
                                                }}
                                                className="w-full px-3 py-2 hover:bg-blue-50 rounded-xl flex items-center space-x-3 transition-colors text-left"
                                              >
                                                <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                                                  {asset.generatedMedia?.mainImageUrl ? (
                                                    <img src={asset.generatedMedia.mainImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                  ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                      {asset.type === 'character' ? <User className="w-4 h-4" /> : asset.type === 'scene' ? <MapPin className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                                    </div>
                                                  )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-[11px] font-black text-gray-800 truncate">{asset.name}</p>
                                                  <p className="text-[8px] font-bold text-blue-500 uppercase tracking-tighter">{getAssetDisplayId(asset.id, asset.type)}</p>
                                                </div>
                                              </button>
                                              
                                              {/* 虚拟变体 (六视图, 全景, 布局) */}
                                              {virtualVariants.map(vv => (
                                                <button
                                                  key={vv.id}
                                                  onClick={() => {
                                                    handleUpdateBinding(seg.id, asset.type, 'new', vv.id);
                                                    setActiveBindingDropdown(null);
                                                  }}
                                                  className="w-full px-3 py-2 pl-8 hover:bg-blue-50 rounded-xl flex items-center space-x-3 transition-colors text-left border-l-2 border-gray-50 ml-4"
                                                >
                                                  <div className="w-6 h-6 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                                                    {vv.icon}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-bold text-gray-600 truncate">{vv.name}</p>
                                                    <p className="text-[7px] font-bold text-blue-400 uppercase tracking-tighter">{getAssetDisplayId(vv.id, asset.type)}</p>
                                                  </div>
                                                </button>
                                              ))}

                                              {/* 变体列表 */}
                                              {asset.variants?.map(v => (
                                                <button
                                                  key={`${asset.id}_${v.id}`}
                                                  onClick={() => {
                                                    handleUpdateBinding(seg.id, asset.type, 'new', `${asset.id}_v${v.id}`);
                                                    setActiveBindingDropdown(null);
                                                  }}
                                                  className="w-full px-3 py-2 pl-8 hover:bg-blue-50 rounded-xl flex items-center space-x-3 transition-colors text-left border-l-2 border-gray-50 ml-4"
                                                >
                                                  <div className="w-6 h-6 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                                                    <Shirt className="w-3 h-3" />
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-bold text-gray-600 truncate">{v.name || '形象'}</p>
                                                    <p className="text-[7px] font-bold text-blue-400 uppercase tracking-tighter">{getAssetDisplayId(`${asset.id}_v${v.id}`, asset.type)}</p>
                                                  </div>
                                                </button>
                                              ))}
                                            </React.Fragment>
                                          );
                                        })}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>

                              {/* 综合提示词编辑 (包含资产绑定) */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Scene Prompt & Bindings</label>
                                  <div className="flex items-center space-x-3">
                                    <button 
                                      onClick={() => handleOptimizeSegmentPrompt(task.id, seg.id)}
                                      disabled={optimizingPrompts[`${task.id}_${seg.id}`]}
                                      className="flex items-center space-x-1 text-[10px] font-bold text-blue-500 hover:text-blue-600 uppercase tracking-widest disabled:opacity-50"
                                    >
                                      {optimizingPrompts[`${task.id}_${seg.id}`] ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Sparkles className="w-3 h-3" />
                                      )}
                                      <span>AI 优化</span>
                                    </button>
                                    <button 
                                      onClick={() => handleCopySegment(seg)}
                                      className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest"
                                    >
                                      复制
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div className="relative group/prompt">
                                    <textarea 
                                      value={getCombinedPrompt(seg)}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        const cursor = e.target.selectionStart;
                                        handleCombinedPromptChange(task.id, seg.id, value);
                                        
                                        // Check for @ mention
                                        const textBeforeCursor = value.slice(0, cursor);
                                        const lastAt = textBeforeCursor.lastIndexOf('@');
                                        if (lastAt !== -1 && !textBeforeCursor.slice(lastAt).includes(' ')) {
                                          const query = textBeforeCursor.slice(lastAt + 1);
                                          const coords = getCaretCoordinates(e.target as HTMLTextAreaElement, lastAt);
                                          
                                          setMentionMenu({
                                            isOpen: true,
                                            x: coords.left,
                                            y: coords.top + 24, // 24px for line height offset
                                            query,
                                            taskId: task.id,
                                            segId: seg.id,
                                            cursorPosition: cursor
                                          });
                                        } else {
                                          setMentionMenu(null);
                                        }
                                      }}
                                      onBlur={() => {
                                        // Delay closing to allow clicks on menu
                                        setTimeout(() => setMentionMenu(null), 200);
                                      }}
                                      className={`w-full bg-gray-50 border ${checkTimeOverflow(getCombinedPrompt(seg)) ? 'border-red-300 bg-red-50/30' : 'border-gray-100'} rounded-2xl p-4 text-sm text-gray-700 font-mono leading-relaxed outline-none focus:border-blue-200 focus:bg-white transition-all min-h-[350px] resize-none`}
                                      placeholder="角色名称=@角色1（身高168cm）\n场景名称=@场景1\n道具名称=@道具1\n\n镜头1（0-5s）：..."
                                    />
                                    
                                    {checkTimeOverflow(getCombinedPrompt(seg)) && (
                                      <div className="mt-2 flex items-center space-x-2 text-red-500">
                                        <AlertCircle className="w-4 h-4" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">警告：镜头时间轴已超过该段时长限制，请手动修正或点击 AI 优化</span>
                                      </div>
                                    )}
                                    
                                    {/* Mention Menu */}
                                    <AnimatePresence>
                                      {mentionMenu?.isOpen && mentionMenu.taskId === task.id && mentionMenu.segId === seg.id && (
                                        <motion.div
                                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                          animate={{ opacity: 1, scale: 1, y: 0 }}
                                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                          style={{ 
                                            top: mentionMenu.y, 
                                            left: Math.min(mentionMenu.x, 400) // Prevent going too far right
                                          }}
                                          className="absolute z-[200] w-80 max-h-[400px] bg-white/95 backdrop-blur-xl rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden flex flex-col"
                                        >
                                          <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">智能资产调用</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Mention System</span>
                                            </div>
                                          </div>
                                          <div className="overflow-y-auto py-2 no-scrollbar">
                                            {/* Pipeline Assets */}
                                            {data?.assets?.filter(a => a.name.includes(mentionMenu.query) || (a.refName || '').includes(mentionMenu.query)).map(asset => {
                                              const virtualVariants = [];
                                              if (asset.type === 'character') {
                                                virtualVariants.push({ id: `${asset.id}_v`, name: '角色设定图', icon: <Shirt className="w-3 h-3" /> });
                                              } else if (asset.type === 'scene') {
                                                virtualVariants.push({ id: `${asset.id}_v`, name: '720全景', icon: <MapPin className="w-3 h-3" /> });
                                                virtualVariants.push({ id: `${asset.id}_layout`, name: '布局图', icon: <LayoutIcon className="w-3 h-3" /> });
                                              } else if (asset.type === 'prop') {
                                                virtualVariants.push({ id: `${asset.id}_v`, name: '道具设定图', icon: <Package className="w-3 h-3" /> });
                                              }

                                              return (
                                                <React.Fragment key={asset.id}>
                                                  <button
                                                    onClick={() => {
                                                      const currentText = getCombinedPrompt(seg);
                                                      const lastAt = currentText.lastIndexOf('@', mentionMenu.cursorPosition - 1);
                                                      const before = currentText.slice(0, lastAt);
                                                      const after = currentText.slice(mentionMenu.cursorPosition);
                                                      
                                                      // Insert just the name at the cursor
                                                      const insertion = asset.name;
                                                      const newCombinedText = before + insertion + after;
                                                      
                                                      // Use the combined prompt change handler to correctly split and bind
                                                      handleCombinedPromptChange(task.id, seg.id, newCombinedText);
                                                      
                                                      setMentionMenu(null);
                                                    }}
                                                    className="w-full px-4 py-3 hover:bg-blue-50/80 flex items-center space-x-4 transition-all text-left group/m-item"
                                                  >
                                                    <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-100 shadow-sm group-hover/m-item:scale-105 transition-transform">
                                                      {asset.generatedMedia?.mainImageUrl ? (
                                                        <img src={asset.generatedMedia.mainImageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                      ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                          {asset.type === 'character' ? <User className="w-6 h-6" /> : asset.type === 'scene' ? <MapPin className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                                                        </div>
                                                      )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-sm font-black text-gray-900 truncate group-hover/m-item:text-blue-600 transition-colors">{asset.name}</p>
                                                      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">{asset.refName || `@${asset.name}`}</p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 group-hover/m-item:opacity-100 transition-all -translate-x-2 group-hover/m-item:translate-x-0" />
                                                  </button>

                                                  {/* 虚拟变体 (六视图, 全景, 布局) */}
                                                  {virtualVariants.map(vv => (
                                                    <button
                                                      key={vv.id}
                                                      onClick={() => {
                                                        const currentText = getCombinedPrompt(seg);
                                                        const lastAt = currentText.lastIndexOf('@', mentionMenu.cursorPosition - 1);
                                                        const before = currentText.slice(0, lastAt);
                                                        const after = currentText.slice(mentionMenu.cursorPosition);
                                                        
                                                        const displayId = getAssetDisplayId(vv.id, asset.type);
                                                        const insertion = `${asset.name}=@${displayId}`;
                                                        const newCombinedText = before + insertion + after;
                                                        
                                                        handleCombinedPromptChange(task.id, seg.id, newCombinedText);
                                                        setMentionMenu(null);
                                                      }}
                                                      className="w-full px-4 py-2 pl-12 hover:bg-blue-50/80 flex items-center space-x-3 transition-all text-left group/m-item border-l-2 border-gray-50 ml-4"
                                                    >
                                                      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                                                        {vv.icon}
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                        <p className="text-[12px] font-bold text-gray-600 truncate">{vv.name}</p>
                                                        <p className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">{getAssetDisplayId(vv.id, asset.type)}</p>
                                                      </div>
                                                    </button>
                                                  ))}

                                                  {/* 角色形象 */}
                                                  {asset.variants?.map(v => (
                                                    <button
                                                      key={`${asset.id}_${v.id}`}
                                                      onClick={() => {
                                                        const currentText = getCombinedPrompt(seg);
                                                        const lastAt = currentText.lastIndexOf('@', mentionMenu.cursorPosition - 1);
                                                        const before = currentText.slice(0, lastAt);
                                                        const after = currentText.slice(mentionMenu.cursorPosition);
                                                        
                                                        const displayId = getAssetDisplayId(`${asset.id}_v${v.id}`, asset.type);
                                                        const insertion = `${asset.name}=@${displayId}`;
                                                        const newCombinedText = before + insertion + after;
                                                        
                                                        handleCombinedPromptChange(task.id, seg.id, newCombinedText);
                                                        setMentionMenu(null);
                                                      }}
                                                      className="w-full px-4 py-2 pl-12 hover:bg-blue-50/80 flex items-center space-x-3 transition-all text-left group/m-item border-l-2 border-gray-50 ml-4"
                                                    >
                                                      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                                                        <Shirt className="w-4 h-4" />
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                        <p className="text-[12px] font-bold text-gray-600 truncate">{v.name || '形象'}</p>
                                                        <p className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">{getAssetDisplayId(`${asset.id}_v${v.id}`, asset.type)}</p>
                                                      </div>
                                                    </button>
                                                  ))}
                                                </React.Fragment>
                                              );
                                            })}

                                            {/* History Items */}
                                            {history.filter(h => h.imageUrl && (h.revisedPrompt || '').includes(mentionMenu.query)).map((item, idx) => (
                                              <button
                                                key={item.id}
                                                onClick={() => {
                                                  const currentText = getCombinedPrompt(seg);
                                                  const lastAt = currentText.lastIndexOf('@', mentionMenu.cursorPosition - 1);
                                                  const before = currentText.slice(0, lastAt);
                                                  const after = currentText.slice(mentionMenu.cursorPosition);
                                                  
                                                  const refName = `历史图${history.length - idx}`;
                                                  const insertion = `参考图=${refName}`;
                                                  const newCombinedText = before + insertion + after;

                                                  // Use the combined prompt change handler to correctly split and bind
                                                  handleCombinedPromptChange(task.id, seg.id, newCombinedText);
                                                  
                                                  setMentionMenu(null);
                                                }}
                                                className="w-full px-4 py-3 hover:bg-purple-50/80 flex items-center space-x-4 transition-all text-left group/m-item"
                                              >
                                                <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 border border-purple-100 shadow-sm group-hover/m-item:scale-105 transition-transform">
                                                  <img src={item.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-sm font-black text-purple-600 truncate group-hover/m-item:text-purple-700 transition-colors">@历史图{history.length - idx}</p>
                                                  <p className="text-[10px] font-bold text-gray-400 truncate mt-0.5">{item.revisedPrompt || '无描述'}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 group-hover/m-item:opacity-100 transition-all -translate-x-2 group-hover/m-item:translate-x-0" />
                                              </button>
                                            ))}

                                            {data?.assets?.length === 0 && history.length === 0 && (
                                              <div className="px-4 py-12 text-center">
                                                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                  <Search className="w-6 h-6 text-gray-200" />
                                                </div>
                                                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">未找到匹配资产</p>
                                              </div>
                                            )}
                                          </div>
                                          <div className="p-3 bg-gray-50/50 border-t border-gray-50 flex items-center justify-center">
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">输入关键词过滤资产</p>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>

                                    <div className="absolute top-4 right-4 opacity-0 group-hover/prompt:opacity-100 transition-all">
                                      <Edit3 className="w-4 h-4 text-gray-300" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}

                {/* Removed extra spacer to reduce distance to timeline */}

              </AnimatePresence>
            </div>
          </div>
        </div> {/* Close the absolute scrollable container */}
        
        {/* 全局时间轴 (Global Timeline) */}
        <div className="absolute bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-xl border-t border-gray-200 flex flex-col shadow-[0_-30px_60px_rgba(0,0,0,0.1)]">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          {/* Timeline Header */}
          <div className="h-16 px-8 flex items-center justify-between border-b border-gray-50">
            <div className="flex items-center space-x-6">
              <div className="flex flex-col">
                <span className="text-[14px] font-black text-gray-900">全局时间轴</span>
                <div className="flex items-center space-x-2 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[11px] font-mono font-bold text-gray-500">00:00:00 / {totalDurationStr}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button 
                onClick={() => {
                  if (currentPlayIdx !== null && currentPlayIdx > 0) {
                    setCurrentPlayIdx(currentPlayIdx - 1);
                    if (!isPlaying) setIsPlaying(true);
                  }
                }}
                disabled={currentPlayIdx === 0 || segmentsToPlay.length === 0}
                className="p-2 hover:bg-gray-50 rounded-xl transition-all text-gray-400 hover:text-gray-900 disabled:opacity-30"
              >
                <SkipBack className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-white hover:scale-105 transition-all shadow-lg shadow-gray-200"
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
              </button>
              <button 
                onClick={() => {
                  if (currentPlayIdx !== null && currentPlayIdx < segmentsToPlay.length - 1) {
                    setCurrentPlayIdx(currentPlayIdx + 1);
                    if (!isPlaying) setIsPlaying(true);
                  }
                }}
                disabled={currentPlayIdx === segmentsToPlay.length - 1 || segmentsToPlay.length === 0}
                className="p-2 hover:bg-gray-50 rounded-xl transition-all text-gray-400 hover:text-gray-900 disabled:opacity-30"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Segments List */}
          <div className="relative group">
            <div 
              ref={timelineRef}
              className="h-[190px] px-8 py-5 flex items-center space-x-6 overflow-x-auto overflow-y-hidden no-scrollbar bg-gray-50/30 snap-x snap-mandatory"
            >
              {allSegments.map((seg, idx) => (
                <div 
                  key={seg.id} 
                  className="flex flex-col space-y-2 shrink-0 snap-start"
                  onClick={() => setActiveSegId(seg.id)}
                >
                  <div className={`w-56 h-32 bg-gray-900 rounded-2xl relative overflow-hidden group/item cursor-pointer border-2 transition-all shadow-sm ${
                    activeSegId === seg.id ? 'border-blue-500 scale-105 shadow-xl shadow-blue-500/20 z-10' : 'border-transparent hover:border-blue-300'
                  }`}>
                    {seg.imageUrl || seg.generatedVideoUrl ? (
                      seg.imageUrl ? (
                        <img src={seg.imageUrl || null} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <video src={seg.generatedVideoUrl || null} className="w-full h-full object-cover" muted playsInline />
                      )
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 space-y-2">
                         <Film className="w-8 h-8 text-slate-600 animate-pulse" />
                         <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">待生成内容</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-8 h-8 text-white opacity-0 group-hover/item:opacity-100 transition-all scale-75 group-hover/item:scale-100" />
                    </div>
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold text-white">
                      {String(seg.duration || '').replace(/s$/i, '')}s
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">SEG {idx + 1}</span>
                    {!seg.generatedVideoUrl && (
                      <div className="flex items-center space-x-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[8px] font-bold text-amber-500 uppercase">无视频</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              <button 
                onClick={handleAddTask}
                className="w-56 h-32 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center space-y-2 text-gray-300 hover:border-blue-200 hover:text-blue-400 hover:bg-blue-50/50 transition-all shrink-0 group snap-start"
              >
                <Plus className="w-8 h-8 group-hover:scale-110 transition-transform mb-1" />
                <div className="text-center">
                  <p className="text-[12px] font-black tracking-tight">新增剧本任务</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-60">Add Task</p>
                </div>
              </button>
            </div>

            {/* Scroll Controls */}
            {allSegments.length > 4 && (
              <>
                <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-white via-white/40 to-transparent pointer-events-none z-[11]" />
                <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-white via-white/40 to-transparent pointer-events-none z-[11]" />
                
                <button 
                  onClick={() => scrollTimeline('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-32 bg-white/60 backdrop-blur-xl rounded-r-3xl border-y border-r border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-white transition-all z-[12] md:opacity-0 group-hover:opacity-100 shadow-xl"
                >
                  <ChevronLeft className="w-6 h-6 -ml-1" />
                </button>
                <button 
                  onClick={() => scrollTimeline('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-32 bg-white/60 backdrop-blur-xl rounded-l-3xl border-y border-l border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-white transition-all z-[12] md:opacity-0 group-hover:opacity-100 shadow-xl"
                >
                  <ChevronRight className="w-6 h-6 -mr-1" />
                </button>
              </>
            )}
          </div>
        </div>
      </>
    )}
  </div>
)}

      {/* 提示词编辑弹窗 */}
      <AnimatePresence>
        {editingPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setEditingPrompt(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-2xl bg-white rounded-[32px] overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-transparent">
                <div>
                  <h3 className="text-xl font-black text-gray-800 tracking-tight">编辑 AI 提示词</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Edit AI Generation Prompt</p>
                </div>
                <button 
                  onClick={() => setEditingPrompt(null)}
                  className="p-3 hover:bg-gray-100 text-gray-400 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Prompt Content</label>
                  <textarea 
                    value={tempPromptValue || ''}
                    onChange={(e) => setTempPromptValue(e.target.value)}
                    className="w-full h-64 bg-gray-50 border border-gray-100 rounded-2xl p-6 text-sm text-gray-700 leading-relaxed outline-none focus:border-blue-200 focus:bg-white transition-all resize-none"
                    placeholder="在此输入或修改提示词内容..."
                    autoFocus
                  />
                </div>
                
                <div className="flex items-center space-x-4">
                  {editingPrompt.type === 'segment' && (
                    <button 
                      onClick={async () => {
                        if (editingPrompt.taskId && editingPrompt.segmentId) {
                          await handleOptimizeSegmentPrompt(editingPrompt.taskId, editingPrompt.segmentId);
                          // After optimization, update the temp value if it was successful
                          const task = data?.tasks?.find(t => t.id === editingPrompt.taskId);
                          const seg = task?.segments?.find(s => s.id === editingPrompt.segmentId);
                          if (seg) setTempPromptValue(seg.prompt);
                        }
                      }}
                      disabled={optimizingPrompts[`${editingPrompt.taskId}_${editingPrompt.segmentId}`]}
                      className="flex-1 h-14 bg-blue-50 text-blue-600 rounded-2xl font-black text-xs tracking-widest uppercase hover:bg-blue-100 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {optimizingPrompts[`${editingPrompt.taskId}_${editingPrompt.segmentId}`] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span>AI 智能优化</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setEditingPrompt(null)}
                    className="flex-1 h-14 bg-gray-50 text-gray-500 rounded-2xl font-black text-xs tracking-widest uppercase hover:bg-gray-100 transition-all"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleConfirmPromptEdit}
                    className="flex-[2] h-14 bg-blue-500 text-white rounded-2xl font-black text-xs tracking-widest uppercase shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    确认修改
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 资产库选择弹窗 */}
      <AnimatePresence>
        {activeAssetLibraryCall && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setActiveAssetLibraryCall(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-4xl h-[80vh] bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-transparent">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Library className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-800 tracking-tight">从历史生成中调用资产</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Select from Image Library</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveAssetLibraryCall(null)}
                  className="p-3 hover:bg-gray-100 text-gray-400 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto no-scrollbar p-8 bg-gray-50/30">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {history.filter(item => item.imageUrl && item.status === 'success').length > 0 ? (
                    history.filter(item => item.imageUrl && item.status === 'success').map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => {
                          if (activeAssetLibraryCall) {
                            const { id, type, variantId } = activeAssetLibraryCall;
                            const url = item.imageUrl!;
                            
                            setData((prev: PipelineData) => ({
                              ...prev,
                              assets: prev.assets.map(a => a.id === id ? {
                                ...a,
                                generatedMedia: type !== 'variant' ? {
                                  ...a.generatedMedia,
                                  [type === 'main' ? 'mainImageUrl' : type === 'layout' ? 'layoutUrl' : 'secondaryMediaUrl']: url
                                } : a.generatedMedia,
                                variants: type === 'variant' ? a.variants?.map(v => v.id === variantId ? { ...v, imageUrl: url } : v) : a.variants
                              } : a)
                            }));
                            
                            setActiveAssetLibraryCall(null);
                            setToast({ message: '成功应用所选图片', type: 'success' });
                          }
                        }}
                        className="group relative aspect-square bg-white rounded-3xl overflow-hidden border-2 border-transparent hover:border-indigo-600 cursor-pointer transition-all shadow-sm hover:shadow-2xl"
                      >
                        <img 
                          src={item.imageUrl} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/40 transition-all flex flex-col items-center justify-center p-4 text-center">
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-indigo-600 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-xl mb-3">
                             <CheckCircle2 className="w-7 h-7" />
                          </div>
                          <p className="text-white text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">点击应用</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-20 text-center">
                      <div className="w-24 h-24 bg-white rounded-[40px] shadow-xl shadow-gray-200/50 flex items-center justify-center mx-auto mb-8 border border-gray-100">
                        <Library className="w-10 h-10 text-gray-200" />
                      </div>
                      <h4 className="text-lg font-black text-gray-400">暂无已生成的图片素材</h4>
                      <p className="text-[10px] text-gray-300 uppercase tracking-widest mt-2 font-bold">Please generate some images in space first</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-8 bg-white border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="flex -space-x-3 overflow-hidden">
                    {history.filter(h => h.imageUrl && h.status === 'success').slice(0, 5).map((h, i) => (
                      <div key={i} className="inline-block h-10 w-10 rounded-full ring-4 ring-white">
                        <img className="h-full w-full rounded-full object-cover" src={h.imageUrl} />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-2">
                    <Info className="w-3.5 h-3.5" />
                    <span>共找到 {history.filter(h => h.imageUrl && h.status === 'success').length} 个历史素材</span>
                  </p>
                </div>
                <button 
                  onClick={() => setActiveAssetLibraryCall(null)}
                  className="px-10 py-4 bg-gray-50 text-gray-500 rounded-2xl font-black text-xs tracking-widest uppercase hover:bg-gray-100 transition-all border border-gray-100"
                >
                  关闭窗口
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 全局预览弹窗 */}
      <AnimatePresence>
        {previewMedia && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl"
            onClick={() => setPreviewMedia(null)}
          >
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={10}
              centerOnInit={true}
              wheel={{ step: 0.1 }}
              panning={{ velocityDisabled: true }}
            >
              {(utils) => (
                <>
                  <div className="absolute top-8 right-8 flex items-center space-x-4 z-10">
                    <button 
                      onClick={handleDownloadPreview}
                      className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all backdrop-blur-md border border-white/10"
                      title="下载"
                    >
                      <Download className="w-6 h-6" />
                    </button>
                    {!previewMedia.isVideo && previewMedia.type !== 'video' && (
                      <button 
                        onClick={() => utils.resetTransform()}
                        className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all backdrop-blur-md border border-white/10"
                        title="重置缩放"
                      >
                        <Maximize2 className="w-6 h-6" />
                      </button>
                    )}
                    <button 
                      onClick={() => setPreviewMedia(null)}
                      className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all backdrop-blur-md border border-white/10"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div 
                    className="w-full h-full flex items-center justify-center overflow-hidden" 
                    onClick={e => e.stopPropagation()}
                  >
                    {previewMedia.type === 'video' || previewMedia.isVideo ? (
                      <div className="w-full max-w-5xl aspect-video relative">
                        <video src={previewMedia.url || null} className="w-full h-full object-contain rounded-3xl shadow-2xl" controls autoPlay />
                      </div>
                    ) : (
                      <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                        <img 
                          src={previewMedia.url || null} 
                          className="max-w-[90vw] max-h-[90vh] object-contain rounded-3xl shadow-2xl cursor-grab active:cursor-grabbing" 
                          draggable={false}
                          referrerPolicy="no-referrer"
                        />
                      </TransformComponent>
                    )}
                  </div>
                </>
              )}
            </TransformWrapper>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 任务剧本文件上传 */}
      <input 
        type="file" 
        ref={taskScriptFileInputRef} 
        className="hidden" 
        onChange={handleTaskScriptFileUpload}
        accept=".txt,.docx,.pdf,.xlsx,.xls"
      />

      {/* 删除任务确认弹窗 */}
      <AnimatePresence>
        {taskToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setTaskToDelete(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-white rounded-[32px] overflow-hidden shadow-2xl p-8 space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight">确认删除任务？</h3>
                <p className="text-sm font-bold text-gray-400">删除后将无法恢复该任务及其所有生成的内容。</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setTaskToDelete(null)}
                  className="flex-1 h-14 bg-gray-50 text-gray-500 rounded-2xl font-black text-xs tracking-widest uppercase hover:bg-gray-100 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={confirmDeleteTask}
                  className="flex-1 h-14 bg-red-500 text-white rounded-2xl font-black text-xs tracking-widest uppercase shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {assetToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setAssetToDelete(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-white rounded-[32px] overflow-hidden shadow-2xl p-8 space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight">确认删除资产？</h3>
                <p className="text-sm font-bold text-gray-400">删除后将无法恢复该资产及其所有生成的内容。</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setAssetToDelete(null)}
                  className="flex-1 h-14 bg-gray-50 text-gray-500 rounded-2xl font-black text-xs tracking-widest uppercase hover:bg-gray-100 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={confirmDeleteAsset}
                  className="flex-1 h-14 bg-red-500 text-white rounded-2xl font-black text-xs tracking-widest uppercase shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 全剧播放器 */}
      <AnimatePresence>
        {isPlaying && currentPlayIdx !== null && segmentsToPlay[currentPlayIdx] && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] bg-black flex flex-col items-center justify-center p-4 md:p-10"
          >
            <div className="absolute top-8 right-8 z-[260]">
              <button 
                onClick={() => setIsPlaying(false)}
                className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all shadow-2xl"
              >
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="w-full max-w-4xl aspect-[9/16] bg-black rounded-[40px] overflow-hidden relative shadow-2xl border border-white/10 group">
              <video 
                autoPlay
                src={segmentsToPlay[currentPlayIdx].generatedVideoUrl || null}
                className="w-full h-full object-cover"
                onEnded={() => {
                  if (currentPlayIdx < segmentsToPlay.length - 1) {
                    setCurrentPlayIdx(currentPlayIdx + 1);
                  } else {
                    setIsPlaying(false);
                    setToast({ message: '本剧播放完成', type: 'success' });
                  }
                }}
              />

              {/* 播放控制叠加层 */}
              <div className="absolute inset-x-0 inset-y-0 flex items-center justify-between px-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentPlayIdx > 0) setCurrentPlayIdx(currentPlayIdx - 1);
                  }}
                  disabled={currentPlayIdx === 0}
                  className="w-16 h-16 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all disabled:opacity-20"
                >
                  <ArrowLeft className="w-8 h-8" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentPlayIdx < segmentsToPlay.length - 1) setCurrentPlayIdx(currentPlayIdx + 1);
                  }}
                  disabled={currentPlayIdx === segmentsToPlay.length - 1}
                  className="w-16 h-16 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all disabled:opacity-20"
                >
                  <ArrowRight className="w-8 h-8" />
                </button>
              </div>
              
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center space-x-6 px-8 py-4 bg-black/40 backdrop-blur-xl rounded-full border border-white/10">
                 <span className="text-white font-black text-sm">{currentPlayIdx + 1} / {segmentsToPlay.length}</span>
                 <div className="h-4 w-px bg-white/20" />
                 <span className="text-white/60 text-xs font-bold uppercase tracking-widest">
                   正在播放第 {currentPlayIdx + 1} 段 (共 {segmentsToPlay.length} 段)
                 </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast 提示 */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200]"
          >
            <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 backdrop-blur-md ${
              toast.type === 'error' ? 'bg-red-500/90 text-white' : 
              toast.type === 'info' ? 'bg-blue-500/90 text-white' : 'bg-green-500/90 text-white'
            }`}>
              {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
               toast.type === 'info' ? <Info className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              <span className="text-sm font-bold">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
