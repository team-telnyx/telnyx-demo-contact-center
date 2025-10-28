'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { notificationService } from '@/utils/notifications';

interface UnreadCountContextType {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  queueUnreadCount: number;
  setQueueUnreadCount: (count: number) => void;
  callQueueUnreadCount: number;
  setCallQueueUnreadCount: (count: number) => void;
}

const UnreadCountContext = createContext<UnreadCountContextType | undefined>(undefined);

export function UnreadCountProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [queueUnreadCount, setQueueUnreadCount] = useState(0);
  const [callQueueUnreadCount, setCallQueueUnreadCount] = useState(0);

  // Track previous values to detect increases
  const prevUnreadCountRef = useRef(0);
  const prevQueueUnreadCountRef = useRef(0);
  const prevCallQueueUnreadCountRef = useRef(0);
  const isInitializedRef = useRef(false);

  // Request notification permission on mount
  useEffect(() => {
    const requestPermission = async () => {
      try {
        await notificationService.requestPermission();
      } catch (error) {
        console.error('Failed to request notification permission:', error);
      }
    };

    // Delay permission request slightly to avoid blocking initial render
    setTimeout(requestPermission, 2000);
  }, []);

  // Watch for new messages (unread + queue unread)
  useEffect(() => {
    if (!isInitializedRef.current) {
      // Skip first render to avoid false notifications on page load
      prevUnreadCountRef.current = unreadCount;
      prevQueueUnreadCountRef.current = queueUnreadCount;
      return;
    }

    const totalPrev = prevUnreadCountRef.current + prevQueueUnreadCountRef.current;
    const totalCurrent = unreadCount + queueUnreadCount;

    if (totalCurrent > totalPrev) {
      const increase = totalCurrent - totalPrev;
      console.log(`📬 New message(s) detected: ${increase}`);

      notificationService.notifyNewMessage(
        'Customer',
        increase === 1
          ? 'You have 1 new message'
          : `You have ${increase} new messages`
      );
    }

    prevUnreadCountRef.current = unreadCount;
    prevQueueUnreadCountRef.current = queueUnreadCount;
  }, [unreadCount, queueUnreadCount]);

  // Watch for new calls in queue
  useEffect(() => {
    if (!isInitializedRef.current) {
      // Skip first render to avoid false notifications on page load
      prevCallQueueUnreadCountRef.current = callQueueUnreadCount;
      isInitializedRef.current = true;
      return;
    }

    if (callQueueUnreadCount > prevCallQueueUnreadCountRef.current) {
      const increase = callQueueUnreadCount - prevCallQueueUnreadCountRef.current;
      console.log(`📞 New call(s) in queue: ${increase}`);

      notificationService.notifyNewCall(
        increase === 1
          ? '1 caller waiting'
          : `${increase} callers waiting`
      );
    }

    prevCallQueueUnreadCountRef.current = callQueueUnreadCount;
  }, [callQueueUnreadCount]);

  return (
    <UnreadCountContext.Provider
      value={{
        unreadCount,
        setUnreadCount,
        queueUnreadCount,
        setQueueUnreadCount,
        callQueueUnreadCount,
        setCallQueueUnreadCount,
      }}
    >
      {children}
    </UnreadCountContext.Provider>
  );
}

export function useUnreadCount() {
  const context = useContext(UnreadCountContext);
  if (!context) {
    throw new Error('useUnreadCount must be used within an UnreadCountProvider');
  }
  return context;
}
