'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  GitBranch,
  Clock,
  Users,
  Hash,
  Settings,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Radio,
  Monitor,
  Headset,
  Contact as ContactIcon,
  ListOrdered,
  Inbox,
  MessageCircle,
  GraduationCap,
  Zap,
  Mic,
  X,
  Menu,
  Send,
  Search,
  PhoneCall,
  LayoutDashboard,
  FileText,
  BarChart3,
  UserCog,
  Network,
  Layers,
  MessageSquare,
  Megaphone,
  BookOpen,
  Hash as HashIcon,
  Workflow,
} from 'lucide-react';
import { SocketProvider, useSocket } from '../../lib/socket';
import ConnectionStatus from '../../components/ConnectionStatus';
import { ToastProvider } from '../../components/Toast';

/* ── Navigation config — grouped ─────────────────────────────────── */
const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { href: '/phone',      label: 'Phone',       Icon: Phone,           badge: null },
      { href: '/inbox',      label: 'Inbox',       Icon: Inbox,           badge: null },
      { href: '/team-chat',  label: 'Team Chat',   Icon: MessageCircle,   badge: null },
      /* Contacts moved out of top-level nav — accessed from Phone > Directory tab and Inbox composer */
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/history',    label: 'Call History', Icon: Clock,           badge: null },
      { href: '/recordings', label: 'Recordings',   Icon: Mic,             badge: null },
      { href: '/wallboard',  label: 'Wallboard',    Icon: Monitor,         badge: null },
    ],
  },
  {
    label: 'Management',
    requiresRole: ['admin', 'supervisor'] as string[],
    items: [
      { href: '/agents',     label: 'Agents',      Icon: Users,           requiresRole: ['admin', 'supervisor'], badge: null },
      { href: '/queues',     label: 'Queues',      Icon: ListOrdered,     requiresRole: ['admin', 'supervisor'], badge: null },
      { href: '/coaching',   label: 'Coaching',    Icon: GraduationCap,   requiresRole: ['admin', 'supervisor'], badge: null },
      { href: '/broadcasts', label: 'Broadcasts',  Icon: Send,            requiresRole: ['admin', 'supervisor'], badge: null },
    ],
  },
  {
    label: 'Configure',
    requiresRole: ['admin'] as string[],
    items: [
      { href: '/ivr',        label: 'IVR Flow',    Icon: GitBranch,       requiresRole: ['admin'], badge: null },
      { href: '/workflows',  label: 'Workflows',   Icon: Zap,             requiresRole: ['admin'], badge: null },
      { href: '/numbers',    label: 'Numbers',     Icon: Hash,            requiresRole: ['admin'], badge: null },
    ],
  },
];

function filterNavGroups(groups: typeof NAV_GROUPS, role: string | null) {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item: any) => !item.requiresRole || (role && item.requiresRole.includes(role))),
    }))
    .filter((g) => {
      if (g.requiresRole && !role) return false;
      if (g.requiresRole && role && !g.requiresRole.includes(role)) return false;
      return g.items.length > 0;
    });
}

/* ── Command palette pages ──────────────────────────────────────────── */
const COMMAND_PAGES = [
  { href: '/phone',      label: 'Phone',         Icon: Phone,          desc: 'Softphone & active calls' },
  { href: '/inbox',      label: 'Inbox',         Icon: Inbox,          desc: 'Conversations & SMS' },
  { href: '/team-chat',  label: 'Team Chat',     Icon: MessageCircle,  desc: 'Internal team messaging' },
  { href: '/contacts',   label: 'Contacts',      Icon: ContactIcon,   desc: 'Contact directory' },
  { href: '/history',    label: 'Call History',  Icon: Clock,          desc: 'Call logs & analytics' },
  { href: '/recordings', label: 'Recordings',    Icon: Mic,            desc: 'Call recordings & QA' },
  { href: '/agents',     label: 'Agents',         Icon: Users,          desc: 'Agent management' },
  { href: '/queues',     label: 'Queues',         Icon: ListOrdered,   desc: 'Queue configuration' },
  { href: '/numbers',    label: 'Numbers',        Icon: Hash,           desc: 'Phone numbers & routing' },
  { href: '/ivr',        label: 'IVR Flow',       Icon: GitBranch,      desc: 'IVR menu builder' },
  { href: '/workflows',  label: 'Workflows',      Icon: Zap,            desc: 'Automation workflows' },
  { href: '/broadcasts', label: 'Broadcasts',     Icon: Send,          desc: 'SMS campaigns' },
  { href: '/coaching',  label: 'Coaching',       Icon: GraduationCap, desc: 'Agent coaching & QA' },
  { href: '/wallboard',  label: 'Wallboard',      Icon: Monitor,       desc: 'Live dashboard' },
  { href: '/profile',    label: 'Profile',        Icon: Settings,       desc: 'Account settings' },
];

