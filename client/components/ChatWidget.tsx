'use client';

/**
 * ChatWidget — embeddable floating chat bubble.
 *
 * Usage:
 *   import ChatWidget from '@/components/ChatWidget';
 *   <ChatWidget apiBase="/api" socketUrl={undefined} />
 *
 * Behaviour:
 *   - Floating action button (bottom-right) that expands into a chat window.
 *   - Pre-chat form (name, email, subject) starts a new conversation via
 *     POST /api/chat/start (visitor public endpoint, no auth required).
 *   - Live messages via Socket.IO (`/api/socket.io`) using `auth.visitor=true`.
 *   - Self-contained: works in any Next/React page; could be lifted to a
 *     standalone bundle for <script> embedding with minimal changes.
 *   - CSAT survey prompt when conversation is closed by agent.
 *   - Offline / after-hours form when no agents are available.
 *   - Wait position display when visitor is in queue.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, Star, Clock } from 'lucide-react';
import { io } from 'socket.io-client';

const DEFAULT_API_BASE = '/api';
const SOCKET_PATH = '/api/socket.io';

function pickSocketUrl(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof window === 'undefined') return undefined;
  // Dev: Next on 3000, backend on 3001
  if (window.location.port === '3000') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return undefined; // same-origin in prod
}

export default function ChatWidget({
  apiBase = DEFAULT_API_BASE,
  socketUrl,
  position = 'bottom-right',
  title = 'Chat with us',
  greeting = "Hi there! 👋  How can we help?",
  agentsOnline = true,
}: {
  apiBase?: string;
  socketUrl?: string;
  position?: string;
  title?: string;
  greeting?: string;
  /** Whether agents are online. Defaults to true. Widget will also try GET /api/chat/agent-status. */
  agentsOnline?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [visitorName, setVisitorName] = useState<string>('');
  const [visitorEmail, setVisitorEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [starting, setStarting] = useState<boolean>(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [agentTyping, setAgentTyping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<any>(null);
  const scrollerRef = useRef(null);
  const typingTimer = useRef(null);

  /* Agent status */
  const [online, setOnline] = useState<boolean>(agentsOnline);

  /* Offline form */
  const [offlineName, setOfflineName] = useState<string>('');
  const [offlineEmail, setOfflineEmail] = useState<string>('');
  const [offlineSubject, setOfflineSubject] = useState<string>('');
  const [offlineMessage, setOfflineMessage] = useState<string>('');
  const [offlineSending, setOfflineSending] = useState<boolean>(false);
  const [offlineSent, setOfflineSent] = useState<boolean>(false);

  /* CSAT survey */
  const [showSurvey, setShowSurvey] = useState<boolean>(false);
  const [surveyRating, setSurveyRating] = useState<number>(0);
  const [surveyComment, setSurveyComment] = useState<string>('');
  const [surveySubmitting, setSurveySubmitting] = useState<boolean>(false);
  const [surveySubmitted, setSurveySubmitted] = useState<boolean>(false);

  /* Wait position */
  const [waitInfo, setWaitInfo] = useState<{ position: number | null; estimatedWait: number | null }>({ position: null, estimatedWait: null });
  const [conversationStatus, setConversationStatus] = useState<string>('active');
  const waitPollRef = useRef<any>(null);

  const resolvedSocketUrl = useMemo(() => pickSocketUrl(socketUrl), [socketUrl]);

  // Check agent status on mount
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`${apiBase}/chat/agent-status`);
        if (res.ok) {
          const data = await res.json();
          setOnline(data.online !== false);
        }
        // If 404 or error, keep default (agentsOnline prop)
      } catch {
        // Gracefully degrade — keep prop default
      }
    }
    checkStatus();
    // Poll every 30s
    const iv = setInterval(checkStatus, 30000);
    return () => clearInterval(iv);
  }, [apiBase, agentsOnline]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, agentTyping]);

  // Wait position polling
  useEffect(() => {
    if (!conversationId || conversationStatus !== 'waiting') {
      clearInterval(waitPollRef.current);
      return;
    }
    async function pollWait() {
      try {
        const res = await fetch(`${apiBase}/chat/${conversationId}/wait-info`);
        if (res.ok) {
          const data = await res.json();
          setWaitInfo({ position: data.position ?? null, estimatedWait: data.estimatedWait ?? null });
        }
      } catch {
        // Ignore errors
      }
    }
    pollWait();
    waitPollRef.current = setInterval(pollWait, 15000);
    return () => clearInterval(waitPollRef.current);
  }, [conversationId, conversationStatus, apiBase]);

  // Connect socket once we have a conversation
  useEffect(() => {
    if (!conversationId) return;
    const s = io(resolvedSocketUrl, {
      path: SOCKET_PATH,
      auth: { visitor: true },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = s;

    s.on('connect', () => {
      s.emit('chat:join', { conversationId });
    });
    s.on('chat:message', (msg) => {
      if (msg.conversationId && msg.conversationId !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    s.on('chat:typing', ({ sender, isTyping }) => {
      if (sender === 'visitor') return;
      setAgentTyping(!!isTyping);
      clearTimeout(typingTimer.current);
      if (isTyping) typingTimer.current = setTimeout(() => setAgentTyping(false), 3500);
    });
    s.on('chat:closed', () => {
      setConversationStatus('closed');
      setMessages((prev) => [
        ...prev,
        { id: `sys-closed-${Date.now()}`, sender: 'system', content: 'Conversation closed.' },
      ]);
      // Show CSAT survey
      setShowSurvey(true);
    });

    return () => {
      s.emit('chat:leave', { conversationId });
      s.disconnect();
      socketRef.current = null;
    };
  }, [conversationId, resolvedSocketUrl]);

  async function startChat(e: React.FormEvent): Promise<void> {
    e?.preventDefault();
    setError(null);
    setStarting(true);
    try {
      const res = await fetch(`${apiBase}/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorName: visitorName.trim() || 'Visitor',
          visitorEmail: visitorEmail.trim() || undefined,
          subject: subject.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setConversationId(data.conversationId);
      setSessionToken(data.sessionToken || null);
      setConversationStatus(data.status || 'waiting');
      setMessages([{ id: 'welcome', sender: 'system', content: greeting }]);
    } catch (err: any) {
      setError(err.message || 'Failed to start chat');
    } finally {
      setStarting(false);
    }
  }

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text || !conversationId) return;
    setDraft('');
    setSending(true);
    socketRef.current?.emit('chat:typing', {
      conversationId,
      sender: 'visitor',
      name: visitorName || 'Visitor',
      isTyping: false,
    });
    try {
      const res = await fetch(`${apiBase}/chat/${conversationId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { 'X-Chat-Token': sessionToken } : {}),
        },
        body: JSON.stringify({ content: text, senderName: visitorName || 'Visitor', sessionToken }),
      });
      if (res.status === 429) {
        throw new Error('Please slow down — you\'re sending messages too quickly');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const msg = await res.json();
      // Optimistically append in case socket lags
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } catch (err: any) {
      setError(err.message || 'Failed to send');
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  function onDraftChange(v: string): void {
    setDraft(v);
    if (!conversationId) return;
    socketRef.current?.emit('chat:typing', {
      conversationId,
      sender: 'visitor',
      name: visitorName || 'Visitor',
      isTyping: !!v,
    });
  }

  async function submitOfflineMessage(e: React.FormEvent): Promise<void> {
    e?.preventDefault();
    if (!offlineMessage.trim()) return;
    setOfflineSending(true);
    try {
      const res = await fetch(`${apiBase}/chat/offline-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: offlineName.trim() || 'Visitor',
          email: offlineEmail.trim() || undefined,
          subject: offlineSubject.trim() || undefined,
          message: offlineMessage.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setOfflineSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setOfflineSending(false);
    }
  }

  async function submitSurvey(): Promise<void> {
    if (!conversationId || surveyRating === 0) return;
    setSurveySubmitting(true);
    try {
      await fetch(`${apiBase}/chat/${conversationId}/survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: surveyRating, comment: surveyComment.trim() || undefined }),
      });
      setSurveySubmitted(true);
    } catch {
      // Silently fail — don't frustrate the user
      setSurveySubmitted(true);
    } finally {
      setSurveySubmitting(false);
    }
  }

  const MAX_CHARS = 2000;
  const charCount = draft.length;
  const charOver = charCount > MAX_CHARS;

  const posClass =
    position === 'bottom-left' ? 'left-6 bottom-6' : 'right-6 bottom-6';

  return (
    <div className={`fixed ${posClass} z-[9999]`} style={{ fontFamily: 'inherit' }}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3 w-[360px] max-w-[90vw] h-[520px] max-h-[80vh] glass-card overflow-hidden flex flex-col shadow-2xl shadow-tx-green/20"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-tx-bdefault/50 gradient-primary">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-tx-s3 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-tx-tp" strokeWidth={2.2} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-tx-tp leading-tight">{title}</div>
                  <div className="text-[10px] text-tx-tp/80">
                    {online ? 'We typically reply in minutes' : 'Currently offline'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full text-tx-tp/80 hover:text-tx-tp hover:bg-tx-s3 flex items-center justify-center transition"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            {!conversationId ? (
              online ? (
                /* ── Pre-chat form (online) ──────────────────────── */
                <form onSubmit={startChat} className="flex-1 overflow-auto p-4 space-y-3">
                  <p className="text-xs text-tx-ts mb-2">{greeting}</p>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">
                      Your name
                    </label>
                    <input
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="Jane Smith"
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={visitorEmail}
                      onChange={(e) => setVisitorEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">
                      What can we help with?
                    </label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Billing question"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50"
                    />
                  </div>
                  {error && (
                    <div className="text-xs text-tx-red bg-tx-red/10 border border-tx-red/20 rounded-lg px-2 py-1.5">
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={starting || !visitorName.trim()}
                    className="w-full py-2.5 rounded-lg gradient-primary text-tx-tp text-sm font-semibold shadow-md shadow-tx-green/30 hover:shadow-tx-green/50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start chat'}
                  </button>
                </form>
              ) : (
                /* ── Offline form (no agents) ─────────────────────── */
                offlineSent ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-tx-green/15 flex items-center justify-center mb-3">
                      <MessageCircle className="w-6 h-6 text-tx-green" />
                    </div>
                    <p className="text-sm text-tx-tp font-medium">Thanks! We&apos;ll get back to you soon.</p>
                    <p className="text-[11px] text-tx-ts mt-1">We received your message and will respond as soon as we&apos;re back online.</p>
                  </div>
                ) : (
                  <form onSubmit={submitOfflineMessage} className="flex-1 overflow-auto p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-tx-s3 border border-tx-bdefault/50">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <p className="text-xs text-tx-ts">We&apos;re currently offline. Leave us a message and we&apos;ll get back to you.</p>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">
                        Your name
                      </label>
                      <input
                        value={offlineName}
                        onChange={(e) => setOfflineName(e.target.value)}
                        placeholder="Jane Smith"
                        required
                        className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={offlineEmail}
                        onChange={(e) => setOfflineEmail(e.target.value)}
                        placeholder="jane@example.com"
                        required
                        className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">
                        Subject
                      </label>
                      <input
                        value={offlineSubject}
                        onChange={(e) => setOfflineSubject(e.target.value)}
                        placeholder="e.g. Billing question"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-1">
                        Message
                      </label>
                      <textarea
                        value={offlineMessage}
                        onChange={(e) => setOfflineMessage(e.target.value)}
                        placeholder="How can we help?"
                        required
                        rows={3}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50 resize-none"
                      />
                    </div>
                    {error && (
                      <div className="text-xs text-tx-red bg-tx-red/10 border border-tx-red/20 rounded-lg px-2 py-1.5">
                        {error}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={offlineSending || !offlineMessage.trim()}
                      className="w-full py-2.5 rounded-lg gradient-primary text-tx-tp text-sm font-semibold shadow-md shadow-tx-green/30 hover:shadow-tx-green/50 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {offlineSending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Message'}
                    </button>
                  </form>
                )
              )
            ) : (
              <>
                <div ref={scrollerRef} className="flex-1 overflow-auto px-3 py-3 space-y-2">
                  {messages.map((m) => (
                    <WidgetMessage key={m.id} message={m} />
                  ))}

                  {/* Wait position indicator */}
                  {conversationStatus === 'waiting' && (waitInfo.position !== null || waitInfo.estimatedWait !== null) && (
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-400 py-1">
                      <Clock className="w-3.5 h-3.5" />
                      {waitInfo.position !== null && <span>You are #{waitInfo.position} in queue</span>}
                      {waitInfo.position !== null && waitInfo.estimatedWait !== null && <span>·</span>}
                      {waitInfo.estimatedWait !== null && <span>Estimated wait: {waitInfo.estimatedWait} min</span>}
                    </div>
                  )}

                  {agentTyping && (
                    <div className="flex items-center gap-1.5 text-[11px] text-tx-ts px-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-tx-ts/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-tx-ts/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-tx-ts/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span>Agent is typing…</span>
                    </div>
                  )}

                  {/* CSAT Survey */}
                  {showSurvey && !surveySubmitted && (
                    <div className="my-3 p-3 rounded-xl bg-tx-s3 border border-tx-bdefault/50 space-y-2">
                      <div className="text-xs font-semibold text-tx-tp">How was your experience?</div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setSurveyRating(star)}
                            className="p-0.5 transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-6 h-6 ${star <= surveyRating ? 'text-amber-400 fill-amber-400' : 'text-tx-tt'}`}
                            />
                          </button>
                        ))}
                      </div>
                      {surveyRating > 0 && (
                        <>
                          <textarea
                            value={surveyComment}
                            onChange={(e) => setSurveyComment(e.target.value)}
                            placeholder="Any additional comments? (optional)"
                            rows={2}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-tx-s4 border border-tx-bdefault/50 text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/40 resize-none"
                          />
                          <button
                            onClick={submitSurvey}
                            disabled={surveySubmitting}
                            className="w-full py-2 rounded-lg gradient-primary text-tx-tp text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {surveySubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit Feedback'}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {showSurvey && surveySubmitted && (
                    <div className="my-3 p-3 rounded-xl bg-tx-green/10 border border-tx-green/20 text-center">
                      <p className="text-xs text-tx-green font-medium">Thank you for your feedback! 💚</p>
                    </div>
                  )}
                </div>

                {/* Chat input (only when conversation is active and not closed) */}
                {conversationStatus !== 'closed' ? (
                  <div className="border-t border-tx-bdefault/50 px-3 py-2.5">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={draft}
                        onChange={(e) => onDraftChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        rows={1}
                        placeholder="Type a message…"
                        maxLength={MAX_CHARS}
                        className="flex-1 px-3 py-2 text-sm rounded-lg bg-tx-s3 border border-tx-bdefault/50 text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50 resize-none max-h-24"
                      />
                      <button
                        onClick={send}
                        disabled={!draft.trim() || sending || charOver}
                        className="px-3 py-2 rounded-lg gradient-primary text-tx-tp shadow-md shadow-tx-green/30 disabled:opacity-40"
                        aria-label="Send"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-0.5 px-0.5">
                      {error ? (
                        <div className="text-[11px] text-tx-red">{error}</div>
                      ) : (
                        <span />
                      )}
                      <span className={`text-[10px] ${charOver ? 'text-tx-red font-medium' : 'text-tx-ts'}`}>
                        {charCount}{'/'}{MAX_CHARS}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-tx-bdefault/50 px-4 py-3 text-center">
                    <span className="text-xs text-tx-ts">This conversation has ended</span>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating action button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full gradient-primary text-tx-tp shadow-xl shadow-tx-green/40 flex items-center justify-center"
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        <motion.div
          key={open ? 'x' : 'msg'}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        </motion.div>
      </motion.button>
    </div>
  );
}

function WidgetMessage({ message }: { message: any }) {
  if (message.sender === 'system') {
    return (
      <div className="flex justify-center">
        <div className="px-2.5 py-1 rounded-full bg-tx-s3 border border-tx-bdefault/50 text-[10px] uppercase tracking-wider text-tx-ts">
          {message.content}
        </div>
      </div>
    );
  }
  const isVisitor = message.sender === 'visitor';
  return (
    <div className={`flex ${isVisitor ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] px-3 py-2 text-sm rounded-2xl ${
          isVisitor
            ? 'gradient-primary text-tx-tp rounded-br-md'
            : 'bg-tx-s3 border border-tx-bdefault/50 text-tx-tp rounded-bl-md'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
