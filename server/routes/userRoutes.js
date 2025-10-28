require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const router = express.Router();
const crypto = require('crypto');
const algorithm = 'aes-256-ctr'; // Match the seed file algorithm
const secretKey = process.env.ENCRYPTION_SECRET || 'dev-encryption-secret-key-change-in-production-32-chars-long';
const axios = require('axios');

//===================== ENCRYPTION OF SIP CREDENTIALS =====================
// Encryption and decryption utility functions
const keyBuffer = crypto.createHash('sha256').update(secretKey).digest();
const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  let crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return iv.toString('hex') + ':' + crypted;
};

const decrypt = (text) => {
  try {
    const textParts = text.split(':');

    if (textParts.length === 2) {
      // CTR format (iv:encrypted)
      const iv = Buffer.from(textParts[0], 'hex');
      const encryptedText = textParts[1];
      const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
      let dec = decipher.update(encryptedText, 'hex', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    } else {
      throw new Error('Invalid encrypted text format');
    }
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw error;
  }
};

const authenticateUser = async (req, res, next) => {
  // Get the token from the Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) return res.sendStatus(401); // if no token, return 401 (unauthorized)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-for-dev');
    const user = await User.findOne({ where: { username: decoded.username } });
    if (!user) {
      throw new Error('No user found with this username.');
    }
    req.user = user; // Set the user in the request for downstream routes
    next(); // pass the execution off to whatever request the client intended
  } catch (error) {
    res.status(401).json({ message: "Please authenticate." });
  }
};

//===================== REGISTER ENDPOINT =====================
// Register

const generateRandomString = (length, type = 'alphanumeric') => {
  const characters =
    type === 'alphanumeric'
      ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

router.post('/register', async (req, res) => {
  const { firstName, lastName, phoneNumber, avatar, username, password } = req.body;

  // Generate SIP credentials
  const sipUsername = generateRandomString(Math.floor(Math.random() * 29) + 4);
  const sipPassword = generateRandomString(Math.floor(Math.random() * 121) + 8);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const encryptedSipPassword = encrypt(sipPassword);

  try {
    console.log('=== STARTING USER REGISTRATION ===');
    console.log('Username:', username);
    console.log('Generated SIP Username:', sipUsername);

    // Step 1: Create outbound voice profile
    const profileName = `OVP_${sipUsername}`;
    const profileData = {
      name: profileName,
      enabled: true
    };

    console.log('Creating outbound voice profile:', profileName);
    const profileResponse = await axios.post('https://api.telnyx.com/v2/outbound_voice_profiles', profileData, {
      headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
    });

    if (profileResponse.status !== 201) {
      throw new Error('Failed to create outbound voice profile');
    }

    const outboundVoiceProfileId = profileResponse.data.data.id;
    console.log('✅ Outbound voice profile created:', outboundVoiceProfileId);

    // Step 2: Create call control application
    const callControlAppName = `CallControl_${sipUsername}`;
    const callControlAppData = {
      application_name: callControlAppName,
      active: true,
      webhook_event_url: `https://${process.env.APP_HOST}:${process.env.APP_PORT}/api/voice/webhook`,
      webhook_event_failover_url: '',
      webhook_api_version: '2',
      first_command_timeout: 60,
      first_command_timeout_firing_enabled: false,
      inbound: {
        sip_subdomain: sipUsername,
        sip_subdomain_receive_settings: 'only_my_connections'
      },
      outbound: {
        outbound_voice_profile_id: outboundVoiceProfileId
      }
    };

    console.log('Creating call control application:', callControlAppName);
    const appResponse = await axios.post('https://api.telnyx.com/v2/texml_applications', callControlAppData, {
      headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
    });

    if (appResponse.status !== 201) {
      throw new Error('Failed to create call control application');
    }

    const callControlAppId = appResponse.data.data.id;
    console.log('✅ Call control application created:', callControlAppId);

    // Step 3: Create SIP credential connection
    const connectionName = `SIPConnection_${sipUsername}`;
    const connectionData = {
      connection_name: connectionName,
      user_name: sipUsername,
      password: sipPassword,
      webhook_event_url: `https://${process.env.APP_HOST}:${process.env.APP_PORT}/api/voice/outbound-webrtc`,
      webhook_event_failover_url: '',
      webhook_timeout_secs: 25,
      outbound: {
        call_parking_enabled: true,
        outbound_voice_profile_id: outboundVoiceProfileId
      }
    };

    console.log('Creating SIP credential connection:', connectionName);
    const credentialResponse = await axios.post('https://api.telnyx.com/v2/credential_connections', connectionData, {
      headers: { 'Authorization': `Bearer ${process.env.TELNYX_API}` }
    });

    if (credentialResponse.status !== 201) {
      throw new Error('Failed to create SIP credential connection');
    }

    const credentialConnectionId = credentialResponse.data.data.id;
    console.log('✅ SIP credential connection created:', credentialConnectionId);

    // Step 4: Create user in database
    const newUser = await User.create({
      username,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber,
      sipUsername,
      sipPassword: encryptedSipPassword,
      avatar: avatar || null,
      status: false
    });

    console.log('✅ User created in database:', username);

    // Return success with all the created resource IDs
    res.status(201).json({
      message: 'User registered successfully with SIP credentials and call control application',
      user: {
        username: newUser.username,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        sipUsername: newUser.sipUsername
      },
      telnyx: {
        outboundVoiceProfileId,
        callControlAppId,
        credentialConnectionId
      }
    });

  } catch (err) {
    console.error('=== REGISTRATION ERROR ===');
    console.error('Error:', err.message);
    console.error('Response data:', err.response?.data);

    // Clean up any partially created resources
    // Note: In production, you'd want to implement proper rollback logic here

    res.status(500).json({
      error: 'Registration failed',
      message: err.message,
      details: err.response?.data
    });
  }
});

//===================== GET A AGENT ENDPOINT =====================
// GET a user
router.get('/user_data/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ where: { username } });

    if (user) {
      const { firstName, lastName, phoneNumber, status, avatar } = user;
      let base64Avatar = '';
      if (avatar) {
        base64Avatar = `data:image/jpeg;base64,${avatar.toString('base64')}`;
      }
      res.status(200).json({ avatar: base64Avatar, firstName, lastName, phoneNumber, status }); 
    } else {
      res.status(404).json("User not found");
    }

  } catch (err) {
    res.status(500).json(err);
  }
});

