import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  ShieldAlert, 
  Search, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRightLeft,
  Edit2,
  Check,
  X,
  LogOut,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { safeJson } from '../lib/fetch';

interface TeamMember {
  id: number;
  username: string;
  phone: string;
  role: string;
  status: string;
  monthly_points_spent: number;
  point_limit: number;
}

interface Team {
  id: number;
  name: string;
  leader_id: number;
  created_at: string;
}

export default function TeamManagementPage({ user: currentUser }: { user?: any }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addIdentifier, setAddIdentifier] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [adding, setAdding] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [updatingTeamName, setUpdatingTeamName] = useState(false);
  const [teamPoints, setTeamPoints] = useState(0);
  const [user, setUser] = useState<any>(currentUser);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success'
  });
  const [editingLimitId, setEditingLimitId] = useState<number | null>(null);
  const [newLimitValue, setNewLimitValue] = useState<string>('');
  const [updatingLimit, setUpdatingLimit] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleUpdateLimit = async (userId: number) => {
    const limit = parseInt(newLimitValue);
    if (isNaN(limit) || limit < 0) {
      showToast('请输入有效的积分限制 (0 表示无限制)', 'error');
      return;
    }

    setUpdatingLimit(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leader/members/${userId}/limit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ point_limit: limit })
      });

      if (res.ok) {
        showToast('积分限制已更新');
        setMembers(prev => prev.map(m => m.id === userId ? { ...m, point_limit: limit } : m));
        setEditingLimitId(null);
      } else {
        const errorData = await safeJson(res);
        showToast(errorData.error || '更新失败', 'error');
      }
    } catch (e) {
      showToast('网络错误，请重试', 'error');
    } finally {
      setUpdatingLimit(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/leader/teams', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await safeJson(res);
      const teamsList = Array.isArray(data) ? data : [];
      setTeams(teamsList);
      
      if (teamsList.length > 0) {
        const firstTeamId = teamsList[0].id;
        setSelectedTeamId(firstTeamId);
        // Fetch members immediately for the first team to avoid waterfall
        await fetchMembers(firstTeamId);
      } else {
        setLoading(false);
      }
    } catch (e: any) {
      console.error('Fetch teams error:', e);
      setLoading(false);
    }
  };

  const fetchMembers = async (teamId?: number) => {
    const id = teamId || selectedTeamId;
    if (!id) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoadingMembers(true);
    try {
      const token = localStorage.getItem('token');
      const [res, profileRes] = await Promise.all([
        fetch(`/api/leader/teams/${id}/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/user/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      const [data, profile] = await Promise.all([
        safeJson(res),
        safeJson(profileRes)
      ]);
      
      setMembers(data || []);
      
      if (profile) {
        setUser(profile);
        if (profile.role === 'leader' || profile.role === 'admin') {
          setTeamPoints(profile.points);
        } else if (profile.teamInfo) {
          setTeamPoints(profile.teamInfo.teamPoints);
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    // Only fetch if selectedTeamId changes and it's not the initial load (which is handled in fetchTeams)
    if (selectedTeamId && !loading) {
      fetchMembers(selectedTeamId);
    }
  }, [selectedTeamId]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreatingTeam(true);
    try {
      const res = await fetch('/api/leader/teams', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: newTeamName })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || '创建失败');
      
      setNewTeamName('');
      setShowCreateTeam(false);
      await fetchTeams();
      setSelectedTeamId(data.id);
      showToast('团队创建成功');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleUpdateTeamName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeamName.trim() || !editingTeamId) return;

    setUpdatingTeamName(true);
    try {
      const res = await fetch(`/api/leader/teams/${editingTeamId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: editingTeamName })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || '修改失败');
      
      setEditingTeamId(null);
      setEditingTeamName('');
      await fetchTeams();
      showToast('团队名称已更新');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setUpdatingTeamName(false);
    }
  };

  const handleDeleteTeam = async (id: number) => {
    setConfirmModal({
      show: true,
      title: '解散团队',
      message: '确定要解散该团队吗？解散后所有成员将移出该团队。',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/leader/teams/${id}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (!res.ok) {
            const data = await safeJson(res);
            throw new Error(data?.error || '删除失败');
          }
          await fetchTeams();
          if (selectedTeamId === id) {
            setSelectedTeamId(null);
          }
          showToast('团队已解散');
        } catch (e: any) {
          showToast(e.message, 'error');
        }
      }
    });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addIdentifier.trim() || !selectedTeamId) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/leader/teams/${selectedTeamId}/add-member`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ identifier: addIdentifier })
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || '添加失败');
      
      setAddIdentifier('');
      fetchMembers();
      showToast('添加成功');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (id: number) => {
    if (!selectedTeamId) return;
    setConfirmModal({
      show: true,
      title: '移出成员',
      message: '确定要将该成员从当前团队移出吗？',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/leader/teams/${selectedTeamId}/remove-member/${id}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (!res.ok) {
            const data = await safeJson(res);
            throw new Error(data?.error || '删除失败');
          }
          fetchMembers();
          showToast('已成功移出成员');
        } catch (e: any) {
          showToast(e.message, 'error');
        }
      }
    });
  };

  const handleLeaveTeam = async (teamId: number) => {
    setConfirmModal({
      show: true,
      title: '退出小组',
      message: '确定要退出当前小组吗？退出后您将无法使用该小组的共享积分。',
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/user/leave-team/${teamId}`, { 
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          const data = await safeJson(res);
          if (!res.ok) throw new Error(data?.error || '退出失败');
          
          showToast('已成功退出小组，正在刷新...');
          setTimeout(() => window.location.reload(), 1500);
        } catch (e: any) {
          showToast(e.message, 'error');
        }
      }
    });
  };

  const handleTransferRole = async (id: number) => {
    setConfirmModal({
      show: true,
      title: '转移组长权限',
      message: '确定要将组长权限转移给该成员吗？转移后您将变为普通成员，且无法撤销此操作。',
      type: 'info',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/leader/transfer-role/${id}`, { 
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (!res.ok) {
            const data = await safeJson(res);
            throw new Error(data?.error || '转移失败');
          }
          showToast('权限转移成功，正在刷新...');
          setTimeout(() => window.location.reload(), 1500);
        } catch (e: any) {
          showToast(e.message, 'error');
        }
      }
    });
  };

  const isLeader = user?.role === 'leader' || user?.role === 'admin';

  const totalSpent = members.reduce((sum, m) => sum + Number(m.monthly_points_spent || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            团队管理
          </h1>
          <p className="text-gray-500 mt-1">管理您的团队成员和共享积分</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4 min-w-[200px]">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-600 font-medium">
                {isLeader ? '团队权益本月剩余积分' : '团队共享剩余积分'}
              </p>
              <p className="text-2xl font-bold text-blue-900">{teamPoints}</p>
            </div>
          </div>

          {isLeader && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-4 min-w-[200px]">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Zap className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-amber-600 font-medium">团队本月积分使用总量</p>
                <p className="text-2xl font-bold text-amber-900">{totalSpent}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Selector & Add Member Card - Only for Leaders */}
        {isLeader && (
          <div className="lg:col-span-1 space-y-6">
            {/* Team Selector */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  我的小组
                </h2>
                <button 
                  onClick={() => setShowCreateTeam(true)}
                  className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  title="创建新小组"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {Array.isArray(teams) && teams.map((team) => (
                  <div 
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                      selectedTeamId === team.id 
                        ? 'bg-blue-50 border-blue-200 text-blue-700' 
                        : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {editingTeamId === team.id ? (
                      <form 
                        onSubmit={handleUpdateTeamName}
                        className="flex items-center gap-1 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          type="text"
                          value={editingTeamName}
                          onChange={(e) => setEditingTeamName(e.target.value)}
                          className="flex-1 min-w-0 bg-white border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button 
                          type="submit"
                          disabled={updatingTeamName || !editingTeamName.trim()}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          {updatingTeamName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEditingTeamId(null)}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="font-medium truncate flex-1">{team.name}</span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTeamId(team.id);
                              setEditingTeamName(team.name);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-500 transition-all"
                            title="修改名称"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTeam(team.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                            title="解散团队"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {teams.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">暂无小组</p>
                    <button 
                      onClick={() => setShowCreateTeam(true)}
                      className="text-xs text-blue-500 mt-2 hover:underline"
                    >
                      立即创建
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Add Member Card */}
            {selectedTeamId && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-green-600" />
                  添加成员
                </h2>
                <form onSubmit={handleAddMember} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      用户名或手机号
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={addIdentifier}
                        onChange={(e) => setAddIdentifier(e.target.value)}
                        placeholder="输入成员账号"
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={adding || !addIdentifier.trim()}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    添加至当前小组
                  </button>
                </form>
                
                <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-1 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    团队规则
                  </h3>
                  <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4">
                    <li>您可以创建多个小组进行管理</li>
                    <li>每个小组上限为 200 人</li>
                    <li>成员将优先消耗您的团队积分</li>
                    <li>您可以为每个成员设置月度积分使用上限</li>
                    <li>转移组长权限后，您将变为普通成员</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Member List */}
        <div className={isLeader ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-bottom border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                {selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.name : '成员列表'}
                <span className="text-sm font-normal text-gray-400 ml-2">
                  ({members.length}/200)
                </span>
              </h2>
              {loadingMembers && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
            </div>

            <div className="overflow-x-auto max-h-[640px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">成员信息</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">本月消耗</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">积分上限</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    {(isLeader || members.some(m => m.id === user?.id)) && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {member.username} {member.id === user?.id && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded ml-1">我</span>}
                              {member.role === 'leader' && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded ml-1">组长</span>}
                              <span className="text-[10px] text-gray-400 ml-1">ID: {member.id}</span>
                            </div>
                            <div className="text-xs text-gray-500">{member.phone || '未绑定手机'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Clock className="w-4 h-4 text-gray-400" />
                          {Number(member.monthly_points_spent) || 0} 积分
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingLimitId === member.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={newLimitValue}
                              onChange={(e) => setNewLimitValue(e.target.value)}
                              className="w-20 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="0"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateLimit(member.id)}
                              disabled={updatingLimit}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              {updatingLimit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => setEditingLimitId(null)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center group">
                            <span className="text-sm text-gray-900">
                              {Number(member.point_limit) > 0 ? `${Number(member.point_limit)} 积分` : '无限制'}
                            </span>
                            {isLeader && member.role !== 'leader' && (
                              <button
                                onClick={() => {
                                  setEditingLimitId(member.id);
                                  setNewLimitValue(member.point_limit.toString());
                                }}
                                className="ml-2 p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {member.status === 'active' ? '正常' : '禁用'}
                        </span>
                      </td>
                      {(isLeader || member.id === user?.id) && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          {isLeader && member.role !== 'leader' && (
                            <>
                              <button
                                onClick={() => handleTransferRole(member.id)}
                                className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                title="转移组长权限"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                title="移出团队"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {!isLeader && member.id === user?.id && selectedTeamId && (
                            <button
                              onClick={() => handleLeaveTeam(selectedTeamId)}
                              className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                              title="退出小组"
                            >
                              <LogOut className="w-4 h-4" />
                              <span>退出小组</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="w-12 h-12 text-gray-200" />
                          <p>暂无团队成员</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal 
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, show: false }))}
      />
      
      <Toast 
        show={toast.show}
        message={toast.message}
        type={toast.type}
      />

      {/* Create Team Modal */}
      <AnimatePresence>
        {showCreateTeam && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateTeam(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 w-full max-w-sm overflow-hidden"
            >
              <h3 className="text-xl font-black text-gray-900 mb-6 tracking-tight">创建新小组</h3>
              <form onSubmit={handleCreateTeam} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">小组名称</label>
                  <input
                    type="text"
                    autoFocus
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="例如：视觉设计组"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateTeam(false)}
                    className="flex-1 h-12 text-sm font-black text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all active:scale-95"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={creatingTeam || !newTeamName.trim()}
                    className="flex-1 h-12 text-sm font-black text-white byted-primary rounded-2xl transition-all shadow-xl shadow-blue-200 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {creatingTeam ? <Loader2 className="w-4 h-4 animate-spin" /> : '创建'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ConfirmationModal: React.FC<{
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'info';
}> = ({ show, title, message, onConfirm, onCancel, type = 'info' }) => {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 w-full max-w-sm overflow-hidden"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${
              type === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
            }`}>
              {type === 'danger' ? <Trash2 className="w-7 h-7" /> : <ArrowRightLeft className="w-7 h-7" />}
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tight">{title}</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">{message}</p>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 h-12 text-sm font-black text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all active:scale-95"
              >
                取消
              </button>
              <button
                onClick={() => { onConfirm(); onCancel(); }}
                className={`flex-1 h-12 text-sm font-black text-white rounded-2xl transition-all shadow-xl active:scale-95 ${
                  type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'byted-primary shadow-blue-200'
                }`}
              >
                确认
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const Toast: React.FC<{ show: boolean; message: string; type: 'success' | 'error' }> = ({ show, message, type }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 50, x: '-50%' }}
          className={`fixed bottom-12 left-1/2 z-[110] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
          }`}
        >
          {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-black tracking-tight">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
