import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleClearStorageAndReset = () => {
    try {
      const saved = localStorage.getItem("aistudio_canvases");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((canvas) => {
            if (canvas.id !== "default") {
              localStorage.removeItem(`aistudio_canvas_history_${canvas.id}`);
            }
          });
          const lightweight = parsed.map((canvas) => ({
            id: canvas.id,
            name: canvas.name,
            thumbnailUrl: canvas.thumbnailUrl,
            createdAt: canvas.createdAt,
            history: [],
          }));
          localStorage.setItem("aistudio_canvases", JSON.stringify(lightweight));
        }
      } else {
        localStorage.clear();
      }
      alert("本地浏览器空间优化成功！已腾出足够配额，即将自动重新载入。");
      this.setState({ hasError: false, error: null });
      window.location.reload();
    } catch (e) {
      alert("自动修复失败，建议手动清理浏览器缓存或使用无痕模式。");
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isQuotaError = this.state.error && (
        this.state.error.message?.includes("quota") ||
        this.state.error.name?.includes("Quota") ||
        this.state.error.message?.includes("setItem") ||
        this.state.error.message?.includes("Storage")
      );

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl border border-gray-100 p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">哎呀，出错了</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                应用程序遇到了一个意外错误。这可能是由于临时的网络波动并由于浏览器本地存储限制导致。
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-left">
                <p className="text-[10px] font-mono text-red-400 break-all line-clamp-4">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col space-y-3 pt-2">
              {isQuotaError ? (
                <button
                  onClick={this.handleClearStorageAndReset}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm flex items-center justify-center space-x-2 hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
                >
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>一键优化空间并重载</span>
                </button>
              ) : (
                <button
                  onClick={this.handleReset}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm flex items-center justify-center space-x-2 hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>重新加载页面</span>
                </button>
              )}
              
              <button
                onClick={this.handleGoHome}
                className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm flex items-center justify-center space-x-2 hover:bg-gray-200 transition-all active:scale-95"
              >
                <Home className="w-4 h-4" />
                <span>返回首页</span>
              </button>
            </div>

            <p className="text-[10px] text-gray-400">
              如果问题持续存在，请联系技术支持。
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
