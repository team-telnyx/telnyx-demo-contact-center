import type { Sequelize } from 'sequelize';
import { User } from './User.js';
import { Agent } from './Agent.js';
import { Call } from './Call.js';
import { CallRecord } from './CallRecord.js';
import { Transcript } from './Transcript.js';
import { CaseNote } from './CaseNote.js';
import { Task } from './Task.js';
import { IvrFlow } from './IvrFlow.js';
import { NumberAssignment } from './NumberAssignment.js';
import { Queue } from './Queue.js';
import { Disposition } from './Disposition.js';
import { Contact } from './Contact.js';
import { Conversation } from './Conversation.js';
import { Message } from './Message.js';
import { CannedResponse } from './CannedResponse.js';
import { Callback } from './Callback.js';
import { ConversationParticipant } from './ConversationParticipant.js';
import { CallAnalysis } from './CallAnalysis.js';
import { AgentScorecard } from './AgentScorecard.js';
import { TalkTrack } from './TalkTrack.js';
import { Workflow } from './Workflow.js';
import { WorkflowExecution } from './WorkflowExecution.js';
import { CoachingScorecard } from './CoachingScorecard.js';
import { QueueEntry } from './QueueEntry.js';
import { AgentSession } from './AgentSession.js';
import { UploadRecord } from './UploadRecord.js';
import Form from './Form.js';
import FormSubmission from './FormSubmission.js';
import FormVersion from './FormVersion.js';
import FormTemplate from './FormTemplate.js';
import FormApproval from './FormApproval.js';
import { SmsTemplate } from './SmsTemplate.js';
import { ScheduledSms } from './ScheduledSms.js';

