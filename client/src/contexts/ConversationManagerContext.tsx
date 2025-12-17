'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useGlobalWebSocket } from '@/contexts/WebSocketContext';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useAuth } from '@/contexts/AuthContext';
import { notificationService } from '@/utils/notifications';

interface Conversation {
  conversation_id: string;
  agent_assigned: string | null;
  customer_number: string;
  from_number: string;
  to_number: string;
  updatedAt: string;
  last_read_at?: string | null;
}

interface ConversationManagerContextType {
  assignedConversations: Conversation[];
  unassignedConversations: Conversation[];
  markConversationAsRead: (conversationId: string) => void;
  markAllAsSeen: () => void;
  subscribeToNewMessages: (callback: (conversationId: string, message: any) => void) => () => void;
}

const ConversationManagerContext = createContext<ConversationManagerContextType | undefined>(undefined);

export const useConversationManager = () => {
  const context = useContext(ConversationManagerContext);
  if (!context) {
    return {
      assignedConversations: [],
      unassignedConversations: [],
      markConversationAsRead: () => {},
      markAllAsSeen: () => {},
      subscribeToNewMessages: () => () => {},
    };
  }
  return context;
};

interface ConversationManagerProviderProps {
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

export const ConversationManagerProvider: React.FC<ConversationManagerProviderProps> = ({ children }) => {
  console.log('🏗️ ConversationManagerProvider RENDER');

  const { username, isLoading: authLoading } = useAuth();
  const { setUnreadCount, setQueueUnreadCount } = useUnreadCount();
  const { subscribe: subscribeToGlobalWS } = useGlobalWebSocket();

  console.log('🏗️ Current auth state:', { username, authLoading });


  const [assignedConversations, setAssignedConversations] = useState<Conversation[]>([]);
  const [unassignedConversations, setUnassignedConversations] = useState<Conversation[]>([]);

  // Track previous conversation IDs to detect truly new conversations
  const prevAssignedIdsRef = useRef<Set<string>>(new Set());
  const prevUnassignedIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  // Subscription system for NEW_MESSAGE events
  const newMessageSubscribersRef = useRef<Set<(conversationId: string, message: any) => void>>(new Set());

  // Function to subscribe to NEW_MESSAGE events
  const subscribeToNewMessages = React.useCallback((callback: (conversationId: string, message: any) => void) => {
    console.log('📢 New subscriber added for NEW_MESSAGE events');
    newMessageSubscribersRef.current.add(callback);

    // Return unsubscribe function
    return () => {
      console.log('📢 Subscriber removed from NEW_MESSAGE events');
      newMessageSubscribersRef.current.delete(callback);
    };
  }, []);

  const isConversationUnread = React.useCallback((conversation: Conversation) => {
    if (!conversation.last_read_at) {
      return true;
    }
    try {
      const updatedAtTime = new Date(conversation.updatedAt).getTime();
      const lastReadAtTime = new Date(conversation.last_read_at).getTime();
      return updatedAtTime > lastReadAtTime;
    } catch (error) {
      console.error('Error comparing timestamps for conversation', conversation.conversation_id, error);
      return true;
    }
  }, []);

  const calculateUnreadCount = React.useCallback((conversations: Conversation[]) => {
    return conversations.reduce((count, conversation) => count + (isConversationUnread(conversation) ? 1 : 0), 0);
  }, [isConversationUnread]);

  const fetchUnreadConversations = React.useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!username) {
      setAssignedConversations([]);
      setUnassignedConversations([]);
      setUnreadCount(0);
      setQueueUnreadCount(0);
      return;
    }

