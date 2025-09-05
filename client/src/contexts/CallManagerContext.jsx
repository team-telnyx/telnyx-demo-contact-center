import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../components/AuthContext';
import { SIPCredentialsContext } from '../components/SIPCredentialsContext';
import apiService from '../services/apiService';
import { getWebSocketUrl } from '../utils/apiUtils';

const CallManagerContext = createContext();

export const useCallManager = () => {
  const context = useContext(CallManagerContext);
  if (!context) {
    // Return safe defaults instead of throwing error
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
      socket: null
    };
  }
  return context;
};

export const CallManagerProvider = ({ children }) => {
  const { username } = useAuth();
  const sipCredentials = useContext(SIPCredentialsContext);
  
  // Call states
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCalls, setIncomingCalls] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [callState, setCallState] = useState('IDLE'); // IDLE, INCOMING, ACTIVE, DIALING, HOLDING
  
  // Modal states
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // 'webrtc', 'queue', 'outbound'
  
  // WebSocket connection
  const [socket, setSocket] = useState(null);
  
  // Initialize socket connection
  useEffect(() => {
    if (username) {
      const socketConnection = io(getWebSocketUrl());
      
      socketConnection.on('connect', () => {
        console.log('CallManager: Connected to websocket');
        // Identify this agent to the server
        socketConnection.emit('identify', { username });
      });
      
      // Listen for incoming queue calls
      socketConnection.on('NEW_CALL', (callData) => {
        console.log('CallManager: *** WEBSOCKET EVENT RECEIVED: NEW_CALL ***');
        console.log('CallManager: New queue call received:', callData);
        handleIncomingQueueCall(callData);
      });
      
      // Listen for call status updates
      socketConnection.on('CALL_UPDATE', (callData) => {
        console.log('CallManager: Call update received:', callData);
        handleCallUpdate(callData);
      });
      
      // Listen for call hangup events
      socketConnection.on('CALL_HANGUP', (hangupData) => {
        console.log('CallManager: *** WEBSOCKET EVENT RECEIVED: CALL_HANGUP ***');
        console.log('CallManager: Call hangup received:', hangupData);
        handleCallHangup(hangupData);
      });
      
      // Listen for call accepted events (targeted to specific agent)
      socketConnection.on('CALL_ACCEPTED', (callData) => {
        console.log('CallManager: *** WEBSOCKET EVENT RECEIVED: CALL_ACCEPTED ***');
        console.log('CallManager: Call accepted by this agent:', callData);
        handleCallAccepted(callData);
      });
      
      // Listen for transfer events
      socketConnection.on('TRANSFER_INITIATED', (transferData) => {
        console.log('CallManager: *** WEBSOCKET EVENT RECEIVED: TRANSFER_INITIATED ***');
        console.log('CallManager: Transfer initiated:', transferData);
      });
      
      socketConnection.on('TRANSFER_COMPLETED', (transferData) => {
        console.log('CallManager: *** WEBSOCKET EVENT RECEIVED: TRANSFER_COMPLETED ***');
        console.log('CallManager: Transfer completed:', transferData);
        handleTransferCompleted(transferData);
      });
      
      socketConnection.on('TRANSFER_FAILED', (transferData) => {
        console.log('CallManager: *** WEBSOCKET EVENT RECEIVED: TRANSFER_FAILED ***');
        console.log('CallManager: Transfer failed:', transferData);
      });

      // Add debugging for websocket connection
      socketConnection.on('connect', () => {
        console.log('CallManager: *** WEBSOCKET CONNECTED SUCCESSFULLY ***');
        console.log('CallManager: Socket ID:', socketConnection.id);
      });
      
      socketConnection.on('disconnect', (reason) => {
        console.log('CallManager: *** WEBSOCKET DISCONNECTED ***');
        console.log('CallManager: Disconnect reason:', reason);
      });
      
      socketConnection.on('connect_error', (error) => {
        console.log('CallManager: *** WEBSOCKET CONNECTION ERROR ***');
        console.log('CallManager: Error:', error);
      });

      // Catch-all event listener to debug all websocket events
      if (socketConnection.onAny) {
        socketConnection.onAny((eventName, ...args) => {
          console.log(`CallManager: *** WEBSOCKET EVENT: ${eventName} ***`);
          console.log('CallManager: Event args:', args);
        });
      }

      
      setSocket(socketConnection);
      
      return () => {
        socketConnection.disconnect();
      };
    }
  }, [username, handleCallAccepted, handleCallHangup, handleCallUpdate, handleIncomingQueueCall, handleTransferCompleted]);

  // Handle call accepted event (targeted to the agent who accepted)
  const handleCallAccepted = useCallback((callData) => {
    console.log('CallManager: *** CALL_ACCEPTED EVENT RECEIVED ***');
    console.log('CallManager: Handling call accepted event:', JSON.stringify(callData, null, 2));
    
    // Create active call object for the accepting agent
    const acceptedCall = {
      id: callData.agentCallId,
      type: 'queue',
      from: callData.from || 'Unknown',
      to: '',
      timestamp: new Date(callData.timestamp),
      state: 'ACTIVE',
      callControlId: callData.agentCallId,
      customerCallId: callData.customerCallId,
      bridgeId: callData.bridgeId, // Also store bridgeId for hangup matching
      direction: 'inbound'
    };
    
    console.log('CallManager: Created active call object:', JSON.stringify(acceptedCall, null, 2));
    
    setActiveCall(acceptedCall);
    setCallState('ACTIVE');
    setModalType('queue');
    setIsCallModalOpen(true);
    
    // Remove from incoming calls if it exists
    setIncomingCalls(prev => prev.filter(call => 
      call.callControlId !== callData.customerCallId
    ));
    
    console.log('CallManager: Active call set for accepted call, modal opened');
  }, []);
  
  // Handle transfer completed event
  const handleTransferCompleted = useCallback((transferData) => {
    console.log('CallManager: Handling transfer completed:', transferData);
    
    // If this is the new agent receiving the transfer
    if (transferData.newAgentCallId) {
      const transferredCall = {
        id: transferData.newAgentCallId,
        type: 'queue', 
        from: 'Transferred Call',
        to: '',
        timestamp: new Date(),
        state: 'ACTIVE',
        callControlId: transferData.newAgentCallId,
        customerCallId: transferData.customerCallId,
        direction: 'inbound'
      };
      
      setActiveCall(transferredCall);
      setCallState('ACTIVE');
      setModalType('queue');
      setIsCallModalOpen(true);
      
      console.log('CallManager: Active call set for transferred call');
    }
  }, []);
  
  // Removed aggressive server polling that was causing premature call cleanup during state transitions

  
  // Handle incoming queue calls
  const handleIncomingQueueCall = useCallback((callData) => {
    const callControlId = callData.payload?.call_control_id;
    
    if (!callControlId) {
      console.warn('CallManager: Received NEW_CALL without call_control_id, ignoring');
      return;
    }
    
    // Check if this call already exists to prevent duplicates
    setIncomingCalls(prev => {
      const existingCall = prev.find(call => call.callControlId === callControlId);
      if (existingCall) {
        console.log('CallManager: Call already exists, skipping duplicate:', callControlId);
        return prev;
      }
      
      const newCall = {
        id: callControlId,
        type: 'queue',
        from: callData.payload?.from || 'Unknown',
        to: callData.payload?.to || '',
        timestamp: new Date(),
        state: 'INCOMING',
        callControlId: callControlId,
        direction: 'inbound'
      };
      
      console.log('CallManager: Adding new queue call:', newCall);
      return [...prev, newCall];
    });
    
    // Queue calls should NOT auto-open modal - they stay in queue table
    // Modal only opens when agent manually accepts the call
    console.log('CallManager: Queue call processing complete, waiting for manual acceptance');
  }, []);
  
  // For inbound calls, we rely on the onNotification callback in EnhancedModalContext
  // which already receives all state changes from the Telnyx WebRTC client

  // Handle WebRTC call notifications (from existing ModalContext logic)
  const handleWebRTCCall = useCallback((call, state) => {
    // Extract call control ID from multiple possible locations
    const callControlId = call.options?.telnyxCallControlId || 
                         call.options?.callControlId || 
                         call.telnyxCallControlId ||
                         call.callControlId ||
                         call.id;
    
    console.log('CallManager: Processing WebRTC call with state:', state);
    console.log('CallManager: Call control ID found:', callControlId);
    console.log('CallManager: Call object details:', {
      id: call.id,
      direction: call.direction,
      options: call.options
    });

    const callData = {
      id: call.id || Date.now().toString(),
      type: 'webrtc',
      from: call.options?.remoteCallerNumber || call.options?.callerNumber || 'Unknown',
      to: call.options?.destinationNumber || '',
      timestamp: new Date(),
      state: state,
      callObject: call,
      direction: call.direction,
      callControlId: callControlId
    };
    
    if (state === 'RINGING') {
      setIncomingCalls(prev => [...prev, callData]);
      if (!activeCall) {
        setActiveCall(callData);
        setCallState('INCOMING');
        setModalType('webrtc');
        setIsCallModalOpen(true);
      }
    } else if (state === 'ACTIVE') {
      setActiveCall(callData);
      setCallState('ACTIVE');
      setIsCallModalOpen(true);
    } else if (state === 'HANGUP' || state === 'ENDED' || state === 'TERMINATED' || state === 'DESTROYED' || state === 'FAILED') {
      console.log('CallManager: Handling call end state:', state);
      console.log('CallManager: Call data for ending call:', callData);
      handleCallEnd(callData.id);
    } else if (state === 'DIALING') {
      console.log('CallManager: Call dialing');
      setActiveCall(callData);
      setCallState('DIALING');
      setModalType('webrtc');
      setIsCallModalOpen(true);
    }
  }, [activeCall, handleCallEnd]);
  
  // Handle call updates
  const handleCallUpdate = useCallback((callData) => {
    if (activeCall && activeCall.id === callData.id) {
      setActiveCall(prev => ({ ...prev, ...callData }));
      setCallState(callData.state || callState);
    }
  }, [activeCall, callState]);
  
  // Handle call hangup from webhook - only for specific matching calls
  const handleCallHangup = useCallback((hangupData) => {
    console.log('CallManager: *** CALL_HANGUP EVENT RECEIVED ***');
    console.log('CallManager: Hangup data:', JSON.stringify(hangupData, null, 2));
    console.log('CallManager: Current modal open:', isCallModalOpen);
    console.log('CallManager: Current active call full object:', JSON.stringify(activeCall, null, 2));
    
    const hangupCallControlId = hangupData.callControlId;
    console.log('CallManager: Hangup call control ID (string):', `"${hangupCallControlId}"`);
    
    if (activeCall) {
      console.log('CallManager: Active call agent call ID (string):', `"${activeCall.callControlId}"`);
      console.log('CallManager: Active call bridge ID (string):', `"${activeCall.bridgeId}"`);
      console.log('CallManager: Active call customer call ID (string):', `"${activeCall.customerCallId}"`);
      
      // Detailed comparison logging
      console.log('CallManager: ID Comparisons:');
      console.log('  - Agent call match:', activeCall.callControlId === hangupCallControlId, `"${activeCall.callControlId}" === "${hangupCallControlId}"`);
      console.log('  - Bridge ID match:', activeCall.bridgeId === hangupCallControlId, `"${activeCall.bridgeId}" === "${hangupCallControlId}"`);
      console.log('  - Customer ID match:', activeCall.customerCallId === hangupCallControlId, `"${activeCall.customerCallId}" === "${hangupCallControlId}"`);
    }
    
    // Check if hangup is for current active call by matching:
    // 1. Agent call ID (callControlId)
    // 2. Customer call ID (bridgeId, customerCallId) 
    // 3. Bridge ID (bridgeId)
    const isActiveCallHangup = activeCall && (
      activeCall.callControlId === hangupCallControlId || 
      activeCall.bridgeId === hangupCallControlId ||
      activeCall.customerCallId === hangupCallControlId
    );
    
    console.log('CallManager: Is active call hangup?', isActiveCallHangup);
    
    if (isActiveCallHangup) {
      console.log('CallManager: ✅ Hangup matches active call, closing modal');
      
      // Add current call to history
      setCallHistory(prev => [...prev, { ...activeCall, endTime: new Date() }]);
      
      // Reset all call state
      setActiveCall(null);
      setCallState('IDLE');
      setIsCallModalOpen(false);
      setModalType(null);
      
      console.log('CallManager: Modal closed and call state reset');
    } else if (activeCall) {
      console.log('CallManager: ❌ Hangup does not match active call, modal stays open');
    } else {
      console.log('CallManager: No active call to compare against');
    }
    
    // Always clean up matching calls from incoming calls list
    setIncomingCalls(prev => prev.filter(call => call.callControlId !== hangupCallControlId));
    
    console.log('CallManager: Call hangup processing complete');
  }, [activeCall, isCallModalOpen]);
  
  // Accept queue call
  const acceptQueueCall = useCallback(async (call) => {
    try {
      console.log('CallManager: Accepting queue call:', call);
      console.log('CallManager: Call control ID being used:', call.callControlId);
      
      // Notify server that THIS browser window is accepting the call
      if (socket) {
        console.log('*** FRONTEND: Emitting accept_call event ***');
        console.log('Socket connected:', socket.connected);
        console.log('Call control ID being sent:', call.callControlId);
        console.log('Socket ID:', socket.id);
        
        socket.emit('accept_call', {
          callControlId: call.callControlId
        });
        
        console.log('*** FRONTEND: accept_call event emitted successfully ***');
      } else {
        console.error('*** FRONTEND: No socket connection available for accept_call event ***');
      }
      
      const result = await apiService.acceptCall({
        sipUsername: sipCredentials?.login,
        callControlId: call.callControlId,
        callerId: call.from
      });
      
      if (result) {
        // Update call state
        const updatedCall = { ...call, state: 'ACCEPTED' };
        setActiveCall(updatedCall);
        setCallState('ACTIVE');
        
        // Open modal for accepted call
        setModalType('queue');
        setIsCallModalOpen(true);
        
        // Remove from incoming calls
        setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
        
        // Add to history
        setCallHistory(prev => [...prev, updatedCall]);
        
        return { success: true };
      }
    } catch (error) {
      console.error('CallManager: Error accepting call:', error);
      return { success: false, error: error.message };
    }
  }, [sipCredentials, socket]);
  
  // Answer WebRTC call
  const answerWebRTCCall = useCallback((call) => {
    try {
      if (call.callObject && call.callObject.answer) {
        console.log('CallManager: Answering WebRTC call:', call.id);
        
        call.callObject.answer();
        
        // Update call state and active call
        const updatedCall = { ...call, state: 'ACTIVE' };
        setActiveCall(updatedCall);
        setCallState('ACTIVE');
        setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
        
        console.log('CallManager: WebRTC call answered successfully');
        return { success: true };
      }
      console.error('CallManager: Cannot answer call - no call object or answer method');
      return { success: false, error: 'No call object or answer method available' };
    } catch (error) {
      console.error('CallManager: Error answering WebRTC call:', error);
      return { success: false, error: error.message };
    }
  }, []);
  
  // Decline/Reject call
  const declineCall = useCallback((call) => {
    try {
      if (call.type === 'webrtc' && call.callObject && call.callObject.hangup) {
        call.callObject.hangup();
      }
      
      // Remove from incoming calls
      setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
      
      // If this was the active call, close modal and reset
      if (activeCall && activeCall.id === call.id) {
        setActiveCall(null);
        setCallState('IDLE');
        setIsCallModalOpen(false);
        setModalType(null);
      }
      
      return { success: true };
    } catch (error) {
      console.error('CallManager: Error declining call:', error);
      return { success: false, error: error.message };
    }
  }, [activeCall]);
  
  // Handle call end
  const handleCallEnd = useCallback((callId) => {
    console.log('CallManager: Handling call end for callId:', callId);
    console.log('CallManager: Current active call:', activeCall);
    
    setIncomingCalls(prev => prev.filter(c => c.id !== callId));
    
    if (activeCall && activeCall.id === callId) {
      console.log('CallManager: Ending active call - this is a remote hangup');
      
      // Properly cleanup WebRTC call object if it exists
      if (activeCall.callObject && typeof activeCall.callObject.hangup === 'function') {
        try {
          console.log('CallManager: Calling hangup on WebRTC call object');
          activeCall.callObject.hangup();
        } catch (error) {
          console.error('CallManager: Error hanging up call object:', error);
        }
      }
      
      // Add to history
      setCallHistory(prev => [...prev, { ...activeCall, endTime: new Date() }]);
      
      // Reset active call state
      setActiveCall(null);
      setCallState('IDLE');
      setIsCallModalOpen(false);
      setModalType(null);
      
      console.log('CallManager: Remote hangup - Call cleanup completed');
      
      // Queue calls remain in the incoming calls list for manual acceptance
      // No auto-opening of next calls
    } else {
      console.log('CallManager: Call end event for non-active call or call not found');
    }
  }, [activeCall]);

  // Hang up active call
  const hangUpCall = useCallback(async (call = activeCall) => {
    console.log('CallManager: hangUpCall called for call:', call?.id);
    try {
      if (call) {
        // For WebRTC calls, call hangup on the call object first
        if (call.type === 'webrtc' && call.callObject && typeof call.callObject.hangup === 'function') {
          console.log('CallManager: Calling hangup on WebRTC call object');
          call.callObject.hangup();
        }
        
        // For queue calls (Telnyx calls), make API call to hang up via server
        if (call.type === 'queue' && call.callControlId) {
          console.log('CallManager: Hanging up queue call via API, callControlId:', call.callControlId);
          try {
            const result = await apiService.hangUpCall(call.callControlId);
            console.log('CallManager: Hangup API result:', result);
          } catch (apiError) {
            console.error('CallManager: Error calling hangup API:', apiError);
            // Continue with UI cleanup even if API call fails
          }
        }
        
        // Always call handleCallEnd to clean up UI state
        console.log('CallManager: Calling handleCallEnd');
        handleCallEnd(call.id);
      } else {
        console.log('CallManager: No call to hang up');
      }
      
      return { success: true };
    } catch (error) {
      console.error('CallManager: Error hanging up call:', error);
      // Even if there's an error, try to clean up the UI
      if (call) {
        handleCallEnd(call.id);
      }
      return { success: false, error: error.message };
    }
  }, [activeCall, handleCallEnd]);
  
  // Make outbound call
  const makeOutboundCall = useCallback((destinationNumber, callerNumber) => {
    const callData = {
      id: Date.now().toString(),
      type: 'outbound',
      from: callerNumber,
      to: destinationNumber,
      timestamp: new Date(),
      state: 'DIALING',
      direction: 'outbound'
    };
    
    setActiveCall(callData);
    setCallState('DIALING');
    setModalType('outbound');
    setIsCallModalOpen(true);
    
    return callData;
  }, []);
  
  // Close modal manually
  const closeModal = useCallback(() => {
    setIsCallModalOpen(false);
    setModalType(null);
  }, []);
  
  // Open modal manually
  const openModal = useCallback((type = 'queue') => {
    setModalType(type);
    setIsCallModalOpen(true);
  }, []);
  
  const contextValue = {
    // State
    activeCall,
    incomingCalls,
    callHistory,
    callState,
    isCallModalOpen,
    modalType,
    
    // Actions
    acceptQueueCall,
    answerWebRTCCall,
    declineCall,
    hangUpCall,
    makeOutboundCall,
    handleWebRTCCall,
    closeModal,
    openModal,
    
    // Utilities
    socket
  };
  
  return (
    <CallManagerContext.Provider value={contextValue}>
      {children}
    </CallManagerContext.Provider>
  );
};