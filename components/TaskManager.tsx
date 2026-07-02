import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, 
  FileText, 
  ImageIcon, 
  Film, 
  Trash2, 
  Download, 
  ExternalLink, 
  Clock, 
  Search,
  Filter,
  MoreVertical,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Package,
  Copy,
  ShoppingBag,
  Volume2,
  Edit2,
  Check,
  X,
  User,
  Layout,
  Box,
  ChevronDown,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HistoryItem, PipelineData } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { fetchWithProxy, getThumbnailUrl } from '../services/utils';
import { safeJson } from '../lib/fetch';

interface TaskManagerProps {
  onNavigate: (tab: string, data?: any) => void;
  activeTab: string;
  onDelete?: (id: string, type: string) => void;
  user?: any;
}

type TaskType = 'all' | 'text' | 'image' | 'video' | 'audio';

export const TaskManager: React.FC<TaskManagerProps> = ({ onNavigate, activeTab, onDelete, user }) => {
  const [filter, setFilter] = useState<TaskType>('all');
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pipelines, setPipelines] = useState<(PipelineData & { id: string; timestamp: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<{ id: string, type: string } | null>(null);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const [classificationFilter, setClassificationFilter] = useState<'all' | 'character' | 'scene' | 'prop' | 'storyboard'>('all');
  const [activeClassifyCardDropdownId, setActiveClassifyCardDropdownId] = useState<string | null>(null);
  const [showClassificationDropdown, setShowClassificationDropdown] = useState(false);

  const getHistoryItemClassification = (item: any): 'character' | 'scene' | 'prop' | 'storyboard' => {
    if (item.classification) return item.classification;
    if (item.config?.classification) return item.config.classification;

    // Check gridMode
    const gridMode = item.config?.gridMode;
    if (gridMode) {
      if (gridMode === "six-view" || gridMode === "multi-angle") {
        return "character";
      }
      if (gridMode === "scene-plan" || gridMode === "panorama" || gridMode === "perspective-sim") {
        return "scene";
      }
      if (gridMode === "storyboard" || gridMode === "grid-storyboard" || gridMode === "15s-grid") {
        return "storyboard";
      }
    }

    // Check prompts
    const prompt = (item.revisedPrompt || item.config?.prompt || "").toLowerCase();
    
    if (
      prompt.includes("storyboard") ||
      prompt.includes("comic") ||
      prompt.includes("panel") ||
      prompt.includes("film frame") ||
      prompt.includes("cinematic") ||
      prompt.includes("分镜") ||
      prompt.includes("九宫格") ||
      prompt.includes("画面-") ||
      prompt.includes("镜头") ||
      prompt.includes("秒")
    ) {
      return "storyboard";
    }

    if (
      prompt.includes("scene") ||
      prompt.includes("room") ||
      prompt.includes("house") ||
      prompt.includes("building") ||
      prompt.includes("forest") ||
      prompt.includes("city") ||
      prompt.includes("street") ||
      prompt.includes("background") ||
      prompt.includes("landscape") ||
      prompt.includes("interior") ||
      prompt.includes("environment") ||
      prompt.includes("场景") ||
      prompt.includes("房间") ||
      prompt.includes("屋子") ||
      prompt.includes("建筑") ||
      prompt.includes("森林") ||
      prompt.includes("街区") ||
      prompt.includes("全景") ||
      prompt.includes("俯视图") ||
      prompt.includes("环境") ||
      prompt.includes("景观")
    ) {
      return "scene";
    }

    if (
      prompt.includes("isolated") ||
      prompt.includes("white background") ||
      prompt.includes("isolated on white") ||
      prompt.includes("weapon") ||
      prompt.includes("sword") ||
      prompt.includes("shield") ||
      prompt.includes("prop") ||
      prompt.includes("item") ||
      prompt.includes("tool") ||
      prompt.includes("道具") ||
      prompt.includes("武器") ||
      prompt.includes("白底") ||
      prompt.includes("单体") ||
      prompt.includes("物品")
    ) {
      return "prop";
    }

    return "character";
  };

  const handleUpdateClassification = async (id: string, newCls: 'character' | 'scene' | 'prop' | 'storyboard') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const itemToUpdate = history.find(item => item.id === id);
    if (!itemToUpdate) return;

    const updatedItem = {
      ...itemToUpdate,
      classification: newCls,
      config: {
        ...(itemToUpdate.config || {}),
        classification: newCls
      }
    };

    // Optimistically update locally
    setHistory(prev => prev.map(item => item.id === id ? updatedItem : item));

    try {
      await fetch('/api/user/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedItem)
      });
    } catch (err) {
      console.error('更新分类失败:', err);
    }
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveClassifyCardDropdownId(null);
      setShowClassificationDropdown(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const handleRename = async (taskId: string, originalItem: any) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const updatedConfig = {
        ...(originalItem.config || {}),
        title: editingTitle.trim() || '未命名资产'
      };

      const updatedItem = {
        ...originalItem,
        config: updatedConfig
      };

      const response = await fetch('/api/user/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedItem)
      });

      if (response.ok) {
        const result = await safeJson(response);
        if (result && result.success) {
          setHistory(prev => prev.map(item => {
            if (item.id === taskId) {
              return {
                ...item,
                config: result.config || updatedConfig
              };
            }
            return item;
          }));
          setEditingTaskId(null);
        }
      }
    } catch (err) {
      console.error('修改名称失败:', err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      if (activeTab !== 'tasks') return;
      
      const token = localStorage.getItem('token');
      if (!token) return;

      setIsLoading(true);
      try {
        // Fetch history
        const historyResponse = await fetch('/api/user/history', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        let historyData = [];
        if (historyResponse.ok) {
          const data = await safeJson(historyResponse);
          if (data) historyData = data;
        }
        
        // Fetch pipelines
        const pipelinesResponse = await fetch('/api/user/pipelines', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        let savedPipelines = [];
        if (pipelinesResponse.ok) {
          const data = await safeJson(pipelinesResponse);
          if (data) savedPipelines = data;
        }
        
        const pipelinesData = Array.isArray(savedPipelines) ? savedPipelines.map((item: any) => ({
          ...item,
          timestamp: item.timestamp || Date.now()
        })) : [];

        if (Array.isArray(historyData)) {
          setHistory(historyData.sort((a: any, b: any) => b.timestamp - a.timestamp));
        }
        
        setPipelines(pipelinesData.sort((a: any, b: any) => b.timestamp - a.timestamp));
      } catch (err) {
        console.error('从云端加载任务失败:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, [activeTab]);

  const handleDeleteHistory = async (id: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const itemToDelete = history.find(item => item.id === id);
    const type = itemToDelete?.type === 'video' ? 'video' : itemToDelete?.type === 'gen_script' ? 'gen_script' : 'image';

    try {
      await fetch(`/api/user/history/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setHistory(prev => prev.filter(item => item.id !== id));
      onDelete?.(id, type);
    } catch (err) {
      console.error('删除历史失败:', err);
    }
  };

  const handleDeletePipeline = async (id: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await fetch(`/api/user/pipelines/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPipelines(prev => prev.filter(item => item.id !== id));
      onDelete?.(id, 'script');
    } catch (err) {
      console.error('删除流水线失败:', err);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetchWithProxy(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleDownloadTxt = (data: any) => {
    const content = data.revisedPrompt || '';
    if (!content) return;
    
    // Determine filename
    let filename = data.config?.title || '剧本';
    if (filename.startsWith('剧本分析报告: ')) {
      filename = filename.replace('剧本分析报告: ', '剧本分析_');
    }
    if (!filename.endsWith('.txt')) {
      filename += '.txt';
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredTasks = [
    ...history.map(item => {
      const defaultTitle = item.type === 'video' ? 'video' : item.type === 'audio' ? 'audio' : item.type === 'gen_script' ? 'gen_script' : 'image';
      const actualType = item.type === 'video' ? 'video' : item.type === 'audio' ? 'audio' : item.type === 'gen_script' ? 'gen_script' : 'image';
      const defaultLabel = actualType === 'video' ? '视频' : actualType === 'audio' ? '音频' : actualType === 'gen_script' ? '剧本' : '图片';
      const folderName = item.config?.title || (defaultLabel + '_' + item.id.substring(item.id.length - 4));
      const descriptionText = item.config?.prompt || item.revisedPrompt || item.config?.originalName || '本地上传图片';
      return {
        id: item.id,
        type: actualType,
        title: folderName,
        description: descriptionText,
        timestamp: item.timestamp,
        status: item.status,
        thumbnail: (item.type === 'video' || item.type === 'audio') ? item.videoUrl : item.imageUrl,
        category: item.config?.isDissection ? '拉片分析' : (item.config?.isAnalysis ? '分析报告' : (item.config?.isRewrite ? '剧本改写' : (item.type === 'gen_script' ? '剧本创作' : null))),
        classification: getHistoryItemClassification(item),
        data: item
      };
    }),
    ...pipelines.map(item => ({
      id: item.id,
      type: 'script' as const,
      title: item.name || ('制剧方案_' + item.id.substring(item.id.length - 4)),
      description: item.originalScript || '',
      timestamp: item.timestamp,
      status: 'success', // Pipelines are usually saved when they have some data
      thumbnail: item.assets?.[0]?.generatedMedia?.mainImageUrl,
      classification: undefined,
      data: item
    }))
  ].sort((a, b) => b.timestamp - a.timestamp)
   .filter(task => {
     if (filter !== 'all') {
       if (filter === 'text') {
         if (task.type !== 'gen_script' && task.type !== 'script') return false;
       } else {
         if (task.type !== filter) return false;
       }
     }
     if (filter === 'image' && classificationFilter !== 'all' && task.classification !== classificationFilter) return false;
     if (search) {
       const query = search.toLowerCase();
       return a_or_b_title_description(task, query);
     }
     return true;
   });

  function a_or_b_title_description(task: any, query: string) {
    return task.title.toLowerCase().includes(query) || 
           (task.description && task.description.toLowerCase().includes(query));
  }

  const stats = {
    all: history.length + pipelines.length,
    text: history.filter(h => h.type === 'gen_script').length + pipelines.length,
    image: history.filter(h => h.type === 'image' || !h.type).length,
    video: history.filter(h => h.type === 'video').length,
    audio: history.filter(h => h.type === 'audio').length
  };

  // Calculate approximate storage usage
  const totalUsageMB = (stats.text * 0.05) + (stats.image * 2.2) + (stats.video * 12.5) + (stats.audio * 1.8);
  const formattedUsage = totalUsageMB > 1024 
    ? `${(totalUsageMB / 1024).toFixed(2)} GB` 
    : `${totalUsageMB.toFixed(1)} MB`;
  const storageLimitMB = 1024; // 1 GB quota
  const percentUsed = Math.min((totalUsageMB / storageLimitMB) * 100, 100);

  return (
    <div className="h-full flex flex-col bg-[#fcfcfc]">
      {/* Header */}
      <div className="px-8 py-6 border-bottom border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">资产管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理您所有的创作内容与制剧资产</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Classification Type Filter Dropdown */}
            {filter === 'image' && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowClassificationDropdown(!showClassificationDropdown);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl text-sm font-medium text-gray-700 transition-all select-none cursor-pointer active:scale-95"
                >
                  <Filter className="w-4 h-4 text-gray-400" />
                  <span>
                    {(() => {
                      if (classificationFilter === 'all') return '所有类型';
                      if (classificationFilter === 'character') return '仅角色';
                      if (classificationFilter === 'scene') return '仅场景';
                      if (classificationFilter === 'prop') return '仅道具';
                      return '仅分镜';
                    })()}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                <AnimatePresence>
                  {showClassificationDropdown && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 4 }}
                      className="absolute right-0 mt-1.5 z-40 w-40 bg-white border border-gray-100 shadow-xl rounded-xl p-1 flex flex-col gap-0.5"
                    >
                      {[
                        { key: 'all', label: '所有类型', icon: LayoutGrid },
                        { key: 'character', label: '角色', icon: User, color: 'text-amber-500' },
                        { key: 'scene', label: '场景', icon: Layout, color: 'text-purple-500' },
                        { key: 'prop', label: '道具', icon: Box, color: 'text-green-500' },
                        { key: 'storyboard', label: '分镜', icon: Film, color: 'text-sky-500' },
                      ].map((option) => {
                        const Icon = option.icon;
                        const isCurrent = classificationFilter === option.key;
                        return (
                          <button
                            key={option.key}
                            onClick={() => {
                              setClassificationFilter(option.key as any);
                              setShowClassificationDropdown(false);
                            }}
                            className={`w-full px-3 py-1.5 rounded-lg flex items-center justify-between text-xs font-semibold text-left transition-all ${
                              isCurrent 
                                ? 'bg-indigo-50 text-indigo-600' 
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {option.key !== 'all' ? (
                                <Icon className={`w-3.5 h-3.5 ${option.color || 'text-gray-400'}`} />
                              ) : (
                                <Icon className="w-3.5 h-3.5 text-indigo-500" />
                              )}
                              <span>{option.label}</span>
                            </div>
                            {isCurrent && <Check className="w-3 h-3 text-indigo-600" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Storage Usage Widget */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50/60 border border-gray-100 rounded-xl select-none">
              <HardDrive className="w-3.5 h-3.5 text-gray-400 animate-pulse" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1 text-[11px] leading-tight text-gray-500">
                  <span>已用空间</span>
                  <span className="font-bold text-indigo-600 font-mono">{formattedUsage}</span>
                  <span className="text-[10px] text-gray-400">/ 1 GB</span>
                </div>
                <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden mt-0.5">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="搜索资产..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-64"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: '全部', icon: LayoutGrid, count: stats.all },
            { id: 'text', label: '文本', icon: FileText, count: stats.text },
            { id: 'image', label: '图片', icon: ImageIcon, count: stats.image },
            { id: 'video', label: '视频', icon: Film, count: stats.video },
            { id: 'audio', label: '音频', icon: Volume2, count: stats.audio },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as TaskType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === tab.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${
                filter === tab.id ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>加载任务中...</p>
          </div>
        ) : filteredTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredTasks.map((task) => (
                <motion.div
                  key={`${task.type}-${task.id}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all flex flex-col"
                >
                  {/* Preview */}
                  <div className="relative aspect-video bg-gray-50 overflow-hidden">
                    {task.thumbnail ? (
                      task.type === 'video' ? (
                        <div className="w-full h-full relative">
                          <video 
                            src={task.thumbnail} 
                            poster={getThumbnailUrl(task.thumbnail, 'video')}
                            className="w-full h-full object-cover"
                            muted
                            onMouseOver={(e) => e.currentTarget.play()}
                            onMouseOut={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                          />
                        </div>
                      ) : task.type === 'audio' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-50/40 text-indigo-500 p-4 relative">
                          <Volume2 className="w-10 h-10 mb-2 text-indigo-400" />
                          <audio src={task.thumbnail} controls className="w-full max-h-8 scale-90" />
                        </div>
                      ) : (
                        <div className="w-full h-full relative">
                          <img 
                            src={getThumbnailUrl(task.thumbnail)} 
                            className={`w-full h-full object-cover transition-opacity duration-500 ${imageLoaded[task.id] ? 'opacity-100' : 'opacity-0'}`} 
                            alt="" 
                            loading="lazy"
                            onLoad={() => setImageLoaded(prev => ({ ...prev, [task.id]: true }))}
                            referrerPolicy="no-referrer"
                          />
                          {!imageLoaded[task.id] && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                              <Loader2 className="w-6 h-6 animate-spin text-gray-200" />
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {task.type === 'script' ? (
                          <FileText className="w-12 h-12 text-gray-200" />
                        ) : task.type === 'image' ? (
                          <ImageIcon className="w-12 h-12 text-gray-200" />
                        ) : task.type === 'audio' ? (
                          <Volume2 className="w-12 h-12 text-gray-200" />
                        ) : (
                          <Film className="w-12 h-12 text-gray-200" />
                        )}
                      </div>
                    )}
                    
                    {/* Badge / Classification Selector */}
                    {task.type === 'image' ? (
                      <div className="absolute top-3 left-3 z-30" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveClassifyCardDropdownId(
                              activeClassifyCardDropdownId === task.id ? null : task.id
                            );
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-xl text-[10px] font-bold text-white uppercase transition-all select-none cursor-pointer border ${
                            activeClassifyCardDropdownId === task.id
                              ? 'border-indigo-500 text-indigo-200'
                              : 'border-white/10 hover:border-white/20'
                          }`}
                        >
                          {(() => {
                            const cls = task.classification;
                            if (cls === 'character') return <User className="w-3 h-3 text-amber-400" />;
                            if (cls === 'scene') return <Layout className="w-3 h-3 text-purple-400" />;
                            if (cls === 'prop') return <Box className="w-3 h-3 text-green-400" />;
                            return <Film className="w-3 h-3 text-sky-400" />;
                          })()}
                          <span>
                            {(() => {
                              const cls = task.classification;
                              if (cls === 'character') return '角色';
                              if (cls === 'scene') return '场景';
                              if (cls === 'prop') return '道具';
                              return '分镜';
                            })()}
                          </span>
                          <ChevronDown className="w-2.5 h-2.5 text-zinc-400" />
                        </button>

                        <AnimatePresence>
                          {activeClassifyCardDropdownId === task.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              className="absolute top-full mt-1 left-0 z-50 w-28 bg-zinc-950/95 border border-zinc-800/80 shadow-2xl backdrop-blur-md rounded-xl p-1 flex flex-col gap-0.5"
                            >
                              {[
                                { key: "character", label: "角色", icon: User, color: "text-amber-400" },
                                { key: "scene", label: "场景", icon: Layout, color: "text-purple-400" },
                                { key: "prop", label: "道具", icon: Box, color: "text-green-400" },
                                { key: "storyboard", label: "分镜", icon: Film, color: "text-sky-400" },
                              ].map((clsOption) => {
                                const IconComp = clsOption.icon;
                                const isCurrent = task.classification === clsOption.key;
                                return (
                                  <button
                                    key={clsOption.key}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateClassification(task.id, clsOption.key as any);
                                      setActiveClassifyCardDropdownId(null);
                                    }}
                                    className={`w-full h-7 px-2 rounded-lg flex items-center justify-between transition-all text-[11px] font-semibold text-left cursor-pointer ${
                                      isCurrent 
                                        ? 'bg-zinc-800 text-white animate-pulse' 
                                        : 'text-zinc-400 hover:text-white bg-transparent hover:bg-zinc-900'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-1.5">
                                      <IconComp className={`w-3 h-3 ${clsOption.color}`} />
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
                    ) : (
                      task.type === 'script' || task.type === 'gen_script' ? (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          {/* Primary Badge: 文本 */}
                          <div className="px-2 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                            <FileText className="w-3 h-3 text-indigo-400" />
                            <span>文本</span>
                          </div>
                          {/* Secondary Badge: Specific sub-type */}
                          <div className="px-2 py-1 bg-indigo-600/80 backdrop-blur-md border border-indigo-500/10 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                            {task.type === 'script' ? (
                              <>
                                <ShoppingBag className="w-3 h-3 text-indigo-200" />
                                <span>制剧</span>
                              </>
                            ) : (
                              <>
                                <Edit2 className="w-3 h-3 text-indigo-200" />
                                <span>
                                  {((task.data as any)?.config?.isDissection ? '拉片' : ((task.data as any)?.config?.isAnalysis ? '分析' : ((task.data as any)?.config?.isRewrite ? '改写' : '创作')))}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          {task.type === 'audio' ? <Volume2 className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                          {task.type === 'audio' ? '音频' : '视频'}
                        </div>
                      )
                    )}

                    {/* Status */}
                    <div className="absolute top-3 right-3">
                      {task.status === 'success' ? (
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : task.status === 'loading' || task.status === 'processing' ? (
                        <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg animate-spin">
                          <Loader2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>

                    {/* Info */}
                  <div className="p-5 flex-1 flex flex-col justify-between min-h-[160px]">
                    <div>
                      {editingTaskId === task.id ? (
                        <div className="flex flex-col gap-1 mb-3 border-b border-gray-50 pb-2">
                          <span className="text-[9px] font-black tracking-wider text-gray-400 uppercase">命名</span>
                          <div className="flex items-center gap-2 h-8">
                            <input 
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleRename(task.id, task.data);
                                } else if (e.key === 'Escape') {
                                  setEditingTaskId(null);
                                }
                              }}
                              autoFocus
                              className="flex-1 min-w-0 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 text-xs font-bold text-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <button
                              onClick={() => handleRename(task.id, task.data)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="保存"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingTaskId(null)}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                              title="取消"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative flex items-center justify-between group/title mb-3 border-b border-gray-50 pb-2">
                          <div className="flex-1 min-w-0 pr-6">
                            <span className="text-[9px] font-black tracking-wider text-gray-400 uppercase block mb-0.5">命名</span>
                            <h4 className="text-xs font-extrabold text-gray-950 truncate" title={task.title}>
                              {task.title || '未命名资产'}
                            </h4>
                          </div>
                          {task.type !== 'script' && ( // Allow editing for all assets
                            <button
                              onClick={() => {
                                setEditingTaskId(task.id);
                                setEditingTitle(task.title || '');
                              }}
                              className="absolute right-0 top-3 opacity-0 group-hover/title:opacity-100 p-1 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-all"
                              title="重命名"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col mb-4">
                        <span className="text-[9px] font-black tracking-wider text-gray-400 uppercase block mb-0.5">描述</span>
                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed h-10 overflow-hidden" title={task.description}>
                          {task.description || '暂无详细描述'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(task.timestamp, { addSuffix: true, locale: zhCN })}
                      </div>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-[9px] font-bold border border-orange-100">
                        <AlertCircle className="w-2.5 h-2.5" />
                        <span>{(() => {
                          const diff = (task.timestamp + 60 * 24 * 60 * 60 * 1000) - Date.now();
                          if (diff <= 0) return '已过期';
                          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                          const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                          return days > 0 ? `${days}天后删除` : `${hours}小时后删除`;
                        })()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => {
                        if (task.type === 'script') {
                          onNavigate('director', task.data);
                        } else if (task.type === 'gen_script') {
                          handleDownloadTxt(task.data);
                        } else {
                          onNavigate(task.type === 'video' ? 'video' : 'image', task.data);
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      {task.type === 'image' ? (
                        <>
                          做同款
                          <Copy className="w-3 h-3" />
                        </>
                      ) : task.type === 'gen_script' ? (
                        <>
                          下载TXT文件
                          <Download className="w-3 h-3" />
                        </>
                      ) : (
                        <>
                          查看详情
                          <ChevronRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      {task.status === 'success' && task.thumbnail && (
                        <button
                          onClick={() => handleDownload(task.thumbnail!, `${task.type}-${task.id}.${task.type === 'video' ? 'mp4' : 'png'}`)}
                          className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                          title="下载"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteConfirmTask({ id: task.id, type: task.type })}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-[32px] flex items-center justify-center mb-6">
              <Package className="w-10 h-10 text-gray-200" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">暂无任务</h3>
            <p className="text-gray-400 max-w-xs">
              您还没有进行过任何创作，快去开启您的第一场导演之旅吧！
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmTask(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">确认删除？</h3>
              <p className="text-gray-500 text-center mb-8 text-sm leading-relaxed">
                删除后该任务将无法恢复，您确定要继续吗？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmTask(null)}
                  className="flex-1 py-3 px-4 bg-gray-50 text-gray-600 font-bold rounded-2xl hover:bg-gray-100 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (deleteConfirmTask.type === 'script') {
                      handleDeletePipeline(deleteConfirmTask.id);
                    } else {
                      handleDeleteHistory(deleteConfirmTask.id);
                    }
                    setDeleteConfirmTask(null);
                  }}
                  className="flex-1 py-3 px-4 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 shadow-lg shadow-red-200 transition-all"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
