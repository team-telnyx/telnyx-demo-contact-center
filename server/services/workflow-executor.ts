import logger from '../middleware/errorHandler.js';
import * as telnyxService from './telnyx.js';
import { getIO } from './socket.js';
import bus from './event-bus.js';

export async function executeWorkflowActions(actions: any[], context: any, models: any): Promise<any[]> {
  const results = [];
  for (const action of actions) {
    try {
      const result = await executeAction(action, context, models);
      results.push({ action: action.type, status: 'success', result });
    } catch (err: any) {
      logger.error({ err, action: action.type, workflowId: context.workflowId }, 'Workflow action failed');
      results.push({ action: action.type, status: 'error', error: err.message });
    }
  }
  return results;
}

async function executeAction(action: any, context: any, models: any): Promise<any> {
  const { type, config } = action;
  switch (type) {
    case 'send_sms': return executeSendSms(config, context, models);
    case 'send_email': return executeSendEmail(config, context, models);
    case 'tag_call': return executeTagCall(config, context, models);
    case 'assign_agent': return executeAssignAgent(config, context, models);
    case 'set_disposition': return executeSetDisposition(config, context, models);
    case 'escalate': return executeEscalate(config, context, models);
    case 'trigger_webhook': return executeTriggerWebhook(config, context, models);
    case 'create_task': return executeCreateTask(config, context, models);
    case 'notify_team': return executeNotifyTeam(config, context, models);
    case 'update_contact': return executeUpdateContact(config, context, models);
    case 'submit_form': return executeSubmitForm(config, context, models);
    default: logger.warn({ actionType: type }, 'Unknown workflow action type — skipping'); return { skipped: true, reason: `Unknown action type: ${type}` };
  }
}

function substituteTemplate(str: any, context: any): any {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{([^}]+)\}\}/g, (_: any, path: string) => {
    const keys = path.trim().split('.');
    let val = context;
    for (const k of keys) { val = val?.[k]; if (val == null) return ''; }
    return String(val);
  });
}

async function executeSendSms(config: any, context: any, models: any): Promise<any> {
  const env = (await import('../config/env.js')).loadEnv();
  const to = substituteTemplate(config.to, context);
  const message = substituteTemplate(config.message, context);
  const from = config.from || env.TELNYX_FROM_NUMBER || env.TELNYX_SIP_USERNAME;
  if (!to || !message) throw new Error('send_sms requires "to" and "message" config');
  const result = await telnyxService.sendSms(from, to, message) as any;
  logger.info({ to, from, messageLen: message.length }, 'Workflow: SMS sent');
  return { sent: true, to, from, messageLen: message.length, telnyxId: result?.data?.id };
}

async function executeSendEmail(config: any, context: any, models: any): Promise<any> {
  const to = substituteTemplate(config.to, context);
  const subject = substituteTemplate(config.subject, context);
  const body = substituteTemplate(config.body, context);
  if (!to) throw new Error('send_email requires "to" config');
  logger.info({ to, subject, bodyLen: body?.length || 0 }, 'Workflow: Email would be sent (no SMTP configured — logged only)');
  return { sent: false, reason: 'no_smtp_configured', to, subject, bodyLen: body?.length || 0 };
}

async function executeTagCall(config: any, context: any, models: any): Promise<any> {
  const tagName = substituteTemplate(config.tagName, context);
  const callId = context.call?.id;
  if (!callId || !tagName) throw new Error('tag_call requires a call context and tagName config');
  const call = await models.Call.findByPk(callId);
  if (!call) throw new Error(`Call ${callId} not found`);
  const existingTags = Array.isArray(call.tags) ? call.tags : [];
  if (!existingTags.includes(tagName)) {
    await call.update({ tags: [...existingTags, tagName] });
    const record = await models.CallRecord.findOne({ where: { callId: call.id } });
    if (record) { const recTags = Array.isArray(record.tags) ? record.tags : []; if (!recTags.includes(tagName)) await record.update({ tags: [...recTags, tagName] }); }
  }
  logger.info({ callId, tagName }, 'Workflow: Call tagged');
  return { tagged: true, callId, tagName };
}

