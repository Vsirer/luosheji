import React, { useState, useEffect } from 'react';
import { IntentPlan, IntentStep } from '../../services/intentEngine';
import { X, Save, Edit2, Trash2, Plus, GripVertical } from 'lucide-react';

interface PipelineTuningModalProps {
  initialPlan: IntentPlan;
  onSave: (updatedPlan: IntentPlan) => void;
  onClose: () => void;
}

export const PipelineTuningModal: React.FC<PipelineTuningModalProps> = ({ initialPlan, onSave, onClose }) => {
  const [plan, setPlan] = useState<IntentPlan>(initialPlan);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  // We need local state for the step currently being edited
  const [editForm, setEditForm] = useState<Partial<IntentStep>>({});

  const handleEditClick = (step: IntentStep) => {
    setEditingStepId(step.id);
    setEditForm(step);
  };

  const handleSaveStep = () => {
    if (!editingStepId) return;
    setPlan(prev => {
      const updatedSteps = (prev.steps || []).map(s => s.id === editingStepId ? { ...s, ...editForm } as IntentStep : s);
      return { ...prev, steps: updatedSteps };
    });
    setEditingStepId(null);
    setEditForm({});
  };

  const handleDeleteStep = (id: string) => {
    if (confirm('确定要删除这个步骤吗？')) {
      setPlan(prev => {
        const updatedSteps = (prev.steps || []).filter(s => s.id !== id);
        return { ...prev, steps: updatedSteps };
      });
    }
  };

  const handleToggleEnable = (id: string) => {
    setPlan(prev => {
      const updatedSteps = (prev.steps || []).map(s => s.id === id ? { ...s, enabled: s.enabled === false ? true : false } as any : s);
      return { ...prev, steps: updatedSteps };
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setPlan(prev => {
      const steps = [...(prev.steps || [])];
      if (direction === 'up' && index > 0) {
        [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];
      } else if (direction === 'down' && index < steps.length - 1) {
        [steps[index], steps[index + 1]] = [steps[index + 1], steps[index]];
      }
      return { ...prev, steps };
    });
  };

  const handleAddStep = () => {
    const newStep: IntentStep = {
      id: `step_custom_${Date.now()}`,
      type: 'script',
      label: '自定义步骤',
      prompt: '请输入提示词...',
      status: 'pending'
    };
    setPlan(prev => ({
      ...prev,
      steps: [...(prev.steps || []), newStep]
    }));
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-indigo-50/30">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">⚙️</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">小逻意图流水线执行计划 - 全局微调</h2>
              <p className="text-xs text-gray-500 mt-0.5">您可在此调整执行步骤、修改提示词并重新编排工作流</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl">
            <h3 className="text-sm font-bold text-gray-800 mb-2">执行引擎分析结论</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{plan.rationale}</p>
          </div>

          <div className="space-y-4">
            {plan.steps?.map((step: any, index) => (
              <div key={step.id} className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${step.enabled === false ? 'opacity-50 border-gray-200' : 'border-indigo-100 hover:border-indigo-300'}`}>
                {editingStepId === step.id ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1">步骤名称</label>
                        <input
                          type="text"
                          value={editForm.label || ''}
                          onChange={e => setEditForm({ ...editForm, label: e.target.value })}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div className="w-48">
                        <label className="block text-xs font-bold text-gray-700 mb-1">类型</label>
                        <select
                          value={editForm.type || 'script'}
                          onChange={e => setEditForm({ ...editForm, type: e.target.value as any })}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                          <option value="script">✍️ 文本/策略 (Script)</option>
                          <option value="image">🎨 图像/原画 (Image)</option>
                          <option value="video">🎬 视频合成 (Video)</option>
                          <option value="code">💻 代码执行沙箱 (Code)</option>
                          <option value="ui">✨ 生成式UI (UI)</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">执行提示词 / Prompt</label>
                      <textarea
                        value={editForm.prompt || ''}
                        onChange={e => setEditForm({ ...editForm, prompt: e.target.value })}
                        rows={4}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                        placeholder="输入提示词..."
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-2">
                      <button onClick={() => setEditingStepId(null)} className="px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                      <button onClick={handleSaveStep} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm">保存修改</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start">
                    <div className="flex flex-col items-center space-y-2 mr-4">
                      <button onClick={() => moveStep(index, 'up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-400"><GripVertical className="w-4 h-4 rotate-90" /></button>
                      <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center">{index + 1}</span>
                      <button onClick={() => moveStep(index, 'down')} disabled={index === (plan.steps?.length || 0) - 1} className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-400"><GripVertical className="w-4 h-4 rotate-90" /></button>
                    </div>
                    
                    <div className="flex-1 pt-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-lg">
                          {step.type === 'script' ? '✍️' : step.type === 'image' ? '🎨' : step.type === 'video' ? '🎬' : step.type === 'code' ? '💻' : step.type === 'ui' ? '✨' : '⚙️'}
                        </span>
                        <h4 className={`text-sm font-bold ${step.enabled === false ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{step.label}</h4>
                      </div>
                      <p className={`text-sm mt-2 whitespace-pre-wrap ${step.enabled === false ? 'text-gray-400' : 'text-gray-600'}`}>{step.prompt}</p>
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => handleToggleEnable(step.id)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${step.enabled === false ? 'border-gray-200 text-gray-500 hover:bg-gray-100' : 'border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100'}`}
                      >
                        {step.enabled === false ? '取消跳过' : '标记跳过'}
                      </button>
                      <button onClick={() => handleEditClick(step)} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center space-x-1">
                        <Edit2 className="w-3.5 h-3.5" /> <span>编辑</span>
                      </button>
                      <button onClick={() => handleDeleteStep(step.id)} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-100 text-red-600 hover:bg-red-50 flex items-center justify-center space-x-1">
                        <Trash2 className="w-3.5 h-3.5" /> <span>删除</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            <button
              onClick={handleAddStep}
              className="w-full py-4 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-600 font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-colors flex items-center justify-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>添加自定义执行步骤</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-gray-100 flex justify-end space-x-3">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors">
            取消
          </button>
          <button 
            onClick={() => onSave(plan)}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-colors flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>添加至画布</span>
          </button>
        </div>
      </div>
    </div>
  );
};
