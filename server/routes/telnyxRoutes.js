const express = require('express');
const telnyxService = require('../services/telnyxService');
const router = express.Router();

// Middleware to authenticate requests (reuse from userRoutes)
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-for-dev');
    const user = await User.findOne({ where: { username: decoded.username } });
    if (!user) {
      throw new Error('No user found with this username.');
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Please authenticate." });
  }
};

// Get phone numbers with tag (proxy for client-side Telnyx calls)
router.get('/phone-numbers', authenticateUser, async (req, res) => {
  try {
    const { tag, page = 1, size = 20 } = req.query;
    
    if (!tag) {
      return res.status(400).json({ error: 'Tag parameter is required' });
    }

    const data = await telnyxService.getPhoneNumbers(tag, parseInt(page), parseInt(size));
    
    // Extract just the phone numbers for backwards compatibility
    const phoneNumbers = data.data || [];
    const agentNumbers = phoneNumbers.map(phoneNumber => phoneNumber.phone_number);
    
    res.json({ 
      data: agentNumbers,
      meta: data.meta // Include pagination info if needed
    });
    
  } catch (error) {
    console.error('Error fetching phone numbers:', error);
    res.status(500).json({ error: 'Failed to fetch phone numbers' });
  }
});

// Dial outbound call (proxy for client-side calls)
router.post('/dial-call', authenticateUser, async (req, res) => {
  try {
    const { to, from, connectionId, webhookUrl, clientState } = req.body;
    
    if (!to || !from) {
      return res.status(400).json({ error: 'To and from parameters are required' });
    }

    const callData = await telnyxService.dialCall(
      connectionId || process.env.TELNYX_CONNECTION_ID || '1446442091122001881',
      to,
      from,
      webhookUrl,
      clientState
    );
    
    res.json(callData);
    
  } catch (error) {
    console.error('Error dialing call:', error);
    res.status(500).json({ error: 'Failed to dial call' });
  }
});

// Answer call (proxy)
router.post('/answer-call/:callControlId', authenticateUser, async (req, res) => {
  try {
    const { callControlId } = req.params;
    const { clientState } = req.body;
    
    const result = await telnyxService.answerCall(callControlId, clientState);
    res.json(result);
    
  } catch (error) {
    console.error('Error answering call:', error);
    res.status(500).json({ error: 'Failed to answer call' });
  }
});

// Hangup call (proxy)
router.post('/hangup-call/:callControlId', authenticateUser, async (req, res) => {
  try {
    const { callControlId } = req.params;
    
    const result = await telnyxService.hangupCall(callControlId);
    res.json(result);
    
  } catch (error) {
    console.error('Error hanging up call:', error);
    res.status(500).json({ error: 'Failed to hangup call' });
  }
});

// Bridge calls (proxy)
router.post('/bridge-calls', authenticateUser, async (req, res) => {
  try {
    const { callControlId, bridgeToCallControlId, parkAfterUnbridge } = req.body;
    
    if (!callControlId || !bridgeToCallControlId) {
      return res.status(400).json({ error: 'Both call control IDs are required' });
    }
    
    const result = await telnyxService.bridgeCalls(
      callControlId, 
      bridgeToCallControlId, 
      parkAfterUnbridge
    );
    res.json(result);
    
  } catch (error) {
    console.error('Error bridging calls:', error);
    res.status(500).json({ error: 'Failed to bridge calls' });
  }
});

module.exports = router;