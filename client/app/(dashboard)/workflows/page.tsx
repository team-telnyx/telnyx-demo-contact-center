'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../../lib/api';
import {
  Zap, Plus, Search, Play, Trash2, Edit3, Copy,
  Phone, PhoneOff, PhoneMissed, PhoneForwarded,
  Users, BarChart3, UserCheck, Tag, MessageSquare, Mail,
  AlertTriangle, Globe, CheckSquare, Bell, UserCircle,
  X, GripVertical, Clock, Activity, Loader2, FileText,
  Mic, MessageCircle, ArrowRight, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import { useSocketEvent } from '../../../lib/socket';
import { useToast } from '../../../components/Toast';

const TRIGGERS = [
  { value: 'call.started', label: 'Call Started', icon: Phone, color: 'text-tx-green' },
  { value: 'call.ended', label: 'Call Ended', icon: PhoneOff, color: 'text-tx-ts' },
  { value: 'call.missed', label: 'Call Missed', icon: PhoneMissed, color: 'text-tx-red' },
  { value: 'call.queued', label: 'Call Queued', icon: Users, color: 'text-blue-400' },
  { value: 'call.transfer', label: 'Call Transfer', icon: PhoneForwarded, color: 'text-amber-400' },
  { value: 'queue.depth_exceeded', label: 'Queue Depth Exceeded', icon: BarChart3, color: 'text-orange-400' },
  { value: 'agent.status_change', label: 'Agent Status Change', icon: UserCheck, color: 'text-purple-400' },
  { value: 'disposition.set', label: 'Disposition Set', icon: Tag, color: 'text-cyan-400' },
  { value: 'recording.saved', label: 'Recording Saved', icon: Mic, color: 'text-pink-400' },
  { value: 'chat.message_received', label: 'Chat Message Received', icon: MessageCircle, color: 'text-indigo-400' },
];

const ACTIONS_LIST = [
  { value: 'send_sms', label: 'Send SMS', icon: MessageSquare, color: 'text-tx-green' },
  { value: 'send_email', label: 'Send Email', icon: Mail, color: 'text-blue-400' },
  { value: 'tag_call', label: 'Tag Call', icon: Tag, color: 'text-amber-400' },
  { value: 'assign_agent', label: 'Assign Agent', icon: UserCheck, color: 'text-purple-400' },
  { value: 'set_disposition', label: 'Set Disposition', icon: CheckSquare, color: 'text-cyan-400' },
  { value: 'escalate', label: 'Escalate', icon: AlertTriangle, color: 'text-tx-red' },
  { value: 'trigger_webhook', label: 'Trigger Webhook', icon: Globe, color: 'text-orange-400' },
  { value: 'create_task', label: 'Create Task', icon: FileText, color: 'text-indigo-400' },
  { value: 'notify_team', label: 'Notify Team', icon: Bell, color: 'text-pink-400' },
  { value: 'update_contact', label: 'Update Contact', icon: UserCircle, color: 'text-teal-400' },
];

const TEMPLATES = [
  {
    name: 'Auto-tag missed calls',
    description: 'Automatically tag any missed call for follow-up',
    trigger: { type: 'call.missed', config: {} },
    actions: [{ type: 'tag_call', config: { tagName: 'missed' } }],
  },
  {
    name: 'Escalate long queue',
    description: 'Notify team and escalate when queue depth exceeds threshold',
    trigger: { type: 'queue.depth_exceeded', config: { threshold: 5, queue: '*' } },
    actions: [
      { type: 'notify_team', config: { channel: 'general', message: 'Queue depth exceeded — escalation needed' } },
      { type: 'escalate', config: { level: 'supervisor' } },
    ],
  },
  {
    name: 'SMS on voicemail',
    description: 'Send an SMS to callers who left a voicemail',
    trigger: { type: 'disposition.set', config: { disposition: 'voicemail' } },
    actions: [
      { type: 'send_sms', config: { to: '{{caller.number}}', message: 'We received your voicemail and will get back to you shortly.' } },
    ],
  },
  {
    name: 'Post-call survey',
    description: 'Send a survey SMS after each call ends',
    trigger: { type: 'call.ended', config: {} },
    actions: [
      { type: 'send_sms', config: { to: '{{caller.number}}', message: 'Thanks for calling! Rate your experience: https://survey.example.com/c/{{call.id}}' } },
    ],
  },
];

function getTriggerDef(type) { return TRIGGERS.find((t) => t.value === type) || TRIGGERS[0]; }
function getActionDef(type) { return ACTIONS_LIST.find((a) => a.value === type) || ACTIONS_LIST[0]; }

function formatTime(iso: any) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60000) return 'Just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

