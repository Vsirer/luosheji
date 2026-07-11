import React, { useState, useEffect } from 'react';
import { LogIn, UserPlus, Phone, Lock, Key, ArrowRight, ArrowLeft, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { safeJson } from '../lib/fetch';

interface AuthPageProps {
  onLogin: (token: string, user: any) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-verify' | 'forgot-reset'>(() => {
    const saved = localStorage.getItem('auth_mode');
    if (saved === 'register' || saved === 'login') return saved;
    return 'login';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.removeItem('auth_mode');
  }, []);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    phone: '',
    inviteCode: ''
  });

  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'register' && formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      setLoading(false);
      return;
    }

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await safeJson(res);
      
      if (!data) {
        throw new Error(`服务器返回了非 JSON 响应 (状态码: ${res.status})。这通常意味着 API 路由未找到或服务器发生了严重错误。`);
      }

      if (!res.ok) throw new Error(data.error || data.message || '操作失败');

      if (mode === 'login') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLogin(data.token, data.user);
      } else {
        alert('注册成功，请登录');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername, phone: forgotPhone })
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data.error || '验证失败，用户名或手机号不正确。');
      }
      setMode('forgot-reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (newPassword !== confirmNewPassword) {
      setError('两次输入的密码不一致');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: forgotUsername,
          phone: forgotPhone,
          newPassword
        })
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data.error || '修改密码失败');
      }
      alert('密码修改成功，请使用新密码登录');
      // Clear states
      setForgotUsername('');
      setForgotPhone('');
      setNewPassword('');
      setConfirmNewPassword('');
      setMode('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f2ed] p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-black/5"
      >
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center shadow-lg">
              {mode === 'login' && <LogIn className="text-white w-8 h-8" />}
              {mode === 'register' && <UserPlus className="text-white w-8 h-8" />}
              {mode === 'forgot-verify' && <HelpCircle className="text-white w-8 h-8" />}
              {mode === 'forgot-reset' && <Key className="text-white w-8 h-8" />}
            </div>
          </div>
          
          <h2 className="text-3xl font-serif font-bold text-center mb-2">
            {mode === 'login' && '欢迎回来'}
            {mode === 'register' && '创建账号'}
            {mode === 'forgot-verify' && '找回密码'}
            {mode === 'forgot-reset' && '重置密码'}
          </h2>
          <p className="text-center text-gray-500 mb-8 font-sans text-sm">
            {mode === 'login' && '请登录您的账号'}
            {mode === 'register' && '加入我们的会员系统 (注册即送10积分)'}
            {mode === 'forgot-verify' && '输入注册时的用户名和手机号以核对身份'}
            {mode === 'forgot-reset' && '身份核对成功，请设置您的新密码'}
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl text-center">
              {error}
            </div>
          )}

          {/* Mode-specific forms */}
          {(mode === 'login' || mode === 'register') && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">用户名</label>
                <div className="relative">
                  <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    placeholder="请输入用户名"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">手机号</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      required
                      placeholder="输入您的手机号"
                      className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">密码</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot-verify');
                        setError('');
                      }}
                      className="text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors"
                    >
                      忘记密码？
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    required
                    placeholder={mode === 'login' ? "请输入密码" : "设置您的密码"}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>

              {mode === 'register' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">确认密码</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="password"
                        required
                        placeholder="再次输入密码"
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                        value={formData.confirmPassword}
                        onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">邀请码 (必填)</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        required
                        placeholder="输入邀请码"
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                        value={formData.inviteCode}
                        onChange={e => setFormData({...formData, inviteCode: e.target.value})}
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-black text-white rounded-2xl font-bold shadow-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              >
                {loading ? '处理中...' : (mode === 'login' ? '登录' : '注册')}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>
          )}

          {mode === 'forgot-verify' && (
            <form onSubmit={handleVerifyForgot} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">用户名</label>
                <div className="relative">
                  <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    placeholder="请输入注册时使用的用户名"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                    value={forgotUsername}
                    onChange={e => setForgotUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">注册手机号</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    required
                    placeholder="请输入注册时使用的手机号"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                    value={forgotPhone}
                    onChange={e => setForgotPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="w-1/2 py-3.5 bg-gray-105 text-gray-700 bg-gray-100 rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-1/2 py-3.5 bg-black text-white rounded-2xl font-bold shadow-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? '正在验证...' : '下一步'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot-reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-100 text-green-700 text-xs rounded-xl flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span>身份验证已通过，请输入新密码。</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">新密码</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    required
                    placeholder="请输入新密码"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">确认新密码</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    required
                    placeholder="请再次输入新密码"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className="w-1/2 py-3.5 bg-gray-101 text-gray-700 bg-gray-100 rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-1/2 py-3.5 bg-black text-white rounded-2xl font-bold shadow-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? '修改中...' : '确定修改'}
                </button>
              </div>
            </form>
          )}

          {/* Bottom toggle link */}
          {(mode === 'login' || mode === 'register') && (
            <div className="mt-6 text-center flex flex-col items-center justify-center gap-4">
              <button
                id="auth-toggle-btn"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
                className="text-sm font-medium text-gray-500 hover:text-black transition-colors"
              >
                {mode === 'login' ? (
                  <>还没有账号? <span className="text-black font-bold">立即注册</span></>
                ) : (
                  <>原有账号? <span className="text-black font-bold">立即登录</span></>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
