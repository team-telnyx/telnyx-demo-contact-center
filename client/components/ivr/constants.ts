import {
  PhoneIncoming, Volume2, Hash, Users, ArrowRightLeft, Mic, PhoneOff,
  Music, Cpu, PhoneForwarded, Voicemail, MessageSquare, Layout,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NodeDef {
  bg: string;       // gradient classes for header
  border: string;   // hex color for minimap/highlights
  accent: string;   // tailwind text color class (used in sidebar)
  accentBg: string; // tailwind bg color class (very subtle)
  icon: LucideIcon;
  label: string;
  desc: string;      // short one-liner for tooltips / node previews
  longDesc: string;  // friendlier description shown in sidebar & info panels
  cat: string;
  group: 'start' | 'input' | 'route' | 'end' | 'branch' | 'media' | 'system';
}

// Color groups (per UX spec):
//   green  → start / greeting    (answer, speak, callback)
//   blue   → input collection    (gather, amd)
//   amber  → transfer / routing  (transfer, enqueue, voicemail)
//   red    → end the call        (hangup)
//   purple → branch / condition  (we treat 'gather' branches via amber digit handles;
//                                  whisper used for agent-side branching whisper)
//   teal   → media / record      (record, play)
export const NODE_DEFS: Record<string, NodeDef> = {
  answer:    {
    bg: 'from-emerald-500 to-emerald-600', border: '#10b981',
    accent: 'text-emerald-400', accentBg: 'bg-emerald-500/10',
    icon: PhoneIncoming, label: 'Answer',
    desc: 'Pick up the incoming call',
    longDesc: 'Entry point — picks up the inbound call. Every flow starts here.',
    cat: 'core', group: 'start',
  },
  speak:     {
    bg: 'from-emerald-500 to-green-600', border: '#10b981',
    accent: 'text-emerald-400', accentBg: 'bg-emerald-500/10',
    icon: Volume2, label: 'Play Audio (TTS)',
    desc: 'Play a greeting or message',
    longDesc: 'Speak a text-to-speech message to the caller (greetings, instructions, info).',
    cat: 'core', group: 'start',
  },
  gather:    {
    bg: 'from-blue-500 to-indigo-600', border: '#3b82f6',
    accent: 'text-blue-400', accentBg: 'bg-blue-500/10',
    icon: Hash, label: 'Collect Input',
    desc: 'Ask caller to press a digit',
    longDesc: 'Prompt the caller for keypad input (DTMF). Each valid digit creates its own branch.',
    cat: 'core', group: 'input',
  },
  enqueue:   {
    bg: 'from-amber-500 to-amber-600', border: '#f59e0b',
    accent: 'text-amber-400', accentBg: 'bg-amber-500/10',
    icon: Users, label: 'Transfer to Queue',
    desc: 'Route to an agent queue',
    longDesc: 'Place the caller in an agent queue for the next available agent (ACD).',
    cat: 'core', group: 'route',
  },
  transfer:  {
    bg: 'from-amber-500 to-orange-600', border: '#f59e0b',
    accent: 'text-amber-400', accentBg: 'bg-amber-500/10',
    icon: ArrowRightLeft, label: 'Transfer',
    desc: 'Route to agent / queue / number',
    longDesc: 'Blind-transfer the call to another phone number or SIP URI.',
    cat: 'core', group: 'route',
  },
  record:    {
    bg: 'from-teal-500 to-teal-600', border: '#14b8a6',
    accent: 'text-teal-400', accentBg: 'bg-teal-500/10',
    icon: Mic, label: 'Record',
    desc: 'Start call recording',
    longDesc: 'Begin recording the call audio. Recording continues in the background.',
    cat: 'core', group: 'media',
  },
  hangup:    {
    bg: 'from-rose-500 to-red-600', border: '#ef4444',
    accent: 'text-rose-400', accentBg: 'bg-rose-500/10',
    icon: PhoneOff, label: 'Hangup',
    desc: 'End the call',
    longDesc: 'Terminates the call. Place at the end of any branch to cleanly hang up.',
    cat: 'core', group: 'end',
  },
  play:      {
    bg: 'from-teal-500 to-cyan-600', border: '#14b8a6',
    accent: 'text-teal-400', accentBg: 'bg-teal-500/10',
    icon: Music, label: 'Play Audio File',
    desc: 'Play an audio file/URL',
    longDesc: 'Plays an MP3 or WAV file from a URL (hold music, custom prompts).',
    cat: 'adv', group: 'media',
  },
  amd:       {
    bg: 'from-blue-500 to-sky-600', border: '#3b82f6',
    accent: 'text-blue-400', accentBg: 'bg-blue-500/10',
    icon: Cpu, label: 'AMD',
    desc: 'Detect answering machine',
    longDesc: 'Answering Machine Detection. Branches on human vs machine pickup.',
    cat: 'adv', group: 'input',
  },
  callback:  {
    bg: 'from-emerald-500 to-lime-600', border: '#10b981',
    accent: 'text-emerald-400', accentBg: 'bg-emerald-500/10',
    icon: PhoneForwarded, label: 'Callback',
    desc: 'Offer a callback',
    longDesc: 'Offer the caller a callback when an agent is available, so they can hang up.',
    cat: 'adv', group: 'start',
  },
  voicemail: {
    bg: 'from-amber-500 to-orange-600', border: '#f59e0b',
    accent: 'text-amber-400', accentBg: 'bg-amber-500/10',
    icon: Voicemail, label: 'Voicemail',
    desc: 'Leave a voicemail',
    longDesc: 'Plays a prompt then records the caller’s voicemail message.',
    cat: 'adv', group: 'route',
  },
  whisper:   {
    bg: 'from-purple-500 to-fuchsia-600', border: '#a855f7',
    accent: 'text-purple-400', accentBg: 'bg-purple-500/10',
    icon: MessageSquare, label: 'Whisper to Agent',
    desc: 'Whisper message to agent',
    longDesc: 'Plays a private message to the agent only, before bridging the caller.',
    cat: 'adv', group: 'branch',
  },
};

export function isNodeValid(data: any): boolean {
  switch (data.type) {
    case 'speak':     return !!(data.text && data.text.trim());
    case 'gather':    return !!(data.validDigits && data.validDigits.trim());
    case 'enqueue':   return !!(data.queueName && data.queueName.trim());
    case 'transfer':  return !!(data.target && data.target.trim());
    case 'play':      return !!(data.audioUrl && data.audioUrl.trim());
    case 'whisper':   return !!(data.message || data.text);
    default:          return true;
  }
}

/** Returns a human-readable reason a node is invalid, or null if valid. */
export function nodeInvalidReason(data: any): string | null {
  switch (data.type) {
    case 'speak':    return (data.text && data.text.trim()) ? null : 'Missing message text';
    case 'gather':   return (data.validDigits && data.validDigits.trim()) ? null : 'Missing valid digits (e.g. "12")';
    case 'enqueue':  return (data.queueName && data.queueName.trim()) ? null : 'Missing queue name';
    case 'transfer': return (data.target && data.target.trim()) ? null : 'Missing transfer destination';
    case 'play':     return (data.audioUrl && data.audioUrl.trim()) ? null : 'Missing audio URL';
    case 'whisper':  return (data.message || data.text) ? null : 'Missing whisper message';
    default:         return null;
  }
}

export function getDefaultData(type: string): Record<string, any> {
  switch (type) {
    case 'answer':    return {};
    case 'speak':     return { text: 'Hello, how can I help you?', voice: 'female', language: 'en-AU' };
    case 'gather':    return { maxDigits: 1, timeout: 10000, validDigits: '12' };
    case 'enqueue':   return { queueName: 'default_queue' };
    case 'transfer':  return { target: '' };
    case 'record':    return { format: 'mp3' };
    case 'hangup':    return {};
    case 'play':      return { audioUrl: '' };
    case 'amd':       return { detection_mode: 'detect' };
    case 'callback':  return { message: 'Press 1 to receive a callback when an agent is available.' };
    case 'voicemail': return { message: 'Please leave your message after the tone.' };
    case 'whisper':   return { message: '' };
    default:          return {};
  }
}

export const TEMPLATES = [
  {
    name: 'Simple Menu', desc: '2-option IVR menu', icon: Layout,
    nodes: [
      { id: 't1', type: 'answer', data: {}, position: { x: 250, y: 0 } },
      { id: 't2', type: 'speak', data: { text: 'Welcome! Press 1 for sales, 2 for support.', voice: 'female', language: 'en-AU' }, position: { x: 250, y: 150 } },
      { id: 't3', type: 'gather', data: { maxDigits: 1, timeout: 10000, validDigits: '12' }, position: { x: 250, y: 300 } },
      { id: 't4', type: 'enqueue', data: { queueName: 'sales_queue' }, position: { x: 80, y: 470 } },
      { id: 't5', type: 'enqueue', data: { queueName: 'support_queue' }, position: { x: 420, y: 470 } },
    ],
    edges: [
      { id: 'te1', source: 't1', target: 't2' },
      { id: 'te2', source: 't2', target: 't3' },
      { id: 'te3', source: 't3', target: 't4', sourceHandle: '1', label: 'Press 1 → Sales' },
      { id: 'te4', source: 't3', target: 't5', sourceHandle: '2', label: 'Press 2 → Support' },
    ],
  },
  {
    name: 'After Hours', desc: 'Greeting + voicemail', icon: Voicemail,
    nodes: [
      { id: 't1', type: 'answer', data: {}, position: { x: 250, y: 0 } },
      { id: 't2', type: 'speak', data: { text: 'We are currently closed. Please leave a message after the tone.', voice: 'female', language: 'en-AU' }, position: { x: 250, y: 150 } },
      { id: 't3', type: 'voicemail', data: { message: 'Please leave your message now.' }, position: { x: 250, y: 300 } },
    ],
    edges: [
      { id: 'te1', source: 't1', target: 't2' },
      { id: 'te2', source: 't2', target: 't3' },
    ],
  },
  {
    name: 'Direct Queue', desc: 'Straight to agents', icon: Users,
    nodes: [
      { id: 't1', type: 'answer', data: {}, position: { x: 250, y: 0 } },
      { id: 't2', type: 'speak', data: { text: 'Please hold while we connect you.', voice: 'female', language: 'en-AU' }, position: { x: 250, y: 150 } },
      { id: 't3', type: 'enqueue', data: { queueName: 'default_queue' }, position: { x: 250, y: 300 } },
    ],
    edges: [
      { id: 'te1', source: 't1', target: 't2' },
      { id: 'te2', source: 't2', target: 't3' },
    ],
  },
];
