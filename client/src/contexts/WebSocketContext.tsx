'use client';

/**
 * Global WebSocket Context
 *
 * Provides a single, shared WebSocket connection for the entire application.
 * This connection persists across page navigation and is shared by all components.
 */

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/contexts/AuthContext';

type WebSocketEventType =
  | 'NEW_MESSAGE'
  | 'ASSIGNED_CONVERSATIONS_UPDATE'
  | 'UNASSIGNED_CONVERSATIONS_UPDATE'
  | 'NEW_CALL'
  | 'CALL_ENDED'
  | 'CALL_DEQUEUED'
  | 'CALL_UPDATED'
  | 'QUEUE_UPDATE'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'AGENT_STATUS_UPDATE'
  | 'connected'
  | 'pong';

type WebSocketEventCallback = (data: any) => void;

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (eventType: WebSocketEventType, callback: WebSocketEventCallback) => () => void;
  send: (data: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useGlobalWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useGlobalWebSocket must be used within WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
}

// Use NEXT_PUBLIC_API_URL if available (for production/Workers),
// otherwise construct from HOST/PORT (for local development)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (() => {
  const protocol = (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_HTTPS === 'true') ? 'https' : 'http';
  const port = process.env.NEXT_PUBLIC_API_PORT ? `:${process.env.NEXT_PUBLIC_API_PORT}` : '';
  const host = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
  return `${protocol}://${host}${port}/api`;
})();

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { username } = useAuth();

  // Map of event types to subscribers
  const subscribersRef = useRef<Map<WebSocketEventType, Set<WebSocketEventCallback>>>(new Map());

  // Build WebSocket URL - memoized to prevent reconnections
  const websocketUrl = React.useMemo(() => {
    if (!username) return '';

    console.log('🌐 [GlobalWS] Building WebSocket URL...');
    console.log('🌐 [GlobalWS] API_BASE_URL:', API_BASE_URL);
    console.log('🌐 [GlobalWS] Username:', username);

    const wsUrl = API_BASE_URL; // Socket.io expects HTTP/HTTPS base URL
    const fullWsUrl = `${wsUrl}?username=${username}`;

    console.log('🌐 [GlobalWS] Final Socket.io URL:', fullWsUrl);
    return fullWsUrl;
  }, [username]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    const eventType = data.type as WebSocketEventType;

    console.log('🌐 [GlobalWS] Message received:', eventType);
    console.log('🌐 [GlobalWS] Subscribers for this event:', subscribersRef.current.get(eventType)?.size || 0);

    // Get subscribers for this event type
    const subscribers = subscribersRef.current.get(eventType);
    if (subscribers && subscribers.size > 0) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`🌐 [GlobalWS] Error in subscriber for ${eventType}:`, error);
        }
      });
    } else {
      console.log(`🌐 [GlobalWS] No subscribers for event: ${eventType}`);
    }
  }, []);

  const handleWebSocketOpen = useCallback(() => {
    console.log('🌐 [GlobalWS] ✅ GLOBAL WEBSOCKET CONNECTED');
  }, []);

  const handleWebSocketClose = useCallback(() => {
    console.log('🌐 [GlobalWS] 🔌 GLOBAL WEBSOCKET DISCONNECTED');
  }, []);

  const handleWebSocketError = useCallback((error: Event) => {
    console.error('🌐 [GlobalWS] ❌ GLOBAL WEBSOCKET ERROR:', error);
  }, []);

  // Initialize WebSocket connection
  const { send, isConnected } = useWebSocket({
    url: websocketUrl,
    enabled: !!username,
    onOpen: handleWebSocketOpen,
    onClose: handleWebSocketClose,
    onError: handleWebSocketError,
    onMessage: handleWebSocketMessage
  });

  // Subscribe to an event type
  const subscribe = useCallback((eventType: WebSocketEventType, callback: WebSocketEventCallback) => {
    console.log(`🌐 [GlobalWS] New subscription for event: ${eventType}`);
    if (!subscribersRef.current.has(eventType)) {
      subscribersRef.current.set(eventType, new Set());
    }

    const subscribers = subscribersRef.current.get(eventType)!;
    subscribers.add(callback);

    console.log(`🌐 [GlobalWS] Total subscribers for ${eventType}: ${subscribers.size}`);

    // Return unsubscribe function
    return () => {
      console.log(`🌐 [GlobalWS] Unsubscribing from event: ${eventType}`);
      subscribers.delete(callback);

      // Clean up empty sets
      if (subscribers.size === 0) {
        subscribersRef.current.delete(eventType);
      }
    };
  }, []);

  // Log connection status changes
  useEffect(() => {
    console.log('🌐 [GlobalWS] Connection status:', isConnected ? 'CONNECTED' : 'DISCONNECTED');
  }, [isConnected]);

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe, send }}>
      {children}
    </WebSocketContext.Provider>
  );
};
