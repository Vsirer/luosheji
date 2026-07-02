import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Library, 
  Clapperboard, 
  Palette, 
  Maximize2, 
  Zap, 
  Plus, 
  ChevronDown, 
  UserPlus, 
  MapPin, 
  Package, 
  RefreshCw, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Download,
  Video,
  Loader2,
  X
} from 'lucide-react';
import { Asset, PipelineData, Config, Step } from '../../types';
import { AssetCard } from '../AssetCard';
import { AssetGridItem } from './AssetGridItem';
import { AssetTaskTable } from './AssetTaskTable';
import { LayoutGrid, List } from 'lucide-react';

interface GlobalAssetLibraryProps {
  data: PipelineData;
  setData: (update: any) => void;
  generatingAssets: Record<string, string>;
  assetErrors: Record<string, string>;
  draggedAssetId: { id: string | number; type: string; variantId?: string } | null;
  handleAssetListDragStart: (e: React.DragEvent, asset: Asset, subType?: 'main' | 'secondary' | 'variant', variantId?: string) => void;
  handleAssetGen: (assetId: string, isMain: boolean, overridePrompt?: string, force?: boolean, referenceUrl?: string, variantId?: string) => void;
  handleAssetImageGen: (assetId: string, isMain: boolean, variantId?: string, force?: boolean) => void;
  handleSceneSecondaryGen: (assetId: string, force?: boolean) => void;
  handleAssetDragOver: (e: React.DragEvent, id: string | number, type: 'main' | 'secondary' | 'variant' | 'container', variantId?: string) => void;
  handleAssetDragLeave: () => void;
  handleAssetDrop: (e: React.DragEvent, id: string | number, type: 'main' | 'secondary' | 'variant' | 'container', variantId?: string) => void;
  triggerUpload: (id: string | number, type: 'main' | 'secondary' | 'variant' | 'layout', variantId?: string) => void;
  setEditingPrompt: (val: { id: string; type: 'main' | 'secondary' | 'variant' | 'layout'; variantId?: string } | null) => void;
  setTempPromptValue: (val: string) => void;
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
  handleSaveTask: (targetData?: PipelineData) => Promise<void>;
  config: Config;
  handleAddAsset: (type: 'character' | 'scene' | 'prop' | 'continuity') => void;
  handleRescanAssetsOnly: () => Promise<void>;
  handleDownloadAllGlobalAssets: (filename?: string) => Promise<void>;
  setStep: (step: Step) => void;
  handleGenerate: (fullAuto: boolean) => Promise<void>;
  handleGenerateAllAssets: () => void;
  isGeneratingAll: boolean;
  generateAllProgress: { current: number; total: number; phase: string };
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
  history: any[];
  setImageConfig?: React.Dispatch<React.SetStateAction<any>>;
  onNavigate?: (tab: string) => void;
  onOpenImageDrawer?: (id: string | number, type: 'main' | 'secondary' | 'variant' | 'layout', variantId?: string) => void;
}