//===================== GET ALL AGENTS ENDPOINT =====================
// Get all agents
router.get('/agents', async (req, res) => {
  try {
    const agents = await User.findAll();
    res.status(200).json(agents);
  } catch (err) {
    res.status(500).json(err);
  }
});

//===================== LOGIN ENDPOINT =====================
// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      const user = await User.findOne({ where: { username } });
      if (!user) return res.status(400).json("Wrong credentials");
      const validated = await bcrypt.compare(password, user.password);
      if (!validated) return res.status(400).json("Wrong credentials");
      // Generate a token
      const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET || 'fallback-secret-for-dev', { expiresIn: '1h' });
      // Set the session
      req.session.user = user;
      res.status(200).json({ token });
    } catch (err) {
      res.status(500).json(err);
    }
  });
//===================== LOGOUT ENDPOINT =====================
// Logout
router.post('/logout', (req, res) => {
    // Clear the session
    req.session.destroy((err) => {
      if (err) return res.status(500).json("Could not log out");
    });
  
    // Clear the token (Front-end should delete the token)
    res.status(200).json("Logged out");
  });
//===================== UPDATE AGENT ENDPOINT =====================
// Update User
router.put('/update/:username', async (req, res) => {
  const { username } = req.params;
  const { newPassword, firstName, lastName, phoneNumber, avatar } = req.body;
  const { status } = req.body;
  const { sipUsername, sipPassword } = req.body;

  try {
    const user = await User.findOne({ where: { username } });
    if (status !== undefined) user.status = status;
    if (user) {
      if (newPassword) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
      }
      if (sipPassword) {
        const encryptedSipPassword = encrypt(req.body.sipPassword);
        user.sipPassword = encryptedSipPassword;
      }
      if (sipUsername) user.sipUsername = sipUsername;
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (phoneNumber) user.phoneNumber = phoneNumber;
      if (avatar) {
        try {
          const base64Data = avatar.split(",")[1];
          if (base64Data) {
            const buffer = Buffer.from(base64Data, 'base64');
            user.avatar = buffer;
          } else {
            throw new Error('Base64 data is empty or not properly formatted');
          }
        } catch (err) {
          console.error('Error processing avatar:', err.message);
          return res.status(400).json({ error: 'Invalid avatar data' });
        }
      }
      await user.save();

      res.status(200).json("User updated");
    } else {
      res.status(404).json("User not found");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});
//===================== UPDATE AGENT STATUS ENDPOINT =====================
// Update User Status
router.patch('/update-status/:username', async (req, res) => {
  const { username } = req.params;
  const { status } = req.body;  // Get status from the request body

  if (status === undefined) {
    return res.status(400).json("Status field is required");
  }

  try {
    const user = await User.findOne({ where: { username } });

    if (user) {
      user.status = status;
      await user.save();
      res.status(200).json({ status: user.status, message: "User status updated" });  // Return updated status
    } else {
      res.status(404).json("User not found");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});
//===================== DELETE AGENT ENDPOINT =====================
// Delete User
router.delete('/delete/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ where: { username } });

    if (user) {
      await user.destroy();
      res.status(200).json("User deleted");
    } else {
      res.status(404).json("User not found");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});
//===================== SECURED: GET SIP CREDENTIALS ENDPOINT =====================
router.get('/sip-credentials', authenticateUser, async (req, res) => {
  try {
    const { sipUsername, sipPassword } = req.user; // Get SIP credentials from the authenticated user

    if (!sipUsername || !sipPassword) {
      console.error('SIP credentials not found for user:', req.user.username);
      return res.status(404).json({ error: 'SIP credentials not configured for this user' });
    }

    const decryptedSipPassword = decrypt(sipPassword);
    res.json({
      sipUsername,
      sipPassword: decryptedSipPassword,
    });
  } catch (err) {
    console.error('Error getting SIP credentials:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

//===================== SECURED: GET DASHBOARD METRICS ENDPOINT =====================
router.get('/dashboard-metrics', authenticateUser, async (req, res) => {
  try {
    const { username } = req.user;
    const { Op } = require('sequelize');
    const Voice = require('../models/Voice');
    const CallSession = require('../models/CallSession');
    const Conversations = require('../models/Conversations');
    const Messages = require('../models/Messages');

    // Get active calls for this agent
    const activeCalls = await CallSession.count({
      where: {
        status: 'active'
      }
    });

    const agentActiveCalls = await Voice.count({
      where: {
        accept_agent: username,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    // Get queued messages assigned to this agent
    const queuedMessages = await Conversations.count({
      where: {
        agent_assigned: username,
        assigned: true
      }
    });

    // Get all available agents (status = true)
    const availableAgents = await User.count({
      where: {
        status: true
      }
    });

    // Calculate average response time for this agent's calls in the last 24 hours
    const recentCalls = await Voice.findAll({
      where: {
        accept_agent: username,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      attributes: ['createdAt', 'updatedAt']
    });

    let avgResponseTime = '0s';
    if (recentCalls.length > 0) {
      const totalResponseTime = recentCalls.reduce((sum, call) => {
        const responseTime = new Date(call.updatedAt) - new Date(call.createdAt);
        return sum + responseTime;
      }, 0);
      const avgMs = totalResponseTime / recentCalls.length;
      avgResponseTime = avgMs < 1000 ? `${Math.round(avgMs)}ms` : `${(avgMs / 1000).toFixed(1)}s`;
    }

    res.json({
      activeCalls: agentActiveCalls || 0,
      queuedMessages: queuedMessages || 0,
      availableAgents: availableAgents || 0,
      avgResponseTime: avgResponseTime
    });
  } catch (err) {
    console.error('Dashboard metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

//===================== SECURED: GET PHONE NUMBERS FOR USER =====================
router.get('/phone-numbers', authenticateUser, async (req, res) => {
  try {
    const { sipUsername } = req.user;

    if (!sipUsername) {
      console.error('No SIP username found for user:', req.user.username);
      return res.status(404).json({ error: 'SIP username not found for this user' });
    }

    console.log(`Fetching phone numbers with tag: ${sipUsername}`);

    // Fetch phone numbers from Telnyx API filtered by tag (SIP username)
    const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`,
        'Content-Type': 'application/json'
      },
      params: {
        'filter[tags]': sipUsername,
        'page[size]': 100  // Get up to 100 numbers
      }
    });

    // Extract just the phone numbers from the response
    const phoneNumbers = response.data.data.map(number => number.phone_number);

    console.log(`Found ${phoneNumbers.length} phone numbers for tag ${sipUsername}:`, phoneNumbers);

    res.json(phoneNumbers);
  } catch (err) {
    console.error('Error fetching phone numbers:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Failed to fetch phone numbers',
      details: err.response?.data || err.message
    });
  }
});

module.exports = router;
