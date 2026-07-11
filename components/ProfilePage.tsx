import React, { useState, useEffect } from 'react';
import { User, Shield, Key, Coins, LogOut, ChevronLeft, ChevronRight, RefreshCw, Copy as CopyIcon, Check, Edit2, X, Hash, Image, Video, FileText, ExternalLink, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { safeJson } from '../lib/fetch';

interface ProfilePageProps {
  onLogout: () => void;
  onUserUpdate?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onLogout, onUserUpdate }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [updatingUsername, setUpdatingUsername] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [pointsHistory, setPointsHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await safeJson(res);
      if (data) {
        setProfile(data);
        setTempUsername(data.username);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPointsHistory = async (page = 1) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/user/points-history?page=${page}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await safeJson(res);
      if (data && data.records && Array.isArray(data.records)) {
        setPointsHistory(data.records);
        setCurrentPage(data.pagination.page);
        setTotalPages(data.pagination.totalPages);
        setTotalRecords(data.pagination.total);
      } else {
        setPointsHistory([]);
        setCurrentPage(1);
        setTotalPages(1);
        setTotalRecords(0);
      }
    } catch (err) {
      console.error('获取积分变化失败:', err);
      setPointsHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUsername.trim() || tempUsername === profile?.username) {
      setEditingUsername(false);
      return;
    }

    setUpdatingUsername(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ username: tempUsername })
      });
      const data = await safeJson(res);
      if (res.ok) {
        setProfile((prev: any) => ({ ...prev, username: tempUsername }));
        if (onUserUpdate) onUserUpdate();
        setEditingUsername(false);
      } else {
        alert(data?.error || '更新失败');
      }
    } catch (err) {
      alert('更新失败');
    } finally {
      setUpdatingUsername(false);
    }
  };

  const handleGenerateCodes = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/invitation-codes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ count: 10 })
      });
      const data = await safeJson(res);
      if (res.ok) {
        fetchProfile();
      } else {
        alert(data?.error || '生成失败');
      }
    } catch (err) {
      alert('生成失败');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchPointsHistory();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    if (newPassword !== confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }
    setChanging(true);
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await safeJson(res);
      if (res.ok) {
        alert('密码修改成功');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert(data?.error || '修改失败');
      }
    } catch (err) {
      alert('修改失败');
    } finally {
      setChanging(false);
    }
  };

  const renderPagination = () => {
    const range = [];
    const maxPages = Math.min(100, totalPages);
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(maxPages, currentPage + 2);
    
    if (currentPage <= 3) {
      endPage = Math.min(5, maxPages);
    }
    if (currentPage >= maxPages - 2) {
      startPage = Math.max(1, maxPages - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      range.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-zinc-100">
        <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-2">
          <span>共 <strong className="font-semibold text-zinc-800">{totalRecords}</strong> 条记录</span>
          <span className="text-zinc-300">•</span>
          <span>当前第 <strong className="font-semibold text-zinc-800">{currentPage}</strong> / <strong className="font-semibold text-zinc-800">{maxPages}</strong> 页</span>
          <span className="text-zinc-300">•</span>
          <span className="text-amber-600/95 bg-amber-50/70 border border-amber-200/50 px-2 py-0.5 rounded font-medium text-[10px] tracking-wide">
            仅保存近 30 天记录
          </span>
        </div>
        
        <div className="flex items-center gap-1 flex-wrap font-sans">
          <button
            type="button"
            disabled={currentPage === 1 || loadingHistory}
            onClick={() => fetchPointsHistory(1)}
            className="px-2 py-1 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            首页
          </button>
          
          <button
            type="button"
            disabled={currentPage === 1 || loadingHistory}
            onClick={() => fetchPointsHistory(currentPage - 1)}
            className="p-1 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="上一页"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {startPage > 1 && (
            <>
              <button
                type="button"
                disabled={loadingHistory}
                onClick={() => fetchPointsHistory(1)}
                className={`w-7 h-7 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  currentPage === 1
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                1
              </button>
              {startPage > 2 && <span className="text-zinc-400 px-0.5 text-xs">...</span>}
            </>
          )}

          {range.map((p) => (
            <button
              key={p}
              type="button"
              disabled={loadingHistory}
              onClick={() => fetchPointsHistory(p)}
              className={`w-7 h-7 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                currentPage === p
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {p}
            </button>
          ))}

          {endPage < maxPages && (
            <>
              {endPage < maxPages - 1 && <span className="text-zinc-400 px-0.5 text-xs">...</span>}
              <button
                type="button"
                disabled={loadingHistory}
                onClick={() => fetchPointsHistory(maxPages)}
                className={`w-7 h-7 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  currentPage === maxPages
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {maxPages}
              </button>
            </>
          )}

          <button
            type="button"
            disabled={currentPage === maxPages || loadingHistory}
            onClick={() => fetchPointsHistory(currentPage + 1)}
            className="p-1 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="下一页"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            disabled={currentPage === maxPages || loadingHistory}
            onClick={() => fetchPointsHistory(maxPages)}
            className="px-2 py-1 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            尾页
          </button>
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-full">加载中...</div>;

  return (
    <div className="h-full overflow-y-auto scroll-smooth custom-scrollbar">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold">个人中心</h1>
          <p className="text-gray-500 mt-1">管理您的账户和邀请码</p>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Info Card */}
        <div className="md:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-black/5">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 bg-zinc-100 rounded-2xl flex items-center justify-center">
              <User className="w-10 h-10 text-zinc-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {editingUsername ? (
                  <form onSubmit={handleUpdateUsername} className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={tempUsername}
                      onChange={e => setTempUsername(e.target.value)}
                      className="text-2xl font-bold bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                    <button 
                      type="submit" 
                      disabled={updatingUsername}
                      className="p-1.5 bg-black text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      {updatingUsername ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingUsername(false);
                        setTempUsername(profile?.username);
                      }}
                      className="p-1.5 bg-zinc-100 text-zinc-600 rounded-lg hover:bg-zinc-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold">{profile?.username}</h2>
                    <button 
                      onClick={() => setEditingUsername(true)}
                      className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
                      title="修改用户名"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                <p className="text-gray-500 flex items-center gap-1 text-sm">
                  <Hash className="w-3.5 h-3.5" />
                  UID: {profile?.id}
                </p>
                <p className="text-gray-500 flex items-center gap-1 text-sm">
                  <Shield className="w-3.5 h-3.5" />
                  {profile?.role === 'admin' ? '超级管理员' : profile?.role === 'leader' ? '基地组长' : '正式会员'}
                </p>
              </div>
              {profile?.teamInfo?.leaderName && (
                <p className="text-blue-600 text-xs font-medium mt-1 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  所属团队: {profile.teamInfo.leaderName}
                </p>
              )}
            </div>
          </div>

          <div className={`grid ${profile?.role === 'admin' || profile?.teamInfo ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            <div className="p-6 bg-zinc-50 rounded-2xl border border-black/5">
              <div className="flex items-center gap-3 text-zinc-500 mb-2">
                <Coins className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wider">个人积分</span>
              </div>
              <div className="text-3xl font-serif font-bold">{profile?.points}</div>
            </div>
            
            {profile?.teamInfo?.teamPoints !== undefined && (
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-3 text-blue-500 mb-2">
                  <Coins className="w-5 h-5" />
                  <span className="text-sm font-medium uppercase tracking-wider">团队共享积分</span>
                </div>
                <div className="text-3xl font-serif font-bold text-blue-900">{profile.teamInfo.teamPoints}</div>
                <p className="text-[10px] text-blue-600 mt-1 font-medium">优先消耗团队积分</p>
              </div>
            )}

            {profile?.role === 'leader' && profile?.teamInfo?.memberCount !== undefined && (
              <div className="p-6 bg-zinc-50 rounded-2xl border border-black/5">
                <div className="flex items-center gap-3 text-zinc-500 mb-2">
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium uppercase tracking-wider">团队人数</span>
                </div>
                <div className="text-3xl font-serif font-bold">
                  {profile.teamInfo.memberCount} / {profile.teamInfo.maxMembers}
                </div>
              </div>
            )}

            {(profile?.role === 'admin' || profile?.role === 'leader') && (
              <div className="p-6 bg-zinc-50 rounded-2xl border border-black/5">
                <div className="flex items-center gap-3 text-zinc-500 mb-2">
                  <Key className="w-5 h-5" />
                  <span className="text-sm font-medium uppercase tracking-wider">可用邀请码</span>
                </div>
                <div className="text-3xl font-serif font-bold">
                  ∞
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
          <h3 className="text-xl font-bold mb-6">修改密码</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">新密码</label>
              <input
                type="password"
                required
                placeholder="输入新密码"
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">确认新密码</label>
              <input
                type="password"
                required
                placeholder="再次输入新密码"
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={changing}
              className="w-full py-3 bg-black text-white rounded-xl font-bold hover:bg-zinc-800 transition-all disabled:opacity-50"
            >
              {changing ? '更新中...' : '确认修改'}
            </button>
          </form>
        </div>
      </div>

      {/* Invitation Codes Section (Admin & Leader) */}
      {(profile?.role === 'admin' || profile?.role === 'leader') && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-serif font-bold">我的邀请码</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleGenerateCodes}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-zinc-800 transition-colors text-sm font-bold disabled:opacity-50"
              >
                {generating ? '生成中...' : '批量生成 (10个)'}
              </button>
              <button 
                onClick={fetchProfile}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {profile?.invitationCodes?.filter((c: any) => c.current_uses < c.max_uses).map((code: any, idx: number) => (
              <button 
                key={idx}
                onClick={() => handleCopyCode(code.code)}
                className="p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all relative group bg-white border-black/10 hover:border-black/30 shadow-sm hover:shadow-md active:scale-95"
              >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {copiedCode === code.code ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <CopyIcon className="w-3 h-3 text-zinc-400" />
                  )}
                </div>
                <AnimatePresence>
                  {copiedCode === code.code && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-[10px] rounded-md font-bold whitespace-nowrap"
                    >
                      已复制!
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className="font-mono font-bold tracking-widest text-black">
                  {code.code}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-tighter text-zinc-400">
                  未使用
                </span>
              </button>
            ))}
          </div>
          
          <div className="mt-8 p-6 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900">邀请规则</h4>
              <p className="text-sm text-amber-800/70 mt-1 leading-relaxed">
                作为{profile?.role === 'admin' ? '超级管理员' : '基地组长'}，您可以生成无限数量的邀请码。请点击上方按钮进行批量生成。
                {profile?.role === 'leader' && " 使用您的邀请码注册的用户将自动加入您的团队。"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 积分使用情况统计 Table Section (图1) */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-serif font-bold">积分消耗记录</h3>
            <p className="text-gray-500 mt-1 text-sm">
              统计您自己使用积分的情况以及具体功能明细
            </p>
          </div>
          <button 
            type="button"
            onClick={() => {
              fetchPointsHistory(currentPage);
            }}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            title="刷新数据"
          >
            <RefreshCw className={`w-5 h-5 text-zinc-400 ${loadingHistory ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-12 text-zinc-400 font-medium">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            加载消耗明细中...
          </div>
        ) : pointsHistory.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
            暂无积分消耗记录
          </div>
        ) : (
          <>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[850px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-zinc-400 font-semibold pb-4">
                    <th className="py-3 px-2 whitespace-nowrap">任务ID</th>
                    <th className="py-3 px-4 whitespace-nowrap">发起时间</th>
                    <th className="py-3 px-4 whitespace-nowrap">任务名称</th>
                    <th className="py-3 px-4 whitespace-nowrap">对应资产</th>
                    <th className="py-3 px-4 whitespace-nowrap">状态</th>
                    <th className="py-3 px-4 whitespace-nowrap">时长</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">积分</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {pointsHistory.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3.5 px-2 font-mono text-xs text-zinc-500 flex items-center gap-1.5 whitespace-nowrap">
                        <span>{typeof item.taskId === 'object' ? JSON.stringify(item.taskId) : String(item.taskId || '')}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const idStr = typeof item.taskId === 'object' ? JSON.stringify(item.taskId) : String(item.taskId || '');
                            navigator.clipboard.writeText(idStr);
                            setCopiedTaskId(item.taskId);
                            setTimeout(() => setCopiedTaskId(null), 2000);
                          }}
                          className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded transition-colors relative cursor-pointer"
                          title="复制任务ID"
                        >
                          {copiedTaskId === item.taskId ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <CopyIcon className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-500 text-xs whitespace-nowrap">
                        {(() => {
                          try {
                            if (!item.createdAt) return '-';
                            const dateVal = typeof item.createdAt === 'object' ? (item.createdAt.createdAt || item.createdAt.toString()) : item.createdAt;
                            const d = new Date(dateVal);
                            if (isNaN(d.getTime())) return String(dateVal);
                            return d.toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            }).replace(/\//g, '-');
                          } catch (e) {
                            return '-';
                          }
                        })()}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-800 whitespace-nowrap">
                        {typeof item.taskName === 'object' ? JSON.stringify(item.taskName) : String(item.taskName || '')}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.status === '失败' ? (
                          <span className="text-xs text-zinc-300 font-medium">—</span>
                        ) : item.asset ? (
                          (item.asset.type === 'video' || item.asset.videoUrl) ? (
                            <button
                              type="button"
                              onClick={() => setSelectedAsset(item.asset)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full text-violet-700 bg-violet-50/70 border border-violet-100 hover:bg-violet-100 hover:text-violet-800 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>视频资产</span>
                            </button>
                          ) : (item.asset.type === 'image' || item.asset.imageUrl) ? (
                            <button
                              type="button"
                              onClick={() => setSelectedAsset(item.asset)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full text-indigo-700 bg-indigo-50/70 border border-indigo-100 hover:bg-indigo-100 hover:text-indigo-800 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              <Image className="w-3.5 h-3.5" />
                              <span>图片资产</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedAsset(item.asset)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full text-slate-700 bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:text-slate-800 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>文本/对话</span>
                            </button>
                          )
                        ) : item.status === '进行中' ? (
                          <span className="text-xs text-blue-500 font-medium animate-pulse flex items-center gap-1 flex-row">
                            <RefreshCw className="w-3 h-3 animate-spin" /> 生成中...
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-350 font-medium select-none">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                             item.status === '成功' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                             item.status === '进行中' ? 'bg-blue-500 animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                           }`} />
                          <span className={`text-xs font-semibold ${
                             item.status === '成功' ? 'text-emerald-700' :
                             item.status === '进行中' ? 'text-blue-700' : 'text-rose-600 font-bold'
                           }`}>
                            {item.status}
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-zinc-500 whitespace-nowrap">
                        {typeof item.duration === 'object' ? JSON.stringify(item.duration) : String(item.duration || '-')}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-bold text-sm whitespace-nowrap ${
                        item.status === '失败' ? 'text-rose-600' :
                        item.type === 'points_refund' ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {item.status === '失败' ? '0' : (item.type === 'points_refund' ? '+' : '-')}{item.status === '失败' ? '' : (typeof item.amount === 'object' ? JSON.stringify(item.amount) : String(item.amount ?? ''))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </>
        )}
      </div>

      {/* Asset Preview Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/60">
                <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
                  {selectedAsset.imageUrl ? <Image className="w-5 h-5 text-indigo-500" /> :
                   selectedAsset.videoUrl ? <Video className="w-5 h-5 text-violet-500" /> :
                   <FileText className="w-5 h-5 text-slate-500" />}
                  <span>查看生成资产</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm select-text">
                {/* Visual Asset rendering */}
                {selectedAsset.imageUrl && (
                  <div className="flex flex-col items-center">
                    <div className="relative group rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 shadow-md max-w-full">
                      <img
                        src={selectedAsset.imageUrl}
                        alt="Asset preview"
                        className="max-h-[350px] object-contain cursor-zoom-in hover:scale-[1.01] transition-transform"
                        referrerPolicy="no-referrer"
                        onClick={() => window.open(selectedAsset.imageUrl, '_blank')}
                      />
                    </div>
                    <div className="flex gap-3 mt-4">
                      <a
                        href={selectedAsset.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 rounded-lg transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>在新标签页打开</span>
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const response = await fetch(selectedAsset.imageUrl);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `asset-${selectedAsset.id || 'image'}.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          } catch (err) {
                            window.open(selectedAsset.imageUrl, '_blank');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>下载图片</span>
                      </button>
                    </div>
                  </div>
                )}

                {selectedAsset.videoUrl && (
                  <div className="flex flex-col items-center">
                    <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-black shadow-md w-full max-w-lg aspect-video">
                      <video
                        src={selectedAsset.videoUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex gap-3 mt-4">
                      <a
                        href={selectedAsset.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 rounded-lg transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>在新标签页打开</span>
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const response = await fetch(selectedAsset.videoUrl);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `asset-${selectedAsset.id || 'video'}.mp4`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          } catch (err) {
                            window.open(selectedAsset.videoUrl, '_blank');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>下载视频</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Text prompts / custom metadata */}
                {selectedAsset.revisedPrompt && (
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/60">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">优化提示词 (Revised Prompt)</span>
                    <p className="text-zinc-700 text-xs font-mono bg-white p-3 rounded-lg border border-zinc-100 max-h-[150px] overflow-y-auto whitespace-pre-wrap leading-relaxed selection:bg-indigo-100 select-all">
                      {selectedAsset.revisedPrompt}
                    </p>
                  </div>
                )}

                {/* Original prompt / details */}
                {selectedAsset.config && (selectedAsset.config.prompt || selectedAsset.config.scriptText || selectedAsset.config.script) && (
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200/60">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">原始脚本/提示词 (Original Prompt/Text)</span>
                    <p className="text-zinc-700 text-xs font-mono bg-white p-3 rounded-lg border border-zinc-100 max-h-[150px] overflow-y-auto whitespace-pre-wrap leading-relaxed selection:bg-indigo-100 select-all">
                      {selectedAsset.config.prompt || selectedAsset.config.scriptText || selectedAsset.config.script}
                    </p>
                  </div>
                )}

                {!selectedAsset.imageUrl && !selectedAsset.videoUrl && !selectedAsset.revisedPrompt && !(selectedAsset.config && (selectedAsset.config.prompt || selectedAsset.config.scriptText || selectedAsset.config.script)) && (
                  <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200/60 text-center text-zinc-400">
                    暂无额外的视觉提示词或文本数据
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-100">
                  <span>记录ID: {selectedAsset.id || 'N/A'}</span>
                  <span>生成接口: {selectedAsset.type || 'N/A'}</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="px-5 py-2 text-xs font-semibold bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-xl transition-all cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
};
