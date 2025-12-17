'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';
import { useGlobalWebSocket } from '@/contexts/WebSocketContext';
import { SIPCredentialsContext } from './SIPCredentialsContext';
import { getState as getCallStoreState, clear as clearCallStore } from '@/lib/call-store';
import { notificationService } from '@/utils/notifications';
import { useUnreadCount } from '@/hooks/useUnreadCount';

interface Call {
  id: string;
  type: 'webrtc' | 'queue' | 'outbound';
  from: string;
  to: string;
  timestamp: Date;
  state: string;
  callControlId?: string;
  customerCallId?: string;
  bridgeId?: string;
  direction: 'inbound' | 'outbound';
}

interface CallManagerContextType {
  activeCall: Call | null;
  incomingCalls: Call[];
  callHistory: Call[];
  callState: string;
  isCallModalOpen: boolean;
  modalType: string | null;
  acceptQueueCall: () => Promise<any>;  // No longer requires callData
  answerWebRTCCall: (callId: string) => any;
  declineCall: (callId: string) => any;
  hangUpCall: (callControlId?: string) => any;
  makeOutboundCall: (to: string) => any;
  handleWebRTCCall: (callData: any) => void;
  closeModal: () => void;
  openModal: (type: string, callData?: any) => void;
  refreshCallData: () => Promise<void>;
}

const CallManagerContext = createContext<CallManagerContextType | undefined>(undefined);

export const useCallManager = () => {
  const context = useContext(CallManagerContext);
  if (!context) {
    console.warn('useCallManager used outside of CallManagerProvider, returning defaults');
    return {
      activeCall: null,
      incomingCalls: [],
      callHistory: [],
      callState: 'IDLE',
      isCallModalOpen: false,
      modalType: null,
      acceptQueueCall: () => Promise.resolve({ success: false }),
      answerWebRTCCall: () => ({ success: false }),
      declineCall: () => ({ success: false }),
      hangUpCall: () => ({ success: false }),
      makeOutboundCall: () => null,
      handleWebRTCCall: () => {},
      closeModal: () => {},
      openModal: () => {},
      refreshCallData: () => Promise.resolve()
    };
  }
  return context;
};

interface CallManagerProviderProps {
  children: React.ReactNode;
  username?: string;
}

