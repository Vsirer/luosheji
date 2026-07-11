import React, { useState } from 'react';
import { 
  Camera, 
  X, 
  Check,
  Sun,
  Palette,
  Zap,
  Box,
  Monitor,
  Search,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CameraParams } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CameraControlProps {
  onClose: () => void;
  onConfirm: (params: CameraParams) => void;
  initialParams?: CameraParams;
  isEmbedded?: boolean;
}

const CAMERA_MODELS = [
  // 表格新增
  { id: 'full-frame-digital', name: '全画幅电影级数码相机', desc: '数码类型', img: 'https://picsum.photos/seed/digital/200/150' },
  { id: 'large-format-70mm', name: '大画幅 70 毫米胶片相机', desc: '胶片类型', img: 'https://picsum.photos/seed/film70/200/150' },
  { id: 's35-digital', name: 'S35 画幅数码影棚相机', desc: '数码类型', img: 'https://picsum.photos/seed/s35/200/150' },
  { id: 'classic-16mm', name: '经典 16 毫米胶片相机', desc: '胶片类型', img: 'https://picsum.photos/seed/film16/200/150' },
  { id: 'high-end-large-digital', name: '高端大画幅数码相机', desc: '胶片类型', img: 'https://picsum.photos/seed/highlarge/200/150' },
  // 原有保留
  { id: 'sony-venice', name: 'Sony Venice', desc: '纯净数字质感、高分辨率', img: 'https://picsum.photos/seed/sony/200/150' },
  { id: 'arri-alexa-35', name: 'Arri Alexa 35', desc: '电影级调色、柔和高光过渡', img: 'https://picsum.photos/seed/arri35/200/150' },
  { id: 'arri-alexa-65', name: 'ARRI Alexa65', desc: '大幅幅、超写实电影静帧', img: 'https://picsum.photos/seed/arri65/200/150' },
  { id: 'red-v-raptor', name: 'Red V-Raptor', desc: '高对比度、画面锐利清晰', img: 'https://picsum.photos/seed/red/200/150' },
  { id: 'panavision-dxl2', name: 'Panavision DXL2', desc: '经典好莱坞电影画风', img: 'https://picsum.photos/seed/pana/200/150' },
  { id: 'arricam-lt', name: 'Arricam LT', desc: '胶片颗粒自然、光源边缘泛红、高色密度', img: 'https://picsum.photos/seed/arricam/200/150' },
  { id: 'arriflex-435', name: 'Arriflex 435', desc: '中颗粒胶片、高动态范围、色彩浓郁', img: 'https://picsum.photos/seed/arri435/200/150' },
  { id: 'imax-keighley', name: 'IMAX Keighley', desc: '极致分辨率、史诗级光影、超浅景深', img: 'https://picsum.photos/seed/imaxk/200/150' },
  { id: 'imax', name: 'IMAX', desc: '高解析度、细腻胶片颗粒', img: 'https://picsum.photos/seed/imax/200/150' },
];

const LENS_TYPES = [
  '无特定镜头',
  '创意移轴镜头（球面类型）',
  '紧凑型变形宽银幕镜头（变形宽银幕类型）',
  '超微距镜头（球面类型）',
  '70 年代风格电影定焦镜头（球面类型）',
  '经典变形宽银幕镜头（变形宽银幕类型）',
  '高端现代定焦镜头（球面类型）',
  '暖调电影定焦镜头（球面类型）',
  '旋焦散景人像镜头（球面类型）',
  '复古定焦镜头（球面类型）',
  '光晕弥散镜头镜头（变形宽银幕）'
];

const FOCAL_LENGTHS = [
  '自动', '8 毫米', '14 毫米', '35 毫米', '50 毫米', '85 毫米', '135 毫米'
];

const APERTURES = [
  '自动', 'f/1.4', 'f/1.8', 'f/2.8', 'f/4.0', 'f/5.6', 'f/8.0', 'f/11', 'f/16'
];

const COLOR_TONES = [
  '默认', '温暖的', '凉爽的', '混合', '饱和', '去饱和', '红色的', '橙子', '黄色的', '绿色的', '青色', '蓝色的', '紫色', '品红', '粉色的', '白色的', '棕褐色', '黑白'
];

const LIGHTING_OPTIONS = [
  '默认', '柔光', '硬光', '高对比度', '低对比度', '轮廓', '顶灯', '底光', '侧灯', '背光', '边缘光'
];

const LIGHTING_TYPES = [
  '默认', '日光', '阳光明媚', '灰蒙蒙', '月光', '人造光', '实用照明', '荧光', '火光', '混合光'
];

