import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Image as ImageIcon, 
  History, 
  Library,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PipelineData, HistoryItem, Asset } from '../../types';

interface ImageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  data: PipelineData | null;
  history: HistoryItem[];
}

export const ImageSelectorModal: React.FC<ImageSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  data,
  history
}) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'history'>('assets');
  const [searchQuery, setSearchQuery] = useState('');

  const allImages = useMemo(() => {
    const assetImages: { url: string; source: string; name: string; timestamp: number }[] = [];
    
    if (data?.assets) {
      data.assets.forEach(asset => {
        if (asset.generatedMedia?.mainImageUrl) {
          assetImages.push({
            url: asset.generatedMedia.mainImageUrl,
            source: '资产库',
            name: `${asset.name} - 主图`,
            timestamp: data.timestamp || Date.now()
          });
        }
        if (asset.generatedMedia?.secondaryMediaUrl) {
          assetImages.push({
            url: asset.generatedMedia.secondaryMediaUrl,
            source: '资产库',
            name: `${asset.name} - 参考图`,
            timestamp: data.timestamp || Date.now()
          });
        }
        asset.variants?.forEach(variant => {
          if (variant.imageUrl) {
            assetImages.push({
              url: variant.imageUrl,
              source: '资产库',
              name: `${asset.name} - ${variant.name}`,
              timestamp: data.timestamp || Date.now()
            });
          }
        });
      });
    }

    const historyImages = history
      .filter(item => item.type === 'image' && item.status === 'success' && item.imageUrl)
      .map(item => ({
        url: item.imageUrl!,
        source: '历史记录',
        name: item.revisedPrompt || (item.config as any).prompt || '未命名图片',
        timestamp: item.timestamp
      }));

    return {
      assets: assetImages,
      history: historyImages
    };
  }, [data, history]);

  const filteredImages = useMemo(() => {
    const images = activeTab === 'assets' ? allImages.assets : allImages.history;
    if (!searchQuery.trim()) return images;
    
    const query = searchQuery.toLowerCase();
    return images.filter(img => 
      img.name.toLowerCase().includes(query) || 
      img.source.toLowerCase().includes(query)
    );
  }, [activeTab, allImages, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-5xl h-[80vh] bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Library className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">从资产库调用图片</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Image from Library</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs and Search */}
        <div className="px-8 py-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center p-1.5 bg-gray-100 rounded-2xl w-fit">
            <button 
              onClick={() => setActiveTab('assets')}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                activeTab === 'assets' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Library className="w-4 h-4" />
              <span>当前项目资产</span>
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                activeTab === 'history' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <History className="w-4 h-4" />
              <span>生成历史记录</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="搜索图片名称或关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 bg-gray-50 border border-gray-100 rounded-2xl pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {filteredImages.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredImages.map((img, idx) => (
                  <motion.div
                    key={`${img.url}-${idx}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -4 }}
                    onClick={() => onSelect(img.url)}
                    className="group cursor-pointer space-y-3"
                  >
                    <div className="relative aspect-square rounded-3xl overflow-hidden bg-gray-100 border border-gray-100 shadow-sm group-hover:shadow-xl group-hover:shadow-blue-600/10 transition-all">
                      <img 
                        src={img.url} 
                        alt={img.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                      </div>
                      <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[9px] font-black text-blue-600 uppercase tracking-wider shadow-sm">
                        {img.source}
                      </div>
                    </div>
                    <div className="px-1">
                      <p className="text-[12px] font-bold text-gray-700 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {img.name}
                      </p>
                      <div className="flex items-center space-x-1.5 mt-1">
                        <Clock className="w-3 h-3 text-gray-300" />
                        <span className="text-[10px] font-medium text-gray-400">
                          {new Date(img.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-40">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-gray-300" />
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-gray-900">未找到相关图片</p>
                <p className="text-sm font-bold text-gray-400 mt-1">尝试更换搜索词或切换分类</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-center">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            共找到 {filteredImages.length} 张可用图片
          </p>
        </div>
      </motion.div>
    </div>
  );
};
