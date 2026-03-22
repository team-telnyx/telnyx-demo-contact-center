import express from 'express';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { authenticate, authorize } from '../src/middleware/auth.js';
import User from '../models/User.js';
import CallRecord from '../models/CallRecord.js';
import Settings from '../models/Settings.js';
import Telnyx from 'telnyx';
import crypto from 'crypto';
import { encrypt } from '../src/utils/encryption.js';
import { invalidateOrgCache } from '../src/services/org-telnyx.js';
import { broadcast } from './websocket.js';

const router = express.Router();

const generateRandomString = (length) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(authorize('admin'));

// ===================== USER CRUD =====================

// GET /users - List all users with pagination
router.get('/users', async (req, res) => {
  try {
    const { page = 1, size = 20 } = req.query;
    const limit = Math.min(parseInt(size) || 20, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
      attributes: { exclude: ['password', 'sipPassword', 'avatar'] },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      users: rows,
      total: count,
      page: parseInt(page) || 1,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /users/:id - Get single user details
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'sipPassword', 'avatar'] },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /users - Create new user
router.post('/users', async (req, res) => {
  try {
    const { username, password, firstName, lastName, role, assignedQueue, routingPriority } = req.body;

    if (!username || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'username, password, firstName, and lastName are required' });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const agentUlid = Date.now().toString(36) + generateRandomString(8);
    const sipUsername = `agent${agentUlid}`;
    const sipPassword = generateRandomString(32);
    const encryptedSipPassword = encrypt(sipPassword);

    const newUser = await User.create({
      username,
      password: hashedPassword,
      firstName,
      lastName,
      role: role || 'agent',
      assignedQueue: assignedQueue || 'General_Queue',
      routingPriority: routingPriority || 10,
      sipUsername,
      sipPassword: encryptedSipPassword,
      status: 'offline',
    });

    const { password: _, sipPassword: __, avatar: ___, ...userData } = newUser.toJSON();
    broadcast('USER_CREATED', userData);
    res.status(201).json(userData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /users/:id - Update user
router.put('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { role, assignedQueue, routingPriority, firstName, lastName, maxCalls, maxConversations } = req.body;

    if (role !== undefined) user.role = role;
    if (assignedQueue !== undefined) user.assignedQueue = assignedQueue;
    if (routingPriority !== undefined) user.routingPriority = routingPriority;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (maxCalls !== undefined) user.maxCalls = maxCalls;
    if (maxConversations !== undefined) user.maxConversations = maxConversations;

    await user.save();

    const { password: _, sipPassword: __, avatar: ___, ...userData } = user.toJSON();
    broadcast('USER_UPDATED', userData);
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /users/:id - Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent admin from deleting themselves
    if (user.username === req.user.username) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const deletedId = user.id;
    const deletedUsername = user.username;
    await user.destroy();
    broadcast('USER_DELETED', { id: deletedId, username: deletedUsername });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== AGENT METRICS (Task 16) =====================

router.get('/metrics/agents', async (req, res) => {
  try {
    const agents = await User.findAll({
      attributes: { exclude: ['password', 'sipPassword', 'avatar'] },
    });

    const statusCounts = {
      online: 0, busy: 0, away: 0, offline: 0, break: 0, dnd: 0,
    };

    const agentDetails = agents.map(agent => {
      statusCounts[agent.status] = (statusCounts[agent.status] || 0) + 1;
      return {
        id: agent.id,
        username: agent.username,
        firstName: agent.firstName,
        lastName: agent.lastName,
        status: agent.status,
        role: agent.role,
        assignedQueue: agent.assignedQueue,
        routingPriority: agent.routingPriority,
      };
    });

    res.json({
      statusCounts,
      totalAgents: agents.length,
      agents: agentDetails,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== CALL REPORTS (Task 17) =====================

router.get('/reports/calls', async (req, res) => {
  try {
    const { startDate, endDate, agentUsername, queueName } = req.query;
    const where = {};

    if (startDate) where.startedAt = { [Op.gte]: new Date(startDate) };
    if (endDate) where.startedAt = { ...where.startedAt, [Op.lte]: new Date(endDate) };
    if (agentUsername) where.agentUsername = agentUsername;
    if (queueName) where.queueName = queueName;

    const totalCalls = await CallRecord.count({ where });

    const avgDuration = await CallRecord.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('durationSeconds')), 'avgDuration']],
      where: { ...where, status: 'completed' },
      raw: true,
    });

    const avgWaitTime = await CallRecord.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('waitTimeSeconds')), 'avgWaitTime']],
      where,
      raw: true,
    });

    const callsByAgent = await CallRecord.findAll({
      attributes: ['agentUsername', [sequelize.fn('COUNT', sequelize.col('id')), 'callCount']],
      where,
      group: ['agentUsername'],
      raw: true,
    });

    const callsByStatus = await CallRecord.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where,
      group: ['status'],
      raw: true,
    });

    res.json({
      totalCalls,
      avgDuration: avgDuration?.avgDuration || 0,
      avgWaitTime: avgWaitTime?.avgWaitTime || 0,
      callsByAgent,
      callsByStatus,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== ORGANIZATION SETTINGS =====================

function generateULID() {
  const t = Date.now().toString(36).padStart(10, '0');
  const r = crypto.randomBytes(10).toString('hex').slice(0, 16);
  return (t + r).toUpperCase();
}

router.get('/settings', async (req, res) => {
  try {
    const rows = await Settings.findAll();
    const settings = {};
    for (const row of rows) {
      if (row.key === 'orgTelnyxApiKey' && row.value) {
        settings[row.key] = row.value.slice(0, 8) + '...' + row.value.slice(-4);
      } else {
        settings[row.key] = row.value;
      }
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { orgTelnyxApiKey, orgTelnyxPublicKey } = req.body;

    if (orgTelnyxPublicKey !== undefined) {
      await Settings.upsert({ key: 'orgTelnyxPublicKey', value: orgTelnyxPublicKey || null });
    }

    // Save API key if provided
    if (orgTelnyxApiKey) {
      await Settings.upsert({ key: 'orgTelnyxApiKey', value: orgTelnyxApiKey });
      invalidateOrgCache();
    }

    invalidateOrgCache();

    // Provision connections for any unprovisioned users when API key exists
    const currentApiKey = orgTelnyxApiKey || (await Settings.findByPk('orgTelnyxApiKey'))?.value;
    if (currentApiKey) {
      const { getWebhookBaseUrl } = await import('../src/services/org-telnyx.js');
      const telnyx = new Telnyx({ apiKey: currentApiKey });
      const webhookBase = getWebhookBaseUrl();

      const unprovisionedUsers = await User.findAll({
        where: {
          [Op.or]: [
            { webrtcConnectionId: null },
            { appConnectionId: null },
            { messagingProfileId: null },
            { outboundVoiceProfileId: null },
          ],
          sipUsername: { [Op.ne]: null },
        },
      });

      const { decrypt } = await import('../src/utils/encryption.js');

      for (const user of unprovisionedUsers) {
        const ulid = generateULID();
        const prefix = user.role === 'admin' ? 'admin' : 'agent';
        const ts = Date.now().toString(36);

        // Fix SIP username if needed (must be alphanumeric only)
        if (!user.sipUsername.startsWith('admin') && !user.sipUsername.startsWith('agent')) {
          const newSipUsername = `${prefix}${ulid}`;
          const newSipPassword = generateRandomString(32);
          user.sipUsername = newSipUsername;
          user.sipPassword = encrypt(newSipPassword);
        }

        // Create Outbound Voice Profile (all destinations)
        if (!user.outboundVoiceProfileId) {
          try {
            const ovp = await telnyx.outboundVoiceProfiles.create({
              name: `${prefix}_OVP_${ts}_${user.sipUsername}`,
              enabled: true,
              whitelisted_destinations: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BR', 'MX', 'IN', 'JP', 'KR', 'SG', 'HK', 'NZ', 'IE', 'SE', 'NO', 'DK', 'FI', 'PL', 'AT', 'CH', 'BE', 'PT', 'CZ', 'IL', 'ZA'],
            });
            user.outboundVoiceProfileId = ovp.data?.id;
            console.log(`[Settings] Created OVP for ${user.username}: ${user.outboundVoiceProfileId}`);
          } catch (err) {
            console.error(`[Settings] OVP failed for ${user.username}:`, err.raw?.errors?.[0]?.detail || err.message);
          }
        }

        // Create Voice API Application + link OVP
        if (!user.appConnectionId) {
          try {
            const app = await telnyx.callControlApplications.create({
              application_name: `${prefix}_VoiceApp_${ts}_${user.sipUsername}`,
              webhook_event_url: `${webhookBase}/api/voice/webhook`,
              active: true,
            });
            user.appConnectionId = app.data?.id;
            if (user.outboundVoiceProfileId && user.appConnectionId) {
              await telnyx.callControlApplications.update(user.appConnectionId, {
                outbound: { outbound_voice_profile_id: user.outboundVoiceProfileId },
              });
            }
            console.log(`[Settings] Created Voice App for ${user.username}: ${user.appConnectionId} (OVP: ${user.outboundVoiceProfileId})`);
          } catch (err) {
            console.error(`[Settings] Voice App failed for ${user.username}:`, err.raw?.errors?.[0]?.detail || err.message);
          }
        }

        // Create SIP Credential Connection
        if (!user.webrtcConnectionId) {
          try {
            const plainSipPassword = decrypt(user.sipPassword);
            const connBody = {
              connection_name: `${prefix}_SIPConn_${ts}_${user.sipUsername}`,
              user_name: user.sipUsername,
              password: plainSipPassword,
              webhook_event_url: `${webhookBase}/api/voice/outbound-webrtc`,
              sip_uri_calling_preference: 'internal',
              outbound: { call_parking_enabled: true },
            };
            if (user.outboundVoiceProfileId) connBody.outbound.outbound_voice_profile_id = user.outboundVoiceProfileId;
            const conn = await telnyx.credentialConnections.create(connBody);
            user.webrtcConnectionId = conn.data?.id;
            console.log(`[Settings] Created SIP Connection for ${user.username}: ${user.webrtcConnectionId}`);
          } catch (err) {
            console.error(`[Settings] SIP Connection failed for ${user.username}:`, err.raw?.errors?.[0]?.detail || err.message);
          }
        }

        // Create Messaging Profile (all destinations)
        if (!user.messagingProfileId) {
          try {
            const mp = await telnyx.messagingProfiles.create({
              name: `${prefix}_MsgProfile_${ts}_${user.sipUsername}`,
              enabled: true,
              whitelisted_destinations: ['*'],
            });
            user.messagingProfileId = mp.data?.id;
            console.log(`[Settings] Created Messaging Profile for ${user.username}: ${user.messagingProfileId}`);
          } catch (err) {
            console.error(`[Settings] Messaging Profile failed for ${user.username}:`, err.raw?.errors?.[0]?.detail || err.message);
          }
        }

        await user.save();
      }

      const provisionedCount = unprovisionedUsers.length;
      return res.json({
        message: provisionedCount > 0
          ? `Settings saved. Provisioned ${provisionedCount} user(s).`
          : 'Settings saved.',
      });
    }

    res.json({ message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