/* ── Breadcrumb helper ─────────────────────────────────────────────── */
function buildBreadcrumbs(pathname: string) {
  if (!pathname || pathname === '/') return [{ label: 'Dashboard' }];
  const segments = pathname.split('/').filter(Boolean);
  return [
    { label: 'Home', href: '/' },
    ...segments.map((seg, i) => ({
      label: seg.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      href: '/' + segments.slice(0, i + 1).join('/'),
      isLast: i === segments.length - 1,
    })),
  ];
}

/* ── Role → gradient ring colour ──────────────────────────────────── */
const ROLE_RING: Record<string, { from: string; to: string; label: string; bg: string; text: string }> = {
  admin:      { from: 'var(--accent)',  to: 'var(--accent-dark)', label: 'Admin',      bg: 'var(--accent-glow)',          text: 'var(--accent)' },
  supervisor: { from: '#6366f1',        to: '#818cf8',            label: 'Supervisor', bg: 'rgba(99,102,241,0.12)',        text: '#818cf8' },
  agent:      { from: '#10b981',        to: '#34d399',            label: 'Agent',      bg: 'rgba(16,185,129,0.12)',        text: '#10b981' },
};

function getRoleStyle(role: string) {
  return ROLE_RING[role] || ROLE_RING.agent;
}

/* ── Tooltip (collapsed sidebar) ─────────────────────────────────── */
function NavTooltip({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactNode }) {
  if (!collapsed) return <>{children}</>;
  return (
    <div className="relative group">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
        <div className="px-2.5 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault shadow-tx-lg text-[12px] font-medium text-tx-tp whitespace-nowrap">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-tx-s3" />
        </div>
      </div>
    </div>
  );
}

