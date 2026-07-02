import React from 'react';
import { 
  Loader2, 
  Edit3,
  Zap,
  Image as ImageIcon,
  FileText,
  User,
  MapPin,
  Package,
  RefreshCw,
  RotateCcw,
  Wand2,
  Upload,
  Library
} from 'lucide-react';
import { Asset } from '../../types';

interface AssetTaskTableProps {
  assets: Asset[];
  generatingAssets: Record<string, string>;
  assetErrors: Record<string, string>;
  handleAssetGen: (assetId: string, isMain: boolean, overridePrompt?: string, force?: boolean, referenceUrl?: string, variantId?: string) => void;
  handleAssetImageGen: (assetId: string, isMain: boolean, variantId?: string, force?: boolean) => void;
  setEditingPrompt: (val: { id: string; type: 'main' | 'secondary' | 'layout' | 'variant'; variantId?: string } | null) => void;
  setTempPromptValue: (val: string) => void;
  updateAssetName: (id: string, name: string) => void;
  updateAssetDetails: (id: string, details: Partial<Asset['details']>) => void;
  handleCancelAssetGen: (id: string, type: string) => void;
  triggerUpload: (id: string | number, type: 'main' | 'secondary' | 'layout' | 'variant', variantId?: string) => void;
  onCallLibrary?: (id: string, type: string, variantId?: string) => void;
  onAssetClick: (id: string) => void;
  onShowZoom?: (url: string) => void;
}