export function initModels(sequelize: Sequelize) {
  const models = {
    User: User(sequelize),
    Agent: Agent(sequelize),
    Call: Call(sequelize),
    CallRecord: CallRecord(sequelize),
    Transcript: Transcript(sequelize),
    CaseNote: CaseNote(sequelize),
    Task: Task(sequelize),
    IvrFlow: IvrFlow(sequelize),
    NumberAssignment: NumberAssignment(sequelize),
    Queue: Queue(sequelize),
    Disposition: Disposition(sequelize),
    Contact: Contact(sequelize),
    Conversation: Conversation(sequelize),
    Message: Message(sequelize),
    CannedResponse: CannedResponse(sequelize),
    Callback: Callback(sequelize),
    ConversationParticipant: ConversationParticipant(sequelize),
    CallAnalysis: CallAnalysis(sequelize),
    AgentScorecard: AgentScorecard(sequelize),
    TalkTrack: TalkTrack(sequelize),
    Workflow: Workflow(sequelize),
    WorkflowExecution: WorkflowExecution(sequelize),
    CoachingScorecard: CoachingScorecard(sequelize),
    QueueEntry: QueueEntry(sequelize),
    AgentSession: AgentSession(sequelize),
    UploadRecord: UploadRecord(sequelize),
    Form: Form(sequelize),
    FormSubmission: FormSubmission(sequelize),
    FormVersion: FormVersion(sequelize),
    FormTemplate: FormTemplate(sequelize),
    FormApproval: FormApproval(sequelize),
    SmsTemplate: SmsTemplate(sequelize),
    ScheduledSms: ScheduledSms(sequelize),
  };

  // ── Associations ──

  // User 1:1 Agent
  models.User.hasOne(models.Agent, { foreignKey: 'userId', as: 'agentProfile' });
  models.Agent.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });

  // Agent 1:N Calls
  models.Agent.hasMany(models.Call, { foreignKey: 'agentId', as: 'calls' });
  models.Call.belongsTo(models.Agent, { foreignKey: 'agentId', as: 'agent' });

  // Call 1:1 Transcript
  models.Call.hasOne(models.Transcript, { foreignKey: 'callId', as: 'transcript' });
  models.Transcript.belongsTo(models.Call, { foreignKey: 'callId', as: 'call' });

  // Call 1:1 CaseNote
  models.Call.hasOne(models.CaseNote, { foreignKey: 'callId', as: 'caseNote' });
  models.CaseNote.belongsTo(models.Call, { foreignKey: 'callId', as: 'call' });

  // CaseNote 1:N Tasks
  models.CaseNote.hasMany(models.Task, { foreignKey: 'caseNoteId', as: 'tasks' });
  models.Task.belongsTo(models.CaseNote, { foreignKey: 'caseNoteId', as: 'caseNote' });

  // Call self-reference for transfers/whisper
  models.Call.hasMany(models.Call, { foreignKey: 'parentCallId', as: 'childCalls' });

  // Call -> Agent (transferredToAgentId)
  models.Call.belongsTo(models.Agent, { foreignKey: 'transferredToAgentId', as: 'transferredToAgent' });

  // IvrFlow 1:N NumberAssignments
  models.IvrFlow.hasMany(models.NumberAssignment, { foreignKey: 'ivrFlowId', as: 'numbers' });
  models.NumberAssignment.belongsTo(models.IvrFlow, { foreignKey: 'ivrFlowId', as: 'ivrFlow' });

  // Call → IvrFlow
  models.IvrFlow.hasMany(models.Call, { foreignKey: 'ivrFlowId', as: 'calls' });
  models.Call.belongsTo(models.IvrFlow, { foreignKey: 'ivrFlowId', as: 'ivrFlow' });

  // CallRecord → Call (for history detail includes)
  models.CallRecord.belongsTo(models.Call, { foreignKey: 'callId', as: 'call' });
  models.Call.hasOne(models.CallRecord, { foreignKey: 'callId', as: 'callRecord' });

  // Conversation 1:N Message
  models.Conversation.hasMany(models.Message, { foreignKey: 'conversationId', as: 'messages' });
  models.Message.belongsTo(models.Conversation, { foreignKey: 'conversationId', as: 'conversation' });

  // Queue 1:N Call
  models.Queue.hasMany(models.Call, { foreignKey: 'queueId', as: 'calls' });
  models.Call.belongsTo(models.Queue, { foreignKey: 'queueId', as: 'queue' });

  // Disposition 1:N Call
  models.Disposition.hasMany(models.Call, { foreignKey: 'dispositionId', as: 'calls' });
  models.Call.belongsTo(models.Disposition, { foreignKey: 'dispositionId', as: 'disposition' });

  // Contact 1:N Call
  models.Contact.hasMany(models.Call, { foreignKey: 'contactId', as: 'calls' });
  models.Call.belongsTo(models.Contact, { foreignKey: 'contactId', as: 'contact' });

  // CallRecord → Disposition, Contact, Agent
  models.CallRecord.belongsTo(models.Disposition, { foreignKey: 'dispositionId', as: 'disposition' });
  models.CallRecord.belongsTo(models.Contact, { foreignKey: 'contactId', as: 'contact' });
  models.CallRecord.belongsTo(models.Agent, { foreignKey: 'agentId', as: 'agent', constraints: false });
  models.Agent.hasMany(models.CallRecord, { foreignKey: 'agentId', as: 'callRecords', constraints: false });

  // Agent 1:N Conversation
  models.Agent.hasMany(models.Conversation, { foreignKey: 'agentId', as: 'conversations' });
  models.Conversation.belongsTo(models.Agent, { foreignKey: 'agentId', as: 'agent' });

  // ConversationParticipant — many-to-many between Agent and Conversation (internal chat)
  models.Conversation.hasMany(models.ConversationParticipant, { foreignKey: 'conversationId', as: 'participants' });
  models.ConversationParticipant.belongsTo(models.Conversation, { foreignKey: 'conversationId', as: 'conversation' });
  models.Agent.hasMany(models.ConversationParticipant, { foreignKey: 'agentId', as: 'conversationParticipants' });
  models.ConversationParticipant.belongsTo(models.Agent, { foreignKey: 'agentId', as: 'agent' });

  // CallAnalysis → CallRecord, Agent
  models.CallAnalysis.belongsTo(models.CallRecord, { foreignKey: 'callRecordId', as: 'callRecord' });
  models.CallRecord.hasOne(models.CallAnalysis, { foreignKey: 'callRecordId', as: 'callAnalysis' });
  models.CallAnalysis.belongsTo(models.Agent, { foreignKey: 'agentId', as: 'agent' });
  models.Agent.hasMany(models.CallAnalysis, { foreignKey: 'agentId', as: 'callAnalyses' });

  // AgentScorecard → Agent
  models.AgentScorecard.belongsTo(models.Agent, { foreignKey: 'agentId', as: 'agent' });
  models.Agent.hasMany(models.AgentScorecard, { foreignKey: 'agentId', as: 'scorecards' });

  // CoachingScorecard → Agent, User (reviewer)
  models.CoachingScorecard.belongsTo(models.Agent, { foreignKey: 'agentId', as: 'agent' });
  models.Agent.hasMany(models.CoachingScorecard, { foreignKey: 'agentId', as: 'coachingScorecards' });
  models.CoachingScorecard.belongsTo(models.User, { foreignKey: 'reviewerId', as: 'reviewer' });
  models.User.hasMany(models.CoachingScorecard, { foreignKey: 'reviewerId', as: 'reviewedScorecards' });
  models.CoachingScorecard.belongsTo(models.Call, { foreignKey: 'callId', as: 'call' });
  models.Call.hasMany(models.CoachingScorecard, { foreignKey: 'callId', as: 'coachingScorecards' });

  // QueueEntry associations
  models.QueueEntry.belongsTo(models.Agent, { foreignKey: 'assignedAgentId', as: 'assignedAgent' });
  models.Agent.hasMany(models.QueueEntry, { foreignKey: 'assignedAgentId', as: 'queueEntries' });

  // AgentSession associations
  models.AgentSession.belongsTo(models.Agent, { foreignKey: 'agentId', as: 'agent' });
  models.Agent.hasOne(models.AgentSession, { foreignKey: 'agentId', as: 'session' });

  // UploadRecord associations
  models.UploadRecord.belongsTo(models.Agent, { foreignKey: 'uploadedBy', as: 'uploader' });
  models.Agent.hasMany(models.UploadRecord, { foreignKey: 'uploadedBy', as: 'uploads' });
  models.UploadRecord.belongsTo(models.Conversation, { foreignKey: 'conversationId', as: 'conversation' });
  models.Conversation.hasMany(models.UploadRecord, { foreignKey: 'conversationId', as: 'uploads' });
  models.UploadRecord.belongsTo(models.Message, { foreignKey: 'messageId', as: 'message' });
  models.Message.hasOne(models.UploadRecord, { foreignKey: 'messageId', as: 'uploadRecord' });

  // Workflow 1:N WorkflowExecution
  models.Workflow.hasMany(models.WorkflowExecution, { foreignKey: 'workflowId', as: 'executions' });
  models.WorkflowExecution.belongsTo(models.Workflow, { foreignKey: 'workflowId', as: 'workflow' });

  // Form 1:N FormSubmission
  models.Form.hasMany(models.FormSubmission, { foreignKey: 'formId', as: 'submissions' });
  models.FormSubmission.belongsTo(models.Form, { foreignKey: 'formId', as: 'form' });
  models.FormSubmission.belongsTo(models.User, { foreignKey: 'submittedBy', as: 'submitter' });

  // Form 1:N FormVersion
  models.Form.hasMany(models.FormVersion, { foreignKey: 'formId', as: 'versions' });
  models.FormVersion.belongsTo(models.Form, { foreignKey: 'formId', as: 'form' });

  // Form 1:N FormApproval
  models.Form.hasMany(models.FormApproval, { foreignKey: 'formId', as: 'approvals' });
  models.FormApproval.belongsTo(models.Form, { foreignKey: 'formId', as: 'form' });
  models.FormApproval.belongsTo(models.FormSubmission, { foreignKey: 'formSubmissionId', as: 'submission' });
  models.FormApproval.belongsTo(models.User, { foreignKey: 'requestedBy', as: 'requester' });
  models.FormApproval.belongsTo(models.User, { foreignKey: 'reviewedBy', as: 'reviewer' });

  // Callback associations
  models.Agent.hasMany(models.Callback, { foreignKey: 'agentId', as: 'callbacks' });
  models.Callback.belongsTo(models.Agent, { foreignKey: 'agentId', as: 'agent' });
  models.Call.hasOne(models.Callback, { foreignKey: 'callId', as: 'callback' });
  models.Callback.belongsTo(models.Call, { foreignKey: 'callId', as: 'call' });
  models.Call.hasMany(models.Callback, { foreignKey: 'originatingCallId', as: 'requestedCallbacks' });
  models.Callback.belongsTo(models.Call, { foreignKey: 'originatingCallId', as: 'originatingCall' });

  models.ScheduledSms.belongsTo(models.Conversation, { foreignKey: 'conversationId', as: 'conversation' });
  models.Conversation.hasMany(models.ScheduledSms, { foreignKey: 'conversationId', as: 'scheduledSms' });
  models.ScheduledSms.belongsTo(models.Agent, { foreignKey: 'agentId', as: 'agent' });
  models.Agent.hasMany(models.ScheduledSms, { foreignKey: 'agentId', as: 'scheduledSms' });

  (models as any).sequelize = sequelize;
  return models;
}
