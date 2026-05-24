'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Softphone from '../../../components/Softphone';
import ErrorBoundary from '../../../components/ErrorBoundary';
import { useSocket } from '../../../lib/socket';
import api from '../../../lib/api';
import TelnyxApiInfo from '../../../components/TelnyxApiInfo';
import StatTile from '../../../components/StatTile';
import CallHero from '../../../components/CallHero';
import QueueStrip from '../../../components/QueueStrip';
import AgentStatusOrb from '../../../components/AgentStatusOrb';
import AgentAssist from '../../../components/AgentAssist';
import CompactTeamChat from '../../../components/CompactTeamChat';
import InternalDirectory from '../../../components/InternalDirectory';
import WarmTransferPanel from '../../../components/WarmTransferPanel';
import {
  Phone,
  Radio,
  Users,
  Activity,
  ArrowRightLeft,
  PhoneForwarded,
  Mic,
  Wifi,
  WifiOff,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2,
  Send,
  MessageSquare,
  Clock,
  Tag,
  StickyNote,
  Bot,
  PhoneCall,
  Volume2,
  MessageCircle,
  Pause,
  Hand,
  UserCheck,
  PanelRightOpen,
  PanelRightClose,
  Headset,
  Timer,
  BarChart3,
  Contact,
  HelpCircle,
} from 'lucide-react';

/* ── Transcript bubble ─────────────────────────────────────────── */
function TranscriptBubble({ segment }) {
  const isEven = (segment.speaker ?? 0) % 2 === 0;
  const colors = isEven
    ? { dot: 'bg-tx-citron', name: 'text-tx-citron', bubble: 'bg-tx-green/[0.07] border-tx-citron/20' }
    : { dot: 'bg-tx-blue',   name: 'text-tx-blue',   bubble: 'bg-tx-blue/10 border-tx-blue/20'   };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-2.5"
    >
      <div className="flex-shrink-0 mt-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} ${!segment.isFinal ? 'live-dot' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${colors.name}`}>
          Speaker {(segment.speaker ?? 0) + 1}
        </span>
        <div className={`mt-0.5 px-2.5 py-1.5 rounded-lg border ${colors.bubble} ${!segment.isFinal ? 'border-dashed' : ''}`}>
          <p className={`text-[13px] leading-relaxed ${segment.isFinal ? 'text-tx-tp' : 'text-tx-ts italic'}`}>
            {segment.text}
          </p>
          {!segment.isFinal && (
            <div className="flex gap-1 mt-1">
              <span className="typing-dot-1 w-1 h-1 rounded-full bg-tx-ts/50" />
              <span className="typing-dot-2 w-1 h-1 rounded-full bg-tx-ts/50" />
              <span className="typing-dot-3 w-1 h-1 rounded-full bg-tx-ts/50" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Compact empty state ──────────────────────────────────────── */
function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-10 h-10 rounded-xl border border-tx-bsubtle bg-tx-s2 flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-tx-tt" strokeWidth={1.6} />
      </div>
      <p className="text-[13px] font-medium text-tx-ts">{title}</p>
      {hint && <p className="text-[11.5px] text-tx-tt mt-1 max-w-[260px] leading-relaxed">{hint}</p>}
    </div>
  );
}

/* ── Tab button for center workspace ──────────────────────────── */
function WorkspaceTab({ active, onClick, icon: Icon, label, badge, tone = 'green' }: any) {
  const toneMap: Record<string, { iconBg: string; iconText: string; bar: string }> = {
    green:  { iconBg: 'bg-tx-green/15',   iconText: 'text-tx-green',    bar: 'bg-tx-green' },
    blue:   { iconBg: 'bg-tx-blue/15',    iconText: 'text-tx-blue',     bar: 'bg-tx-blue' },
    amber:  { iconBg: 'bg-tx-citron/15',  iconText: 'text-tx-citron',   bar: 'bg-tx-citron' },
    violet: { iconBg: 'bg-purple-500/15', iconText: 'text-purple-400',  bar: 'bg-purple-400' },
  };
  const t = toneMap[tone] || toneMap.green;
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold transition-all -mb-px group ${
        active ? 'text-tx-tp' : 'text-tx-ts hover:text-tx-tp'
      }`}
    >
      <span className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
        active ? `${t.iconBg} ${t.iconText} shadow-sm` : 'bg-tx-s2 text-tx-ts group-hover:bg-tx-s3 group-hover:text-tx-tp'
      }`}>
        <Icon className="w-3.5 h-3.5" strokeWidth={active ? 2.2 : 1.8} />
      </span>
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className={`ml-0.5 px-1.5 py-px rounded-full text-[10px] font-bold tnum leading-none ${t.iconBg} ${t.iconText}`}>
          {badge}
        </span>
      )}
      {active && (
        <motion.span
          layoutId="workspace-tab-bar"
          className={`absolute -bottom-px left-2 right-2 h-[2px] rounded-full ${t.bar}`}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
    </button>
  );
}

