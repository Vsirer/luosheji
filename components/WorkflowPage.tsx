import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  Plus, 
  Layers, 
  FolderOpen,
  Calendar,
  AlertTriangle,
  Globe
} from 'lucide-react';

interface WorkflowPageProps {
  user: any;
}

export const WorkflowPage: React.FC<WorkflowPageProps> = ({ user }) => {
  const [localCanvases, setLocalCanvases] = useState<any[]>([]);
  const [sharedCanvases, setSharedCanvases] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const refreshLocalCanvases = () => {
    try {
      const saved = localStorage.getItem("aistudio_canvases");
      if (saved) {
        setLocalCanvases(JSON.parse(saved));
      } else {
        setLocalCanvases([]);
      }
    } catch (e) {
      console.error("Failed to load local canvases in WorkflowPage:", e);
    }
  };

  const fetchSharedCanvases = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/shared-canvases', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.canvases)) {
          setSharedCanvases(data.canvases);
        }
      }
    } catch (e) {
      console.error("Failed to fetch shared canvases:", e);
    }
  };

  useEffect(() => {
    refreshLocalCanvases();
    fetchSharedCanvases();
  }, []);

  const getCanvasItemCount = (canvas: any) => {
    const canvasId = canvas.id || "default";
    let historyList = canvas.history || [];
    
    if (historyList.length === 0) {
      try {
        const savedHist = localStorage.getItem(`aistudio_canvas_history_${canvasId}`);
        if (savedHist) {
          const parsed = JSON.parse(savedHist);
          if (Array.isArray(parsed)) {
            historyList = parsed;
          }
        }
      } catch (e) {}
    }
    
    const validItems = historyList.filter((h: any) => 
      ((h.canvasId || "default") === (canvasId || "default")) && 
      !h.hiddenFromCanvas && 
      h.position
    );
    return validItems.length;
  };

  const handleDeleteCanvas = async (canvasId: string) => {
    try {
      const isShared = sharedCanvases.some((c: any) => c.id === canvasId);
      if (isShared) {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/shared-canvases/${canvasId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          fetchSharedCanvases();
        } else {
          const errData = await res.json();
          alert(errData.error || "删除共享画布失败");
        }
      } else {
        const saved = localStorage.getItem("aistudio_canvases");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter((c: any) => c.id !== canvasId);
            localStorage.setItem("aistudio_canvases", JSON.stringify(updated));
            localStorage.removeItem(`aistudio_canvas_history_${canvasId}`);
            
            // If the deleted canvas was active, switch active back to default
            const activeId = localStorage.getItem("aistudio_active_canvas_id");
            if (activeId === canvasId) {
              localStorage.setItem("aistudio_active_canvas_id", "default");
              window.dispatchEvent(new CustomEvent('switch-to-canvas', { detail: { canvasId: 'default' } }));
            }
          }
        }
        refreshLocalCanvases();
      }
      setDeleteConfirmId(null);
    } catch (e) {
      console.error("Failed to delete canvas:", e);
    }
  };

  const handleAddCanvas = (canvas: any) => {
    try {
      const saved = localStorage.getItem("aistudio_canvases");
      let canvasesList: any[] = [];
      if (saved) {
        canvasesList = JSON.parse(saved);
      }
      
      const newCanvasId = "canvas_" + Date.now();
      
      // Get the history items for this canvas to copy over
      let originalHistory: any[] = canvas.history || [];
      if (originalHistory.length === 0) {
        try {
          const savedHist = localStorage.getItem(`aistudio_canvas_history_${canvas.id}`);
          if (savedHist) {
            const parsed = JSON.parse(savedHist);
            if (Array.isArray(parsed)) {
              originalHistory = parsed;
            }
          }
        } catch (e) {}
      }

      // Map the history items to the new canvasId
      const duplicatedHistory = originalHistory.map((item: any) => ({
        ...item,
        id: item.id ? `${item.id}_copy_${Math.random().toString(36).substring(2, 9)}` : undefined,
        canvasId: newCanvasId
      }));

      // Create new canvas structure
      const newCanvas = {
        id: newCanvasId,
        name: canvas.name === "默认创作" ? "添加画布" : `${canvas.name} (自制)`,
        thumbnailUrl: canvas.thumbnailUrl || null,
        createdAt: Date.now(),
        history: []
      };

      // Save duplicated history items to the specific key
      localStorage.setItem(`aistudio_canvas_history_${newCanvasId}`, JSON.stringify(duplicatedHistory));

      // Update canvases list
      const updatedList = [newCanvas, ...canvasesList];
      localStorage.setItem("aistudio_canvases", JSON.stringify(updatedList));

      // Set active canvas ID
      localStorage.setItem("aistudio_active_canvas_id", newCanvasId);

      // Notify the application
      window.dispatchEvent(new CustomEvent('switch-to-canvas', { detail: { canvasId: newCanvasId } }));
      window.dispatchEvent(new CustomEvent('switch-main-tab', { detail: { tab: 'space' } }));
    } catch (e) {
      console.error("Failed to add canvas:", e);
    }
  };

  const handleAddBlankCanvas = () => {
    try {
      const saved = localStorage.getItem("aistudio_canvases");
      let canvasesList: any[] = [];
      if (saved) {
        canvasesList = JSON.parse(saved);
      }
      
      const newCanvasId = "canvas_" + Date.now();
      const newCanvas = {
        id: newCanvasId,
        name: "添加画布",
        history: [],
        createdAt: Date.now(),
      };

      const updatedList = [newCanvas, ...canvasesList];
      localStorage.setItem("aistudio_canvases", JSON.stringify(updatedList));
      localStorage.setItem("aistudio_active_canvas_id", newCanvasId);

      window.dispatchEvent(new CustomEvent('switch-to-canvas', { detail: { canvasId: newCanvasId } }));
      window.dispatchEvent(new CustomEvent('switch-main-tab', { detail: { tab: 'space' } }));
    } catch (e) {
      console.error("Failed to add blank canvas:", e);
    }
  };

  const filteredCanvases = [
    ...(localCanvases.length > 0 ? localCanvases : [
      {
        id: "default",
        name: "默认创作",
        createdAt: Date.now(),
      }
    ]),
    ...sharedCanvases
  ].filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#fcfcfd]">
      {/* Sub header section */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex justify-end shrink-0 shadow-2xs">
        <div className="relative flex items-center w-full sm:w-64 md:w-72 group">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 transition-colors group-focus-within:text-indigo-500 pointer-events-none" />
          <input
            type="text"
            placeholder="搜索画布..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/40 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 focus:outline-none rounded-xl transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-2 mb-4">
            <FolderOpen className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold text-gray-800">创作画布列表</span>
            <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">
              {filteredCanvases.length} 个项目
            </span>
          </div>

          {filteredCanvases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 bg-white rounded-3xl border border-gray-100/80 max-w-xl mx-auto text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-4 shadow-sm shadow-indigo-100">
                <FolderOpen className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">没有找到匹配的画布</h3>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                未找到包含“{searchQuery}”的画布，请尝试其他搜索词。
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-6 px-4 py-2.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer"
              >
                清除搜索
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-6 animate-in fade-in duration-300">
              {filteredCanvases.map((canvas) => {
                const itemCount = getCanvasItemCount(canvas);
                
                return (
                  <div 
                    key={canvas.id}
                    className="w-full sm:w-[380px] p-5 bg-white border border-gray-100 rounded-2xl shadow-xs transition-all flex flex-col justify-between hover:shadow-md hover:translate-y-[-2px] min-h-[280px] shrink-0"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center min-w-0">
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center flex-wrap gap-1.5 leading-tight">
                              <span className="truncate">{canvas.name}</span>
                              {canvas.id === 'default' && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100/55 rounded-md shrink-0">
                                  官方默认
                                </span>
                              )}
                              {canvas.isShared && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100/55 rounded-md shrink-0">
                                  公开共享
                                </span>
                              )}
                            </h3>
                            <p className="text-[10px] text-gray-400 mt-1 flex items-center">
                              <span className="mr-1 text-gray-300">👤</span>
                              {canvas.isShared 
                                ? `分享者: ${canvas.creatorName}` 
                                : (canvas.id === 'default' ? '朱睿 开发团队' : '团队自制')}
                            </p>
                          </div>
                        </div>

                        {canvas.id !== 'default' && (!canvas.isShared || canvas.creatorId === user?.id || user?.role === 'admin') && (
                          <button
                            onClick={() => setDeleteConfirmId(canvas.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer shrink-0"
                            title="删除画布"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="text-[12px] text-gray-600 mt-4 leading-relaxed bg-gray-50/50 p-3.5 rounded-2xl border border-gray-100/40 min-h-[64px] block">
                        {canvas.isShared 
                          ? `由【${canvas.creatorName}】分享的创意设计工作流。包含完整编辑素材与节点图层，点击添加即可二次创作。`
                          : (canvas.id === 'default' 
                              ? '默认创作画布，提供零配额限制的创作与影视调度，即刻开启。' 
                              : `个性化工作流。包含已编辑的素材图层，方便随时二次编辑与影视生产。`)
                        }
                      </p>

                      <div className="mt-3 p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-400 flex items-center">
                            <Layers className="w-3 h-3 mr-1 text-gray-400" />
                            素材统计
                          </span>
                          <span className="font-bold text-indigo-600">{itemCount} 个素材</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-400 flex items-center">
                            <Calendar className="w-3 h-3 mr-1 text-gray-400" />
                            创建时间
                          </span>
                          <span className="text-gray-500">{new Date(canvas.createdAt || Date.now()).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-50 mt-5 pt-3.5">
                      <span className="text-[10px] text-gray-400 flex items-center font-semibold">
                        <Globe className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                        公开共享中
                      </span>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleAddCanvas(canvas)}
                          className="px-4 py-1.5 text-[11px] font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all cursor-pointer flex items-center space-x-1 shadow-sm shadow-indigo-100"
                        >
                          <Plus className="w-3 h-3" />
                          <span>添加画布</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100/80 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">确认删除该画布吗？</h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  您确定要永久删除此画布及其所有的历史记录和素材吗？此操作不可逆。
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end space-x-2.5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteCanvas(deleteConfirmId)}
                className="px-4 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all shadow-md shadow-red-100 cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
