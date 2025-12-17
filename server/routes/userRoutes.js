import 'dotenv/config';
import express from '#lib/router-shim';
import bcrypt from 'bcryptjs';
import { getPrismaClient, getPrismaClientLocal } from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';

const router = express.Router();
const algorithm = 'aes-256-ctr';
const secretKey = process.env.ENCRYPTION_SECRET || 'dev-encryption-secret-key-change-in-production-32-chars-long';

// Initialize Prisma - this will be overridden by middleware in production
let prisma;

// Middleware to inject Prisma client
const injectPrisma = (req, res, next) => {
  if (req.env && req.env.DB) {
    // Cloudflare Workers environment
    req.prisma = getPrismaClient(req.env.DB);
  } else {
    // Local development environment
    if (!prisma) {
      prisma = getPrismaClientLocal();
    }
    req.prisma = prisma;
  }
  next();
};

router.use(injectPrisma);

//===================== ENCRYPTION OF SIP CREDENTIALS =====================
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
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-for-dev');
    const user = await req.prisma.user.findUnique({ where: { username: decoded.username } });
    if (!user) {
      throw new Error('No user found with this username.');
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Please authenticate." });
  }
};

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

//===================== REGISTER ENDPOINT =====================
router.post('/register', async (req, res) => {
  const { firstName, lastName, phoneNumber, avatar, username, password } = req.body;

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
      webhook_event_url: `https://${process.env.APP_HOST}:${process.env.APP_PORT}/api/voice/webhook`,
      webhook_event_failover_url: null, // Changed from '' to null
      webhook_api_version: '2',
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
    // Correct endpoint for Call Control Applications (not TeXML)
    const appResponse = await axios.post('https://api.telnyx.com/v2/call_control_applications', callControlAppData, {
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

    // Step 4: Create user in database with Prisma
    const newUser = await req.prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber,
        sipUsername,
        sipPassword: encryptedSipPassword,
        avatar: avatar ? Buffer.from(avatar) : null,
        status: 0
      }
    });

    console.log('✅ User created in database:', username);

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
    console.error('Error:', err.message);
    if (err.response?.data) {
      console.error('Response data:', JSON.stringify(err.response.data, null, 2));
    }

    res.status(500).json({
      error: 'Registration failed',
      message: err.message,
      details: err.response?.data
    });
  }
});

//===================== GET A AGENT ENDPOINT =====================
router.get('/user_data/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await req.prisma.user.findUnique({ where: { username } });

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
router.get('/agents', async (req, res) => {
  try {
    const agents = await req.prisma.user.findMany();
    res.status(200).json(agents);
  } catch (err) {
    res.status(500).json(err);
  }
});

//===================== LOGIN ENDPOINT =====================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log('🔐 [login] Attempt:', { username, hasPrisma: !!req.prisma });
    const user = await req.prisma.user.findUnique({ where: { username } });
    console.log('🔐 [login] User lookup result:', user ? 'FOUND' : 'NOT_FOUND');
    if (!user) return res.status(400).json({ message: "Wrong credentials" });
    const validated = await bcrypt.compare(password, user.password);
    console.log('🔐 [login] Password valid:', validated);
    if (!validated) return res.status(400).json({ message: "Wrong credentials" });

    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET || 'fallback-secret-for-dev', { expiresIn: '1h' });
    console.log('🔐 [login] Token issued for:', username);

    // Note: req.session is not available in Cloudflare Workers
    // Session management should be handled client-side with JWT tokens
    if (req.session) {
      req.session.user = user;
    }

    // TEMPORARY TEST: Just return json without status
    res.json({ token });
  } catch (err) {
    console.error('🔴 [login] Error:', err);
    res.status(500).json({ message: 'Internal server error during login', error: err.message });
  }
});

