import { io } from 'socket.io-client';
import { connected, disconnected, reconnecting, error } from '../features/socket/socketSlice';
import { setOutboundCCID, setWebrtcOutboundCCID, setCallState, setIsHeld, resetCall, setWarmTransfer } from '../features/call/callSlice';
import { incrementCallBadge, incrementSmsBadge } from '../features/notifications/notificationSlice';
import { api } from './api';

const API_URL = `https://${process.env.NEXT_PUBLIC_API_HOST || process.env.REACT_APP_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT || process.env.REACT_APP_API_PORT}`;

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

  socket.on('AGENT_STATUS_CHANGED', () => {
    storeApi.dispatch(api.util.invalidateTags(['Agents']));
  });

  // Messaging events
  socket.on('NEW_MESSAGE', (message) => {
    if (message.direction === 'inbound') {
      storeApi.dispatch(incrementSmsBadge());
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

export default socketMiddleware;
