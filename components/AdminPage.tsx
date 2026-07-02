import React, { useState, useEffect } from 'react';
import { 
  Search, 
  User, 
  Trash2, 
  Shield, 
  ShieldAlert, 
  ShieldCheck,
  Edit3, 
  Save, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Cloud,
  Database,
  Lock,
  Globe,
  HardDrive,
  Settings,
  BarChart3,
  TrendingUp,
  Zap,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Clapperboard,
  LogOut
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { ConfigModal } from './ConfigModal';
import { DEFAULT_CONFIG } from '../constants';
import { Config } from '../types';
import { safeJson } from '../lib/fetch';

interface AdminPageProps {
  onUserUpdate?: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onUserUpdate }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'database' | 'oss' | 'api' | 'stats'>('users');
  const [isMounted, setIsMounted] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Stats State
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Global API Config State
  const [globalApiConfig, setGlobalApiConfig] = useState<Config>(DEFAULT_CONFIG);
  const [isSavingGlobalApi, setIsSavingGlobalApi] = useState(false);

  // Database Config State
  const [dbConfig, setDbConfig] = useState<any>({
    host: '',
    port: 3306,
    user: '',
    password: '',
    database: ''
  });
  const [dbTestStatus, setDbTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  // OSS Config State
  const [ossConfig, setOssConfig] = useState<any>({
    region: '',
    accessKeyId: '',
    accessKeySecret: '',
    bucket: '',
  });
  const [ossTestStatus, setOssTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isSavingOss, setIsSavingOss] = useState(false);

  // Connection Status
  const [dbConnStatus, setDbConnStatus] = useState<{ mode: string; mysqlConfigured: boolean; initialized: boolean } | null>(null);
  const [ossConnStatus, setOssConnStatus] = useState<{ success: boolean; message: string } | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`/api/admin/accounts?q=${search}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await safeJson(res);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDbConfig = async () => {
    try {
      const res = await fetch('/api/admin/storage-config', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await safeJson(res);
      if (data) setDbConfig(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOssConfig = async () => {
    try {
      const res = await fetch('/api/admin/settings/cloud-storage', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await safeJson(res);
      if (data) setOssConfig(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGlobalApiConfig = async () => {
    try {
      const res = await fetch('/api/admin/settings/api-config', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await safeJson(res);
      if (data && Object.keys(data).length > 0) {
        setGlobalApiConfig({ ...DEFAULT_CONFIG, ...data });
      } else {
        setGlobalApiConfig(DEFAULT_CONFIG);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStatus = async () => {
    try {
      const [dbRes, ossRes] = await Promise.all([
        fetch('/api/db-status'),
        fetch('/api/oss-status')
      ]);
      
      const dbData = await safeJson(dbRes);
      if (dbData) {
        setDbConnStatus(dbData);
      }
      
      const ossData = await safeJson(ossRes);
      if (ossData) {
        setOssConnStatus(ossData);
      }
    } catch (err) {
      console.error('获取状态失败:', err);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin/metrics', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await safeJson(res);
      if (data) {
        setStats(data);
      }
    } catch (err) {
      console.error('获取统计失败:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchStatus();
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'database') {
      fetchDbConfig();
    } else if (activeTab === 'oss') {
      fetchOssConfig();
    } else if (activeTab === 'api') {
      fetchGlobalApiConfig();
    } else if (activeTab === 'stats') {
      fetchStats();
    }
  }, [search, activeTab]);

  const handleUpdate = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(editData)
      });
      if (res.ok) {
        setEditingId(null);
        fetchUsers();
        if (onUserUpdate) onUserUpdate();
      }
    } catch (err) {
      alert('更新失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchUsers();
      }
    } catch (err) {
      alert('删除失败');
    }
  };

  const handleLeaveTeam = async (id: number) => {
    if (!confirm('确定要将该用户从所有小组中移除吗？')) return;
    try {
      const res = await fetch(`/api/admin/accounts/${id}/leave-team`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await safeJson(res);
        alert(data?.error || '操作失败');
      }
    } catch (err) {
      alert('操作失败');
    }
  };

  const handleTestDb = async () => {
    setDbTestStatus({ message: '正在测试连接...' });
    try {
      const res = await fetch('/api/admin/storage-test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(dbConfig)
      });
      const data = await safeJson(res);
      if (data) {
        setDbTestStatus({
          success: data.success,
          message: data.message || data.error || (data.success ? '连接成功' : '连接失败')
        });
        fetchStatus();
      }
    } catch (err: any) {
      setDbTestStatus({ success: false, message: err.message });
    }
  };

  const handleSaveDb = async () => {
    setIsSavingDb(true);
    try {
      const res = await fetch('/api/admin/storage-config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(dbConfig)
      });
      const data = await safeJson(res);
      if (res.ok && data) {
        alert(data.message || '配置已保存');
        setDbTestStatus({ success: true, message: '配置已保存并重新连接' });
        fetchStatus();
      } else if (data) {
        alert(data.error || '保存失败');
      }
    } catch (err) {
      alert('保存失败');
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleRepairDb = async () => {
    if (!confirm('确定要执行数据库修复吗？这将尝试重新创建缺失的表结构，不会删除现有数据。')) return;
    setIsRepairing(true);
    try {
      const res = await fetch('/api/admin/storage-repair', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await safeJson(res);
      if (data) {
        alert(data.message || (res.ok ? '修复成功' : '修复失败'));
      }
    } catch (err) {
      alert('修复请求失败');
    } finally {
      setIsRepairing(false);
    }
  };

  const handleTestOss = async () => {
    setOssTestStatus({ message: '正在测试连接...' });
    try {
      const res = await fetch('/api/admin/settings/cloud-storage-test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(ossConfig)
      });
      const data = await safeJson(res);
      if (data) {
        setOssTestStatus(data);
        fetchStatus();
      }
    } catch (err: any) {
      setOssTestStatus({ success: false, message: err.message });
    }
  };

  const handleSaveOss = async () => {
    setIsSavingOss(true);
    try {
      const res = await fetch('/api/admin/settings/cloud-storage', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(ossConfig)
      });
      const data = await safeJson(res);
      if (res.ok && data) {
        alert(data.message || '配置已保存');
        // After saving, test connection
        const testRes = await fetch('/api/oss-status');
        const testData = await safeJson(testRes);
        if (testData) setOssTestStatus(testData);
        fetchStatus();
      } else if (data) {
        alert(data.error || '保存失败');
      }
    } catch (err) {
      alert('保存失败');
    } finally {
      setIsSavingOss(false);
    }
  };

  const handleSaveGlobalApi = async (newConfig: Config) => {
    setIsSavingGlobalApi(true);
    try {
      const res = await fetch('/api/admin/settings/api-config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newConfig)
      });
      const data = await safeJson(res);
      if (res.ok && data) {
        setGlobalApiConfig(newConfig);
        if (onUserUpdate) onUserUpdate();
        // ConfigModal will show success feedback
      } else if (data) {
        alert(data.error || '保存失败');
      }
    } catch (err) {
      alert('保存失败');
    } finally {
      setIsSavingGlobalApi(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 scroll-smooth custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif font-bold">系统管理</h1>
          <p className="text-gray-500 mt-1">管理系统用户、数据库配置及云存储状态</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-3">
            {ossConnStatus && (
              <button 
                onClick={() => setActiveTab('oss')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${
                  ossConnStatus?.success 
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                    : 'bg-red-50 text-red-600 border border-red-100'
                }`}
              >
                {ossConnStatus?.success ? (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    <span>OSS 云存储已连接</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    <span>OSS 未连接 (本地存储)</span>
                  </>
                )}
              </button>
            )}
            
            {dbConnStatus && (
              <button 
                onClick={() => setActiveTab('database')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all duration-300 hover:scale-105 active:scale-95 ${
                  dbConnStatus?.mode === 'mysql' 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                    : 'bg-amber-50 text-amber-600 border border-amber-100'
                }`}
              >
                {dbConnStatus?.mode === 'mysql' ? (
                  <>
                    <Database className="w-3 h-3" />
                    <span>云端数据库已连接</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    <span>本地模式 (MySQL 连接失败)</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-2xl">
            <button 
              onClick={() => setActiveTab('users')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'users' ? 'bg-white shadow-sm text-black' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              成员管理
            </button>
            <button 
              onClick={() => setActiveTab('database')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'database' ? 'bg-white shadow-sm text-black' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              数据库设置
            </button>
            <button 
              onClick={() => setActiveTab('oss')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'oss' ? 'bg-white shadow-sm text-black' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              OSS 配置
            </button>
            <button 
              onClick={() => setActiveTab('api')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'api' ? 'bg-white shadow-sm text-black' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              全局接口配置
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'stats' ? 'bg-white shadow-sm text-black' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              运行记录
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'users' ? (
        <>
          <div className="flex justify-end">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索用户名或手机号..."
                className="pl-12 pr-4 py-3 bg-white border border-black/5 rounded-2xl w-full md:w-80 shadow-sm focus:ring-2 focus:ring-black/5 outline-none transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-bottom border-black/5">
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">用户信息</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">积分</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">状态</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">角色</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">所在小组</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center">
                            <User className="w-5 h-5 text-zinc-400" />
                          </div>
                          <div>
                            <div className="font-bold text-zinc-900">{user.username}</div>
                            <div className="text-xs text-zinc-500">{user.phone || '管理员'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingId === user.id ? (
                          <div className="space-y-2">
                            <input
                              type="number"
                              className="w-20 px-2 py-1 bg-zinc-100 rounded border-none outline-none text-sm block"
                              value={editData.points ?? user.points}
                              onChange={e => setEditData({...editData, points: parseInt(e.target.value)})}
                            />
                            <input
                              type="password"
                              placeholder="修改密码"
                              className="w-32 px-2 py-1 bg-zinc-100 rounded border-none outline-none text-xs block"
                              value={editData.password ?? ''}
                              onChange={e => setEditData({...editData, password: e.target.value})}
                            />
                          </div>
                        ) : (
                          <span className="font-mono font-bold">{user.points}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === user.id ? (
                          <select
                            className="px-2 py-1 bg-zinc-100 rounded border-none outline-none text-sm"
                            value={editData.status ?? user.status}
                            onChange={e => setEditData({...editData, status: e.target.value})}
                          >
                            <option value="active">正常</option>
                            <option value="disabled">禁用</option>
                          </select>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            user.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {user.status === 'active' ? '正常' : '已禁用'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === user.id ? (
                          <select
                            className="px-2 py-1 bg-zinc-100 rounded border-none outline-none text-sm"
                            value={editData.role ?? user.role}
                            onChange={e => setEditData({...editData, role: e.target.value})}
                          >
                            <option value="user">正式会员</option>
                            <option value="leader">基地组长</option>
                            <option value="admin">管理员</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                            {user.role === 'admin' ? <Shield className="w-3.5 h-3.5" /> : user.role === 'leader' ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                            {user.role === 'admin' ? '管理员' : user.role === 'leader' ? '基地组长' : '正式会员'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">{user.team_name || '-'}</span>
                          {user.team_name && (
                            <button 
                              onClick={() => handleLeaveTeam(user.id)}
                              className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                              title="退出小组"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {editingId === user.id ? (
                            <>
                              <button 
                                onClick={() => handleUpdate(user.id)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <Save className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => setEditingId(null)}
                                className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-lg transition-colors"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => {
                                  setEditingId(user.id);
                                  setEditData({ points: user.points, status: user.status });
                                }}
                                className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-lg transition-colors"
                              >
                                <Edit3 className="w-5 h-5" />
                              </button>
                              {user.role !== 'admin' && (
                                <button 
                                  onClick={() => setDeleteConfirm(user.id)}
                                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === 'database' ? (
        <div className="bg-white rounded-3xl shadow-sm border border-black/5 p-8 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">数据库连接设置</h2>
              <p className="text-zinc-500 text-sm">修改 MySQL 连接信息。修改后将自动尝试重新连接。</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">主机地址 (Host)</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-zinc-50 border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-black/5 transition-all"
                  value={dbConfig.host || ''}
                  onChange={e => setDbConfig({...dbConfig, host: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">端口 (Port)</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-3 bg-zinc-50 border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-black/5 transition-all font-mono"
                  value={dbConfig.port || ''}
                  onChange={e => setDbConfig({...dbConfig, port: parseInt(e.target.value)})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">数据库名 (Database)</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-zinc-50 border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-black/5 transition-all"
                value={dbConfig.database || ''}
                onChange={e => setDbConfig({...dbConfig, database: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">用户名 (User)</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-zinc-50 border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-black/5 transition-all"
                  value={dbConfig.user || ''}
                  onChange={e => setDbConfig({...dbConfig, user: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">密码 (Password)</label>
                <input 
                  type="password" 
                  placeholder={dbConfig.password === '********' ? '********' : '输入新密码'}
                  className="w-full px-4 py-3 bg-zinc-50 border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-black/5 transition-all"
                  value={dbConfig.password === '********' ? '' : dbConfig.password}
                  onChange={e => setDbConfig({...dbConfig, password: e.target.value})}
                />
              </div>
            </div>

            {dbTestStatus && (
              <div className={`p-4 rounded-2xl flex items-start gap-3 ${
                dbTestStatus.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {dbTestStatus.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <div className="text-sm">
                  <p className="font-bold">{dbTestStatus.success ? '连接成功' : '连接失败'}</p>
                  <p className="opacity-80">{dbTestStatus.message}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4 pt-4">
              <button 
                onClick={handleTestDb}
                className="flex-1 min-w-[140px] py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
              >
                测试连接
              </button>
              <button 
                onClick={handleRepairDb}
                disabled={isRepairing}
                className="flex-1 min-w-[140px] py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRepairing ? '正在修复...' : '修复表结构'}
              </button>
              <button 
                onClick={handleSaveDb}
                disabled={isSavingDb}
                className="flex-1 min-w-[140px] py-4 bg-black text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingDb ? '正在保存...' : '保存并应用'}
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'oss' ? (
        <div className="bg-white rounded-3xl shadow-sm border border-black/5 p-8 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <Cloud className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">OSS 云存储配置</h2>
              <p className="text-zinc-500 text-sm">配置阿里云 OSS 信息。用于持久化存储生成的图片和视频。</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Globe className="w-3 h-3" /> OSS 区域 (Region)
              </label>
              <input 
                type="text" 
                placeholder="例如: oss-cn-hangzhou"
                className="w-full px-4 py-3 bg-zinc-50 border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                value={ossConfig.region || ''}
                onChange={e => setOssConfig({...ossConfig, region: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <HardDrive className="w-3 h-3" /> Bucket 名称
              </label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-zinc-50 border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                value={ossConfig.bucket || ''}
                onChange={e => setOssConfig({...ossConfig, bucket: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <User className="w-3 h-3" /> AccessKey ID
              </label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-zinc-50 border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                value={ossConfig.accessKeyId || ''}
                onChange={e => setOssConfig({...ossConfig, accessKeyId: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Lock className="w-3 h-3" /> AccessKey Secret
              </label>
              <input 
                type="password" 
                placeholder="输入新的 AccessKey Secret"
                className="w-full px-4 py-3 bg-zinc-50 border border-black/5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                value={ossConfig.accessKeySecret || ''}
                onChange={e => setOssConfig({...ossConfig, accessKeySecret: e.target.value})}
              />
            </div>

            {ossTestStatus && (
              <div className={`p-4 rounded-2xl flex items-start gap-3 ${
                ossTestStatus.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {ossTestStatus.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <div className="text-sm">
                  <p className="font-bold">{ossTestStatus.success ? '连接成功' : '连接失败'}</p>
                  <p className="opacity-80">{ossTestStatus.message}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4 pt-4">
              <button 
                onClick={handleTestOss}
                className="flex-1 min-w-[140px] py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
              >
                测试连接
              </button>
              <button 
                onClick={handleSaveOss}
                disabled={isSavingOss}
                className="flex-1 min-w-[140px] py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingOss ? '正在保存...' : '保存并应用'}
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'api' ? (
        <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
          <div className="p-8 border-b border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">全局接口配置</h2>
              <p className="text-zinc-500 text-sm">设置系统默认的 API 接口配置，当用户未配置自己的接口时将使用此配置。</p>
            </div>
          </div>
          <ConfigModal 
            config={globalApiConfig} 
            setConfig={handleSaveGlobalApi} 
            isPage={true} 
          />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <Zap size={24} />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">最近30天</span>
              </div>
              <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">全站积分消耗</h3>
              <p className="text-3xl font-serif font-bold text-zinc-900 mt-1">
                {statsLoading ? '...' : (stats?.summary?.totalPoints || 0)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <FileText size={24} />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">最近30天</span>
              </div>
              <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">剧本创作任务</h3>
              <p className="text-3xl font-serif font-bold text-zinc-900 mt-1">
                {statsLoading ? '...' : (stats?.summary?.totalTextAI || 0)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Clapperboard size={24} />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">最近30天</span>
              </div>
              <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">制剧生成任务</h3>
              <p className="text-3xl font-serif font-bold text-zinc-900 mt-1">
                {statsLoading ? '...' : (stats?.summary?.totalScriptGen || 0)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <ImageIcon size={24} />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">最近30天</span>
              </div>
              <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">图片生成任务</h3>
              <p className="text-3xl font-serif font-bold text-zinc-900 mt-1">
                {statsLoading ? '...' : (stats?.summary?.totalImages || 0)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                  <VideoIcon size={24} />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">最近30天</span>
              </div>
              <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest">视频生成任务</h3>
              <p className="text-3xl font-serif font-bold text-zinc-900 mt-1">
                {statsLoading ? '...' : (stats?.summary?.totalVideos || 0)}
              </p>
            </div>
          </div>

          {/* Daily Trend Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold">积分消耗趋势</h3>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-xs text-zinc-500">每日消耗</span>
                </div>
              </div>
              <div className="h-[300px] w-full">
                {isMounted && stats?.dailyTrend && (
                  <ResponsiveContainer width="100%" height="100%" key="points-trend-container">
                    <AreaChart data={stats.dailyTrend || []}>
                      <defs>
                        <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#9ca3af'}}
                        tickFormatter={(value) => value.split('-').slice(1).join('/')}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="points" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorPoints)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold">生成量趋势</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                      <span className="text-xs text-zinc-500">剧本创作</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                      <span className="text-xs text-zinc-500">制剧生成</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-xs text-zinc-500">图片生成</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <span className="text-xs text-zinc-500">视频生成</span>
                    </div>
                  </div>
              </div>
              <div className="h-[300px] w-full">
                {isMounted && stats?.dailyTrend && (
                  <ResponsiveContainer width="100%" height="100%" key="volume-trend-container">
                    <LineChart data={stats.dailyTrend || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fill: '#9ca3af'}}
                        tickFormatter={(value) => value.split('-').slice(1).join('/')}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Line type="monotone" dataKey="text_ai" stroke="#10b981" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="script_gen" stroke="#6366f1" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="images" stroke="#3b82f6" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="videos" stroke="#a855f7" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* User Stats Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">个人使用数据排行</h2>
                  <p className="text-zinc-500 text-sm">按积分消耗排序的用户使用统计</p>
                </div>
              </div>
              <button 
                onClick={fetchStats}
                className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all"
              >
                刷新数据
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-bottom border-black/5">
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">用户</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">积分消耗</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">剧本创作</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">制剧生成</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">图片生成</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">视频生成</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {statsLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">
                        正在加载统计数据...
                      </td>
                    </tr>
                  ) : stats?.userStats?.length > 0 ? (
                    stats.userStats.map((user: any) => (
                      <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
                              <User size={20} />
                            </div>
                            <span className="font-bold text-zinc-900">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-mono font-bold text-amber-600">
                          {user.points_spent || 0}
                        </td>
                        <td className="px-6 py-4 text-center text-zinc-600 font-mono">
                          {user.text_ai_count || 0}
                        </td>
                        <td className="px-6 py-4 text-center text-zinc-600 font-mono">
                          {user.script_gen_count || 0}
                        </td>
                        <td className="px-6 py-4 text-center text-zinc-600 font-mono">
                          {(user.images_count || 0) + (user.gpt_images_count || 0)}
                        </td>
                        <td className="px-6 py-4 text-center text-zinc-600 font-mono">
                          {user.videos_count || 0}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-400">
                        暂无统计数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-black/5"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <ShieldAlert className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-center mb-2">确认删除?</h3>
              <p className="text-center text-zinc-500 mb-8">
                此操作不可撤销。该用户的所有数据将被永久移除。
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
                >
                  确认删除
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