//===================== LOGOUT ENDPOINT =====================
router.post('/logout', (req, res) => {
  // Note: Session management in Workers is handled client-side
  // The client should clear the JWT token from localStorage
  if (req.session && req.session.destroy) {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Could not log out" });
      res.status(200).json({ message: "Logged out" });
    });
  } else {
    // For Cloudflare Workers, just return success
    // Actual logout is handled client-side by clearing the JWT
    res.status(200).json({ message: "Logged out" });
  }
});

//===================== UPDATE AGENT ENDPOINT =====================
router.put('/update/:username', async (req, res) => {
  const { username } = req.params;
  const { newPassword, firstName, lastName, phoneNumber, avatar, status, sipUsername, sipPassword } = req.body;

  try {
    const user = await req.prisma.user.findUnique({ where: { username } });

    if (!user) {
      return res.status(404).json("User not found");
    }

    const updateData = {};

    if (status !== undefined) updateData.status = status;
    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(newPassword, salt);
    }
    if (sipPassword) {
      updateData.sipPassword = encrypt(sipPassword);
    }
    if (sipUsername) updateData.sipUsername = sipUsername;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (avatar) {
      try {
        const base64Data = avatar.split(",")[1];
        if (base64Data) {
          updateData.avatar = Buffer.from(base64Data, 'base64');
        } else {
          throw new Error('Base64 data is empty or not properly formatted');
        }
      } catch (err) {
        console.error('Error processing avatar:', err.message);
        return res.status(400).json({ error: 'Invalid avatar data' });
      }
    }

    await req.prisma.user.update({
      where: { username },
      data: updateData
    });

    res.status(200).json("User updated");
  } catch (err) {
    res.status(500).json(err);
  }
});

//===================== UPDATE AGENT STATUS ENDPOINT =====================
router.patch('/update-status/:username', async (req, res) => {
  const { username } = req.params;
  const { status } = req.body;

  if (status === undefined) {
    return res.status(400).json("Status field is required");
  }

  try {
    const updatedUser = await req.prisma.user.update({
      where: { username },
      data: { status }
    });

    res.status(200).json({ status: updatedUser.status, message: "User status updated" });
  } catch (err) {
    if (err.code === 'P2025') {
      res.status(404).json("User not found");
    } else {
      res.status(500).json(err);
    }
  }
});

//===================== DELETE AGENT ENDPOINT =====================
router.delete('/delete/:username', async (req, res) => {
  const { username } = req.params;

  try {
    await req.prisma.user.delete({ where: { username } });
    res.status(200).json("User deleted");
  } catch (err) {
    if (err.code === 'P2025') {
      res.status(404).json("User not found");
    } else {
      res.status(500).json(err);
    }
  }
});

//===================== SECURED: GET SIP CREDENTIALS ENDPOINT =====================
router.get('/sip-credentials', authenticateUser, async (req, res) => {
  try {
    const { sipUsername, sipPassword } = req.user;

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

    // Get active calls count
    const activeCalls = await req.prisma.callSession.count({
      where: {
        status: 'active'
      }
    });

    // Get agent's active calls in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const agentActiveCalls = await req.prisma.voice.count({
      where: {
        accept_agent: username,
        createdAt: {
          gte: oneDayAgo
        }
      }
    });

    // Get queued messages assigned to this agent
    const queuedMessages = await req.prisma.conversation.count({
      where: {
        agent_assigned: username,
        assigned: true
      }
    });

    // Get all available agents (status = 1)
    const availableAgents = await req.prisma.user.count({
      where: {
        status: 1
      }
    });

    // Calculate average response time for this agent's calls in the last 24 hours
    const recentCalls = await req.prisma.voice.findMany({
      where: {
        accept_agent: username,
        createdAt: {
          gte: oneDayAgo
        }
      },
      select: {
        createdAt: true,
        updatedAt: true
      }
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

    const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      headers: {
        'Authorization': `Bearer ${process.env.TELNYX_API}`,
        'Content-Type': 'application/json'
      },
      params: {
        'filter[tags]': sipUsername,
        'page[size]': 100
      }
    });

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

export default router;
