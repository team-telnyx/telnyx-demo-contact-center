'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Hash,
  Loader2,
  Plus,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Paperclip,
  Smile,
  Bold,
  Italic,
  Code,
  AtSign,
  Reply,
} from 'lucide-react';
import api from '../lib/api';
import { useSocket } from '../lib/socket';

/* ── Helpers ──────────────────────────────────────────────────────── */

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

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'now';
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
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

function renderContent(text) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3).trim();
      return <pre key={i} className="my-1 p-2 rounded bg-tx-s0 border border-tx-bdefault/30 text-[11px] text-tx-green font-mono overflow-x-auto"><code>{code}</code></pre>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1 py-0.5 rounded bg-tx-s0 border border-tx-bdefault/30 text-[11px] text-tx-green font-mono">{part.slice(1, -1)}</code>;
    }
    const inlineParts = part.split(/(\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s]+)/g);
    return inlineParts.map((p, j) => {
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={`${i}-${j}`} className="font-semibold text-tx-tp">{p.slice(2, -2)}</strong>;
      if (p.startsWith('*') && p.endsWith('*')) return <em key={`${i}-${j}`} className="italic text-tx-ts">{p.slice(1, -1)}</em>;
      if (p.startsWith('http')) return <a key={`${i}-${j}`} href={p} target="_blank" rel="noopener noreferrer" className="text-tx-green hover:text-tx-green-hi underline underline-offset-2">{p}</a>;
      return <span key={`${i}-${j}`}>{p}</span>;
    });
  });
}

/* ── Compact Team Chat ──────────────────────────────────────────────── */