export const AssetTaskTable: React.FC<AssetTaskTableProps> = ({
  assets,
  generatingAssets,
  assetErrors,
  handleAssetGen,
  handleAssetImageGen,
  setEditingPrompt,
  setTempPromptValue,
  updateAssetName,
  updateAssetDetails,
  handleCancelAssetGen,
  triggerUpload,
  onCallLibrary,
  onAssetClick,
  onShowZoom
}) => {
  
  // Flatten assets into tasks with rowSpan info for merged cells
  const allRows = assets.flatMap(asset => {
    const assetTasks: any[] = [];
    
    if (asset.type === 'character') {
      assetTasks.push({ category: '角色主图', type: 'main' as const });
      assetTasks.push({ category: '设定图', type: 'secondary' as const });
      asset.variants?.forEach(v => {
        assetTasks.push({ 
          category: `变装图 (${v.name})`, 
          type: 'variant' as const, 
          variantId: v.id 
        });
      });
    } else if (asset.type === 'scene') {
      assetTasks.push({ category: '场景主图', type: 'main' as const });
      assetTasks.push({ category: '布局图', type: 'layout' as const });
      assetTasks.push({ category: '720全景', type: 'secondary' as const });
      asset.variants?.forEach(v => {
        assetTasks.push({ category: v.name, type: 'variant' as const, variantId: v.id });
      });
    } else if (asset.type === 'prop') {
      assetTasks.push({ category: '道具主图', type: 'main' as const });
      assetTasks.push({ category: '道具三视图', type: 'secondary' as const });
      asset.variants?.forEach(v => {
        assetTasks.push({ category: v.name, type: 'variant' as const, variantId: v.id });
      });
    } else {
      assetTasks.push({ category: '默认', type: 'main' as const });
      asset.variants?.forEach(v => {
        assetTasks.push({ category: v.name, type: 'variant' as const, variantId: v.id });
      });
    }
    
    return assetTasks.map((task, idx) => ({
      ...task,
      asset,
      isFirstInAsset: idx === 0,
      assetRowSpan: assetTasks.length
    }));
  });

  const getTaskStatus = (asset: Asset, type: 'main' | 'secondary' | 'layout' | 'variant', vId?: string) => {
    let hasPrompt = false;
    let hasImage = false;
    let key = '';

    if (type === 'main') {
      hasPrompt = !!asset.subAssets?.mainPrompt;
      hasImage = !!asset.generatedMedia?.mainImageUrl;
      key = `${asset.id}-main`;
    } else if (type === 'secondary') {
      hasPrompt = !!asset.subAssets?.secondaryPrompt;
      hasImage = !!asset.generatedMedia?.secondaryMediaUrl;
      key = `${asset.id}-secondary`;
    } else if (type === 'layout') {
      hasPrompt = !!asset.subAssets?.layoutPrompt;
      hasImage = !!asset.generatedMedia?.layoutUrl;
      key = `${asset.id}-layout`;
    } else if (type === 'variant') {
      const v = asset.variants?.find(vx => vx.id === vId || vx.name === vId);
      hasPrompt = !!v?.prompt;
      hasImage = !!v?.imageUrl;
      key = `${asset.id}-variant-${v?.id || vId}`;
    }

    const isGenerating = generatingAssets[key];
    const hasError = assetErrors[key];

    if (hasImage) return 'completed';
    if (isGenerating) return 'generating';
    if (hasError) return 'error';
    if (hasPrompt) return 'ready_for_image';
    return 'pending';
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'character': return <User className="w-4 h-4" />;
      case 'scene': return <MapPin className="w-4 h-4" />;
      case 'prop': return <Package className="w-4 h-4" />;
      case 'continuity': return <RefreshCw className="w-4 h-4" />;
      default: return <ImageIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-xl shadow-gray-200/20">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50/50 border-b border-gray-100">
            <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">基本信息</th>
            <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">资产预览</th>
            <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">生成分类</th>
            <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">规格 (身高/尺寸)</th>
            <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">视觉指令 (提示词)</th>
            <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">状态</th>
            <th className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {allRows.map((taskRow, idx) => {
            const { asset, category, type, variantId: vId, isFirstInAsset, assetRowSpan } = taskRow;
            const variant = vId ? asset.variants?.find(v => v.id === vId || v.name === vId) : undefined;
            const finalVId = variant?.id || vId;
            
            const status = getTaskStatus(asset, type, finalVId);
            const isSpecial = ['设定图', '道具三视图', '布局图', '720全景'].includes(category);
            
            let currentGenKey = '';
            if (type === 'main') currentGenKey = `${asset.id}-main`;
            else if (type === 'secondary') currentGenKey = `${asset.id}-secondary`;
            else if (type === 'layout') currentGenKey = `${asset.id}-layout`;
            else if (type === 'variant') currentGenKey = `${asset.id}-variant-${finalVId}`;

            const isGenerating = generatingAssets[currentGenKey];

            let imageUrl = '';
            if (type === 'main') imageUrl = asset.generatedMedia?.mainImageUrl || '';
            else if (type === 'secondary') imageUrl = asset.generatedMedia?.secondaryMediaUrl || '';
            else if (type === 'layout') imageUrl = asset.generatedMedia?.layoutUrl || '';
            else if (type === 'variant') imageUrl = variant?.imageUrl || '';

            let prompt = '';
            if (type === 'main') prompt = asset.subAssets?.mainPrompt || '';
            else if (type === 'secondary') prompt = asset.subAssets?.secondaryPrompt || '';
            else if (type === 'layout') prompt = asset.subAssets?.layoutPrompt || '';
            else if (type === 'variant') prompt = variant?.prompt || '';

            return (
              <tr 
                key={`${asset.id}-${category}-${idx}`} 
                className="group hover:bg-blue-50/30 transition-colors"
                onClick={() => onAssetClick(asset.id)}
              >
                {isFirstInAsset && (
                  <td className="px-6 py-6 border-r border-gray-50 align-top" rowSpan={assetRowSpan}>
                    <div className="flex flex-col items-center justify-center min-h-[80px]">
                      <span className="text-[15px] font-black text-gray-900 group-hover:text-blue-600 transition-colors lowercase text-center">
                        {asset.name || '未命名'}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1.5 flex items-center">
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          asset.type === 'character' ? 'bg-blue-400' : 
                          asset.type === 'scene' ? 'bg-green-400' : 'bg-purple-400'
                        }`} />
                        {asset.type === 'character' ? '角色' : asset.type === 'scene' ? '场景' : '道具'}
                      </span>
                    </div>
                  </td>
                )}

                <td className="px-6 py-6 border-r border-gray-50 align-top">
                  <div className="flex justify-center">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (imageUrl) onShowZoom?.(imageUrl);
                      }}
                      className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform cursor-zoom-in"
                    >
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-200 bg-gray-50/30">
                          {getAssetIcon(asset.type)}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4">
                  <div className="flex justify-start px-2">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        asset.type === 'character' ? 'bg-blue-500' : 
                        asset.type === 'scene' ? 'bg-green-500' : 'bg-purple-500'
                      } shadow-sm`} />
                      <span className="text-[13px] font-bold text-gray-700 tracking-tight">
                        {category}
                      </span>
                    </div>
                  </div>
                </td>

                {isFirstInAsset && (
                  <td className="px-6 py-4 border-r border-gray-50 bg-gray-50/10 align-top" rowSpan={assetRowSpan}>
                    <div className="flex flex-col items-center justify-center min-h-[80px] space-y-2">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="text"
                          value={asset.details?.height || ''} 
                          placeholder={asset.type === 'character' ? '170' : asset.type === 'scene' ? '100' : '30'}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateAssetDetails(asset.id, { height: e.target.value });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-20 px-3 py-2 bg-white border border-gray-100 rounded-xl text-[12px] font-black text-gray-700 text-center focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm"
                        />
                        <span className="text-[10px] font-bold text-gray-400">
                          {asset.type === 'character' ? 'cm' : asset.type === 'scene' ? 'm²' : 'cm'}
                        </span>
                      </div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                        {asset.type === 'character' ? '身高' : '规格/尺寸'}
                      </div>
                    </div>
                  </td>
                )}

                <td className="px-6 py-4 min-w-[360px]">
                  {isSpecial ? (
                    <div className="flex items-center space-x-3 h-[90px]">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerUpload(asset.id, type as any, finalVId);
                        }}
                        className="flex-1 h-full flex flex-col items-center justify-center bg-blue-50/50 hover:bg-blue-100/50 border-2 border-dashed border-blue-200 rounded-2xl transition-all group/btn"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-2 group-hover/btn:scale-110 transition-transform">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="text-[12px] font-black text-blue-600">上传图片</span>
                      </button>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onCallLibrary) {
                            onCallLibrary(asset.id, type as any, finalVId);
                          }
                        }}
                        className="flex-1 h-full flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl transition-all group/btn"
                      >
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-400 mb-2 group-hover/btn:scale-110 transition-transform border border-gray-100 shadow-sm">
                          <Library className="w-5 h-5" />
                        </div>
                        <span className="text-[12px] font-bold text-gray-600">调用资产库</span>
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPrompt({ id: asset.id, type: type as any, variantId: vId });
                        setTempPromptValue(prompt || '');
                      }}
                      className="group/prompt relative px-6 py-5 bg-gray-50/30 hover:bg-white border border-transparent hover:border-blue-200 hover:shadow-xl transition-all cursor-text min-h-[90px] flex flex-col justify-center rounded-[1.5rem]"
                    >
                      {type !== 'main' && (
                        <div className="absolute top-3 right-4 flex items-center space-x-1.5 opacity-60 group-hover/prompt:opacity-100 transition-opacity bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                          <Zap className="w-2.5 h-2.5 text-blue-500" />
                          <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">已继承基础特征</span>
                        </div>
                      )}
                      <p className="text-[12px] text-gray-700 line-clamp-3 leading-relaxed font-semibold pr-4">
                        {prompt ? (
                          <span className="text-gray-900">{prompt}</span>
                        ) : (
                          <span className="text-gray-300 italic">点击开始创作视觉指令...</span>
                        )}
                      </p>
                      {(!prompt && !isGenerating) && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            updateAssetDetails(asset.id, { clothing: category });
                            setTimeout(() => {
                              handleAssetGen(asset.id, type === 'main', undefined, true, undefined, finalVId);
                            }, 50);
                          }}
                          className="mt-3 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[11px] font-black hover:bg-blue-700 transition-all self-start shadow-lg shadow-blue-600/20 active:scale-95"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>自动创作场景描述</span>
                        </button>
                      )}
                      <div className="absolute bottom-3 right-4 opacity-0 group-hover/prompt:opacity-100 transition-opacity">
                        <div className="p-1.5 bg-gray-100 text-gray-400 rounded-lg">
                          <Edit3 className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  )}
                </td>

                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    {status === 'completed' ? (
                      <span className="whitespace-nowrap px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black rounded-full border border-green-100 uppercase tracking-widest">
                         已完成
                      </span>
                    ) : status === 'generating' ? (
                      <span className="whitespace-nowrap px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full border border-blue-100 uppercase tracking-widest">
                         生成中
                      </span>
                    ) : status === 'error' ? (
                      <span className="whitespace-nowrap px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black rounded-full border border-red-100 uppercase tracking-widest">
                         失败
                      </span>
                    ) : (
                      <span className="whitespace-nowrap px-3 py-1 bg-gray-50 text-gray-400 text-[10px] font-black rounded-full border border-gray-100 uppercase tracking-widest">
                         待处理
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    {status === 'generating' ? (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          handleCancelAssetGen(asset.id, currentGenKey.split('-')[1]); 
                        }}
                        className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 rounded-xl transition-all"
                      >
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </button>
                    ) : isSpecial ? (
                       <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          triggerUpload(asset.id, type as any, finalVId);
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-100 transition-all"
                        title="上传图片"
                      >
                         <Upload className="w-5 h-5" />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          updateAssetDetails(asset.id, { clothing: category });
                          setTimeout(() => {
                            handleAssetImageGen(asset.id, type === 'main', type === 'variant' ? finalVId : undefined, true);
                          }, 50);
                        }}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                          prompt 
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20' 
                            : 'bg-gray-100 text-gray-300 pointer-events-none'
                        }`}
                        title="生成图片"
                      >
                         <Zap className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
