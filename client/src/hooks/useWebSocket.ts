'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: any) => void;
  onError?: (error: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  enabled?: boolean;
}

export function useWebSocket({
  url,
  onMessage,
  onError,
  onOpen,
  onClose,
  enabled = true
}: UseWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !url) return;

    // Convert WS/WSS URL to HTTP/HTTPS for Socket.io
    // Socket.io client expects http://domain:port, not ws://
    const httpUrl = url.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');

    // Extract search params (username)
    const urlObj = new URL(httpUrl);
    const username = urlObj.searchParams.get('username');
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    console.log('%c🔌🔌🔌 SOKET.IO CONNECTION ATTEMPT 🔌🔌🔌', 'background: #ff6b6b; color: #fff; font-size: 14px; padding: 4px;');
    console.log('Target URL:', baseUrl);
    console.log('Username:', username);

    const socket = io(baseUrl, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      query: {
        username: username
      }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('%c✅✅✅ SOCKET.IO CONNECTED ✅✅✅', 'background: #51cf66; color: #000; font-size: 14px; padding: 4px;');
      console.log('Socket ID:', socket.id);
      setIsConnected(true);
      if (onOpen) onOpen();

      // Emit identify event as expected by server
      if (username) {
        socket.emit('identify', {
          username,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('%c🔌 SOCKET.IO DISCONNECTED', 'background: #ffd43b; color: #000; font-size: 14px; padding: 4px;');
      console.log('Reason:', reason);
      setIsConnected(false);
      if (onClose) onClose();
    });

    socket.on('connect_error', (error) => {
      console.error('%c❌ SOCKET.IO ERROR ❌', 'background: #fa5252; color: #fff; font-size: 14px; padding: 4px;', error);
      if (onError) onError(error);
    });

    // Listen to ALL events and forward them to onMessage in the unified format
    // This maintains compatibility with the existing code structure
    socket.onAny((eventName, ...args) => {
      // Skip internal events
      if (eventName === 'connect' || eventName === 'disconnect' || eventName === 'connect_error') return;

      const payload = args[0] || {};

      console.log(`%c📨 EVENT: ${eventName}`, 'color: #4dabf7', payload);

      // Transform to expected format if needed
      // Existing code expects { type: 'EVENT_NAME', ...data }
      const messageData = {
        type: eventName,
        ...payload
      };

      try {
        onMessage(messageData);
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    return () => {
      console.log('Cleaning up Socket.io connection...');
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [url, enabled]); // Intentionally removed callbacks from deps to prevent reconnects

  const send = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.connected) {
      // Should we emit generic 'message' or specific event?
      // For now, emit 'message' to match generic behavior, or extract type if present
      const eventType = data.type || 'message';
      socketRef.current.emit(eventType, data);
    } else {
      console.warn('Socket not connected, cannot send:', data);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  }, []);

  const reconnect = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
  }, []);

  return {
    isConnected,
    send,
    disconnect,
    reconnect
  };
}
