import express from 'express';
import axios from 'axios';
import { env } from '../src/config/env.js';
import IvrFlow from '../models/IvrFlow.js';
import { authenticate } from '../src/middleware/auth.js';

const router = express.Router();

// Get phone numbers assigned to the voice application
router.get('/connection-numbers', authenticate, async (req, res) => {
  try {
    const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      params: {
        'filter[connection_id]': env.TELNYX_VOICE_APP_ID,
        'page[size]': 250,
      },
      headers: { Authorization: `Bearer ${env.TELNYX_API}` },
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
      attributes: ['id', 'name', 'description', 'phoneNumber', 'active', 'createdBy', 'createdAt', 'updatedAt'],
    });
    res.json(flows);
  } catch (err) {
    console.error('Error listing IVR flows:', err.message);
    res.status(500).json({ error: 'Failed to list flows' });
  }
});

// Get a single flow with full data
router.get('/:id', authenticate, async (req, res) => {
  try {
    const flow = await IvrFlow.findByPk(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    res.json(flow);
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
    const flow = await IvrFlow.findByPk(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    const { name, description, flowData } = req.body;
    if (name) flow.name = name;
    if (description !== undefined) flow.description = description;
    if (flowData) flow.flowData = flowData;

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
    const flow = await IvrFlow.findByPk(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    await flow.destroy();
    res.json({ message: 'Flow deleted' });
  } catch (err) {
    console.error('Error deleting IVR flow:', err.message);
    res.status(500).json({ error: 'Failed to delete flow' });
  }
});

// Publish/activate a flow for a phone number
router.post('/:id/publish', authenticate, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });

    const flow = await IvrFlow.findByPk(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    // Deactivate all other flows on this number
    await IvrFlow.update(
      { active: false },
      { where: { phoneNumber, active: true } }
    );

    // Activate this flow
    flow.phoneNumber = phoneNumber;
    flow.active = true;
    await flow.save();

    res.json({ message: `Flow "${flow.name}" published to ${phoneNumber}`, flow });
  } catch (err) {
    console.error('Error publishing IVR flow:', err.message);
    res.status(500).json({ error: 'Failed to publish flow' });
  }
});

// Unpublish/deactivate a flow
router.post('/:id/unpublish', authenticate, async (req, res) => {
  try {
    const flow = await IvrFlow.findByPk(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    flow.active = false;
    await flow.save();

    res.json({ message: 'Flow unpublished', flow });
  } catch (err) {
    console.error('Error unpublishing IVR flow:', err.message);
    res.status(500).json({ error: 'Failed to unpublish flow' });
  }
});

export default router;
