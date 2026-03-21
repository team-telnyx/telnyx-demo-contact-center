import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../src/config/env.js';
import Telnyx from 'telnyx';
import User from '../models/User.js';
import { encrypt, decrypt } from '../src/utils/encryption.js';
import { authenticate } from '../src/middleware/auth.js';
import { routeQueuedCallsToAgent } from '../src/services/auto-route.js';

const telnyx = new Telnyx({ apiKey: env.TELNYX_API });
const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;
const router = express.Router();

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

/**
 * Provision SIP credentials on Telnyx using the user's own API key.
 * Creates an OVP + credential connection.
 * Returns { connectionId }
 */
async function provisionSipCredentials(sipUsername, sipPassword, userApiKey) {
  const userTelnyx = new Telnyx({ apiKey: userApiKey });

  const ovp = await userTelnyx.outboundVoiceProfiles.create({
    name: `OVP_${sipUsername}`,
    enabled: true,
  });
  const profileId = ovp.data?.id;

  const conn = await userTelnyx.credentialConnections.create({
    connection_name: `SIPConnection_${sipUsername}`,
    user_name: sipUsername,
    password: sipPassword,
    webhook_event_url: `https://${env.APP_HOST}:${env.APP_PORT}/api/voice/outbound-webrtc-bridge`,
    outbound: {
      call_parking_enabled: true,
      outbound_voice_profile_id: profileId,
    },
  });

  const connectionId = conn.data?.id || null;
  console.log(`[Provision] Created SIP connection for ${sipUsername} (connection: ${connectionId}) using user's API key`);
  return { connectionId };
}

router.post('/register', async (req, res) => {
  const { firstName, lastName, phoneNumber, avatar, username, password } = req.body;

  // Generate SIP credentials
  const sipUsername = generateRandomString(Math.floor(Math.random() * 29) + 4);
  const sipPassword = generateRandomString(Math.floor(Math.random() * 121) + 8);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const encryptedSipPassword = encrypt(sipPassword);

  try {
    // Create a new user
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

    const { connectionId } = await provisionSipCredentials(sipUsername, sipPassword, env.TELNYX_API);
    if (connectionId) {
      newUser.webrtcConnectionId = connectionId;
      await newUser.save();
    }

    res.status(200).json("User registered with SIP connection");
  } catch (err) {
    res.status(500).json(err.message);
  }
});

//===================== GET A AGENT ENDPOINT =====================
// GET a user
router.get('/user_data/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ where: { username } });

    if (user) {
      let base64Avatar = '';
      if (user.avatar) {
        base64Avatar = `data:image/jpeg;base64,${user.avatar.toString('base64')}`;
      }
      // Only return sensitive fields if the requester is the same user (authenticated)
      const authHeader = req.headers.authorization;
      const isSelf = authHeader && (() => {
        try {
          const decoded = jwt.verify(authHeader.split(' ')[1], env.JWT_SECRET);
          return decoded.username === user.username;
        } catch { return false; }
      })();
      const response = {
        avatar: base64Avatar,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        status: user.status,
        onboardingComplete: !!user.onboardingComplete,
      };
      if (isSelf) {
        response.telnyxApiKey = user.telnyxApiKey || null;
        response.telnyxPublicKey = user.telnyxPublicKey || null;
        response.appConnectionId = user.appConnectionId || null;
        response.webrtcConnectionId = user.webrtcConnectionId || null;
      }
      res.status(200).json(response);
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
      const token = jwt.sign({ username: user.username }, env.JWT_SECRET, { expiresIn: '1h' });
      req.session.user = user;

      let avatarUrl = null;
      if (user.avatar) {
        avatarUrl = `data:image/jpeg;base64,${user.avatar.toString('base64')}`;
      }

      // Set user online on login
      user.status = 'online';
      await user.save();

      res.status(200).json({
        token,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl,
        agentStatus: user.status,
        telnyxApiKey: user.telnyxApiKey || null,
        telnyxPublicKey: user.telnyxPublicKey || null,
        appConnectionId: user.appConnectionId || null,
        webrtcConnectionId: user.webrtcConnectionId || null,
        onboardingComplete: !!user.onboardingComplete,
      });

      // Check for queued calls on login
      routeQueuedCallsToAgent().catch(err =>
        console.error('[Auto-route] Error routing on login:', err.message)
      );
    } catch (err) {
      res.status(500).json(err);
    }
  });