export default function CompactTeamChat() {
  const { on, emit, connected: socketConnected } = useSocket();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [directory, setDirectory] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [presenceMap, setPresenceMap] = useState<Record<string, any>>({});
  const [unreadMap, setUnreadMap] = useState<Record<string, any>>({});
  const [showChannels, setShowChannels] = useState(true);
  const [showDms, setShowDms] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatTargets, setNewChatTargets] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const scrollerRef = useRef(null);
  const typingTimer = useRef(null);

  /* ── Data ──────────────────────────────────────────────────── */
  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await api.get('/internal-chat/conversations');
      setConversations(Array.isArray(data) ? data : []);
      const unreads = {};
      for (const c of data) { if (c.unreadCount > 0) unreads[c.id] = c.unreadCount; }
      setUnreadMap(unreads);
    } catch (err) { console.error('Failed to load conversations', err); }
    finally { setLoadingList(false); }
  }, []);

  const refreshDirectory = useCallback(async () => {
    try {
      const data = await api.get('/internal-chat/directory');
      setDirectory(Array.isArray(data) ? data : []);
      const pm = {};
      for (const a of data) { pm[a.id] = a.presence || 'offline'; }
      setPresenceMap(pm);
    } catch (err) { console.error('Failed to load directory', err); }
  }, []);

  useEffect(() => { refreshList(); refreshDirectory(); }, [refreshList, refreshDirectory]);

  /* ── Socket ────────────────────────────────────────────────── */
  useEffect(() => {
    const cleanups = [];
    cleanups.push(on('internal:chat:new', () => refreshList()));
    cleanups.push(on('internal:chat:message', (msg) => {
      const convId = msg.conversationId;
      setConversations((prev) =>
        prev.map((c) => c.id === convId ? { ...c, lastMessageAt: msg.createdAt || new Date().toISOString(), messageCount: (c.messageCount || 0) + 1, _lastPreview: msg.contentType === 'text' ? msg.content : '📎 File' } : c),
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
      if (isTyping) typingTimer.current = setTimeout(() => setTyping(false), 3500);
    }));
    cleanups.push(on('internal:chat:unread', ({ conversationId, unreadCount }) => {
      setUnreadMap((prev) => ({ ...prev, [conversationId]: unreadCount }));
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

  /* ── Send ──────────────────────────────────────────────────── */
  async function sendMessage() {
    const text = draft.trim();
    if (!text || !selectedId) return;
    setDraft('');
    emit('internal:chat:typing', { conversationId: selectedId, isTyping: false });
    try { await api.post(`/internal-chat/conversations/${selectedId}/messages`, { content: text }); }
    catch (err) { console.error('Failed to send', err); setDraft(text); }
  }

  function onDraftChange(v) {
    setDraft(v);
    if (selectedId) emit('internal:chat:typing', { conversationId: selectedId, isTyping: !!v });
  }

  async function createConversation() {
    if (newChatTargets.length === 0) return;
    setCreating(true);
    try {
      const result = await api.post('/internal-chat/conversations', {
        participantIds: newChatTargets,
      });
      setShowNewChat(false);
      setNewChatTargets([]);
      setSelectedId(result.id);
      refreshList();
    } catch (err) { console.error('Failed to create conversation', err); }
    finally { setCreating(false); }
  }

  /* ── Filtered lists ────────────────────────────────────────── */
  const channelChats = useMemo(
    () => conversations.filter((c) => c.status !== 'closed' && c.participants?.length > 2),
    [conversations],
  );

  const dmChats = useMemo(
    () => conversations.filter((c) => c.status !== 'closed' && (c.participants?.length || 0) <= 2),
    [conversations],
  );

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );

  const totalUnread = Object.values(unreadMap).reduce((sum, n) => sum + n, 0);

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="flex h-full min-h-0">
      {/* ── Left: Channel/DM list ──────────────────────────────── */}
      <div className="w-[180px] flex-shrink-0 border-r border-tx-bdefault/30 flex flex-col">
        <div className="px-2 pt-2 pb-1 flex items-center justify-between">
          <span className="text-[9px] font-semibold text-tx-tt uppercase tracking-wider">Chat</span>
          <button
            onClick={() => setShowNewChat(true)}
            className="p-0.5 rounded text-tx-tt hover:text-tx-green hover:bg-tx-green/10 transition-colors"
            title="New chat"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Channels */}
          <button
            onClick={() => setShowChannels(!showChannels)}
            className="w-full flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-tx-tt hover:text-tx-ts"
          >
            {showChannels ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
            Channels
          </button>
          {showChannels && channelChats.map((c) => {
            const isActive = selectedId === c.id;
            const unread = unreadMap[c.id] || 0;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-left transition-colors ${
                  isActive ? 'bg-tx-green/[0.08] text-tx-tp' : 'text-tx-ts hover:bg-tx-s3 hover:text-tx-tp'
                }`}
              >
                <Hash className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-tx-green' : 'text-tx-tt'}`} />
                <span className={`text-[11px] truncate flex-1 ${unread > 0 ? 'font-semibold text-tx-tp' : ''}`}>
                  {c.subject || 'general'}
                </span>
                {unread > 0 && (
                  <span className="px-1 py-0 rounded-full bg-tx-green/20 text-tx-green text-[8px] font-bold flex-shrink-0">{unread}</span>
                )}
              </button>
            );
          })}

          {/* DMs */}
          <button
            onClick={() => setShowDms(!showDms)}
            className="w-full flex items-center gap-1 px-2 py-1 mt-2 text-[9px] uppercase tracking-wider font-semibold text-tx-tt hover:text-tx-ts"
          >
            {showDms ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
            DMs
          </button>
          {showDms && dmChats.map((c) => {
            const isActive = selectedId === c.id;
            const unread = unreadMap[c.id] || 0;
            const otherAgent = c.participants?.find((p) => p.agent?.user);
            const otherName = otherAgent?.agent?.user?.displayName || c.visitorName || 'DM';
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-left transition-colors ${
                  isActive ? 'bg-tx-green/[0.08] text-tx-tp' : 'text-tx-ts hover:bg-tx-s3 hover:text-tx-tp'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarColor(otherName)} border border-tx-bdefault/30 flex items-center justify-center text-[7px] font-bold text-tx-tp flex-shrink-0`}>
                  {initials(otherName)}
                </div>
                <span className={`text-[11px] truncate flex-1 ${unread > 0 ? 'font-semibold text-tx-tp' : ''}`}>{otherName}</span>
                {unread > 0 && (
                  <span className="px-1 py-0 rounded-full bg-tx-green/20 text-tx-green text-[8px] font-bold flex-shrink-0">{unread}</span>
                )}
              </button>
            );
          })}

          {/* Online team */}
          <div className="px-2 mt-3 mb-1">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-tx-tt opacity-50">Team</span>
          </div>
          {directory.filter((a) => presenceMap[a.id] === 'online' || presenceMap[a.id] === 'available').map((a) => (
            <button
              key={a.id}
              onClick={() => { setShowNewChat(true); setNewChatTargets([a.id]); }}
              className="w-full flex items-center gap-2 px-3 py-1 text-left hover:bg-tx-s3 transition-colors"
            >
              <div className="relative flex-shrink-0">
                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarColor(a.displayName)} border border-tx-bdefault/30 flex items-center justify-center text-[7px] font-bold text-tx-tp`}>
                  {initials(a.displayName)}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-tx-s2 ${PRESENCE_COLORS[presenceMap[a.id] || a.presence || 'offline'] || PRESENCE_COLORS.offline}`} />
              </div>
              <span className="text-[10px] text-tx-ts font-medium truncate">{a.displayName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: Messages ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-tx-tt">
            <Hash className="w-6 h-6 mb-2 opacity-30" />
            <p className="text-[11px]">Select a channel or DM</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-tx-bdefault/30">
              {(() => {
                const isGroup = (selected.participants?.length || 0) > 2;
                return (
                  <>
                    <div className={`w-6 h-6 rounded-md ${isGroup ? 'bg-tx-citron/15 border border-tx-citron/25' : 'bg-tx-green/15 border border-tx-green/25'} flex items-center justify-center`}>
                      {isGroup ? <Hash className="w-3 h-3 text-tx-citron" /> : <MessageSquare className="w-3 h-3 text-tx-green" />}
                    </div>
                    <span className="text-xs font-semibold text-tx-tp truncate">
                      {selected.subject || (isGroup ? 'Group Chat' : 'Direct Message')}
                    </span>
                  </>
                );
              })()}
            </div>

            {/* Messages */}
            <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-0 scrollbar-thin">
              {loadingMsgs && (
                <div className="flex items-center justify-center py-8 text-tx-ts">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-tx-ts text-[11px]">
                  No messages yet. Say hi!
                </div>
              )}
              {messages.map((msg, idx) => {
                const isMe = msg.metadata?.agentId === selected.agentId || msg.sender === 'agent';
                const prevMsg = messages[idx - 1];
                const isGrouped = prevMsg && prevMsg.sender === msg.sender &&
                  prevMsg.metadata?.agentId === msg.metadata?.agentId &&
                  (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 300000;
                const senderName = msg.senderName || msg.metadata?.agentName || (isMe ? 'You' : 'Agent');
                const senderColor = avatarColor(senderName);

                return (
                  <div key={msg.id} className={`flex gap-2 ${isGrouped ? 'mt-0.5 pl-8' : 'mt-3'}`}>
                    {!isGrouped && (
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${senderColor} border border-tx-bdefault/50 flex items-center justify-center text-[7px] font-bold text-tx-tp flex-shrink-0 mt-0.5`}>
                        {initials(senderName)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {!isGrouped && (
                        <div className="flex items-baseline gap-1.5 mb-0.5">
                          <span className={`text-[11px] font-semibold ${isMe ? 'text-tx-green' : 'text-tx-tp'}`}>{senderName}</span>
                          <span className="text-[9px] text-tx-tt">{timeShort(msg.createdAt)}</span>
                        </div>
                      )}
                      <div className="text-[12px] text-tx-tp/90 leading-relaxed break-words">
                        {(!msg.contentType || msg.contentType === 'text') && renderContent(msg.content)}
                        {msg.contentType === 'image' && msg.metadata?.fileUrl && (
                          <img src={msg.metadata.fileUrl} alt="" className="max-w-[200px] max-h-[140px] rounded-lg mt-1" />
                        )}
                        {msg.contentType === 'file' && msg.metadata?.fileUrl && (
                          <a href={msg.metadata.fileUrl} target="_blank" rel="noopener noreferrer" className="text-tx-green text-[11px] underline">{msg.metadata.fileName || 'File'}</a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {typing && (
                <div className="flex items-center gap-1.5 text-[10px] text-tx-ts mt-2">
                  <div className="flex gap-0.5">
                    <span className="typing-dot-1 w-1 h-1 rounded-full bg-tx-green" />
                    <span className="typing-dot-2 w-1 h-1 rounded-full bg-tx-green" />
                    <span className="typing-dot-3 w-1 h-1 rounded-full bg-tx-green" />
                  </div>
                  <span>{typingUser || 'Someone'} typing…</span>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-tx-bdefault/30 px-2 py-2">
              <div className="flex items-center gap-1.5">
                <input
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Message…"
                  className="flex-1 px-3 py-1.5 text-xs bg-tx-s3 border border-tx-bdefault/50 rounded-lg text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/40 transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={!draft.trim()}
                  className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-tx-tp disabled:opacity-30"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── New Chat Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { setShowNewChat(false); setNewChatTargets([]); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[360px] max-h-[70vh] bg-tx-s1 border border-tx-bdefault rounded-2xl shadow-2xl flex flex-col"
            >
              <div className="px-4 py-3 border-b border-tx-bdefault/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-tx-tp">New Chat</h3>
                <button onClick={() => { setShowNewChat(false); setNewChatTargets([]); }} className="text-tx-ts hover:text-tx-tp"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 max-h-64">
                {directory.map((a) => {
                  const isSelected = newChatTargets.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => setNewChatTargets((prev) => isSelected ? prev.filter((id) => id !== a.id) : [...prev, a.id])}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left ${
                        isSelected ? 'bg-tx-green/15 border border-tx-green/25' : 'bg-tx-s3 border border-tx-bdefault/50 hover:bg-tx-s4'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full ${PRESENCE_COLORS[presenceMap[a.id] || a.presence || 'offline'] || PRESENCE_COLORS.offline}`} />
                      <span className="text-xs text-tx-tp font-medium">{a.displayName}</span>
                      {isSelected && <span className="ml-auto text-tx-green text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-tx-bdefault/50">
                <button
                  onClick={createConversation}
                  disabled={newChatTargets.length === 0 || creating}
                  className="w-full py-2 rounded-xl gradient-primary text-tx-tp font-semibold text-xs shadow-lg disabled:opacity-30 flex items-center justify-center gap-1.5"
                >
                  {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                  {creating ? 'Creating…' : 'Start Chat'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
