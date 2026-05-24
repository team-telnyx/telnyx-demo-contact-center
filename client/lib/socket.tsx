'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';

// In dev, Next.js rewrites don't proxy WebSocket upgrades, so connect
// directly to the backend. In prod (behind nginx), use same-origin.
const SOCKET_URL: string | undefined =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== 'undefined' && window.location.port === '3000'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : undefined);

// Server is mounted at `/api/socket.io` (see server/services/socket.js).
const SOCKET_PATH = '/api/socket.io';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  on: (event: string, handler: (...args: any[]) => void) => () => void;
  emit: (event: string, data?: any) => void;
  reconnectCount: number;
}

const SocketContext = createContext<SocketContextValue | null>(null);

/**
 * Provider that opens a single Socket.IO connection for the whole app.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const s = io(SOCKET_URL, {
      path: SOCKET_PATH,
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = s;
    setSocket(s);

    const onConnect = () => {
      setConnected(true);
      if ((socketRef.current as any)?._reconnecting) {
        setReconnectCount((c) => c + 1);
      }
      socketRef.current = socketRef.current || s;
      if (socketRef.current) (socketRef.current as any)._reconnecting = true;
    };
    const onDisconnect = () => setConnected(false);
    const onError = (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('Socket.IO connection error:', err?.message || err);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onError);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onError);
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    const s = socketRef.current;
    if (!s) return () => {};
    s.on(event, handler);
    return () => s.off(event, handler);
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  const value = useMemo<SocketContextValue>(
    () => ({ socket, connected, on, emit, reconnectCount }),
    [socket, connected, on, emit, reconnectCount]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

/**
 * Hook to access the shared Socket.IO connection.
 */
export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        'useSocket() called outside <SocketProvider>. Real-time events will not work.'
      );
    }
    return {
      socket: null,
      connected: false,
      on: () => () => {},
      emit: () => {},
      reconnectCount: 0,
    };
  }
  return ctx;
}

/**
 * Hook to subscribe to a single Socket.IO event over the shared connection.
 */
export function useSocketEvent(event: string, handler: (...args: any[]) => void): void {
  const { on } = useSocket();
  useEffect(() => {
    return on(event, handler);
  }, [event, handler, on]);
}

/**
 * Hook that calls the given callback whenever the Socket.IO connection
 * reconnects after a disconnect.
 */
export function useReconnect(callback: () => void): void {
  const { reconnectCount } = useSocket();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (reconnectCount > 0) {
      callbackRef.current();
    }
  }, [reconnectCount]);
}