async function executeAssignAgent(config: any, context: any, models: any): Promise<any> {
  const callId = context.call?.id;
  let agentId = config.agentId || context.agent?.id;
  if (!callId) throw new Error('assign_agent requires a call context');
  const call = await models.Call.findByPk(callId);
  if (!call) throw new Error(`Call ${callId} not found`);
  if (config.strategy === 'auto' && !agentId) {
    const { findAvailableAgent } = await import('./acd.js');
    const queueName = call.queueName || 'general';
    const agent = await findAvailableAgent(models, queueName);
    if (!agent) throw new Error('No available agent for auto-assignment');
    await call.update({ agentId: agent.id });
    logger.info({ callId, agentId: agent.id }, 'Workflow: Agent auto-assigned to call');
    return { assigned: true, callId, agentId: agent.id, strategy: 'auto' };
  }
  if (!agentId) throw new Error('assign_agent requires agentId or auto strategy');
  await call.update({ agentId });
  logger.info({ callId, agentId }, 'Workflow: Agent assigned to call');
  return { assigned: true, callId, agentId };
}

async function executeSetDisposition(config: any, context: any, models: any): Promise<any> {
  const callId = context.call?.id;
  const dispositionName = config.disposition;
  if (!callId || !dispositionName) throw new Error('set_disposition requires call context and disposition config');
  const { Op } = await import('sequelize');
  const disposition = await models.Disposition.findOne({ where: { name: { [Op.like]: dispositionName } } });
  const call = await models.Call.findByPk(callId);
  if (!call) throw new Error(`Call ${callId} not found`);
  if (disposition) {
    await call.update({ dispositionId: disposition.id });
    const record = await models.CallRecord.findOne({ where: { callId: call.id } });
    if (record) await record.update({ dispositionId: disposition.id });
    return { set: true, callId, dispositionId: disposition.id, dispositionName };
  }
  await call.update({ notes: `Disposition: ${dispositionName}` });
  return { set: true, callId, dispositionName, note: 'No matching Disposition record found; set in notes' };
}

async function executeEscalate(config: any, context: any, models: any): Promise<any> {
  const level = config.level || 'supervisor';
  const message = substituteTemplate(config.message, context) || `Escalation triggered (level: ${level})`;
  try { const io = getIO(); io.to('supervisors').emit('workflow:escalation', { level, message, context: { callId: context.call?.id, agentId: context.agent?.id, queueName: context.queue?.name }, timestamp: new Date().toISOString() }); } catch { /* socket not ready */ }
  logger.info({ level, message, callId: context.call?.id }, 'Workflow: Escalation triggered');
  return { escalated: true, level, message };
}

async function executeTriggerWebhook(config: any, context: any, models: any): Promise<any> {
  const url = substituteTemplate(config.url, context);
  const method = (config.method || 'POST').toUpperCase();
  if (!url) throw new Error('trigger_webhook requires a URL config');
  let parsedUrl: URL;
  try { parsedUrl = new URL(url); } catch { throw new Error(`Invalid webhook URL: ${url}`); }
  const hostname = parsedUrl.hostname;
  const ssrfBlockList = [/^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^169\.254\./, /^fc/i, /^fe80/i, /^fd/i, /^localhost$/i, /^::1$/];
  for (const pattern of ssrfBlockList) { if (pattern.test(hostname)) throw new Error(`Webhook URL targets a private/internal network: ${hostname}`); }
  if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') throw new Error('Webhook URLs must use HTTPS in production');
  const payload: any = { event: context.event, call: context.call ? { id: context.call.id, from: context.call.from, to: context.call.to, direction: context.call.direction, status: context.call.status } : undefined, agent: context.agent ? { id: context.agent.id } : undefined, timestamp: new Date().toISOString() };
  const fetchOptions: any = { method, headers: { 'Content-Type': 'application/json' }, body: method !== 'GET' ? JSON.stringify(payload) : undefined };
  const response = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(10000) });
  let responseBody: any;
  try { responseBody = await response.text(); try { responseBody = JSON.parse(responseBody); } catch { /* keep as text */ } } catch { responseBody = null; }
  logger.info({ url, method, status: response.status }, 'Workflow: Webhook triggered');
  return { triggered: true, url, method, statusCode: response.status, response: responseBody };
}

