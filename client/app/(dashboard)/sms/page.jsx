'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '../../../src/store/hooks';
import {
  useGetMyConversationsQuery,
  useGetMessagesQuery,
  useSendMessageMutation,
  useGetAgentPhoneNumbersQuery,
  useGetMessagingNumbersQuery,
} from '../../../src/store/api';
import { validatePhoneNumber, formatPhoneDisplay, COUNTRY_CODES, toE164 } from '../../../src/lib/phone-utils';

// Status indicator component (iMessage-style)
function DeliveryStatus({ status }) {
  if (!status || status === 'delivered') {
    // Inbound messages or delivered
  }
  const config = {
    sending: { icon: '○', label: 'Sending', className: 'text-gray-400' },
    sent: { icon: '✓', label: 'Sent', className: 'text-gray-400' },
    delivered: { icon: '✓✓', label: 'Delivered', className: 'text-telnyx-green' },
    failed: { icon: '!', label: 'Failed', className: 'text-red-400' },
    queued: { icon: '◷', label: 'Queued', className: 'text-gray-400' },
  };
  const s = config[status];
  if (!s) return null;

  return (
    <span className={`text-[10px] ${s.className} flex items-center gap-0.5`} title={s.label}>
      <span>{s.icon}</span>
      {status === 'failed' && <span className="ml-0.5">Failed</span>}
    </span>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Check if we should show a date separator between messages
function shouldShowDateSeparator(prev, curr) {
  if (!prev) return true;
  const d1 = new Date(prev.createdAt).toDateString();
  const d2 = new Date(curr.createdAt).toDateString();
  return d1 !== d2;
}

function DateSeparator({ date }) {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  let label;
  if (isToday) label = 'Today';
  else if (isYesterday) label = 'Yesterday';
  else label = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <div className="flex items-center justify-center py-2">
      <span className="rounded-full bg-gray-100 px-3 py-0.5 text-[11px] font-medium text-gray-500">
        {label}
      </span>
    </div>
  );
}

export default function SmsPage() {
  const username = useAppSelector((state) => state.auth.username);

  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeFrom, setComposeFrom] = useState('');
  const [composeCountry, setComposeCountry] = useState('+1');
  const [composeError, setComposeError] = useState('');
  const [sendError, setSendError] = useState('');
  const [composeMedia, setComposeMedia] = useState([]);
  const [replyMedia, setReplyMedia] = useState([]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const composeFileRef = useRef(null);
  const replyFileRef = useRef(null);

  // RTK Query hooks
  const { data: conversations = [], isLoading: convsLoading } =
    useGetMyConversationsQuery(username, { skip: !username });

  const { data: messages = [], isLoading: msgsLoading } =
    useGetMessagesQuery(selectedConversationId, {
      skip: !selectedConversationId,
    });

  const { data: phoneNumbersData } = useGetAgentPhoneNumbersQuery(username, { skip: !username });
  const { data: messagingNumbersData } = useGetMessagingNumbersQuery();

  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();

  // Use messaging numbers first, fall back to tag-based numbers
  const agentNumbers = messagingNumbersData?.data?.length
    ? messagingNumbersData.data.map((p) => p.phone_number)
    : phoneNumbersData?.data
      ? phoneNumbersData.data.map((p) => p.phone_number)
      : [];

  useEffect(() => {
    if (agentNumbers.length > 0 && !composeFrom) {
      setComposeFrom(agentNumbers[0]);
    }
  }, [agentNumbers, composeFrom]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when selecting conversation
  useEffect(() => {
    if (selectedConversationId) {
      inputRef.current?.focus();
    }
  }, [selectedConversationId]);

  const handleFileSelect = (files, setter) => {
    const validFiles = Array.from(files).filter((f) => f.size <= 5 * 1024 * 1024);
    if (validFiles.length === 0) return;
    let loaded = 0;
    const results = [];
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        results.push({ preview: reader.result, file });
        loaded++;
        if (loaded === validFiles.length) setter((prev) => [...prev, ...results]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversationId(conversation.conversation_id);
    setSelectedConversation(conversation);
    setMessageText('');
    setSendError('');
  };

  const handleReply = async () => {
    if ((!messageText.trim() && replyMedia.length === 0) || !selectedConversation) return;
    setSendError('');
    try {
      let mediaUrls = [];
      if (replyMedia.length > 0) {
        const API_BASE = `https://${process.env.NEXT_PUBLIC_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT}`;
        for (const m of replyMedia) {
          const uploadRes = await fetch(`${API_BASE}/api/conversations/upload-media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: m.preview, filename: m.file.name, content_type: m.file.type }),
          });
          const uploaded = await uploadRes.json();
          if (uploaded.url) mediaUrls.push(uploaded.url);
        }
      }
      await sendMessage({
        From: selectedConversation.from_number,
        Text: messageText.trim(),
        To: selectedConversation.to_number,
        agent: username,
        MediaUrls: mediaUrls,
      }).unwrap();
      setMessageText('');
      setReplyMedia([]);
    } catch (err) {
      console.error('Error sending reply:', err);
      const detail = err?.data?.details?.[0]?.detail || err?.data?.details || err?.data?.error || 'Failed to send message';
      setSendError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
  };

  const handleReplyKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReply();
    }
  };

  const handleCompose = async () => {
    const fullNumber = toE164(composeTo.trim(), composeCountry);
    const validation = validatePhoneNumber(fullNumber);
    if (!validation.valid) {
      setComposeError(validation.error);
      return;
    }
    if ((!composeBody.trim() && composeMedia.length === 0) || !composeFrom) return;

    setComposeError('');
    try {
      // Upload media files first
      let mediaUrls = [];
      if (composeMedia.length > 0) {
        const API_BASE = `https://${process.env.NEXT_PUBLIC_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT}`;
        for (const m of composeMedia) {
          const uploadRes = await fetch(`${API_BASE}/api/conversations/upload-media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: m.preview, filename: m.file.name, content_type: m.file.type }),
          });
          const uploaded = await uploadRes.json();
          if (uploaded.url) mediaUrls.push(uploaded.url);
        }
      }
      await sendMessage({
        From: composeFrom,
        Text: composeBody.trim(),
        To: validation.formatted,
        agent: username,
        MediaUrls: mediaUrls,
      }).unwrap();
      setComposeTo('');
      setComposeBody('');
      setComposeMedia([]);
      setIsComposeOpen(false);
      setComposeError('');
    } catch (err) {
      console.error('Error sending message:', err);
      const detail = err?.data?.details?.[0]?.detail || err?.data?.details || err?.data?.error || 'Failed to send message';
      setComposeError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
  };

  const handleRetry = async (msg) => {
    if (!selectedConversation) return;
    try {
      await sendMessage({
        From: selectedConversation.from_number,
        Text: msg.text_body,
        To: selectedConversation.to_number,
        agent: username,
      }).unwrap();
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Conversations</h1>

      <div className="flex flex-1 gap-0 overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm">
        {/* Left column - Conversation list */}
        <div className="flex w-80 flex-shrink-0 flex-col border-r border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-950 px-4 py-3 rounded-tl-card">
            <h2 className="text-sm font-semibold text-white">Conversations</h2>
            <button
              onClick={() => { setIsComposeOpen(true); setComposeError(''); }}
              className="flex items-center gap-1 rounded-full bg-telnyx-green px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-telnyx-green/90"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {convsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-telnyx-green border-t-transparent"></div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg className="mx-auto h-10 w-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="mt-2 text-sm text-gray-400">No conversations yet</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConversationId === conv.conversation_id;
                return (
                  <button
                    key={conv.conversation_id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full px-4 py-3 text-left transition-colors border-b border-gray-50 ${
                      isSelected
                        ? 'bg-telnyx-green/5 border-l-[3px] border-l-telnyx-green'
                        : 'hover:bg-gray-50 border-l-[3px] border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {formatPhoneDisplay(conv.to_number) || conv.to_number}
                      </span>
                      {conv.updatedAt && (
                        <span className="text-[10px] text-gray-400">
                          {formatTime(conv.updatedAt)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {conv.last_message || 'No messages'}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right column - Message thread */}
        <div className="flex flex-1 flex-col">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-950 px-4 py-3 rounded-tr-card">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {formatPhoneDisplay(selectedConversation.to_number) || selectedConversation.to_number}
                  </h2>
                  <p className="text-[10px] text-gray-400">
                    From: {selectedConversation.from_number}
                  </p>
                </div>
              </div>

              {/* Messages area - iMessage style */}
              <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4">
                {msgsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-telnyx-green border-t-transparent"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <svg className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-400">No messages yet. Send the first one!</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {messages.map((msg, index) => {
                      const isOutbound = msg.direction === 'outbound';
                      const prevMsg = index > 0 ? messages[index - 1] : null;
                      const showDate = shouldShowDateSeparator(prevMsg, msg);
                      // Group consecutive same-direction messages
                      const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
                      const isLastInGroup = !nextMsg || nextMsg.direction !== msg.direction;

                      return (
                        <div key={msg.id || index}>
                          {showDate && <DateSeparator date={msg.createdAt} />}
                          <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] ${isLastInGroup ? 'mb-2' : 'mb-0.5'}`}>
                              <div
                                className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                                  isOutbound
                                    ? msg.status === 'failed'
                                      ? 'bg-red-500/80 text-white'
                                      : 'bg-telnyx-green text-white'
                                    : 'bg-white text-gray-900 shadow-sm border border-gray-100'
                                }`}
                                style={isOutbound ? {
                                  borderBottomRightRadius: isLastInGroup ? '4px' : undefined,
                                } : {
                                  borderBottomLeftRadius: isLastInGroup ? '4px' : undefined,
                                }}
                              >
                                {(() => {
                                  const media = msg.media ? (typeof msg.media === 'string' ? JSON.parse(msg.media) : msg.media) : [];
                                  return (
                                    <>
                                      {media.length > 0 && (
                                        <div className={`${msg.text_body ? 'mb-1.5' : ''} flex flex-wrap gap-1`}>
                                          {media.map((m, mi) => {
                                            const url = m.url || m;
                                            const ct = m.content_type || '';
                                            if (ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
                                              return <img key={mi} src={url} alt="" className="max-w-[240px] rounded-lg cursor-pointer" onClick={() => window.open(url, '_blank')} />;
                                            }
                                            return (
                                              <a key={mi} href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                                                Attachment {mi + 1}
                                              </a>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {msg.text_body && <span>{msg.text_body}</span>}
                                    </>
                                  );
                                })()}
                              </div>
                              {/* Timestamp + delivery status */}
                              {isLastInGroup && (
                                <div className={`mt-0.5 flex items-center gap-1 px-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                  <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                                  {isOutbound && <DeliveryStatus status={msg.status} />}
                                  {msg.status === 'failed' && isOutbound && (
                                    <button
                                      onClick={() => handleRetry(msg)}
                                      className="ml-1 text-[10px] font-medium text-red-400 underline hover:text-red-500"
                                    >
                                      Retry
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message input - iMessage style */}
              <div className="border-t border-gray-200 bg-white px-4 py-3">
                {sendError && (
                  <div className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">
                    {sendError}
                  </div>
                )}
                {/* Reply media previews */}
                {replyMedia.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {replyMedia.map((m, i) => (
                      <div key={i} className="relative">
                        <img src={m.preview} alt="" className="h-14 w-14 rounded-lg object-cover border border-gray-200" />
                        <button onClick={() => setReplyMedia((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => replyFileRef.current?.click()}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-telnyx-green transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                  </button>
                  <input ref={replyFileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => { handleFileSelect(e.target.files, setReplyMedia); e.target.value = ''; }} />
                  <textarea
                    ref={inputRef}
                    value={messageText}
                    onChange={(e) => { setMessageText(e.target.value); setSendError(''); }}
                    onKeyDown={handleReplyKeyDown}
                    placeholder="iMessage"
                    rows={1}
                    className="flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
                    style={{ maxHeight: '120px' }}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                  />
                  <button
                    onClick={handleReply}
                    disabled={isSending || (!messageText.trim() && replyMedia.length === 0)}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-telnyx-green text-white transition-all hover:bg-telnyx-green/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <svg
                    className="h-8 w-8 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">
                  Select a conversation
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Choose from your conversations or start a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Dialog */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-card bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4 rounded-t-card">
              <h3 className="text-lg font-semibold text-gray-900">
                New Message
              </h3>
            </div>

            <div className="space-y-4 px-6 py-4">
              {/* From number dropdown */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  From
                </label>
                <select
                  value={composeFrom}
                  onChange={(e) => setComposeFrom(e.target.value)}
                  className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
                >
                  {agentNumbers.map((number, idx) => (
                    <option key={idx} value={number}>
                      {formatPhoneDisplay(number)}
                    </option>
                  ))}
                </select>
              </div>

              {/* To number with country code */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  To
                </label>
                <div className="flex gap-2">
                  <select
                    value={composeCountry}
                    onChange={(e) => { setComposeCountry(e.target.value); setComposeError(''); }}
                    className="w-24 rounded-btn border border-gray-300 px-2 py-2 text-sm text-gray-900 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    autoFocus
                    value={composeTo}
                    onChange={(e) => { setComposeTo(e.target.value); setComposeError(''); }}
                    placeholder="Phone number"
                    className={`flex-1 rounded-btn border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 ${
                      composeError
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                        : 'border-gray-300 focus:border-telnyx-green focus:ring-telnyx-green'
                    }`}
                  />
                </div>
                {composeError && (
                  <p className="mt-1 text-xs text-red-500">{composeError}</p>
                )}
              </div>

              {/* Message body */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && (composeBody.trim() || composeMedia.length > 0) && composeTo.trim()) {
                      e.preventDefault();
                      handleCompose();
                    }
                  }}
                  placeholder="Type your message..."
                  rows={4}
                  className="w-full resize-none rounded-btn border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
                />
                {/* Attachment previews */}
                {composeMedia.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {composeMedia.map((m, i) => (
                      <div key={i} className="relative">
                        <img src={m.preview} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
                        <button onClick={() => setComposeMedia((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => composeFileRef.current?.click()}
                  className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-telnyx-green"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                  Attach image
                </button>
                <input ref={composeFileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { handleFileSelect(e.target.files, setComposeMedia); e.target.value = ''; }} />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 rounded-b-card">
              <button
                onClick={() => {
                  setIsComposeOpen(false);
                  setComposeTo('');
                  setComposeBody('');
                  setComposeMedia([]);
                  setComposeError('');
                }}
                className="rounded-btn border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCompose}
                disabled={isSending || (!composeBody.trim() && composeMedia.length === 0) || !composeTo.trim()}
                className="rounded-btn bg-telnyx-green px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-telnyx-green/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? 'Sending...' : composeMedia.length > 0 ? 'Send MMS' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