const EMPTY_FORM = { name: '', description: '', trigger: { type: 'call.missed', config: {} }, actions: [{ type: 'tag_call', config: {} }], enabled: true };

/* ── Shared class strings ────────────────────────────────────────── */
const SEL = 'w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-2.5 py-1.5 text-[12px] text-tx-tp focus:outline-none focus:border-tx-citron/40';
const INP = 'w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-2.5 py-1.5 text-[12px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40';
const TXA = 'w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-2.5 py-1.5 text-[12px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40 resize-none';
const LBL = 'text-[11px] font-medium text-tx-ts mb-1 block';

/* ════════════════════════════════════════════════════════════════════
   TRIGGER CONFIG FIELDS
   ══════════════════════════════════════════════════════════════════ */
function TriggerConfigFields({ trigger, onChange }) {
  const { type, config } = trigger;
  const set = (k, v) => onChange({ ...trigger, config: { ...config, [k]: v } });

  if (type === 'queue.depth_exceeded') return (
    <div className="flex gap-3 mt-2">
      <div className="flex-1"><label className={LBL}>Queue</label><select value={config.queue || '*'} onChange={(e) => set('queue', e.target.value)} className={SEL}><option value="*">Any Queue</option><option value="support">Support</option><option value="sales">Sales</option><option value="billing">Billing</option></select></div>
      <div className="w-24"><label className={LBL}>Threshold</label><input type="number" min={1} value={config.threshold || 5} onChange={(e) => set('threshold', Number(e.target.value))} className={SEL} /></div>
    </div>
  );
  if (type === 'agent.status_change') return (
    <div className="mt-2"><label className={LBL}>Status</label><select value={config.status || 'any'} onChange={(e) => set('status', e.target.value)} className={SEL}><option value="any">Any Status Change</option><option value="offline">Goes Offline</option><option value="available">Becomes Available</option><option value="busy">Becomes Busy</option><option value="wrap-up">Enters Wrap-up</option></select></div>
  );
  if (type === 'disposition.set') return (
    <div className="mt-2"><label className={LBL}>Disposition</label><select value={config.disposition || 'any'} onChange={(e) => set('disposition', e.target.value)} className={SEL}><option value="any">Any Disposition</option><option value="voicemail">Voicemail</option><option value="no-answer">No Answer</option><option value="resolved">Resolved</option><option value="callback">Callback Requested</option></select></div>
  );
  return null;
}

/* ════════════════════════════════════════════════════════════════════
   ACTION CONFIG FIELDS
   ══════════════════════════════════════════════════════════════════ */