export const GlobalAssetLibrary: React.FC<GlobalAssetLibraryProps> = ({
  data,
  setData,
  generatingAssets,
  assetErrors,
  draggedAssetId,
  handleAssetListDragStart,
  handleAssetGen,
  handleAssetImageGen,
  handleSceneSecondaryGen,
  handleAssetDragOver,
  handleAssetDragLeave,
  handleAssetDrop,
  triggerUpload,
  setEditingPrompt,
  setTempPromptValue,
  updateAssetName,
  updateAssetRefName,
  updateAssetDetails,
  handleVariantGen,
  handleDeleteVariant,
  handleAddManualVariant,
  handleAIVariantDesign,
  handleCancelAssetGen,
  editingAssetName,
  setEditingAssetName,
  editingAssetRefName,
  setEditingAssetRefName,
  handleSaveTask,
  config,
  handleAddAsset,
  handleRescanAssetsOnly,
  handleDownloadAllGlobalAssets,
  setStep,
  handleGenerate,
  handleGenerateAllAssets,
  isGeneratingAll,
  generateAllProgress,
  setToast,
  history,
  setImageConfig,
  onNavigate,
  onOpenImageDrawer
}) => {
  const assetScrollRef = useRef<HTMLDivElement>(null);
  const [scrollButtonsY, setScrollButtonsY] = useState(50);
  const isDraggingButtonsRef = useRef(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const scrollAssets = (direction: 'left' | 'right') => {
    if (assetScrollRef.current) {
      const scrollAmount = 800;
      assetScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollToAsset = (id: string) => {
    const element = document.getElementById(`asset-${id}`);
    if (element && assetScrollRef.current) {
      const container = assetScrollRef.current;
      const left = element.offsetLeft - container.offsetLeft - 20;
      container.scrollTo({ left, behavior: 'smooth' });
    }
  };

  return (
    <div id="asset-library-container" className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 relative group transition-all duration-500">
      {/* Header Section */}
      <div className="flex items-center justify-between pb-10">
        <div className="flex items-center space-x-5 cursor-pointer group/title" onClick={() => setIsCollapsed(!isCollapsed)}>
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-500/20 group-hover/title:scale-110 transition-all duration-300">
            <Library className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">全局资产库</h1>
              <div className={`p-1.5 rounded-full bg-gray-50 text-gray-400 group-hover/title:text-blue-600 transition-all ${isCollapsed ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-0.5">Global Asset Library</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {!isCollapsed && (
             <div className="flex items-center space-x-3">
                <div className="flex bg-gray-50 p-1.5 rounded-[1.25rem] border border-gray-100 mr-4">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setViewMode('grid'); }}
                    className={`p-2 rounded-xl transition-all duration-300 ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                    title="网格视图"
                  >
                    <LayoutGrid className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setViewMode('list'); }}
                    className={`p-2 rounded-xl transition-all duration-300 ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'}`}
                    title="列表视图"
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>

                <div className="relative group/add-asset">
                  <button className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl text-[13px] font-bold hover:shadow-lg hover:shadow-blue-600/30 transition-all active:scale-95">
                    <Plus className="w-4 h-4" />
                    <span>新增资产</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>
                  <div className="absolute top-full right-0 mt-3 w-56 bg-white rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.1)] border border-gray-100 p-3 opacity-0 invisible group-hover/add-asset:opacity-100 group-hover/add-asset:visible transition-all z-[110]">
                    <button 
                      onClick={() => handleAddAsset('character')}
                      className="w-full flex items-center space-x-4 p-4 hover:bg-blue-50/50 rounded-2xl transition-all text-left group/item"
                    >
                      <div className="w-10 h-10 bg-blue-100/50 rounded-xl flex items-center justify-center text-blue-600 group-hover/item:scale-110 transition-transform">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-gray-700">添加角色</span>
                        <span className="text-[10px] text-gray-400">新增人物资产</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => handleAddAsset('scene')}
                      className="w-full flex items-center space-x-4 p-4 hover:bg-green-50/50 rounded-2xl transition-all text-left group/item"
                    >
                      <div className="w-10 h-10 bg-green-100/50 rounded-xl flex items-center justify-center text-green-600 group-hover/item:scale-110 transition-transform">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-gray-700">添加场景</span>
                        <span className="text-[10px] text-gray-400">新增环境资产</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => handleAddAsset('prop')}
                      className="w-full flex items-center space-x-4 p-4 hover:bg-purple-50/50 rounded-2xl transition-all text-left group/item"
                    >
                      <div className="w-10 h-10 bg-purple-100/50 rounded-xl flex items-center justify-center text-purple-600 group-hover/item:scale-110 transition-transform">
                        <Package className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-gray-700">添加道具</span>
                        <span className="text-[10px] text-gray-400">新增物品资产</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => handleAddAsset('continuity')}
                      className="w-full flex items-center space-x-4 p-4 hover:bg-orange-50/50 rounded-2xl transition-all text-left group/item"
                    >
                      <div className="w-10 h-10 bg-orange-100/50 rounded-xl flex items-center justify-center text-orange-600 group-hover/item:scale-110 transition-transform">
                        <RefreshCw className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-gray-700">添加尾帧</span>
                        <span className="text-[10px] text-gray-400">新增视觉参考</span>
                      </div>
                    </button>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleGenerateAllAssets(); }}
                  disabled={isGeneratingAll}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-2xl text-[13px] font-bold transition-all shadow-xl active:scale-95 ${
                    isGeneratingAll 
                      ? 'bg-amber-100 text-amber-600 border border-amber-200 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:shadow-blue-600/30'
                  }`}
                >
                  {isGeneratingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="whitespace-nowrap">{generateAllProgress.phase} ({generateAllProgress.current}/{generateAllProgress.total})</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>一键全部执行</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRescanAssetsOnly(); }}
                  className="flex items-center space-x-2 px-6 py-3 bg-white text-gray-600 border border-gray-200 rounded-2xl text-[13px] font-bold hover:bg-gray-50 transition-all shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>重新扫描资产</span>
                </button>
             </div>
          )}
          
          {isCollapsed && (
            <div className="flex items-center space-x-2 px-4 py-2 bg-blue-50 rounded-2xl border border-blue-100 mr-2">
               <span className="text-[12px] font-bold text-blue-600">已收起 {data?.assets?.length || 0} 个资产</span>
            </div>
          )}
          
          <button 
            onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
            className={`p-3 rounded-2xl transition-all ${isCollapsed ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
          >
            {isCollapsed ? <Maximize2 className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Assets List */}
      {!isCollapsed && (
        <div id="asset-list-container" className="flex flex-col min-h-[200px] px-2 w-full relative z-10">
            {data?.assets && data.assets.length > 0 ? (
              <div key={viewMode}>
                {viewMode === 'list' ? (
                   <div className="flex flex-col space-y-8">
                     <AssetTaskTable 
                       assets={data.assets}
                       generatingAssets={generatingAssets}
                       assetErrors={assetErrors}
                       handleAssetGen={handleAssetGen}
                       handleAssetImageGen={handleAssetImageGen}
                       setEditingPrompt={setEditingPrompt}
                       setTempPromptValue={setTempPromptValue}
                       updateAssetName={updateAssetName}
                       updateAssetDetails={updateAssetDetails}
                       handleCancelAssetGen={handleCancelAssetGen}
                       triggerUpload={triggerUpload}
                       onCallLibrary={(id, type, variantId) => onOpenImageDrawer?.(id, type as any, variantId)}
                       onAssetClick={(id) => {
                         // On click, scroll to it in grid or maybe just stay. 
                         // For now just keep it simple.
                       }}
                       onShowZoom={(url) => setZoomImageUrl(url)}
                     />
                   </div>
                 ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-8 pb-10">
                    {data.assets.map(asset => (
                      <AssetGridItem 
                        key={asset.id}
                        asset={asset}
                        generatingAssets={generatingAssets}
                        assetErrors={assetErrors}
                        handleAssetListDragStart={handleAssetListDragStart}
                        handleAssetGen={handleAssetGen}
                        setEditingPrompt={(val) => setEditingPrompt(val as any)}
                        setTempPromptValue={setTempPromptValue}
                        updateAssetName={updateAssetName}
                        setData={setData as any}
                        handleCancelAssetGen={handleCancelAssetGen}
                        onShowZoom={(url) => setZoomImageUrl(url)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full py-20 flex flex-col items-center justify-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200 mt-4 h-[400px]">
                <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-xl shadow-gray-200/50">
                  <Package className="w-12 h-12 text-gray-200" />
                </div>
                <div className="text-center space-y-3 px-4">
                  <h3 className="text-xl font-black text-gray-900">未扫描到有效资产</h3>
                  <p className="text-sm font-bold text-gray-400 max-w-xs mx-auto">AI 未从剧本中提取到角色、场景或道具。若发生错误，请检查 API Key 与模型配置。</p>
                </div>
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setStep(Step.INPUT)}
                    className="px-8 py-3 bg-white text-gray-600 rounded-2xl text-[13px] font-bold border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
                  >
                    返回修改剧本
                  </button>
                  <button 
                    onClick={() => handleGenerate(false)}
                    className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[13px] font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20"
                  >
                    重新扫描资产
                  </button>
                </div>
              </div>
            )}
        </div>
      )}

      {/* Global Zoom Modal */}
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