/* ── Single nav item ──────────────────────────────────────────────── */
function NavItem({
  href, label, Icon, badge, isActive, collapsed, hoveredNav, setHoveredNav,
  dotColor, dotCount,
}: {
  href: string; label: string; Icon: any; badge: number | null;
  isActive: boolean; collapsed: boolean; hoveredNav: string | null;
  setHoveredNav: (v: string | null) => void;
  dotColor?: string | null;  // 'green' | 'amber' | null — small indicator dot
  dotCount?: number | null;  // count shown inside the badge for dotColor
}) {
  return (
    <NavTooltip label={label} collapsed={collapsed}>
      <Link
        href={href}
        onMouseEnter={() => setHoveredNav(href)}
        onMouseLeave={() => setHoveredNav(null)}
        className="relative block"
      >
        {isActive && (
          <motion.div
            layoutId="nav-accent-bar"
            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
            style={{ background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent-dark) 100%)' }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
        {isActive && (
          <motion.div
            layoutId="nav-active"
            className="absolute inset-0 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, var(--accent-glow) 0%, var(--citron-dim) 100%)',
              border: '1px solid var(--border-subtle)',
            }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          />
        )}
        {!isActive && hoveredNav === href && (
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{ background: 'var(--citron-dim)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
        <div className={`relative flex items-center gap-3 px-3 py-[7px] rounded-xl transition-colors duration-150 ${
          isActive ? 'text-tx-green' : 'text-tx-ts hover:text-tx-tp'
        } ${isActive && collapsed ? 'pl-4' : ''}`}>
          <Icon
            className="w-[16px] h-[16px] flex-shrink-0 transition-all duration-200"
            strokeWidth={isActive ? 2.2 : 1.6}
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="text-[13px] font-medium truncate flex-1"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
          {/* Inbox unread count badge */}
          {badge != null && badge > 0 && (
            <AnimatePresence>
              {!collapsed ? (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  className="ml-auto min-w-[18px] h-[18px] rounded-full bg-tx-red text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none"
                >
                  {badge}
                </motion.span>
              ) : (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-tx-red text-white text-[8px] font-bold flex items-center justify-center px-1 leading-none"
                >
                  {badge}
                </motion.span>
              )}
            </AnimatePresence>
          )}
          {/* Dot indicators: active call (green) / queue waiting (amber) */}
          {dotColor && !badge && (
            <AnimatePresence>
              {!collapsed ? (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  className={`ml-auto flex items-center gap-1 ${
                    dotColor === 'green'
                      ? 'text-tx-green'
                      : 'text-tx-citron'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full live-dot ${
                    dotColor === 'green' ? 'bg-tx-green' : 'bg-tx-citron'
                  }`} />
                  {dotCount != null && dotCount > 0 && (
                    <span className="text-[10px] font-bold tabular-nums">{dotCount}</span>
                  )}
                </motion.span>
              ) : (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full live-dot ${
                    dotColor === 'green' ? 'bg-tx-green' : 'bg-tx-citron'
                  }`}
                />
              )}
            </AnimatePresence>
          )}
        </div>
      </Link>
    </NavTooltip>
  );
}

/* ══════════════════════════════════════════════════════════════════
   COMMAND PALETTE (Ctrl+K)
   ══════════════════════════════════════════════════════════════════ */
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return COMMAND_PAGES;
    const q = query.toLowerCase();
    return COMMAND_PAGES.filter(
      (p) => p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => { setSelectedIdx(0); }, [filtered]);
  useEffect(() => { if (open) { setQuery(''); inputRef.current?.focus(); } }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' && filtered[selectedIdx]) { e.preventDefault(); router.push(filtered[selectedIdx].href); onClose(); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, selectedIdx, router, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-[560px] z-50"
          >
            <div className="mx-4 rounded-2xl border border-tx-bdefault bg-tx-s1 shadow-2xl overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-tx-bdefault">
                <Search className="w-4 h-4 text-tx-tt flex-shrink-0" strokeWidth={2} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages..."
                  className="flex-1 bg-transparent text-[14px] text-tx-tp placeholder:text-tx-tt outline-none"
                />
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-tx-bdefault bg-tx-s3 text-[10px] text-tx-tt font-mono">ESC</kbd>
              </div>
              {/* Results */}
              <div className="max-h-[340px] overflow-auto py-1.5 px-1.5">
                {filtered.length === 0 && (
                  <div className="px-4 py-6 text-center text-[13px] text-tx-tt">No results found</div>
                )}
                {filtered.map((page, i) => (
                  <button
                    key={page.href}
                    onClick={() => { router.push(page.href); onClose(); }}
                    onMouseEnter={() => setSelectedIdx(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                      i === selectedIdx ? 'bg-tx-green/10 text-tx-green' : 'text-tx-tp hover:bg-tx-s3'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      i === selectedIdx ? 'bg-tx-green/15 text-tx-green' : 'bg-tx-s3 text-tx-tt'
                    }`}>
                      <page.Icon className="w-4 h-4" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium">{page.label}</p>
                      <p className="text-[11px] text-tx-tt truncate">{page.desc}</p>
                    </div>
                    {i === selectedIdx && (
                      <span className="text-[10px] text-tx-tt font-mono border border-tx-bdefault rounded px-1.5 py-0.5 bg-tx-s3">↵</span>
                    )}
                  </button>
                ))}
              </div>
              {/* Footer */}
              <div className="px-4 py-2 border-t border-tx-bdefault flex items-center gap-4 text-[10px] text-tx-tt">
                <span className="flex items-center gap-1"><kbd className="font-mono border border-tx-bdefault rounded px-1 py-0.5 bg-tx-s3">↑↓</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="font-mono border border-tx-bdefault rounded px-1 py-0.5 bg-tx-s3">↵</kbd> open</span>
                <span className="flex items-center gap-1"><kbd className="font-mono border border-tx-bdefault rounded px-1 py-0.5 bg-tx-s3">esc</kbd> close</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN LAYOUT
   ════════════════════════════════════════════════════════════════ */
function InnerLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]           = useState<any>(null);
  const [darkMode, setDarkMode]   = useState<boolean>(true);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  /* ── Socket-driven badge state ────────────────────────────────── */
  const { on } = useSocket();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [hasActiveCall, setHasActiveCall] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [queueWaiting, setQueueWaiting] = useState<number>(0);
  const prevQueueWaitingRef = useRef<number>(0);

  useEffect(() => {
    const cleanups: (() => void)[] = [];
    cleanups.push(on('chat:message', (data: any) => {
      // Increment unread if conversation is not currently selected in inbox
      setUnreadCount((c) => c + 1);
    }));
    cleanups.push(on('chat:read', () => {
      setUnreadCount(0);
    }));
    cleanups.push(on('call:ringing', (data: any) => {
      setHasActiveCall(true);
      if (!callStartTime) setCallStartTime(Date.now());
      // Show a toast for incoming calls
      const from = data?.from || 'Unknown';
      if (Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
      try {
        new Notification('Incoming Call', { body: `From ${from}`, icon: '/favicon.ico' });
      } catch {}
    }));
    cleanups.push(on('call:answered', () => {
      setHasActiveCall(true);
      if (!callStartTime) setCallStartTime(Date.now());
    }));
    cleanups.push(on('call:ended', () => {
      setHasActiveCall(false);
      setCallStartTime(null);
      setCallDuration(0);
    }));
    cleanups.push(on('queue:update', (data: any) => {
      const entries = Object.values(data || {}) as any[];
      const total: number = entries.reduce((sum, q) => sum + (q.waiting || 0), 0);
      setQueueWaiting(total);
      // Notify if queue depth spike
      if (total > prevQueueWaitingRef.current && total >= 3) {
        try {
          new Notification('Queue Depth Alert', { body: `${total} caller${total > 1 ? 's' : ''} waiting in queue`, icon: '/favicon.ico' });
        } catch {}
      }
      prevQueueWaitingRef.current = total;
    }));
    // Fetch initial unread count
    fetch('/api/conversations?status=waiting&limit=0', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json())
      .then((d) => { if (d.total) setUnreadCount(d.total); })
      .catch(() => {});
    return () => cleanups.forEach((fn) => fn());
  }, [on]);

  /* ── Tick active call duration every second ─────────────────── */
  useEffect(() => {
    if (!callStartTime) return;
    const id = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [callStartTime]);

  const fmtCallDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  /* ── Update document.title with call duration ─────────────── */
  useEffect(() => {
    if (hasActiveCall && callDuration > 0) {
      document.title = `📞 ${fmtCallDuration(callDuration)} — Telnyx CC`;
    } else {
      document.title = 'Telnyx Contact Center';
    }
  }, [hasActiveCall, callDuration]);

  /* ── Request notification permission on mount ───────────────── */
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      // Don't auto-request — only request when relevant (incoming call)
    }
  }, []);

  /* ── Command palette (Ctrl+K) + quick-nav shortcuts ─────────── */
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      // Quick navigation shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); router.push('/phone'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); router.push('/inbox'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') { e.preventDefault(); router.push('/team-chat'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  /* ── Auth & theme ────────────────────────────────────────────── */
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.replace('/login'); return; }
    setUser(JSON.parse(stored));
    const dm = localStorage.getItem('darkMode');
    // default dark unless explicitly set to false
    if (dm === 'false') setDarkMode(false);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  /* ── Clock ────────────────────────────────────────────────────── */
  useEffect(() => {
    function tick() {
      setCurrentTime(
        new Date().toLocaleTimeString('en-AU', {
          hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Australia/Melbourne',
        })
      );
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  /* Close mobile drawer on route change */
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  /* ── Helpers ─────────────────────────────────────────────────── */
  function handleSignOut() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  }

  const userInitials = user?.displayName
    ? user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.[0]?.toUpperCase() || '?';

  const roleStyle        = getRoleStyle(user?.role);
  const breadcrumbs      = useMemo(() => buildBreadcrumbs(pathname), [pathname]);
  const visibleNavGroups = filterNavGroups(NAV_GROUPS, user?.role);

  /* ── Sidebar content (shared desktop + mobile) ───────────────── */
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`px-4 py-4 border-b border-tx-bdefault ${collapsed ? 'px-3' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-tx-md">
            <Headset className="w-[18px] h-[18px] text-tx-ti" strokeWidth={2.2} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <h1 className="text-[14px] font-bold text-tx-tp tracking-tight leading-none">Telnyx</h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[11px] font-medium text-tx-ts tracking-tight leading-none">Contact Center</span>
                  <span className="inline-flex items-center gap-1 ml-1">
                    <Radio className="w-2.5 h-2.5 text-tx-green" />
                    <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-gradient">Live</span>
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Grouped navigation ─────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-thin">
        {visibleNavGroups.map((group) => (
          <div key={group.label} className="mb-3">
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-tx-tt select-none"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            {collapsed && <div className="mx-auto mb-1.5 w-5 h-px bg-tx-bdefault" />}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, Icon, badge }: any) => {
                // Compute dynamic badges & dot indicators
                let dynBadge = badge;
                let dotColor: string | null = null;
                let dotCount: number | null = null;
                if (href === '/inbox' && unreadCount > 0) dynBadge = unreadCount;
                if (href === '/phone' && hasActiveCall) { dotColor = 'green'; dotCount = null; }
                if (href === '/queues' && queueWaiting > 0) { dotColor = 'amber'; dotCount = queueWaiting; }
                return (
                  <NavItem
                    key={href}
                    href={href}
                    label={label}
                    Icon={Icon}
                    badge={dynBadge}
                    isActive={pathname.startsWith(href)}
                    collapsed={collapsed}
                    hoveredNav={hoveredNav}
                    setHoveredNav={setHoveredNav}
                    dotColor={dotColor}
                    dotCount={dotCount}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {/* Settings pinned at bottom of nav */}
        <div className="mt-2 border-t border-tx-bdefault pt-2">
          <NavItem
            href="/profile"
            label="Settings"
            Icon={Settings}
            badge={null}
            isActive={pathname.startsWith('/profile')}
            collapsed={collapsed}
            hoveredNav={hoveredNav}
            setHoveredNav={setHoveredNav}
          />
        </div>
      </nav>

      {/* ── Bottom section ─────────────────────────────────────── */}
      <div className="px-2.5 pb-3 border-t border-tx-bdefault pt-3 space-y-0.5">
        {/* User card */}
        <AnimatePresence>
          {!collapsed && user ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="px-3 py-2.5 mb-1.5 rounded-xl bg-tx-s2 border border-tx-bsubtle"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full p-[2px] flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${roleStyle.from} 0%, ${roleStyle.to} 100%)` }}
                >
                  <div className="w-full h-full rounded-full bg-tx-s2 flex items-center justify-center text-[10px] font-bold text-tx-tp">
                    {userInitials}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-tx-tp truncate leading-tight">
                    {user.displayName || user.username}
                  </p>
                  <span
                    className="inline-block mt-0.5 px-1.5 py-[1px] rounded text-[9px] font-semibold uppercase tracking-wide leading-tight"
                    style={{ background: roleStyle.bg, color: roleStyle.text }}
                  >
                    {roleStyle.label}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : collapsed && user ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex justify-center mb-1.5"
            >
              <div
                className="w-8 h-8 rounded-full p-[2px]"
                style={{ background: `linear-gradient(135deg, ${roleStyle.from} 0%, ${roleStyle.to} 100%)` }}
              >
                <div className="w-full h-full rounded-full bg-tx-s1 flex items-center justify-center text-[10px] font-bold text-tx-tp">
                  {userInitials}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-tx-tt hover:text-tx-ts hover:bg-tx-s2 transition-all duration-150"
        >
          <motion.div
            key={darkMode ? 'moon' : 'sun'}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {darkMode
              ? <Sun className="w-[17px] h-[17px]" strokeWidth={1.5} />
              : <Moon className="w-[17px] h-[17px]" strokeWidth={1.5} />}
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                className="text-[13px] font-medium"
              >
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-tx-tt hover:text-tx-red hover:bg-tx-red/[0.06] transition-all duration-150"
        >
          <LogOut className="w-[17px] h-[17px]" strokeWidth={1.5} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                className="text-[13px] font-medium"
              >
                Sign out
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse/expand toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-full items-center gap-3 px-3 py-2 rounded-xl text-tx-tt hover:text-tx-ts hover:bg-tx-s2 transition-all duration-150"
        >
          {collapsed
            ? <ChevronRight className="w-[17px] h-[17px]" strokeWidth={1.5} />
            : <ChevronLeft  className="w-[17px] h-[17px]" strokeWidth={1.5} />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                className="text-[13px] font-medium"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </>
  );

  return (
    <>
      <ConnectionStatus />
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <div className="min-h-screen flex bg-tx-s0">
          <div className="bg-mesh-premium" aria-hidden="true" />

          <div className="app-shell flex flex-1 min-h-screen w-full">
            {/* ── Desktop Sidebar ──────────────────────────────────── */}
            <motion.aside
              animate={{ width: collapsed ? 72 : 260 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:flex relative flex-col border-r border-tx-bdefault bg-tx-s1 z-20 flex-shrink-0"
            >
              {sidebarContent}
            </motion.aside>

            {/* ── Mobile Overlay + Drawer ──────────────────────────── */}
            <AnimatePresence>
              {mobileOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                  />
                  <motion.aside
                    initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="fixed left-0 top-0 bottom-0 w-[280px] flex flex-col border-r border-tx-bdefault bg-tx-s1 z-40 lg:hidden"
                  >
                    <button
                      onClick={() => setMobileOpen(false)}
                      className="absolute -right-3 top-4 w-6 h-6 rounded-full bg-tx-s3 border border-tx-bdefault text-tx-ts hover:text-tx-tp hover:bg-tx-s4 flex items-center justify-center shadow-tx-md transition-colors z-50"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {sidebarContent}
                  </motion.aside>
                </>
              )}
            </AnimatePresence>

            {/* ── Right Column (top bar + content) ────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Top Header Bar */}
              <header className="flex-shrink-0 h-14 border-b border-tx-bdefault bg-tx-s1/80 backdrop-blur-md flex items-center gap-4 px-4 lg:px-6 z-10">
                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileOpen(true)}
                  className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-tx-s2 transition-colors text-tx-ts hover:text-tx-tp"
                >
                  <Menu className="w-5 h-5" strokeWidth={1.5} />
                </button>

                {/* Breadcrumbs */}
                <nav className="flex items-center gap-1.5 text-[13px] min-w-0">
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1.5 min-w-0">
                      {i > 0 && <span className="text-tx-tt">/</span>}
                      {crumb.isLast || i === breadcrumbs.length - 1 ? (
                        <span className="font-medium text-tx-tp truncate">{crumb.label}</span>
                      ) : (crumb as any).href ? (
                        <Link href={(crumb as any).href} className="text-tx-tt hover:text-tx-ts transition-colors truncate">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-tx-tt truncate">{crumb.label}</span>
                      )}
                    </span>
                  ))}
                </nav>

                <div className="flex-1" />

                {/* Current Time */}
                <div className="hidden md:flex items-center text-[12px] font-medium text-tx-tt tabular-nums tracking-wide">
                  {currentTime}
                </div>

                {/* Active call duration — shown across all pages */}
                {hasActiveCall && callDuration > 0 && (
                  <Link
                    href="/phone"
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-tx-green/30 bg-tx-green/10 text-tx-green hover:bg-tx-green/15 transition-colors cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full bg-tx-green live-dot" />
                    <PhoneCall className="w-3.5 h-3.5" strokeWidth={2} />
                    <span className="text-[12px] font-bold tabular-nums">{fmtCallDuration(callDuration)}</span>
                  </Link>
                )}

                {/* Command palette trigger */}
                <button
                  onClick={() => setPaletteOpen(true)}
                  className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-tx-bdefault bg-tx-s2 hover:bg-tx-s3 transition-colors text-tx-tt hover:text-tx-ts"
                >
                  <Search className="w-3.5 h-3.5" strokeWidth={1.8} />
                  <span className="text-[11px] font-medium">Search</span>
                  <kbd className="text-[9px] font-mono border border-tx-bdefault rounded px-1 py-px bg-tx-s3 text-tx-tt">⌘K</kbd>
                </button>
              </header>

              {/* Main Content */}
              <main className="flex-1 overflow-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={pathname}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="min-h-full p-4 lg:p-6 xl:p-8"
                  >
                    <div className="mx-auto max-w-[1440px]">
                      {children}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
          </div>
        </div>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <ToastProvider>
        <ConnectionStatus />
        <InnerLayout>{children}</InnerLayout>
      </ToastProvider>
    </SocketProvider>
  );
}
