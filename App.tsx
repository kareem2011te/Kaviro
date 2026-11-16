import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  Calendar,
  CheckSquare,
  Download,
  FileText,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Palette,
  Shield,
  ShieldCheck,
  Sun,
  UserCog,
  X,
} from 'lucide-react';
import { KaviroLogo, SecondaryButton } from './design-system/components';
import { apiRequest, getAuthToken, setAuthToken } from './lib/api';
import { translations, type Language, type NavTab } from './lib/i18n';
import type { AnalyticsPayload, NotificationItem, UserProfile } from './lib/types';
import { LoadingScreen } from './components/LoadingScreen';
import { AiAssistantWidget } from './components/AiAssistantWidget';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { AuthView } from './views/AuthView';
import { DashboardView } from './views/DashboardView';
import { DesignSystemView } from './views/DesignSystemView';
import { CvBuilderView } from './views/CvBuilderView';
import { AssessmentsView } from './views/AssessmentsView';
import { MessagingView } from './views/MessagingView';
import { TasksProjectsView } from './views/TasksProjectsView';
import { MeetingsIntegrationsView } from './views/MeetingsIntegrationsView';
import { SecuritySessionsView } from './views/SecuritySessionsView';
import { AnalyticsView } from './views/AnalyticsView';
import { ProfileView } from './views/ProfileView';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<Language>('en');
  const [booting, setBooting] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);

  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [wsEventState, setWsEventState] = useState<{ event: string; payload: any; seq: number } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  // Sync dir & lang on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const loadWorkspaceData = async () => {
    const [uRes, aRes, nRes] = await Promise.all([
      apiRequest<{ users: UserProfile[] }>('/api/users'),
      apiRequest<AnalyticsPayload>('/api/analytics'),
      apiRequest<{ notifications: NotificationItem[] }>('/api/notifications'),
    ]);
    setUsers(uRes.users);
    setAnalytics(aRes);
    setNotifications(nRes.notifications);
  };

  // Restore session on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setBooting(false);
      return;
    }
    apiRequest<{ user: UserProfile }>('/api/auth/me')
      .then(async (res) => {
        setCurrentUser(res.user);
        if (res.user.preferredLanguage) setLang(res.user.preferredLanguage);
        await loadWorkspaceData();
      })
      .catch(() => {
        setAuthToken(null);
      })
      .finally(() => setBooting(false));
  }, []);

  // Connect live WebSocket when authenticated
  useEffect(() => {
    const token = getAuthToken();
    if (!currentUser || !token) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { event: string; payload: any };
        if (msg.event === 'presence:init' || msg.event === 'presence:update') {
          setOnlineUserIds(msg.payload.onlineUserIds || []);
        } else if (msg.event === 'notification:new') {
          setNotifications((prev) => [msg.payload, ...prev]);
        } else if (msg.event === 'session:revoked') {
          setAuthToken(null);
          setCurrentUser(null);
          ws.close();
        }
        seqRef.current += 1;
        setWsEventState({ event: msg.event, payload: msg.payload, seq: seqRef.current });
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [currentUser?.id]);

  const sendWsTyping = (conversationId: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'typing', payload: { conversationId, isTyping } }));
    }
  };

  const handleAuthenticated = async (user: UserProfile, token: string) => {
    setAuthToken(token);
    setCurrentUser(user);
    if (user.preferredLanguage) setLang(user.preferredLanguage);
    setActiveTab('dashboard');
    await loadWorkspaceData();
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setCurrentUser(null);
  };

  const handleApproveUser = async (userId: string, status: 'approved' | 'rejected') => {
    await apiRequest(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadWorkspaceData();
  };

  const handleSubmitApplication = async () => {
    const res = await apiRequest<{ user: UserProfile }>('/api/auth/onboarding/submit', { method: 'POST' });
    setCurrentUser(res.user);
    await loadWorkspaceData();
  };

  const handleMarkAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (booting) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return (
      <AuthView
        lang={lang}
        theme={theme}
        onToggleLang={() => setLang((l) => (l === 'en' ? 'ar' : 'en'))}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  const t = translations[lang];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: t.nav.dashboard, icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'design-system', label: t.nav['design-system'], icon: <Palette className="w-4 h-4" /> },
    { id: 'cv-builder', label: t.nav['cv-builder'], icon: <FileText className="w-4 h-4" /> },
    { id: 'assessments', label: t.nav.assessments, icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'messages', label: t.nav.messages, icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'tasks', label: t.nav.tasks, icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'meetings', label: t.nav.meetings, icon: <Calendar className="w-4 h-4" /> },
    { id: 'security', label: t.nav.security, icon: <Shield className="w-4 h-4" /> },
    { id: 'analytics', label: t.nav.analytics, icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'profile', label: t.nav.profile, icon: <UserCog className="w-4 h-4" /> },
  ];

  const SidebarContent = () => (
    <div className="h-full flex flex-col justify-between p-4 bg-white dark:bg-[#060c1b] border-e border-slate-200 dark:border-blue-500/15">
      <div className="space-y-6">
        <div className="px-1">
          <KaviroLogo variant="full" />
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#1D7AFC]/15 text-[#1D7AFC] dark:text-[#00D4FF] border border-blue-500/30'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0e1934]'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-blue-500/15">
        <a
          href="/api/export/project-zip"
          download="kaviro-platform-web.zip"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/25 text-slate-800 dark:text-slate-100 hover:border-[#00D4FF]"
        >
          <Download className="w-3.5 h-3.5 text-[#1D7AFC] dark:text-[#00D4FF]" />
          <span className="truncate">{t.actions.downloadZip}</span>
        </a>

        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {currentUser.fullName}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {currentUser.role} · {currentUser.status}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title={t.actions.signOut}
            className="p-2 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#040814] text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex bg-black/60">
          <div className="w-72 h-full relative">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-3 end-3 z-10 p-1.5 rounded-lg bg-slate-900/80 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact Top Bar */}
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#040814]/90 backdrop-blur-md border-b border-slate-200 dark:border-blue-500/15 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-slate-100 dark:bg-[#0e1934] border border-slate-300 dark:border-blue-500/20 cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="lg:hidden">
              <KaviroLogo variant="compact" />
            </div>
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>KAVIRO</span>
              <span>/</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {t.nav[activeTab]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SecondaryButton
              size="sm"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </SecondaryButton>
            <SecondaryButton
              size="sm"
              onClick={() => setLang((prev) => (prev === 'en' ? 'ar' : 'en'))}
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'en' ? 'العربية' : 'EN'}</span>
            </SecondaryButton>
            <SecondaryButton size="sm" onClick={() => setNotifDrawerOpen(true)}>
              <Bell className="w-3.5 h-3.5" />
              {unreadCount > 0 && (
                <span className="font-mono-tabular text-[#1D7AFC] dark:text-[#00D4FF] font-bold">
                  {unreadCount}
                </span>
              )}
            </SecondaryButton>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              lang={lang}
              currentUser={currentUser}
              users={users}
              analytics={analytics}
              onNavigate={setActiveTab}
              onApproveUser={handleApproveUser}
              onSubmitApplication={handleSubmitApplication}
            />
          )}
          {activeTab === 'design-system' && (
            <DesignSystemView
              lang={lang}
              theme={theme}
              onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              onToggleLang={() => setLang((prev) => (prev === 'en' ? 'ar' : 'en'))}
            />
          )}
          {activeTab === 'cv-builder' && (
            <CvBuilderView
              lang={lang}
              currentUser={currentUser}
              onUserUpdated={setCurrentUser}
            />
          )}
          {activeTab === 'assessments' && (
            <AssessmentsView
              lang={lang}
              currentUser={currentUser}
              users={users}
              onUserUpdated={setCurrentUser}
            />
          )}
          {activeTab === 'messages' && (
            <MessagingView
              lang={lang}
              currentUser={currentUser}
              users={users}
              onlineUserIds={onlineUserIds}
              wsEvents={wsEventState}
              sendWsTyping={sendWsTyping}
            />
          )}
          {activeTab === 'tasks' && (
            <TasksProjectsView lang={lang} currentUser={currentUser} users={users} />
          )}
          {activeTab === 'meetings' && (
            <MeetingsIntegrationsView lang={lang} currentUser={currentUser} users={users} />
          )}
          {activeTab === 'security' && (
            <SecuritySessionsView
              lang={lang}
              currentUser={currentUser}
              users={users}
              onRefreshUsers={loadWorkspaceData}
            />
          )}
          {activeTab === 'analytics' && <AnalyticsView lang={lang} analytics={analytics} />}
          {activeTab === 'profile' && (
            <ProfileView lang={lang} currentUser={currentUser} onUserUpdated={setCurrentUser} />
          )}
        </main>
      </div>

      <NotificationsDrawer
        open={notifDrawerOpen}
        lang={lang}
        notifications={notifications}
        onClose={() => setNotifDrawerOpen(false)}
        onMarkAllRead={handleMarkAllRead}
        onNavigate={setActiveTab}
      />

      <AiAssistantWidget lang={lang} />
    </div>
  );
}
