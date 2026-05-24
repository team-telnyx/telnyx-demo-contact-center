'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../lib/api';
import {
  User,
  Key,
  Signal,
  Brain,
  Mic,
  Settings,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Camera,
  Bell,
  Sun,
  Moon,
  Phone,
  MessageSquare,
  BarChart3,
  Mail,
} from 'lucide-react';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'theme', label: 'Theme', icon: Sun },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Mic },
  { id: 'sip', label: 'SIP Configuration', icon: Signal },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded-md text-tx-tt hover:text-tx-ts hover:bg-tx-s3 transition-colors" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-tx-green" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [sipConfig, setSipConfig] = useState<any>(null);
  const [features, setFeatures] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');
  const [activeSection, setActiveSection] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);

  // Profile form
  const [profileForm, setProfileForm] = useState({ displayName: '', email: '' });
  const [profileEditing, setProfileEditing] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState(() => {
    if (typeof window === 'undefined') return { newCall: true, newSms: true, queueThreshold: false, weeklySummary: false };
    try {
      const stored = localStorage.getItem('notification-prefs');
      return stored ? JSON.parse(stored) : { newCall: true, newSms: true, queueThreshold: false, weeklySummary: false };
    } catch { return { newCall: true, newSms: true, queueThreshold: false, weeklySummary: false }; }
  });

  // Theme preference
  const [themeDark, setThemeDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem('theme-preference');
      return stored === 'dark';
    } catch { return false; }
  });

  // Apply theme class on mount and when toggled
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (themeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme-preference', themeDark ? 'dark' : 'light');
  }, [themeDark]);


  const sectionRefs = useRef({});

  useEffect(() => {
    async function loadProfile() {
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        const [profileData, sipData, featuresData] = await Promise.all([
          api.get('/agents/me/profile').catch(() => null),
          api.get('/voice/sip-config').catch(() => null),
          api.get('/features').catch(() => null),
        ]);
        setUser(stored);
        setAgent(profileData);
        setSipConfig(sipData);
        setFeatures(featuresData);
        setProfileForm({
          displayName: stored?.displayName || '',
          email: stored?.email || '',
        });
      } catch (err: any) { console.error('Failed to load profile', err); }
      finally { setLoading(false); }
    }
    loadProfile();
  }, []);

  // Intersection observer for active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3, rootMargin: '-80px 0px -50% 0px' }
    );

    SECTIONS.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [loading]);

  const scrollToSection = (id) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showSave = (msg) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  async function updateQueues(queuesStr) {
    if (!agent) return;
    const queues = queuesStr.split(',').map((q) => q.trim()).filter(Boolean);
    try {
      const updated = await api.patch(`/agents/${agent.id}`, { queues });
      setAgent((prev) => ({ ...prev, ...updated }));
      showSave('Queues updated');
    } catch (err: any) { console.error('Failed to update queues', err); }
  }

  async function updatePriority(priority) {
    if (!agent) return;
    try {
      const updated = await api.patch(`/agents/${agent.id}`, { priority: parseInt(priority) });
      setAgent((prev) => ({ ...prev, ...updated }));
      showSave('Priority updated');
    } catch (err: any) { console.error('Failed to update priority', err); }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="shimmer h-32 rounded-xl" />))}
        </div>
      </div>
    );
  }

  const userInitials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.[0]?.toUpperCase() || '?';

  return (
    <div className="p-6">
      <div className="flex items-start gap-3.5 mb-8">
        <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-tx-green/20 flex-shrink-0">
          <Settings className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-tx-tp tracking-tight">Settings</h1>
          <p className="text-[11px] text-tx-ts mt-0.5">Manage your account, preferences, and configuration</p>
        </div>
      </div>

      <AnimatePresence>
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-50 bg-tx-green/10 border border-tx-green/20 text-tx-green px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg backdrop-blur-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            {saveMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-8">
        {/* Left sub-nav */}
        <nav className="w-52 shrink-0">
          <div className="sticky top-6 space-y-0.5">
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  onClick={() => scrollToSection(id)}
                  className={`relative w-full flex items-center gap-2.5 pl-4 pr-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-tx-green/10 text-tx-green'
                      : 'text-tx-ts hover:text-tx-tp hover:bg-tx-s3'
                  }`}
                >
                  {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-tx-green shadow-[0_0_8px_rgba(0,192,139,0.4)]" />}
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right content */}
        <div className="flex-1 max-w-2xl space-y-6 pb-24">

          {/* ── Profile ── */}
          <section id="profile" ref={(el) => { sectionRefs.current['profile'] = el; }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-tx-green" />
                  <h2 className="text-sm font-semibold text-tx-tp">Profile</h2>
                </div>
                <button
                  onClick={() => setProfileEditing(!profileEditing)}
                  className="text-xs text-tx-green hover:text-tx-green/80 font-medium"
                >
                  {profileEditing ? 'Cancel' : 'Edit'}
                </button>
              </div>

              <div className="flex items-start gap-5">
                <div className="relative group">
                  <div className="w-16 h-16 rounded-2xl gradient-primary text-white shadow-lg shadow-tx-green/20 flex items-center justify-center text-xl font-bold tracking-wider">
                    {userInitials}
                  </div>
                  {profileEditing && (
                    <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-4">
                  {profileEditing ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-tx-ts mb-1.5">Display Name</label>
                        <input
                          type="text"
                          value={profileForm.displayName}
                          onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))}
                          className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
                          placeholder="Your display name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-tx-ts mb-1.5">Email</label>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                          className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
                          placeholder="your@email.com"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            const updated = { ...user, displayName: profileForm.displayName, email: profileForm.email };
                            localStorage.setItem('user', JSON.stringify(updated));
                            setUser(updated);
                            setProfileEditing(false);
                            showSave('Profile updated');
                          }}
                          className="px-4 py-2 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-tx-green/20"
                        >
                          Save Changes
                        </button>
                        <button onClick={() => setProfileEditing(false)} className="px-4 py-2 rounded-xl text-sm text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors">
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Display Name</span>
                        <p className="font-medium text-tx-tp mt-0.5">{user?.displayName || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Email</span>
                        <p className="font-medium text-tx-tp mt-0.5">{user?.email || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Username</span>
                        <p className="font-medium text-tx-tp mt-0.5">{user?.username || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Role</span>
                        <p className="font-medium text-tx-tp mt-0.5 capitalize">{user?.role || '—'}</p>
                      </div>
                      {agent && (
                        <div className="col-span-2">
                          <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Agent ID</span>
                          <p className="font-mono text-xs text-tx-ts mt-0.5">{agent.id}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── Keyboard Shortcuts ── */}
          <section id="shortcuts" ref={(el) => { sectionRefs.current['shortcuts'] = el; }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Mic className="w-4 h-4 text-tx-green" />
                <h2 className="text-sm font-semibold text-tx-tp">Keyboard Shortcuts</h2>
              </div>
              <p className="text-xs text-tx-ts mb-4">Quick actions available across the app. Shortcuts work on any page.</p>
              <div className="grid gap-2">
                {[
                  { keys: ['⌘', 'K'], action: 'Open command palette — search and navigate to any page' },
                  { keys: ['⌘', '1'], action: 'Go to Phone page' },
                  { keys: ['⌘', '2'], action: 'Go to Inbox' },
                  { keys: ['⌘', '3'], action: 'Go to Team Chat' },
                  { keys: ['Esc'], action: 'Close modals, dialogs, and command palette' },
                  { keys: ['↑', '↓'], action: 'Navigate items in command palette and lists' },
                  { keys: ['Enter'], action: 'Select / confirm focused item' },
                ].map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-tx-s3/50 border border-tx-bsubtle">
                    <span className="text-[13px] text-tx-tp">{shortcut.action}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && <span className="text-[10px] text-tx-tt">+</span>}
                          <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md border border-tx-bdefault bg-tx-s1 text-[11px] font-mono font-medium text-tx-ts shadow-sm">{key}</kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* ── SIP Configuration ── */}
          <section id="sip" ref={(el) => { sectionRefs.current['sip'] = el; }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Signal className="w-4 h-4 text-tx-green" />
                <h2 className="text-sm font-semibold text-tx-tp">SIP Configuration</h2>
              </div>
              <p className="text-xs text-tx-ts mb-4">Credentials used by the WebRTC softphone to connect to Telnyx. Keep these secure.</p>
              <div className="space-y-0 text-sm">
                <div className="flex items-center justify-between py-3 border-b border-tx-bdefault">
                  <span className="text-tx-ts text-xs">SIP Username</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-tx-tp bg-tx-s3 border border-tx-bdefault px-3 py-1.5 rounded-lg">{sipConfig?.sipUsername || '—'}</span>
                    <CopyButton text={sipConfig?.sipUsername} />
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-tx-bdefault">
                  <span className="text-tx-ts text-xs">SIP Connection ID</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-tx-tp bg-tx-s3 border border-tx-bdefault px-3 py-1.5 rounded-lg">{sipConfig?.sipConnectionId || '—'}</span>
                    <CopyButton text={sipConfig?.sipConnectionId} />
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-tx-bdefault">
                  <span className="text-tx-ts text-xs">SIP Password</span>
                  <div className="flex items-center gap-2">
                    <span className="text-tx-ts text-sm font-mono">
                      {showPassword ? (sipConfig?.sipPassword || '—') : '••••••••'}
                    </span>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 rounded-md text-tx-tt hover:text-tx-ts hover:bg-tx-s3 transition-colors"
                      title={showPassword ? 'Hide' : 'Show'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <CopyButton text={sipConfig?.sipPassword} />
                  </div>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-tx-ts text-xs">SIP Server</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-tx-tp bg-tx-s3 border border-tx-bdefault px-3 py-1.5 rounded-lg">sip.telnyx.com</span>
                    <CopyButton text="sip.telnyx.com" />
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── Agent Settings (if applicable) ── */}
          {agent && (
            <section id="agent" ref={(el) => { sectionRefs.current['agent'] = el; }}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.075 }} className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-tx-green" />
                  <h2 className="text-sm font-semibold text-tx-tp">Agent Settings</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-tx-ts mb-1.5">Priority (lower = higher priority)</label>
                    <input type="number" value={agent.priority || 99} onChange={(e) => updatePriority(e.target.value)} className="w-32 bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]" min={1} max={999} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-tx-ts mb-1.5">Queues (comma-separated)</label>
                    <input type="text" defaultValue={(agent.queues || []).join(', ')} onKeyDown={(e) => { if (e.key === 'Enter') updateQueues((e.target as HTMLInputElement).value); }} className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]" placeholder="clinical_queue, care_queue, billing_queue" />
                  </div>
                </div>
              </motion.div>
            </section>
          )}

          {/* ── Notifications ── */}
          <section id="notifications" ref={(el) => { sectionRefs.current['notifications'] = el; }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-tx-green" />
                <h2 className="text-sm font-semibold text-tx-tp">Notifications</h2>
              </div>
              <p className="text-xs text-tx-ts mb-4">Choose which alerts you want to receive.</p>
              <div className="space-y-2">
                {[
                  { key: 'newCall', label: 'New call alerts', desc: 'Get notified when a call arrives', Icon: Phone },
                  { key: 'newSms', label: 'New SMS alerts', desc: 'Get notified when an SMS arrives', Icon: MessageSquare },
                  { key: 'queueThreshold', label: 'Queue threshold alerts', desc: 'Alert when queue depth exceeds limits', Icon: BarChart3 },
                  { key: 'weeklySummary', label: 'Weekly summary email', desc: 'Receive a weekly performance digest', Icon: Mail },
                ].map(({ key, label, desc, Icon }) => {
                  const isOn = notifPrefs[key];
                  return (
                    <div key={key} className="flex items-center justify-between py-3 px-4 rounded-xl bg-tx-s3 border border-tx-bdefault hover:border-tx-bstrong transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isOn ? 'bg-tx-green/15 text-tx-green' : 'bg-tx-s4 text-tx-tt'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-tx-tp">{label}</p>
                          <p className="text-[11px] text-tx-tt truncate">{desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const updated = { ...notifPrefs, [key]: !isOn };
                          setNotifPrefs(updated);
                          localStorage.setItem('notification-prefs', JSON.stringify(updated));
                        }}
                        className={`relative inline-flex items-center w-10 h-[22px] rounded-full transition-colors duration-200 focus:outline-none ${isOn ? 'bg-tx-green' : 'bg-tx-s4 border border-tx-bdefault'}`}
                        role="switch"
                        aria-checked={isOn}
                      >
                        <span className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200 ${isOn ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </section>

          {/* ── Theme ── */}
          <section id="theme" ref={(el) => { sectionRefs.current['theme'] = el; }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                {themeDark ? <Moon className="w-4 h-4 text-tx-green" /> : <Sun className="w-4 h-4 text-tx-green" />}
                <h2 className="text-sm font-semibold text-tx-tp">Theme</h2>
              </div>
              <p className="text-xs text-tx-ts mb-4">Switch between light and dark appearance.</p>
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-tx-s3 border border-tx-bdefault">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${themeDark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-tx-green/15 text-tx-green'}`}>
                    {themeDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-tx-tp">{themeDark ? 'Dark mode' : 'Light mode'}</p>
                    <p className="text-[11px] text-tx-tt">{themeDark ? 'Easier on the eyes in low light' : 'Bright and clean default look'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setThemeDark(!themeDark)}
                  className={`relative inline-flex items-center w-10 h-[22px] rounded-full transition-colors duration-200 focus:outline-none ${themeDark ? 'bg-tx-green' : 'bg-tx-s4 border border-tx-bdefault'}`}
                  role="switch"
                  aria-checked={themeDark}
                >
                  <span className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200 ${themeDark ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
                </button>
              </div>
            </motion.div>
          </section>

          {/* ── Feature Flags (if applicable) ── */}
          {features && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-tx-green" />
                <h2 className="text-sm font-semibold text-tx-tp">Feature Flags</h2>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { key: 'stt', label: 'Telnyx STT', Icon: Mic, value: features.stt },
                  { key: 'ai', label: 'AI Case Notes', Icon: Brain, value: features.ai },
                ].map(({ key, label, Icon, value }) => (
                  <div key={key} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-tx-s3 border border-tx-bdefault">
                    <span className="flex items-center gap-2 text-tx-tp text-sm font-medium">
                      <Icon className="w-3.5 h-3.5 text-tx-ts" />
                      {label}
                    </span>
                    <div className={`relative inline-flex items-center w-9 h-5 rounded-full transition-colors ${value ? 'bg-tx-green' : 'bg-tx-s4 border border-tx-bdefault'}`}>
                      <span className={`inline-block w-3.5 h-3.5 rounded-full bg-white shadow transform transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}



        </div>
      </div>
    </div>
  );
}