function ActionConfigFields({ action, onChange }) {
  const { type, config } = action;
  const set = (k, v) => onChange({ ...action, config: { ...config, [k]: v } });

  if (type === 'send_sms') return (
    <div className="space-y-2 mt-2">
      <div><label className={LBL}>To Number</label><input type="text" value={config.to || ''} onChange={(e) => set('to', e.target.value)} placeholder="{{caller.number}}" className={INP} /></div>
      <div><label className={LBL}>Message</label><textarea value={config.message || ''} onChange={(e) => set('message', e.target.value)} placeholder="Your message template..." rows={2} className={TXA} /></div>
    </div>
  );
  if (type === 'send_email') return (
    <div className="space-y-2 mt-2">
      <div><label className={LBL}>To Email</label><input type="email" value={config.to || ''} onChange={(e) => set('to', e.target.value)} placeholder="team@example.com" className={INP} /></div>
      <div><label className={LBL}>Subject</label><input type="text" value={config.subject || ''} onChange={(e) => set('subject', e.target.value)} placeholder="Alert from Contact Center" className={INP} /></div>
      <div><label className={LBL}>Body</label><textarea value={config.body || ''} onChange={(e) => set('body', e.target.value)} placeholder="Email body..." rows={2} className={TXA} /></div>
    </div>
  );
  if (type === 'tag_call') return (<div className="mt-2"><label className={LBL}>Tag Name</label><input type="text" value={config.tagName || ''} onChange={(e) => set('tagName', e.target.value)} placeholder="e.g. missed, vip, escalation" className={INP} /></div>);
  if (type === 'assign_agent') return (<div className="mt-2"><label className={LBL}>Strategy</label><select value={config.strategy || 'auto'} onChange={(e) => set('strategy', e.target.value)} className={SEL}><option value="auto">Auto-assign</option><option value="round-robin">Round Robin</option><option value="least-recent">Least Recent</option></select></div>);
  if (type === 'set_disposition') return (<div className="mt-2"><label className={LBL}>Disposition</label><select value={config.disposition || ''} onChange={(e) => set('disposition', e.target.value)} className={SEL}><option value="">Select...</option><option value="resolved">Resolved</option><option value="callback">Callback</option><option value="voicemail">Voicemail</option><option value="no-answer">No Answer</option></select></div>);
  if (type === 'escalate') return (<div className="mt-2"><label className={LBL}>Level</label><select value={config.level || 'supervisor'} onChange={(e) => set('level', e.target.value)} className={SEL}><option value="supervisor">Supervisor</option><option value="manager">Manager</option><option value="director">Director</option></select></div>);
  if (type === 'trigger_webhook') return (
    <div className="space-y-2 mt-2">
      <div><label className={LBL}>URL</label><input type="url" value={config.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://hooks.example.com/workflow" className={INP} /></div>
      <div><label className={LBL}>Method</label><select value={config.method || 'POST'} onChange={(e) => set('method', e.target.value)} className={SEL}><option value="POST">POST</option><option value="GET">GET</option><option value="PUT">PUT</option></select></div>
    </div>
  );
  if (type === 'create_task') return (
    <div className="space-y-2 mt-2">
      <div><label className={LBL}>Task Title</label><input type="text" value={config.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="Follow up on call" className={INP} /></div>
      <div><label className={LBL}>Priority</label><select value={config.priority || 'medium'} onChange={(e) => set('priority', e.target.value)} className={SEL}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
    </div>
  );
  if (type === 'notify_team') return (
    <div className="space-y-2 mt-2">
      <div><label className={LBL}>Channel</label><input type="text" value={config.channel || ''} onChange={(e) => set('channel', e.target.value)} placeholder="#general" className={INP} /></div>
      <div><label className={LBL}>Message</label><textarea value={config.message || ''} onChange={(e) => set('message', e.target.value)} placeholder="Notification message..." rows={2} className={TXA} /></div>
    </div>
  );
  if (type === 'update_contact') return (
    <div className="space-y-2 mt-2">
      <div><label className={LBL}>Field</label><select value={config.field || ''} onChange={(e) => set('field', e.target.value)} className={SEL}><option value="">Select field...</option><option value="tags">Tags</option><option value="notes">Notes</option><option value="company">Company</option><option value="lifecycle">Lifecycle Stage</option></select></div>
      <div><label className={LBL}>Value</label><input type="text" value={config.value || ''} onChange={(e) => set('value', e.target.value)} placeholder="New value" className={INP} /></div>
    </div>
  );
  return null;
}

/* ════════════════════════════════════════════════════════════════════
   WORKFLOW BUILDER MODAL
   ══════════════════════════════════════════════════════════════════ */
function WorkflowBuilder({ workflow, onSave, onClose }) {
  const [form, setForm] = useState(workflow ? { ...workflow } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, any>>({});
  const [showTemplates, setShowTemplates] = useState(!workflow);
  const [toast, setToast] = useState('');

  const updateForm = (u) => setForm((f) => ({ ...f, ...u }));
  const updateTrigger = (u) => setForm((f) => ({ ...f, trigger: { ...f.trigger, ...u } }));
  const addAction = () => setForm((f) => ({ ...f, actions: [...f.actions, { type: 'tag_call', config: {} }] }));
  const removeAction = (i) => setForm((f) => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }));
  const applyTemplate = (t: any) => { setForm({ ...EMPTY_FORM, name: t.name, description: t.description, trigger: t.trigger, actions: t.actions }); setShowTemplates(false); };

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Workflow name is required';
    if (!form.trigger?.type) errors.trigger = 'A trigger is required';
    if (!form.actions || form.actions.length === 0) errors.actions = 'At least one action is required';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (workflow?.id) await api.patch(`/workflows/${workflow.id}`, form);
      else await api.post('/workflows', form);
      onSave(); onClose();
    } catch (err: any) { console.error('Save workflow failed:', err); setValidationErrors({ submit: err.message || 'Failed to save workflow' }); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    if (!workflow?.id) { setToast('Save the workflow first to test it'); setTimeout(() => setToast(''), 3000); return; }
    try { await api.post(`/workflows/${workflow.id}/run`); setToast('Workflow test triggered \u2713'); }
    catch { setToast('Test failed'); }
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 pt-12"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl bg-tx-s2 border border-tx-bdefault rounded-2xl shadow-tx-lg my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tx-bdefault">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-400/20 flex items-center justify-center">
              <Zap className="w-[18px] h-[18px] text-amber-400" strokeWidth={2} />
            </div>
            <h2 className="text-[15px] font-semibold text-tx-tp">{workflow ? 'Edit Workflow' : 'New Workflow'}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-tx-s3 flex items-center justify-center text-tx-tt hover:text-tx-tp transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Templates */}
        <AnimatePresence>
          {showTemplates && !workflow && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-6 py-4 border-b border-tx-bdefault bg-tx-s3/30">
                <p className="text-[12px] font-medium text-tx-ts mb-3">Start from a template</p>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((t) => (
                    <button key={t.name} onClick={() => applyTemplate(t)} className="text-left p-3 rounded-xl bg-tx-s2 border border-tx-bdefault hover:border-tx-citron/30 transition-all duration-150 group">
                      <p className="text-[12px] font-medium text-tx-tp group-hover:text-tx-citron transition-colors">{t.name}</p>
                      <p className="text-[10px] text-tx-tt mt-0.5">{t.description}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-tx-s3 text-[9px] font-medium text-tx-ts"><ArrowRight className="w-2.5 h-2.5" />{getTriggerDef(t.trigger.type).label}</span>
                        <span className="text-[9px] text-tx-tt">&rarr;</span>
                        <span className="text-[9px] text-tx-ts">{t.actions.length} action{t.actions.length !== 1 ? 's' : ''}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowTemplates(false)} className="mt-3 text-[11px] font-medium text-tx-tt hover:text-tx-ts transition-colors">Or start from scratch &rarr;</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form body */}
        <div className="px-6 py-5 space-y-5">
          {/* Validation errors */}
          {Object.keys(validationErrors).length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red text-[12px]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{validationErrors.submit || Object.values(validationErrors)[0]}</span>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-tx-ts mb-1.5 block">Workflow Name</label>
              <input type="text" value={form.name} onChange={(e) => { updateForm({ name: e.target.value }); setValidationErrors((v) => { const { name, ...rest } = v; return rest; }); }} placeholder="e.g. Auto-tag missed calls" className={`w-full bg-tx-s3 border rounded-lg px-3 py-2 text-[13px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40 ${validationErrors.name ? 'border-tx-red/50' : 'border-tx-bdefault'}`} />
              {validationErrors.name && <p className="text-[10px] text-tx-red mt-1">{validationErrors.name}</p>}
            </div>
            <div>
              <label className="text-[11px] font-medium text-tx-ts mb-1.5 block">Description</label>
              <textarea value={form.description} onChange={(e) => updateForm({ description: e.target.value })} placeholder="What does this workflow do?" rows={2} className="w-full bg-tx-s3 border border-tx-bdefault rounded-lg px-3 py-2 text-[13px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-citron/40 resize-none" />
            </div>
          </div>

          {/* Trigger */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md bg-tx-s4 flex items-center justify-center"><Activity className="w-3 h-3 text-tx-citron" /></div>
              <span className="text-[12px] font-semibold text-tx-tp">Trigger</span>
              <span className="text-[10px] text-tx-tt">&mdash; When should this workflow run?</span>
              {validationErrors.trigger && <span className="text-[10px] text-tx-red">{validationErrors.trigger}</span>}
            </div>
            <div className="bg-tx-s3 border border-tx-bdefault rounded-xl p-3 space-y-1">
              <select value={form.trigger.type} onChange={(e) => updateTrigger({ type: e.target.value, config: {} })} className="w-full bg-tx-s2 border border-tx-bdefault rounded-lg px-2.5 py-1.5 text-[12px] text-tx-tp focus:outline-none focus:border-tx-citron/40">
                {TRIGGERS.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
              <TriggerConfigFields trigger={form.trigger} onChange={(t) => setForm((f) => ({ ...f, trigger: t }))} />
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-tx-s4 flex items-center justify-center"><Zap className="w-3 h-3 text-amber-400" /></div>
                <span className="text-[12px] font-semibold text-tx-tp">Actions</span>
                <span className="text-[10px] text-tx-tt">&mdash; What should happen?</span>
                {validationErrors.actions && <span className="text-[10px] text-tx-red">{validationErrors.actions}</span>}
              </div>
              <span className="text-[10px] text-tx-tt tabular-nums">{form.actions.length} action{form.actions.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {form.actions.map((action, i) => {
                const actionDef = getActionDef(action.type);
                const ActionIcon = actionDef.icon;
                return (
                  <motion.div key={i} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-tx-s3 border border-tx-bdefault rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <GripVertical className="w-3.5 h-3.5 text-tx-tt flex-shrink-0 cursor-grab" />
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <ActionIcon className={`w-3.5 h-3.5 ${actionDef.color} flex-shrink-0`} />
                        <select value={action.type} onChange={(e) => setForm((f) => { const a = [...f.actions]; a[i] = { type: e.target.value, config: {} }; return { ...f, actions: a }; })} className="flex-1 bg-tx-s2 border border-tx-bdefault rounded-lg px-2 py-1 text-[12px] text-tx-tp focus:outline-none focus:border-tx-citron/40 min-w-0">
                          {ACTIONS_LIST.map((a) => (<option key={a.value} value={a.value}>{a.label}</option>))}
                        </select>
                      </div>
                      <button onClick={() => removeAction(i)} className="w-6 h-6 rounded-md hover:bg-tx-red/10 flex items-center justify-center text-tx-tt hover:text-tx-red transition-colors flex-shrink-0" title="Remove"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    <ActionConfigFields action={action} onChange={(a) => setForm((f) => { const acts = [...f.actions]; acts[i] = a; return { ...f, actions: acts }; })} />
                  </motion.div>
                );
              })}
            </div>
            <button onClick={addAction} className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-tx-bdefault hover:border-tx-citron/30 text-tx-tt hover:text-tx-citron transition-all duration-150 text-[12px] font-medium">
              <Plus className="w-3.5 h-3.5" /> Add Action
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-tx-bdefault bg-tx-s3/30 rounded-b-2xl">
          <div className="flex items-center gap-2">
            {workflow?.id && <button onClick={handleTest} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tx-s2 border border-tx-bdefault text-tx-ts hover:text-tx-tp hover:border-tx-bstrong transition-all text-[12px] font-medium"><Play className="w-3 h-3" /> Test</button>}
            {toast && <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="text-[11px] font-medium text-tx-citron">{toast}</motion.span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-tx-tt hover:text-tx-tp text-[12px] font-medium transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg gradient-primary text-tx-ti text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              {workflow ? 'Save Changes' : 'Create Workflow'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   WORKFLOW CARD
   ══════════════════════════════════════════════════════════════════ */
function WorkflowCard({ workflow, onToggle, onEdit, onDelete, onDuplicate, onRun }) {
  const triggerDef = getTriggerDef(workflow.trigger?.type);
  const TriggerIcon = triggerDef.icon;
  const [showExecutions, setShowExecutions] = useState(false);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loadingExec, setLoadingExec] = useState(false);

  async function loadExecutions() {
    if (showExecutions) {
      setShowExecutions(false);
      return;
    }
    setShowExecutions(true);
    setLoadingExec(true);
    try {
      const data = await api.get(`/workflows/${workflow.id}/executions?limit=5`);
      setExecutions(data.executions || []);
    } catch (err: any) {
      console.error('Failed to load executions:', err);
    } finally {
      setLoadingExec(false);
    }
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`relative rounded-xl border transition-all duration-200 group ${workflow.enabled ? 'bg-tx-s2 border-tx-bdefault hover:border-tx-citron/20' : 'bg-tx-s3/60 border-tx-bdefault opacity-60 hover:opacity-80'}`}>
      {workflow.enabled && <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-gradient-to-b from-tx-green to-tx-citron/60" />}
      <div className="p-4 pl-5">
        {/* Top: name + action buttons */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {/* Status indicator dot */}
              {workflow.enabled && workflow.status === 'published' && (
                <span className="w-2 h-2 rounded-full bg-tx-green shadow-[0_0_6px_rgba(52,211,153,0.5)] flex-shrink-0" title="Active / Published" />
              )}
              {workflow.enabled && (!workflow.status || workflow.status === 'draft') && (
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)] flex-shrink-0" title="Draft" />
              )}
              {!workflow.enabled && (
                <span className="w-2 h-2 rounded-full bg-tx-tt/40 flex-shrink-0" title="Disabled" />
              )}
              <h3 className="text-[13px] font-semibold text-tx-tp truncate">{workflow.name}</h3>
            </div>
            {workflow.description && <p className="text-[11px] text-tx-tt mt-0.5 line-clamp-2">{workflow.description}</p>}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button onClick={() => onRun(workflow)} title="Test run" className="w-7 h-7 rounded-lg hover:bg-tx-s3 flex items-center justify-center text-tx-tt hover:text-tx-green transition-colors"><Play className="w-3 h-3" /></button>
            <button onClick={() => onEdit(workflow)} title="Edit" className="w-7 h-7 rounded-lg hover:bg-tx-s3 flex items-center justify-center text-tx-tt hover:text-tx-tp transition-colors"><Edit3 className="w-3 h-3" /></button>
            <button onClick={() => onDuplicate(workflow)} title="Duplicate" className="w-7 h-7 rounded-lg hover:bg-tx-s3 flex items-center justify-center text-tx-tt hover:text-tx-tp transition-colors"><Copy className="w-3 h-3" /></button>
            <button onClick={() => onDelete(workflow)} title="Delete" className="w-7 h-7 rounded-lg hover:bg-tx-red/10 flex items-center justify-center text-tx-tt hover:text-tx-red transition-colors"><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>

        {/* Meta row: trigger badge + action count + toggle */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {/* Trigger badge */}
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium ${triggerDef.color} bg-tx-s3`}>
              <TriggerIcon className="w-3 h-3" />
              {triggerDef.label}
            </span>
            {/* Action count */}
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-tx-ts bg-tx-s3">
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              {workflow.actions?.length || 0} action{(workflow.actions?.length || 0) !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Toggle */}
          <button onClick={() => onToggle(workflow)} className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${workflow.enabled ? 'bg-tx-green' : 'bg-tx-s4'}`} title={workflow.enabled ? 'Disable' : 'Enable'}>
            <motion.div animate={{ x: workflow.enabled ? 16 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
        </div>

        {/* Footer row: last run + run count + executions toggle */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-tx-bdefault">
          <span className="flex items-center gap-1 text-[10px] text-tx-tt">
            <Clock className="w-3 h-3" />
            Last run: {formatTime(workflow.lastRunAt)}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-tx-tt tabular-nums">
            <Activity className="w-3 h-3" />
            {workflow.runCount || 0} run{(workflow.runCount || 0) !== 1 ? 's' : ''}
          </span>
          <button onClick={loadExecutions} className="ml-auto flex items-center gap-1 text-[10px] text-tx-tt hover:text-tx-ts transition-colors">
            {showExecutions ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            History
          </button>
        </div>

        {/* Executions expandable section */}
        <AnimatePresence>
          {showExecutions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-tx-bdefault">
                {loadingExec ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-4 h-4 text-tx-tt animate-spin" />
                  </div>
                ) : executions.length === 0 ? (
                  <p className="text-[10px] text-tx-tt text-center py-3">No executions yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {executions.map((exec) => (
                      <div key={exec.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-tx-s3/50">
                        {exec.status === 'success' ? (
                          <CheckCircle2 className="w-3 h-3 text-tx-green flex-shrink-0" />
                        ) : exec.status === 'partial' ? (
                          <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-tx-red flex-shrink-0" />
                        )}
                        <span className="text-[10px] text-tx-tt flex-1">{exec.triggerEvent}</span>
                        <span className="text-[9px] text-tx-tt">{formatTime(exec.executedAt)}</span>
                        <span className="text-[9px] text-tx-tt tabular-nums">
                          {exec.results?.filter((r) => r.status === 'success').length || 0}/{exec.results?.length || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   EMPTY STATE
   ══════════════════════════════════════════════════════════════════ */
function EmptyState({ onCreate }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/10 to-orange-500/10 border border-amber-400/10 flex items-center justify-center mb-5">
        <Zap className="w-8 h-8 text-amber-400/60" strokeWidth={1.5} />
      </div>
      <h3 className="text-[15px] font-semibold text-tx-tp mb-1">No workflows yet</h3>
      <p className="text-[12px] text-tx-tt max-w-xs mb-5">Automate your contact center operations by creating workflows that react to events and perform actions.</p>
      <button onClick={onCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-tx-ti text-[12px] font-semibold hover:opacity-90 transition-opacity">
        <Plus className="w-3.5 h-3.5" /> Create your first workflow
      </button>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   TEST RUN MODAL
   ══════════════════════════════════════════════════════════════════ */
function TestRunModal({ workflow, onClose }) {
  const [payload, setPayload] = useState('{\n  \"phone\": \"+61412345678\"\n}');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const { addToast } = useToast();

  async function handleTest() {
    setRunning(true);
    setResult(null);
    setError('');
    try {
      let parsedPayload: any;
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        parsedPayload = { phone: payload, raw: payload };
      }
      const data = await api.post(`/workflows/${workflow.id}/test`, parsedPayload);
      setResult(data);
      addToast('Test run completed', 'success');
    } catch (err: any) {
      setError(err.message || 'Test run failed');
      addToast('Test run failed', 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-tx-s2 border border-tx-bdefault rounded-2xl shadow-tx-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-tx-bdefault">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-tx-green/20 to-tx-citron/20 border border-tx-green/20 flex items-center justify-center">
              <Play className="w-4 h-4 text-tx-green" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-tx-tp">Test Run</h3>
              <p className="text-[10px] text-tx-tt">{workflow.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-tx-s3 flex items-center justify-center text-tx-tt hover:text-tx-tp transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-tx-ts mb-1.5 block">Test Payload</label>
            <p className="text-[10px] text-tx-tt mb-2">Enter a phone number or JSON payload to test this workflow</p>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={4}
              className="w-full bg-tx-s3 border border-tx-bdefault rounded-xl px-3 py-2.5 text-[12px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/50 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all resize-none font-mono"
              placeholder='{ "phone": "+61412345678" }'
            />
          </div>

          {/* Results */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-tx-red/10 border border-tx-red/20">
              <XCircle className="w-4 h-4 text-tx-red flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-medium text-tx-red">Test Failed</p>
                <p className="text-[11px] text-tx-red/70 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className={`rounded-xl border p-3 ${result.status === 'success' ? 'bg-tx-green/5 border-tx-green/20' : 'bg-amber-400/5 border-amber-400/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-tx-green" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
                <span className={`text-[12px] font-semibold ${result.status === 'success' ? 'text-tx-green' : 'text-amber-400'}`}>
                  {result.status === 'success' ? 'Success' : 'Partial'}
                </span>
                {result.runCount !== undefined && (
                  <span className="text-[10px] text-tx-tt ml-auto">{result.runCount} actions executed</span>
                )}
              </div>
              {result.results && result.results.length > 0 && (
                <div className="space-y-1 mt-2">
                  {result.results.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-tx-s3/50">
                      {r.status === 'success' ? (
                        <CheckCircle2 className="w-3 h-3 text-tx-green flex-shrink-0" />
                      ) : (
                        <XCircle className="w-3 h-3 text-tx-red flex-shrink-0" />
                      )}
                      <span className="text-[10px] text-tx-ts flex-1 truncate">{r.action || r.type || `Action ${i + 1}`}</span>
                      <span className={`text-[10px] ${r.status === 'success' ? 'text-tx-green' : 'text-tx-red'}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-tx-bdefault bg-tx-s3/30 rounded-b-2xl">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-tx-tt hover:text-tx-tp text-[12px] font-medium transition-colors">
            Close
          </button>
          <button
            onClick={handleTest}
            disabled={running || !payload.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg gradient-primary text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {running ? 'Running...' : 'Run Test'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════ */
export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<any>(null);
  const [testingWorkflow, setTestingWorkflow] = useState<any>(null);
  const { addToast } = useToast();

  // Listen for real-time workflow events via Socket.IO
  useSocketEvent('workflow:executed', useCallback((result) => {
    setWorkflows((prev) => prev.map((wf) => {
      if (wf.id !== result.workflowId) return wf;
      return { ...wf, lastRunAt: new Date().toISOString(), runCount: (wf.runCount || 0) + 1 };
    }));
    // Don't toast for manual triggers — handleRun already shows one
    if (result.triggerEvent !== 'manual') {
      const statusType = result.status === 'success' ? 'success' : result.status === 'partial' ? 'warning' : 'error';
      addToast(`Workflow "${result.name}" auto-executed (${result.status})`, statusType);
    }
  }, [addToast]));

  useSocketEvent('workflow:toggled', useCallback((workflow) => {
    setWorkflows((prev) => prev.map((wf) => wf.id === workflow.id ? workflow : wf));
  }, []));

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/workflows');
      setWorkflows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch workflows:', err);
      setError(err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  const filtered = search
    ? workflows.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()) || w.description?.toLowerCase().includes(search.toLowerCase()))
    : workflows;

  const enabledCount = workflows.filter((w) => w.enabled).length;

  async function handleToggle(w) {
    try {
      const data = await api.post(`/workflows/${w.id}/toggle`);
      setWorkflows((prev) => prev.map((wf) => (wf.id === w.id ? data : wf)));
    } catch (err: any) { console.error('Toggle failed:', err); }
  }

  async function handleDelete(w) {
    if (!confirm(`Delete "${w.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/workflows/${w.id}`);
      setWorkflows((prev) => prev.filter((wf) => wf.id !== w.id));
    } catch (err: any) { console.error('Delete failed:', err); }
  }

  async function handleDuplicate(w) {
    try {
      const data = await api.post(`/workflows/${w.id}/duplicate`);
      setWorkflows((prev) => [data, ...prev]);
      addToast(`Workflow "${w.name}" duplicated`, 'success');
    } catch (err: any) {
      console.error('Duplicate failed:', err);
      // Fallback: create manually if endpoint not available
      try {
        const data = await api.post('/workflows', {
          name: `${w.name} (copy)`,
          description: w.description,
          trigger: w.trigger,
          actions: w.actions,
          enabled: false,
        });
        setWorkflows((prev) => [data, ...prev]);
        addToast(`Workflow "${w.name}" duplicated`, 'success');
      } catch (fallbackErr: any) {
        addToast('Failed to duplicate workflow', 'error');
      }
    }
  }

  async function handleRun(w) {
    try {
      const data = await api.post(`/workflows/${w.id}/run`);
      setWorkflows((prev) => prev.map((wf) => (wf.id === w.id ? { ...wf, lastRunAt: data.lastRunAt, runCount: data.runCount } : wf)));
      // Show toast with execution results
      if (data.status === 'success') {
        addToast(`Workflow "${w.name}" executed successfully — ${data.results?.length || 0} action(s) ran`, 'success');
      } else if (data.status === 'partial') {
        const errors = data.results?.filter((r) => r.status === 'error').length || 0;
        addToast(`Workflow "${w.name}" partially executed — ${errors} action(s) failed`, 'warning');
      } else {
        addToast(`Workflow "${w.name}" execution failed`, 'error');
      }
    } catch (err: any) {
      console.error('Run failed:', err);
      addToast(`Failed to run workflow "${w.name}"`, 'error');
    }
  }

  function handleOpenTestRun(w) {
    setTestingWorkflow(w);
  }

  function handleEdit(w) {
    setEditingWorkflow(w);
    setBuilderOpen(true);
  }

  function handleCreate() {
    setEditingWorkflow(null);
    setBuilderOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-tx-red/10 border border-tx-red/20 text-tx-red text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={fetchWorkflows} className="px-3 py-1 rounded-lg bg-tx-red/10 border border-tx-red/20 text-tx-red text-xs font-medium hover:bg-tx-red/20 transition-colors">Retry</button>
          <button onClick={() => setError(null)} className="p-1 text-tx-red/60 hover:text-tx-red transition-colors"><X className="w-4 h-4" /></button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-tx-green/20 flex-shrink-0">
            <Zap className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-tx-tp tracking-tight">Workflows</h1>
            <p className="text-[11px] text-tx-ts mt-0.5">
              {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
              {enabledCount > 0 && <span className="text-tx-green font-semibold"> &middot; {enabledCount} active</span>}
            </p>
          </div>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-[12px] font-semibold shadow-lg shadow-tx-green/20 hover:shadow-tx-green/40 transition-shadow">
          <Plus className="w-3.5 h-3.5" /> New Workflow
        </button>
      </div>

      {/* Search */}
      {workflows.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tx-tt" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows..."
            className="w-full bg-tx-s2 border border-tx-bdefault rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-tx-tp placeholder-tx-tt focus:outline-none focus:border-tx-green/60 focus:shadow-[0_0_0_3px_rgba(0,192,139,0.08)] transition-all"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl bg-tx-s1 border border-tx-bdefault p-5 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 w-32 rounded bg-tx-s3" />
                <div className="h-5 w-10 rounded-full bg-tx-s3" />
              </div>
              <div className="h-3 w-full rounded bg-tx-s3 mb-2" />
              <div className="h-3 w-2/3 rounded bg-tx-s3 mb-4" />
              <div className="flex items-center gap-2">
                <div className="h-6 w-16 rounded-md bg-tx-s3" />
                <div className="h-6 w-20 rounded-md bg-tx-s3" />
              </div>
            </div>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[13px] text-tx-tt">No workflows match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence>
            {filtered.map((w) => (
              <WorkflowCard
                key={w.id}
                workflow={w}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onRun={handleOpenTestRun}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Builder Modal */}
      <AnimatePresence>
        {builderOpen && (
          <WorkflowBuilder
            workflow={editingWorkflow}
            onSave={fetchWorkflows}
            onClose={() => { setBuilderOpen(false); setEditingWorkflow(null); }}
          />
        )}
      </AnimatePresence>

      {/* Test Run Modal */}
      <AnimatePresence>
        {testingWorkflow && (
          <TestRunModal
            workflow={testingWorkflow}
            onClose={() => setTestingWorkflow(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}