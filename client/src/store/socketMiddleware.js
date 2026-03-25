import { io } from 'socket.io-client';
import { connected, disconnected, reconnecting, error } from '../features/socket/socketSlice';
import { setOutboundCCID, setWebrtcOutboundCCID, setCallState, setIsHeld, resetCall, setWarmTransfer } from '../features/call/callSlice';
import { incrementCallBadge, incrementSmsBadge, markConversationUnread } from '../features/notifications/notificationSlice';
import { updateAgentStatus } from '../features/auth/authSlice';
import { api } from './api';

// Use configured API URL for socket connection, fall back to same origin (reverse proxy)
const API_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || window.location.origin)
  : '';

let socket = null;

export const socketMiddleware = (storeApi) => (next) => (action) => {
  const result = next(action);

  // Connect when user logs in
  if (action.type === 'auth/login/fulfilled') {
    const token = action.payload.token;
    connectSocket(storeApi, token);
  }

  // Connect when hydrating from stored token
  if (action.type === 'auth/hydrateFromToken') {
    const { token } = storeApi.getState().auth;
    if (token && !socket) {
      connectSocket(storeApi, token);
    }
  }

  // Subscribe to push notifications after login or hydrate
  if (action.type === 'auth/login/fulfilled' || action.type === 'auth/hydrateFromToken') {
    const token = storeApi.getState().auth.token;
    if (token) subscribeToPush(token);
  }

  // Disconnect on logout
  if (action.type === 'auth/logout') {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  return result;
};

function connectSocket(storeApi, token) {
  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
  }

  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  // Connection events
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    storeApi.dispatch(connected());
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    storeApi.dispatch(disconnected());
  });

  socket.on('reconnect_attempt', () => {
    storeApi.dispatch(reconnecting());
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
    storeApi.dispatch(error(err.message));
  });

  // Voice events
  socket.on('NEW_CALL', () => {
    storeApi.dispatch(api.util.invalidateTags(['QueueCalls']));
    storeApi.dispatch(incrementCallBadge());
  });

  socket.on('CALL_DEQUEUED', () => {
    storeApi.dispatch(api.util.invalidateTags(['QueueCalls']));
  });

  socket.on('OutboundCCID', (data) => {
    storeApi.dispatch(setOutboundCCID(data));
  });

  socket.on('WebRTC_OutboundCCID', (data) => {
    storeApi.dispatch(setWebrtcOutboundCCID(data));
  });

  socket.on('CALL_ANSWERED', () => {
    storeApi.dispatch(setCallState('ACTIVE'));
  });

  socket.on('CALL_ENDED', () => {
    storeApi.dispatch(resetCall());
  });

  socket.on('CALL_HOLD', () => {
    storeApi.dispatch(setIsHeld(true));
  });

  socket.on('CALL_UNHOLD', () => {
    storeApi.dispatch(setIsHeld(false));
  });

  socket.on('WARM_TRANSFER_STARTED', (data) => {
    storeApi.dispatch(setWarmTransfer({ active: true, thirdPartyCallControlId: data.thirdPartyCallControlId }));
  });

  socket.on('WARM_TRANSFER_FAILED', (data) => {
    storeApi.dispatch(setWarmTransfer({ active: false, thirdPartyCallControlId: null, error: data.reason }));
  });

  socket.on('WARM_TRANSFER_COMPLETED', () => {
    storeApi.dispatch(setWarmTransfer({ active: false, thirdPartyCallControlId: null }));
  });

  socket.on('AGENT_STATUS_CHANGED', (data) => {
    storeApi.dispatch(api.util.invalidateTags(['Agents', 'AdminMetrics', 'AdminUsers']));
    // If the event is for the logged-in user, update their local auth status
    const currentUsername = storeApi.getState().auth.username;
    if (data && data.username === currentUsername && data.status) {
      storeApi.dispatch(updateAgentStatus(data.status));
    }
  });

  // Admin user management events (real-time updates for admin dashboards)
  socket.on('USER_CREATED', () => {
    storeApi.dispatch(api.util.invalidateTags(['AdminUsers', 'AdminMetrics', 'Agents']));
  });

  socket.on('USER_UPDATED', () => {
    storeApi.dispatch(api.util.invalidateTags(['AdminUsers', 'AdminMetrics', 'Agents']));
  });

  socket.on('USER_DELETED', () => {
    storeApi.dispatch(api.util.invalidateTags(['AdminUsers', 'AdminMetrics', 'Agents']));
  });

  // Messaging events
  socket.on('NEW_MESSAGE', (message) => {
    if (message.direction === 'inbound') {
      storeApi.dispatch(incrementSmsBadge());
      if (message.conversation_id) {
        storeApi.dispatch(markConversationUnread(message.conversation_id));
      }
    }
    // Update messages cache inline if possible, otherwise invalidate
    if (message.conversation_id) {
      storeApi.dispatch(
        api.util.updateQueryData('getMessages', message.conversation_id, (draft) => {
          // Only add if not already present (avoid duplicates from optimistic updates)
          if (!draft.find((m) => m.id === message.id)) {
            draft.push(message);
          }
        })
      );
    }
    // Fallback: invalidate Messages tag so UI refreshes even if optimistic update fails
    storeApi.dispatch(api.util.invalidateTags(['Messages']));
    storeApi.dispatch(api.util.invalidateTags(['Conversations']));
  });

  socket.on('MESSAGE_STATUS_UPDATE', (update) => {
    // Patch the message status in-place without refetching
    if (update.conversation_id) {
      storeApi.dispatch(
        api.util.updateQueryData('getMessages', update.conversation_id, (draft) => {
          const msg = draft.find((m) => m.id === update.id);
          if (msg) {
            msg.status = update.status;
            if (update.telnyx_message_id) {
              msg.telnyx_message_id = update.telnyx_message_id;
            }
          }
        })
      );
    }
  });

  socket.on('NEW_CONVERSATION', () => {
    storeApi.dispatch(api.util.invalidateTags(['Conversations']));
  });

  socket.on('CONVERSATION_ASSIGNED', () => {
    storeApi.dispatch(api.util.invalidateTags(['Conversations']));
  });
}

// Web Push Notifications
async function subscribeToPush(token) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Re-send to backend in case it restarted
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription: existing }),
      });
      return;
    }

    // Only auto-request if permission already granted (Safari requires user gesture for first prompt)
    if (Notification.permission === 'granted') {
      await completePushSubscription(registration, token);
    }
    // If 'default' (not yet asked), we'll prompt via the UI button instead
  } catch (err) {
    console.warn('[Push] Failed to subscribe:', err.message);
  }
}

// Exported so the UI can call this from a button click (user gesture — required for Safari)
export async function requestPushPermission() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;

  const token = localStorage.getItem('token');
  if (!token) return 'no-token';

  const registration = await navigator.serviceWorker.ready;
  await completePushSubscription(registration, token);
  return 'granted';
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      // Tell backend to remove this subscription
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint }),
        });
      }
      console.log('[Push] Unsubscribed from push notifications');
    }
  } catch (err) {
    console.warn('[Push] Failed to unsubscribe:', err.message);
  }
}

// Check if currently subscribed
export async function getPushStatus() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

async function completePushSubscription(registration, token) {
  // Get VAPID public key from server
  const vapidRes = await fetch('/api/push/vapid-public-key', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { publicKey } = await vapidRes.json();

  // Subscribe to push
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  // Send subscription to backend
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subscription }),
  });

  console.log('[Push] Subscribed to push notifications');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default socketMiddleware;
