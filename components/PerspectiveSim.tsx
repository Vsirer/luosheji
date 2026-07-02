import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  RotateCw, 
  Maximize2, 
  ArrowRight, 
  X, 
  Trash2, 
  Plus,
  Zap,
  Box,
  Compass,
  Layers,
  Monitor,
  Upload,
  Sparkles,
  Settings2,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { DirectorStage } from './DirectorStage';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PerspectiveSimProps {
  onClose: () => void;
  onGenerate: (params: PerspectiveParams) => void;
  initialImage?: string;
}

export interface PerspectiveParams {
  azimuth: number;
  elevation: number;
  distance: number;
  prompt: string;
  referenceImage?: string;
  stageParams?: {
    characters: any[];
    cameras: any[];
    activeCamId: string;
    cameraStats?: {
      azimuth: number;
      elevation: number;
      distance: number;
    };
    cinematicLabel?: string;
  };
}

export const PerspectiveSim: React.FC<PerspectiveSimProps> = ({ onClose, onGenerate, initialImage }) => {
  const [params, setParams] = useState<PerspectiveParams>({
    azimuth: 139,
    elevation: 11,
    distance: 4.0,
    prompt: '',
    referenceImage: initialImage,
    stageParams: {
      characters: [],
      cameras: [],
      activeCamId: ''
    }
  });

  useEffect(() => {
    if (initialImage) {
      setParams(prev => ({ ...prev, referenceImage: initialImage }));
    }
  }, [initialImage]);

  const [renderConfig, setRenderConfig] = useState([
    { label: '高精度渲染', icon: Zap, active: true, id: 'high-res' },
    { label: '光影追踪', icon: RotateCw, active: false, id: 'ray-tracing' },
    { label: '深度映射', icon: Layers, active: true, id: 'depth-map' },
    { label: '机位锁定', icon: Camera, active: true, id: 'cam-lock' },
  ]);

  const toggleConfig = (id: string) => {
    setRenderConfig(prev => prev.map(item => 
      item.id === id ? { ...item, active: !item.active } : item
    ));
  };

  const [isRendering, setIsRendering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setParams(prev => ({ ...prev, referenceImage: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = () => {
    setIsRendering(true);
    
    const currentAzi = params.stageParams?.cameraStats?.azimuth ?? params.azimuth;
    const currentEle = params.stageParams?.cameraStats?.elevation ?? params.elevation;
    const currentDist = params.stageParams?.cameraStats?.distance ?? params.distance;
    const cinematicLabel = params.stageParams?.cinematicLabel || '';
    
    // Split cinematic label into components
    const labels = cinematicLabel.split(' • ');
    const perspective = labels[0] || 'Perspective';
    const angle = labels[1] || 'Camera Angle';
    const shotType = labels[2] || 'Shot Type';

    // Construct the structured metadata as requested
    const structuredData = {
      camera_config: {
        perspective,
        angle,
        shot_type: shotType,
        azimuth: currentAzi,
        elevation: currentEle,
        distance: currentDist
      },
      characters: (params.stageParams?.characters || []).map((char: any) => ({
        id: char.id,
        name: char.type === 'advanced' ? '主角角色' : '群众演员',
        body_type: char.bodyStyle,
        kinematics: {
          head_tilt: char.joints.headPitch,
          torso_tilt: char.joints.torsoLean,
          l_arm_lift: char.joints.leftArmLift,
          r_arm_lift: char.joints.rightArmLift,
          step_length: char.joints.leftLegStep
        }
      })),
      user_prompt: params.prompt,
      render_settings: {
        high_res: renderConfig.find(c => c.id === 'high-res')?.active ?? false,
        depth_mapping: renderConfig.find(c => c.id === 'depth-map')?.active ?? false,
        ray_tracing_simulation: renderConfig.find(c => c.id === 'ray-tracing')?.active ?? false
      }
    };

    // Automated prompt concatenation logic (simulating the Python logic)
    const cameraPrompt = `${shotType}, ${angle}, ${perspective}`;
    const charDescriptions = structuredData.characters.map((char: any) => 
      `one character with ${char.body_type} body build`
    ).join(', ');
    
    const finalAutomatedPrompt = `${cameraPrompt}, ${params.prompt}, ${charDescriptions}, cinematic lighting, photorealistic, 8k`;

    const finalParams = {
      ...params,
      azimuth: currentAzi,
      elevation: currentEle,
      distance: currentDist,
      // Pass both the automated prompt and the raw metadata for the backend
      prompt: finalAutomatedPrompt,
      metadata: structuredData
    };

    // Simulate rendering delay
    setTimeout(() => {
      onGenerate(finalParams);
      setIsRendering(false);
    }, 1500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-[#06080f] flex flex-col overflow-hidden text-slate-100"
    >
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange} 
      />

      {/* Top Header */}
      <div className="h-16 border-b border-slate-800/50 bg-[#0a0b14] flex items-center justify-between px-6 shrink-0 relative z-30 shadow-2xl text-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            <Box className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tight text-white flex items-center">
              3D 导演台 <span className="mx-2 text-slate-700">/</span> DIRECTOR_STAGE
            </h1>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">3D Cinematic Director Stage</span>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4 bg-slate-900/50 px-4 py-2 rounded-2xl border border-slate-800/50">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">当前机位</span>
              <span className="text-[11px] font-black text-indigo-400">A-SHOT (MAIN)</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">渲染状态</span>
              <span className="text-[11px] font-black text-green-500 flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span>READY</span>
              </span>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-900 text-slate-500 hover:bg-red-500/10 hover:text-red-500 transition-all border border-slate-800/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-[#06080f]">
        <DirectorStage 
          onParamsChange={(stageParams) => setParams(prev => ({ ...prev, stageParams }))}
          referenceImage={params.referenceImage}
        />
      </div>
    </motion.div>
  );
};