    try {
      const assignedUrl = `${API_BASE_URL}/conversations/assignedTo/${username}`;
      const assignedResponse = await fetch(assignedUrl);

      if (assignedResponse.ok) {
        const assignedData: Conversation[] = await assignedResponse.json();
        setAssignedConversations(assignedData);
        setUnreadCount(calculateUnreadCount(assignedData));
      }

      const unassignedUrl = `${API_BASE_URL}/conversations/unassignedConversations`;
      const unassignedResponse = await fetch(unassignedUrl);
      if (unassignedResponse.ok) {
        const unassignedData: Conversation[] = await unassignedResponse.json();
        setUnassignedConversations(unassignedData);
        setQueueUnreadCount(calculateUnreadCount(unassignedData));
      }
    } catch (error) {
      console.error('❌ Error refreshing conversations:', error);
    }
  }, [authLoading, username, calculateUnreadCount, setUnreadCount, setQueueUnreadCount]);

  // Function to mark all current conversations as "seen" (stops notifications without marking as read)
  const markAllAsSeen = () => {
    console.log('👁️ Marking all visible conversations as seen (no more notifications for current list)');

    // Add all current conversation IDs to the "seen" set
    // This prevents notifications from firing again for these conversations
    assignedConversations.forEach(conv => {
      prevAssignedIdsRef.current.add(conv.conversation_id);
    });

    unassignedConversations.forEach(conv => {
      prevUnassignedIdsRef.current.add(conv.conversation_id);
    });

    console.log(`✅ Marked ${assignedConversations.length} assigned and ${unassignedConversations.length} unassigned conversations as seen`);
  };

  // Log when provider mounts/unmounts
  useEffect(() => {
    console.log('✅ ConversationManagerProvider MOUNTED');
    return () => {
      console.log('❌ ConversationManagerProvider UNMOUNTED');
    };
  }, []);

  // Function to mark a conversation as read (calls API)
  const markConversationAsRead = async (conversationId: string) => {
    console.log('📖 Marking conversation as read:', conversationId);
    console.log('📊 Current state before marking as read:');
    console.log('  - Assigned conversations:', assignedConversations.length);
    console.log('  - Unassigned conversations:', unassignedConversations.length);
    console.log('  - Tracked assigned IDs:', Array.from(prevAssignedIdsRef.current));
    console.log('  - Tracked unassigned IDs:', Array.from(prevUnassignedIdsRef.current));

    // Optimistically update local state so the UI reflects the read status immediately
    console.log('🔄 Updating conversation read status locally');
    const nowIso = new Date().toISOString();

    setAssignedConversations(prev => {
      const updated = prev.map(c =>
        c.conversation_id === conversationId ? { ...c, last_read_at: nowIso } : c
      );
      const unreadCount = calculateUnreadCount(updated);
      console.log(`  - Assigned conversations (unread): ${unreadCount}`);
      setUnreadCount(unreadCount);
      return updated;
    });
    setUnassignedConversations(prev => {
      const updated = prev.map(c =>
        c.conversation_id === conversationId ? { ...c, last_read_at: nowIso } : c
      );
      const unreadQueue = calculateUnreadCount(updated);
      console.log(`  - Unassigned conversations (unread): ${unreadQueue}`);
      setQueueUnreadCount(unreadQueue);
      return updated;
    });

    try {
      const url = `${API_BASE_URL}/conversations/markAsRead`;

      console.log('📡 Calling API:', url);
      console.log('📡 Request body:', { conversation_id: conversationId });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversation_id: conversationId }),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Conversation marked as read on server');
        console.log('✅ Server response:', data);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to mark conversation as read:', errorText);
      }
    } catch (error) {
      console.error('❌ Error marking conversation as read:', error);
    }
  };

  // Subscribe to WebSocket events from global WebSocket provider
  useEffect(() => {
    // Wait for auth to load
    if (authLoading || !username) {
      return;
    }

    // Subscribe to NEW_MESSAGE events
    const unsubscribeNewMessage = subscribeToGlobalWS('NEW_MESSAGE', (data) => {
      console.log('📨 NEW_MESSAGE event received in ConversationManager');
      console.log('📨 Conversation ID:', data.conversationId);
      console.log('📨 Number of message subscribers:', newMessageSubscribersRef.current.size);

      // Notify all subscribers
      newMessageSubscribersRef.current.forEach(callback => {
        try {
          callback(data.conversationId, data.message);
        } catch (error) {
          console.error('Error in NEW_MESSAGE subscriber:', error);
        }
      });

      // Refresh assigned/unassigned lists so badges update even when SMS page is inactive
      fetchUnreadConversations();
    });

    // Subscribe to ASSIGNED_CONVERSATIONS_UPDATE events
    const unsubscribeAssigned = subscribeToGlobalWS('ASSIGNED_CONVERSATIONS_UPDATE', (data) => {
        const conversations = data.data || [];
        console.log('📨 [WS] Assigned conversations update (unread only):', conversations.length);

        // Get current conversation IDs
        const currentIds = new Set(conversations.map((c: Conversation) => c.conversation_id));

        // Detect truly new conversations (not seen before)
        if (isInitializedRef.current) {
          const newConversations = conversations.filter(
            (c: Conversation) => !prevAssignedIdsRef.current.has(c.conversation_id)
          );

          if (newConversations.length > 0) {
            console.log(`📬 [WS] New assigned conversation(s) detected: ${newConversations.length}`);

            // Trigger notification for new assigned messages
            notificationService.notifyNewMessage(
              'Customer',
              newConversations.length === 1 ? 'You have 1 new message' : `You have ${newConversations.length} new messages`
            );
          }
        }

        setAssignedConversations(conversations);
        const unreadAssignedCount = calculateUnreadCount(conversations);
        setUnreadCount(unreadAssignedCount);
        prevAssignedIdsRef.current = currentIds;
    });

    // Subscribe to UNASSIGNED_CONVERSATIONS_UPDATE events
    const unsubscribeUnassigned = subscribeToGlobalWS('UNASSIGNED_CONVERSATIONS_UPDATE', (data) => {
        const conversations = data.data || [];
        console.log('📨 Unassigned conversations update (unread only):', conversations.length);

        // Get current conversation IDs
        const currentIds = new Set(conversations.map((c: Conversation) => c.conversation_id));

        // Detect truly new conversations (not seen before)
        if (isInitializedRef.current) {
          const newConversations = conversations.filter(
            (c: Conversation) => !prevUnassignedIdsRef.current.has(c.conversation_id)
          );

          if (newConversations.length > 0) {
            console.log(`📬 New unassigned conversation(s): ${newConversations.length}`);
            console.log('New conversation IDs:', newConversations.map((c: Conversation) => c.conversation_id));

            // Trigger notification for new unassigned messages
            notificationService.notifyNewMessage(
              'Queue',
              newConversations.length === 1 ? '1 new message in queue' : `${newConversations.length} new messages in queue`
            );
          }
        }

        setUnassignedConversations(conversations);
        const unreadUnassignedCount = calculateUnreadCount(conversations);
        setQueueUnreadCount(unreadUnassignedCount);
        prevUnassignedIdsRef.current = currentIds;

        // Mark as initialized after first update
        if (!isInitializedRef.current) {
          isInitializedRef.current = true;
        }
    });

    // Cleanup subscriptions when component unmounts or username changes
    return () => {
      unsubscribeNewMessage();
      unsubscribeAssigned();
      unsubscribeUnassigned();
    };
  }, [authLoading, username, subscribeToGlobalWS, setUnreadCount, setQueueUnreadCount, calculateUnreadCount, fetchUnreadConversations]);

  // Separate effect for initial data fetch - runs after auth is loaded and username is available
  useEffect(() => {
    if (!authLoading) {
      fetchUnreadConversations();
    }
  }, [authLoading, fetchUnreadConversations]);

  return (
    <ConversationManagerContext.Provider
      value={{
        assignedConversations,
        unassignedConversations,
        markConversationAsRead,
        markAllAsSeen,
        subscribeToNewMessages,
      }}
    >
      {children}
    </ConversationManagerContext.Provider>
  );
};
