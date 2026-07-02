
import React from 'react';
import { Step } from '../types';

interface Props {
  currentStep: Step;
  onStepClick?: (step: Step) => void;
  dataExists?: boolean;
}

export const StepIndicator: React.FC<Props> = ({ currentStep, onStepClick, dataExists }) => {
  const steps = [
    { id: Step.INPUT, label: '输入剧本' },
    { id: Step.GENERATING, label: '智能分析' },
    { id: Step.RESULT, label: '分段结果' }
  ];

  return (
    <div className="flex items-center justify-center space-x-4 mb-8">
      {steps.map((s, idx) => {
        const isActive = currentStep === s.id;
        const isPast = steps.findIndex(x => x.id === currentStep) > idx;
        const isClickable = onStepClick && (isPast || (dataExists && s.id === Step.RESULT));
        
        return (
          <React.Fragment key={s.id}>
            <div 
              className={`flex items-center space-x-2 ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}`}
              onClick={() => isClickable && onStepClick(s.id)}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isActive ? 'byted-primary text-white scale-110 shadow-md' : 
                isPast ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
              }`}>
                {isPast ? '✓' : idx + 1}
              </div>
              <span className={`text-sm ${isActive ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>{s.label}</span>
            </div>
            {idx < steps.length - 1 && <div className="w-12 h-px bg-gray-300"></div>}
          </React.Fragment>
        );
      })}
    </div>
  );
};
