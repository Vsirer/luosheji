import React from 'react';
import { motion } from 'motion/react';
import { Film } from 'lucide-react';

interface Segment {
  id: string;
  duration: number;
}

interface Task {
  id: string;
  segments?: Segment[];
}

interface TimelineSwitcherProps {
  tasks: Task[];
  activeSegId: string | null;
  onSegmentClick: (id: string) => void;
}

export const TimelineSwitcher: React.FC<TimelineSwitcherProps> = ({ tasks, activeSegId, onSegmentClick }) => {
  const allSegments = tasks.flatMap(t => t.segments || []);
  
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-8">
      <div className="bg-white/80 backdrop-blur-2xl rounded-full border border-white/50 shadow-2xl p-2 flex items-center space-x-2 overflow-x-auto scrollbar-hide">
        {allSegments.map((seg, idx) => (
          <motion.button
            key={seg.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSegmentClick(seg.id)}
            className={`flex-shrink-0 h-12 px-6 rounded-full flex items-center space-x-2 transition-all ${
              activeSegId === seg.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                : 'bg-white text-gray-400 hover:bg-gray-50'
            }`}
          >
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${activeSegId === seg.id ? 'bg-white text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
              {idx + 1}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">片段 {idx + 1}</span>
            {activeSegId === seg.id && (
              <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 bg-white rounded-full ml-1" />
            )}
          </motion.button>
        ))}
        {allSegments.length === 0 && (
          <div className="flex-1 text-center py-2">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest px-10">暂无分段数据</p>
          </div>
        )}
      </div>
    </div>
  );
};
