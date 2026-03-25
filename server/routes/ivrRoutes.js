import express from 'express';
import { Op } from 'sequelize';
import axios from 'axios';
import { env } from '../src/config/env.js';
import IvrFlow from '../models/IvrFlow.js';
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import { authenticate } from '../src/middleware/auth.js';
import { getOrgTelnyxClient } from '../src/services/org-telnyx.js';

const router = express.Router();

// Get available TTS voices
let cachedVoices = null;
let voicesCachedAt = 0;
const VOICES_CACHE_TTL = 3600000; // 1 hour

router.get('/voices', authenticate, async (req, res) => {
  try {
    if (cachedVoices && Date.now() - voicesCachedAt < VOICES_CACHE_TTL) {
      return res.json(cachedVoices);
    }
    const telnyx = await getOrgTelnyxClient();
    const result = await telnyx.textToSpeech.listVoices();
    const voices = result.voices || [];
    // Group by provider, only include English voices + all providers
    const grouped = {};
    voices.forEach((v) => {
      const provider = v.provider || 'other';
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push({
        id: v.id,
        name: v.name,
        gender: v.gender,
        language: v.language,
      });
    });
    cachedVoices = grouped;
    voicesCachedAt = Date.now();
    res.json(grouped);
  } catch (err) {
    console.error('Error fetching voices:', err.message);
    res.json({});
  }
});

// Get phone numbers assigned to the agent's voice application
router.get('/connection-numbers', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ where: { username: req.user.username } });
    if (!user?.appConnectionId) {
      return res.json([]);
    }

    const apiKeySetting = await Settings.findByPk('orgTelnyxApiKey');
    const apiKey = apiKeySetting?.value || process.env.TELNYX_API;
    // Fetch all org numbers (not just those on this voice app) — publish will reassign
    const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      params: {
        'page[size]': 250,
      },
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const numbers = response.data.data.map((n) => ({
      id: n.id,
      phone_number: n.phone_number,
      connection_id: n.connection_id,
    }));
    res.json(numbers);
  } catch (err) {
    console.error('Error fetching connection numbers:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch phone numbers' });
  }
});

// List all flows for the current user
router.get('/', authenticate, async (req, res) => {
  try {
    const flows = await IvrFlow.findAll({
      where: { createdBy: req.user.username },
      order: [['updatedAt', 'DESC']],
      attributes: ['id', 'name', 'description', 'phoneNumber', 'active', 'hasDraft', 'publishedAt', 'createdBy', 'createdAt', 'updatedAt'],
    });
    res.json(flows);
  } catch (err) {
    console.error('Error listing IVR flows:', err.message);
    res.status(500).json({ error: 'Failed to list flows' });
  }
});

// Helper: find flow and verify ownership
async function findOwnedFlow(req, res) {
  const flow = await IvrFlow.findByPk(req.params.id);
  if (!flow) { res.status(404).json({ error: 'Flow not found' }); return null; }
  if (flow.createdBy !== req.user.username) { res.status(403).json({ error: 'Access denied' }); return null; }
  return flow;
}

// Get a single flow with full data
router.get('/:id', authenticate, async (req, res) => {
  try {
    const flow = await findOwnedFlow(req, res);
    if (!flow) return;
    const response = flow.toJSON();
    // Ensure flowData and publishedFlowData are parsed objects
    if (typeof response.flowData === 'string') {
      try {
        response.flowData = JSON.parse(response.flowData);
      } catch (parseErr) {
        console.error('Error parsing flowData for flow', response.id, ':', parseErr.message);
      }
    }
    if (typeof response.publishedFlowData === 'string') {
      try {
        response.publishedFlowData = JSON.parse(response.publishedFlowData);
      } catch (parseErr) {
        console.error('Error parsing publishedFlowData for flow', response.id, ':', parseErr.message);
      }
    }
    res.json(response);
  } catch (err) {
    console.error('Error fetching IVR flow:', err.message);
    res.status(500).json({ error: 'Failed to fetch flow' });
  }
});

// Create a new flow
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, flowData } = req.body;
    if (!name || !flowData) {
      return res.status(400).json({ error: 'name and flowData are required' });
    }

    const flow = await IvrFlow.create({
      name,
      description: description || null,
      flowData,
      createdBy: req.user.username,
      active: false,
      phoneNumber: null,
    });
    res.status(201).json(flow);
  } catch (err) {
    console.error('Error creating IVR flow:', err.message);
    res.status(500).json({ error: 'Failed to create flow' });
  }
});

