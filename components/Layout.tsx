import React, { useState, useEffect } from 'react';
import { 
  Clapperboard, 
  ImageIcon, 
  Film, 
  LayoutDashboard,
  Settings,
  History,
  Library,
  User,
  ShieldCheck,
  LogOut,
  LayoutGrid,
  Zap,
  Database,
  AlertCircle,
  ShoppingBag,
  TrendingUp,
  Users,
  PenTool,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Cpu,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { safeJson } from '../lib/fetch';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user?: any;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  user, 
  onLogout,
}) => {
  const [dbStatus, setDbStatus] = useState<{ mode: string; mysqlConfigured: boolean } | null>(null);
  const [ossStatus, setOssStatus] = useState<{ success: boolean; message: string } | null>(null);
  const isCollapsed = true;
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  useEffect(() => {
    const checkDbStatus = async () => {
      try {
        const res = await fetch('/api/db-status');
        if (res.ok) {
          const data = await safeJson(res);
          if (data) setDbStatus(data);
        }
      } catch (err) {
        console.error('获取数据库状态失败:', err);
      }
    };

    const checkOssStatus = async () => {
      try {
        const res = await fetch('/api/oss-status');
        if (res.ok) {
          const data = await safeJson(res);
          if (data) setOssStatus(data);
        }
      } catch (err) {
        console.error('获取 OSS 状态失败:', err);
      }
    };

    checkDbStatus();
    checkOssStatus();
  }, []);

  const navItems = [
    { id: 'space', name: '灵境', icon: ImageIcon },
    { id: 'mycompany', name: '协同', icon: Building2 },
    { id: 'tasks', name: '资产', icon: LayoutGrid },
    { id: 'skills', name: '技能', icon: Cpu },
  ];

  const allMenuItems = [
    ...navItems,
    { id: 'admin', name: '后台', icon: ShieldCheck },
    { id: 'profile', name: '个人', icon: User },
  ];

  const isAdmin = user?.role === 'admin';
  const isLeader = user?.role === 'leader';
  const isTeamMember = !!user?.leader_id;
  const isGuest = user?.id === 'guest' || localStorage.getItem('isGuest') === 'true';

  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const checkUnread = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const res = await fetch('/api/group-chats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const groups = await safeJson(res);
          if (Array.isArray(groups) && groups.length > 0) {
            let foundUnread = false;
            for (const group of groups) {
              const storageKey = `lastReadAt_${group.id}`;
              const lastRead = Number(localStorage.getItem(storageKey) || 0);
              const messageTime = group.lastMessageAt ? Number(group.lastMessageAt) : 0;
              
              if (messageTime > 0 && messageTime > lastRead) {
                foundUnread = true;
                break;
              }
            }
            setHasUnread(foundUnread);
          }
        }
      } catch (e) {
        console.warn('Failed to check unread messages:', e);
      }
    };

    checkUnread();
    const timer = setInterval(checkUnread, 15000); // Check every 15s to be gentle on rate limits
    return () => clearInterval(timer);
  }, [user, activeTab]);

  return (
    <div className="h-screen flex bg-white text-slate-800">
      {!isGuest && (
        <aside className="fixed left-6 top-[calc(50vh-118px)] z-50 flex flex-col items-center justify-start pointer-events-none select-none">
          {/* Floating Dock Container (Styled like Figure 1's light theme) */}
          <div 
            onMouseEnter={() => setIsSidebarHovered(true)}
            onMouseLeave={() => setIsSidebarHovered(false)}
            className="bg-[#f5f2fd]/95 border border-[#e3dbf8] shadow-[0_15px_40px_rgba(124,58,237,0.12)] rounded-2xl py-3 px-2 flex flex-col items-center gap-3 backdrop-blur-md pointer-events-auto transition-all duration-300"
          >
            {/* Nav Items */}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const itemHasNotification = item.id === 'mycompany' && hasUnread && activeTab !== 'mycompany';

              return (
                <div key={item.id} className="relative group flex items-center justify-center">
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 relative ${
                      isActive 
                        ? 'bg-white text-[#7c3aed] shadow-[0_4px_12px_rgba(124,58,237,0.18)]' 
                        : 'text-[#8f95a3] hover:text-[#7c3aed] hover:bg-[#eae6f5]/50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-105' : 'hover:scale-105'}`} />
                    
                    {itemHasNotification && (
                      <span className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    )}
                  </button>

                  {isActive && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-[4.5px] h-7 bg-[#7c3aed] rounded-full shadow-[0_0_8px_rgba(124,58,237,0.3)]" />
                  )}

                  {/* Sleek Tooltip */}
                  <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-white border border-[#e3dbf8] text-slate-700 text-xs font-bold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-lg whitespace-nowrap z-50">
                    {item.name}
                  </div>
                </div>
              );
            })}

            {/* Divider if secondary items exist */}
            {(isAdmin || isLeader || isTeamMember) && (
              <div className={`w-6 h-[1px] bg-[#e3dbf8]/80 my-0.5 transition-all duration-300 ${isSidebarHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-0 h-0 my-0'}`} />
            )}

            {/* Hover-reveal secondary items container */}
            <div 
              className={`flex flex-col items-center gap-3 transition-all duration-300 ease-in-out overflow-hidden ${
                isSidebarHovered 
                  ? 'max-h-[350px] opacity-100 mt-1 pointer-events-auto' 
                  : 'max-h-0 opacity-0 mt-0 pointer-events-none'
              }`}
            >
              {/* Secondary Admin/Team Items */}
              {isAdmin && (
                <div className="relative group flex items-center justify-center">
                  <button
                    onClick={() => setActiveTab('admin')}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      activeTab === 'admin' 
                        ? 'bg-white text-[#7c3aed] shadow-[0_4px_12px_rgba(124,58,237,0.18)]' 
                        : 'text-[#8f95a3] hover:text-[#7c3aed] hover:bg-[#eae6f5]/50'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </button>
                  {activeTab === 'admin' && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-[4.5px] h-7 bg-[#7c3aed] rounded-full shadow-[0_0_8px_rgba(124,58,237,0.3)]" />
                  )}
                  <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-white border border-[#e3dbf8] text-slate-700 text-xs font-bold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-lg whitespace-nowrap z-50">
                    系统后台
                  </div>
                </div>
              )}

              {(isLeader || isAdmin || isTeamMember) && (
                <div className="relative group flex items-center justify-center">
                  <button
                    onClick={() => setActiveTab('leader')}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      activeTab === 'leader' 
                        ? 'bg-white text-[#7c3aed] shadow-[0_4px_12px_rgba(124,58,237,0.18)]' 
                        : 'text-[#8f95a3] hover:text-[#7c3aed] hover:bg-[#eae6f5]/50'
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5" />
                  </button>
                  {activeTab === 'leader' && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-[4.5px] h-7 bg-[#7c3aed] rounded-full shadow-[0_0_8px_rgba(124,58,237,0.3)]" />
                  )}
                  <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-white border border-[#e3dbf8] text-slate-700 text-xs font-bold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-lg whitespace-nowrap z-50">
                    团队管理
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="w-6 h-[1px] bg-[#e3dbf8]/80 my-0.5" />

              {/* User Profile */}
              <div className="relative group flex items-center justify-center">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    activeTab === 'profile' 
                      ? 'bg-white text-[#7c3aed] shadow-[0_4px_12px_rgba(124,58,237,0.18)]' 
                      : 'text-[#8f95a3] hover:text-[#7c3aed] hover:bg-[#eae6f5]/50'
                  }`}
                >
                  <User className="w-5 h-5" />
                </button>
                {activeTab === 'profile' && (
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-[4.5px] h-7 bg-[#7c3aed] rounded-full shadow-[0_0_8px_rgba(124,58,237,0.3)]" />
                )}

                {/* Advanced Profile Hover Card */}
                <div className="absolute left-14 bottom-0 w-56 bg-white border border-[#e3dbf8] rounded-xl p-4 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 shadow-2xl z-50 flex flex-col gap-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#f5f2fd] flex items-center justify-center border border-[#e3dbf8]/60">
                      <User className="w-5 h-5 text-[#7c3aed]" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-slate-800 truncate">{user?.username || '未登录'}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {user?.role === 'admin' ? '系统管理员' : user?.role === 'leader' ? '团队组长' : '正式会员'}
                      </span>
                    </div>
                  </div>

                  {user && (
                    <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2.5">
                      {user.teamInfo?.teamPoints !== undefined && (
                        <div className="flex items-center justify-between text-xs py-1 px-2 bg-amber-50 border border-amber-100 rounded-md">
                          <span className="text-amber-600 font-medium flex items-center gap-1.5">
                            <Users className="w-3 h-3" /> 团队积分
                          </span>
                          <span className="text-amber-600 font-black">{user.teamInfo.teamPoints}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs py-1 px-2 bg-indigo-50 border border-indigo-100 rounded-md">
                        <span className="text-indigo-600 font-medium flex items-center gap-1.5">
                          <Zap className="w-3 h-3 fill-indigo-500/10" /> 个人积分
                        </span>
                        <span className="text-indigo-600 font-black">{user.points || 0}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="w-6 h-[1px] bg-[#e3dbf8]/80 my-0.5" />

              {/* Logout */}
              {onLogout && (
                <div className="relative group flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLogout();
                    }}
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-[#8f95a3] hover:text-red-500 hover:bg-red-50 transition-all duration-300 cursor-pointer"
                    title="安全退出"
                  >
                    <LogOut className="w-5 h-5 transition-transform duration-300 hover:scale-105" />
                  </button>
                  <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-white border border-[#e3dbf8] text-slate-700 text-xs font-bold rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-lg whitespace-nowrap z-50">
                    安全退出
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${(!isGuest && activeTab !== 'space') ? 'sm:pl-24 pl-20' : ''}`}>
        {/* Top Header (Breadcrumbs/Actions) Removed at user request */}

        {/* Page Content */}
        <main className="flex-1 overflow-hidden relative">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/5 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400/5 rounded-full blur-[100px] pointer-events-none"></div>
          {children}
        </main>
      </div>
    </div>
  );
};
