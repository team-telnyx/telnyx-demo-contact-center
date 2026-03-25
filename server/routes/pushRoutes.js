import express from 'express';
import webpush from 'web-push';
import { authenticate } from '../src/middleware/auth.js';
import Settings from '../models/Settings.js';

const router = express.Router();

// In-memory store of push subscriptions keyed by username
const subscriptions = new Map();

// Initialize VAPID keys
async function getVapidKeys() {
  let publicKey = (await Settings.findByPk('vapidPublicKey'))?.value;
  let privateKey = (await Settings.findByPk('vapidPrivateKey'))?.value;

  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    await Settings.upsert({ key: 'vapidPublicKey', value: publicKey });
    await Settings.upsert({ key: 'vapidPrivateKey', value: privateKey });
  }

  return { publicKey, privateKey };
}

// Configure web-push on first use
let vapidConfigured = false;
async function ensureVapid() {
  if (vapidConfigured) return;
  const { publicKey, privateKey } = await getVapidKeys();
  webpush.setVapidDetails('mailto:admin@telnyx.com', publicKey, privateKey);
  vapidConfigured = true;
}

// GET /api/push/vapid-public-key — return public key for client subscription
router.get('/vapid-public-key', authenticate, async (_req, res) => {
  const { publicKey } = await getVapidKeys();
  res.json({ publicKey });
});

// POST /api/push/subscribe — save a push subscription for the user
router.post('/subscribe', authenticate, async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  const username = req.user.username;
  // Store multiple subscriptions per user (multiple devices/browsers)
  if (!subscriptions.has(username)) {
    subscriptions.set(username, []);
  }
  const userSubs = subscriptions.get(username);
  // Avoid duplicates
  if (!userSubs.find((s) => s.endpoint === subscription.endpoint)) {
    userSubs.push(subscription);
  }
  console.log(`[Push] Subscribed ${username} (${userSubs.length} device(s))`);
  res.json({ message: 'Subscribed' });
});

// POST /api/push/test — send a test notification to the logged-in user
router.post('/test', authenticate, async (req, res) => {
  const username = req.user.username;
  console.log(`[Push] Test push requested by ${username}, subscriptions: ${subscriptions.has(username) ? subscriptions.get(username).length : 0}`);
  await sendPushNotification(username, {
    title: 'Test Notification',
    body: 'Push notifications are working!',
    tag: 'test-' + Date.now(),
    url: '/dashboard',
  });
  res.json({ message: 'Test push sent' });
});

// POST /api/push/unsubscribe — remove a push subscription
router.post('/unsubscribe', authenticate, async (req, res) => {
  const { endpoint } = req.body;
  const username = req.user.username;
  if (subscriptions.has(username)) {
    const filtered = subscriptions.get(username).filter((s) => s.endpoint !== endpoint);
    subscriptions.set(username, filtered);
  }
  res.json({ message: 'Unsubscribed' });
});

/**
 * Send a push notification to a specific user or all subscribed users.
 * @param {string|null} username - Target user, or null for all users
 * @param {{ title: string, body: string, tag?: string, url?: string }} payload
 */
export async function sendPushNotification(username, payload) {
  try {
    await ensureVapid();
  } catch (err) {
    console.error('[Push] VAPID setup failed:', err.message);
    return;
  }

  const targets = [];
  if (username && subscriptions.has(username)) {
    targets.push({ user: username, subs: subscriptions.get(username) });
  } else if (!username) {
    // Broadcast to all
    for (const [user, subs] of subscriptions) {
      targets.push({ user, subs });
    }
  }

  if (targets.length === 0) {
    console.log('[Push] No subscriptions to send to');
    return;
  }

  console.log(`[Push] Sending "${payload.title}" to ${targets.length} user(s)`);

  for (const { user, subs } of targets) {
    const expired = [];
    for (let i = 0; i < subs.length; i++) {
      try {
        await webpush.sendNotification(subs[i], JSON.stringify(payload));
        console.log(`[Push] Sent to ${user} (device ${i + 1})`);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expired.push(i);
          console.log(`[Push] Subscription expired for ${user} (device ${i + 1})`);
        } else {
          console.error(`[Push] Failed to send to ${user}:`, err.statusCode, err.message, err.body);
        }
      }
    }
    // Remove expired subscriptions
    for (let i = expired.length - 1; i >= 0; i--) {
      subs.splice(expired[i], 1);
    }
  }
}

/**
 * Send push to all subscribed users in a queue/role.
 */
export async function broadcastPush(payload) {
  await sendPushNotification(null, payload);
}

export default router;