// Update an existing flow
router.put('/:id', authenticate, async (req, res) => {
  try {
    const flow = await findOwnedFlow(req, res);
    if (!flow) return;

    const { name, description, flowData } = req.body;
    if (name) flow.name = name;
    if (description !== undefined) flow.description = description;
    if (flowData) {
      flow.flowData = flowData;
      // Mark as having unpublished changes if flow is active
      if (flow.active && flow.publishedFlowData) {
        flow.hasDraft = true;
      }
    }

    await flow.save();
    res.json(flow);
  } catch (err) {
    console.error('Error updating IVR flow:', err.message);
    res.status(500).json({ error: 'Failed to update flow' });
  }
});

// Delete a flow
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const flow = await findOwnedFlow(req, res);
    if (!flow) return;
    await flow.destroy();
    res.json({ message: 'Flow deleted' });
  } catch (err) {
    console.error('Error deleting IVR flow:', err.message);
    res.status(500).json({ error: 'Failed to delete flow' });
  }
});

// Publish/activate a flow for a phone number — assigns number to agent's voice app
router.post('/:id/publish', authenticate, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });

    const flow = await findOwnedFlow(req, res);
    if (!flow) return;

    const user = await User.findOne({ where: { username: req.user.username } });
    if (!user?.appConnectionId) {
      return res.status(400).json({ error: 'Your Voice App has not been provisioned. Contact an administrator.' });
    }

    // Assign the phone number to this agent's voice app via Telnyx API
    try {
      const telnyx = await getOrgTelnyxClient();
      // Find the phone number resource by number
      const numbersResp = await telnyx.phoneNumbers.list({ 'filter[phone_number]': phoneNumber });
      const numberResource = numbersResp?.data?.[0];
      if (numberResource) {
        await telnyx.phoneNumbers.update(numberResource.id, {
          connection_id: user.appConnectionId,
        });
        console.log(`[IVR] Assigned ${phoneNumber} to voice app ${user.appConnectionId} for ${req.user.username}`);
      }
    } catch (assignErr) {
      console.error('[IVR] Failed to assign number to voice app:', assignErr.message);
      return res.status(400).json({ error: `Failed to assign phone number to your Voice App: ${assignErr.raw?.errors?.[0]?.detail || assignErr.message}` });
    }

    // Deactivate all OTHER flows on this number (exclude current flow)
    await IvrFlow.update(
      { active: false },
      { where: { phoneNumber, active: true, id: { [Op.ne]: flow.id } } }
    );

    // Activate and publish — copy draft to published
    await IvrFlow.update(
      {
        phoneNumber,
        active: true,
        publishedFlowData: flow.flowData,
        hasDraft: false,
        publishedAt: new Date(),
      },
      { where: { id: flow.id } }
    );
    await flow.reload();

    res.json({ message: `Flow "${flow.name}" published to ${phoneNumber}`, flow });
  } catch (err) {
    console.error('Error publishing IVR flow:', err.message);
    res.status(500).json({ error: 'Failed to publish flow' });
  }
});

// Unpublish/deactivate a flow — unassigns number from agent's voice app
router.post('/:id/unpublish', authenticate, async (req, res) => {
  try {
    const flow = await findOwnedFlow(req, res);
    if (!flow) return;

    // Unassign the phone number from the voice app
    if (flow.phoneNumber) {
      try {
        const telnyx = await getOrgTelnyxClient();
        const numbersResp = await telnyx.phoneNumbers.list({ 'filter[phone_number]': flow.phoneNumber });
        const numberResource = numbersResp?.data?.[0];
        if (numberResource) {
          await telnyx.phoneNumbers.update(numberResource.id, { connection_id: '' });
          console.log(`[IVR] Unassigned ${flow.phoneNumber} from voice app`);
        }
      } catch (unassignErr) {
        console.error('[IVR] Failed to unassign number:', unassignErr.message);
      }
    }

    flow.active = false;
    flow.publishedFlowData = null;
    flow.hasDraft = false;
    flow.publishedAt = null;
    flow.phoneNumber = null;
    await flow.save();

    res.json({ message: 'Flow unpublished', flow });
  } catch (err) {
    console.error('Error unpublishing IVR flow:', err.message);
    res.status(500).json({ error: 'Failed to unpublish flow' });
  }
});

export default router;
