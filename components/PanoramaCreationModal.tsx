import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Send, 
  Loader2, 
  Compass, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Palette,
  Plus,
  Zap,
  Box,
  Layers,
  RotateCcw
} from 'lucide-react';
import { PanoramaViewer } from './PanoramaViewer';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PanoramaCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, referenceImages?: any[], negativePrompt?: string) => Promise<string | null>;
  initialReferenceImages?: any[];
  initialPrompt?: string;
  isEmbedded?: boolean;
}

export const PanoramaCreationModal: React.FC<PanoramaCreationModalProps> = ({ isOpen, onClose, onGenerate, initialReferenceImages, initialPrompt, isEmbedded = false }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = React.useRef(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<any[]>([]);
  const [isFileDragging, setIsFileDragging] = useState(false);
  const [autoCorrectSeams, setAutoCorrectSeams] = useState(true);
  const [autoStraighten, setAutoStraighten] = useState(true);
  const [fourGridMode, setFourGridMode] = useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Initialize reference images from props and reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setGeneratedUrl(null);
      setError(null);
      
      if (initialReferenceImages && initialReferenceImages.length > 0) {
        setReferenceImages(initialReferenceImages);
      } else {
        setReferenceImages([]);
      }

      if (initialPrompt) {
        let cleanPrompt = initialPrompt;
        const panPrompt = '360度全景，等距柱状投影，无缝水平漫游，建筑写实摄影。场景：';
        if (cleanPrompt.startsWith(panPrompt)) {
          cleanPrompt = cleanPrompt.substring(panPrompt.length);
        }
        // Remove any '@图1' type references
        cleanPrompt = cleanPrompt.replace(/@图\d+/g, '').replace(/\s+/g, ' ').trim();
        setPrompt(cleanPrompt);
      } else {
        setPrompt('');
      }
    }
  }, [isOpen, initialReferenceImages, initialPrompt]);

  const combinedPrompt = React.useMemo(() => {
    const basePrompt = prompt.trim();
    
    // Core Panorama Control Formula (Priority: Trigger Words > Scene > Details > Quality)
    const triggerWords = "360度全景，等距柱状投影，无缝水平全景";
    
    let spatialConstraints = "建筑摄影，锐利焦点，8k 分辨率";
    
    if (autoStraighten) {
      spatialConstraints += "，无畸变极坐标逻辑，正确的天底与天顶透视，地板边缘直线几何";
    }
    
    if (autoCorrectSeams) {
      spatialConstraints += "，完美水平环绕，无可见接缝";
    }

    if (fourGridMode) {
      spatialConstraints += "，四宫格象限结构，多维细节增强，超高清纹理";
    }
    
    if (!basePrompt) return '';
    
    const sceneContent = basePrompt;
    return `${triggerWords}. 场景描述: ${sceneContent}. 视觉规格: ${spatialConstraints}. 沉浸式虚拟现实体验，逼真写实。`;
  }, [prompt, autoStraighten, autoCorrectSeams, fourGridMode]);

  const handleGenerate = async () => {
    const finalPrompt = combinedPrompt || (referenceImages.length > 0 ? "360度全景，等距投影，无缝全景图，VR 720 视角，高画质。" : "");
    
    if (!finalPrompt || isGenerating || generatingRef.current) return;
    
    generatingRef.current = true;
    
    // Standard Negative Prompt for Panoramas (Distortion & Seam Control)
    let processedNegative = "立方体贴图，3D 效果，非无缝，破裂接缝，错位透视，弯曲墙壁，弯曲地平线，鱼眼镜头，变形家具，模糊，低画质，糟糕的建筑，混乱反射，重叠图像，螺旋，水印，文字";
    let processedPrompt = finalPrompt;

    // Apply advanced "AI Repair" keywords if toggled
    if (autoCorrectSeams) {
      processedNegative += "，接缝，锐利线条，硬性切割，垂直线，失配光照，破碎瓷砖";
    }

    if (autoStraighten) {
      processedNegative += "，球面扭曲，极地畸变，天顶拉伸，天底收缩，螺旋扭曲，漩涡效应";
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedUrl(null);

    try {
      const url = await onGenerate(processedPrompt, referenceImages, processedNegative);
      if (url) {
        setGeneratedUrl(url);
      } else {
        setError('生成失败，请稍后重试');
      }
    } catch (err) {
      setError('发生错误，请检查网络连接');
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  };

  const removeReferenceImage = (id: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const processFiles = (files: File[]) => {
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        setReferenceImages(prev => [...prev, {
          id: Math.random().toString(36).substring(2, 9),
          data,
          mimeType: file.type,
          type: 'general'
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const handleReset = () => {
    setGeneratedUrl(null);
    setError(null);
  };

  const renderInner = () => (
    <div
      className={cn(
        "relative bg-white overflow-hidden flex flex-col md:flex-row transition-all duration-500 ease-in-out text-gray-800",
        isEmbedded 
          ? "w-full h-[380px] rounded-2xl border border-gray-100" 
          : ((isGenerating || generatedUrl) 
              ? "w-full max-w-4xl h-[80vh] md:h-[600px] rounded-[32px] shadow-2xl" 
              : "w-full max-w-md h-auto rounded-[32px] shadow-2xl")
      )}
      onClick={e => e.stopPropagation()}
    >
      {/* Left Side: Input & Controls */}
      <div className={cn(
        "flex flex-col w-full overflow-y-auto no-scrollbar",
        isEmbedded 
          ? "p-4 h-full" 
          : ((isGenerating || generatedUrl) ? "md:w-1/2 p-8 border-r border-gray-100 h-full" : "p-8")
      )}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Compass className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">VR全景世界</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">VR Panorama World</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
                <div 
                  className={`space-y-3 transition-all rounded-2xl p-2 ${isFileDragging ? 'bg-indigo-50 ring-2 ring-indigo-200 ring-dashed' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <label className="text-xs font-black text-gray-400 uppercase flex items-center space-x-2">
                    <ImageIcon className="w-3 h-3" />
                    <span>参考图 (可选)</span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-16 h-16 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all bg-white shadow-sm ${
                        isFileDragging ? 'border-indigo-400 text-indigo-400 bg-indigo-50' : 'border-gray-200 text-gray-400 hover:border-indigo-400 hover:text-indigo-500'
                      }`}
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-[8px] font-bold mt-1">上传</span>
                    </button>
                    {referenceImages.map((img, idx) => (
                      <div key={img.id} className="relative group">
                        <img 
                          src={img.data} 
                          className="w-16 h-16 object-cover rounded-2xl border border-gray-100 shadow-sm" 
                        />
                        <div className="absolute top-1 left-1 bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg shadow-lg">
                          @图{idx + 1}
                        </div>
                        <button
                          onClick={() => removeReferenceImage(img.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect}
                    className="hidden" 
                    accept="image/*" 
                    multiple 
                  />
                </div>

              </div>

              <div className="pt-6 mt-auto">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 rounded-xl flex items-center space-x-2 text-red-500 text-xs font-bold animate-shake">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-center space-x-4 py-4 mb-2 border-y border-gray-50 flex-wrap gap-y-2">
                  <button 
                    onClick={() => setAutoCorrectSeams(!autoCorrectSeams)}
                    className={cn(
                      "flex items-center space-x-2 px-2.5 py-1.5 rounded-xl transition-all border",
                      autoCorrectSeams ? "bg-orange-50 border-orange-200 text-orange-600" : "bg-gray-50 border-gray-100 text-gray-400"
                    )}
                  >
                    <Layers className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-wider">接缝修复</span>
                  </button>

                  <button 
                    onClick={() => setAutoStraighten(!autoStraighten)}
                    className={cn(
                      "flex items-center space-x-2 px-2.5 py-1.5 rounded-xl transition-all border",
                      autoStraighten ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-gray-50 border-gray-100 text-gray-400"
                    )}
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-wider">极点校正</span>
                  </button>

                  <button 
                    onClick={() => setFourGridMode(!fourGridMode)}
                    className={cn(
                      "flex items-center space-x-2 px-2.5 py-1.5 rounded-xl transition-all border",
                      fourGridMode ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-gray-50 border-gray-100 text-gray-400"
                    )}
                  >
                    <Box className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-wider">四宫格超清</span>
                  </button>
                </div>

                <div className="mb-4 bg-indigo-50/50 border border-indigo-100/50 p-3 rounded-2xl flex flex-col gap-1 text-left">
                  <div className="flex items-center gap-1.5 text-indigo-600 text-[11px] font-black uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>360°全景生图规范</span>
                  </div>
                  <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                    由于 VR 720° 预览需要环绕包裹 3D 球体，为防止天空和地平面模糊拉伸，系统强制以 **2:1 宽高比** 和 **4K 极清分辨率**（扣除 10 积分）进行渲染。
                  </p>
                  <p className="text-[9.5px] font-bold text-slate-400 italic">
                    * 提示：GPT-Image-2 (DALL-E) 仅支持标准的 1:1, 16:9 比例，仅有 **nano banana 2** 能够支持此类超宽全景渲染。
                  </p>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-4 rounded-2xl font-black text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all active:scale-95"
                  >
                    取消
                  </button>
                  {generatedUrl ? (
                    <div className="flex-[2] flex space-x-2">
                       <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="flex-1 py-4 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center justify-center space-x-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>重试</span>
                      </button>
                      <button
                        onClick={handleGenerate} 
                        disabled={isGenerating}
                        className="flex-[1.5] py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-orange-200 active:scale-95 flex items-center justify-center space-x-2"
                      >
                        <Layers className="w-5 h-5" />
                        <span>一键修复</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || (!prompt.trim() && referenceImages.length === 0)}
                      className={`flex-[2] py-4 rounded-2xl font-black text-sm flex items-center justify-center space-x-2 transition-all shadow-xl ${
                        (isGenerating || (!prompt.trim() && referenceImages.length === 0))
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-200'
                      }`}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>正在构建全景...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>开始生成 VR 全景</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: Preview/Status */}
            {(isGenerating || generatedUrl) && (
              <div className="w-full md:w-1/2 bg-gray-50 relative overflow-hidden flex items-center justify-center h-full">
                {generatedUrl ? (
                  <div className="absolute inset-0">
                    <PanoramaViewer 
                      imageUrl={generatedUrl} 
                      onClose={handleReset}
                      title="生成成功！点击下方按钮全屏漫游"
                      closeText="退出预览"
                    />
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
                      <button
                        onClick={() => {
                          // This would ideally trigger a full-screen view in the main app
                          onClose();
                        }}
                        className="px-6 py-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl text-indigo-600 font-black text-sm flex items-center space-x-2 hover:scale-105 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>保存并返回画布</span>
                      </button>
                    </div>
                  </div>
                ) : isGenerating ? (
                  <div className="text-center space-y-4">
                    <div className="relative">
                      <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                      <Compass className="w-8 h-8 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-gray-900">正在渲染球面投影...</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Rendering Equirectangular View</p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
    </div>
  );

  if (isEmbedded) {
    return renderInner();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        >
          {renderInner()}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
