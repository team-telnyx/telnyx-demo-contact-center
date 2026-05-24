/**
 * Seed script — creates initial admin user + sample agents.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { loadEnv } from '../config/env.js';
import { initDatabase } from '../config/database.js';
import { initModels } from '../models/index.js';

async function seed() {
  const env = loadEnv();
  const sequelize = initDatabase(env.DATABASE_URL);
  const models = initModels(sequelize);

  await sequelize.sync({ alter: true });

  // Admin user
  const [admin, adminCreated] = await models.User.findOrCreate({
    where: { username: 'admin' },
    defaults: {
      username: 'admin',
      password: await bcrypt.hash('admin1234', 12),
      displayName: 'Admin User',
      role: 'admin',
    },
  });

  if (adminCreated) {
    await models.Agent.create({
      userId: admin.id,
      priority: 99,
      status: 'offline',
      queues: ['clinical_queue', 'care_queue', 'billing_queue'],
      sipUsername: 'admin',
    });
    console.log('✅ Created admin user (admin / admin1234)');
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // Agent 1 (priority 1 — gets calls first)
  const [agent1, a1Created] = await models.User.findOrCreate({
    where: { username: 'agent1' },
    defaults: {
      username: 'agent1',
      password: await bcrypt.hash('agent1234', 12),
      displayName: 'Agent One',
      role: 'agent',
    },
  });

  if (a1Created) {
    await models.Agent.create({
      userId: agent1.id,
      priority: 1,
      status: 'offline',
      queues: ['clinical_queue', 'care_queue'],
      sipUsername: 'agent1',
    });
    console.log('✅ Created agent1 (agent1 / agent1234)');
  }

  // Agent 2 (priority 2 — backup, also supervisor candidate)
  const [agent2, a2Created] = await models.User.findOrCreate({
    where: { username: 'agent2' },
    defaults: {
      username: 'agent2',
      password: await bcrypt.hash('agent1234', 12),
      displayName: 'Agent Two',
      role: 'supervisor',
    },
  });

  if (a2Created) {
    await models.Agent.create({
      userId: agent2.id,
      priority: 2,
      status: 'offline',
      queues: ['clinical_queue', 'billing_queue'],
      sipUsername: 'agent2',
    });
    console.log('✅ Created agent2/supervisor (agent2 / agent1234)');
  }

  // Sample IVR flow for the demo
  const [demoFlow, flowCreated] = await models.IvrFlow.findOrCreate({
    where: { name: 'Trilogy Care Main IVR' },
    defaults: {
      name: 'Trilogy Care Main IVR',
      description: 'Main IVR for aged-care inbound calls — press 1 for care schedule, 2 for clinical, 3 for billing',
      nodes: [
        { id: '1', type: 'answer', data: {}, position: { x: 250, y: 0 } },
        { id: '2', type: 'speak', data: { text: 'Welcome to Trilogy Care. Press 1 for care schedule, 2 for clinical enquiries, or 3 for billing.' }, position: { x: 250, y: 120 } },
        { id: '3', type: 'gather', data: { maxDigits: 1, timeout: 10000, validDigits: '123' }, position: { x: 250, y: 240 } },
        { id: '4', type: 'enqueue', data: { queueName: 'care_queue' }, position: { x: 50, y: 380 } },
        { id: '5', type: 'enqueue', data: { queueName: 'clinical_queue' }, position: { x: 250, y: 380 } },
        { id: '6', type: 'enqueue', data: { queueName: 'billing_queue' }, position: { x: 450, y: 380 } },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4', sourceHandle: '1', label: '1 — Care Schedule' },
        { id: 'e3-5', source: '3', target: '5', sourceHandle: '2', label: '2 — Clinical' },
        { id: 'e3-6', source: '3', target: '6', sourceHandle: '3', label: '3 — Billing' },
      ],
      published: false,
    },
  });

  if (flowCreated) {
    console.log('✅ Created demo IVR flow');
  }

  // ── Default dispositions ────────────────────────────────────────────
  const defaultDispositions = [
    { name: 'Resolved',          category: 'resolved',  color: '#10b981', icon: 'check-circle',  sortOrder: 10 },
    { name: 'Escalated',         category: 'escalated', color: '#f59e0b', icon: 'arrow-up-right', sortOrder: 20, requireNotes: true },
    { name: 'Callback Required', category: 'callback',  color: '#3b82f6', icon: 'phone-call',    sortOrder: 30 },
    { name: 'Spam',              category: 'spam',      color: '#ef4444', icon: 'shield-alert',  sortOrder: 40 },
    { name: 'Information Only',  category: 'info',      color: '#64748b', icon: 'info',          sortOrder: 50 },
    { name: 'Voicemail',         category: 'voicemail', color: '#8b5cf6', icon: 'voicemail',     sortOrder: 60 },
    { name: 'Wrong Number',      category: 'wrong',     color: '#6b7280', icon: 'phone-off',     sortOrder: 70 },
    { name: 'Follow-up Needed',  category: 'followup',  color: '#06b6d4', icon: 'clock',         sortOrder: 80, requireNotes: true },
  ];

  // Guard: Disposition model may not be registered in all environments
  if (models.Disposition) {
    let dispositionsCreated = 0;
    for (const d of defaultDispositions) {
      const [, created] = await models.Disposition.findOrCreate({
        where: { name: d.name },
        defaults: d,
      });
      if (created) dispositionsCreated++;
    }
    if (dispositionsCreated > 0) {
      console.log(`✅ Created ${dispositionsCreated} default disposition(s)`);
    } else {
      console.log('ℹ️  Dispositions already exist');
    }
  }

  // ── Default canned responses ────────────────────────────────────────
  //
  // These show up in the Agent Assist → Library tab. Agents type the shortcut
  // (e.g. /greeting) in the search box or use them as clipboard-ready snippets.
  const defaultCannedResponses = [
    {
      shortcut: '/greeting',
      title: 'Standard greeting',
      content: 'Thank you for calling [Company], my name is [Agent]. How can I help you today?',
      category: 'greetings',
      tags: ['intro', 'welcome'],
    },
    {
      shortcut: '/hold',
      title: 'Place on hold',
      content: "I'll need to place you on a brief hold while I look into this. Is that okay?",
      category: 'hold',
      tags: ['hold', 'wait'],
    },
    {
      shortcut: '/transfer',
      title: 'Transfer notice',
      content: "I'm going to transfer you to our specialist team who can better assist you.",
      category: 'transfer',
      tags: ['transfer', 'specialist'],
    },
    {
      shortcut: '/resolve',
      title: 'Resolution close',
      content: "I'm glad I could help resolve that for you today. Is there anything else I can assist you with?",
      category: 'closing',
      tags: ['close', 'resolved'],
    },
    {
      shortcut: '/callback',
      title: 'Schedule callback',
      content: "I'll schedule a callback for you. What's the best number and time to reach you?",
      category: 'callback',
      tags: ['callback', 'schedule'],
    },
    {
      shortcut: '/escalate',
      title: 'Escalate to supervisor',
      content: "I understand this is important. Let me connect you with my supervisor who can assist you further.",
      category: 'escalation',
      tags: ['escalate', 'supervisor'],
    },
    {
      shortcut: '/sorry',
      title: 'Sincere apology',
      content: "I sincerely apologise for the inconvenience. Let me make this right for you.",
      category: 'empathy',
      tags: ['apology', 'sorry'],
    },
    {
      shortcut: '/verify',
      title: 'Identity verification',
      content: 'For security purposes, can I please verify your account with your full name and the last four digits of your registered phone number?',
      category: 'security',
      tags: ['verify', 'security', 'identity'],
    },
  ];

  let cannedCreated = 0;
  for (const cr of defaultCannedResponses) {
    const [, created] = await models.CannedResponse.findOrCreate({
      where: { shortcut: cr.shortcut },
      defaults: cr,
    });
    if (created) cannedCreated++;
  }
  if (cannedCreated > 0) {
    console.log(`✅ Created ${cannedCreated} default canned response(s)`);
  } else {
    console.log('ℹ️  Canned responses already exist');
  }

  // ── Seed AgentSession rows for all existing agents ───────────────
  const allAgents = await models.Agent.findAll();
  let sessionsCreated = 0;
  for (const agent of allAgents) {
    const [session, created] = await models.AgentSession.findOrCreate({
      where: { agentId: agent.id },
      defaults: {
        agentId: agent.id,
        status: 'offline',
        currentCallId: null,
        statusChangedAt: new Date(),
        lastHeartbeat: new Date(),
      },
    });
    if (created) sessionsCreated++;
  }
  if (sessionsCreated > 0) {
    console.log(`✅ Created ${sessionsCreated} AgentSession row(s)`);
  } else {
    console.log('ℹ️  AgentSession rows already exist');
  }

  // ── Seed Forms ────────────────────────────────────────────────────
  const formCount = await models.Form.count();
  if (formCount === 0) {
    // 1. Customer Intake Form
    await models.Form.create({
      name: 'Customer Intake',
      description: 'Collect customer details during first contact',
      schema: {
        version: 1,
        pages: [
          {
            id: crypto.randomUUID(),
            title: 'Customer Information',
            sections: [
              {
                id: crypto.randomUUID(),
                type: 'card',
                title: 'Personal Details',
                props: {},
                fields: [
                  { id: crypto.randomUUID(), type: 'text', label: 'Full Name', variable: 'customer_name', required: true, placeholder: 'Enter full name', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'email', label: 'Email', variable: 'customer_email', required: false, placeholder: 'email@example.com', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'phone', label: 'Phone Number', variable: 'customer_phone', required: true, placeholder: '+1 (555) 000-0000', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'select', label: 'Contact Reason', variable: 'contact_reason', required: true, placeholder: 'Select reason', options: ['Billing', 'Technical Support', 'Sales', 'General Inquiry', 'Complaint'], validation: {}, props: {} },
                ],
              },
              {
                id: crypto.randomUUID(),
                type: 'default',
                title: 'Issue Details',
                props: {},
                fields: [
                  { id: crypto.randomUUID(), type: 'textarea', label: 'Description', variable: 'issue_description', required: true, placeholder: 'Describe the issue...', options: [], validation: {}, props: { rows: 4 } },
                  { id: crypto.randomUUID(), type: 'slider', label: 'Urgency', variable: 'urgency', required: false, placeholder: '', options: [], validation: { min: 1, max: 10 }, props: { min: 1, max: 10, step: 1 } },
                  { id: crypto.randomUUID(), type: 'flag', label: 'Priority', variable: 'priority', required: false, placeholder: '', options: [], validation: {}, props: { levels: ['low', 'medium', 'high', 'critical'] } },
                ],
              },
            ],
          },
        ],
        actions: [
          { id: crypto.randomUUID(), label: 'Create Ticket', type: 'workflow', workflowId: null, variant: 'primary' },
          { id: crypto.randomUUID(), label: 'Submit', type: 'submit', variant: 'secondary' },
        ],
      },
      enabled: true,
    });

    // 2. Call Escalation Form
    await models.Form.create({
      name: 'Escalation Form',
      description: 'Document and process call escalations',
      schema: {
        version: 1,
        pages: [
          {
            id: crypto.randomUUID(),
            title: 'Escalation Details',
            sections: [
              {
                id: crypto.randomUUID(),
                type: 'card',
                title: 'Escalation Info',
                props: {},
                fields: [
                  { id: crypto.randomUUID(), type: 'select', label: 'Escalation Type', variable: 'escalation_type', required: true, placeholder: '', options: ['Supervisor', 'Manager', 'Specialist', 'Engineering'], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'textarea', label: 'Reason for Escalation', variable: 'escalation_reason', required: true, placeholder: 'Why is this being escalated?', options: [], validation: {}, props: { rows: 3 } },
                  { id: crypto.randomUUID(), type: 'switch', label: 'Customer is Waiting', variable: 'customer_waiting', required: false, placeholder: '', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'select', label: 'Sentiment', variable: 'customer_sentiment', required: false, placeholder: '', options: ['Calm', 'Frustrated', 'Angry', 'Upset'], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'badge', label: 'SLA', variable: 'sla_level', required: false, placeholder: '', options: [], validation: {}, props: { variant: 'default', color: 'red' } },
                ],
              },
            ],
          },
        ],
        actions: [
          { id: crypto.randomUUID(), label: 'Escalate Now', type: 'workflow', workflowId: null, variant: 'danger' },
          { id: crypto.randomUUID(), label: 'Save Draft', type: 'submit', variant: 'secondary' },
        ],
      },
      enabled: true,
    });

    // 3. Customer Feedback Form
    await models.Form.create({
      name: 'Post-Call Survey',
      description: 'Collect customer feedback after a call',
      schema: {
        version: 1,
        pages: [
          {
            id: crypto.randomUUID(),
            title: 'Feedback',
            sections: [
              {
                id: crypto.randomUUID(),
                type: 'default',
                title: '',
                props: {},
                fields: [
                  { id: crypto.randomUUID(), type: 'rating', label: 'Overall Experience', variable: 'overall_rating', required: true, placeholder: '', options: [], validation: { max: 5 }, props: { max: 5 } },
                  { id: crypto.randomUUID(), type: 'rating', label: 'Agent Helpfulness', variable: 'agent_rating', required: true, placeholder: '', options: [], validation: { max: 5 }, props: { max: 5 } },
                  { id: crypto.randomUUID(), type: 'slider', label: 'Net Promoter Score', variable: 'nps', required: false, placeholder: '', options: [], validation: { min: 0, max: 10 }, props: { min: 0, max: 10, step: 1 } },
                  { id: crypto.randomUUID(), type: 'textarea', label: 'Comments', variable: 'comments', required: false, placeholder: 'Any additional feedback...', options: [], validation: {}, props: { rows: 3 } },
                  { id: crypto.randomUUID(), type: 'switch', label: 'Would Recommend', variable: 'would_recommend', required: false, placeholder: '', options: [], validation: {}, props: {} },
                ],
              },
            ],
          },
        ],
        actions: [
          { id: crypto.randomUUID(), label: 'Submit Feedback', type: 'submit', variant: 'primary' },
        ],
      },
      enabled: true,
    });

    console.log('✅ Created 3 sample forms');
  } else {
    console.log('ℹ️  Forms already exist');
  }

  // ── Seed Form Templates ──────────────────────────────────────────
  const templateCount = await models.FormTemplate.count();
  if (templateCount === 0) {
    const templates = [
      {
        name: 'Customer Intake',
        description: 'Collect customer details during first contact — name, contact info, reason, and urgency',
        category: 'customer-service',
        icon: 'UserPlus',
        isBuiltIn: true,
        schema: {
          version: 1,
          pages: [{
            id: crypto.randomUUID(), title: 'Customer Information',
            sections: [
              {
                id: crypto.randomUUID(), type: 'card', title: 'Personal Details', props: {},
                fields: [
                  { id: crypto.randomUUID(), type: 'text', label: 'Full Name', variable: 'customer_name', required: true, placeholder: 'Enter full name', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'email', label: 'Email', variable: 'customer_email', required: false, placeholder: 'email@example.com', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'phone', label: 'Phone Number', variable: 'customer_phone', required: true, placeholder: '+1 (555) 000-0000', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'select', label: 'Contact Reason', variable: 'contact_reason', required: true, placeholder: 'Select reason', options: ['Billing', 'Technical Support', 'Sales', 'General Inquiry', 'Complaint'], validation: {}, props: {} },
                ],
              },
              {
                id: crypto.randomUUID(), type: 'default', title: 'Issue Details', props: {},
                fields: [
                  { id: crypto.randomUUID(), type: 'textarea', label: 'Description', variable: 'issue_description', required: true, placeholder: 'Describe the issue...', options: [], validation: {}, props: { rows: 4 } },
                  { id: crypto.randomUUID(), type: 'slider', label: 'Urgency', variable: 'urgency', required: false, placeholder: '', options: [], validation: { min: 1, max: 10 }, props: { min: 1, max: 10, step: 1 } },
                  { id: crypto.randomUUID(), type: 'flag', label: 'Priority', variable: 'priority', required: false, placeholder: '', options: [], validation: {}, props: { levels: ['low', 'medium', 'high', 'critical'] } },
                ],
              },
            ],
          }],
          actions: [
            { id: crypto.randomUUID(), label: 'Create Ticket', type: 'workflow', workflowId: null, variant: 'primary' },
            { id: crypto.randomUUID(), label: 'Submit', type: 'submit', variant: 'secondary' },
          ],
        },
      },
      {
        name: 'Escalation Request',
        description: 'Process and track call escalations with priority and routing',
        category: 'customer-service',
        icon: 'AlertTriangle',
        isBuiltIn: true,
        schema: {
          version: 1,
          pages: [{
            id: crypto.randomUUID(), title: 'Escalation Details',
            sections: [{
              id: crypto.randomUUID(), type: 'card', title: 'Escalation Info', props: {},
              fields: [
                { id: crypto.randomUUID(), type: 'select', label: 'Escalation Type', variable: 'escalation_type', required: true, placeholder: '', options: ['Supervisor', 'Manager', 'Specialist', 'Engineering'], validation: {}, props: {} },
                { id: crypto.randomUUID(), type: 'textarea', label: 'Reason for Escalation', variable: 'escalation_reason', required: true, placeholder: 'Why is this being escalated?', options: [], validation: {}, props: { rows: 3 } },
                { id: crypto.randomUUID(), type: 'switch', label: 'Customer is Waiting', variable: 'customer_waiting', required: false, placeholder: '', options: [], validation: {}, props: {} },
                { id: crypto.randomUUID(), type: 'select', label: 'Sentiment', variable: 'customer_sentiment', required: false, placeholder: '', options: ['Calm', 'Frustrated', 'Angry', 'Upset'], validation: {}, props: {} },
                { id: crypto.randomUUID(), type: 'badge', label: 'SLA', variable: 'sla_level', required: false, placeholder: '', options: [], validation: {}, props: { variant: 'default', color: 'red' } },
              ],
            }],
          }],
          actions: [
            { id: crypto.randomUUID(), label: 'Escalate Now', type: 'workflow', workflowId: null, variant: 'danger' },
            { id: crypto.randomUUID(), label: 'Save Draft', type: 'submit', variant: 'secondary' },
          ],
        },
      },
      {
        name: 'Post-Call Survey',
        description: 'Collect customer feedback with ratings and NPS',
        category: 'feedback',
        icon: 'Star',
        isBuiltIn: true,
        schema: {
          version: 1,
          pages: [{
            id: crypto.randomUUID(), title: 'Feedback',
            sections: [{
              id: crypto.randomUUID(), type: 'default', title: '', props: {},
              fields: [
                { id: crypto.randomUUID(), type: 'rating', label: 'Overall Experience', variable: 'overall_rating', required: true, placeholder: '', options: [], validation: { max: 5 }, props: { max: 5 } },
                { id: crypto.randomUUID(), type: 'rating', label: 'Agent Helpfulness', variable: 'agent_rating', required: true, placeholder: '', options: [], validation: { max: 5 }, props: { max: 5 } },
                { id: crypto.randomUUID(), type: 'slider', label: 'Net Promoter Score', variable: 'nps', required: false, placeholder: '', options: [], validation: { min: 0, max: 10 }, props: { min: 0, max: 10, step: 1 } },
                { id: crypto.randomUUID(), type: 'textarea', label: 'Comments', variable: 'comments', required: false, placeholder: 'Any additional feedback...', options: [], validation: {}, props: { rows: 3 } },
                { id: crypto.randomUUID(), type: 'switch', label: 'Would Recommend', variable: 'would_recommend', required: false, placeholder: '', options: [], validation: {}, props: {} },
              ],
            }],
          }],
          actions: [
            { id: crypto.randomUUID(), label: 'Submit Feedback', type: 'submit', variant: 'primary' },
          ],
        },
      },
      {
        name: 'Lead Qualification',
        description: 'Qualify sales leads with budget, authority, need, and timeline questions',
        category: 'sales',
        icon: 'Target',
        isBuiltIn: true,
        schema: {
          version: 1,
          pages: [{
            id: crypto.randomUUID(), title: 'Lead Qualification (BANT)',
            sections: [
              {
                id: crypto.randomUUID(), type: 'card', title: 'Contact Info', props: {},
                fields: [
                  { id: crypto.randomUUID(), type: 'text', label: 'Contact Name', variable: 'contact_name', required: true, placeholder: '', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'text', label: 'Company', variable: 'company', required: true, placeholder: '', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'select', label: 'Industry', variable: 'industry', required: false, placeholder: 'Select industry', options: ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Education', 'Other'], validation: {}, props: {} },
                ],
              },
              {
                id: crypto.randomUUID(), type: 'card', title: 'BANT Assessment', props: {},
                fields: [
                  { id: crypto.randomUUID(), type: 'slider', label: 'Budget Score', variable: 'budget_score', required: false, placeholder: '', options: [], validation: { min: 1, max: 10 }, props: { min: 1, max: 10, step: 1 } },
                  { id: crypto.randomUUID(), type: 'slider', label: 'Authority Score', variable: 'authority_score', required: false, placeholder: '', options: [], validation: { min: 1, max: 10 }, props: { min: 1, max: 10, step: 1 } },
                  { id: crypto.randomUUID(), type: 'slider', label: 'Need Score', variable: 'need_score', required: false, placeholder: '', options: [], validation: { min: 1, max: 10 }, props: { min: 1, max: 10, step: 1 } },
                  { id: crypto.randomUUID(), type: 'slider', label: 'Timeline Score', variable: 'timeline_score', required: false, placeholder: '', options: [], validation: { min: 1, max: 10 }, props: { min: 1, max: 10, step: 1 } },
                  { id: crypto.randomUUID(), type: 'select', label: 'Lead Temperature', variable: 'lead_temperature', required: true, placeholder: '', options: ['Cold', 'Warm', 'Hot'], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'datetime', label: 'Follow-up Date', variable: 'followup_date', required: false, placeholder: '', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'textarea', label: 'Notes', variable: 'notes', required: false, placeholder: 'Additional notes...', options: [], validation: {}, props: { rows: 3 } },
                ],
              },
            ],
          }],
          actions: [
            { id: crypto.randomUUID(), label: 'Create Lead', type: 'workflow', workflowId: null, variant: 'primary' },
            { id: crypto.randomUUID(), label: 'Save Draft', type: 'submit', variant: 'secondary' },
          ],
        },
      },
      {
        name: 'IT Service Request',
        description: 'Submit IT support requests with category, priority, and device info',
        category: 'it',
        icon: 'Monitor',
        isBuiltIn: true,
        schema: {
          version: 1,
          pages: [{
            id: crypto.randomUUID(), title: 'Service Request',
            sections: [{
              id: crypto.randomUUID(), type: 'card', title: 'Request Details', props: {},
              fields: [
                { id: crypto.randomUUID(), type: 'select', label: 'Category', variable: 'category', required: true, placeholder: 'Select category', options: ['Hardware', 'Software', 'Network', 'Access/Permissions', 'Email', 'Other'], validation: {}, props: {} },
                { id: crypto.randomUUID(), type: 'select', label: 'Priority', variable: 'priority', required: true, placeholder: '', options: ['Low', 'Medium', 'High', 'Critical'], validation: {}, props: {} },
                { id: crypto.randomUUID(), type: 'text', label: 'Device/Asset ID', variable: 'device_id', required: false, placeholder: 'e.g., LAP-01234', options: [], validation: { pattern: '^[A-Z]+-[0-9]+$', patternMessage: 'Format: TYPE-12345' }, props: {} },
                { id: crypto.randomUUID(), type: 'textarea', label: 'Description', variable: 'description', required: true, placeholder: 'Describe the issue...', options: [], validation: { minLength: 20 }, props: { rows: 4 } },
                { id: crypto.randomUUID(), type: 'switch', label: 'Business Impact', variable: 'business_impact', required: false, placeholder: '', options: [], validation: {}, props: {} },
                { id: crypto.randomUUID(), type: 'date', label: 'Needed By', variable: 'needed_by', required: false, placeholder: '', options: [], validation: {}, props: {} },
              ],
            }],
          }],
          actions: [
            { id: crypto.randomUUID(), label: 'Submit Request', type: 'submit', variant: 'primary' },
          ],
        },
      },
      {
        name: 'HR Onboarding Checklist',
        description: 'New employee onboarding form with personal details, equipment needs, and access requests',
        category: 'hr',
        icon: 'ClipboardCheck',
        isBuiltIn: true,
        schema: {
          version: 1,
          pages: [
            {
              id: crypto.randomUUID(), title: 'Personal Info',
              sections: [{
                id: crypto.randomUUID(), type: 'card', title: 'Employee Details', props: {},
                fields: [
                  { id: crypto.randomUUID(), type: 'text', label: 'Full Name', variable: 'employee_name', required: true, placeholder: '', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'email', label: 'Work Email', variable: 'work_email', required: true, placeholder: '', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'text', label: 'Job Title', variable: 'job_title', required: true, placeholder: '', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'text', label: 'Department', variable: 'department', required: true, placeholder: '', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'date', label: 'Start Date', variable: 'start_date', required: true, placeholder: '', options: [], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'select', label: 'Office Location', variable: 'office_location', required: false, placeholder: '', options: ['Melbourne', 'Sydney', 'Brisbane', 'Remote'], validation: {}, props: {} },
                ],
              }],
            },
            {
              id: crypto.randomUUID(), title: 'Equipment & Access',
              sections: [{
                id: crypto.randomUUID(), type: 'card', title: 'Equipment Needs', props: {},
                fields: [
                  { id: crypto.randomUUID(), type: 'multiselect', label: 'Equipment Required', variable: 'equipment', required: false, placeholder: '', options: ['Laptop', 'Monitor', 'Keyboard', 'Mouse', 'Headset', 'Phone'], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'multiselect', label: 'System Access', variable: 'system_access', required: false, placeholder: '', options: ['Email', 'VPN', 'CRM', 'ERP', 'Slack', 'GitHub', 'AWS Console'], validation: {}, props: {} },
                  { id: crypto.randomUUID(), type: 'textarea', label: 'Special Requirements', variable: 'special_requirements', required: false, placeholder: 'Any special needs or accommodations...', options: [], validation: {}, props: { rows: 3 } },
                ],
              }],
            },
          ],
          actions: [
            { id: crypto.randomUUID(), label: 'Submit Onboarding', type: 'submit', variant: 'primary' },
          ],
        },
      },
    ];

    for (const tpl of templates) {
      await models.FormTemplate.create(tpl);
    }
    console.log(`✅ Created ${templates.length} form templates`);
  } else {
    console.log('ℹ️  Form templates already exist');
  }

  await sequelize.close();
  console.log('\n🌱 Seed complete');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
