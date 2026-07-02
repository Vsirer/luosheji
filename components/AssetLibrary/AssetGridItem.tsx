import React, { useState } from 'react';
import { 
  Edit3, 
  RefreshCw, 
  Trash2, 
  Wand2, 
  Loader2,
  AlertCircle,
  ExternalLink,
  Layers,
  Plus,
  Maximize2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Asset, PipelineData } from '../../types';

interface AssetGridItemProps {
  asset: Asset;
  generatingAssets: Record<string, string>;
  assetErrors: Record<string, string>;
  handleAssetListDragStart: (e: React.DragEvent, asset: Asset, subType?: 'main' | 'secondary' | 'variant', variantId?: string) => void;
  handleAssetGen: (assetId: string, isMain: boolean, overridePrompt?: string, force?: boolean, referenceUrl?: string, variantId?: string) => void;
  setEditingPrompt: (val: { id: string; type: 'main' | 'secondary' | 'layout' | 'variant'; variantId?: string } | null) => void;
  setTempPromptValue: (val: string) => void;
  updateAssetName: (id: string, name: string) => void;
  setData: React.Dispatch<React.SetStateAction<PipelineData | null>>;
  handleCancelAssetGen: (id: string, type: string, variantId?: string) => void;
  onShowZoom?: (url: string) => void;
}

