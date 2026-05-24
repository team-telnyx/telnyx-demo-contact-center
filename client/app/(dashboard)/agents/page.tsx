'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../lib/api';
import { useSocket } from '../../../lib/socket';
import { useToast } from '../../../components/Toast';
import TelnyxApiInfo from '../../../components/TelnyxApiInfo';
import {
  Users,
  UserPlus,
  Shield,
  Headphones,
  X,
  Plus,
  ChevronDown,
  Signal,
  Lock,
  MoreVertical,
  Trash2,
  Power,
  PowerOff,
  Clock,
  Phone,
  PhoneCall,
  ArrowRightLeft,
  PhoneOff,
  Activity,
  Circle,
  LogOut,
} from 'lucide-react';

const ALLOWED_ROLES = ['admin', 'supervisor'];

function getLastSeenLabel(agent: any): string {
  const ts = agent.lastSeenAt || agent.user?.lastSeenAt || agent.updatedAt;
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 120 && agent.status !== 'offline') return 'Active now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function isRecentlyActive(agent: any): boolean {
  const ts = agent.lastSeenAt || agent.user?.lastSeenAt || agent.updatedAt;
  if (!ts) return false;
  return (Date.now() - new Date(ts).getTime()) < 120_000 && agent.status !== 'offline';
}

