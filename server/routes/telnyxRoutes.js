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

//===================== NUMBER MANAGEMENT ENDPOINTS =====================

// Get all phone numbers (for admin dashboard)
router.get('/all-phone-numbers', authenticateUser, async (req, res) => {
  try {
    const axios = require('axios');
    const { page = 1, size = 100 } = req.query;

    console.log('Fetching all phone numbers from Telnyx API');

    const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`,
        'Content-Type': 'application/json'
      },
      params: {
        'page[number]': page,
        'page[size]': size
      }
    });

    const phoneNumbers = response.data.data.map(number => ({
      id: number.id,
      phone_number: number.phone_number,
      status: number.status,
      tags: number.tags || [],
      connection_name: number.connection_name,
      messaging_profile_name: number.messaging_profile_name
    }));

    res.json({
      data: phoneNumbers,
      meta: response.data.meta
    });

  } catch (error) {
    console.error('Error fetching all phone numbers:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to fetch phone numbers',
      details: error.response?.data || error.message
    });
  }
});

// Assign phone number to user (add tag)
router.post('/assign-number', authenticateUser, async (req, res) => {
  try {
    const axios = require('axios');
    const { phoneNumberId, sipUsername, phoneNumber } = req.body;

    if (!phoneNumberId || !sipUsername) {
      return res.status(400).json({
        error: 'phoneNumberId and sipUsername are required'
      });
    }

    console.log(`Assigning phone number ${phoneNumber} (ID: ${phoneNumberId}) to user ${sipUsername}`);

    // Update the phone number with the SIP username as a tag
    const response = await axios.patch(
      `https://api.telnyx.com/v2/phone_numbers/${phoneNumberId}`,
      {
        tags: [sipUsername]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Phone number assigned successfully');

    res.json({
      message: 'Phone number assigned successfully',
      data: {
        phone_number: response.data.data.phone_number,
        tags: response.data.data.tags,
        sipUsername: sipUsername
      }
    });

  } catch (error) {
    console.error('Error assigning phone number:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to assign phone number',
      details: error.response?.data || error.message
    });
  }
});

// Unassign phone number from user (remove tag)
router.post('/unassign-number', authenticateUser, async (req, res) => {
  try {
    const axios = require('axios');
    const { phoneNumberId, phoneNumber } = req.body;

    if (!phoneNumberId) {
      return res.status(400).json({
        error: 'phoneNumberId is required'
      });
    }

    console.log(`Unassigning phone number ${phoneNumber} (ID: ${phoneNumberId})`);

    // Remove all tags from the phone number
    const response = await axios.patch(
      `https://api.telnyx.com/v2/phone_numbers/${phoneNumberId}`,
      {
        tags: []
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Phone number unassigned successfully');

    res.json({
      message: 'Phone number unassigned successfully',
      data: {
        phone_number: response.data.data.phone_number,
        tags: response.data.data.tags
      }
    });

  } catch (error) {
    console.error('Error unassigning phone number:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to unassign phone number',
      details: error.response?.data || error.message
    });
  }
});

// Get available (unassigned) phone numbers
router.get('/available-phone-numbers', authenticateUser, async (req, res) => {
  try {
    const axios = require('axios');
    const { page = 1, size = 100 } = req.query;

    console.log('Fetching available (unassigned) phone numbers');

    const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`,
        'Content-Type': 'application/json'
      },
      params: {
        'page[number]': page,
        'page[size]': size
      }
    });

    // Filter out numbers that don't have tags (unassigned)
    const availableNumbers = response.data.data
      .filter(number => !number.tags || number.tags.length === 0)
      .map(number => ({
        id: number.id,
        phone_number: number.phone_number,
        status: number.status,
        connection_name: number.connection_name
      }));

    res.json({
      data: availableNumbers,
      count: availableNumbers.length
    });

  } catch (error) {
    console.error('Error fetching available phone numbers:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to fetch available phone numbers',
      details: error.response?.data || error.message
    });
  }
});

module.exports = router;