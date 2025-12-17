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
      console.log('🔔 [useUnreadCount] First message render - initializing counts');
      console.log(`  - unreadCount: ${unreadCount}, queueUnreadCount: ${queueUnreadCount}`);
      prevUnreadCountRef.current = unreadCount;
      prevQueueUnreadCountRef.current = queueUnreadCount;
      isInitializedRef.current = true;
      return;
    }

    const totalPrev = prevUnreadCountRef.current + prevQueueUnreadCountRef.current;
    const totalCurrent = unreadCount + queueUnreadCount;

    console.log('🔔 [useUnreadCount] Message counts changed:');
    console.log(`  - Previous total: ${totalPrev} (unread: ${prevUnreadCountRef.current}, queue: ${prevQueueUnreadCountRef.current})`);
    console.log(`  - Current total: ${totalCurrent} (unread: ${unreadCount}, queue: ${queueUnreadCount})`);

    if (totalCurrent > totalPrev) {
      const increase = totalCurrent - totalPrev;
      console.log(`📬 New message(s) detected: ${increase}`);

      notificationService.notifyNewMessage(
        'Customer',
        increase === 1
          ? 'You have 1 new message'
          : `You have ${increase} new messages`
      );
    } else {
      console.log('✅ [useUnreadCount] No increase in message count - skipping notification');
    }

    prevUnreadCountRef.current = unreadCount;
    prevQueueUnreadCountRef.current = queueUnreadCount;
  }, [unreadCount, queueUnreadCount]);

  // Watch for new calls in queue
  useEffect(() => {
    console.log('🔔 [useUnreadCount] callQueueUnreadCount changed to:', callQueueUnreadCount);
    console.log('🔔 isInitialized:', isInitializedRef.current);
    console.log('🔔 previous count:', prevCallQueueUnreadCountRef.current);

    // Only process if already initialized (message effect runs first)
    if (!isInitializedRef.current) {
      console.log('🔔 Not initialized yet - setting previous count');
      prevCallQueueUnreadCountRef.current = callQueueUnreadCount;
      return;
    }

    if (callQueueUnreadCount > prevCallQueueUnreadCountRef.current) {
      const increase = callQueueUnreadCount - prevCallQueueUnreadCountRef.current;
      console.log(`📞 New call(s) detected in queue: ${increase}`);
      console.log(`📞 Triggering notification for call queue`);

      notificationService.notifyNewCall(
        increase === 1
          ? '1 caller waiting'
          : `${increase} callers waiting`
      );
    } else {
      console.log('🔔 No increase in call queue count, skipping notification');
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
