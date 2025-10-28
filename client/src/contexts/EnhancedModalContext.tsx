'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { TelnyxRTCContext, useNotification, useCallbacks, Audio } from '@telnyx/react-client';
import {
  setCall as storeSetCall,
  setStatus as storeSetStatus,
  setFromNumber as storeSetFromNumber,
  setToNumber as storeSetToNumber,
  setMuted as storeSetMuted,
  setHeld as storeSetHeld,
  clear as storeClear,
} from '@/lib/call-store';
import { useCallManager } from './CallManagerContext';
import { SIPCredentialsContext } from './SIPCredentialsContext';

interface EnhancedModalContextType {
  handleCall: (callerNumber: string, destinationNumber: string) => any | null;
  handleBackspace: () => void;
  handleDialClick: (digit: string) => void;
  dialNumber: string;
  clientStatus: string;
  setDialNumber: (number: string) => void;
  audioDevices: any[];
}

export const EnhancedModalContext = createContext<EnhancedModalContextType | undefined>(undefined);

export const useEnhancedModal = () => {
  const context = useContext(EnhancedModalContext);
  if (!context) {
    throw new Error('useEnhancedModal must be used within EnhancedModalProvider');
  }
  return context;
};

export const EnhancedModalProvider = ({ children }: { children: ReactNode }) => {
  const client = useContext(TelnyxRTCContext);
  const notification = useNotification();
  const activeCall = notification && notification.call;
  const callManager = useCallManager();
  const sipCredentials = useContext(SIPCredentialsContext);

  const [clientStatus, setClientStatus] = useState('NOT READY');
  const [dialNumber, setDialNumber] = useState('');
  const [audioDevices, setAudioDevices] = useState<any[]>([]);

  // Get audio devices when client is ready (don't call connect, already done in Dashboard)
  useEffect(() => {
    if (client) {
      const getDevices = async () => {
        try {
          let result = await client.getAudioInDevices();
          setAudioDevices(result);
          console.log('EnhancedModal: Audio devices found:', result);
        } catch (error) {
          console.error('EnhancedModal: Error getting audio devices:', error);
        }
      };
      getDevices();
    }
  }, [client]);

  const handleDialClick = (digit: string) => {
    setDialNumber((prevNumber) => {
      const newNumber = prevNumber + digit;
      storeSetToNumber(newNumber);
      return newNumber;
    });
  };

  const handleBackspace = () => {
    setDialNumber((prevDialNumber) => {
      const newNumber = prevDialNumber.slice(0, -1);
      storeSetToNumber(newNumber);
      return newNumber;
    });
  };

  function wireCall(call: any, direction: 'inbound' | 'outbound') {
    console.log(`Wiring ${direction} call events`);

    // Wire up call events to update call-store AND notify CallManager
    call.on?.('ringing', () => {
      console.log('Call ringing');
      storeSetStatus('ringing');
      // Notify CallManager for auto-answer logic
      if (callManager?.handleWebRTCCall) {
        callManager.handleWebRTCCall(call, 'RINGING');
      }
    });

    call.on?.('active', () => {
      console.log('Call active/connected');
      storeSetStatus('connected');
      if (callManager?.handleWebRTCCall) {
        callManager.handleWebRTCCall(call, 'ACTIVE');
      }
    });

    call.on?.('hangup', () => {
      console.log('EnhancedModal: Call hangup detected - clearing call state');
      storeClear();
      if (callManager?.handleWebRTCCall) {
        callManager.handleWebRTCCall(call, 'HANGUP');
      }
    });

    call.on?.('destroy', () => {
      console.log('Call destroy detected');
      storeClear();
      if (callManager?.handleWebRTCCall) {
        callManager.handleWebRTCCall(call, 'DESTROY');
      }
    });

    call.on?.('ended', () => {
      console.log('Call ended detected');
      storeClear();
      if (callManager?.handleWebRTCCall) {
        callManager.handleWebRTCCall(call, 'ENDED');
      }
    });

    call.on?.('failed', () => {
      console.log('Call failed detected');
      storeClear();
      if (callManager?.handleWebRTCCall) {
        callManager.handleWebRTCCall(call, 'FAILED');
      }
    });

    call.on?.('terminated', () => {
      console.log('Call terminated detected');
      storeClear();
      if (callManager?.handleWebRTCCall) {
        callManager.handleWebRTCCall(call, 'TERMINATED');
      }
    });

    call.on?.('stateChanged', (newState: string) => {
      console.log('Call state changed to:', newState);
      const state = newState.toLowerCase();
      if (state === 'ended' || state === 'hangup' || state === 'terminated') {
        storeClear();
      } else if (state === 'held') {
        storeSetHeld(true);
      } else if (state === 'active' || state === 'connected') {
        storeSetStatus('connected');
        storeSetHeld(false);
      }
      // Notify CallManager
      if (callManager?.handleWebRTCCall) {
        callManager.handleWebRTCCall(call, newState.toUpperCase());
      }
    });
  }

  const handleCall = async (callerNumber: string, destinationNumber: string) => {
    try {
      console.log('=== INITIATING BACKEND OUTBOUND CALL ===');
      console.log(`From: ${callerNumber}, To: ${destinationNumber}`);

      // Get SIP credentials from context
      if (!sipCredentials || !sipCredentials.login) {
        console.error('No SIP credentials found in context');
        storeSetStatus('idle');
        return null;
      }

      const sipUsername = sipCredentials.login;

      console.log(`Using SIP username: ${sipUsername}`);

      // Update UI state
      storeSetFromNumber(callerNumber);
      storeSetToNumber(destinationNumber);
      storeSetStatus('dialing');

      // Call backend to place the call
      const apiHost = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
      const apiPort = process.env.NEXT_PUBLIC_API_PORT || '3000';
      const protocol = apiHost.startsWith('http') ? '' : 'http://';
      const apiUrl = `${protocol}${apiHost}:${apiPort}/api/voice/place-outbound-call`;

      const response = await fetch(
        apiUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            from: callerNumber || undefined,
            to: destinationNumber,
            sipUsername: sipUsername
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Backend call failed:', errorData);
        storeSetStatus('idle');
        return null;
      }

      const result = await response.json();
      console.log('✅ Backend call initiated:', result);

      // The call will be handled via WebRTC inbound when the agent leg rings
      // We don't need to return a call object here since the backend manages the call

      return { success: true, sessionId: result.sessionId };
    } catch (error) {
      console.error('❌ Error initiating backend call:', error);
      storeSetStatus('idle');
      return null;
    }
  };

  // WebRTC callbacks
  useCallbacks({
    onReady: () => {
      setClientStatus('READY');
      console.log('✅ WebRTC client READY - Agent can now receive calls');
      console.log('✅ Agent is now logged in and connected');
    },
    onError: (error: any) => {
      console.log('WebRTC client registration error:', error);
      setTimeout(() => {
        if (client && client.connected) {
          setClientStatus('READY');
          console.log('WebRTC client recovered from error');
        } else {
          setClientStatus('ERROR');
        }
      }, 2000);
    },
    onSocketError: (error: any) => {
      console.log('WebRTC client socket error:', error);
      setTimeout(() => {
        if (client && client.connected) {
          setClientStatus('READY');
          console.log('WebRTC client recovered from socket error');
        } else {
          setClientStatus('ERROR');
        }
      }, 3000);
    },
    onSocketClose: () => {
      console.log('WebRTC client disconnected - attempting reconnection');
      setClientStatus('RECONNECTING');
      if (client) {
        setTimeout(() => {
          try {
            client.connect();
            console.log('Attempting to reconnect WebRTC client');
          } catch (error) {
            console.error('Failed to reconnect:', error);
            setClientStatus('ERROR');
          }
        }, 1000);
      }
    },
    onNotification: (message: any) => {
      console.log('WebRTC notification:', message.type);

      if (message.type === 'callUpdate') {
        const call = message.call;
        const callState = call.state.toUpperCase();
        console.log('Call state:', callState, 'Direction:', call.direction);

        // Handle incoming calls - including queue acceptance calls with undefined direction
        if (callState === 'RINGING' && (call.direction === 'inbound' || call.direction === undefined)) {
          console.log('Incoming call detected (direction:', call.direction, ')');

          // Extract from number from call options
          const fromNumber = call.options?.remoteCallerNumber || call.options?.from || 'Unknown';

          // Update call-store
          storeSetFromNumber(fromNumber);
          storeSetCall(call, 'inbound');
          storeSetStatus('ringing');

          // Wire up events for incoming call
          wireCall(call, 'inbound');

          // Auto-answer queue acceptance calls (direction === undefined)
          if (call.direction === undefined) {
            console.log('🎯 Queue acceptance call detected - auto-answering...');
            try {
              call.answer();
              console.log('✅ Auto-answered queue acceptance call');
              storeSetStatus('connected');
            } catch (error) {
              console.error('❌ Failed to auto-answer call:', error);
            }
          }

          // Notify CallManager
          if (callManager?.handleWebRTCCall) {
            console.log('EnhancedModal: Notifying CallManager of incoming WebRTC call');
            callManager.handleWebRTCCall(call, 'RINGING');
          }
        }
      }
    },
  });

  return (
    <EnhancedModalContext.Provider
      value={{
        handleCall,
        handleBackspace,
        handleDialClick,
        dialNumber,
        clientStatus,
        setDialNumber,
        audioDevices,
      }}
    >
      {activeCall && activeCall.remoteStream && <Audio stream={activeCall.remoteStream} />}
      {children}
    </EnhancedModalContext.Provider>
  );
};