export const CallManagerProvider: React.FC<CallManagerProviderProps> = ({
  children,
  username
}) => {
  // Get SIP credentials from context
  const sipCredentials = useContext(SIPCredentialsContext);

  // Get unread count context for badge updates
  const { setCallQueueUnreadCount } = useUnreadCount();

  // Get global WebSocket for real-time call updates
  const { subscribe: subscribeToGlobalWS } = useGlobalWebSocket();

  // Call states
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCalls, setIncomingCalls] = useState<Call[]>([]);
  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [callState, setCallState] = useState('IDLE');

  // Modal states
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);

  // Helper: build active call object from DB session + legs
  const buildActiveCallFromSession = useCallback((session: any, legs: any[]): Call | null => {
    try {
      if (!session || !legs) return null;
      const agentLeg = legs.find(l => l.leg_type === 'agent' && l.status !== 'ended');
      const customerLeg = legs.find(l => l.leg_type === 'customer');
      const state = session.status === 'active' ? 'ACTIVE' : (session.status === 'queued' ? 'INCOMING' : 'IDLE');

      return {
        id: agentLeg?.call_control_id || session.sessionKey,
        type: 'queue',
        from: session.from_number || 'Unknown',
        to: session.to_number || '',
        timestamp: new Date(session.started_at || Date.now()),
        state,
        callControlId: agentLeg?.call_control_id || null,
        customerCallId: session.sessionKey,
        bridgeId: session.sessionKey,
        direction: 'inbound'
      };
    } catch (err) {
      console.error('CallManager: buildActiveCallFromSession error:', err);
      return null;
    }
  }, []);

  // Refresh call data from server (replaces websocket events)
  const refreshCallData = useCallback(async () => {
    if (!username) return;

    try {
      // Get active session
      const activeSessionData = await apiService.getMyActiveSession();
      if (activeSessionData?.session && activeSessionData?.legs) {
        const call = buildActiveCallFromSession(activeSessionData.session, activeSessionData.legs);
        if (call && call.state === 'ACTIVE') {
          setActiveCall(call);
          setCallState('ACTIVE');
        } else {
          // Don't reset to IDLE if we're currently dialing (accepting a queue call)
          if (callState !== 'DIALING') {
            setActiveCall(null);
            setCallState('IDLE');
          }
        }
      } else {
        // Don't reset to IDLE if we're currently dialing (accepting a queue call)
        if (callState !== 'DIALING') {
          setActiveCall(null);
          setCallState('IDLE');
        }
      }

      // Get queue data for incoming calls
      const queueData = await apiService.getQueueData();
      if (queueData?.incomingCalls) {
        const formattedCalls = queueData.incomingCalls.map((call: any) => ({
          id: call.call_control_id || call.id,
          type: 'queue',
          from: call.from || 'Unknown',
          to: call.to || '',
          timestamp: new Date(call.created_at || Date.now()),
          state: 'INCOMING',
          callControlId: call.call_control_id,
          direction: 'inbound'
        }));
        setIncomingCalls(formattedCalls);
        setCallQueueUnreadCount(formattedCalls.length);
      } else {
        setIncomingCalls([]);
        setCallQueueUnreadCount(0);
      }
    } catch (error) {
      console.error('CallManager: Failed to refresh call data:', error);
    }
  }, [username, buildActiveCallFromSession, callState]);

  // Subscribe to WebSocket events for real-time call updates
  useEffect(() => {
    if (!username) return;

    console.log('📡 CallManager: Setting up WebSocket subscriptions');

    // Subscribe to NEW_CALL events
    const unsubscribeNewCall = subscribeToGlobalWS('NEW_CALL', (data) => {
      console.log('📞 CallManager: NEW_CALL event received', data);

      const call = data.call;
      const formattedCall = {
        id: call.call_control_id || call.id,
        type: 'queue' as const,
        from: call.from || 'Unknown',
        to: call.to || '',
        timestamp: new Date(call.created_at || Date.now()),
        state: 'INCOMING',
        callControlId: call.call_control_id,
        direction: 'inbound' as const
      };

      // Add to incoming calls
      setIncomingCalls(prev => {
        const exists = prev.find(c => c.id === formattedCall.id);
        if (exists) return prev;

        console.log('📞 New incoming call from:', formattedCall.from);
        notificationService.notifyNewCall(formattedCall.from);

        const updated = [...prev, formattedCall];
        setCallQueueUnreadCount(updated.length);
        return updated;
      });
    });

    // Subscribe to CALL_ENDED events
    const unsubscribeCallEnded = subscribeToGlobalWS('CALL_ENDED', (data) => {
      console.log('📞 CallManager: CALL_ENDED event received', data);

      const callControlId = data.callControlId;

      // Remove from incoming calls
      setIncomingCalls(prev => {
        const updated = prev.filter(c => c.callControlId !== callControlId);
        setCallQueueUnreadCount(updated.length);
        return updated;
      });

      // Clear active call if it matches
      setActiveCall(prev => {
        if (prev?.callControlId === callControlId) {
          setCallState('IDLE');
          setIsCallModalOpen(false);
          setModalType(null);

          // Also trigger WebRTC call hangup if there's an active WebRTC call
          const currentCallState = getCallStoreState();
          if (currentCallState.call && typeof currentCallState.call.hangup === 'function') {
            try {
              currentCallState.call.hangup();
              clearCallStore();
            } catch (error) {
              console.error('CallManager: Error hanging up WebRTC call:', error);
            }
          }

          return null;
        }
        return prev;
      });
    });

    // Subscribe to CALL_UPDATED events (for bridging, accepting, etc.)
    const unsubscribeCallUpdated = subscribeToGlobalWS('CALL_UPDATED', (data) => {
      console.log('📞 CallManager: CALL_UPDATED event received', data);

      if (data.status === 'active' || data.status === 'bridged') {
        setCallState('ACTIVE');
        if (activeCall) {
          setActiveCall({
            ...activeCall,
            state: 'ACTIVE'
          });
        }
      }
    });

    // Subscribe to CALL_DEQUEUED events (when calls are removed from queue)
    const unsubscribeCallDequeued = subscribeToGlobalWS('CALL_DEQUEUED', (data) => {
      console.log('📤 CallManager: CALL_DEQUEUED event received', data);

      const callControlId = data.callControlId;

      // Remove from incoming calls immediately
      setIncomingCalls(prev => {
        const updated = prev.filter(c => c.callControlId !== callControlId);
        setCallQueueUnreadCount(updated.length);
        console.log('📤 Removed dequeued call from queue display:', callControlId);
        return updated;
      });
    });

    // Subscribe to QUEUE_UPDATE events (trigger full refresh)
    const unsubscribeQueueUpdate = subscribeToGlobalWS('QUEUE_UPDATE', (_data) => {
      console.log('📤 CallManager: QUEUE_UPDATE event received - refreshing queue');
      refreshCallData();
    });

    console.log('📡 CallManager: WebSocket subscriptions set up successfully');

    // Cleanup subscriptions
    return () => {
      console.log('📡 CallManager: Cleaning up WebSocket subscriptions');
      unsubscribeNewCall();
      unsubscribeCallEnded();
      unsubscribeCallUpdated();
      unsubscribeCallDequeued();
      unsubscribeQueueUpdate();
    };
  }, [username, subscribeToGlobalWS, activeCall, callState, setCallQueueUnreadCount, refreshCallData]);

  // Initial load only
  useEffect(() => {
    if (username) {
      refreshCallData();
    }
  }, [username, refreshCallData]);

  // Accept next call from queue
  const acceptQueueCall = useCallback(async () => {
    try {
      console.log('🟢 [CallManager] acceptQueueCall STARTED');

      // Check if we have SIP credentials
      if (!sipCredentials || !sipCredentials.login) {
        console.error('🔴 [CallManager] No SIP credentials available');
        return { success: false, error: 'SIP credentials not loaded' };
      }
      console.log('🟢 [CallManager] SIP credentials found:', sipCredentials.login);

      // Set state to dialing
      console.log('🟢 [CallManager] Setting call state to DIALING');
      setCallState('DIALING');
      setModalType('incoming');
      setIsCallModalOpen(true);

      // Call API to accept next call - pass sipUsername from credentials
      console.log('🟢 [CallManager] Calling apiService.acceptCall with sipUsername:', sipCredentials.login);
      const response = await apiService.acceptCall(sipCredentials.login);
      console.log('🟢 [CallManager] apiService.acceptCall response:', response);

      // Check if response indicates success
      if (response && (response.success === true || response.success === undefined && !response.error)) {
        console.log('✅ [CallManager] Call acceptance initiated successfully');
        // The call state will be updated via SSE when bridged
        // The active call will be set when we receive the CALL_ACCEPTED event
        return { success: true, data: response };
      } else {
        console.error('🔴 [CallManager] Accept call failed:', response);
        // Reset state on error
        setCallState('IDLE');
        setIsCallModalOpen(false);
        return { success: false, error: response?.error || 'Unknown error' };
      }
    } catch (error: any) {
      console.error('🔴 [CallManager] Failed to accept call - Exception:', error);
      console.error('🔴 [CallManager] Error stack:', error.stack);
      // Reset state on error
      setCallState('IDLE');
      setIsCallModalOpen(false);
      return { success: false, error: error.message };
    }
  }, [sipCredentials]);

  // Answer WebRTC call (placeholder - WebRTC handled elsewhere)
  const answerWebRTCCall = useCallback((callId: string) => {
    console.log('CallManager: Answer WebRTC call:', callId);
    return { success: true };
  }, []);

  // Decline call
  const declineCall = useCallback((callId: string) => {
    console.log('CallManager: Decline call:', callId);
    setIncomingCalls(prev => prev.filter(call => call.id !== callId));
    return { success: true };
  }, []);

  // Hang up call
  const hangUpCall = useCallback(async (callControlId?: string) => {
    try {
      const targetCallId = callControlId || activeCall?.callControlId;
      if (!targetCallId) {
        console.warn('CallManager: No call control ID for hangup');
        return { success: false };
      }

      console.log('CallManager: Hanging up call:', targetCallId);
      const response = await apiService.hangUpCall(targetCallId);

      if (response.success) {
        setActiveCall(null);
        setCallState('IDLE');
        setIsCallModalOpen(false);
        setModalType(null);
        // Refresh to sync with server
        await refreshCallData();
      }

      return response;
    } catch (error) {
      console.error('CallManager: Failed to hang up call:', error);
      return { success: false, error: error.message };
    }
  }, [activeCall, refreshCallData]);

  // Make outbound call (placeholder)
  const makeOutboundCall = useCallback((to: string) => {
    console.log('CallManager: Make outbound call to:', to);
    return null;
  }, []);

  // Handle WebRTC call - automatically answer incoming calls after accepting from queue
  const handleWebRTCCall = useCallback((call: any, state: string) => {
    console.log('CallManager: Handle WebRTC call:', {
      state,
      callId: call?.id,
      callDirection: call?.direction,
      callState: call?.state,
      currentCallState: callState
    });

    // When we receive an incoming WebRTC call while in DIALING state (accepting queue call)
    // State can be 'RINGING' (uppercase from EnhancedModal) or 'ringing' (lowercase from SDK)
    const isRinging = state.toUpperCase() === 'RINGING';
    // Accept both 'inbound' and undefined direction - undefined happens when backend dials agent for queue
    const isInbound = call?.direction === 'inbound' || call?.direction === undefined;
    const isDialing = callState === 'DIALING';

    console.log('CallManager: Answer check:', { isRinging, isInbound, isDialing, direction: call?.direction });

    if (isRinging && isInbound && isDialing) {
      console.log('CallManager: ✅ Auto-answering incoming WebRTC call for accepted queue call (direction:', call?.direction, ')');

      // Answer the WebRTC call
      if (call && typeof call.answer === 'function') {
        try {
          call.answer();
          console.log('CallManager: ✅ WebRTC call.answer() executed successfully');

          // Update call state to active
          setCallState('ACTIVE');
          if (activeCall) {
            setActiveCall({
              ...activeCall,
              state: 'ACTIVE'
            });
          }
        } catch (error) {
          console.error('CallManager: ❌ Error answering WebRTC call:', error);
          setCallState('ERROR');
        }
      } else {
        console.error('CallManager: ❌ call.answer is not a function:', {
          callExists: !!call,
          answerType: typeof call?.answer,
          callMethods: call ? Object.getOwnPropertyNames(Object.getPrototypeOf(call)) : []
        });
      }
    }

    // Handle call end states
    const endStates = ['HANGUP', 'ENDED', 'TERMINATED', 'FAILED', 'DESTROY', 'PURGE'];
    if (endStates.includes(state.toUpperCase())) {
      console.log('CallManager: WebRTC call ended with state:', state);
      setActiveCall(null);
      setCallState('IDLE');
      setIsCallModalOpen(false);
      setModalType(null);
    }

    // Handle active/answering states
    if (state.toUpperCase() === 'ACTIVE' || state.toUpperCase() === 'ANSWERING') {
      console.log('CallManager: WebRTC call is now active');
      setCallState('ACTIVE');
      if (activeCall) {
        setActiveCall({
          ...activeCall,
          state: 'ACTIVE'
        });
      }
    }
  }, [callState, activeCall]);

  // Modal management
  const closeModal = useCallback(() => {
    setIsCallModalOpen(false);
    setModalType(null);
  }, []);

  const openModal = useCallback((type: string, callData?: any) => {
    setModalType(type);
    setIsCallModalOpen(true);
  }, []);

  const value: CallManagerContextType = {
    activeCall,
    incomingCalls,
    callHistory,
    callState,
    isCallModalOpen,
    modalType,
    acceptQueueCall,
    answerWebRTCCall,
    declineCall,
    hangUpCall,
    makeOutboundCall,
    handleWebRTCCall,
    closeModal,
    openModal,
    refreshCallData
  };

  return (
    <CallManagerContext.Provider value={value}>
      {children}
    </CallManagerContext.Provider>
  );
};
