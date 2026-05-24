'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox as InboxIcon,
  Phone,
  PhoneCall,
  MessageSquare,
  MessageCircle,
  Mail,
  Search,
  Send,
  Paperclip,
  X,
  Check,
  ArrowRightLeft,
  Tag,
  UserPlus,
  Circle,
  Loader2,
  Clock,
  CheckCheck,
  Image as ImageIcon,
  FileText,
  Download,
  XCircle,
  PhoneForwarded,
  GitMerge,
  AlertTriangle,
  ChevronDown,
  BookOpen,
  Bookmark,
  PenSquare,
} from 'lucide-react';
import api from '../../../lib/api';
import { useRouter } from 'next/navigation';
import { useToast } from '../../../components/Toast';
import ErrorBoundary from '../../../components/ErrorBoundary';
import { useSocket } from '../../../lib/socket';
import { analyzeSms } from '../../../lib/smsSegments';

/* ── Constants ────────────────────────────────────────────────────── */

const CHANNEL_TABS = [
  { id: 'all', label: 'All', Icon: InboxIcon },
  { id: 'sms', label: 'SMS', Icon: MessageSquare },
  { id: 'webchat', label: 'Chat', Icon: MessageCircle },
  /* Email channel removed — not wired to a real provider yet */
];

const CHANNEL_ICON = {
  voice: Phone,
  webchat: MessageCircle,
  internal: MessageSquare,
  sms: MessageSquare,
  email: Mail,
};

const CHANNEL_COLORS = {
  voice:    { bg: 'bg-tx-green/15',   border: 'border-tx-green/25',   text: 'text-tx-green',   dot: 'bg-tx-green' },
  webchat:  { bg: 'bg-blue-500/15',   border: 'border-blue-500/25',   text: 'text-blue-400',   dot: 'bg-blue-400' },
  sms:      { bg: 'bg-purple-500/15', border: 'border-purple-500/25', text: 'text-purple-400',  dot: 'bg-purple-400' },
  email:    { bg: 'bg-amber-500/15',   border: 'border-amber-500/25',  text: 'text-amber-400',   dot: 'bg-amber-400' },
  internal: { bg: 'bg-tx-citron/15',  border: 'border-tx-citron/25',  text: 'text-tx-citron',  dot: 'bg-tx-citron' },
};

const STATUS_CONFIG = {
  waiting: { label: 'Waiting', color: 'text-tx-citron', bg: 'bg-tx-citron/10', border: 'border-tx-citron/20' },
  active:  { label: 'Open',    color: 'text-tx-green',   bg: 'bg-tx-green/10',  border: 'border-tx-green/20' },
  closed:  { label: 'Closed',  color: 'text-tx-ts',      bg: 'bg-tx-s3',        border: 'border-tx-bdefault' },
};

const ACCEPTED_FILE_TYPES = 'image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/mpeg,audio/wav,audio/ogg';

const SMS_CHAR_LIMIT = 160;
const SMS_WARN_LIMIT = 140;

