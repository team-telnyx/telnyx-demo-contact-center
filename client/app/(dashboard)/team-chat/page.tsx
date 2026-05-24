'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Users,
  Plus,
  Search,
  Circle,
  Hash,
  Loader2,
  X,
  Phone,
  Bold,
  Italic,
  Code,
  Smile,
  ChevronDown,
  ChevronRight,
  Paperclip,
  AtSign,
  Reply,
  MoreHorizontal,
  Image as ImageIcon,
  FileText,
  XCircle,
} from 'lucide-react';
import api from '../../../lib/api';
import ErrorBoundary from '../../../components/ErrorBoundary';
import { useSocket } from '../../../lib/socket';

/* ── Constants ────────────────────────────────────────────────────── */

const PRESENCE_COLORS = {
  online:    'bg-tx-green shadow-[0_0_8px_rgba(52,211,153,0.6)]',
  available: 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]',
  busy:      'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]',
  away:      'bg-tx-citron shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  offline:   'bg-tx-s3',
};

const AVATAR_COLORS = [
  'from-tx-green/40 to-tx-green-dark/40',
  'from-blue-500/40 to-blue-700/40',
  'from-purple-500/40 to-purple-700/40',
  'from-amber-500/40 to-amber-700/40',
  'from-pink-500/40 to-pink-700/40',
  'from-cyan-500/40 to-cyan-700/40',
];

const ACCEPTED_FILE_TYPES = 'image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/mpeg,audio/wav,audio/ogg';

/* ── Helpers ──────────────────────────────────────────────────────── */

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function timeShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  if (isYesterday) return `Yesterday at ${time}`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` at ${time}`;
}

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ── Format message content with code blocks, links ──────────────── */

function renderContent(text, currentUserDisplayName) {
  if (!text) return null;
  // Split on code blocks first
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3).trim();
      return (
        <pre key={i} className="my-2 p-3 rounded-lg bg-tx-s0 border border-tx-bdefault text-[12px] text-tx-green font-mono overflow-x-auto">
          <code>{code}</code>
        </pre>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1.5 py-0.5 rounded bg-tx-s0 border border-tx-bdefault text-[12px] text-tx-green font-mono">{part.slice(1, -1)}</code>;
    }
    // Handle @mentions, inline bold/italic and links
    const inlineParts = part.split(/(\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s]+|@\w[\w.-]*)/g);
    return inlineParts.map((p, j) => {
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={`${i}-${j}`} className="font-semibold text-tx-tp">{p.slice(2, -2)}</strong>;
      if (p.startsWith('*') && p.endsWith('*')) return <em key={`${i}-${j}`} className="italic text-tx-ts">{p.slice(1, -1)}</em>;
      if (p.startsWith('http')) return <a key={`${i}-${j}`} href={p} target="_blank" rel="noopener noreferrer" className="text-tx-green hover:text-tx-green-hi underline underline-offset-2">{p}</a>;
      // @mention highlighting
      if (p.startsWith('@') && p.length > 1) {
        const mentionName = p.slice(1);
        const isCurrentUser = currentUserDisplayName && mentionName.toLowerCase() === currentUserDisplayName.toLowerCase().replace(/\s+/g, '.');
        if (isCurrentUser) {
          return <span key={`${i}-${j}`} className="px-1 py-0.5 rounded bg-tx-green/20 text-tx-green border border-tx-green/30 font-medium">{p}</span>;
        }
        return <span key={`${i}-${j}`} className="px-1 py-0.5 rounded bg-tx-green/10 text-tx-green">{p}</span>;
      }
      return <span key={`${i}-${j}`}>{p}</span>;
    });
  });
}

/* ════════════════════════════════════════════════════════════════════
   TEAM CHAT PAGE
   ════════════════════════════════════════════════════════════════════ */