export const CameraControl: React.FC<CameraControlProps> = ({ onClose, onConfirm, initialParams, isEmbedded = false }) => {
  const [params, setParams] = useState<CameraParams>(initialParams || {
    model: '全画幅电影级数码相机',
    lensType: '无特定镜头',
    focalLength: '自动',
    aperture: '自动',
    colorTone: '默认',
    lighting: '默认',
    lightingType: '默认'
  });

  const renderInner = () => (
    <div className={cn(
      "flex flex-col overflow-hidden text-gray-800 bg-white w-full",
      isEmbedded ? "h-[380px] rounded-xl" : "h-full max-h-[80vh]"
    )}>
      {/* Header */}
      {!isEmbedded && (
        <div className="h-16 border-b border-gray-100 flex items-center justify-between px-8 shrink-0 bg-gray-50/50">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-purple-100 rounded-xl text-purple-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">相机调整</h2>
              <p className="text-sm text-gray-500 font-medium">配置专业级拍摄参数</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      <div className={cn(
        "flex-1 overflow-y-auto no-scrollbar",
        isEmbedded ? "p-3 space-y-4" : "p-8 space-y-10"
      )}>
          {/* Camera Models Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-gray-900">相机/机型</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {CAMERA_MODELS.map(cam => (
                <button 
                  key={cam.id}
                  onClick={() => setParams({...params, model: cam.name})}
                  className={cn(
                    "relative group rounded-2xl border transition-all overflow-hidden text-left",
                    params.model === cam.name 
                      ? "border-purple-500 bg-purple-50 ring-2 ring-purple-500/20" 
                      : "border-gray-100 hover:border-purple-200 bg-gray-50/50"
                  )}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden">
                    <img src={cam.img} alt={cam.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="p-3">
                    <h4 className="font-bold text-sm mb-0.5 text-gray-800 truncate">{cam.name}</h4>
                    <p className="text-xs text-gray-400 line-clamp-1">{cam.desc}</p>
                  </div>
                  {params.model === cam.name && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Lens Type Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">02 / 镜头类型 (LENS_TYPE)</h3>
            <div className="grid grid-cols-3 gap-2">
              {LENS_TYPES.map(lens => (
                <button 
                  key={lens}
                  onClick={() => setParams({...params, lensType: lens})}
                  className={cn(
                    "py-3 px-4 rounded-xl text-sm font-bold transition-all border text-left",
                    params.lensType === lens 
                      ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-200" 
                      : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                  )}
                >
                  {lens}
                </button>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-8">
            {/* Focal Length Section */}
            <section className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">03 / 焦段 (FOCAL)</h3>
              <div className="grid grid-cols-3 gap-2">
                {FOCAL_LENGTHS.map(focal => (
                  <button 
                    key={focal}
                    onClick={() => setParams({...params, focalLength: focal})}
                    className={cn(
                      "py-2.5 px-3 rounded-xl text-sm font-bold transition-all border",
                      params.focalLength === focal 
                        ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-200" 
                        : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    {focal}
                  </button>
                ))}
              </div>
            </section>

            {/* Aperture Section */}
            <section className="space-y-4">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">04 / 光圈 (APERTURE)</h3>
              <div className="grid grid-cols-3 gap-2">
                {APERTURES.map(aperture => (
                  <button 
                    key={aperture}
                    onClick={() => setParams({...params, aperture: aperture})}
                    className={cn(
                      "py-2.5 px-3 rounded-xl text-sm font-bold transition-all border",
                      params.aperture === aperture 
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-200" 
                        : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    {aperture}
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Color Tone Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">05 / 色调 (COLOR_TONE)</h3>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_TONES.map(tone => (
                <button 
                  key={tone}
                  onClick={() => setParams({...params, colorTone: tone})}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-sm font-bold transition-all border",
                    params.colorTone === tone 
                      ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-200" 
                      : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                  )}
                >
                  {tone}
                </button>
              ))}
            </div>
          </section>

          {/* Lighting Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">06 / 灯光 (LIGHTING)</h3>
            <div className="grid grid-cols-3 gap-2">
              {LIGHTING_OPTIONS.map(opt => (
                <button 
                  key={opt}
                  onClick={() => setParams({...params, lighting: opt})}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-sm font-bold transition-all border",
                    params.lighting === opt 
                      ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-200" 
                      : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </section>

          {/* Lighting Type Section */}
          <section className="space-y-4 pb-12">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">07 / 照明类型 (TYPES)</h3>
            <div className="grid grid-cols-3 gap-2">
              {LIGHTING_TYPES.map(type => (
                <button 
                  key={type}
                  onClick={() => setParams({...params, lightingType: type})}
                  className={cn(
                    "py-2.5 px-3 rounded-xl text-sm font-bold transition-all border",
                    params.lightingType === type 
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-200" 
                      : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </section>
        </div>

      {/* Footer Actions */}
      <div className={cn("bg-gray-50/80 border-t border-gray-100 shrink-0", isEmbedded ? "p-3" : "p-6")}>
        <button 
          onClick={() => onConfirm(params)}
          className={cn(
            "w-full bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center justify-center space-x-2 transition-all active:scale-95",
            isEmbedded ? "py-2.5 text-xs rounded-xl shadow-md" : "py-4 rounded-2xl shadow-xl shadow-purple-200"
          )}
        >
          <Camera className={cn(isEmbedded ? "w-4 h-4" : "w-5 h-5")} />
          <span>应用相机协议</span>
        </button>
      </div>
    </div>
  );

  if (isEmbedded) {
    return renderInner();
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-3xl bg-white/95 backdrop-blur-2xl rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/40 flex flex-col overflow-hidden text-gray-800 max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {renderInner()}
      </motion.div>
    </div>
  );
};