//===================== GOOGLE SSO ENDPOINT =====================
router.post('/google-auth', async (req, res) => {
  const { credential } = req.body;

  if (!googleClient) {
    return res.status(501).json({ message: 'Google SSO is not configured' });
  }

  if (!credential) {
    return res.status(400).json({ message: 'Google credential is required' });
  }

  try {
    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, given_name, family_name, picture } = payload;

    // Find existing user by googleId or email (treat email as username)
    let user = await User.findOne({ where: { googleId } });

    if (!user) {
      // Check if a user with this email as username already exists
      user = await User.findOne({ where: { username: email } });

      if (user) {
        // Link Google account to existing user
        user.googleId = googleId;
        await user.save();
      } else {
        // Auto-register new Google user with SIP credentials
        const sipUsername = generateRandomString(Math.floor(Math.random() * 29) + 4);
        const sipPassword = generateRandomString(Math.floor(Math.random() * 121) + 8);
        const encryptedSipPassword = encrypt(sipPassword);

        user = await User.create({
          username: email,
          firstName: given_name || email.split('@')[0],
          lastName: family_name || '',
          googleId,
          sipUsername,
          sipPassword: encryptedSipPassword,
          status: 'online',
        });
        // SIP connection will be provisioned when user adds their API key in profile
      }
    }

    // Set user online
    user.status = 'online';
    await user.save();

    // Generate JWT
    const token = jwt.sign({ username: user.username }, env.JWT_SECRET, { expiresIn: '1h' });

    let avatarUrl = null;
    if (user.avatar) {
      avatarUrl = `data:image/jpeg;base64,${user.avatar.toString('base64')}`;
    } else if (picture) {
      avatarUrl = picture;
    }

    res.status(200).json({
      token,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl,
      agentStatus: user.status,
      telnyxApiKey: user.telnyxApiKey || null,
      telnyxPublicKey: user.telnyxPublicKey || null,
      appConnectionId: user.appConnectionId || null,
      webrtcConnectionId: user.webrtcConnectionId || null,
      onboardingComplete: !!user.onboardingComplete,
    });

    routeQueuedCallsToAgent().catch(err =>
      console.error('[Auto-route] Error routing on Google login:', err.message)
    );
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ message: 'Invalid Google credential' });
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
router.put('/update/:username', authenticate, async (req, res) => {
  const { username } = req.params;
  const { newPassword, firstName, lastName, phoneNumber, avatar } = req.body;
  const { status } = req.body;
  const { sipUsername, sipPassword } = req.body;
  const { telnyxApiKey, telnyxPublicKey } = req.body;
  const { appConnectionId, webrtcConnectionId } = req.body;
  const { onboardingComplete } = req.body;

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
      if (telnyxApiKey !== undefined) user.telnyxApiKey = telnyxApiKey;
      if (telnyxPublicKey !== undefined) user.telnyxPublicKey = telnyxPublicKey;
      if (appConnectionId !== undefined) user.appConnectionId = appConnectionId;
      if (webrtcConnectionId !== undefined) user.webrtcConnectionId = webrtcConnectionId;
      if (onboardingComplete !== undefined) user.onboardingComplete = onboardingComplete;
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
      // Provision SIP connection if user has API key but no connection yet
      const userApiKey = user.telnyxApiKey;
      const needsProvisioning = userApiKey && !user.webrtcConnectionId && user.sipUsername;

      await user.save();

      if (needsProvisioning) {
        try {
          const plainSipPassword = decrypt(user.sipPassword);
          const { connectionId } = await provisionSipCredentials(user.sipUsername, plainSipPassword, userApiKey);
          if (connectionId) {
            user.webrtcConnectionId = connectionId;
            await user.save();
            console.log(`[Profile] Auto-provisioned SIP connection ${connectionId} for ${username} using their API key`);
          }
        } catch (provisionErr) {
          console.error('[Profile] SIP provisioning failed:', provisionErr.message);
          return res.status(200).json({
            message: 'Profile updated but SIP provisioning failed: ' + provisionErr.message,
            webrtcConnectionId: null,
          });
        }
      }

      res.status(200).json({
        message: "User updated",
        webrtcConnectionId: user.webrtcConnectionId || null,
      });
    } else {
      res.status(404).json("User not found");
    }
  } catch (err) {
    res.status(500).json(err.message || err);
  }
});
//===================== UPDATE AGENT STATUS ENDPOINT =====================
// Update User Status
router.patch('/update-status/:username', authenticate, async (req, res) => {
  const { username } = req.params;
  const { status } = req.body;
  const VALID_STATUSES = ['online', 'offline', 'busy', 'away', 'break', 'dnd'];

  if (!status) {
    return res.status(400).json("Status field is required");
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  try {
    const user = await User.findOne({ where: { username } });

    if (user) {
      user.status = status;
      await user.save();
      res.status(200).json({ status: user.status, message: "User status updated" });

      // When agent comes online, check for queued calls
      if (status === 'online') {
        routeQueuedCallsToAgent().catch(err =>
          console.error('[Auto-route] Error routing on status change:', err.message)
        );
      }
    } else {
      res.status(404).json("User not found");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});
//===================== DELETE AGENT ENDPOINT =====================
// Delete User
router.delete('/delete/:username', authenticate, async (req, res) => {
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
router.get('/sip-credentials', authenticate, async (req, res) => {
  try {
    const { sipUsername, sipPassword } = req.user;
    const decryptedSipPassword = decrypt(sipPassword);
    res.json({
      sipUsername,
      sipPassword: decryptedSipPassword,
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

//===================== PROXY: GET PHONE NUMBERS BY TAG =====================
router.get('/phone-numbers', authenticate, async (req, res) => {
  const { tag } = req.query;
  if (!tag) {
    return res.status(400).json({ message: 'Tag query parameter is required' });
  }

  try {
    const response = await telnyx.phoneNumbers.list({
      'filter[tag]': tag,
      'page[number]': 1,
      'page[size]': 20,
    });
    res.json(response);
  } catch (err) {
    console.error('Error fetching phone numbers:', err.message);
    res.json({ data: [] });
  }
});

//===================== MESSAGING NUMBERS (SMS-capable numbers on user's account) =====================
router.get('/messaging-numbers', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ where: { username: req.user.username } });
    const apiKey = user?.telnyxApiKey;
    if (!apiKey) return res.json({ data: [] });

    const userTelnyx = new Telnyx({ apiKey });
    const response = await userTelnyx.phoneNumbers.list({
      'page[size]': 250,
    });
    // Filter to numbers that have a messaging profile
    const numbers = (response.data || [])
      .filter((n) => n.messaging_profile_id)
      .map((n) => ({
        id: n.id,
        phone_number: n.phone_number,
        messaging_profile_id: n.messaging_profile_id,
        messaging_profile_name: n.messaging_profile_name,
      }));
    res.json({ data: numbers });
  } catch (err) {
    console.error('Error fetching messaging numbers:', err.message);
    res.json({ data: [] });
  }
});

//===================== PHONE NUMBER MANAGEMENT (User's own API key) =====================

router.get('/my-numbers', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ where: { username: req.user.username } });
    const apiKey = user?.telnyxApiKey;
    if (!apiKey) return res.status(400).json({ message: 'No Telnyx API key configured. Add one in your profile.' });

    const { page = 1, size = 20 } = req.query;
    const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      params: { 'page[number]': page, 'page[size]': size },
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    res.json(response.data);
  } catch (err) {
    console.error('Error fetching numbers:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ message: err.response?.data?.errors?.[0]?.detail || 'Error fetching phone numbers' });
  }
});

router.get('/available-numbers', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ where: { username: req.user.username } });
    const apiKey = user?.telnyxApiKey;
    if (!apiKey) return res.status(400).json({ message: 'No Telnyx API key configured.' });

    const { country_code = 'US', state, city, limit = 20 } = req.query;
    const params = {
      'filter[country_code]': country_code,
      'filter[limit]': limit,
      'filter[features]': 'sms,voice',
    };
    if (state) params['filter[administrative_area]'] = state;
    if (city) params['filter[locality]'] = city;

    const response = await axios.get('https://api.telnyx.com/v2/available_phone_numbers', {
      params,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    res.json(response.data);
  } catch (err) {
    console.error('Error searching numbers:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ message: err.response?.data?.errors?.[0]?.detail || 'Error searching available numbers' });
  }
});

router.post('/purchase-number', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ where: { username: req.user.username } });
    const apiKey = user?.telnyxApiKey;
    if (!apiKey) return res.status(400).json({ message: 'No Telnyx API key configured.' });

    const { phone_number, connection_id, messaging_profile_id } = req.body;
    if (!phone_number) return res.status(400).json({ message: 'phone_number is required' });

    const body = { phone_numbers: [{ phone_number }] };
    if (connection_id) body.connection_id = connection_id;
    if (messaging_profile_id) body.messaging_profile_id = messaging_profile_id;

    const response = await axios.post('https://api.telnyx.com/v2/number_orders', body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    res.json(response.data);
  } catch (err) {
    console.error('Error purchasing number:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ message: err.response?.data?.errors?.[0]?.detail || 'Error purchasing number' });
  }
});

router.delete('/release-number/:numberId', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ where: { username: req.user.username } });
    const apiKey = user?.telnyxApiKey;
    if (!apiKey) return res.status(400).json({ message: 'No Telnyx API key configured.' });

    await axios.delete(`https://api.telnyx.com/v2/phone_numbers/${req.params.numberId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    res.json({ message: 'Number released successfully' });
  } catch (err) {
    console.error('Error releasing number:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ message: err.response?.data?.errors?.[0]?.detail || 'Error releasing number' });
  }
});

export default router;
