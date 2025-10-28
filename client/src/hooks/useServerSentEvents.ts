'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseSSEOptions {
  url: string;
  onMessage: (data: any) => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
}

export function useServerSentEvents({ url, onMessage, onError, enabled = true }: UseSSEOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        // Only log initial connection, not reconnections
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('SSE: Error parsing message:', error);
        }
      };

      eventSource.onerror = (error) => {
        // Only log actual errors, not normal disconnects
        if (onError) {
          onError(error);
        }

        // Auto-reconnect after 5 seconds
        if (eventSource.readyState === EventSource.CLOSED) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };
    } catch (error) {
      console.error('Error creating EventSource:', error);
    }
  }, [url, onMessage, onError, enabled]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, enabled]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, []);

  return { disconnect, reconnect: connect };
}
