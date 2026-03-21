'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAppSelector, useAppDispatch } from '../../src/store/hooks';
import { logout, setAgentStatus, fetchProfile } from '../../src/features/auth/authSlice';
import { clearCallBadge, clearSmsBadge } from '../../src/features/notifications/notificationSlice';
import TelnyxRTCWrapper from '../components/TelnyxRTCWrapper';
import SoftphoneMini from '../components/SoftphoneMini';
import Softphone from '../components/Softphone';
import OnboardingWizard from '../components/OnboardingWizard';

const navItems = [
  { label: 'Agent Dashboard', href: '/dashboard', badgeKey: null,
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Phone', href: '/phone', badgeKey: 'callBadge',
    icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  { label: 'Conversations', href: '/sms', badgeKey: 'smsBadge',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { label: 'IVR Builder', href: '/ivr', badgeKey: null,
    icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { label: 'Call History', href: '/history', badgeKey: null,
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Phone Numbers', href: '/numbers', badgeKey: null,
    icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  { label: 'Profile', href: '/profile', badgeKey: null,
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { username, firstName, lastName, agentStatus, token, avatarUrl, onboardingComplete } = useAppSelector((state) => state.auth);
  const { clientStatus, callState } = useAppSelector((state) => state.call);
  const { callBadge, smsBadge } = useAppSelector((state) => state.notifications);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [softphoneOpen, setSoftphoneOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

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
    if (!storedToken) router.push('/login');
  }, [router]);

  useEffect(() => {
    if (username && !firstName) dispatch(fetchProfile());
  }, [username, firstName, dispatch]);

  // Clear badges when visiting the relevant page
  useEffect(() => {
    if (pathname === '/phone') dispatch(clearCallBadge());
    if (pathname === '/sms') dispatch(clearSmsBadge());
  }, [pathname, dispatch]);

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
            <Image src="/telnyx_logo.png" alt="Telnyx" width={120} height={32} className="h-8 w-auto" priority />
          </div>

          {/* Right: WebRTC client + dark mode + status + avatar + logout */}
          <div className="flex items-center gap-3">
            <SoftphoneMini onExpand={() => setSoftphoneOpen(true)} />

            {/* WebRTC status chip */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
              <span className={`h-2 w-2 rounded-full ${rtcPill.color} ${rtcPill.pulse ? 'status-pulse' : ''}`} />
              <span className="text-xs text-gray-300">{rtcPill.label}</span>
            </div>

            <div className="h-6 w-px bg-gray-700 hidden sm:block" />

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
              {navItems.map(({ label, href, icon, badgeKey }) => {
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
