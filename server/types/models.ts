import { CreationOptional } from 'sequelize';

// ── User ──────────────────────────────────────────────────────────────────
export interface UserAttributes {
  id: CreationOptional<string>;
  username: string;
  password: string;
  displayName: string;
  role: 'admin' | 'agent' | 'supervisor';
  telnyxApiKeyEncrypted?: string | null;
  telnyxAppConnectionIdEncrypted?: string | null;
  sipUsernameEncrypted?: string | null;
  sipPasswordEncrypted?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

// ── Agent ──────────────────────────────────────────────────────────────────
export interface AgentAttributes {
  id: CreationOptional<string>;
  userId: string;
  priority: number;
  status: 'online' | 'away' | 'busy' | 'break' | 'dnd' | 'offline' | 'wrap_up';
  queues: string[];
  sipUsername?: string | null;
  activeCallId?: string | null;
  skills: Array<{ name: string; level: number }>;
  extension?: string | null;
  wrapUpUntil?: Date | null;
  totalCallsHandled: number;
  lastCallEndedAt?: Date | null;
  active: boolean;
  presence: 'online' | 'available' | 'busy' | 'away' | 'offline';
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Call ───────────────────────────────────────────────────────────────────
export interface CallAttributes {
  id: CreationOptional<string>;
  callControlId: string;
  callSessionId?: string | null;
  direction: 'inbound' | 'outbound';
  from?: string | null;
  to?: string | null;
  status: 'ringing' | 'queued' | 'active' | 'on_hold' | 'transferring' | 'ended';
  agentId?: string | null;
  queueName?: string | null;
  queueId?: string | null;
  ivrFlowId?: string | null;
  callerName?: string | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  recordingUrl?: string | null;
  parentCallId?: string | null;
  callPurpose: 'primary' | 'whisper' | 'transfer' | 'agent_answer' | 'monitor' | 'barge';
  dispositionId?: string | null;
  contactId?: string | null;
  tags: string[];
  notes?: string | null;
  amdResult?: string | null;
  transferType?: 'cold' | 'warm' | null;
  transferredToAgentId?: string | null;
  isInternal: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── CallRecord ─────────────────────────────────────────────────────────────
export interface CallRecordAttributes {
  id: CreationOptional<string>;
  callId?: string | null;
  agentId?: string | null;
  direction: 'inbound' | 'outbound';
  from?: string | null;
  to?: string | null;
  status?: string | null;
  queueName?: string | null;
  duration?: number | null;
  recordingUrl?: string | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  timeToAnswer?: number | null;
  answeredWithinSla?: boolean | null;
  caseNotesStatus: string;
  dispositionId?: string | null;
  contactId?: string | null;
  tags: string[];
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Transcript ─────────────────────────────────────────────────────────────
export interface TranscriptAttributes {
  id: CreationOptional<string>;
  callId: string;
  fullText?: string | null;
  segments: TranscriptSegment[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  start?: number;
  end?: number;
  is_final?: boolean;
}

// ── CaseNote ───────────────────────────────────────────────────────────────
export interface CaseNoteAttributes {
  id: CreationOptional<string>;
  callId: string;
  callerName?: string | null;
  summary?: string | null;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  rawLlmOutput?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Task ───────────────────────────────────────────────────────────────────
export interface TaskAttributes {
  id: CreationOptional<string>;
  caseNoteId: string;
  callId: string;
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  due?: Date | null;
  completed: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── IvrFlow ────────────────────────────────────────────────────────────────
export interface IvrFlowAttributes {
  id: CreationOptional<string>;
  name: string;
  description?: string | null;
  nodes: any[];
  edges: any[];
  published: boolean;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── NumberAssignment ───────────────────────────────────────────────────────
export interface NumberAssignmentAttributes {
  id: CreationOptional<string>;
  phoneNumber: string;
  ivrFlowId?: string | null;
  connectionId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Queue ───────────────────────────────────────────────────────────────────
export interface QueueAttributes {
  id: CreationOptional<string>;
  name: string;
  displayName?: string | null;
  strategy: 'round-robin' | 'least-recent' | 'most-idle' | 'skills-weighted' | 'priority';
  maxWaitSeconds: number;
  wrapUpSeconds: number;
  slaTargetSeconds: number;
  slaThresholdPct: number;
  priority: number;
  active: boolean;
  musicOnHoldUrl?: string | null;
  maxQueueSize: number;
  overflowAction: 'voicemail' | 'callback' | 'hangup' | 'transfer';
  overflowTarget?: string | null;
  requiredSkills: any[];
  metadata: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Disposition ────────────────────────────────────────────────────────────
export interface DispositionAttributes {
  id: CreationOptional<string>;
  name: string;
  category?: string | null;
  color: string;
  icon: string;
  requireNotes: boolean;
  active: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Contact ────────────────────────────────────────────────────────────────
export interface ContactAttributes {
  id: CreationOptional<string>;
  phoneNumber: string;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  tags: string[];
  notes?: string | null;
  metadata: Record<string, any>;
  totalCalls: number;
  lastCallAt?: Date | null;
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Conversation ───────────────────────────────────────────────────────────
export interface ConversationAttributes {
  id: CreationOptional<string>;
  channel: 'voice' | 'webchat' | 'sms' | 'email' | 'internal';
  status: 'waiting' | 'active' | 'closed';
  agentId?: string | null;
  contactId?: string | null;
  queueName?: string | null;
  visitorName: string;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  subject?: string | null;
  metadata: Record<string, any>;
  startedAt: Date;
  endedAt?: Date | null;
  lastMessageAt?: Date | null;
  messageCount: number;
  satisfaction?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Message ────────────────────────────────────────────────────────────────
export interface MessageAttributes {
  id: CreationOptional<string>;
  conversationId: string;
  sender: 'visitor' | 'agent' | 'system';
  senderName?: string | null;
  content: string;
  contentType: 'text' | 'html' | 'file' | 'image';
  metadata: Record<string, any>;
  externalId?: string | null;
  status?: string | null;
  readAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── CannedResponse ─────────────────────────────────────────────────────────
export interface CannedResponseAttributes {
  id: CreationOptional<string>;
  shortcut: string;
  title: string;
  content: string;
  category?: string | null;
  tags: string[];
  usageCount: number;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Callback ───────────────────────────────────────────────────────────────
export interface CallbackAttributes {
  id: CreationOptional<string>;
  phoneNumber: string;
  callerName?: string | null;
  queueName?: string | null;
  requestedAt: Date;
  scheduledFor?: Date | null;
  status: 'pending' | 'calling' | 'completed' | 'failed' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date | null;
  completedAt?: Date | null;
  agentId?: string | null;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── ConversationParticipant ────────────────────────────────────────────────
export interface ConversationParticipantAttributes {
  id: CreationOptional<string>;
  conversationId: string;
  agentId: string;
  lastReadAt: Date;
  unreadCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── CallAnalysis ───────────────────────────────────────────────────────────
export interface CallAnalysisAttributes {
  id: CreationOptional<string>;
  callRecordId?: string | null;
  agentId: string;
  audioUrl?: string | null;
  status: 'pending' | 'transcribing' | 'analyzing' | 'complete' | 'failed';
  transcriptText?: string | null;
  durationSeconds?: number | null;
  talkToListenRatio?: number | null;
  agentTalkPercent?: number | null;
  customerTalkPercent?: number | null;
  silencePercent?: number | null;
  interruptionCount: number;
  questionCount: number;
  fillerWordCount: number;
  sentimentOverall?: 'positive' | 'neutral' | 'negative' | null;
  sentimentTrajectory: any[];
  overallScore?: number | null;
  scoreBreakdown: Record<string, any>;
  keyMoments: any[];
  objections: any[];
  coachingTips: any[];
  summary?: string | null;
  keywords: string[];
  competitorMentions: string[];
  scriptAdherenceScore?: number | null;
  closingAttempted: boolean;
  closingSuccessful: boolean;
  nextSteps: any[];
  rawLlmOutput?: Record<string, any> | null;
  analyzedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── AgentScorecard ─────────────────────────────────────────────────────────
export interface AgentScorecardAttributes {
  id: CreationOptional<string>;
  agentId: string;
  period: 'daily' | 'weekly' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  totalCalls: number;
  totalMinutes: number;
  avgScore?: number | null;
  scoreBreakdown: Record<string, any>;
  avgTalkToListenRatio?: number | null;
  avgSilencePercent?: number | null;
  avgInterruptionRate?: number | null;
  avgQuestionRate?: number | null;
  topStrengths: any[];
  topWeaknesses: any[];
  coachingSummary?: string | null;
  trend: 'improving' | 'declining' | 'stable';
  rank?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── TalkTrack ──────────────────────────────────────────────────────────────
export interface TalkTrackAttributes {
  id: CreationOptional<string>;
  name: string;
  description?: string | null;
  category: 'Opening' | 'Objection Handling' | 'Closing' | 'Compliance' | 'Escalation';
  script?: string | null;
  tips?: string | null;
  steps: any[];
  usageCount: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Workflow ────────────────────────────────────────────────────────────────
export interface WorkflowAttributes {
  id: CreationOptional<string>;
  name: string;
  description: string;
  trigger: Record<string, any>;
  actions: WorkflowAction[];
  enabled: boolean;
  lastRunAt?: Date | null;
  runCount: number;
  createdBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WorkflowAction {
  type: 'send_sms' | 'send_email' | 'tag_call' | 'assign_agent' | 'set_disposition' |
        'escalate' | 'trigger_webhook' | 'create_task' | 'notify_team' | 'update_contact' | 'submit_form';
  config: Record<string, any>;
}

// ── WorkflowExecution ──────────────────────────────────────────────────────
export interface WorkflowExecutionAttributes {
  id: CreationOptional<string>;
  workflowId: string;
  triggerEvent: string;
  context: Record<string, any>;
  results: any[];
  status: 'success' | 'partial' | 'failed';
  executedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── CoachingScorecard ──────────────────────────────────────────────────────
export interface CoachingScorecardAttributes {
  id: CreationOptional<string>;
  agentId: string;
  reviewerId: string;
  callId?: string | null;
  categoryScores: Record<string, number>;
  categoryNotes: Record<string, string>;
  overallScore: number;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── QueueEntry ─────────────────────────────────────────────────────────────
export interface QueueEntryAttributes {
  id: CreationOptional<string>;
  queueName: string;
  callId?: string | null;
  callSessionId?: string | null;
  callerNumber?: string | null;
  callerName?: string | null;
  enqueuedAt: Date;
  priority: number;
  status: 'waiting' | 'routing' | 'answered' | 'abandoned' | 'timed_out';
  assignedAgentId?: string | null;
  answeredAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── AgentSession ───────────────────────────────────────────────────────────
export interface AgentSessionAttributes {
  id: CreationOptional<string>;
  agentId: string;
  status: 'offline' | 'available' | 'busy' | 'wrap_up' | 'break' | 'lunch';
  currentCallId?: string | null;
  statusChangedAt: Date;
  lastHeartbeat: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── UploadRecord ───────────────────────────────────────────────────────────
export interface UploadRecordAttributes {
  id: CreationOptional<string>;
  originalName: string;
  storedPath: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  category: 'image' | 'audio' | 'pdf' | 'file';
  uploadedBy?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── Form ───────────────────────────────────────────────────────────────────
export interface FormAttributes {
  id: CreationOptional<string>;
  name: string;
  description?: string | null;
  schema: FormSchema;
  variables: Record<string, any>;
  enabled: boolean;
  version: number;
  category: string;
  tags: any[];
  settings: FormSettings;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FormSchema {
  version: number;
  pages: FormPage[];
  actions?: FormAction[];
}

export interface FormPage {
  id: string;
  title: string;
  sections: FormSection[];
}

export interface FormSection {
  id: string;
  type: string;
  title: string;
  props: Record<string, any>;
  fields: FormField[];
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  variable: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: any[];
  validation?: FieldValidation;
  props: Record<string, any>;
}

export interface FieldValidation {
  required?: boolean;
  requiredMessage?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  customRules?: CrossFieldRule[];
}

export interface CrossFieldRule {
  type: 'crossField';
  fieldVariable: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt';
  message: string;
}

export interface FormAction {
  id: string;
  label: string;
  type: 'submit' | 'workflow';
  variant?: string;
  workflowId?: string | null;
  workflowAction?: string | null;
}

export interface FormSettings {
  requireApproval?: boolean;
  approvalRoles?: string[];
  allowMultipleSubmissions?: boolean;
  notificationEmails?: string[];
  notificationWebhook?: string | null;
  submissionLimit?: number | null;
  schedule?: FormSchedule;
  publicLink?: FormPublicLink;
  multiLanguage?: FormMultiLanguage;
  calculatedFields?: CalculatedField[];
  repeatableSections?: string[];
}

export interface FormSchedule {
  enabled: boolean;
  startDate?: string | null;
  endDate?: string | null;
  timezone?: string;
}

export interface FormPublicLink {
  enabled: boolean;
  slug?: string;
  requireAuth?: boolean;
  allowedDomains?: string[];
}

export interface FormMultiLanguage {
  enabled: boolean;
  defaultLanguage: string;
  translations?: Record<string, Record<string, string>>;
}

export interface CalculatedField {
  variable: string;
  label?: string;
  formula: string;
  format: 'number' | 'currency' | 'percent' | 'text';
}

// ── FormSubmission ─────────────────────────────────────────────────────────
export interface FormSubmissionAttributes {
  id: CreationOptional<string>;
  formId: string;
  data: Record<string, any>;
  prefilledContext?: Record<string, any> | null;
  submittedBy?: string | null;
  workflowExecutionId?: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'changes_requested';
  version?: number | null;
  duration?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── FormVersion ────────────────────────────────────────────────────────────
export interface FormVersionAttributes {
  id: CreationOptional<string>;
  formId: string;
  version: number;
  schema: FormSchema;
  variables: Record<string, any>;
  changeNote?: string | null;
  createdBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── FormTemplate ───────────────────────────────────────────────────────────
export interface FormTemplateAttributes {
  id: CreationOptional<string>;
  name: string;
  description?: string | null;
  category: string;
  schema: FormSchema;
  variables: Record<string, any>;
  isBuiltIn: boolean;
  usageCount: number;
  icon?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ── FormApproval ───────────────────────────────────────────────────────────
export interface FormApprovalAttributes {
  id: CreationOptional<string>;
  formSubmissionId: string;
  formId: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  requestedBy: string;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  reviewedAt?: Date | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueBy?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
