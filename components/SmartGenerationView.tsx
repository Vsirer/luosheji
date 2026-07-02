import React, { useState } from 'react';
import { motion } from 'motion/react';
import { SmartImageGenerator } from './WORKFLOW';
import { Config, SmartImageConfig, SmartVideoConfig, HistoryItem, CameraParams, Asset } from '../types';

interface SmartGenerationViewProps {
  config: Config;
  mainTab: 'image' | 'video' | 'director' | 'script';
  setMainTab: (tab: any, data?: any) => void;
  history: HistoryItem[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  imageConfig: SmartImageConfig;
  setImageConfig: React.Dispatch<React.SetStateAction<SmartImageConfig>>;
  videoConfig: SmartVideoConfig;
  setVideoConfig: React.Dispatch<React.SetStateAction<SmartVideoConfig>>;
  cameraParams: CameraParams | undefined;
  setCameraParams: React.Dispatch<React.SetStateAction<CameraParams | undefined>>;
  initialData?: HistoryItem | null;
  deductPoints: (amount: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  refundPoints?: (amount: number, reason: string) => Promise<boolean>;
  userPoints: number;
  onNavigate?: (tab: 'director' | 'image' | 'video' | 'tasks' | 'profile' | 'mycompany' | 'script', data?: any) => void;
  user?: any;
  projectAssets?: Asset[];
  isCollaborationTabActive?: boolean;
}

export const SmartGenerationView: React.FC<SmartGenerationViewProps> = ({
  config,
  mainTab,
  setMainTab,
  history,
  setHistory,
  imageConfig,
  setImageConfig,
  videoConfig,
  setVideoConfig,
  cameraParams,
  setCameraParams,
  initialData = null,
  deductPoints,
  refundPoints,
  userPoints,
  onNavigate,
  user,
  projectAssets = [],
  isCollaborationTabActive = false
}) => {
  const handleModeChange = React.useCallback((m: 'image' | 'video' | 'director' | 'script') => {
    if (onNavigate) {
      onNavigate(m);
    } else {
      setMainTab(m);
    }
  }, [setMainTab, onNavigate]);

  return (
    <motion.div
      key="canvas"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full flex flex-col"
    >
      <SmartImageGenerator 
        config={config} 
        imageConfig={imageConfig}
        setImageConfig={setImageConfig}
        videoConfig={videoConfig}
        setVideoConfig={setVideoConfig}
        history={history}
        setHistory={setHistory}
        cameraParams={cameraParams}
        setCameraParams={setCameraParams}
        mode={mainTab as 'image' | 'video' | 'director' | 'script'}
        onModeChange={handleModeChange}
        onNavigate={onNavigate || setMainTab}
        initialData={initialData}
        deductPoints={deductPoints}
        refundPoints={refundPoints}
        userPoints={userPoints}
        user={user}
        projectAssets={projectAssets}
        isCollaborationTabActive={isCollaborationTabActive}
      />
    </motion.div>
  );
};