export default function TeamChatPage() {
  const { on, emit, connected: socketConnected } = useSocket();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [directory, setDirectory] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatTargets, setNewChatTargets] = useState<any[]>([]);
  const [newChatSubject, setNewChatSubject] = useState('');
  const [newChatMessage, setNewChatMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [presenceMap, setPresenceMap] = useState<Record<string, any>>({});
  const [unreadMap, setUnreadMap] = useState<Record<string, any>>({});
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [dmsCollapsed, setDmsCollapsed] = useState(false);
  const [threadMsgId, setThreadMsgId] = useState<any>(null);
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState<any>(null);
  const [lightboxImage, setLightboxImage] = useState<any>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = popup hidden, string = filter
  const [mentionIndex, setMentionIndex] = useState(0);
  const scrollerRef = useRef(null);
  const typingTimer = useRef(null);
  const fileInputRef = useRef(null);
  const mentionListRef = useRef(null);

  // Current user for @mention self-detection
  const [currentUser, setCurrentUser] = useState<any>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setCurrentUser(JSON.parse(stored));
    } catch {}
  }, []);

  // Filtered mention suggestions
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return directory.filter((a) => {
      const name = (a.displayName || '').toLowerCase();
      const username = (a.username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    }).slice(0, 6);
  }, [mentionQuery, directory]);

  /* ── Data loading ───────────────────────────────────────────── */
  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await api.get('/internal-chat/conversations');
      setConversations(Array.isArray(data) ? data : []);
      const unreads = {};
      for (const c of data) { if (c.unreadCount > 0) unreads[c.id] = c.unreadCount; }
      setUnreadMap(unreads);
    } catch (err: any) { console.error('Failed to load internal conversations', err); }
    finally { setLoadingList(false); }
  }, []);

  const refreshDirectory = useCallback(async () => {
    try {
      const data = await api.get('/internal-chat/directory');
      setDirectory(Array.isArray(data) ? data : []);
      const pm = {};
      for (const a of data) { pm[a.id] = a.presence || 'offline'; }
      setPresenceMap(pm);
    } catch (err: any) { console.error('Failed to load directory', err); }
  }, []);

  useEffect(() => { refreshList(); refreshDirectory(); }, [refreshList, refreshDirectory]);

  /* ── Socket events ──────────────────────────────────────────── */
  useEffect(() => {
    const cleanups = [];
    cleanups.push(on('internal:chat:new', () => refreshList()));
    cleanups.push(on('internal:chat:message', (msg) => {
      const convId = msg.conversationId;
      setConversations((prev) =>
        prev.map((c) => c.id === convId ? { ...c, lastMessageAt: msg.createdAt || new Date().toISOString(), messageCount: (c.messageCount || 0) + 1, _lastPreview: msg.contentType === 'text' ? msg.content : `📎 ${msg.metadata?.fileName || 'File'}` } : c),
      );
      if (selectedId === convId) {
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      } else {
        setUnreadMap((prev) => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }));
      }
    }));
    cleanups.push(on('internal:chat:typing', ({ conversationId, name, isTyping }) => {
      if (conversationId !== selectedId) return;
      setTyping(!!isTyping);
      setTypingUser(name || '');
      clearTimeout(typingTimer.current);
      if (isTyping) typingTimer.current = setTimeout(() => setTyping(false), 3000);
    }));
    cleanups.push(on('internal:chat:unread', ({ conversationId, unreadCount }) => {
      setUnreadMap((prev) => ({ ...prev, [conversationId]: unreadCount }));
    }));
    cleanups.push(on('internal:chat:closed', ({ conversationId }) => {
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, status: 'closed' } : c)));
    }));
    cleanups.push(on('internal:presence', ({ agentId, presence }) => {
      setPresenceMap((prev) => ({ ...prev, [agentId]: presence }));
      setDirectory((prev) => prev.map((a) => (a.id === agentId ? { ...a, presence } : a)));
    }));
    return () => cleanups.forEach((fn) => fn());
  }, [on, selectedId, refreshList]);

  /* ── Load messages ─────────────────────────────────────────── */
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    setLoadingMsgs(true);
    setThreadMsgId(null);
    emit('internal:chat:join', { conversationId: selectedId });
    api.get(`/internal-chat/conversations/${selectedId}`)
      .then((data) => {
        setMessages(data.messages || []);
        api.post(`/internal-chat/conversations/${selectedId}/read`).catch(() => {});
        setUnreadMap((prev) => ({ ...prev, [selectedId]: 0 }));
      })
      .catch((err) => console.error('Failed to load messages', err))
      .finally(() => setLoadingMsgs(false));
    return () => emit('internal:chat:leave', { conversationId: selectedId });
  }, [selectedId, emit]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  /* ── Handlers ───────────────────────────────────────────────── */
  async function sendMessage() {
    const text = draft.trim();
    if (!text && !attachedFile) return;
    if (!selectedId) return;

    // If there's an attached file, upload it
    if (attachedFile) {
      setUploadProgress(0);
      try {
        await api.upload(`/internal-chat/conversations/${selectedId}/upload`, attachedFile, (pct) => setUploadProgress(pct));
        setAttachedFile(null);
        setUploadProgress(null);
      } catch (err: any) {
        console.error('Failed to upload file', err);
        setUploadProgress(null);
        return;
      }
    }

    // If there's also text, send it as a separate message
    if (text) {
      setDraft('');
      emit('internal:chat:typing', { conversationId: selectedId, isTyping: false });
      try { await api.post(`/internal-chat/conversations/${selectedId}/messages`, { content: text }); }
      catch (err: any) { console.error('Failed to send', err); setDraft(text); }
    } else {
      setDraft('');
      emit('internal:chat:typing', { conversationId: selectedId, isTyping: false });
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = '';
  }

  function removeAttachedFile() {
    setAttachedFile(null);
    setUploadProgress(null);
  }

  function onDraftChange(v) {
    setDraft(v);
    if (selectedId) emit('internal:chat:typing', { conversationId: selectedId, isTyping: !!v });

    // Detect @mention trigger
    const cursorPos = v.length;
    const textBeforeCursor = v.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w[\w.-]*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  function selectMention(agent) {
    const cursorPos = draft.length;
    const textBeforeCursor = draft.slice(0, cursorPos);
    const textAfterCursor = draft.slice(cursorPos);
    // Replace the @query part with @displayName (no spaces)
    const replaced = textBeforeCursor.replace(/@(\w[\w.-]*)$/, `@${(agent.displayName || agent.username || '').replace(/\s+/g, '.')} `) + textAfterCursor;
    setDraft(replaced);
    setMentionQuery(null);
    setMentionIndex(0);
  }

  async function createConversation() {
    if (newChatTargets.length === 0) return;
    setCreating(true);
    try {
      const result = await api.post('/internal-chat/conversations', {
        participantIds: newChatTargets,
        subject: newChatSubject || undefined,
        initialMessage: newChatMessage || undefined,
      });
      setShowNewChat(false);
      setNewChatTargets([]);
      setNewChatSubject('');
      setNewChatMessage('');
      setSelectedId(result.id);
      refreshList();
    } catch (err: any) { console.error('Failed to create conversation', err); }
    finally { setCreating(false); }
  }

  async function closeChat() {
    if (!selectedId) return;
    try { await api.post(`/internal-chat/conversations/${selectedId}/close`); refreshList(); }
    catch (err: any) { console.error(err); }
  }

  /* ── Filtered lists ────────────────────────────────────────── */
  const channelChats = useMemo(
    () => conversations.filter((c) => c.status !== 'closed' && c.participants?.length > 2 && (!query || (c.subject || '').toLowerCase().includes(query.toLowerCase()))),
    [conversations, query],
  );

  const dmChats = useMemo(
    () => conversations.filter((c) => c.status !== 'closed' && (c.participants?.length || 0) <= 2 && (!query || `${c.subject || ''} ${c.visitorName || ''}`.toLowerCase().includes(query.toLowerCase()))),
    [conversations, query],
  );

  const onlineAgents = useMemo(
    () => directory.filter((a) => presenceMap[a.id] === 'online' || presenceMap[a.id] === 'available'),
    [directory, presenceMap],
  );

  const offlineAgents = useMemo(
    () => directory.filter((a) => presenceMap[a.id] !== 'online' && presenceMap[a.id] !== 'available'),
    [directory, presenceMap],
  );

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );

  const totalUnread = Object.values(unreadMap).reduce((sum, n) => sum + n, 0);

  // Thread messages
  const threadMessages = useMemo(() => {
    if (!threadMsgId) return [];
    const idx = messages.findIndex((m) => m.id === threadMsgId);
    if (idx < 0) return [];
    return messages.slice(idx);
  }, [messages, threadMsgId]);

  const threadParent = useMemo(() => {
    if (!threadMsgId) return null;
    return messages.find((m) => m.id === threadMsgId) || null;
  }, [messages, threadMsgId]);

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */

  return (
    <div className="h-full flex flex-col">
      {/* ── Page header ────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center gap-3.5 mb-1">
          <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-tx-green/20 relative flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-white" strokeWidth={2} />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-lg ring-2 ring-tx-s0">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-tx-tp tracking-tight">Team Chat</h1>
            <p className="text-[11px] text-tx-ts mt-0.5">Internal messaging with your team</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setShowNewChat(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-semibold shadow-lg shadow-tx-green/20 hover:shadow-tx-green/40 transition-shadow active:scale-[0.97]"
            >
              <Plus className="w-3.5 h-3.5" /> New Chat
            </button>
          </div>
        </div>
      </div>

      <ErrorBoundary name="Team Chat">
        <div className="flex-1 flex min-h-0 px-8 pb-8 gap-0">

          {/* ════════════════════════════════════════════════════════
              LEFT SIDEBAR — Channels & DMs
              ════════════════════════════════════════════════════════ */}
          <aside className="w-[280px] flex-shrink-0 bg-tx-s2 border border-tx-bdefault rounded-2xl overflow-hidden flex flex-col">
            {/* Search */}
            <div className="px-3 pt-3 pb-2 border-b border-tx-bdefault">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tx-ts" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search channels & people…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* ── Channels section ──────────────────────────────── */}
              <div className="px-2 pt-3">
                <button
                  onClick={() => setChannelsCollapsed(!channelsCollapsed)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-tx-tt hover:text-tx-ts transition-colors"
                >
                  {channelsCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Channels
                  <Plus className="w-3 h-3 ml-auto opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setShowNewChat(true); }} />
                </button>
              </div>

              {!channelsCollapsed && (
                <div className="mt-0.5">
                  {loadingList && (
                    <div className="flex items-center justify-center py-6 text-tx-ts">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                  {!loadingList && channelChats.length === 0 && (
                    <div className="px-6 py-3 text-[11px] text-tx-tt">No channels yet</div>
                  )}
                  {channelChats.map((c) => {
                    const isSelected = selectedId === c.id;
                    const unread = unreadMap[c.id] || 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                          isSelected ? 'bg-tx-green/[0.08] text-tx-tp' : 'text-tx-ts hover:bg-tx-s3 hover:text-tx-tp'
                        }`}
                      >
                        <Hash className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-tx-green' : 'text-tx-tt'}`} />
                        <span className={`text-[13px] truncate flex-1 ${unread > 0 ? 'font-semibold text-tx-tp' : ''}`}>
                          {c.subject || 'general'}
                        </span>
                        {unread > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-tx-green/20 text-tx-green text-[9px] font-bold flex-shrink-0">
                            {unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Direct Messages section ──────────────────────── */}
              <div className="px-2 pt-4">
                <button
                  onClick={() => setDmsCollapsed(!dmsCollapsed)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-tx-tt hover:text-tx-ts transition-colors"
                >
                  {dmsCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Direct Messages
                </button>
              </div>

              {!dmsCollapsed && (
                <div className="mt-0.5">
                  {dmChats.map((c) => {
                    const isSelected = selectedId === c.id;
                    const unread = unreadMap[c.id] || 0;
                    const participants = c.participants || [];
                    const otherAgent = participants.find((p) => p.agent?.user);
                    const otherName = otherAgent?.agent?.user?.displayName || c.visitorName || 'DM';
                    const otherPresence = otherAgent?.agentId ? presenceMap[otherAgent.agentId] : 'offline';
                    const otherColor = avatarColor(otherName);

                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                          isSelected ? 'bg-tx-green/[0.08]' : 'hover:bg-tx-s3'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${otherColor} border border-tx-bdefault flex items-center justify-center text-[9px] font-bold text-tx-tp`}>
                            {initials(otherName)}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-tx-s2 ${
                            PRESENCE_COLORS[otherPresence] || PRESENCE_COLORS.offline
                          }`} />
                        </div>
                        <span className={`text-[13px] truncate flex-1 ${
                          unread > 0 ? 'font-semibold text-tx-tp' : isSelected ? 'text-tx-tp' : 'text-tx-ts'
                        }`}>
                          {otherName}
                        </span>
                        {unread > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-tx-green/20 text-tx-green text-[9px] font-bold flex-shrink-0">
                            {unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Online team members ──────────────────────────── */}
              <div className="px-2 pt-4">
                <p className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-tx-tt">Online — {onlineAgents.length}</p>
              </div>
              <div className="pb-2">
                {onlineAgents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setShowNewChat(true); setNewChatTargets([a.id]); }}
                    className="w-full flex items-center gap-2.5 px-4 py-1.5 text-left hover:bg-tx-s3 transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(a.displayName)} border border-tx-bdefault flex items-center justify-center text-[9px] font-bold text-tx-tp`}>
                        {initials(a.displayName)}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-tx-s2 ${
                        PRESENCE_COLORS[presenceMap[a.id] || a.presence || 'offline'] || PRESENCE_COLORS.offline
                      }`} />
                    </div>
                    <span className="text-[12px] text-tx-ts font-medium truncate">{a.displayName}</span>
                    {a.extension && (
                      <span className="text-[9px] text-tx-tt ml-auto font-mono">ext {a.extension}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Offline */}
              {offlineAgents.length > 0 && (
                <>
                  <div className="px-2 pt-2">
                    <p className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-tx-tt opacity-50">Offline — {offlineAgents.length}</p>
                  </div>
                  <div className="pb-3">
                    {offlineAgents.slice(0, 5).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => { setShowNewChat(true); setNewChatTargets([a.id]); }}
                        className="w-full flex items-center gap-2.5 px-4 py-1.5 text-left hover:bg-tx-s3 transition-colors opacity-50"
                      >
                        <div className="w-7 h-7 rounded-full bg-tx-s3 border border-tx-bdefault flex items-center justify-center text-[9px] font-bold text-tx-ts">
                          {initials(a.displayName)}
                        </div>
                        <span className="text-[12px] text-tx-tt truncate">{a.displayName}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </aside>

          {/* ════════════════════════════════════════════════════════
              MAIN — Chat messages
              ════════════════════════════════════════════════════════ */}
          <section className={`flex-1 bg-tx-s2 border border-tx-bdefault rounded-2xl overflow-hidden flex flex-col min-w-0 ml-4 ${threadMsgId ? 'mr-0' : ''}`}>
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-tx-ts">
                <div className="w-16 h-16 rounded-2xl bg-tx-s3 border border-tx-bdefault flex items-center justify-center mb-4">
                  <Hash className="w-8 h-8 text-tx-tt" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-tx-ts">Select a channel or DM</p>
                <p className="text-[11px] text-tx-tt mt-1">Choose from the sidebar to start chatting</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-tx-bdefault bg-gradient-to-r from-tx-green/[0.03] to-transparent">
                  {(() => {
                    const isGroup = (selected.participants?.length || 0) > 2;
                    return (
                      <>
                        <div className={`w-8 h-8 rounded-lg ${isGroup ? 'bg-tx-citron/15 border border-tx-citron/25' : 'bg-tx-green/15 border border-tx-green/25'} flex items-center justify-center`}>
                          {isGroup ? <Hash className="w-4 h-4 text-tx-citron" /> : <MessageSquare className="w-4 h-4 text-tx-green" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-tx-tp truncate">
                            {selected.subject || (isGroup ? 'Group Chat' : 'Direct Message')}
                          </p>
                          <p className="text-[10px] text-tx-ts">
                            {selected.participants?.map((p) => p.agent?.user?.displayName || 'Agent').join(', ') || 'Team members'}
                          </p>
                        </div>
                        <button
                          onClick={closeChat}
                          className="px-2.5 py-1 rounded-lg text-tx-ts hover:text-tx-red text-[11px] font-medium transition-colors hover:bg-tx-red/10"
                        >
                          Close
                        </button>
                      </>
                    );
                  })()}
                </div>

                {/* Messages */}
                <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
                  {loadingMsgs && (
                    <div className="flex items-center justify-center py-16 text-tx-ts">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  )}
                  {!loadingMsgs && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-tx-ts text-sm">
                      <MessageSquare className="w-6 h-6 mb-2 opacity-40" />
                      No messages yet. Say hi!
                    </div>
                  )}
                  {messages.map((msg, idx) => {
                    const isMe = msg.metadata?.agentId === selected.agentId || msg.sender === 'agent';
                    const prevMsg = messages[idx - 1];
                    const isGrouped = prevMsg && prevMsg.sender === msg.sender &&
                      prevMsg.metadata?.agentId === msg.metadata?.agentId &&
                      (new Date(msg.createdAt as string).getTime() - new Date(prevMsg.createdAt as string).getTime()) < 300000; // 5 min grouping
                    const senderName = msg.senderName || msg.metadata?.agentName || (isMe ? 'You' : 'Agent');
                    const senderColor = avatarColor(senderName);

                    // Date divider
                    const showDateDivider = idx === 0 || (
                      new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString()
                    );

                    return (
                      <div key={msg.id}>
                        {showDateDivider && (
                          <div className="flex items-center gap-3 py-4">
                            <div className="flex-1 h-px bg-tx-bdefault/30" />
                            <span className="text-[10px] text-tx-tt uppercase tracking-wider">
                              {new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </span>
                            <div className="flex-1 h-px bg-tx-bdefault/30" />
                          </div>
                        )}

                        <div className={`flex gap-3 group ${isGrouped ? 'mt-0.5 pl-12' : 'mt-4'}`}>
                          {/* Avatar (only for first message in group) */}
                          {!isGrouped && (
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${senderColor} border border-tx-bdefault flex items-center justify-center text-[9px] font-bold text-tx-tp flex-shrink-0 mt-0.5`}>
                              {initials(senderName)}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            {/* Name + time (only for first message in group) */}
                            {!isGrouped && (
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className={`text-[13px] font-semibold ${isMe ? 'text-tx-green' : 'text-tx-tp'}`}>
                                  {senderName}
                                </span>
                                <span className="text-[10px] text-tx-tt">{timeShort(msg.createdAt)}</span>
                              </div>
                            )}

                            {/* Message body */}
                            <div className="text-[13px] text-tx-tp/90 leading-relaxed break-words">
                              {/* File attachment rendering */}
                              {(msg.contentType === 'image' || msg.contentType === 'file') && msg.metadata?.fileUrl && (() => {
                                const isImg = msg.contentType === 'image' || (msg.metadata?.mimeType || '').startsWith('image/');
                                if (isImg) {
                                  return (
                                    <div className="mb-2">
                                      <img
                                        src={msg.metadata.fileUrl}
                                        alt={msg.metadata.fileName || 'Image'}
                                        className="max-w-[320px] max-h-[220px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-cover"
                                        onClick={() => setLightboxImage(msg.metadata.fileUrl)}
                                      />
                                      <p className="text-[11px] mt-1 opacity-60">{msg.metadata.fileName}</p>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-tx-s3/50 border border-tx-bdefault">
                                    <FileText className="w-4 h-4 text-tx-green flex-shrink-0" />
                                    <a
                                      href={msg.metadata.fileUrl}
                                      download={msg.metadata.fileName}
                                      className="text-[12px] text-tx-green hover:text-tx-green-hi underline underline-offset-2 truncate"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {msg.metadata.fileName || msg.content}
                                    </a>
                                    <span className="text-[10px] text-tx-tt ml-auto flex-shrink-0">
                                      {msg.metadata.fileSize ? `${(msg.metadata.fileSize / 1024).toFixed(0)}KB` : ''}
                                    </span>
                                  </div>
                                );
                              })()}
                              {/* Text content */}
                              {(!msg.contentType || msg.contentType === 'text' || msg.contentType === 'html') && renderContent(msg.content, currentUser?.displayName)}
                            </div>

                            {/* Thread reply indicator / actions on hover */}
                            <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setThreadMsgId(msg.id)}
                                className="flex items-center gap-1 text-[10px] text-tx-tt hover:text-tx-green transition-colors"
                              >
                                <Reply className="w-3 h-3" /> Reply in thread
                              </button>
                              <button className="flex items-center gap-1 text-[10px] text-tx-tt hover:text-tx-green transition-colors">
                                <Smile className="w-3 h-3" /> React
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing indicator */}
                  {typing && (
                    <div className="flex items-center gap-2 text-xs text-tx-ts mt-4">
                      <div className="flex gap-1">
                        <span className="typing-dot-1 w-1.5 h-1.5 rounded-full bg-tx-green" />
                        <span className="typing-dot-2 w-1.5 h-1.5 rounded-full bg-tx-green" />
                        <span className="typing-dot-3 w-1.5 h-1.5 rounded-full bg-tx-green" />
                      </div>
                      <span>{typingUser || 'Someone'} is typing…</span>
                    </div>
                  )}
                </div>

                {/* ── Composer ─────────────────────────────────────── */}
                <div className="relative border-t border-tx-bdefault px-4 py-3">
                  {/* Attached file preview */}
                  {attachedFile && (
                    <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-tx-s3 border border-tx-green/20">
                      {attachedFile.type.startsWith('image/') ? (
                        <ImageIcon className="w-4 h-4 text-tx-green flex-shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-tx-green flex-shrink-0" />
                      )}
                      <span className="text-[11px] text-tx-tp truncate flex-1">{attachedFile.name}</span>
                      <span className="text-[10px] text-tx-tt">{(attachedFile.size / 1024).toFixed(0)}KB</span>
                      <button onClick={removeAttachedFile} className="text-tx-ts hover:text-tx-red transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {/* Upload progress */}
                  {uploadProgress !== null && (
                    <div className="mb-2 px-3 py-2 rounded-xl bg-tx-s3 border border-tx-bdefault">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-tx-green" />
                        <span className="text-[11px] text-tx-ts">Uploading… {uploadProgress}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-tx-s4 overflow-hidden">
                        <div
                          className="h-full rounded-full gradient-primary transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Formatting toolbar */}
                  <div className="flex items-center gap-0.5 mb-2 px-1">
                    <button className="p-1.5 rounded text-tx-tt hover:text-tx-ts hover:bg-tx-s3 transition-colors" title="Bold (**)">
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded text-tx-tt hover:text-tx-ts hover:bg-tx-s3 transition-colors" title="Italic (*)">
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded text-tx-tt hover:text-tx-ts hover:bg-tx-s3 transition-colors" title="Code (`)">
                      <Code className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-4 bg-tx-bdefault/30 mx-1" />
                    <button className="p-1.5 rounded text-tx-tt hover:text-tx-ts hover:bg-tx-s3 transition-colors" title="Mention (@)">
                      <AtSign className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded text-tx-tt hover:text-tx-ts hover:bg-tx-s3 transition-colors" title="Emoji">
                      <Smile className="w-3.5 h-3.5" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_FILE_TYPES}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 rounded text-tx-tt hover:text-tx-ts hover:bg-tx-s3 transition-colors"
                      title="Attach file"
                      disabled={uploadProgress !== null}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Input */}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(e) => onDraftChange(e.target.value)}
                      onKeyDown={(e) => {
                        // Mention autocomplete navigation
                        if (mentionQuery !== null && mentionSuggestions.length > 0) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setMentionIndex((prev) => Math.min(prev + 1, mentionSuggestions.length - 1));
                            return;
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setMentionIndex((prev) => Math.max(prev - 1, 0));
                            return;
                          }
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            selectMention(mentionSuggestions[mentionIndex]);
                            return;
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setMentionQuery(null);
                            return;
                          }
                        }
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                      }}
                      placeholder="Type a message… (use **bold**, *italic*, `code`, @mention)"
                      rows={1}
                      className="flex-1 px-4 py-2.5 text-sm bg-tx-s3 border border-tx-bdefault rounded-xl text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-colors resize-none max-h-32"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={sendMessage}
                      disabled={!draft.trim() && !attachedFile}
                      className="w-10 h-10 rounded-xl gradient-primary text-white shadow-lg shadow-tx-green/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </motion.button>
                  </div>

                  {/* @mention autocomplete popup */}
                  <AnimatePresence>
                    {mentionQuery !== null && mentionSuggestions.length > 0 && (
                      <motion.div
                        ref={mentionListRef}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute bottom-full left-4 right-16 mb-2 bg-tx-s1 border border-tx-bdefault rounded-xl shadow-xl overflow-hidden z-20"
                      >
                        <div className="px-3 py-1.5 border-b border-tx-bdefault bg-tx-s2">
                          <span className="text-[10px] font-semibold text-tx-tt uppercase tracking-wider">Mention someone</span>
                        </div>
                        {mentionSuggestions.map((agent, idx) => {
                          const isActive = idx === mentionIndex;
                          const pres = presenceMap[agent.id] || agent.presence || 'offline';
                          return (
                            <button
                              key={agent.id}
                              onClick={() => selectMention(agent)}
                              onMouseEnter={() => setMentionIndex(idx)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${isActive ? 'bg-tx-green/10' : 'hover:bg-tx-s3'}`}
                            >
                              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarColor(agent.displayName)} border border-tx-bdefault flex items-center justify-center text-[8px] font-bold text-tx-tp flex-shrink-0`}>
                                {initials(agent.displayName)}
                              </div>
                              <span className="text-[12px] font-medium text-tx-tp truncate">{agent.displayName}</span>
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRESENCE_COLORS[pres] || PRESENCE_COLORS.offline}`} />
                              {isActive && <span className="ml-auto text-[10px] text-tx-green">Enter ↵</span>}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </section>

          {/* ════════════════════════════════════════════════════════
              RIGHT PANEL — Thread detail
              ════════════════════════════════════════════════════════ */}
          {selected && threadMsgId && (
            <aside className="hidden lg:flex flex-col w-[320px] flex-shrink-0 bg-tx-s2 border border-tx-bdefault rounded-2xl overflow-hidden flex-col ml-4">
              {/* Thread header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-tx-bdefault">
                <Reply className="w-4 h-4 text-tx-green" />
                <span className="text-sm font-semibold text-tx-tp">Thread</span>
                <button
                  onClick={() => setThreadMsgId(null)}
                  className="ml-auto p-1 rounded text-tx-ts hover:text-tx-tp hover:bg-tx-s3 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Thread messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {threadParent && (
                  <div className="pb-3 border-b border-tx-bdefault">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[12px] font-semibold text-tx-tp">{threadParent.senderName || 'Agent'}</span>
                      <span className="text-[9px] text-tx-tt">{timeShort(threadParent.createdAt)}</span>
                    </div>
                    <div className="text-[12px] text-tx-tp/90 leading-relaxed">{renderContent(threadParent.content, currentUser?.displayName)}</div>
                  </div>
                )}
                {threadMessages.filter((m) => m.id !== threadMsgId).map((msg) => (
                  <div key={msg.id} className="flex gap-2">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${avatarColor(msg.senderName)} border border-tx-bdefault flex items-center justify-center text-[8px] font-bold text-tx-tp flex-shrink-0`}>
                      {initials(msg.senderName)}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] font-semibold text-tx-tp">{msg.senderName || 'Agent'}</span>
                        <span className="text-[9px] text-tx-tt">{timeShort(msg.createdAt)}</span>
                      </div>
                      <div className="text-[12px] text-tx-tp/90 leading-relaxed">{renderContent(msg.content, currentUser?.displayName)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
      </ErrorBoundary>

      {/* ════════════════════════════════════════════════════════════
          New Chat Modal
          ════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewChat(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[480px] max-h-[80vh] bg-tx-s1 border border-tx-bdefault rounded-2xl shadow-2xl flex flex-col"
            >
              <div className="px-6 py-4 border-b border-tx-bdefault flex items-center justify-between">
                <h3 className="text-lg font-semibold text-tx-tp">New Team Chat</h3>
                <button onClick={() => setShowNewChat(false)} className="text-tx-ts hover:text-tx-tp">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Select participants */}
                <div>
                  <label className="text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-2 block">
                    Participants
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {directory.map((a) => {
                      const isSelected = newChatTargets.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() => {
                            setNewChatTargets((prev) =>
                              isSelected ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                            );
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                            isSelected
                              ? 'bg-tx-green/15 border border-tx-green/25'
                              : 'bg-tx-s3 border border-tx-bdefault hover:bg-tx-s4'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${PRESENCE_COLORS[presenceMap[a.id] || a.presence || 'offline'] || PRESENCE_COLORS.offline}`} />
                          <span className="text-sm text-tx-tp font-medium">{a.displayName}</span>
                          {a.extension && (
                            <span className="text-[10px] text-tx-ts ml-auto font-mono">ext {a.extension}</span>
                          )}
                          {isSelected && <span className="text-tx-green text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5 block">
                    Channel name (optional)
                  </label>
                  <input
                    value={newChatSubject}
                    onChange={(e) => setNewChatSubject(e.target.value)}
                    placeholder="e.g. vip-escalations"
                    className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
                  />
                </div>

                {/* Initial message */}
                <div>
                  <label className="text-[10px] font-semibold text-tx-ts uppercase tracking-[0.14em] mb-1.5 block">
                    Message (optional)
                  </label>
                  <textarea
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    placeholder="Say something to start the conversation…"
                    rows={3}
                    className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-sm text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-tx-bdefault">
                <button
                  onClick={createConversation}
                  disabled={newChatTargets.length === 0 || creating}
                  className="w-full py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm shadow-lg shadow-tx-green/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  {creating ? 'Creating…' : 'Start Chat'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Image lightbox ────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
            onClick={() => setLightboxImage(null)}
          >
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              src={lightboxImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}