import React, { useState, useRef, useEffect } from 'react';
import { 
  Trash2, 
  AlertCircle, 
  RefreshCw, 
  Edit3, 
  Download, 
  Upload, 
  Palette, 
  Layers, 
  Video, 
  ImageIcon,
  Sparkles,
  Info,
  X,
  Plus,
  Mic2,
  Volume2,
  FileText,
  Wand2,
  Copy,
  Loader2,
  Maximize2,
  User,
  Shirt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Asset, PipelineData, AssetVariant, Config, HistoryItem } from '../types';
import { handleDownload, getMediaDuration } from '../services/utils';
import { pipelineService } from '../services/geminiService';
import { ImageSelectorModal } from './AssetLibrary/ImageSelectorModal';
import { Library } from 'lucide-react';

import { 
  getOSSClient, 
  uploadFromBase64 
} from '../services/oss';

interface AssetCardProps {
  asset: Asset;
  generatingAssets: Record<string, string>;
  assetErrors: Record<string, string>;
  draggedAssetId: { id: string | number; type: string; variantId?: string } | null;
  handleAssetListDragStart: (e: React.DragEvent, asset: Asset, subType?: 'main' | 'secondary' | 'variant', variantId?: string) => void;
  handleAssetGen: (assetId: string, isMain: boolean, overridePrompt?: string, force?: boolean, referenceUrl?: string, variantId?: string) => void;
  handleSceneSecondaryGen: (assetId: string, force?: boolean) => void;
  handleAssetDragOver: (e: React.DragEvent, id: string | number, type: 'main' | 'secondary' | 'variant', variantId?: string) => void;
  handleAssetDragLeave: () => void;
  handleAssetDrop: (e: React.DragEvent, id: string | number, type: 'main' | 'secondary' | 'variant', variantId?: string) => void;
  triggerUpload: (id: string | number, type: 'main' | 'secondary' | 'variant', variantId?: string) => void;
  setEditingPrompt: (val: { id: string; type: 'main' | 'secondary' | 'variant'; variantId?: string } | null) => void;
  updateAssetName: (id: string, name: string) => void;
  updateAssetRefName: (id: string, refName: string) => void;
  updateAssetDetails: (id: string, details: Partial<Asset['details']>) => void;
  handleVariantGen: (assetId: string, variantId: string) => void;
  handleDeleteVariant: (assetId: string, variantId: string) => void;
  handleAddManualVariant: (assetId: string) => void;
  handleAIVariantDesign: (assetId: string) => void;
  handleCancelAssetGen: (id: string, type: string, variantId?: string) => void;
  editingAssetName: string | null;
  setEditingAssetName: (id: string | null) => void;
  editingAssetRefName: string | null;
  setEditingAssetRefName: (id: string | null) => void;
  data: PipelineData | null;
  setData: React.Dispatch<React.SetStateAction<PipelineData | null>>;
  history: HistoryItem[];
  handleSaveTask: (targetData?: PipelineData) => Promise<void>;
  config: Config;
  setImageConfig?: React.Dispatch<React.SetStateAction<any>>;
  onNavigate?: (tab: string) => void;
  onOpenImageDrawer?: () => void;
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ 
  asset: a, 
  generatingAssets, 
  assetErrors,
  draggedAssetId,
  handleAssetListDragStart,
  handleAssetGen,
  handleSceneSecondaryGen,
  handleAssetDragOver,
  handleAssetDragLeave,
  handleAssetDrop,
  triggerUpload,
  setEditingPrompt,
  updateAssetName,
  updateAssetRefName,
  updateAssetDetails,
  editingAssetName,
  setEditingAssetName,
  editingAssetRefName,
  setEditingAssetRefName,
  data,
  setData,
  history,
  handleSaveTask,
  handleVariantGen,
  handleDeleteVariant,
  handleAddManualVariant,
  handleAIVariantDesign,
  handleCancelAssetGen,
  config,
  setImageConfig,
  onNavigate,
  onOpenImageDrawer,
  setToast
}) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>('main_appearance');
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, number>>({});
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isImageSelectorOpen, setIsImageSelectorOpen] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  // Initialize assets if needed
  useEffect(() => {
    if (a.type === 'character' && !a.details?.height) {
      const simulatedHeight = Math.floor(Math.random() * (190 - 160 + 1)) + 160;
      updateAssetDetails(a.id, { height: simulatedHeight.toString() });
    }
  }, [a.id, a.type, a.details?.height, updateAssetDetails]);

  const SECONDARY_VIEW_ID = 'secondary_view';
  const LAYOUT_VIEW_ID = 'layout_view';

  const virtualVariants = [];
  if (a.type === 'character') {
    virtualVariants.push({ id: SECONDARY_VIEW_ID, name: '角色设定图', imageUrl: a.generatedMedia?.secondaryMediaUrl, pendingImageUrl: a.generatedMedia?.pendingSecondaryMediaUrl, prompt: a.subAssets?.secondaryPrompt });
  } else if (a.type === 'scene') {
    virtualVariants.push({ id: SECONDARY_VIEW_ID, name: '720全景', imageUrl: a.generatedMedia?.secondaryMediaUrl, pendingImageUrl: a.generatedMedia?.pendingSecondaryMediaUrl, prompt: a.subAssets?.secondaryPrompt });
    virtualVariants.push({ id: LAYOUT_VIEW_ID, name: '布局图', imageUrl: a.generatedMedia?.layoutUrl, pendingImageUrl: a.generatedMedia?.pendingMainImageUrl, prompt: a.subAssets?.layoutPrompt });
  } else if (a.type === 'prop') {
    virtualVariants.push({ id: SECONDARY_VIEW_ID, name: '道具设定图', imageUrl: a.generatedMedia?.secondaryMediaUrl, pendingImageUrl: a.generatedMedia?.pendingSecondaryMediaUrl, prompt: a.subAssets?.secondaryPrompt });
  }

  const allAppearances = a.variants || [];
  const selectedVariant = virtualVariants.find(v => v.id === selectedVariantId) || allAppearances.find(v => v.id === selectedVariantId);
  
  const currentKey = selectedVariantId === SECONDARY_VIEW_ID 
    ? `${a.id}-secondary` 
    : selectedVariantId === LAYOUT_VIEW_ID
      ? `${a.id}-layout`
      : selectedVariantId 
        ? `${a.id}-variant-${selectedVariantId}`
        : `${a.id}-main`;
  
  const currentPrompt = selectedVariantId 
    ? selectedVariant?.prompt || ''
    : a.subAssets?.mainPrompt || '';
  
  const genStatus = generatingAssets[currentKey];
  const genError = assetErrors[currentKey];
  const hasMainImage = !!a.generatedMedia?.mainImageUrl;
  const isRefining = !!generatingAssets[`${a.id}-refine`];

  const pendingImageUrl = selectedVariantId 
    ? selectedVariant?.pendingImageUrl 
    : a.generatedMedia?.pendingMainImageUrl;

  const currentImageUrl = selectedVariantId 
    ? selectedVariant?.imageUrl 
    : a.generatedMedia?.mainImageUrl;

  const themeColor = a.type === 'character' ? 'blue' : 
                    a.type === 'scene' ? 'green' : 
                    a.type === 'continuity' ? 'orange' : 'purple';

  const themeStyles = {
    blue: {
      bg: 'bg-gradient-to-r from-blue-600 to-indigo-600',
      shadow: 'shadow-blue-200',
      text: 'text-blue-600',
      hoverBg: 'hover:bg-blue-50',
      ring: 'focus:ring-blue-500/10',
      iconBg: 'bg-blue-500',
      iconShadow: 'shadow-blue-200',
      border: 'border-blue-100'
    },
    green: {
      bg: 'bg-gradient-to-r from-green-600 to-emerald-600',
      shadow: 'shadow-green-200',
      text: 'text-green-600',
      hoverBg: 'hover:bg-green-50',
      ring: 'focus:ring-green-500/10',
      iconBg: 'bg-green-500',
      iconShadow: 'shadow-green-200',
      border: 'border-green-100'
    },
    purple: {
      bg: 'bg-gradient-to-r from-purple-600 to-violet-600',
      shadow: 'shadow-purple-200',
      text: 'text-purple-600',
      hoverBg: 'hover:bg-purple-50',
      ring: 'focus:ring-purple-500/10',
      iconBg: 'bg-purple-500',
      iconShadow: 'shadow-purple-200',
      border: 'border-purple-100'
    },
    orange: {
      bg: 'bg-gradient-to-r from-orange-600 to-amber-600',
      shadow: 'shadow-orange-200',
      text: 'text-orange-600',
      hoverBg: 'hover:bg-orange-50',
      ring: 'focus:ring-orange-500/10',
      iconBg: 'bg-orange-500',
      iconShadow: 'shadow-orange-200',
      border: 'border-orange-100'
    }
  }[themeColor as 'blue' | 'green' | 'purple' | 'orange'];

  useEffect(() => {
    const activeKeys = Object.keys(generatingAssets).filter(key => key.startsWith(`${a.id}-`));
    if (activeKeys.length === 0) {
      setElapsedTimes({});
      return;
    }

    const timer = setInterval(() => {
      setElapsedTimes(prev => {
        const next = { ...prev };
        activeKeys.forEach(key => {
          next[key] = (next[key] || 0) + 1;
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [generatingAssets, a.id]);

  const handleVoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Duration check for audio
      try {
        const duration = await getMediaDuration(file);
        const roundedDuration = parseFloat(duration.toFixed(1));
        if (roundedDuration < 3 || roundedDuration > 15) {
          alert(`音频时长必须在 3-15 秒之间 (当前: ${roundedDuration.toFixed(1)}s)`);
          e.target.value = '';
          return;
        }
      } catch (err) {
        alert('无法读取音频时长');
        e.target.value = '';
        return;
      }

      setIsUploadingVoice(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          const filename = `luosheji/assets/${a.id}/voice_${Date.now()}_${file.name}`;
          const url = await uploadFromBase64(base64, filename);
          
          updateAssetDetails(a.id, { 
            voiceUrl: url,
            voiceName: file.name
          });
        } catch (error) {
          console.error('上传配音失败:', error);
          alert('上传配音失败，请检查 OSS 配置');
        } finally {
          setIsUploadingVoice(false);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  useEffect(() => {
    if (a.type === 'character' && !a.details?.height) {
      const simulatedHeight = Math.floor(Math.random() * (190 - 160 + 1)) + 160;
      updateAssetDetails(a.id, { height: simulatedHeight.toString() });
    }
  }, [a.id, a.type, a.details?.height, updateAssetDetails]);

  return (
    <div 
      id={`asset-card-${a.id}`}
      draggable 
      onDragStart={(e) => handleAssetListDragStart(e, a, 'main')}
      className="w-full bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-all cursor-grab active:cursor-grabbing group/asset-card"
    >
      {/* Top Section: Metadata */}
      <div className="p-8 bg-white border-b border-gray-50">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-72 space-y-2">
            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">资产名称</label>
            <div className="relative group/name">
              <input 
                value={a.name || ''} 
                onChange={e => updateAssetName(a.id, e.target.value)}
                className={`w-full px-5 py-3 bg-white border border-gray-100 rounded-2xl text-[14px] font-black text-gray-800 focus:ring-4 ${themeStyles.ring} outline-none transition-all shadow-sm`}
                placeholder="输入资产名称..."
              />
              <Edit3 className="w-4 h-4 text-gray-300 absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/name:opacity-100 transition-opacity" />
            </div>
          </div>

          {a.type === 'character' && (
            <>
              <div className="w-32 space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">身高 (cm)</label>
                <input 
                  value={a.details?.height || ''} 
                  placeholder="170"
                  onChange={e => updateAssetDetails(a.id, { height: e.target.value })}
                  className={`w-full px-5 py-3 bg-white border border-gray-100 rounded-2xl text-[14px] font-bold text-gray-700 focus:ring-4 ${themeStyles.ring} outline-none transition-all shadow-sm`}
                />
              </div>

              <div className="w-48 space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">角色配音</label>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => voiceInputRef.current?.click()}
                    disabled={isUploadingVoice}
                    className={`flex-1 px-4 py-3 rounded-2xl text-[12px] font-bold transition-all flex items-center justify-center space-x-2 ${isUploadingVoice ? 'bg-gray-100 text-gray-400' : `bg-white border border-gray-100 text-gray-600 ${themeStyles.hoverBg} shadow-sm`}`}
                  >
                    {isUploadingVoice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mic2 className="w-4 h-4" />}
                    <span className="truncate">{isUploadingVoice ? '上传中...' : (a.details?.voiceName || '上传配音')}</span>
                  </button>
                  {a.details?.voiceUrl && (
                    <button 
                      onClick={() => {
                        const audio = new Audio(a.details?.voiceUrl);
                        audio.play();
                      }}
                      className={`p-3 ${themeStyles.hoverBg} ${themeStyles.text} rounded-2xl hover:bg-opacity-80 transition-all shadow-sm`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input type="file" ref={voiceInputRef} className="hidden" accept="audio/*" onChange={handleVoiceUpload} />
              </div>
            </>
          )}

          <div className="ml-auto flex items-center space-x-2">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (typeof (window as any).setAssetToDelete === 'function') (window as any).setAssetToDelete(a.id); 
                else if(confirm(`确定删除资产 ${a.name}？`)) setData(prev => prev ? { ...prev, assets: prev.assets.filter(x => x.id !== a.id) } : null); 
              }} 
              className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90 border border-transparent hover:border-red-100"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Prompts */}
      <div className="p-8 bg-white border-t border-gray-50 flex flex-col space-y-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Reference Image Section */}
          <div className="w-full lg:w-64 flex flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 ${themeStyles.iconBg} rounded-xl flex items-center justify-center text-white shadow-lg ${themeStyles.iconShadow}`}>
                <ImageIcon className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] font-black text-gray-800 uppercase tracking-widest">参考图</h3>
            </div>
            
            <div className="flex space-x-4">
              {/* Thumbnail Sidebar */}
                <div className="flex flex-col space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                  <button 
                    onClick={() => setSelectedVariantId(null)}
                    className={`w-12 h-12 rounded-xl border-2 transition-all overflow-hidden flex-shrink-0 ${!selectedVariantId ? 'border-blue-500 shadow-md scale-105 z-10' : 'border-gray-100 hover:border-gray-300 opacity-60 hover:opacity-100'}`}
                    title="核心主图"
                  >
                    {a.generatedMedia?.mainImageUrl ? (
                      <img src={a.generatedMedia?.mainImageUrl} className="w-full h-full object-cover object-top" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                  </button>
                  {virtualVariants.map(v => (
                    <button 
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`w-12 h-12 rounded-xl border-2 transition-all overflow-hidden flex-shrink-0 ${selectedVariantId === v.id ? 'border-blue-500 shadow-md scale-105 z-10' : 'border-gray-100 hover:border-gray-300 opacity-60 hover:opacity-100'}`}
                      title={v.name}
                    >
                      {v.imageUrl ? (
                        <img src={v.imageUrl} className="w-full h-full object-cover object-top" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-white border border-gray-50 flex items-center justify-center">
                          <Layers className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                    </button>
                  ))}
                  {a.variants?.map((v, idx) => (
                    <button 
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`w-12 h-12 rounded-xl border-2 transition-all overflow-hidden flex-shrink-0 ${selectedVariantId === v.id ? 'border-blue-500 shadow-md scale-105 z-10' : 'border-gray-100 hover:border-gray-300 opacity-60 hover:opacity-100'}`}
                      title={`${v.name || '形象'}`}
                    >
                      {v.imageUrl ? (
                        <img src={v.imageUrl} className="w-full h-full object-cover object-top" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-blue-50/50 border border-blue-100/50 flex items-center justify-center relative">
                          <Palette className="w-4 h-4 text-blue-300" />
                          <span className="absolute bottom-0 right-0 bg-blue-500 text-white text-[7px] px-1 rounded-tl-md font-black">{idx + 1}</span>
                        </div>
                      )}
                    </button>
                  ))}
                  <button 
                    onClick={() => {
                      handleAddManualVariant(a.id);
                    }}
                    className="w-12 h-12 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-blue-500"
                    title={a.type === 'character' ? "添加新形象/变装" : "添加变体"}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
              </div>

              {/* Main Preview */}
                <div className="flex-1 relative group/preview-container">
                  <div 
                    onClick={() => triggerUpload(a.id, selectedVariantId ? 'variant' : 'main', selectedVariantId || undefined)}
                    className={`relative aspect-square rounded-[2rem] border-2 border-dashed ${themeStyles.border} bg-white overflow-hidden group/preview cursor-pointer hover:border-solid transition-all shadow-sm`}
                  >
                    {currentImageUrl ? (
                      <>
                        <img 
                          src={currentImageUrl} 
                          alt={a.name} 
                          className="w-full h-full object-cover object-top"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex flex-col items-center justify-center text-white space-y-2">
                          <Upload className="w-6 h-6" />
                          <span className="text-[10px] font-bold">更换图片</span>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 space-y-3">
                        <div className={`w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center group-hover/preview:scale-110 transition-transform`}>
                          <Upload className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-bold">上传参考图</span>
                      </div>
                    )}
                    
                    {/* Loading Overlay */}
                    {genStatus && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse">生成中...</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Floating Maximize Button */}
                  {currentImageUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomImageUrl(currentImageUrl);
                      }}
                      className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur-md rounded-full text-gray-700 hover:text-blue-600 transition-all hover:scale-110 shadow-xl opacity-0 group-hover/preview-container:opacity-100 z-10 border border-gray-100"
                      title="点击放大查看"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
            </div>

            <button 
              onClick={() => triggerUpload(a.id, selectedVariantId ? 'variant' : 'main', selectedVariantId || undefined)}
              className={`w-full py-3 rounded-2xl border border-gray-100 bg-white text-gray-600 text-[12px] font-bold hover:bg-gray-50 transition-all flex items-center justify-center space-x-2 shadow-sm`}
            >
              <Upload className="w-4 h-4" />
              <span>上传资产图</span>
            </button>

            <button 
              onClick={() => setIsImageSelectorOpen(true)}
              className={`w-full py-3 rounded-2xl border border-gray-100 bg-white text-blue-600 text-[12px] font-bold hover:bg-blue-50 transition-all flex items-center justify-center space-x-2 shadow-sm`}
            >
              <Library className="w-4 h-4" />
              <span>从资产库调用图片</span>
            </button>
          </div>

          <div className="flex-1 flex flex-col space-y-8">
            {/* 1. Core Visual Characteristics Segment */}
            <div className="space-y-4 bg-gray-50/30 p-6 rounded-[2.5rem] border border-gray-100/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 ${themeStyles.iconBg} rounded-2xl flex items-center justify-center text-white shadow-lg ${themeStyles.iconShadow}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-[14px] font-black text-gray-800 uppercase tracking-widest">
                      核心视觉特征 (CORE CHARACTERISTICS)
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">定义角色的核心长相、五官、发型等不变特征</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(a.subAssets?.mainPrompt || '');
                      alert('指令已复制');
                    }}
                    className={`p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:${themeStyles.text} transition-all shadow-sm`}
                    title="复制核心指令"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleAssetGen(a.id, true, undefined, true)}
                    disabled={!!generatingAssets[`${a.id}-main`]}
                    className={`p-2.5 bg-white border border-gray-100 rounded-xl text-gray-400 hover:${themeStyles.text} transition-all shadow-sm disabled:opacity-50`}
                    title="重新分析核心特征"
                  >
                    <RefreshCw className={`w-4 h-4 ${generatingAssets[`${a.id}-main`] ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              <textarea 
                value={a.subAssets?.mainPrompt || ''}
                onChange={(e) => {
                  const newVal = e.target.value;
                  setData(prev => prev ? {
                    ...prev,
                    assets: prev.assets.map(asset => asset.id === a.id ? { ...asset, subAssets: { ...asset.subAssets, mainPrompt: newVal } } : asset)
                  } : null);
                }}
                className={`w-full h-48 p-6 bg-white border border-gray-100 rounded-[2rem] text-[13px] text-gray-700 leading-relaxed focus:ring-4 ${themeStyles.ring} outline-none resize-none transition-all shadow-inner font-medium`}
                placeholder="在此描述角色的核心长相特征（不含服装）..."
              />
            </div>

            {/* 1.1 Costume Prompt Segment (Only for characters with specific dressing needs) */}
            {a.type === 'character' && a.subAssets?.costumePrompt && a.subAssets.costumePrompt !== 'null' && (
              <div className="space-y-4 bg-blue-50/10 p-6 rounded-[2.5rem] border border-blue-100/20">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20`}>
                    <Shirt className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-[14px] font-black text-gray-800 uppercase tracking-widest">
                      变装图提示词 (COSTUME PROMPT)
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">补充说明本资产在生成角色变装图时的服装、配饰等视觉特征</p>
                  </div>
                </div>
                <textarea 
                  value={a.subAssets?.costumePrompt || ''}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    setData(prev => prev ? {
                      ...prev,
                      assets: prev.assets.map(asset => asset.id === a.id ? { ...asset, subAssets: { ...asset.subAssets, costumePrompt: newVal } } : asset)
                    } : null);
                  }}
                  className={`w-full h-32 p-6 bg-white border border-blue-100/30 rounded-[2rem] text-[13px] text-gray-700 leading-relaxed focus:ring-4 focus:ring-blue-500/10 outline-none resize-none transition-all shadow-inner font-medium`}
                  placeholder="在此输入变装详情提示词 (例如：穿着丝绸浴袍, 湿发, 展现清晨惺忪感)..."
                />
              </div>
            )}

            {/* 2. Appearance & Outfit Management Segment */}
            {((a.variants && a.variants.length > 0) || selectedVariantId) && (
              <div className="space-y-6 bg-blue-50/10 p-6 rounded-[2.5rem] border border-blue-100/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 ${themeStyles.iconBg} rounded-2xl flex items-center justify-center text-white shadow-lg ${themeStyles.iconShadow}`}>
                      {a.type === 'character' ? <Shirt className="w-5 h-5" /> : <Palette className="w-5 h-5" />}
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col">
                        <h3 className="text-[14px] font-black text-gray-800 uppercase tracking-widest">
                          各场变装形象 (APPEARANCES & OUTFITS)
                        </h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">定义角色在不同情景下的特定服饰与造型</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center p-1 bg-white border border-gray-100 rounded-xl shadow-sm space-x-1">
                      <button 
                        onClick={() => handleAddManualVariant(a.id)}
                        className={`p-2 ${themeStyles.hoverBg} ${themeStyles.text} rounded-lg hover:bg-opacity-80 transition-all`}
                        title="手动添加新形象"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      {a.type === 'character' && (
                        <button 
                          onClick={() => handleAIVariantDesign(a.id)}
                          disabled={!!generatingAssets[`${a.id}_design`]}
                          className={`px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md flex items-center space-x-2 disabled:opacity-50 group/ai-btn`}
                          title="AI 一键根据剧本分析并自动设计该角色的多套服装形象"
                        >
                          {generatingAssets[`${a.id}_design`] ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4 group-hover/ai-btn:rotate-12 transition-transform" />
                          )}
                          <span className="text-[11px] font-black uppercase tracking-wider">AI 设计变装</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Appearance Management List */}
                <div className="space-y-4">
                  {/* Virtual Views (Panorama/Layout/Character Sheet) if selected */}
                  {(virtualVariants.some(v => v.id === selectedVariantId)) && (
                    <div className="p-4 bg-white rounded-3xl border-2 border-blue-500 shadow-md">
                      <div className="flex items-center justify-between mb-3 px-2">
                        <div className="flex items-center space-x-2">
                          <Layers className="w-4 h-4 text-blue-500" />
                          <span className="text-[12px] font-black text-gray-800">{selectedVariant?.name}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(selectedVariant?.prompt || '');
                              alert('指令已复制');
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => setSelectedVariantId(null)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <textarea 
                        value={selectedVariant?.prompt || ''}
                        onChange={(e) => {
                          const newVal = e.target.value;
                          setData(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              assets: prev.assets.map(asset => asset.id === a.id ? {
                                ...asset,
                                subAssets: {
                                  ...asset.subAssets,
                                  [selectedVariantId === SECONDARY_VIEW_ID ? 'secondaryPrompt' : 'layoutPrompt']: newVal
                                }
                              } : asset)
                            };
                          });
                        }}
                        className={`w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[12px] text-gray-600 leading-relaxed outline-none resize-none transition-all focus:bg-white`}
                        placeholder={`在此编辑${selectedVariant?.name}的提示词...`}
                      />
                    </div>
                  )}

                  {/* Character Appearances (Variants) List */}
                  {a.variants && a.variants.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {a.variants.map((v, idx) => (
                        <div 
                          key={v.id} 
                          className={`p-5 rounded-[2rem] border transition-all ${selectedVariantId === v.id ? 'bg-blue-50 border-blue-300 shadow-md ring-2 ring-blue-500/10' : 'bg-white border-gray-100 hover:border-blue-100 shadow-sm'}`}
                          onClick={() => setSelectedVariantId(v.id)}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${selectedVariantId === v.id ? 'bg-blue-600' : 'bg-blue-100 text-blue-500'} font-black text-[10px]`}>
                                {idx + 1}
                              </div>
                              <div className="flex flex-col">
                                <input 
                                  value={v.name || ''} 
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const newVal = e.target.value;
                                    setData(prev => prev ? {
                                      ...prev,
                                      assets: prev.assets.map(asset => asset.id === a.id ? {
                                        ...asset,
                                        variants: asset.variants?.map(varItem => varItem.id === v.id ? { ...varItem, name: newVal } : varItem)
                                      } : asset)
                                    } : null);
                                  }}
                                  className={`bg-transparent font-black text-[12px] text-gray-800 outline-none w-24 border-b border-transparent focus:border-blue-200`}
                                  placeholder="形象名称"
                                />
                                <span className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">APPEARANCE {idx + 1}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVariantGen(a.id, v.id);
                                }}
                                disabled={!!generatingAssets[`${a.id}-variant-${v.id}`]}
                                className={`p-2 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-50`}
                                title="重新生成提示词"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${generatingAssets[`${a.id}-variant-${v.id}`] ? 'animate-spin' : ''}`} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteVariant(a.id, v.id);
                                  if (selectedVariantId === v.id) setSelectedVariantId(null);
                                }}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                title="删除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          
                          <textarea 
                            value={v.prompt || ''}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVariantId(v.id);
                            }}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setData(prev => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  assets: prev.assets.map(asset => asset.id === a.id ? {
                                    ...asset,
                                    variants: asset.variants?.map(varItem => varItem.id === v.id ? { ...varItem, prompt: newVal } : varItem)
                                  } : asset)
                                };
                              });
                            }}
                            className={`w-full h-32 p-4 bg-gray-50/50 border border-gray-50 rounded-2xl text-[11px] text-gray-600 leading-relaxed outline-none resize-none transition-all focus:bg-white focus:border-blue-100 ${selectedVariantId === v.id ? 'bg-white' : ''}`}
                            placeholder="描述该形象的服装、造型细节..."
                          />

                          {v.imageUrl && (
                            <div className="mt-3 flex items-center space-x-2 px-2 py-1.5 bg-blue-50/50 rounded-xl border border-blue-100/30">
                              <img src={v.imageUrl} className="w-6 h-6 rounded-md object-cover" referrerPolicy="no-referrer" />
                              <span className="text-[10px] font-bold text-blue-500 truncate">已关联参考图</span>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      <button 
                        onClick={() => handleAddManualVariant(a.id)}
                        className="p-5 rounded-[2rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center space-y-2 text-gray-300 hover:border-blue-200 hover:text-blue-400 hover:bg-blue-50/10 transition-all min-h-[200px]"
                      >
                        <Plus className="w-8 h-8" />
                        <span className="text-[11px] font-black uppercase tracking-widest">添加新形象</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[2.5rem] border border-blue-100/20 shadow-inner">
                      <div className="w-16 h-16 bg-blue-50 rounded-[1.5rem] flex items-center justify-center mb-4">
                        <Shirt className="w-8 h-8 text-blue-300 opacity-50" />
                      </div>
                      <h4 className="text-[14px] font-black text-gray-700 mb-2">尚未定义变装形象</h4>
                      <p className="text-[11px] text-gray-400 text-center max-w-[280px] leading-relaxed mb-6">
                        如果该角色在剧中有不同的服装造型，请点击下方按钮由 AI 自动从剧本中提取并设计这些形象。
                      </p>
                      <button 
                        onClick={() => handleAIVariantDesign(a.id)}
                        disabled={!!generatingAssets[`${a.id}_design`]}
                        className={`px-8 py-3 bg-blue-600 text-white rounded-2xl text-[12px] font-black hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center space-x-3 disabled:opacity-50`}
                      >
                        {generatingAssets[`${a.id}_design`] ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span>AI 自动从剧本提取变装</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => {
                if (setImageConfig) {
                  setImageConfig((prev: any) => ({
                    ...prev,
                    prompt: currentPrompt
                  }));
                  
                  if (onOpenImageDrawer) {
                    onOpenImageDrawer();
                  } else if (onNavigate) {
                    onNavigate('image');
                  } else {
                    window.open('https://huizhi.ai', '_blank');
                  }
                } else {
                  window.open('https://huizhi.ai', '_blank');
                }
              }}
              className={`flex items-center space-x-3 px-8 py-4 ${themeStyles.bg} text-white rounded-2xl text-[14px] font-black hover:opacity-90 transition-all shadow-xl ${themeStyles.shadow} active:scale-95`}
            >
              <Sparkles className="w-5 h-5" />
              <span>前往绘智生成图片</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            {genError && <span className="text-red-500 flex items-center space-x-2 text-[12px] font-bold bg-red-50 px-4 py-2 rounded-xl border border-red-100"><AlertCircle className="w-4 h-4" /> <span>{genError}</span></span>}
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (genStatus) {
                  const type = selectedVariantId ? 'variant' : 'main';
                  handleCancelAssetGen(a.id, type, selectedVariantId || undefined);
                  return;
                }
                if (selectedVariantId) {
                  setToast({ message: `正在为 "${selectedVariant?.name}" 生成指令...`, type: 'info' });
                  if (selectedVariantId === SECONDARY_VIEW_ID || selectedVariantId === LAYOUT_VIEW_ID) {
                    handleAssetGen(a.id, false, undefined, true);
                  } else {
                    handleVariantGen(a.id, selectedVariantId);
                  }
                } else {
                  setToast({ message: `正在为 "${a.name}" 生成主体指令...`, type: 'info' });
                  handleAssetGen(a.id, true, undefined, true); 
                }
              }} 
              className={`flex items-center space-x-3 px-10 py-4 rounded-2xl shadow-xl transition-all active:scale-95 text-[14px] font-black ${
                genStatus
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 shadow-red-50'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {genStatus ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className={`w-5 h-5 ${themeStyles.text}`} />}
              <span>{genStatus ? '取消生成' : `AI 生成${selectedVariantId ? selectedVariant?.name : '主体'}指令`}</span>
            </button>
          </div>
        </div>
      </div>

      <ImageSelectorModal 
        isOpen={isImageSelectorOpen}
        onClose={() => setIsImageSelectorOpen(false)}
        onSelect={(url) => {
          const type = selectedVariantId ? 'variant' : 'main';
          const variantId = selectedVariantId || undefined;
          
          setData(prev => {
            if (!prev) return null;
            const updated = {
              ...prev,
              assets: prev.assets.map(asset => asset.id === a.id ? {
                ...asset,
                generatedMedia: type !== 'variant' ? {
                  ...asset.generatedMedia,
                  [type === 'main' ? 'mainImageUrl' : 'secondaryMediaUrl']: url
                } : asset.generatedMedia,
                variants: type === 'variant' ? asset.variants?.map(v => v.id === variantId ? { ...v, imageUrl: url } : v) : asset.variants
              } : asset)
            };
            return updated;
          });
          
          handleSaveTask();
          setIsImageSelectorOpen(false);
        }}
        data={data}
        history={history}
      />

      {/* Zoom Modal */}
      <AnimatePresence>
        {zoomImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomImageUrl(null)}
            className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 md:p-20 overflow-hidden"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={zoomImageUrl} 
                className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setZoomImageUrl(null)}
                className="absolute top-0 right-0 md:-top-12 md:-right-12 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md border border-white/10"
              >
                <X className="w-8 h-8" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