function fmtDuration(seconds: number) {
  if (!seconds || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// status accent = colour used for the LEFT accent bar on the agent card
const STATUS_OPTIONS = [
  { value: 'online',  label: 'Online',  dot: 'bg-tx-green',  bg: 'bg-tx-green/10',    text: 'text-tx-green',  border: 'border-tx-green/30',   accent: 'bg-tx-green' },
  { value: 'away',    label: 'Away',    dot: 'bg-tx-citron', bg: 'bg-tx-citron/10',   text: 'text-tx-citron', border: 'border-tx-citron/30',  accent: 'bg-tx-citron' },
  { value: 'busy',    label: 'Busy',    dot: 'bg-red-400',   bg: 'bg-red-500/10',     text: 'text-red-400',   border: 'border-red-500/30',    accent: 'bg-red-500' },
  { value: 'break',   label: 'Break',   dot: 'bg-orange-400', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', accent: 'bg-orange-500' },
  { value: 'dnd',     label: 'DND',     dot: 'bg-tx-ts',     bg: 'bg-tx-s3',          text: 'text-tx-ts',     border: 'border-tx-bdefault',   accent: 'bg-tx-ts' },
  { value: 'offline', label: 'Offline', dot: 'bg-tx-tt',     bg: 'bg-tx-s3',          text: 'text-tx-tt',     border: 'border-tx-bdefault',   accent: 'bg-tx-bdefault' },
];

export default function AgentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'agent',
  });
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [openMenuId, setOpenMenuId] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null); // agent object or null
  const [drawerAgent, setDrawerAgent] = useState<any>(null);
  const [drawerRecentCalls, setDrawerRecentCalls] = useState<any[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [forceStatusAgentId, setForceStatusAgentId] = useState<any>(null);
  const { on } = useSocket();
  const { addToast } = useToast();
  const menuRefs = useRef({});

  // Role gate — only admin / supervisor may view this page.
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const u = stored ? JSON.parse(stored) : null;
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  const isAdmin = user?.role === 'admin';
  const isAllowed = user && ALLOWED_ROLES.includes(user.role);

  useEffect(() => {
    if (authChecked && isAllowed) {
      fetchAgents();
    }
  }, [authChecked, isAllowed]);

  useEffect(() => {
    if (!isAllowed) return undefined;
    const cleanups = [];
    // Existing: agent:status for status changes
    cleanups.push(on('agent:status', (data) => {
      setAgents((prev) => prev.map((a) => a.id === data.agentId ? { ...a, status: data.status, lastSeenAt: new Date().toISOString() } : a));
    }));
    // New: agent:status-change with richer data
    cleanups.push(on('agent:status-change', (data) => {
      setAgents((prev) => prev.map((a) => a.id === data.agentId ? { ...a, status: data.status, lastSeenAt: data.lastSeenAt || new Date().toISOString(), ...(data.activeCallId !== undefined ? { activeCallId: data.activeCallId } : {}) } : a));
    }));
    // New: agent:login — add or update agent
    cleanups.push(on('agent:login', (data) => {
      setAgents((prev) => {
        if (prev.some((a) => a.id === data.agentId || a.id === data.id)) {
          return prev.map((a) => (a.id === data.agentId || a.id === data.id) ? { ...a, status: data.status || 'online', lastSeenAt: new Date().toISOString() } : a);
        }
        return [...prev, { ...data, status: data.status || 'online', lastSeenAt: new Date().toISOString() }];
      });
    }));
    // New: agent:logout — mark offline
    cleanups.push(on('agent:logout', (data) => {
      setAgents((prev) => prev.map((a) => a.id === (data.agentId || data.id) ? { ...a, status: 'offline', lastSeenAt: data.lastSeenAt || new Date().toISOString(), activeCallId: null } : a));
    }));
    return () => cleanups.forEach((fn) => fn());
  }, [on, isAllowed]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (openMenuId && menuRefs.current[openMenuId] && !menuRefs.current[openMenuId].contains(e.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  // Close force status dropdown on outside click
  useEffect(() => {
    if (!forceStatusAgentId) return;
    function handleClick(e) {
      const el = (e.target as HTMLElement).closest('[data-force-status-menu]');
      if (!el) setForceStatusAgentId(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [forceStatusAgentId]);

  async function fetchAgents() {
    setLoading(true);
    try { const data = await api.get('/agents'); setAgents(data); } catch (err: any) { console.error('Failed to fetch agents', err); }
    finally { setLoading(false); }
  }

  async function updateStatus(agentId, status) {
    try {
      await api.patch(`/agents/${agentId}`, { status });
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status, lastSeenAt: new Date().toISOString() } : a)));
    } catch (err: any) { console.error('Failed to update agent status', err); }
  }

  async function forceStatus(agentId, status) {
    try {
      await api.post(`/agents/${agentId}/status`, { status });
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status, lastSeenAt: new Date().toISOString() } : a)));
      addToast(`Agent status forced to ${status}`, 'success');
    } catch (err: any) {
      console.error('Failed to force agent status', err);
      addToast('Failed to force agent status', 'error');
    }
    setForceStatusAgentId(null);
  }

  async function forceLogout(agentId) {
    try {
      await api.patch(`/agents/${agentId}`, { status: 'offline', active: false });
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status: 'offline', active: false, lastSeenAt: new Date().toISOString(), activeCallId: null } : a)));
      addToast('Agent forced offline', 'success');
    } catch (err: any) {
      console.error('Failed to force agent logout', err);
      addToast('Failed to force agent logout', 'error');
    }
  }

  async function updatePriority(agentId, priority) {
    try {
      await api.patch(`/agents/${agentId}`, { priority: parseInt(priority) });
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, priority: parseInt(priority) } : a)));
    } catch (err: any) { console.error('Failed to update agent priority', err); }
  }

  async function updateQueues(agentId, queues) {
    try {
      const queueList = queues.split(',').map((q) => q.trim()).filter(Boolean);
      await api.patch(`/agents/${agentId}`, { queues: queueList });
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, queues: queueList } : a)));
    } catch (err: any) { console.error('Failed to update agent queues', err); }
  }

  async function toggleActive(agentId, active) {
    try {
      const status = active ? 'offline' : 'offline'; // reset status on toggle
      await api.patch(`/agents/${agentId}`, { active, status });
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, active, status } : a)));
      setOpenMenuId(null);
    } catch (err: any) { console.error('Failed to update agent active state', err); }
  }

  async function deleteAgent(agentId) {
    try {
      await api.delete(`/agents/${agentId}`);
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
      setConfirmDelete(null);
      setOpenMenuId(null);
    } catch (err: any) { console.error('Failed to delete agent', err); }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegisterError('');
    setRegisterSuccess('');
    try {
      await api.post('/auth/register', registerForm);
      setRegisterSuccess(`Agent "${registerForm.displayName}" created successfully!`);
      setRegisterForm({ username: '', password: '', displayName: '', role: 'agent' });
      fetchAgents();
    } catch (err: any) { setRegisterError(err?.data?.error || 'Registration failed'); }
  }

  // ── Agent detail drawer ─────────────────────────────────────────
  const openDrawer = useCallback(async (agent) => {
    setDrawerAgent(agent);
    setDrawerLoading(true);
    setDrawerRecentCalls([]);
    try {
      const data = await api.get(`/cdr?agentId=${agent.id}&limit=5`);
      setDrawerRecentCalls(Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load recent calls', err);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerAgent(null);
    setDrawerRecentCalls([]);
  }, []);

  // ── Agent count summary ─────────────────────────────────────────
  const agentSummary = agents.reduce((acc, a) => {
    acc.total++;
    if (a.status === 'online') acc.online++;
    if (a.status === 'away') acc.away++;
    if (a.status === 'busy') acc.busy++;
    if (a.status === 'break') acc.break_++;
    if (a.status === 'dnd') acc.dnd++;
    if (a.status === 'offline') acc.offline++;
    return acc;
  }, { online: 0, away: 0, busy: 0, break_: 0, dnd: 0, offline: 0, total: 0 });

  if (!authChecked) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-tx-s3 rounded-lg w-48" />
          <div className="h-64 bg-tx-s3 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="p-6">
        <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-10 max-w-md mx-auto text-center mt-12">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-red-400" />
          </div>
          <h1 className="text-lg font-semibold text-tx-tp mb-1">Restricted</h1>
          <p className="text-sm text-tx-ts mb-6">
            Agent management is available to supervisors and admins only.
          </p>
          <button
            onClick={() => router.replace('/phone')}
            className="px-4 py-2 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-tx-green/20"
          >
            Back to Phone
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-tx-s3 rounded-lg w-48" />
          <div className="h-64 bg-tx-s3 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-tx-green/20 flex-shrink-0">
            <Users className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-tx-tp tracking-tight">Agent Management</h1>
              <TelnyxApiInfo
                product="Call Control — SIP Credentials"
                description="Agents are registered as SIP credential users on Telnyx. Their status updates are tracked locally and broadcast in real time via Socket.IO."
                endpoint={['GET /v2/sip_credentials', 'PATCH /v2/agents/:id']}
                docs="https://developers.telnyx.com/api/call-control/sip-credentials"
                side="right"
              />
            </div>
            <p className="text-[11px] text-tx-ts mt-0.5">Manage your contact center team</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowRegister(!showRegister)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-tx-green/20"
        >
          {showRegister ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {showRegister ? 'Cancel' : 'Add Agent'}
        </motion.button>
      </div>

      {/* Agent count summary bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-green/10 border border-tx-green/20">
          <span className="w-2 h-2 rounded-full bg-tx-green" />
          <span className="text-[11px] font-semibold text-tx-green tnum">{agentSummary.online}</span>
          <span className="text-[10px] text-tx-green/70">Online</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-citron/10 border border-tx-citron/20">
          <span className="w-2 h-2 rounded-full bg-tx-citron" />
          <span className="text-[11px] font-semibold text-tx-citron tnum">{agentSummary.away}</span>
          <span className="text-[10px] text-tx-citron/70">Away</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-[11px] font-semibold text-red-400 tnum">{agentSummary.busy}</span>
          <span className="text-[10px] text-red-400/70">Busy</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-[11px] font-semibold text-orange-400 tnum">{agentSummary.break_}</span>
          <span className="text-[10px] text-orange-400/70">Break</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault">
          <span className="w-2 h-2 rounded-full bg-tx-ts" />
          <span className="text-[11px] font-semibold text-tx-ts tnum">{agentSummary.dnd}</span>
          <span className="text-[10px] text-tx-ts/70">DND</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-s2 border border-tx-bdefault">
          <span className="text-[11px] font-semibold text-tx-ts tnum">{agentSummary.total}</span>
          <span className="text-[10px] text-tx-ts/70">Total</span>
        </div>
      </div>

      {/* Registration form */}
      <AnimatePresence>
        {showRegister && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6">
              <p className="text-[10px] font-bold text-tx-tt uppercase tracking-widest mb-4">New Agent</p>
              {registerError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm">{registerError}</div>
              )}
              {registerSuccess && (
                <div className="bg-tx-green/10 border border-tx-green/20 text-tx-green px-4 py-3 rounded-xl mb-4 text-sm">{registerSuccess}</div>
              )}
              <form onSubmit={handleRegister} className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-tx-ts mb-1.5">Username</label>
                  <input type="text" value={registerForm.username} onChange={(e) => setRegisterForm((f) => ({ ...f, username: e.target.value }))} className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tx-ts mb-1.5">Display Name</label>
                  <input type="text" value={registerForm.displayName} onChange={(e) => setRegisterForm((f) => ({ ...f, displayName: e.target.value }))} className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-tx-ts mb-1.5">Password</label>
                  <input type="password" value={registerForm.password} onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))} className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all" required minLength={8} />
                </div>
                {isAdmin ? (
                  <div>
                    <label className="block text-xs font-medium text-tx-ts mb-1.5">Role</label>
                    <select value={registerForm.role} onChange={(e) => setRegisterForm((f) => ({ ...f, role: e.target.value }))} className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all appearance-none">
                      <option value="agent" className="bg-tx-s1">Agent</option>
                      <option value="supervisor" className="bg-tx-s1">Supervisor</option>
                      <option value="admin" className="bg-tx-s1">Admin</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-tx-ts mb-1.5">Role</label>
                    <div className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-sm text-tx-ts">Agent</div>
                  </div>
                )}
                <div className="col-span-2">
                  <button type="submit" className="px-6 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-tx-green/20">Create Agent</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-tx-s2 border border-tx-bstrong rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-tx-tp text-sm">Delete Agent</h3>
                  <p className="text-xs text-tx-ts">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-tx-ts mb-5">
                Are you sure you want to permanently delete{' '}
                <span className="text-tx-tp font-medium">{confirmDelete.user?.displayName || confirmDelete.sipUsername}</span>?
                This will remove the agent and all associated data.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-ts text-sm font-medium hover:bg-tx-s4 hover:border-tx-bstrong transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteAgent(confirmDelete.id)}
                  className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent list */}
      {agents.length === 0 ? (
        <div className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-tx-s3 border border-tx-bdefault flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-tx-tt" />
          </div>
          <p className="text-tx-tp font-medium text-sm">No agents found</p>
          <p className="text-xs text-tx-ts mt-1">Add your first agent above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent, i) => {
            const statusOption = STATUS_OPTIONS.find((s) => s.value === agent.status) || STATUS_OPTIONS[5];
            const isActive = agent.active !== false; // default to true if undefined
            const lastSeenLabel = getLastSeenLabel(agent);
            const recentlyActive = isRecentlyActive(agent);
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => openDrawer(agent)}
                className={`relative bg-tx-s2 border border-tx-bdefault rounded-2xl p-5 pl-6 overflow-hidden cursor-pointer hover:border-tx-bstrong transition-all ${!isActive ? 'opacity-60' : ''}`}
              >
                {/* Left status accent bar */}
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${isActive ? statusOption.accent : 'bg-tx-bdefault'}`} />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl ${isActive ? 'gradient-primary' : 'bg-tx-s3 border border-tx-bdefault'} flex items-center justify-center text-sm font-bold text-white shadow-md ${isActive ? 'shadow-tx-green/20' : 'shadow-none'}`}>
                      {agent.user?.displayName?.[0] || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold text-sm ${isActive ? 'text-tx-tp' : 'text-tx-ts'}`}>{agent.user?.displayName || agent.sipUsername}</h3>
                        {!isActive && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-tx-s3 text-tx-tt px-2 py-0.5 rounded-md border border-tx-bdefault uppercase tracking-widest">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-tx-ts">@{agent.user?.username} · {agent.user?.role}</p>
                        {/* Last seen indicator */}
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${recentlyActive ? 'text-tx-green' : 'text-tx-tt'}`}>
                          {recentlyActive && <span className="w-1.5 h-1.5 rounded-full bg-tx-green live-dot" />}
                          {lastSeenLabel}
                        </span>
                      </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Force Status dropdown (admin only) */}
                    {isAdmin && isActive && (
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setForceStatusAgentId(forceStatusAgentId === agent.id ? null : agent.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-tx-s3 border border-tx-bdefault text-[10px] font-bold text-tx-ts uppercase tracking-widest hover:bg-tx-s4 hover:border-tx-bstrong transition-all"
                        >
                          <Shield className="w-3 h-3" />
                          Force Status
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <AnimatePresence>
                          {forceStatusAgentId === agent.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.15 }}
                              data-force-status-menu
                              className="absolute right-0 top-full mt-1 w-40 bg-tx-s1 border border-tx-bdefault rounded-xl shadow-xl z-40 overflow-hidden"
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => forceStatus(agent.id, opt.value)}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-tx-tp hover:bg-tx-s3 transition-colors"
                                >
                                  <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                                  {opt.label}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Status</span>
                      <div className="relative">
                        <select
                          value={agent.status}
                          onChange={(e) => updateStatus(agent.id, e.target.value)}
                          disabled={!isActive}
                          onClick={(e) => e.stopPropagation()}
                          className={`appearance-none border rounded-lg pl-6 pr-7 py-1.5 text-xs font-semibold focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all ${isActive ? `${statusOption.bg} ${statusOption.text} ${statusOption.border}` : 'bg-tx-s3 text-tx-tt border-tx-bdefault cursor-not-allowed'}`}
                        >
                          {STATUS_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value} className="bg-tx-s1 text-tx-tp">{opt.label}</option>))}
                        </select>
                        <span className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${isActive ? statusOption.dot : 'bg-tx-tt'}`} />
                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 opacity-70" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Priority</span>
                      <input
                        type="number"
                        value={agent.priority}
                        onChange={(e) => updatePriority(agent.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!isActive}
                        className={`w-16 bg-tx-s3 border border-tx-bdefault rounded-lg px-2 py-1.5 text-xs font-semibold text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all ${!isActive ? 'cursor-not-allowed opacity-50' : ''}`}
                        min={1}
                        max={999}
                      />
                    </div>
                    {agent.activeCallId && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-red-500/10 text-red-400 px-2 py-1 rounded-md border border-red-500/20 uppercase tracking-widest">
                        <span className="relative flex w-1.5 h-1.5">
                          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
                          <span className="relative rounded-full w-1.5 h-1.5 bg-red-400" />
                        </span>
                        On Call
                      </span>
                    )}

                    {/* 3-dot menu */}
                    {isAdmin && (
                      <div className="relative" ref={(el) => { menuRefs.current[agent.id] = el; }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === agent.id ? null : agent.id); }}
                          className="p-1.5 rounded-lg hover:bg-tx-s4 border border-transparent hover:border-tx-bdefault transition-colors text-tx-ts hover:text-tx-tp"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                          {openMenuId === agent.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-0 top-full mt-1 w-44 bg-tx-s1 border border-tx-bdefault rounded-xl shadow-xl z-40 overflow-hidden"
                            >
                              <button
                                onClick={() => toggleActive(agent.id, !isActive)}
                                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-tx-tp hover:bg-tx-s3 transition-colors"
                              >
                                {isActive ? (
                                  <>
                                    <PowerOff className="w-3.5 h-3.5 text-tx-citron" />
                                    <span>Disable</span>
                                  </>
                                ) : (
                                  <>
                                    <Power className="w-3.5 h-3.5 text-tx-green" />
                                    <span>Activate</span>
                                  </>
                                )}
                              </button>
                              <div className="border-t border-tx-bdefault" />
                              <button
                                onClick={() => { setConfirmDelete(agent); setOpenMenuId(null); }}
                                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-tx-bdefault flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-tx-tt uppercase tracking-widest">Queues</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(agent.queues || []).length === 0 && (
                      <span className="text-[11px] text-tx-tt italic">None assigned</span>
                    )}
                    {(agent.queues || []).map((q) => (
                      <span key={q} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-widest ${isActive ? 'bg-tx-green/10 text-tx-green border-tx-green/20' : 'bg-tx-s3 text-tx-tt border-tx-bdefault'}`}>{q}</span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Add queues (comma-separated)"
                    disabled={!isActive}
                    className={`ml-auto text-xs bg-tx-s3 border border-tx-bdefault rounded-lg px-2.5 py-1.5 w-64 text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all ${!isActive ? 'cursor-not-allowed opacity-50' : ''}`}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const t = e.target as HTMLInputElement; updateQueues(agent.id, t.value); t.value = ''; } }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Agent Detail Drawer */}
      <AnimatePresence>
        {drawerAgent && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={closeDrawer}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-[400px] max-w-[90vw] bg-tx-s1 border-l border-tx-bdefault shadow-2xl overflow-y-auto"
            >
              {/* Drawer header */}
              <div className="sticky top-0 z-10 bg-tx-s1/90 backdrop-blur-xl border-b border-tx-bdefault px-5 py-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-tx-tp">Agent Details</h2>
                <button onClick={closeDrawer} className="p-1.5 rounded-lg hover:bg-tx-s3 border border-transparent hover:border-tx-bdefault transition-colors text-tx-ts hover:text-tx-tp">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Agent identity */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-tx-green/20">
                    {drawerAgent.user?.displayName?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-tx-tp truncate">{drawerAgent.user?.displayName || drawerAgent.sipUsername}</h3>
                    <p className="text-xs text-tx-ts">@{drawerAgent.user?.username} · {drawerAgent.user?.role}</p>
                  </div>
                  {/* Large status dot */}
                  {(() => {
                    const opt = STATUS_OPTIONS.find((s) => s.value === drawerAgent.status) || STATUS_OPTIONS[5];
                    return (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${opt.bg} border ${opt.border}`}>
                        <span className={`w-3 h-3 rounded-full ${opt.dot} ${drawerAgent.status === 'online' ? 'live-dot' : ''}`} />
                        <span className={`text-xs font-semibold ${opt.text}`}>{opt.label}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Last active */}
                <div className="flex items-center gap-2 text-xs text-tx-ts">
                  <Clock className="w-3.5 h-3.5 text-tx-tt" />
                  <span>Last active: {getLastSeenLabel(drawerAgent)}</span>
                </div>

                {/* Active call info */}
                {drawerAgent.activeCallId && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="relative flex w-2 h-2">
                        <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" />
                        <span className="relative rounded-full w-2 h-2 bg-red-400" />
                      </span>
                      <span className="text-xs font-bold text-red-400 uppercase tracking-wider">On Active Call</span>
                    </div>
                    <p className="text-[11px] text-tx-ts">Call ID: <span className="font-mono text-tx-tp">{drawerAgent.activeCallId}</span></p>
                  </div>
                )}

                {/* Recent activity */}
                <div>
                  <h4 className="text-[10px] font-bold text-tx-tt uppercase tracking-[0.14em] mb-2">Recent Calls</h4>
                  {drawerLoading ? (
                    <div className="flex items-center justify-center py-6 text-tx-ts">
                      <Activity className="w-4 h-4 animate-spin" />
                    </div>
                  ) : drawerRecentCalls.length === 0 ? (
                    <p className="text-[11px] text-tx-tt italic py-3">No recent calls</p>
                  ) : (
                    <div className="space-y-2">
                      {drawerRecentCalls.map((call, ci) => (
                        <div key={ci} className="bg-tx-s2 border border-tx-bdefault rounded-xl p-3 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${call.direction === 'inbound' ? 'bg-tx-green/10 text-tx-green' : 'bg-tx-blue/10 text-tx-blue'}`}>
                            {call.direction === 'inbound' ? <PhoneCall className="w-3.5 h-3.5" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-tx-tp truncate">{call.from || 'Unknown'} → {call.to || 'Unknown'}</p>
                            <p className="text-[10px] text-tx-ts">{call.queueName || 'Direct'} · {call.status || '—'}</p>
                          </div>
                          <span className="text-xs font-mono text-tx-ts tnum">{fmtDuration(call.duration || 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-tx-tt uppercase tracking-[0.14em] mb-2">Quick Actions</h4>
                  <div className="flex gap-2">
                    <select
                      value={drawerAgent.status}
                      onChange={(e) => { forceStatus(drawerAgent.id, e.target.value); setDrawerAgent((prev) => prev ? { ...prev, status: e.target.value } : prev); }}
                      className="flex-1 appearance-none bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2 text-xs font-medium text-tx-tp focus:outline-none focus:border-tx-green/60 transition-all"
                    >
                      {STATUS_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value} className="bg-tx-s1">{opt.label}</option>))}
                    </select>
                    {isAdmin && (
                      <button
                        onClick={() => { forceLogout(drawerAgent.id); closeDrawer(); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Force Logout
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