export default function PhonePage() {
  /* ── State ──────────────────────────────────────────────────────── */
  const [agentStatus, setAgentStatus] = useState('offline');
  const [agentId, setAgentId] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [sipConfig, setSipConfig] = useState<any>(null);
  const [sipConfigError, setSipConfigError] = useState<any>(null);
  const [sipConfigLoading, setSipConfigLoading] = useState(true);
  const [sipRetryNonce, setSipRetryNonce] = useState(0);
  const [features, setFeatures] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [transferTarget, setTransferTarget] = useState('');
  const [callState, setCallState] = useState('idle');
  const [queueStatus, setQueueStatus] = useState<Record<string, any>>({});
  const [callStats, setCallStats] = useState({ today: 0, avgDuration: 0, activeNow: 0 });
  const [showTransfer, setShowTransfer] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showAssist, setShowAssist] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [wrapUp, setWrapUp] = useState<any>(null);
  const [wrapUpRemaining, setWrapUpRemaining] = useState(0);
  const [disposition, setDisposition] = useState({ tag: '', notes: '' });
  const [wrapUpSubmitting, setWrapUpSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { connected: socketConnected, on, emit } = useSocket();
  const transcriptRef = useRef(null);

  /* Center workspace tab state */
  const [activeTab, setActiveTab] = useState<'transcript' | 'directory' | 'transfer' | 'chat'>('transcript');

  const [callDuration, setCallDuration] = useState(0);
  const callStartRef = useRef(null);

  /* ── Browser tab title update when call is active ──────────── */
  const originalTitleRef = useRef<string | null>(null);
  useEffect(() => {
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title;
    }
    if (callState === 'active' && callDuration > 0) {
      document.title = `📞 ${fmtDuration(callDuration)} — On Call`;
    } else if (callState === 'ringing' || callState === 'incoming') {
      document.title = '📞 Incoming Call';
    } else if (callState === 'dialing') {
      document.title = '📞 Dialing...';
    } else {
      document.title = originalTitleRef.current || 'Contact Center';
    }
    return () => {
      document.title = originalTitleRef.current || 'Contact Center';
    };
  }, [callState, callDuration]);

  useEffect(() => {
    if (callState === 'active') {
      callStartRef.current = callStartRef.current || Date.now();
      const id = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
      }, 250);
      return () => clearInterval(id);
    } else {
      callStartRef.current = null;
      setCallDuration(0);
    }
  }, [callState]);

  useEffect(() => {
    if (!wrapUp?.until) {
      setWrapUpRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(wrapUp.until).getTime() - Date.now()) / 1000));
      setWrapUpRemaining(remaining);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [wrapUp]);

  useEffect(() => {
    if (!agentId) return;
    api.get('/agents/me/profile').then((a) => {
      if (a.wrapUpUntil && new Date(a.wrapUpUntil).getTime() > Date.now()) {
        setWrapUp({ until: a.wrapUpUntil });
      }
    }).catch(() => {});
  }, [agentId]);

  const completeWrapUp = useCallback(async () => {
    if (!agentId) return;
    setWrapUpSubmitting(true);
    try {
      await api.post(`/agents/${agentId}/wrap-up/complete`, {
        disposition: disposition.tag || undefined,
        notes: disposition.notes || undefined,
      });
      setWrapUp(null);
      setDisposition({ tag: '', notes: '' });
    } catch (err: any) {
      console.error('Failed to complete wrap-up', err);
    } finally {
      setWrapUpSubmitting(false);
    }
  }, [agentId, disposition]);

  /* ── Data load ──────────────────────────────────────────────────── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
    api.get('/features').then(setFeatures).catch(() => {});
    api.get('/agents/me/profile').then((a) => {
      setAgentId(a.id);
      setAgentStatus(a.status || 'offline');
    }).catch(() => {});
    api.get('/agents').then(setAgents).catch(() => {});
    api.get('/agents/queues/status').then(setQueueStatus).catch(() => {});
    api.get('/history?page=1&limit=1').then((d) => {
      setCallStats((s) => ({ ...s, today: d.total || 0 }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSipConfigError(null);
    setSipConfigLoading(true);

    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setSipConfigError('Timed out loading SIP credentials.');
        setSipConfigLoading(false);
      }
    }, 8000);

    api.get('/voice/sip-config')
      .then((cfg) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (!cfg?.sipUsername || !cfg?.sipPassword) {
          setSipConfigError('SIP credentials missing for this account.');
        } else {
          setSipConfig(cfg);
        }
        setSipConfigLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        const msg = err?.data?.error || err?.message || 'Failed to load SIP credentials.';
        setSipConfigError(msg);
        setSipConfigLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [sipRetryNonce]);

  const retrySipConfig = useCallback(() => {
    setSipConfig(null);
    setSipRetryNonce((n) => n + 1);
  }, []);

  /* ── Socket ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const cleanups = [];
    cleanups.push(on('transcript:partial', (data) => {
      setTranscript((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && !updated[lastIdx].isFinal) {
          updated[lastIdx] = { ...data, isFinal: false };
        } else {
          updated.push({ ...data, isFinal: false });
        }
        return updated;
      });
      scrollTranscript();
    }));
    cleanups.push(on('transcript:final', (data) => {
      setTranscript((prev) => [...prev, { ...data, isFinal: true }]);
      scrollTranscript();
    }));
    cleanups.push(on('call:ringing', (data) => setActiveCall(data)));
    cleanups.push(on('call:answered', (data) => setActiveCall((prev) => prev ? { ...prev, ...data } : data)));
    cleanups.push(on('call:ended', () => { setActiveCall(null); setCallState('idle'); }));
    cleanups.push(on('agent:status', (data) => { if (data.agentId === agentId) setAgentStatus(data.status); }));
    cleanups.push(on('internal:call:ringing', (data) => {
      if (data.isInternal) {
        setActiveCall((prev) => ({ ...prev, isInternal: true, ...data }));
      }
    }));
    cleanups.push(on('internal:presence', ({ agentId: aId, presence }) => {
      setAgents((prev) => prev.map((a) => (a.id === aId ? { ...a, presence } : a)));
    }));
    cleanups.push(on('queue:update', (data) => setQueueStatus(data)));
    cleanups.push(on('agent:wrapup:start', (data) => {
      if (data.agentId === agentId) {
        setWrapUp({ until: data.wrapUpUntil });
      }
    }));
    cleanups.push(on('agent:wrapup:end', (data) => {
      if (data.agentId === agentId) {
        setWrapUp(null);
        setDisposition({ tag: '', notes: '' });
      }
    }));
    return () => cleanups.forEach((fn) => fn());
  }, [on, agentId]);

  function scrollTranscript() {
    requestAnimationFrame(() => {
      if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    });
  }

  // Ctrl+/ toggles Agent Assist
  useEffect(() => {
    const handler = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key !== '/') return;
      const t = e.target;
      const tag = (t?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
      e.preventDefault();
      setShowAssist((v) => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close help popover on click outside
  useEffect(() => {
    if (!showHelp) return;
    const handler = (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-help-popover]')) return;
      setShowHelp(false);
    };
    // Use a timeout so the opening click doesn't immediately close it
    const id = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { clearTimeout(id); document.removeEventListener('click', handler); };
  }, [showHelp]);

  /* ── Handlers ────────────────────────────────────────────────────── */
  const updateStatus = useCallback(async (status) => {
    setAgentStatus(status);
    if (agentId) {
      try {
        await api.patch(`/agents/${agentId}`, { status });
        emit('agent:status:update', { agentId, status });
      } catch (err: any) { console.error('Failed to update status:', err); }
    }
  }, [agentId, emit]);

  const transferCall = useCallback(async (type) => {
    if (!activeCall?.callControlId || !transferTarget) return;
    try {
      const endpoint = type === 'warm' ? '/voice/transfer/warm' : '/voice/transfer/cold';
      await api.post(endpoint, { callControlId: activeCall.callControlId, target: transferTarget });
      setTransferTarget('');
      setShowTransfer(false);
    } catch (err: any) { console.error('Transfer failed:', err); }
  }, [activeCall, transferTarget]);

  const [whisperTarget, setWhisperTarget] = useState('');
  const [whisperMessage, setWhisperMessage] = useState('');
  const [showInternalDirectory, setShowInternalDirectory] = useState(true);
  const sendWhisper = useCallback(async () => {
    if (!activeCall?.callControlId || !whisperTarget) return;
    try {
      await api.post('/voice/whisper', {
        callControlId: activeCall.callControlId,
        supervisorSipUsername: whisperTarget,
        message: whisperMessage || undefined,
      });
      setWhisperTarget('');
      setWhisperMessage('');
    } catch (err: any) { console.error('Whisper failed:', err); }
  }, [activeCall, whisperTarget, whisperMessage]);

  const [callLogStatus, setCallLogStatus] = useState<any>(null);

  const handleCallStart = useCallback(() => { setCallLogStatus(null); }, []);

  const handleCallEnd = useCallback(async (info) => {
    try {
      setCallLogStatus('logging');
      await api.post('/voice/log-call', {
        direction: info.direction || 'inbound',
        from: info.from,
        to: info.to,
        duration: info.duration || 0,
        startedAt: info.startedAt,
        endedAt: info.endedAt,
        status: 'ended',
        agentId: agentId || undefined,
      });
      setCallLogStatus('logged');
      api.get('/history?page=1&limit=1').then((d) => {
        setCallStats((s) => ({ ...s, today: d.total || 0 }));
      }).catch(() => {});
    } catch (err: any) {
      console.error('Failed to log call:', err);
      setCallLogStatus('error');
    }
  }, [agentId]);

  /* ── Derived ─────────────────────────────────────────────────────── */
  const totalQueueDepth = Object.values(queueStatus).reduce((sum: number, q: any) => sum + (q.depth || 0), 0);
  const onlineAgents = agents.filter((a) => a.status === 'online').length;
  const longestWait = Object.values(queueStatus).reduce((max: number, q: any) => Math.max(max, q.oldestWaitMs || 0), 0);
  const onlineAgentsForTransfer = agents.filter((a) => a.id !== agentId && a.status === 'online');
  const agentDisplayName = user?.displayName || user?.username || 'Agent';
  const isActive = callState === 'active' || callState === 'ringing' || callState === 'incoming' || callState === 'dialing';

  const handleInternalCall = useCallback(async (targetAgent) => {
    try {
      await api.post('/internal-calling/dial-agent', { targetAgentId: targetAgent.id });
    } catch (err: any) {
      console.error('Failed to dial agent', err);
    }
  }, []);

  /* ── Stat chip for bottom strip ──────────────────────────────── */
  const StatChip = ({ label, value, tone = 'neutral', live = false, suffix = '', icon: Icon }: any) => {
    const tones: Record<string, string> = {
      neutral: 'text-tx-tp border-tx-bdefault bg-tx-s1',
      green:   'text-tx-green border-tx-green/25 bg-tx-green/[0.06]',
      blue:    'text-tx-blue border-tx-blue/25 bg-tx-blue/[0.06]',
      amber:   'text-tx-citron border-tx-citron/25 bg-tx-citron/[0.06]',
      red:     'text-tx-red border-tx-red/25 bg-tx-red/[0.06]',
    };
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${tones[tone] || tones.neutral}`}>
        {Icon && <Icon className="w-4 h-4 opacity-60 flex-shrink-0" />}
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</span>
          <span className="flex items-center gap-1.5 text-lg font-bold tnum leading-tight">
            {live && <span className="w-1.5 h-1.5 rounded-full bg-current live-dot" />}
            {value}{suffix}
          </span>
        </div>
      </div>
    );
  };

  /* ── Format duration helper ─────────────────────────────────── */
  function fmtDuration(seconds: number) {
    if (!seconds || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /* ════════════════════════════════════════════════════════════════
     RENDER — Premium Contact Center Agent Workstation
     3-Zone Layout: Top Strip → Center Workspace → Bottom Strip
     ════════════════════════════════════════════════════════════════ */
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-tx-s0">

      {/* ╔══ TOP STRIP — Compact header ════════════════════════════ */}
      <header className="flex-shrink-0 border-b border-tx-bdefault bg-tx-s1/80 backdrop-blur-sm z-30">
        <div className="flex items-center justify-between px-5 h-12">
          {/* Left: Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-tx-green to-tx-green-dark flex items-center justify-center flex-shrink-0 shadow-sm">
              <Headset className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-sm font-semibold text-tx-tp tracking-tight leading-tight">Contact Center</h1>
              <p className="text-[10px] text-tx-ts truncate">
                <span className="text-tx-tp font-medium">{agentDisplayName}</span>
              </p>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {/* Queue position indicator — amber pill when depth > 0 */}
            {agentStatus === 'available' && totalQueueDepth > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tx-citron/10 border border-tx-citron/25 mr-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-tx-citron animate-pulse" />
                <span className="text-[10px] font-bold text-tx-citron uppercase tracking-[0.1em]">Queue: {totalQueueDepth} waiting</span>
              </motion.div>
            )}
            {/* Compact call-state pill — lives in the header strip, not centered */}
            <AnimatePresence>
              {isActive && activeCall && (
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-2 px-3 py-1 rounded-full bg-tx-green/10 border border-tx-green/25 mr-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-tx-green live-dot" />
                  <span className="text-[10px] font-bold text-tx-green uppercase tracking-[0.1em] hidden md:inline">
                    {callState === 'ringing' || callState === 'incoming' ? 'Incoming' : callState === 'dialing' ? 'Dialing' : 'On Call'}
                  </span>
                  <span className="text-[12px] font-bold text-tx-tp tnum tabular-nums">{fmtDuration(callDuration)}</span>
                  {activeCall?.from && (
                    <span className="text-[10px] text-tx-ts hidden lg:inline truncate max-w-[140px]">&middot; {activeCall.from}</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {/* SIP Connection indicator */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-semibold uppercase tracking-[0.12em] ${
                sipConfig
                  ? 'text-tx-green/80'
                  : sipConfigLoading
                  ? 'text-tx-citron/80'
                  : 'text-tx-red/80'
              }`}
              title={sipConfig ? 'WebRTC Connected' : sipConfigLoading ? 'Connecting...' : sipConfigError || 'No SIP Config'}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${sipConfig ? 'bg-tx-green shadow-[0_0_6px_rgba(0,255,128,0.4)]' : sipConfigLoading ? 'bg-tx-citron animate-pulse' : 'bg-tx-red'}`} />
              <span className="hidden lg:inline">{sipConfig ? 'WebRTC' : sipConfigLoading ? 'Connecting' : 'Offline'}</span>
            </div>

            {/* Socket status */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold uppercase tracking-[0.12em] ${
                socketConnected
                  ? 'text-tx-green/80'
                  : 'text-tx-red/80'
              }`}
            >
              {socketConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden lg:inline">{socketConnected ? 'Live' : 'Reconnecting'}</span>
            </div>

            {/* Keyboard shortcut help */}
            <div className="relative">
              <button
                onClick={() => setShowHelp((v) => !v)}
                title="Keyboard shortcuts"
                className="flex items-center justify-center w-7 h-7 rounded-lg border border-tx-bdefault bg-tx-s2 text-tx-tt hover:text-tx-tp hover:border-tx-bdefault transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
              <AnimatePresence>
                {showHelp && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-tx-s1 border border-tx-bdefault shadow-xl z-50 p-3 space-y-1.5"
                    data-help-popover
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-[10px] font-bold text-tx-tt uppercase tracking-wider mb-2">Shortcuts</div>
                    {[
                      { keys: 'Ctrl+/', label: 'Toggle AI Copilot' },
                      { keys: 'Ctrl+M', label: 'Mute' },
                      { keys: 'Ctrl+H', label: 'Hold' },
                      { keys: 'Esc', label: 'Hang up' },
                    ].map((s) => (
                      <div key={s.keys} className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-tx-ts">{s.label}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-tx-s3 border border-tx-bdefault text-[9px] font-mono text-tx-tt">{s.keys}</kbd>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* AI Assist toggle — AI copilot for live calls */}
            <button
              onClick={() => setShowAssist((v) => !v)}
              title="AI Copilot — Real-time suggestions, canned responses, and caller context (Ctrl+/)"
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold uppercase tracking-[0.12em] transition-all active:scale-[0.97] group ${
                showAssist
                  ? 'bg-tx-citron/[0.15] text-tx-citron border-tx-citron/40 shadow-[0_0_12px_rgba(202,255,77,0.15)]'
                  : 'bg-tx-s2 text-tx-ts border-tx-bdefault hover:text-tx-citron hover:border-tx-citron/30 hover:bg-tx-citron/[0.05]'
              }`}
            >
              <Sparkles className={`w-3 h-3 ${showAssist ? 'text-tx-citron' : 'text-tx-ts group-hover:text-tx-citron'} transition-colors`} />
              <span className="hidden sm:inline">AI Copilot</span>
              {showAssist && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-tx-citron animate-pulse" />
              )}
            </button>

            {/* Agent Status Orb */}
            <div className="relative z-[200]">
              <AgentStatusOrb
                status={agentStatus}
                onChange={updateStatus}
                agentName={agentDisplayName}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ╔══ WRAP-UP BANNER ═══════════════════════════════════════ */}
      <AnimatePresence>
        {wrapUp && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-shrink-0 px-5 pt-3 overflow-hidden"
          >
            <div className="bg-tx-s1 border border-tx-citron/25 rounded-xl p-3 bg-gradient-to-r from-tx-citron/[0.06] via-transparent to-tx-citron/10 relative overflow-hidden">
              {/* Progress bar for wrap-up timer */}
              <div className="absolute bottom-0 left-0 h-[3px] bg-tx-citron/50 rounded-full transition-all duration-1000 ease-linear" style={{ width: wrapUp?.until ? `${Math.max(0, (1 - wrapUpRemaining / 30) * 100)}%` : '0%' }} />
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-tx-citron/[0.08] border border-tx-citron/25 flex flex-col items-center justify-center">
                  <Clock className="w-3 h-3 text-tx-citron" />
                  <span className="text-[11px] font-bold text-tx-citron tnum leading-none mt-0.5">{wrapUpRemaining}s</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-tx-citron/80 uppercase tracking-[0.18em]">After-Call Wrap-Up</p>
                  <p className="text-xs text-tx-tp">Disposition this call before re-entering routing</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <div className="relative">
                      <Tag className="w-3 h-3 text-tx-ts absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={disposition.tag}
                        onChange={(e) => setDisposition((d) => ({ ...d, tag: e.target.value }))}
                        placeholder="Disposition tag (e.g. resolved)"
                        className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg pl-7 pr-3 py-1.5 text-[12px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40 transition-colors"
                      />
                    </div>
                    <div className="relative">
                      <StickyNote className="w-3 h-3 text-tx-ts absolute left-2.5 top-2" />
                      <input
                        type="text"
                        value={disposition.notes}
                        onChange={(e) => setDisposition((d) => ({ ...d, notes: e.target.value }))}
                        placeholder="Short notes (optional)"
                        className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg pl-7 pr-3 py-1.5 text-[12px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40 transition-colors"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <button
                    disabled={wrapUpSubmitting}
                    onClick={completeWrapUp}
                    className="px-4 py-2 rounded-xl bg-tx-green/15 border border-tx-green/30 text-tx-green text-xs font-semibold shadow-sm hover:bg-tx-green/25 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
                  >
                    {wrapUpSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Complete
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ╔══ CENTER — Main Workspace ════════════════════════════════ */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── LEFT: Softphone Panel (fixed width, hero element) ─── */}
        <div className={`flex-shrink-0 flex flex-col border-r border-tx-bdefault bg-tx-s1 transition-all duration-300 ${
          isActive ? 'w-[440px]' : 'w-[400px]'
        }`}>
          {/* Softphone — the hero */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <CallHero
              callState={callState}
              activeCall={activeCall}
              duration={callDuration}
            >
              <ErrorBoundary name="Softphone">
                <Softphone
                  sipConfig={sipConfig ?? undefined}
                  onCallStateChange={setCallState}
                  onIncomingCall={(call) => setActiveCall(call)}
                  onCallStart={handleCallStart}
                  onCallEnd={handleCallEnd}
                  compact
                />
              </ErrorBoundary>
            </CallHero>
          </div>

          {/* SIP Status footer strip */}
          <div className="flex-shrink-0 px-4 py-2.5 border-t border-tx-bdefault bg-tx-s2/40 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sipConfig ? 'bg-tx-green shadow-[0_0_8px_rgba(0,255,128,0.4)]' : sipConfigLoading ? 'bg-tx-citron animate-pulse' : 'bg-tx-red'}`} />
            <p className="text-[10px] font-medium text-tx-ts flex-1 min-w-0 truncate uppercase tracking-[0.12em]">
              {sipConfigLoading ? 'Connecting...' : sipConfig ? 'Ready \u00b7 WebRTC' : (sipConfigError || 'No SIP Config')}
            </p>
            {sipConfigError && !sipConfigLoading && (
              <button onClick={retrySipConfig} className="text-[9px] text-tx-citron hover:text-tx-tp font-semibold uppercase tracking-wider">Retry</button>
            )}
            <AnimatePresence>
              {callLogStatus === 'logging' && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-[9px] text-tx-green uppercase tracking-wider">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Log
                </motion.span>
              )}
              {callLogStatus === 'logged' && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-[9px] text-tx-green uppercase tracking-wider">
                  <CheckCircle className="w-2.5 h-2.5" /> Logged
                </motion.span>
              )}
              {callLogStatus === 'error' && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-[9px] text-tx-red uppercase tracking-wider">
                  <AlertCircle className="w-2.5 h-2.5" /> Err
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* (Quick action bar removed — use the workspace tabs on the right) */}
        </div>

        {/* ── RIGHT: Tabbed workspace panel ──────────────────────── */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-tx-s0 overflow-hidden">

          {/* Tab bar (always visible) */}
          <div className="flex-shrink-0 flex items-center gap-0 px-4 pt-2 border-b border-tx-bdefault bg-tx-s0">
            <WorkspaceTab
              active={activeTab === 'transcript'}
              onClick={() => setActiveTab('transcript')}
              icon={MessageSquare}
              label="Transcript"
              badge={transcript.length}
              tone="green"
            />
            <WorkspaceTab
              active={activeTab === 'directory'}
              onClick={() => setActiveTab('directory')}
              icon={Users}
              label="Directory"
              tone="blue"
            />
            <WorkspaceTab
              active={activeTab === 'transfer'}
              onClick={() => setActiveTab('transfer')}
              icon={ArrowRightLeft}
              label="Transfer"
              tone="amber"
            />
            <WorkspaceTab
              active={activeTab === 'chat'}
              onClick={() => setActiveTab('chat')}
              icon={MessageCircle}
              label="Team Chat"
              tone="violet"
            />
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'transcript' && (
                <motion.div
                  key="transcript"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-4"
                >
                  {transcript.length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      title={isActive ? 'Listening for speech…' : 'Live transcript will appear here'}
                      hint={isActive ? 'STT is warming up. Words will land in a second.' : 'Start or accept a call to see speaker-separated transcription in real time.'}
                    />
                  ) : (
                    <div className="space-y-3">
                      {transcript.map((entry, i) => (
                        <div key={i} className={`flex gap-3 ${entry.role === 'agent' ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            entry.role === 'agent' ? 'bg-tx-green/15 text-tx-green' : 'bg-tx-s3 text-tx-ts'
                          }`}>
                            {entry.role === 'agent' ? 'A' : 'C'}
                          </div>
                          <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                            entry.role === 'agent' ? 'bg-tx-green/10 text-tx-tp' : 'bg-tx-s2 text-tx-tp'
                          }`}>
                            {entry.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
              {activeTab === 'directory' && (
                <motion.div
                  key="directory"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-4 h-full"
                >
                  <InternalDirectory onCallAgent={handleInternalCall} />
                </motion.div>
              )}
              {activeTab === 'transfer' && (
                <motion.div
                  key="transfer"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-4 h-full"
                >
                  {isActive && activeCall ? (
                    <WarmTransferPanel
                      activeCall={activeCall}
                      agents={onlineAgentsForTransfer}
                      agentId={agentId}
                      onComplete={() => setActiveTab('transcript')}
                      onCancel={() => setActiveTab('transcript')}
                    />
                  ) : (
                    <EmptyState
                      icon={ArrowRightLeft}
                      title="Transfer panel"
                      hint="Available during an active call — warm or cold transfer to a teammate, queue, or external number."
                    />
                  )}
                </motion.div>
              )}
              {activeTab === 'chat' && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="h-full"
                >
                  <CompactTeamChat />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}