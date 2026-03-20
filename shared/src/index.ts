// User types
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  role: 'agent' | 'supervisor' | 'admin';
  avatarUrl?: string;
  email?: string;
}

// Call types
export type CallState = 'idle' | 'ringing' | 'incoming' | 'active' | 'held' | 'hangup';
export type CallDirection = 'inbound' | 'outbound';

export interface QueueCall {
  uuid: string;
  direction: CallDirection;
  telnyxNumber: string;
  destinationNumber: string;
  queueName: string;
  acceptAgent?: string;
  transferAgent?: string;
  bridgeUuid?: string;
  queueUuid?: string;
  conferenceId?: string;
}

// Conversation types
export interface Conversation {
  id: string;
  conversationHash: string;
  fromNumber: string;
  toNumber: string;
  agentAssigned?: string;
  assigned: boolean;
  tag?: string;
  lastMessage?: string;
  channel: 'sms' | 'mms' | 'voice';
  status: 'unassigned' | 'open' | 'closed';
  lastMessageAt?: string;
}

export interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  type: string;
  telnyxNumber: string;
  destinationNumber: string;
  textBody: string;
  media?: string;
  tag?: string;
  conversationId: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'received';
  createdAt: string;
}

// Socket event types
export interface ServerToClientEvents {
  NEW_CALL: (payload: QueueCall) => void;
  CALL_DEQUEUED: (payload: { uuid: string }) => void;
  OutboundCCID: (payload: { callControlId: string }) => void;
  WebRTC_OutboundCCID: (payload: { callControlId: string }) => void;
  AGENT_STATUS_CHANGED: (payload: { username: string; status: string }) => void;
  NEW_MESSAGE: (message: Message) => void;
  NEW_CONVERSATION: (conversation: Conversation) => void;
  CONVERSATION_ASSIGNED: (payload: { conversationId: string; agent: string }) => void;
}

export interface ClientToServerEvents {
  join: (room: string) => void;
  leave: (room: string) => void;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
