import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { getWebhookBaseUrl } from './org-telnyx.js';
import User from '../../models/User.js';
import TelnyxService from './telnyx.service.js';

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

const AuthService = {
  async register(userData) {
    const { username, password, firstName, lastName, phoneNumber, avatar } = userData;

    const sipUsername = generateRandomString(Math.floor(Math.random() * 29) + 4);
    const sipPassword = generateRandomString(Math.floor(Math.random() * 121) + 8);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const encryptedSipPassword = encrypt(sipPassword);

    const newUser = await User.create({
      username,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber,
      sipUsername,
      sipPassword: encryptedSipPassword,
      avatar: avatar || null,
      status: false,
    });

    const profileName = `OVP_${sipUsername}`;
    const profileResponse = await TelnyxService.createOutboundVoiceProfile(profileName);

    if (!profileResponse || !profileResponse.data || !profileResponse.data.id) {
      throw new Error('Failed to create outbound voice profile');
    }

    const webhookBase = await getWebhookBaseUrl();
    const connectionName = `SIPConnection_${sipUsername}`;
    const connectionData = {
      connection_name: connectionName,
      user_name: sipUsername,
      password: sipPassword,
      webhook_event_url: `${webhookBase}/api/voice/outbound-webrtc-bridge`,
      outbound: {
        call_parking_enabled: true,
        outbound_voice_profile_id: profileResponse.data.id,
      },
    };

    await TelnyxService.createCredentialConnection(connectionData);

    return newUser;
  },

  async login(username, password) {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      throw new Error('Wrong credentials');
    }

    const validated = await bcrypt.compare(password, user.password);
    if (!validated) {
      throw new Error('Wrong credentials');
    }

    const token = jwt.sign({ username: user.username }, env.JWT_SECRET, { expiresIn: '1h' });

    return { token, user };
  },

  getSipCredentials(user) {
    const decryptedSipPassword = decrypt(user.sipPassword);
    return {
      sipUsername: user.sipUsername,
      sipPassword: decryptedSipPassword,
    };
  },
};

export default AuthService;
