'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  MessageSquare,
  Mail,
  MessageCircle,
  Send,
  Check,
  X,
  ArrowRightLeft,
  Circle,
  Loader2,
} from 'lucide-react';

const CHANNEL_ICON = { voice: Phone, webchat: MessageCircle, sms: MessageSquare, email: Mail };

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-tx-bdefault/30">
      <span className="text-[11px] text-tx-ts">{label}</span>
      <span className="text-xs text-tx-tp truncate max-w-[140px] text-right">{String(value)}</span>
    </div>
  );
}

export function MessageBubble({ message }: { message: any }) {
  if (message.sender === 'system') {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
        <div className="px-3 py-1 rounded-full bg-tx-s3 border border-tx-bdefault/50 text-[10px] uppercase tracking-wider text-tx-ts">
          {message.content}
        </div>
      </motion.div>
    );
  }
  const isAgent = message.sender === 'agent';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[75%] ${isAgent ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="text-[10px] text-tx-ts mb-0.5 px-1">
          {message.senderName || (isAgent ? 'Agent' : 'Visitor')}
        </div>
        <div
          className={`px-3.5 py-2 rounded-2xl text-sm ${
            isAgent
              ? 'gradient-primary text-tx-tp rounded-br-md shadow-md shadow-tx-green/20'
              : 'bg-tx-s3 border border-tx-bdefault/50 text-tx-tp rounded-bl-md'
          }`}
        >
          {message.content}
        </div>
        <div className="text-[9px] text-tx-ts mt-0.5 px-1">
          {new Date(message.createdAt || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </motion.div>
  );
}

export default function InboxConversation({
  conversation,
  messages,
  loading,
  typing,
  draft,
  onDraftChange,
  onSend,
  onAccept,
  onClose,
  onTransfer,
  scrollerRef,
}: {
  conversation: any;
  messages: any[];
  loading?: boolean;
  typing?: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  onAccept?: () => void;
  onClose: () => void;
  onTransfer?: () => void;
  scrollerRef?: React.RefObject<HTMLDivElement>;
}) {
  const Icon = CHANNEL_ICON[conversation.channel] || MessageCircle;
  const isVoice = conversation.channel === 'voice';
  const canAccept =
    conversation.status === 'waiting' ||
    (!conversation.agentId && conversation.status !== 'closed');
  const isClosed = conversation.status === 'closed';

  return (
    <div className="flex-1 flex min-w-0">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-tx-bdefault/50">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-tx-green/30 to-tx-citron/30 border border-tx-bdefault/50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-tx-green" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-tx-tp truncate">
              {conversation.visitorName || 'Visitor'}
            </div>
            <div className="text-[11px] text-tx-ts flex items-center gap-2">
              <Circle
                className={`w-2 h-2 fill-current ${
                  conversation.status === 'active'
                    ? 'text-tx-green'
                    : conversation.status === 'waiting'
                    ? 'text-tx-citron'
                    : 'text-tx-ts'
                }`}
              />
              {conversation.status} · {conversation.channel}
              {conversation.queueName && <span> · {conversation.queueName}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {canAccept && (
              <button
                onClick={onAccept}
                className="px-3 py-1.5 rounded-lg gradient-success text-tx-tp text-xs font-medium shadow-sm hover:shadow-tx-green/30 transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Accept
              </button>
            )}
            {!isClosed && (
              <>
                <button
                  onClick={onTransfer}
                  className="px-3 py-1.5 rounded-lg bg-tx-s3 border border-tx-bdefault text-tx-ts hover:text-tx-tp hover:bg-tx-s3 text-xs font-medium transition flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red hover:bg-tx-red/20 text-xs font-medium transition flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Close
                </button>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollerRef} className="flex-1 overflow-auto px-5 py-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8 text-tx-ts">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
          {!loading && isVoice && (
            <div className="elev-1 rounded-xl p-3 text-xs text-tx-ts">
              <div className="font-semibold text-tx-ts mb-1">Voice call</div>
              <div>
                Live transcript appears here. From {conversation.metadata?.from || '—'} to{' '}
                {conversation.metadata?.to || '—'}.
              </div>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </AnimatePresence>
          {typing && (
            <div className="flex items-center gap-2 text-xs text-tx-ts">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-tx-ts/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-tx-ts/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-tx-ts/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>{conversation.visitorName || 'Visitor'} is typing…</span>
            </div>
          )}
        </div>

        {/* Composer */}
        {!isClosed ? (
          <div className="border-t border-tx-bdefault/50 px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder="Type a message… (Enter to send)"
                rows={1}
                className="flex-1 px-3 py-2 text-sm bg-tx-s3 border border-tx-bdefault/50 rounded-xl text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/40 resize-none max-h-32"
              />
              <button
                onClick={onSend}
                disabled={!draft.trim()}
                className="px-4 py-2 rounded-xl gradient-primary text-tx-tp text-sm font-medium shadow-md shadow-tx-green/30 hover:shadow-tx-green/50 transition disabled:opacity-40 disabled:shadow-none flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-tx-bdefault/50 px-5 py-4 text-center text-xs text-tx-ts">
            This conversation is closed.
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] border-l border-tx-bdefault/50 px-4 py-5">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-2">
          Visitor
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-tx-tp">
            {(conversation.visitorName || 'V').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-tx-tp truncate">
              {conversation.visitorName || 'Visitor'}
            </div>
            <div className="text-[11px] text-tx-ts truncate">
              {conversation.visitorEmail || '—'}
            </div>
          </div>
        </div>
        <InfoRow label="Channel" value={conversation.channel} />
        <InfoRow label="Status" value={conversation.status} />
        <InfoRow label="Queue" value={conversation.queueName || '—'} />
        <InfoRow label="Subject" value={conversation.subject || '—'} />
        <InfoRow label="Messages" value={conversation.messageCount || 0} />
        <InfoRow label="Started" value={timeAgo(conversation.startedAt) + ' ago'} />
        {conversation.endedAt && (
          <InfoRow label="Ended" value={timeAgo(conversation.endedAt) + ' ago'} />
        )}
        <div className="mt-4 text-[10px] uppercase tracking-wider font-semibold text-tx-ts mb-2">
          Tags
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(conversation.metadata?.tags || []).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-tx-s3 border border-tx-bdefault text-[10px] text-tx-ts"
            >
              {tag}
            </span>
          ))}
          {(!conversation.metadata?.tags || conversation.metadata.tags.length === 0) && (
            <span className="text-[11px] text-tx-ts">No tags</span>
          )}
        </div>
      </aside>
    </div>
  );
}
