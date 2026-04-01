'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

import { useAppSelector, useAppDispatch } from '../../src/store/hooks';
import { logout, setAgentStatus, fetchProfile } from '../../src/features/auth/authSlice';
import { clearCallBadge, clearSmsBadge } from '../../src/features/notifications/notificationSlice';
import TelnyxRTCWrapper from '../components/TelnyxRTCWrapper';
import SoftphoneMini from '../components/SoftphoneMini';
import Softphone from '../components/Softphone';
import OnboardingWizard from '../components/OnboardingWizard';
import { requestPushPermission, unsubscribeFromPush, getPushStatus } from '../../src/store/socketMiddleware';

const navItems = [
  { label: 'Agent Dashboard', href: '/dashboard', badgeKey: null, roles: ['admin', 'agent'],
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Phone', href: '/phone', badgeKey: 'callBadge', roles: ['admin', 'agent'],
    icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  { label: 'Conversations', href: '/sms', badgeKey: 'smsBadge', roles: ['admin', 'agent'],
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { label: 'IVR Builder', href: '/ivr', badgeKey: null, roles: ['admin', 'agent'],
    icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { label: 'Audio Files', href: '/audio', badgeKey: null, roles: ['admin', 'agent'],
    icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
  { label: 'Call History', href: '/history', badgeKey: null, roles: ['admin', 'agent'],
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Phone Numbers', href: '/numbers', badgeKey: null, roles: ['admin', 'agent'],
    icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  { label: 'Debug', href: '/debug', badgeKey: null, roles: ['admin', 'agent'],
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  { label: 'Profile', href: '/profile', badgeKey: null, roles: ['admin', 'agent'],
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { label: 'Admin Dashboard', href: '/admin', badgeKey: null, roles: ['admin'],
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: 'User Management', href: '/admin/users', badgeKey: null, roles: ['admin'],
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { label: 'Agent Metrics', href: '/admin/metrics', badgeKey: null, roles: ['admin'],
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { username, firstName, lastName, agentStatus, token, avatarUrl, onboardingComplete, role } = useAppSelector((state) => state.auth);
  const { clientStatus, callState, clientError } = useAppSelector((state) => state.call);
  const { callBadge, smsBadge } = useAppSelector((state) => state.notifications);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [softphoneOpen, setSoftphoneOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [rtcDetailOpen, setRtcDetailOpen] = useState(false);
  const [notifStatus, setNotifStatus] = useState('loading');

  // Show onboarding wizard for new users (wait for profile to load first)
  useEffect(() => {
    if (username && firstName && !onboardingComplete) {
      setShowOnboarding(true);
    } else if (onboardingComplete) {
      setShowOnboarding(false);
    }
  }, [username, firstName, onboardingComplete]);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
    document.documentElement.classList.toggle('dark', next);
  };

  // Auto-open softphone on incoming call
  useEffect(() => {
    if (callState === 'INCOMING') setSoftphoneOpen(true);
  }, [callState]);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    // Validate token isn't expired
    try {
      const payload = JSON.parse(atob(storedToken.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        dispatch(logout());
        router.push('/login');
      }
    } catch {
      localStorage.removeItem('token');
      dispatch(logout());
      router.push('/login');
    }
  }, [router, dispatch]);

  useEffect(() => {
    if (username && !firstName) dispatch(fetchProfile());
  }, [username, firstName, dispatch]);

  // Clear badges when visiting the relevant page
  useEffect(() => {
    if (pathname === '/phone') dispatch(clearCallBadge());
    if (pathname === '/sms') dispatch(clearSmsBadge());
  }, [pathname, dispatch]);

  // Check push notification status on mount
  useEffect(() => {
    getPushStatus().then(setNotifStatus);
  }, []);

  // Listen for notification clicks from service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.url) {
        router.push(event.data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [router]);

  const handleLogout = () => {
    if (username) dispatch(setAgentStatus({ username, status: 'offline' }));
    dispatch(logout());
    router.push('/login');
  };

  const handleSetStatus = (status) => {
    if (username) dispatch(setAgentStatus({ username, status }));
    setStatusMenuOpen(false);
  };

  const AGENT_STATUSES = [
    { value: 'online', label: 'Online', color: 'bg-green-500' },
    { value: 'away', label: 'Away', color: 'bg-yellow-400' },
    { value: 'busy', label: 'Busy', color: 'bg-red-500' },
    { value: 'break', label: 'On Break', color: 'bg-blue-400' },
    { value: 'dnd', label: 'Do Not Disturb', color: 'bg-purple-500' },
    { value: 'offline', label: 'Offline', color: 'bg-gray-400' },
  ];

  const currentStatusConfig = AGENT_STATUSES.find((s) => s.value === agentStatus) || AGENT_STATUSES[5];

  if (!token && typeof window !== 'undefined' && !localStorage.getItem('token')) return null;

  const initials = firstName && lastName ? `${firstName[0]}${lastName[0]}` : 'AG';

  const rtcPill = (() => {
    if (clientStatus === 'ERROR') return { color: 'bg-red-500', label: 'Error', pulse: false };
    if (clientStatus === 'DISCONNECTED') return { color: 'bg-red-500', label: 'Disconnected', pulse: false };
    if (clientStatus !== 'READY') return { color: 'bg-yellow-400', label: 'Connecting', pulse: true };
    if (callState === 'INCOMING') return { color: 'bg-orange-400', label: 'Incoming', pulse: true };
    if (callState === 'DIALING') return { color: 'bg-blue-400', label: 'Dialing', pulse: true };
    if (callState === 'ACTIVE') return { color: 'bg-telnyx-green-vibrant', label: 'On Call', pulse: false };
    return { color: 'bg-telnyx-green-vibrant', label: 'Ready', pulse: false };
  })();

  const badgeMap = { callBadge, smsBadge };
  const filteredNavItems = navItems.filter(item => !item.roles || item.roles.includes(role || 'agent'));

  return (
    <TelnyxRTCWrapper>
      <div className="flex h-screen flex-col bg-[#eff3f6] dark:bg-gray-950">
        {/* Black AppBar Header */}
        <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between bg-black px-4">
          {/* Left: hamburger + Telnyx logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-gray-300 transition-colors hover:text-white"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <img src="/telnyx_logo.png" alt="Telnyx" style={{ height: '2rem', width: 'auto' }} />
          </div>

          {/* Right: WebRTC client + dark mode + status + avatar + logout */}
          <div className="flex items-center gap-3">
            <SoftphoneMini onExpand={() => setSoftphoneOpen(true)} />

            {/* WebRTC status chip - click to see details */}
            <button
              onClick={() => setRtcDetailOpen(!rtcDetailOpen)}
              className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 transition-colors hover:bg-white/20 cursor-pointer relative"
            >
              <span className={`h-2 w-2 rounded-full ${rtcPill.color} ${rtcPill.pulse ? 'status-pulse' : ''}`} />
              <span className="text-xs text-gray-300">{rtcPill.label}</span>
            </button>
            {rtcDetailOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setRtcDetailOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-700 bg-gray-900 p-4 shadow-xl" style={{ right: 'auto' }}>
                  <h3 className="text-sm font-semibold text-white mb-3">WebRTC Client Status</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Connection</span>
                      <span className={`font-medium ${clientStatus === 'READY' ? 'text-green-400' : clientStatus === 'ERROR' || clientStatus === 'DISCONNECTED' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {clientStatus || 'Not initialized'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Call State</span>
                      <span className="text-white font-medium">{callState || 'IDLE'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">SIP User</span>
                      <span className="text-white font-mono">{username || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Agent Status</span>
                      <span className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${currentStatusConfig.color}`} />
                        <span className="text-white">{currentStatusConfig.label}</span>
                      </span>
                    </div>
                    {clientError && (
                      <div className="mt-2 rounded-md bg-red-900/40 border border-red-700/50 p-2">
                        <p className="text-[11px] font-medium text-red-400 mb-0.5">Error</p>
                        <p className="text-[11px] text-red-300 break-words">{clientError}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="h-6 w-px bg-gray-700 hidden sm:block" />

            {/* Push notification toggle */}
            {notifStatus !== 'unsupported' && notifStatus !== 'loading' && (
              <button
                onClick={async () => {
                  if (notifStatus === 'subscribed') {
                    await unsubscribeFromPush();
                    setNotifStatus('unsubscribed');
                  } else if (notifStatus === 'denied') {
                    alert('Notifications are blocked. Please enable them in your browser settings.');
                  } else {
                    const result = await requestPushPermission();
                    if (result === 'granted') {
                      setNotifStatus('subscribed');
                    } else if (result === 'denied') {
                      setNotifStatus('denied');
                      alert('Notification permission was denied. Enable it in your browser settings.');
                    }
                  }
                }}
                className={`rounded-lg p-2 transition-colors ${notifStatus === 'subscribed' ? 'text-telnyx-green' : notifStatus === 'denied' ? 'text-red-400' : 'text-gray-300 hover:text-white'}`}
                title={notifStatus === 'subscribed' ? 'Notifications on — click to disable' : notifStatus === 'denied' ? 'Notifications blocked in browser' : 'Enable notifications'}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </button>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="rounded-lg p-2 text-gray-300 transition-colors hover:text-white"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>

            {/* Avatar with status dot */}
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt={initials} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-telnyx-green text-sm font-semibold text-white">
                  {initials}
                </div>
              )}
              <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black ${currentStatusConfig.color}`} />
            </div>

            {/* Status dropdown */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                className="flex items-center gap-1.5 text-sm text-gray-300 transition-colors hover:text-white"
              >
                <span className={`h-2 w-2 rounded-full ${currentStatusConfig.color}`} />
                <span>{currentStatusConfig.label}</span>
                <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {statusMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setStatusMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-btn border border-gray-700 bg-gray-900 py-1 shadow-xl">
                    {AGENT_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => handleSetStatus(s.value)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-800 ${
                          s.value === agentStatus ? 'text-white' : 'text-gray-300'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${s.color}`} />
                        {s.label}
                        {s.value === agentStatus && (
                          <svg className="ml-auto h-3 w-3 text-telnyx-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Body below header */}
        <div className="flex flex-1 pt-16">
          {/* Left Sidebar */}
          <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} flex flex-col border-r border-gray-200 bg-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-900`}>
            <nav className="flex-1 space-y-1 px-2 py-4">
              {filteredNavItems.map(({ label, href, icon, badgeKey }) => {
                const isActive = pathname === href;
                const count = badgeKey ? badgeMap[badgeKey] : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                    }`}
                    style={isActive ? { backgroundColor: '#00a37a' } : undefined}
                    title={label}
                  >
                    <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                    {sidebarOpen && <span className="ml-3">{label}</span>}
                    {count > 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main content area */}
          <main className="flex-1 overflow-auto p-6 bg-[#eff3f6] dark:bg-gray-950">
            {children}
          </main>
        </div>

        {/* Floating Softphone */}
        <Softphone open={softphoneOpen} onClose={() => setSoftphoneOpen(false)} />
        {showOnboarding && <OnboardingWizard onClose={() => setShowOnboarding(false)} />}
      </div>
    </TelnyxRTCWrapper>
  );
}