async function executeCreateTask(config: any, context: any, models: any): Promise<any> {
  const title = substituteTemplate(config.title, context) || 'Workflow-created task';
  const priority = config.priority || 'medium';
  const callId = context.call?.id;
  if (!callId) {
    const caseNote = await models.CaseNote.create({ callId: null, summary: title, keyPoints: [], sentiment: 'neutral' });
    const task = await models.Task.create({ caseNoteId: caseNote.id, callId: null, type: 'follow_up', description: title, priority });
    logger.info({ taskId: task.id, title, priority }, 'Workflow: Task created (no call context)');
    return { created: true, taskId: task.id, title, priority };
  }
  let caseNote = await models.CaseNote.findOne({ where: { callId } });
  if (!caseNote) caseNote = await models.CaseNote.create({ callId, summary: `Auto-created for workflow task: ${title}`, keyPoints: [], sentiment: 'neutral' });
  const task = await models.Task.create({ caseNoteId: caseNote.id, callId, type: 'follow_up', description: title, priority });
  logger.info({ taskId: task.id, callId, title, priority }, 'Workflow: Task created');
  return { created: true, taskId: task.id, title, priority };
}

async function executeNotifyTeam(config: any, context: any, models: any): Promise<any> {
  const channel = config.channel || 'agents';
  const message = substituteTemplate(config.message, context) || 'Workflow notification';
  try { const io = getIO(); const room = channel === 'supervisors' ? 'supervisors' : 'agents'; io.to(room).emit('workflow:notification', { channel, message, context: { callId: context.call?.id, agentId: context.agent?.id }, timestamp: new Date().toISOString() }); } catch { /* socket not ready */ }
  logger.info({ channel, message: message.substring(0, 100) }, 'Workflow: Team notified');
  return { notified: true, channel, messageLen: message.length };
}

async function executeSubmitForm(config: any, context: any, models: any): Promise<any> {
  const formId = config.formId;
  if (!formId) throw new Error('submit_form requires formId in config');
  const form = await models.Form.findByPk(formId);
  if (!form) throw new Error(`Form ${formId} not found`);
  const data: Record<string, any> = {};
  if (config.fieldMapping) { for (const [variable, contextPath] of Object.entries(config.fieldMapping)) { const keys = (contextPath as string).split('.'); let val: any = context; for (const k of keys) val = val?.[k]; if (val !== undefined) data[variable] = val; } }
  if (form.schema?.pages) { for (const page of form.schema.pages) { for (const section of page.sections || []) { for (const field of section.fields || []) { if (data[field.variable] === undefined && field.defaultValue) data[field.variable] = field.defaultValue; } } } }
  const submission = await models.FormSubmission.create({ formId, data, prefilledContext: { source: 'workflow', triggerEvent: context.event }, submittedBy: null });
  bus.emit('form:submitted', { form: { id: form.id, name: form.name }, submission: { id: submission.id, data: submission.data }, variables: form.variables, context: submission.prefilledContext });
  logger.info({ formId, submissionId: submission.id, fieldCount: Object.keys(data).length }, 'Workflow: Form submitted');
  return { action: 'submit_form', formId, submissionId: submission.id, fieldCount: Object.keys(data).length };
}

async function executeUpdateContact(config: any, context: any, models: any): Promise<any> {
  const field = config.field;
  const value = substituteTemplate(config.value, context);
  const phoneNumber = context.call?.from;
  if (!phoneNumber) throw new Error('update_contact requires a call context with a "from" number');
  const contact = await models.Contact.findOne({ where: { phoneNumber } });
  if (!contact) throw new Error(`Contact not found for phone number ${phoneNumber}`);
  const updates: Record<string, any> = {};
  if (field === 'tags') { const existing = Array.isArray(contact.tags) ? contact.tags : []; if (!existing.includes(value)) updates.tags = [...existing, value]; }
  else if (field === 'notes') { updates.notes = (contact.notes || '') + '\n' + value; }
  else if (field === 'company') { updates.company = value; }
  else if (field === 'lifecycle' || field === 'metadata') { updates.metadata = { ...(contact.metadata || {}), lifecycle: value }; }
  else { updates[field] = value; }
  if (Object.keys(updates).length > 0) await contact.update(updates);
  logger.info({ contactId: contact.id, field, value: value?.substring?.(0, 50) || value }, 'Workflow: Contact updated');
  return { updated: true, contactId: contact.id, field, value };
}