/* ── Helpers ──────────────────────────────────────────────────────── */

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeShort(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function slaWaitSeconds(startedAt) {
  if (!startedAt) return 0;
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
}

function fmtInboxDuration(seconds: number) {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSlaWait(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/* ── Detail sidebar info row ──────────────────────────────────────── */

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-tx-bdefault">
      <span className="text-[11px] text-tx-tt">{label}</span>
      <span className="text-[11px] text-tx-ts truncate max-w-[140px] text-right">{String(value)}</span>
    </div>
  );
}

/* ── Message content renderer ──────────────────────────────────── */

function MessageContent({ msg, onImageClick }) {
  const isFileMsg = (msg.contentType === 'image' || msg.contentType === 'file') && msg.metadata?.fileUrl;

  if (isFileMsg) {
    const isImg = msg.contentType === 'image' || (msg.metadata?.mimeType || '').startsWith('image/');
    if (isImg) {
      return (
        <div>
          <img
            src={msg.metadata.fileUrl}
            alt={msg.metadata.fileName || 'Image'}
            className="max-w-[280px] max-h-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-cover"
            onClick={() => onImageClick(msg.metadata.fileUrl)}
          />
          <p className="text-[11px] mt-1 opacity-70">{msg.metadata.fileName}</p>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 flex-shrink-0" />
        <a
          href={msg.metadata.fileUrl}
          download={msg.metadata.fileName}
          className="text-[12px] underline underline-offset-2 hover:opacity-80"
          target="_blank"
          rel="noopener noreferrer"
        >
          {msg.metadata.fileName || msg.content}
        </a>
        <span className="text-[10px] opacity-50">
          {msg.metadata.fileSize ? `${(msg.metadata.fileSize / 1024).toFixed(0)}KB` : ''}
        </span>
      </div>
    );
  }

  return <>{msg.content}</>;
}

/* ════════════════════════════════════════════════════════════════════
   INBOX PAGE
   ════════════════════════════════════════════════════════════════════ */

export default function InboxPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { on, emit } = useSocket();
  const [tab, setTab] = useState('all');
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState<any>(null);
  const [lightboxImage, setLightboxImage] = useState<any>(null);

  /* Active call durations — map of conversationId -> { startedAt, tick } */
  const [activeCallDurations, setActiveCallDurations] = useState<Record<string, number>>({});
  const activeCallStarts = useRef<Record<string, number>>({});

  /* Canned responses */
  const [showCanned, setShowCanned] = useState(false);
  const [cannedResponses, setCannedResponses] = useState<any[]>([]);
  const [cannedFilter, setCannedFilter] = useState('');

  /* Tags popover */
  const [showTagsPopover, setShowTagsPopover] = useState(false);
  const [tagInput, setTagInput] = useState('');

  /* Transcript modal */
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [transcriptEmail, setTranscriptEmail] = useState('');
  const [transcriptSending, setTranscriptSending] = useState(false);

  /* Merge modal */
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [mergeCandidates, setMergeCandidates] = useState<any[]>([]);

  /* Escalate confirm */
  const [showEscalateConfirm, setShowEscalateConfirm] = useState(false);
  const [escalating, setEscalating] = useState(false);

  /* Phone-intelligence (Telnyx Number Lookup) per active contact */
  const [contactInfo, setContactInfo] = useState<any>(null);

  /* SMS templates */
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [smsTemplates, setSmsTemplates] = useState<any[]>([]);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [activeTemplate, setActiveTemplate] = useState<any>(null);

  /* Toast */
  const [toast, setToast] = useState<string | null>(null);

  /* Read receipts tracking */
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());

  /* SLA tick */
  const [slaTick, setSlaTick] = useState(Date.now());

  /* New SMS compose modal */
  const [showNewSmsModal, setShowNewSmsModal] = useState(false);
  const [newSmsTo, setNewSmsTo] = useState('');
  const [newSmsFrom, setNewSmsFrom] = useState('');
  const [newSmsText, setNewSmsText] = useState('');
  const [newSmsName, setNewSmsName] = useState('');
  const [newSmsSending, setNewSmsSending] = useState(false);
  const [newSmsError, setNewSmsError] = useState<string | null>(null);
  const [smsNumbers, setSmsNumbers] = useState<any[]>([]);

  const scrollerRef = useRef(null);
  const typingTimer = useRef(null);
  const fileInputRef = useRef(null);
  const cannedRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);

  /* ── Counts per channel ─────────────────────────────────────── */
  const counts = useMemo(() => {
    const c = { all: conversations.length, webchat: 0, sms: 0, email: 0 };
    for (const conv of conversations) {
      if (c[conv.channel] !== undefined) c[conv.channel]++;
    }
    return c;
  }, [conversations]);

  /* ── Data loading ───────────────────────────────────────────── */
  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await api.get('/chat/conversations');
      setConversations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load conversations', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { refreshList(); }, [refreshList]);

  /* SLA tick every 5s */
  useEffect(() => {
    const iv = setInterval(() => setSlaTick(Date.now()), 5000);
    return () => clearInterval(iv);
  }, []);

  /* Click outside to close popovers */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cannedRef.current && !cannedRef.current.contains(e.target as Node)) setShowCanned(false);
      if (tagsRef.current && !tagsRef.current.contains(e.target as Node)) setShowTagsPopover(false);
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) setShowTemplatePicker(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ── Socket events ──────────────────────────────────────────── */
  useEffect(() => {
    const offNew = on('chat:new', (c) => {
      setConversations((prev) => (prev.some((p) => p.id === c.id) ? prev : [c, ...prev]));
    });
    const offAccepted = on('chat:accepted', ({ conversationId, agentId }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, agentId, status: 'active' } : c)),
      );
    });
    const offClosed = on('chat:closed', ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, status: 'closed' } : c)),
      );
    });
    const offMsg = on('chat:message', (msg) => {
      const convId = msg.conversationId;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, lastMessageAt: msg.createdAt || new Date().toISOString(), messageCount: (c.messageCount || 0) + 1, _lastPreview: msg.contentType === 'text' ? msg.content : `📎 ${msg.metadata?.fileName || 'File'}` }
            : c,
        ),
      );
      setMessages((prev) => {
        if (!selectedId || selectedId !== convId) return prev;
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    const offRead = on('chat:read', ({ conversationId, messageIds }) => {
      if (conversationId !== selectedId) return;
      setReadMessageIds((prev) => {
        const next = new Set(prev);
        (messageIds || []).forEach((id: string) => next.add(id));
        return next;
      });
    });
    // Live SMS delivery-status updates (queued → sent → delivered → failed)
    const offStatus = on('chat:message:status', (payload: any) => {
      if (!payload?.id) return;
      setMessages((prev) => prev.map((m) =>
        m.id === payload.id
          ? { ...m, status: payload.status, metadata: { ...(m.metadata || {}), deliveryErrors: payload.deliveryErrors || m.metadata?.deliveryErrors } }
          : m,
      ));
    });
    return () => { offNew(); offAccepted(); offClosed(); offMsg(); offRead(); offStatus(); };
  }, [on, selectedId]);

  /* ── Active call duration tracking via socket ──────────────── */
  useEffect(() => {
    const offCallRinging = on('call:ringing', (data: any) => {
      const convId = data.conversationId;
      if (convId) {
        activeCallStarts.current[convId] = Date.now();
        setActiveCallDurations((prev) => ({ ...prev, [convId]: 0 }));
      }
    });
    const offCallAnswered = on('call:answered', (data: any) => {
      const convId = data.conversationId;
      if (convId && !activeCallStarts.current[convId]) {
        activeCallStarts.current[convId] = Date.now();
        setActiveCallDurations((prev) => ({ ...prev, [convId]: 0 }));
      }
    });
    const offCallEnded = on('call:ended', (data: any) => {
      const convId = data?.conversationId;
      if (convId) {
        delete activeCallStarts.current[convId];
        setActiveCallDurations((prev) => {
          const next = { ...prev };
          delete next[convId];
          return next;
        });
      }
    });
    return () => { offCallRinging(); offCallAnswered(); offCallEnded(); };
  }, [on]);

  /* Tick active call durations every second */
  useEffect(() => {
    const ids = Object.keys(activeCallStarts.current);
    if (ids.length === 0) return;
    const iv = setInterval(() => {
      setActiveCallDurations(() => {
        const next: Record<string, number> = {};
        for (const [convId, start] of Object.entries(activeCallStarts.current)) {
          next[convId] = Math.floor((Date.now() - start) / 1000);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [Object.keys(activeCallStarts.current).length]);

  useEffect(() => {
    const off = on('chat:typing', ({ conversationId, sender, isTyping }) => {
      if (conversationId !== selectedId || sender === 'agent') return;
      setTyping(!!isTyping);
      clearTimeout(typingTimer.current);
      if (isTyping) typingTimer.current = setTimeout(() => setTyping(false), 3500);
    });
    return () => off();
  }, [on, selectedId]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); setContactInfo(null); return; }
    setLoadingMsgs(true);
    setContactInfo(null);
    emit('chat:join', { conversationId: selectedId });
    api.get(`/chat/conversations/${selectedId}`)
      .then((data) => {
        setMessages(data.messages || []);
        // Fetch contact for Phone Intelligence (Telnyx Number Lookup cache)
        const phone = data.visitorPhone;
        if (phone) {
          api.get(`/contacts/lookup/${encodeURIComponent(phone)}`)
            .then((c) => setContactInfo(c))
            .catch(() => setContactInfo(null));
        }
      })
      .catch((err) => console.error('Failed to load messages', err))
      .finally(() => setLoadingMsgs(false));
    return () => emit('chat:leave', { conversationId: selectedId });
  }, [selectedId, emit]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  /* ── Filtered conversations ─────────────────────────────────── */
  const filtered = useMemo(
    () =>
      conversations.filter((c) => {
        if (tab !== 'all' && c.channel !== tab) return false;
        if (statusFilter === 'open' && c.status === 'closed') return false;
        if (statusFilter === 'closed' && c.status !== 'closed') return false;
        if (query) {
          const q = query.toLowerCase();
          const hay = `${c.visitorName || ''} ${c.subject || ''} ${c.queueName || ''} ${c.visitorEmail || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [conversations, tab, query, statusFilter],
  );

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );

  /* ── Actions ────────────────────────────────────────────────── */

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function fetchCannedResponses() {
    try {
      const data = await api.get('/chat/canned-responses');
      setCannedResponses(Array.isArray(data) ? data : []);
    } catch {
      setCannedResponses([]);
    }
  }

  async function fetchSmsTemplates() {
    try {
      const data = await api.get('/sms-templates');
      setSmsTemplates(Array.isArray(data) ? data : []);
    } catch {
      setSmsTemplates([]);
    }
  }

  async function fetchSmsNumbers() {
    try {
      const data = await api.get('/sms/numbers');
      setSmsNumbers(Array.isArray(data) ? data : []);
      // Auto-select first number if available
      if (Array.isArray(data) && data.length > 0 && !newSmsFrom) {
        setNewSmsFrom(data[0].phoneNumber);
      }
    } catch {
      setSmsNumbers([]);
    }
  }

  async function openNewSmsModal() {
    setShowNewSmsModal(true);
    setNewSmsTo('');
    setNewSmsText('');
    setNewSmsName('');
    setNewSmsError(null);
    fetchSmsNumbers();
  }

  async function sendNewSms() {
    if (!newSmsTo.trim() || !newSmsText.trim() || !newSmsFrom) return;
    setNewSmsSending(true);
    setNewSmsError(null);
    try {
      const newConversation = await api.post('/sms/new', {
        to: newSmsTo.trim(),
        from: newSmsFrom,
        text: newSmsText.trim(),
        visitorName: newSmsName.trim() || undefined,
      });
      // Prepend to conversations list
      setConversations((prev) => [newConversation, ...prev]);
      // Select the new conversation
      setSelectedId(newConversation.id);
      // Close modal
      setShowNewSmsModal(false);
      showToast('📱 SMS sent!');
    } catch (err: any) {
      setNewSmsError(err.message || 'Failed to send SMS');
    } finally {
      setNewSmsSending(false);
    }
  }

  async function addTag(tag: string) {
    if (!selectedId || !tag.trim()) return;
    try {
      await api.post(`/chat/${selectedId}/tags`, { tags: [tag.trim()] });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, metadata: { ...c.metadata, tags: [...(c.metadata?.tags || []), tag.trim()] } }
            : c,
        ),
      );
      setTagInput('');
    } catch (err: any) {
      console.error('Failed to add tag', err);
    }
  }

  async function removeTag(tag: string) {
    if (!selectedId) return;
    try {
      await api.delete(`/chat/${selectedId}/tags/${encodeURIComponent(tag)}`);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, metadata: { ...c.metadata, tags: (c.metadata?.tags || []).filter((t: string) => t !== tag) } }
            : c,
        ),
      );
    } catch (err: any) {
      console.error('Failed to remove tag', err);
    }
  }

  async function escalateToCall() {
    if (!selectedId) return;
    setEscalating(true);
    try {
      await api.post(`/chat/${selectedId}/escalate-to-call`);
      showToast('📞 Call escalated successfully');
    } catch (err: any) {
      showToast('❌ Escalation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setEscalating(false);
      setShowEscalateConfirm(false);
    }
  }

  async function sendTranscript() {
    if (!selectedId || !transcriptEmail.trim()) return;
    setTranscriptSending(true);
    try {
      await api.post(`/chat/${selectedId}/transcript`, { email: transcriptEmail.trim() });
      showToast('📧 Transcript sent!');
      setShowTranscriptModal(false);
      setTranscriptEmail('');
    } catch (err: any) {
      showToast('❌ Failed to send transcript: ' + (err.message || 'Unknown error'));
    } finally {
      setTranscriptSending(false);
    }
  }

  async function openMergeModal() {
    if (!selected) return;
    const matches = conversations.filter(
      (c) =>
        c.id !== selectedId &&
        c.status !== 'closed' &&
        (
          (c.visitorEmail && c.visitorEmail === selected.visitorEmail) ||
          (c.visitorName && c.visitorName === selected.visitorName && selected.visitorName !== 'Unknown')
        ),
    );
    setMergeCandidates(matches);
    setMergeTarget(null);
    setShowMergeModal(true);
  }

  async function mergeConversation() {
    if (!selectedId || !mergeTarget) return;
    try {
      await api.post(`/chat/${selectedId}/merge`, { targetConversationId: mergeTarget });
      showToast('🔗 Conversations merged');
      setShowMergeModal(false);
      refreshList();
    } catch (err: any) {
      showToast('❌ Merge failed: ' + (err.message || 'Unknown error'));
    }
  }

  function insertTemplate(tpl: any) {
    const body = tpl.body || tpl.content || '';
    // Check for {{variable}} placeholders
    const varMatches = body.match(/\{\{(\w+)}}/g);
    if (varMatches && varMatches.length > 0) {
      setActiveTemplate({ ...tpl, _body: body });
      const vars: Record<string, string> = {};
      varMatches.forEach((m: string) => {
        const name = m.replace(/\{\{|}}/g, '');
        vars[name] = '';
      });
      setTemplateVariables(vars);
    } else {
      setDraft(body);
      onDraftChange(body);
      setShowTemplatePicker(false);
    }
  }

  function confirmTemplateInsert() {
    if (!activeTemplate) return;
    let body = activeTemplate._body;
    Object.entries(templateVariables).forEach(([key, val]) => {
      body = body.replace(new RegExp(`\{\{${key}}}`, 'g'), val || `{{${key}}}`);
    });
    setDraft(body);
    onDraftChange(body);
    setActiveTemplate(null);
    setTemplateVariables({});
    setShowTemplatePicker(false);
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text && !attachedFile) return;
    if (!selectedId) return;

    // If there's an attached file, upload it
    if (attachedFile) {
      setUploadProgress(0);
      try {
        await api.upload(`/chat/${selectedId}/upload`, attachedFile, (pct) => setUploadProgress(pct));
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
      emit('chat:typing', { conversationId: selectedId, sender: 'agent', isTyping: false });
      try {
        await api.post(`/chat/${selectedId}/agent-message`, { content: text });
      } catch (err: any) {
        console.error('Failed to send', err);
        setDraft(text);
      }
    } else {
      setDraft('');
      emit('chat:typing', { conversationId: selectedId, sender: 'agent', isTyping: false });
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
    if (selectedId) emit('chat:typing', { conversationId: selectedId, sender: 'agent', isTyping: !!v });
  }

  async function acceptChat() {
    if (!selectedId) return;
    try { await api.post(`/chat/${selectedId}/accept`); refreshList(); } catch (err: any) { console.error(err); }
  }

  async function closeChat() {
    if (!selectedId) return;
    if (typeof window !== 'undefined' && !window.confirm('Close this conversation?')) return;
    try { await api.post(`/chat/${selectedId}/close`); refreshList(); } catch (err: any) { console.error(err); }
  }

  async function transferChat() {
    if (!selectedId) return;
    const target = typeof window !== 'undefined' ? window.prompt('Transfer to agent ID:') : null;
    if (!target) return;
    try { await api.post(`/chat/${selectedId}/transfer`, { targetAgentId: target.trim() }); refreshList(); } catch (err: any) { alert(err.message || 'Transfer failed'); }
  }

  async function smsToCall() {
    if (!selected?.visitorPhone) return;
    try {
      await api.post('/voice/dial', { to: selected.visitorPhone });
      addToast(`Calling ${selected.visitorPhone}...`, 'info');
      router.push('/phone');
    } catch (err: any) {
      addToast(err?.data?.error || 'Failed to place call', 'error');
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */

  return (
    <div className="h-full flex flex-col">
      {/* ── Page header ────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-4">
        <div className="flex items-center gap-3.5 mb-1">
          <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-tx-green/20 flex-shrink-0">
            <InboxIcon className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-tx-tp tracking-tight">Unified Inbox</h1>
            <p className="text-[11px] text-tx-ts mt-0.5">All your conversations across every channel</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={openNewSmsModal}
              className="px-3 py-1.5 rounded-lg gradient-primary text-white text-[11px] font-medium shadow-md shadow-tx-green/20 flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <PenSquare className="w-3.5 h-3.5" />
              New SMS
            </button>
            <div className="w-px h-5 bg-tx-bdefault mx-1" />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-tx-ts mr-1">Status:</span>
            {['all', 'open', 'closed'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  statusFilter === s
                    ? 'gradient-primary text-white shadow-md shadow-tx-green/20'
                    : 'bg-tx-s3 border border-tx-bdefault text-tx-ts hover:text-tx-tp hover:border-tx-bdefault'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ErrorBoundary name="Inbox">
        <div className="flex-1 flex min-h-0 px-6 pb-6 gap-3">

          {/* ════════════════════════════════════════════════════════
              LEFT PANEL — Conversation list
              ════════════════════════════════════════════════════════ */}
          <aside className="w-[340px] flex-shrink-0 bg-tx-s2 border border-tx-bsubtle rounded-xl overflow-hidden flex flex-col">
            {/* Tab bar */}
            <div className="px-3 pt-3 pb-2 border-b border-tx-bdefault">
              <div className="flex gap-1 p-1 rounded-xl bg-tx-s3">
                {CHANNEL_TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                      tab === id ? 'text-tx-tp' : 'text-tx-ts hover:text-tx-tp'
                    }`}
                  >
                      {tab === id && (
                        <motion.div
                          layoutId="inbox-tab-pill"
                          className="absolute inset-0 rounded-lg gradient-primary opacity-80"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Icon className="relative w-3.5 h-3.5" strokeWidth={2} />
                      <span className="relative">{label}</span>
                      {counts[id] > 0 && (
                        <span className={`relative text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          tab === id ? 'bg-tx-tp/20 text-tx-tp' : 'bg-tx-s4 text-tx-ts'
                        }`}>
                          {counts[id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

              {/* Search */}
              <div className="mt-2 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tx-ts" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search conversations…"
                  className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-colors"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tx-ts hover:text-tx-tp">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-auto">
              {loadingList && (
                <div className="flex items-center justify-center py-16 text-tx-ts">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
              {!loadingList && filtered.length === 0 && (
                <div className="px-4 py-16 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-tx-s3 border border-tx-bdefault flex items-center justify-center mb-3">
                    <InboxIcon className="w-5 h-5 text-tx-tt" strokeWidth={1.6} />
                  </div>
                  <p className="text-[13px] font-semibold text-tx-ts mb-1">Nothing here</p>
                  <p className="text-[11px] text-tx-tt max-w-[160px] leading-relaxed">Try switching channels or clearing the search filter</p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {filtered.map((c) => {
                  const Icon = CHANNEL_ICON[c.channel] || MessageCircle;
                  const isSelected = selectedId === c.id;
                  const chColor = CHANNEL_COLORS[c.channel] || CHANNEL_COLORS.webchat;
                  const stConfig = STATUS_CONFIG[c.status] || STATUS_CONFIG.waiting;
                  const isUnread = c.status === 'waiting' || (!c.agentId && c.status !== 'closed');

                  return (
                    <motion.button
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left px-3 py-3 border-b border-tx-bdefault transition-all duration-150 ${
                        isSelected
                          ? 'bg-tx-green/[0.08] border-l-[3px] border-l-tx-green'
                          : c.channel === 'voice' && c.status === 'active'
                            ? 'bg-tx-green/[0.03] border-l-[3px] border-l-tx-green/50 hover:bg-tx-green/[0.06]'
                            : 'hover:bg-tx-s3 border-l-[3px] border-l-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar with channel icon */}
                        <div className="relative flex-shrink-0">
                          <div className={`w-10 h-10 rounded-xl ${chColor.bg} border ${chColor.border} flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 ${chColor.text}`} strokeWidth={2} />
                          </div>
                          {/* Status dot */}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-tx-s2 ${
                            c.status === 'active' ? 'bg-tx-green shadow-[0_0_6px_rgba(52,211,153,0.6)]' :
                            c.status === 'waiting' ? 'bg-tx-citron shadow-[0_0_6px_rgba(251,191,36,0.6)]' :
                            'bg-tx-s3'
                          }`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[13px] truncate ${isUnread ? 'font-semibold text-tx-tp' : 'font-medium text-tx-tp/90'}`}>
                                {c.visitorName || 'Unknown'}
                              </span>
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-tx-green shadow-[0_0_6px_rgba(99,102,241,0.5)] flex-shrink-0" />
                              )}
                            </div>
                            <span className="text-[10px] text-tx-tt flex-shrink-0 tabular-nums">
                              {timeAgo(c.lastMessageAt || c.startedAt)}
                            </span>
                          </div>

                          {/* Preview */}
                          <p className="text-[11px] text-tx-ts truncate mt-0.5 leading-relaxed">
                            {c._lastPreview || c.subject || (c.channel === 'voice' ? 'Voice call' : c.channel === 'email' ? 'Email conversation' : 'New conversation')}
                          </p>

                          {/* Badges */}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${chColor.bg} ${chColor.text} border ${chColor.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${chColor.dot}`} />
                              {c.channel}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${stConfig.bg} ${stConfig.color} border ${stConfig.border}`}>
                              {stConfig.label}
                            </span>
                            {/* Active call live duration badge */}
                            {activeCallDurations[c.id] != null && activeCallDurations[c.id] >= 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tabular-nums bg-tx-green/15 text-tx-green border border-tx-green/25">
                                <span className="w-1.5 h-1.5 rounded-full bg-tx-green animate-pulse" />
                                {fmtInboxDuration(activeCallDurations[c.id])}
                              </span>
                            )}
                            {c.queueName && (
                              <span className="text-[9px] text-tx-tt truncate">· {c.queueName}</span>
                            )}
                            {c.status === 'waiting' && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold tabular-nums ${
                                slaWaitSeconds(c.startedAt) > 120 ? 'text-tx-red bg-tx-red/10 border border-tx-red/20' : slaWaitSeconds(c.startedAt) > 60 ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 'text-tx-tt bg-tx-s3 border border-tx-bdefault'
                              }`}>
                                {slaWaitSeconds(c.startedAt) > 120 && <AlertTriangle className="w-2.5 h-2.5" />}
                                <Clock className="w-2.5 h-2.5" />
                                {formatSlaWait(slaWaitSeconds(c.startedAt))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </aside>

          {/* ════════════════════════════════════════════════════════
              RIGHT PANEL — Conversation detail
              ════════════════════════════════════════════════════════ */}
          <section className="flex-1 bg-tx-s2 border border-tx-bsubtle rounded-xl overflow-hidden flex flex-col min-w-0">
            {!selected ? (
              /* Empty state — premium */
              <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-tx-s3 border border-tx-bdefault flex items-center justify-center">
                    <MessageCircle className="w-9 h-9 text-tx-tt" strokeWidth={1.3} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-tx-green/15 border border-tx-green/30 flex items-center justify-center">
                    <span className="text-tx-green text-[11px] font-bold">↗</span>
                  </div>
                </div>
                <p className="text-[15px] font-semibold text-tx-tp mb-1.5">Pick a conversation</p>
                <p className="text-[12.5px] text-tx-tt leading-relaxed max-w-[220px]">
                  Select any conversation from the left panel to view messages and reply.
                </p>
                <div className="mt-6 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bsubtle">
                  <span className="text-[10px] font-medium text-tx-tt">Tip:</span>
                  <span className="text-[10px] text-tx-tt">Filter by channel using the tabs above</span>
                </div>
              </div>
            ) : (
              <>

                {/* ── Conversation header ──────────────────────────── */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-tx-bdefault bg-gradient-to-r from-tx-green/[0.03] to-transparent">
                  {(() => {
                    const Icon = CHANNEL_ICON[selected.channel] || MessageCircle;
                    const chColor = CHANNEL_COLORS[selected.channel] || CHANNEL_COLORS.webchat;
                    const stConfig = STATUS_CONFIG[selected.status] || STATUS_CONFIG.waiting;
                    return (
                      <div className={`w-10 h-10 rounded-xl ${chColor.bg} border ${chColor.border} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${chColor.text}`} strokeWidth={2} />
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-tx-tp truncate">
                        {selected.visitorName || 'Unknown'}
                      </span>
                      {(() => {
                        const chColor = CHANNEL_COLORS[selected.channel] || CHANNEL_COLORS.webchat;
                        const stConfig = STATUS_CONFIG[selected.status] || STATUS_CONFIG.waiting;
                        return (
                          <>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${chColor.bg} ${chColor.text} border ${chColor.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${chColor.dot}`} />
                              {selected.channel}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${stConfig.bg} ${stConfig.color} border ${stConfig.border}`}>
                              {stConfig.label}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                    <div className="text-[11px] text-tx-ts mt-0.5 flex items-center gap-2">
                      {selected.visitorEmail && <span>{selected.visitorEmail}</span>}
                      {selected.queueName && <span>· Queue: {selected.queueName}</span>}
                      {selected.subject && <span>· {selected.subject}</span>}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {(() => {
                      const isClosed = selected.status === 'closed';
                      return (
                        <>
                          {!isClosed && (
                            <>
                              {selected.channel === 'sms' && selected.visitorPhone && (
                                <button
                                  onClick={smsToCall}
                                  className="px-3 py-1.5 rounded-lg bg-tx-green/10 border border-tx-green/20 text-tx-green hover:bg-tx-green/20 text-xs font-medium transition-colors flex items-center gap-1.5"
                                  title="Call this contact"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" /> Call
                                </button>
                              )}
                              <button
                                onClick={transferChat}
                                className="px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts hover:text-tx-tp hover:border-tx-bdefault text-xs font-medium transition-colors flex items-center gap-1.5"
                                title="Assign / Transfer"
                              >
                                <UserPlus className="w-3.5 h-3.5" /> Assign
                              </button>
                              <button
                                onClick={closeChat}
                                className="px-3 py-1.5 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red hover:bg-tx-red/20 text-xs font-medium transition-colors flex items-center gap-1.5"
                              >
                                <X className="w-3.5 h-3.5" /> Close
                              </button>
                              <div ref={tagsRef} className="relative">
                                <button
                                  onClick={() => setShowTagsPopover(!showTagsPopover)}
                                  className="p-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts hover:text-tx-tp transition-colors"
                                  title="Add tag"
                                >
                                  <Tag className="w-3.5 h-3.5" />
                                </button>
                                {showTagsPopover && (
                                  <div className="absolute right-0 top-full mt-1 w-56 rounded-xl bg-tx-s2 border border-tx-bdefault shadow-xl z-50 p-3 space-y-2">
                                    <div className="text-[10px] uppercase tracking-wider font-semibold text-tx-tt">Tags</div>
                                    <div className="flex flex-wrap gap-1">
                                      {(selected.metadata?.tags || []).map((tag: string) => (
                                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tx-s3 border border-tx-bdefault text-[10px] text-tx-ts">
                                          {tag}
                                          <button onClick={() => removeTag(tag)} className="text-tx-tt hover:text-tx-red">
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        </span>
                                      ))}
                                      {(!selected.metadata?.tags || selected.metadata.tags.length === 0) && (
                                        <span className="text-[10px] text-tx-tt">No tags</span>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      <input
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                                        placeholder="Add tag…"
                                        className="flex-1 px-2 py-1 text-[11px] rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
                                      />
                                      <button
                                        onClick={() => addTag(tagInput)}
                                        disabled={!tagInput.trim()}
                                        className="px-2 py-1 rounded-lg gradient-primary text-white text-[10px] font-medium disabled:opacity-30"
                                      >
                                        Add
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          {isClosed && (
                            <span className="text-[11px] text-tx-ts italic px-2">Closed</span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* ── Messages ─────────────────────────────────────── */}
                <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
                  {loadingMsgs && (
                    <div className="flex items-center justify-center py-16 text-tx-ts">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                      const isAgent = msg.sender === 'agent';
                      const isSystem = msg.sender === 'system';
                      const prevMsg = messages[idx - 1];
                      const isGrouped = prevMsg && prevMsg.sender === msg.sender &&
                        (new Date(msg.createdAt as string).getTime() - new Date(prevMsg.createdAt as string).getTime()) < 60000;

                      if (isSystem) {
                        return (
                          <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-2">
                            <span className="px-3 py-1 rounded-full bg-tx-s3 border border-tx-bdefault text-[10px] uppercase tracking-wider text-tx-tt">
                              {msg.content}
                            </span>
                          </motion.div>
                        );
                      }

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          className={`flex ${isAgent ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
                        >
                          <div className={`max-w-[72%] ${isAgent ? 'items-end' : 'items-start'} flex flex-col`}>
                            {!isGrouped && (
                              <div className="flex items-center gap-2 mb-1 px-1">
                                <span className="text-[10px] font-semibold text-tx-ts">
                                  {msg.senderName || (isAgent ? 'Agent' : selected.visitorName || 'Visitor')}
                                </span>
                                <span className="text-[9px] text-tx-tt">{timeShort(msg.createdAt)}</span>
                              </div>
                            )}
                            <div
                              className={`px-4 py-2.5 text-[13px] leading-relaxed ${
                                isAgent
                                  ? 'gradient-primary text-white rounded-2xl rounded-br-md shadow-md shadow-tx-green/15'
                                  : 'bg-tx-s3 border border-tx-bdefault text-tx-tp rounded-2xl rounded-bl-md'
                              }`}
                            >
                              <MessageContent msg={msg} onImageClick={setLightboxImage} />
                            </div>
                            {/* Read receipt + SMS delivery status on agent messages */}
                            {isAgent && (
                              <div className="flex items-center gap-1 mt-0.5 px-1">
                                {(() => {
                                  const s = msg.status;
                                  const errs: any[] = msg.metadata?.deliveryErrors || [];
                                  if (s === 'failed' || errs.length > 0) {
                                    const code = errs[0]?.code;
                                    const detail = errs[0]?.detail || errs[0]?.title || 'Delivery failed';
                                    return (
                                      <span
                                        title={code ? `Telnyx ${code}: ${detail}` : detail}
                                        className="inline-flex items-center gap-0.5 text-tx-red"
                                      >
                                        <AlertTriangle className="w-3 h-3" />
                                        <span className="text-[9px] font-medium">{code || 'failed'}</span>
                                      </span>
                                    );
                                  }
                                  if (s === 'delivered') {
                                    return (
                                      <span title="Delivered" className="inline-flex items-center gap-0.5">
                                        <CheckCheck className="w-3 h-3 text-tx-green" />
                                      </span>
                                    );
                                  }
                                  if (s === 'queued' || s === 'queueing') {
                                    return (
                                      <span title="Queued at Telnyx" className="inline-flex items-center gap-0.5 text-tx-tt">
                                        <Clock className="w-3 h-3" />
                                      </span>
                                    );
                                  }
                                  if (s === 'sent' || s === 'sending') {
                                    return (
                                      <span title="Sent (awaiting delivery receipt)" className="inline-flex items-center gap-0.5">
                                        <Check className="w-3 h-3 text-tx-tt" />
                                      </span>
                                    );
                                  }
                                  // Fallback: visitor-read receipt for web chat (no Telnyx status)
                                  return readMessageIds.has(msg.id) || msg.readAt ? (
                                    <CheckCheck className="w-3 h-3 text-tx-green/60" />
                                  ) : (
                                    <Check className="w-3 h-3 text-tx-tt" />
                                  );
                                })()}
                              </div>
                            )}
                            {isGrouped && (!messages[idx + 1] || messages[idx + 1].sender !== msg.sender) && (
                              <span className="text-[9px] text-tx-tt mt-0.5 px-1">{timeShort(msg.createdAt)}</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Typing indicator */}
                  {typing && (
                    <div className="flex items-center gap-2 text-xs text-tx-ts mt-3">
                      <div className="flex gap-1">
                        <span className="typing-dot-1 w-1.5 h-1.5 rounded-full bg-tx-green" />
                        <span className="typing-dot-2 w-1.5 h-1.5 rounded-full bg-tx-green" />
                        <span className="typing-dot-3 w-1.5 h-1.5 rounded-full bg-tx-green" />
                      </div>
                      <span>{selected.visitorName || 'Visitor'} is typing…</span>
                    </div>
                  )}
                </div>

                {/* ── Composer ─────────────────────────────────────── */}
                {selected.status !== 'closed' ? (
                  <div className="border-t border-tx-bdefault px-4 py-3">
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

                    {/* Template variable fill modal */}
                    {activeTemplate && (
                      <div className="mb-2 p-3 rounded-xl bg-tx-s3 border border-tx-green/20 space-y-2">
                        <div className="text-[11px] font-semibold text-tx-tp">Fill template variables</div>
                        {Object.keys(templateVariables).map((varName) => (
                          <div key={varName}>
                            <label className="text-[10px] text-tx-tt">{varName}</label>
                            <input
                              value={templateVariables[varName]}
                              onChange={(e) => setTemplateVariables((prev) => ({ ...prev, [varName]: e.target.value }))}
                              placeholder={`{{${varName}}}`}
                              className="w-full px-2 py-1 text-[11px] rounded-lg bg-tx-s4 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
                            />
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <button
                            onClick={confirmTemplateInsert}
                            className="px-3 py-1 rounded-lg gradient-primary text-white text-[10px] font-medium"
                          >Insert</button>
                          <button
                            onClick={() => { setActiveTemplate(null); setTemplateVariables({}); }}
                            className="px-3 py-1 rounded-lg bg-tx-s4 border border-tx-bdefault text-tx-ts text-[10px]"
                          >Cancel</button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_FILE_TYPES}
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-lg text-tx-tt hover:text-tx-ts hover:bg-tx-s4 transition-colors"
                        title="Attach file"
                        disabled={uploadProgress !== null}
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <input
                        value={draft}
                        onChange={(e) => {
                          onDraftChange(e.target.value);
                          // "/" shortcut for canned responses
                          if (e.target.value === '/') {
                            setShowCanned(true);
                            setCannedFilter('');
                            fetchCannedResponses();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                        }}
                        placeholder="Type your message… (/ for quick replies)"
                        className="flex-1 px-3 py-2 text-sm rounded-xl bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-colors"
                      />
                      <div className="flex items-center gap-1">
                        {/* Canned responses */}
                        <div ref={cannedRef} className="relative">
                          <button
                            onClick={() => {
                              setShowCanned(!showCanned);
                              if (!showCanned) fetchCannedResponses();
                            }}
                            className="p-1.5 rounded-lg text-tx-tt hover:text-tx-ts hover:bg-tx-s4 transition-colors"
                            title="Quick reply template"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          {showCanned && (
                            <div className="absolute bottom-full right-0 mb-1 w-72 max-h-64 rounded-xl bg-tx-s2 border border-tx-bdefault shadow-xl z-50 overflow-hidden flex flex-col">
                              <div className="p-2 border-b border-tx-bdefault">
                                <input
                                  value={cannedFilter}
                                  onChange={(e) => setCannedFilter(e.target.value)}
                                  placeholder="Search responses…"
                                  className="w-full px-2 py-1 text-[11px] rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
                                  autoFocus
                                />
                              </div>
                              <div className="overflow-auto p-1">
                                {cannedResponses
                                  .filter((r) => !cannedFilter || (r.title || r.name || '').toLowerCase().includes(cannedFilter.toLowerCase()) || (r.body || r.content || '').toLowerCase().includes(cannedFilter.toLowerCase()))
                                  .map((r, i) => (
                                    <button
                                      key={i}
                                      onClick={() => {
                                        setDraft(r.body || r.content || '');
                                        onDraftChange(r.body || r.content || '');
                                        setShowCanned(false);
                                      }}
                                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-tx-s3 transition-colors"
                                    >
                                      <div className="text-[11px] font-medium text-tx-tp">{r.title || r.name || 'Untitled'}</div>
                                      <div className="text-[10px] text-tx-tt line-clamp-1">{r.body || r.content || ''}</div>
                                    </button>
                                  ))}
                                {cannedResponses.length === 0 && (
                                  <div className="px-3 py-3 text-[10px] text-tx-tt text-center">No canned responses available</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* SMS template picker */}
                        {selected.channel === 'sms' && (
                          <div ref={templateRef} className="relative">
                            <button
                              onClick={() => {
                                setShowTemplatePicker(!showTemplatePicker);
                                if (!showTemplatePicker) fetchSmsTemplates();
                              }}
                              className="p-1.5 rounded-lg text-tx-tt hover:text-tx-ts hover:bg-tx-s4 transition-colors"
                              title="SMS template"
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>
                            {showTemplatePicker && (
                              <div className="absolute bottom-full right-0 mb-1 w-72 max-h-64 rounded-xl bg-tx-s2 border border-tx-bdefault shadow-xl z-50 overflow-hidden flex flex-col">
                                <div className="p-2 border-b border-tx-bdefault">
                                  <span className="text-[10px] font-semibold text-tx-tt">SMS Templates</span>
                                </div>
                                <div className="overflow-auto p-1">
                                  {smsTemplates.map((tpl, i) => (
                                    <button
                                      key={i}
                                      onClick={() => insertTemplate(tpl)}
                                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-tx-s3 transition-colors"
                                    >
                                      <div className="text-[11px] font-medium text-tx-tp">{tpl.name || tpl.title || 'Template'}</div>
                                      <div className="text-[10px] text-tx-tt line-clamp-1">{tpl.body || tpl.content || ''}</div>
                                    </button>
                                  ))}
                                  {smsTemplates.length === 0 && (
                                    <div className="px-3 py-3 text-[10px] text-tx-tt text-center">No templates available</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* SMS badge & segment / encoding counter */}
                        {selected.channel === 'sms' && (() => {
                          const info = analyzeSms(draft);
                          const warn = info.segmentCount > 1 || info.encoding === 'UCS-2';
                          const danger = info.segmentCount > 3;
                          return (
                            <>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-400 text-[10px] font-semibold">
                                📱 SMS
                              </span>
                              <span
                                title={`${info.encoding} · ${info.unitCount} unit${info.unitCount === 1 ? '' : 's'} · ${info.segmentCount} segment${info.segmentCount === 1 ? '' : 's'} · ${info.remainingInSegment} left in this segment${info.emojiOrUnicode ? ' (emoji/unicode forces UCS-2 → 70 chars/segment)' : ''}`}
                                className={`text-[10px] tabular-nums cursor-help ${
                                  danger ? 'text-tx-red font-medium' : warn ? 'text-amber-400' : 'text-tx-tt'
                                }`}
                              >
                                {info.charCount} · {info.encoding === 'UCS-2' ? '🔤U' : 'G7'} · {info.segmentCount}×
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={sendMessage}
                        disabled={!draft.trim() && !attachedFile}
                        className="px-4 py-1.5 rounded-xl gradient-primary text-white text-xs font-medium shadow-md shadow-tx-green/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> Send
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-tx-bdefault px-5 py-4 text-center">
                    <span className="text-xs text-tx-ts">This conversation is closed</span>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ════════════════════════════════════════════════════════
              DETAIL SIDEBAR — Contact info & metadata
              ════════════════════════════════════════════════════════ */}
          {selected && (
            <aside className="hidden xl:flex flex-col w-[280px] flex-shrink-0 bg-tx-s2 border border-tx-bsubtle rounded-xl overflow-hidden">
              {/* Contact card */}
              <div className="px-5 pt-5 pb-4 border-b border-tx-bdefault">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl gradient-primary text-white shadow-md shadow-tx-green/20">
                    {(selected.visitorName || 'V').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-tx-tp truncate">{selected.visitorName || 'Visitor'}</div>
                    <div className="text-[11px] text-tx-ts truncate">{selected.visitorEmail || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="px-5 py-3 flex-1 overflow-y-auto">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-tx-tt mb-2">Conversation Details</div>
                <InfoRow label="Channel" value={selected.channel} />
                <InfoRow label="Status" value={selected.status} />
                <InfoRow label="Queue" value={selected.queueName || '—'} />
                <InfoRow label="Subject" value={selected.subject || '—'} />
                <InfoRow label="Messages" value={selected.messageCount || 0} />
                <InfoRow label="Started" value={timeAgo(selected.startedAt) + ' ago'} />
                {selected.endedAt && <InfoRow label="Ended" value={timeAgo(selected.endedAt) + ' ago'} />}

                {/* Phone Intelligence — powered by Telnyx Number Lookup */}
                {selected.channel === 'sms' && contactInfo?.metadata?.lookup && (
                  <>
                    <div className="mt-4 text-[10px] uppercase tracking-wider font-semibold text-tx-tt mb-2 flex items-center gap-1.5">
                      <Phone className="w-3 h-3" /> Phone Intelligence
                    </div>
                    <InfoRow label="Number" value={contactInfo.metadata.lookup.phoneNumber || selected.visitorPhone || '—'} />
                    <InfoRow label="Country" value={contactInfo.metadata.lookup.countryCode || '—'} />
                    <InfoRow label="Carrier" value={contactInfo.metadata.lookup.carrier?.name || '—'} />
                    <InfoRow label="Type" value={contactInfo.metadata.lookup.carrier?.type || '—'} />
                    {contactInfo.metadata.lookup.callerName && (
                      <InfoRow label="CNAM" value={contactInfo.metadata.lookup.callerName} />
                    )}
                    {contactInfo.metadata.optOut && (
                      <div className="mt-2 px-2 py-1.5 rounded-lg bg-tx-red/10 border border-tx-red/30 text-[10px] text-tx-red font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Opted out of SMS
                      </div>
                    )}
                  </>
                )}

                {/* Tags */}
                <div className="mt-4 text-[10px] uppercase tracking-wider font-semibold text-tx-tt mb-2">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {(selected.metadata?.tags || []).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-tx-s3 border border-tx-bdefault text-[10px] text-tx-ts">
                      {tag}
                    </span>
                  ))}
                  {(!selected.metadata?.tags || selected.metadata.tags.length === 0) && (
                    <span className="text-[11px] text-tx-tt">No tags</span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 text-[10px] uppercase tracking-wider font-semibold text-tx-tt mb-2">Actions</div>
                <div className="space-y-1.5">
                  {/* Escalate to call */}
                  {(selected.visitorPhone || selected.metadata?.phone || (selected.metadata?.contactId)) && (
                    <button
                      onClick={() => setShowEscalateConfirm(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts hover:text-tx-tp hover:border-tx-bdefault transition-colors text-[11px]"
                    >
                      <PhoneForwarded className="w-3.5 h-3.5 text-tx-green" />
                      Escalate to Call
                    </button>
                  )}

                  {/* Email transcript */}
                  <button
                    onClick={() => { setTranscriptEmail(selected.visitorEmail || ''); setShowTranscriptModal(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts hover:text-tx-tp hover:border-tx-bdefault transition-colors text-[11px]"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    Email Transcript
                  </button>

                  {/* Merge conversation */}
                  <button
                    onClick={openMergeModal}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts hover:text-tx-tp hover:border-tx-bdefault transition-colors text-[11px]"
                  >
                    <GitMerge className="w-3.5 h-3.5 text-purple-400" />
                    Merge Conversation
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </ErrorBoundary>

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

      {/* ── Toast ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-tx-s2 border border-tx-bdefault shadow-xl text-sm text-tx-tp"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Escalate confirm modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showEscalateConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
            onClick={() => setShowEscalateConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6 w-[360px] space-y-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <PhoneForwarded className="w-4 h-4 text-tx-green" />
                <h3 className="text-sm font-semibold text-tx-tp">Escalate to Call</h3>
              </div>
              <p className="text-xs text-tx-ts">
                This will dial{' '}
                <span className="font-mono font-semibold text-tx-tp">
                  {selected?.visitorPhone || selected?.metadata?.phone || 'the visitor'}
                </span>{' '}
                via Telnyx. The SMS thread stays open alongside the call.
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowEscalateConfirm(false)} className="px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs">Cancel</button>
                <button onClick={escalateToCall} disabled={escalating} className="px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
                  {escalating ? <Loader2 className="w-3 h-3 animate-spin" /> : <PhoneForwarded className="w-3.5 h-3.5" />}
                  Call
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Transcript modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showTranscriptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
            onClick={() => setShowTranscriptModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6 w-[360px] space-y-4"
            >
              <h3 className="text-sm font-semibold text-tx-tp">📧 Email Transcript</h3>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">Recipient email</label>
                <input
                  value={transcriptEmail}
                  onChange={(e) => setTranscriptEmail(e.target.value)}
                  type="email"
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowTranscriptModal(false)} className="px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs">Cancel</button>
                <button onClick={sendTranscript} disabled={transcriptSending || !transcriptEmail.trim()} className="px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
                  {transcriptSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  Send
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Merge modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showMergeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
            onClick={() => setShowMergeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6 w-[420px] max-h-[70vh] space-y-4 flex flex-col"
            >
              <h3 className="text-sm font-semibold text-tx-tp">🔗 Merge Conversation</h3>
              <p className="text-xs text-tx-ts">Select a target conversation to merge into:</p>
              <div className="flex-1 overflow-auto space-y-1">
                {mergeCandidates.length === 0 && (
                  <div className="text-xs text-tx-tt text-center py-4">No matching conversations found</div>
                )}
                {mergeCandidates.map((c) => {
                  const chColor = CHANNEL_COLORS[c.channel] || CHANNEL_COLORS.webchat;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setMergeTarget(c.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        mergeTarget === c.id
                          ? 'border-tx-green/40 bg-tx-green/10'
                          : 'border-tx-bdefault hover:bg-tx-s3'
                      }`}
                    >
                      <div className="text-xs font-medium text-tx-tp">{c.visitorName || 'Unknown'}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] ${chColor.text}`}>{c.channel}</span>
                        <span className="text-[9px] text-tx-tt">{c.subject || 'No subject'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowMergeModal(false)} className="px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs">Cancel</button>
                <button onClick={mergeConversation} disabled={!mergeTarget} className="px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
                  <GitMerge className="w-3.5 h-3.5" />
                  Merge
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── New SMS compose modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showNewSmsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
            onClick={() => setShowNewSmsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-tx-s2 border border-tx-bdefault rounded-2xl p-6 w-[420px] space-y-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <PenSquare className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-tx-tp">New SMS</h3>
              </div>

              {/* To */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">To</label>
                <input
                  value={newSmsTo}
                  onChange={(e) => setNewSmsTo(e.target.value)}
                  type="tel"
                  placeholder="+1 555 123 4567"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
                />
              </div>

              {/* From */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">From</label>
                <select
                  value={newSmsFrom}
                  onChange={(e) => setNewSmsFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
                >
                  {smsNumbers.length === 0 && (
                    <option value="">No SMS numbers available</option>
                  )}
                  {smsNumbers.map((num) => (
                    <option key={num.id} value={num.phoneNumber}>
                      {num.label ? `${num.label} (${num.phoneNumber})` : num.phoneNumber}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name (optional) */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">Name (optional)</label>
                <input
                  value={newSmsName}
                  onChange={(e) => setNewSmsName(e.target.value)}
                  type="text"
                  placeholder="Contact name (optional)"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)]"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">Message</label>
                <textarea
                  value={newSmsText}
                  onChange={(e) => setNewSmsText(e.target.value)}
                  rows={3}
                  placeholder="Type your message…"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] resize-none"
                />
                {/* SMS segment counter */}
                {(() => {
                  const info = analyzeSms(newSmsText);
                  const warn = info.segmentCount > 1 || info.encoding === 'UCS-2';
                  const danger = info.segmentCount > 3;
                  return (
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <span
                        title={`${info.encoding} · ${info.unitCount} unit${info.unitCount === 1 ? '' : 's'} · ${info.segmentCount} segment${info.segmentCount === 1 ? '' : 's'} · ${info.remainingInSegment} left in this segment${info.emojiOrUnicode ? ' (emoji/unicode forces UCS-2 → 70 chars/segment)' : ''}`}
                        className={`text-[10px] tabular-nums cursor-help ${
                          danger ? 'text-tx-red font-medium' : warn ? 'text-amber-400' : 'text-tx-tt'
                        }`}
                      >
                        {info.charCount} chars · {info.encoding === 'UCS-2' ? 'UCS-2' : 'GSM-7'} · {info.segmentCount} segment{info.segmentCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Error */}
              {newSmsError && (
                <div className="text-xs text-tx-red bg-tx-red/10 border border-tx-red/30 rounded-lg px-3 py-2">
                  {newSmsError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowNewSmsModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={sendNewSms}
                  disabled={newSmsSending || !newSmsTo.trim() || !newSmsText.trim() || !newSmsFrom}
                  className="px-4 py-1.5 rounded-lg gradient-primary text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
                >
                  {newSmsSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send SMS
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}