export const AssetGridItem: React.FC<AssetGridItemProps> = ({
  asset,
  generatingAssets,
  assetErrors,
  handleAssetListDragStart,
  handleAssetGen,
  setEditingPrompt,
  setTempPromptValue,
  updateAssetName,
  setData,
  handleCancelAssetGen,
  onShowZoom
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [previewVariantId, setPreviewVariantId] = useState<string | null>(null);
  
  const currentKey = previewVariantId ? `${asset.id}-variant-${previewVariantId}` : `${asset.id}-main`;
  const genStatus = generatingAssets[currentKey];
  const genError = assetErrors[currentKey];
  
  const mainImageUrl = asset.generatedMedia?.mainImageUrl;
  const mainPrompt = asset.subAssets?.mainPrompt || '';
  
  const themeColor = asset.type === 'character' ? 'blue' : 
                    asset.type === 'scene' ? 'green' : 
                    asset.type === 'continuity' ? 'orange' : 'purple';

  const themeStyles = {
    blue: 'text-blue-700 bg-blue-50 border-blue-100',
    green: 'text-teal-700 bg-teal-50 border-teal-100',
    purple: 'text-purple-700 bg-purple-50 border-purple-100',
    orange: 'text-orange-700 bg-orange-50 border-orange-100'
  }[themeColor];

  // Define virtual variants for built-in views
  const SECONDARY_VIEW_ID = 'secondary_view';
  const LAYOUT_VIEW_ID = 'layout_view';
  
  const virtualVariants = [];
  if (asset.type === 'character') {
    virtualVariants.push({ id: SECONDARY_VIEW_ID, name: '角色设定图', imageUrl: asset.generatedMedia?.secondaryMediaUrl, prompt: asset.subAssets?.secondaryPrompt });
  } else if (asset.type === 'scene') {
    virtualVariants.push({ id: SECONDARY_VIEW_ID, name: '720全景', imageUrl: asset.generatedMedia?.secondaryMediaUrl, prompt: asset.subAssets?.secondaryPrompt });
    virtualVariants.push({ id: LAYOUT_VIEW_ID, name: '布局图', imageUrl: asset.generatedMedia?.layoutUrl, prompt: asset.subAssets?.layoutPrompt });
  } else if (asset.type === 'prop') {
    // Props typically don't have built-in secondary views like characters or scenes
  }

  const allVariants = [
    ...virtualVariants,
    ...(asset.variants || []).map(v => ({ ...v, isManual: true }))
  ];

  const hasVariants = allVariants.length > 0;
  
  const selectedVirtual = virtualVariants.find(v => v.id === previewVariantId);
  const selectedManual = asset.variants?.find(v => v.id === previewVariantId);
  const selectedVariant = selectedVirtual || selectedManual;

  const imageUrl = previewVariantId ? selectedVariant?.imageUrl : mainImageUrl;
  const prompt = previewVariantId ? selectedVariant?.prompt : mainPrompt;

  return (
    <div 
      draggable
      onDragStart={(e) => handleAssetListDragStart(e, asset, previewVariantId ? (selectedVirtual ? 'secondary' : 'variant') : 'main', previewVariantId || undefined)}
      className="group relative flex flex-col bg-white rounded-[2.5rem] border border-gray-100 shadow-sm transition-all duration-500 hover:shadow-[0_30px_60px_rgba(0,0,0,0.12)] cursor-grab active:cursor-grabbing overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setPreviewVariantId(null);
      }}
    >
      {/* Image Container */}
      <div className="relative w-full aspect-[4/5] overflow-hidden bg-gray-50 transition-all duration-300 cursor-pointer">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={asset.name} 
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 text-gray-300 space-y-3">
            <div className="p-3 bg-white rounded-full shadow-sm">
              <Wand2 className="w-6 h-6 text-gray-200" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">未生成</span>
          </div>
        )}

        {/* Variant Count Badge */}
        {hasVariants && !isHovered && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg text-[10px] font-bold text-white flex items-center space-x-1.5 border border-white/20">
            <Layers className="w-3.5 h-3.5" />
            <span>+{allVariants.length} {asset.type === 'character' ? '造型' : '视图'}</span>
          </div>
        )}

        {/* Loading Overlay */}
        {genStatus && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center space-y-3">
            <div className="relative">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <div className="absolute inset-0 blur-lg bg-blue-400/20 animate-pulse" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">正在创作...</span>
          </div>
        )}

        {/* Hover Actions Overlay */}
        <AnimatePresence>
          {isHovered && !genStatus && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-between p-4"
            >
              <div className="flex items-center justify-center mt-auto mb-4">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (imageUrl) onShowZoom?.(imageUrl);
                  }}
                  className="p-3 bg-white rounded-full text-gray-700 hover:text-blue-600 transition-all hover:scale-110 shadow-lg"
                  title="放大查看"
                >
                  <Maximize2 className="w-6 h-6" />
                </button>
              </div>

              {/* Variant Thumbnails */}
              {hasVariants && (
                <div className="w-full flex items-center justify-center space-x-2 overflow-x-auto py-2 no-scrollbar">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setPreviewVariantId(null); }}
                    className={`w-8 h-8 rounded-lg border-2 transition-all flex-shrink-0 overflow-hidden ${!previewVariantId ? 'border-blue-500 scale-110' : 'border-white/40 hover:border-white'}`}
                  >
                  <img src={mainImageUrl} className="w-full h-full object-cover object-top" referrerPolicy="no-referrer" />
                  </button>
                  {allVariants.map(v => (
                    <button 
                      key={v.id}
                      onClick={(e) => { e.stopPropagation(); setPreviewVariantId(v.id); }}
                      className={`w-8 h-8 rounded-lg border-2 transition-all flex-shrink-0 overflow-hidden ${previewVariantId === v.id ? 'border-blue-500 scale-110' : 'border-white/40 hover:border-white'}`}
                    >
                      {v.imageUrl ? (
                        <img src={v.imageUrl} className="w-full h-full object-cover object-top" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <Plus className="w-3 h-3 text-white/40" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Badge */}
        {genError && (
          <div className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full shadow-lg">
            <AlertCircle className="w-3 h-3" />
          </div>
        )}
      </div>

      {/* Name and Prompt Section */}
      <div className="w-full text-center relative h-[4.5rem] px-4 pb-4 bg-white transition-all duration-300">
        <AnimatePresence mode="wait">
          {!isHovered ? (
            <motion.div
              key="name"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center h-full text-left"
            >
              <div className="w-full flex flex-col items-start px-1">
                <span className="text-[13px] font-bold text-gray-900 truncate w-full leading-tight mb-1.5">
                  {asset.name}
                </span>
                <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.1em] border border-transparent shadow-sm ${themeStyles}`}>
                  {asset.type === 'character' ? '角色' : asset.type === 'scene' ? '场景' : asset.type === 'prop' ? '道具' : '参考'}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="w-full h-full"
            >
              <div 
                onClick={() => {
                  setEditingPrompt({ id: asset.id, type: previewVariantId ? 'variant' : 'main', variantId: previewVariantId || undefined });
                  setTempPromptValue(prompt || '');
                }}
                className="w-full h-full bg-gray-50/80 hover:bg-white border border-transparent hover:border-blue-100 rounded-xl p-2.5 transition-all group/prompt relative overflow-hidden flex flex-col"
              >
                <div className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mb-1 text-left">编辑提示词</div>
                <p className="text-[10px] text-gray-500 line-clamp-1 leading-snug text-left overflow-hidden">
                  {previewVariantId && <span className="text-blue-600 font-bold mr-1">[{selectedVariant?.name}]</span>}
                  {prompt || '暂无内容'}
                </p>
                <div className="absolute bottom-1 right-2 opacity-0 group-hover/prompt:opacity-100 transition-opacity">
                  <Edit3 className="w-3 h-3 text-blue-400" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
