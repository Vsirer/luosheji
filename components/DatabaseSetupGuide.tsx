import React from 'react';
import { Shield, AlertCircle, CheckCircle2, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface DatabaseSetupGuideProps {
  error: string;
  deniedIp?: string | null;
  onRetry: () => void;
}

export const DatabaseSetupGuide: React.FC<DatabaseSetupGuideProps> = ({ error, deniedIp, onRetry }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  return (
    <div className="min-h-screen bg-[#f5f2ed] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-white rounded-[32px] shadow-2xl overflow-hidden border border-black/5"
      >
        <div className="p-8 md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-zinc-900">数据库连接受阻</h1>
              <p className="text-zinc-500 font-sans">MySQL 拒绝了来自当前环境的连接请求</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 font-mono break-all">
                {error}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs">1</span>
                配置 IP 白名单 (关键步骤)
              </h2>
              <p className="text-zinc-600 text-sm mb-4 leading-relaxed">
                您的数据库（阿里云 RDS 或自建 MySQL）开启了安全防火墙。请将以下 IP 地址添加到数据库的白名单中：
              </p>
              <div className="flex items-center gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-100 group">
                <code className="flex-1 font-mono font-bold text-zinc-900">{deniedIp || '正在检测 IP...'}</code>
                {deniedIp && (
                  <button 
                    onClick={() => copyToClipboard(deniedIp)}
                    className="p-2 hover:bg-zinc-200 rounded-lg transition-colors text-zinc-400 hover:text-zinc-900"
                    title="复制 IP"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs">2</span>
                检查数据库凭据
              </h2>
              <p className="text-zinc-600 text-sm mb-4 leading-relaxed">
                请确保在 AI Studio 的 <b>Settings &gt; Secrets</b> 中正确配置了以下变量：
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">DB_USER</div>
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">DB_PASSWORD</div>
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">DB_HOST</div>
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">DB_NAME</div>
              </div>
            </section>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <button 
              onClick={onRetry}
              className="flex-1 py-4 bg-black text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <RefreshCw className="w-5 h-5" />
              已配置，重试连接
            </button>
            <a 
              href="https://help.aliyun.com/document_detail/26132.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
            >
              查看阿里云白名单教程
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          
          <p className="mt-6 text-center text-zinc-400 text-xs">
            配置完成后，点击“重试连接”即可进入应用。
          </p>
        </div>
      </motion.div>
    </div>
  );
};
