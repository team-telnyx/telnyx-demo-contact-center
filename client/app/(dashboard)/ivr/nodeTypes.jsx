'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';

const COLORS = {
  trigger: { bg: 'bg-telnyx-green', border: 'border-telnyx-green', text: 'text-white' },
  action: { bg: 'bg-blue-600', border: 'border-blue-500', text: 'text-white' },
  media: { bg: 'bg-purple-600', border: 'border-purple-500', text: 'text-white' },
  routing: { bg: 'bg-amber-600', border: 'border-amber-500', text: 'text-white' },
  conference: { bg: 'bg-pink-600', border: 'border-pink-500', text: 'text-white' },
  recording: { bg: 'bg-rose-600', border: 'border-rose-500', text: 'text-white' },
  streaming: { bg: 'bg-cyan-600', border: 'border-cyan-500', text: 'text-white' },
  ai: { bg: 'bg-indigo-600', border: 'border-indigo-500', text: 'text-white' },
  end: { bg: 'bg-red-600', border: 'border-red-500', text: 'text-white' },
};

function BaseNode({ data, category, hasInput = true, hasOutput = true, children }) {
  const c = COLORS[category] || COLORS.action;
  return (
    <div className={`rounded-card border-2 ${c.border} bg-white shadow-lg min-w-[200px] max-w-[260px]`}>
      {hasInput && <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />}
      <div className={`${c.bg} ${c.text} rounded-t-[14px] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider`}>
        {data.label}
      </div>
      <div className="px-3 py-2 space-y-1 text-[11px] text-gray-700">{children}</div>
      {hasOutput && <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-3" />}
    </div>
  );
}

function F({ label, value }) {
  return (
    <div className="flex justify-between gap-1">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="font-mono text-gray-800 truncate text-right">{value || '—'}</span>
    </div>
  );
}

function TextPreview({ text }) {
  if (!text) return null;
  return <div className="mt-1 rounded bg-gray-50 p-1 text-[10px] text-gray-500 italic truncate">"{text}"</div>;
}

// ========================= NODE COMPONENTS =========================

const IncomingCallNode = memo(({ data }) => (
  <BaseNode data={data} category="trigger" hasInput={false}>
    <F label="Event" value="call.initiated" />
    <F label="Direction" value={data.direction || 'incoming'} />
  </BaseNode>
));
IncomingCallNode.displayName = 'IncomingCallNode';

const AnswerNode = memo(({ data }) => (
  <BaseNode data={data} category="action"><F label="Action" value="answer" /></BaseNode>
));
AnswerNode.displayName = 'AnswerNode';

const RejectNode = memo(({ data }) => (
  <BaseNode data={data} category="end" hasOutput={false}>
    <F label="Action" value="reject" />
    <F label="Cause" value={data.cause || 'CALL_REJECTED'} />
  </BaseNode>
));
RejectNode.displayName = 'RejectNode';

const HangupNode = memo(({ data }) => (
  <BaseNode data={data} category="end" hasOutput={false}><F label="Action" value="hangup" /></BaseNode>
));
HangupNode.displayName = 'HangupNode';

const SpeakNode = memo(({ data }) => (
  <BaseNode data={data} category="media">
    <F label="Voice" value={data.voice || 'female'} />
    <F label="Language" value={data.language || 'en-US'} />
    <TextPreview text={data.payload} />
  </BaseNode>
));
SpeakNode.displayName = 'SpeakNode';

const PlayAudioNode = memo(({ data }) => (
  <BaseNode data={data} category="media">
    <F label="Action" value="playback_start" />
    <F label="URL" value={data.audioUrl || 'audio.mp3'} />
    <F label="Loop" value={data.loop || 'single'} />
    <F label="Overlay" value={data.overlay ? 'yes' : 'no'} />
  </BaseNode>
));
PlayAudioNode.displayName = 'PlayAudioNode';

const PlaybackStopNode = memo(({ data }) => (
  <BaseNode data={data} category="media"><F label="Action" value="playback_stop" /></BaseNode>
));
PlaybackStopNode.displayName = 'PlaybackStopNode';

const GatherNode = memo(({ data }) => {
  const outputs = (data.digits || '1,2,3').split(',').map((d) => d.trim());
  return (
    <div className="rounded-card border-2 border-amber-500 bg-white shadow-lg min-w-[200px] max-w-[260px]">
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />
      <div className="bg-amber-600 text-white rounded-t-[14px] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">{data.label}</div>
      <div className="px-3 py-2 space-y-1 text-[11px] text-gray-700">
        <F label="Method" value={data.method || 'speak'} />
        <F label="Max Digits" value={data.maxDigits || '1'} />
        <F label="Timeout" value={`${data.timeout || 10}s`} />
        <TextPreview text={data.payload} />
      </div>
      {outputs.map((digit, i) => (
        <Handle key={digit} type="source" position={Position.Bottom} id={`digit-${digit}`}
          className="!bg-amber-500 !w-3 !h-3"
          style={{ left: `${((i + 1) / (outputs.length + 1)) * 100}%` }} />
      ))}
      <div className="flex justify-around px-2 pb-1.5 text-[9px] text-gray-400">
        {outputs.map((d) => <span key={d}>#{d}</span>)}
      </div>
    </div>
  );
});
GatherNode.displayName = 'GatherNode';

const GatherStopNode = memo(({ data }) => (
  <BaseNode data={data} category="routing"><F label="Action" value="gather_stop" /></BaseNode>
));
GatherStopNode.displayName = 'GatherStopNode';

const GatherAudioNode = memo(({ data }) => (
  <BaseNode data={data} category="routing">
    <F label="Action" value="gather_using_audio" />
    <F label="Audio URL" value={data.audioUrl || ''} />
    <F label="Max Digits" value={data.maxDigits || '1'} />
  </BaseNode>
));
GatherAudioNode.displayName = 'GatherAudioNode';

const GatherAINode = memo(({ data }) => (
  <BaseNode data={data} category="ai">
    <F label="Action" value="gather_using_ai" />
    <F label="Model" value={data.model || 'default'} />
    <TextPreview text={data.prompt} />
  </BaseNode>
));
GatherAINode.displayName = 'GatherAINode';

const TransferNode = memo(({ data }) => (
  <BaseNode data={data} category="action">
    <F label="Action" value="transfer" />
    <F label="To" value={data.to || ''} />
    <F label="From" value={data.from || 'caller_id'} />
  </BaseNode>
));
TransferNode.displayName = 'TransferNode';

const BridgeNode = memo(({ data }) => (
  <BaseNode data={data} category="action">
    <F label="Action" value="bridge" />
    <F label="Target CCID" value={data.callControlId || ''} />
    <F label="Park After" value={data.parkAfterUnbridge || 'self'} />
  </BaseNode>
));
BridgeNode.displayName = 'BridgeNode';

const EnqueueNode = memo(({ data }) => (
  <BaseNode data={data} category="routing">
    <F label="Action" value="enqueue" />
    <F label="Queue" value={data.queueName || 'General_Queue'} />
  </BaseNode>
));
EnqueueNode.displayName = 'EnqueueNode';

const LeaveQueueNode = memo(({ data }) => (
  <BaseNode data={data} category="routing"><F label="Action" value="leave_queue" /></BaseNode>
));
LeaveQueueNode.displayName = 'LeaveQueueNode';

const DialNode = memo(({ data }) => (
  <BaseNode data={data} category="action">
    <F label="Action" value="dial" />
    <F label="To" value={data.to || ''} />
    <F label="From" value={data.from || ''} />
    <F label="Connection" value={data.connectionId || 'default'} />
  </BaseNode>
));
DialNode.displayName = 'DialNode';

const RecordStartNode = memo(({ data }) => (
  <BaseNode data={data} category="recording">
    <F label="Action" value="record_start" />
    <F label="Format" value={data.format || 'mp3'} />
    <F label="Channels" value={data.channels || 'dual'} />
    <F label="Max Length" value={data.maxLength ? `${data.maxLength}s` : '—'} />
    <F label="Trim" value={data.trimSilence || 'false'} />
  </BaseNode>
));
RecordStartNode.displayName = 'RecordStartNode';

const RecordStopNode = memo(({ data }) => (
  <BaseNode data={data} category="recording"><F label="Action" value="record_stop" /></BaseNode>
));
RecordStopNode.displayName = 'RecordStopNode';

const RecordPauseNode = memo(({ data }) => (
  <BaseNode data={data} category="recording"><F label="Action" value="record_pause" /></BaseNode>
));
RecordPauseNode.displayName = 'RecordPauseNode';

const RecordResumeNode = memo(({ data }) => (
  <BaseNode data={data} category="recording"><F label="Action" value="record_resume" /></BaseNode>
));
RecordResumeNode.displayName = 'RecordResumeNode';

const ConferenceNode = memo(({ data }) => (
  <BaseNode data={data} category="conference">
    <F label="Action" value="create conference" />
    <F label="Name" value={data.conferenceName || 'conf-...'} />
    <F label="Beep" value={data.beepEnabled || 'always'} />
  </BaseNode>
));
ConferenceNode.displayName = 'ConferenceNode';

const HoldNode = memo(({ data }) => (
  <BaseNode data={data} category="action">
    <F label="Action" value={data.unhold ? 'unhold' : 'hold'} />
    <F label="Audio" value={data.audioUrl || 'default'} />
  </BaseNode>
));
HoldNode.displayName = 'HoldNode';

const SendDTMFNode = memo(({ data }) => (
  <BaseNode data={data} category="action">
    <F label="Action" value="send_dtmf" />
    <F label="Digits" value={data.digits || ''} />
    <F label="Duration" value={data.durationMs ? `${data.durationMs}ms` : '250ms'} />
  </BaseNode>
));
SendDTMFNode.displayName = 'SendDTMFNode';

const ReferNode = memo(({ data }) => (
  <BaseNode data={data} category="action">
    <F label="Action" value="SIP REFER" />
    <F label="SIP Address" value={data.sipAddress || ''} />
  </BaseNode>
));
ReferNode.displayName = 'ReferNode';

const StreamingStartNode = memo(({ data }) => (
  <BaseNode data={data} category="streaming">
    <F label="Action" value="streaming_start" />
    <F label="URL" value={data.streamUrl || 'wss://...'} />
    <F label="Track" value={data.streamTrack || 'both_tracks'} />
  </BaseNode>
));
StreamingStartNode.displayName = 'StreamingStartNode';

const StreamingStopNode = memo(({ data }) => (
  <BaseNode data={data} category="streaming"><F label="Action" value="streaming_stop" /></BaseNode>
));
StreamingStopNode.displayName = 'StreamingStopNode';

const TranscriptionStartNode = memo(({ data }) => (
  <BaseNode data={data} category="streaming">
    <F label="Action" value="transcription_start" />
    <F label="Language" value={data.language || 'en'} />
  </BaseNode>
));
TranscriptionStartNode.displayName = 'TranscriptionStartNode';

const TranscriptionStopNode = memo(({ data }) => (
  <BaseNode data={data} category="streaming"><F label="Action" value="transcription_stop" /></BaseNode>
));
TranscriptionStopNode.displayName = 'TranscriptionStopNode';

const ForkStartNode = memo(({ data }) => (
  <BaseNode data={data} category="streaming">
    <F label="Action" value="fork_start" />
    <F label="Target" value={data.target || 'udp://...'} />
    <F label="Type" value={data.streamType || 'raw'} />
  </BaseNode>
));
ForkStartNode.displayName = 'ForkStartNode';

const ForkStopNode = memo(({ data }) => (
  <BaseNode data={data} category="streaming"><F label="Action" value="fork_stop" /></BaseNode>
));
ForkStopNode.displayName = 'ForkStopNode';

const NoiseSuppressionStartNode = memo(({ data }) => (
  <BaseNode data={data} category="ai">
    <F label="Action" value="suppression_start" />
    <F label="Direction" value={data.direction || 'both'} />
  </BaseNode>
));
NoiseSuppressionStartNode.displayName = 'NoiseSuppressionStartNode';

const NoiseSuppressionStopNode = memo(({ data }) => (
  <BaseNode data={data} category="ai"><F label="Action" value="suppression_stop" /></BaseNode>
));
NoiseSuppressionStopNode.displayName = 'NoiseSuppressionStopNode';

const AIAssistantStartNode = memo(({ data }) => (
  <BaseNode data={data} category="ai">
    <F label="Action" value="ai_assistant_start" />
    <F label="Model" value={data.model || ''} />
    <TextPreview text={data.systemPrompt} />
  </BaseNode>
));
AIAssistantStartNode.displayName = 'AIAssistantStartNode';

const AIAssistantStopNode = memo(({ data }) => (
  <BaseNode data={data} category="ai"><F label="Action" value="ai_assistant_stop" /></BaseNode>
));
AIAssistantStopNode.displayName = 'AIAssistantStopNode';

const ClientStateUpdateNode = memo(({ data }) => (
  <BaseNode data={data} category="action">
    <F label="Action" value="client_state_update" />
    <F label="State" value={data.clientState || ''} />
  </BaseNode>
));
ClientStateUpdateNode.displayName = 'ClientStateUpdateNode';

const SendSipInfoNode = memo(({ data }) => (
  <BaseNode data={data} category="action">
    <F label="Action" value="send_sip_info" />
    <F label="Content-Type" value={data.sipInfoType || ''} />
    <F label="Body" value={data.sipInfoBody || ''} />
  </BaseNode>
));
SendSipInfoNode.displayName = 'SendSipInfoNode';

const SiprecStartNode = memo(({ data }) => (
  <BaseNode data={data} category="recording"><F label="Action" value="siprec_start" /></BaseNode>
));
SiprecStartNode.displayName = 'SiprecStartNode';

const SiprecStopNode = memo(({ data }) => (
  <BaseNode data={data} category="recording"><F label="Action" value="siprec_stop" /></BaseNode>
));
SiprecStopNode.displayName = 'SiprecStopNode';

// ========================= EXPORT MAP =========================

export const nodeTypes = {
  incomingCall: IncomingCallNode,
  answer: AnswerNode,
  reject: RejectNode,
  hangup: HangupNode,
  speak: SpeakNode,
  playAudio: PlayAudioNode,
  playbackStop: PlaybackStopNode,
  gather: GatherNode,
  gatherStop: GatherStopNode,
  gatherAudio: GatherAudioNode,
  gatherAI: GatherAINode,
  transfer: TransferNode,
  bridge: BridgeNode,
  enqueue: EnqueueNode,
  leaveQueue: LeaveQueueNode,
  dial: DialNode,
  recordStart: RecordStartNode,
  recordStop: RecordStopNode,
  recordPause: RecordPauseNode,
  recordResume: RecordResumeNode,
  conference: ConferenceNode,
  hold: HoldNode,
  sendDTMF: SendDTMFNode,
  refer: ReferNode,
  streamingStart: StreamingStartNode,
  streamingStop: StreamingStopNode,
  transcriptionStart: TranscriptionStartNode,
  transcriptionStop: TranscriptionStopNode,
  forkStart: ForkStartNode,
  forkStop: ForkStopNode,
  noiseSuppressionStart: NoiseSuppressionStartNode,
  noiseSuppressionStop: NoiseSuppressionStopNode,
  aiAssistantStart: AIAssistantStartNode,
  aiAssistantStop: AIAssistantStopNode,
  clientStateUpdate: ClientStateUpdateNode,
  sendSipInfo: SendSipInfoNode,
  siprecStart: SiprecStartNode,
  siprecStop: SiprecStopNode,
};

// ========================= NODE PALETTE =========================

export const NODE_PALETTE = [
  // Trigger
  { type: 'incomingCall', label: 'Incoming Call', category: 'trigger', defaults: { label: 'Incoming Call', direction: 'incoming' } },

  // Core Call Control
  { type: 'answer', label: 'Answer', category: 'action', defaults: { label: 'Answer' } },
  { type: 'reject', label: 'Reject', category: 'end', defaults: { label: 'Reject', cause: 'CALL_REJECTED' } },
  { type: 'hangup', label: 'Hang Up', category: 'end', defaults: { label: 'Hang Up' } },
  { type: 'transfer', label: 'Transfer', category: 'action', defaults: { label: 'Transfer', to: '', from: '' } },
  { type: 'bridge', label: 'Bridge', category: 'action', defaults: { label: 'Bridge', callControlId: '', parkAfterUnbridge: 'self' } },
  { type: 'dial', label: 'Dial', category: 'action', defaults: { label: 'Dial', to: '', from: '', connectionId: '' } },
  { type: 'hold', label: 'Hold / Unhold', category: 'action', defaults: { label: 'Hold', unhold: false, audioUrl: '' } },
  { type: 'sendDTMF', label: 'Send DTMF', category: 'action', defaults: { label: 'Send DTMF', digits: '', durationMs: 250 } },
  { type: 'refer', label: 'SIP Refer', category: 'action', defaults: { label: 'SIP Refer', sipAddress: '' } },
  { type: 'clientStateUpdate', label: 'Client State', category: 'action', defaults: { label: 'Client State', clientState: '' } },
  { type: 'sendSipInfo', label: 'Send SIP Info', category: 'action', defaults: { label: 'Send SIP Info', sipInfoType: '', sipInfoBody: '' } },

  // Media
  { type: 'speak', label: 'Speak (TTS)', category: 'media', defaults: { label: 'Speak', payload: 'Hello, welcome.', voice: 'female', language: 'en-US' } },
  { type: 'playAudio', label: 'Play Audio', category: 'media', defaults: { label: 'Play Audio', audioUrl: '', loop: 'single', overlay: false } },
  { type: 'playbackStop', label: 'Stop Playback', category: 'media', defaults: { label: 'Stop Playback' } },

  // Gather / DTMF Routing
  { type: 'gather', label: 'Gather (Speak)', category: 'routing', defaults: { label: 'Gather DTMF', method: 'speak', payload: 'Press 1 for sales, 2 for support.', maxDigits: '1', timeout: 10, digits: '1,2', voice: 'female', language: 'en-US' } },
  { type: 'gatherAudio', label: 'Gather (Audio)', category: 'routing', defaults: { label: 'Gather Audio', audioUrl: '', maxDigits: '1', timeout: 10 } },
  { type: 'gatherAI', label: 'Gather (AI)', category: 'ai', defaults: { label: 'Gather AI', model: '', prompt: '' } },
  { type: 'gatherStop', label: 'Gather Stop', category: 'routing', defaults: { label: 'Gather Stop' } },

  // Queue
  { type: 'enqueue', label: 'Enqueue', category: 'routing', defaults: { label: 'Enqueue', queueName: 'General_Queue' } },
  { type: 'leaveQueue', label: 'Leave Queue', category: 'routing', defaults: { label: 'Leave Queue' } },

  // Recording
  { type: 'recordStart', label: 'Record Start', category: 'recording', defaults: { label: 'Record Start', format: 'mp3', channels: 'dual', maxLength: 0, trimSilence: 'false' } },
  { type: 'recordStop', label: 'Record Stop', category: 'recording', defaults: { label: 'Record Stop' } },
  { type: 'recordPause', label: 'Record Pause', category: 'recording', defaults: { label: 'Record Pause' } },
  { type: 'recordResume', label: 'Record Resume', category: 'recording', defaults: { label: 'Record Resume' } },
  { type: 'siprecStart', label: 'SIPREC Start', category: 'recording', defaults: { label: 'SIPREC Start' } },
  { type: 'siprecStop', label: 'SIPREC Stop', category: 'recording', defaults: { label: 'SIPREC Stop' } },

  // Streaming / Transcription / Fork
  { type: 'streamingStart', label: 'Stream Start', category: 'streaming', defaults: { label: 'Stream Start', streamUrl: '', streamTrack: 'both_tracks' } },
  { type: 'streamingStop', label: 'Stream Stop', category: 'streaming', defaults: { label: 'Stream Stop' } },
  { type: 'transcriptionStart', label: 'Transcribe Start', category: 'streaming', defaults: { label: 'Transcribe Start', language: 'en' } },
  { type: 'transcriptionStop', label: 'Transcribe Stop', category: 'streaming', defaults: { label: 'Transcribe Stop' } },
  { type: 'forkStart', label: 'Fork Start', category: 'streaming', defaults: { label: 'Fork Start', target: '', streamType: 'raw' } },
  { type: 'forkStop', label: 'Fork Stop', category: 'streaming', defaults: { label: 'Fork Stop' } },

  // AI
  { type: 'noiseSuppressionStart', label: 'Noise Suppression', category: 'ai', defaults: { label: 'Noise Suppression', direction: 'both' } },
  { type: 'noiseSuppressionStop', label: 'Noise Supp. Stop', category: 'ai', defaults: { label: 'Noise Supp. Stop' } },
  { type: 'aiAssistantStart', label: 'AI Assistant Start', category: 'ai', defaults: { label: 'AI Assistant', model: '', systemPrompt: '' } },
  { type: 'aiAssistantStop', label: 'AI Assistant Stop', category: 'ai', defaults: { label: 'AI Assistant Stop' } },

  // Conference
  { type: 'conference', label: 'Conference', category: 'conference', defaults: { label: 'Conference', conferenceName: '', beepEnabled: 'always' } },
];

// ========================= DEFAULT FLOW (matching original contact center behavior) =========================

export const DEFAULT_FLOW = {
  nodes: [
    { id: '1', type: 'incomingCall', position: { x: 350, y: 0 }, data: { label: 'Incoming Call', direction: 'incoming' } },
    { id: '2', type: 'answer', position: { x: 350, y: 100 }, data: { label: 'Answer' } },
    { id: '3', type: 'speak', position: { x: 350, y: 200 }, data: { label: 'Welcome', payload: 'Thank you for calling. Please hold while we connect you with an agent.', voice: 'female', language: 'en-US' } },
    { id: '4', type: 'enqueue', position: { x: 350, y: 330 }, data: { label: 'Agent Queue', queueName: 'General_Queue' } },
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#00a37a' } },
    { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#2563eb' } },
    { id: 'e3-4', source: '3', target: '4', animated: true, style: { stroke: '#9333ea' } },
  ],
};
