import React, { createContext, useState, useContext, useEffect } from 'react';
import { TelnyxRTCContext, useNotification, useCallbacks, Audio } from '@telnyx/react-client';
import { useCallManager } from '../contexts/CallManagerContext';

export const EnhancedModalContext = createContext();

export const EnhancedModalProvider = ({ children }) => {
  const client = useContext(TelnyxRTCContext);
  const notification = useNotification();
  const activeCall = notification && notification.call;
  const { handleWebRTCCall } = useCallManager();
  
  const [clientStatus, setClientStatus] = useState("NOT READY");
  const [dialNumber, setDialNumber] = useState('');
  const [audioDevices, setAudioDevices] = useState([]);

  useEffect(() => {
    if (client) {
      client.connect();
      const getDevices = async () => {
        try {
          let result = await client.getAudioInDevices();
          setAudioDevices(result);
          console.log("Audio devices found:", result);
        } catch (error) {
          console.error("Error getting audio devices:", error);
        }
      };
      getDevices();
    }
  }, [client]);

  const handleDialClick = (digit) => {
    setDialNumber((prevNumber) => prevNumber + digit);
  };

  const handleCall = (callerNumber, destinationNumber) => {
    try {
      if (!client) {
        console.error('TelnyxRTCContext client not available');
        return null;
      }

      const custom = [{ name: "X-INVITE-Call", value: "9999999" }];
      const webhookUrl = `http://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/voice/webhook`;
      
      const newCall = client.newCall({ 
        callerNumber: callerNumber, 
        destinationNumber: destinationNumber, 
        customHeaders: custom, 
        clientState: "VGVzdA==",
        webhookUrl: webhookUrl
      });
      
      // Add direct event listeners to the call object
      if (newCall) {
        console.log('Adding event listeners to WebRTC call object');
        
        // Listen for hangup/ended events directly on the call object
        newCall.on('destroy', () => {
          console.log('WebRTC Call destroy event fired - remote hangup detected');
          if (handleWebRTCCall) {
            handleWebRTCCall(newCall, 'HANGUP');
          }
        });
        
        newCall.on('hangup', () => {
          console.log('WebRTC Call hangup event fired - remote hangup detected');
          if (handleWebRTCCall) {
            handleWebRTCCall(newCall, 'HANGUP');
          }
        });
        
        newCall.on('ended', () => {
          console.log('WebRTC Call ended event fired - remote hangup detected');
          if (handleWebRTCCall) {
            handleWebRTCCall(newCall, 'ENDED');
          }
        });

        // Additional event listeners for comprehensive hangup detection
        newCall.on('failed', () => {
          console.log('WebRTC Call failed event fired');
          if (handleWebRTCCall) {
            handleWebRTCCall(newCall, 'FAILED');
          }
        });

        newCall.on('terminated', () => {
          console.log('WebRTC Call terminated event fired');
          if (handleWebRTCCall) {
            handleWebRTCCall(newCall, 'TERMINATED');
          }
        });

        // Listen for state changes on the call object
        newCall.on('stateChanged', (newState) => {
          console.log('WebRTC Call state changed to:', newState);
          if (newState === 'ended' || newState === 'hangup' || newState === 'terminated') {
            if (handleWebRTCCall) {
              handleWebRTCCall(newCall, newState.toUpperCase());
            }
          }
        });
        
        // Log all available events for debugging
        console.log('Call object methods/properties:', Object.getOwnPropertyNames(newCall));
        
        // Enhanced periodic checking for call state and remote hangup detection
        const stateCheckInterval = setInterval(() => {
          console.log('Call state check:', newCall.state, 'Active:', newCall.active);
          
          // Check for ended states - including more comprehensive state checking
          if (newCall.state === 'ended' || 
              newCall.state === 'hangup' || 
              newCall.state === 'terminated' ||
              newCall.state === 'destroyed' ||
              !newCall.active) {
            console.log('Call ended - notifying CallManager', 'State:', newCall.state, 'Active:', newCall.active);
            clearInterval(stateCheckInterval);
            if (handleWebRTCCall) {
              handleWebRTCCall(newCall, 'HANGUP');
            }
          }
        }, 1000); // Check every 1 second for faster detection
        
        // Clear interval after 5 minutes to prevent memory leaks
        setTimeout(() => {
          clearInterval(stateCheckInterval);
        }, 300000);
      }
      
      // Let CallManager handle the outbound call
      if (handleWebRTCCall) {
        handleWebRTCCall(newCall, 'DIALING');
      }
      
      return newCall;
    } catch (error) {
      console.error('Error initiating call:', error);
      return null;
    }
  };

  const handleBackspace = () => {
    setDialNumber((prevDialNumber) => prevDialNumber.slice(0, -1));
  };

  // WebRTC callbacks that integrate with CallManager
  useCallbacks({
    onReady: () => {
      setClientStatus("READY");
      console.log("WebRTC client ready");
    },
    onError: (error) => {
      console.log("WebRTC client registration error:", error);
      // Don't immediately set to ERROR - try to recover
      setTimeout(() => {
        if (client && client.connected) {
          setClientStatus("READY");
          console.log("WebRTC client recovered from error");
        } else {
          setClientStatus("ERROR");
        }
      }, 2000);
    },
    onSocketError: (error) => {
      console.log("WebRTC client socket error:", error);
      // Don't immediately set to ERROR - socket might recover
      setTimeout(() => {
        if (client && client.connected) {
          setClientStatus("READY");
          console.log("WebRTC client recovered from socket error");
        } else {
          setClientStatus("ERROR");
        }
      }, 3000);
    },
    onSocketClose: () => {
      console.log("WebRTC client disconnected - attempting reconnection");
      setClientStatus("RECONNECTING");
      // Try to reconnect
      if (client) {
        setTimeout(() => {
          try {
            client.connect();
            console.log("Attempting to reconnect WebRTC client");
          } catch (error) {
            console.error("Failed to reconnect:", error);
            setClientStatus("ERROR");
          }
        }, 1000);
      }
    },
    onNotification: (message) => {
      console.log('Enhanced Modal - Notification message type:', message.type);
      console.log('Enhanced Modal - Full message:', message);
      
      if (message.type === "callUpdate") {
        const call = message.call;
        console.log('Enhanced Modal - Call state:', call.state.toUpperCase());
        console.log('Enhanced Modal - Call object:', call);
        console.log('Enhanced Modal - Call options:', call.options);
        
        // Check for hangup/ended states specifically - enhanced detection
        if (call.state.toUpperCase() === 'ENDED' || 
            call.state.toUpperCase() === 'HANGUP' || 
            call.state.toUpperCase() === 'TERMINATED' ||
            call.state.toUpperCase() === 'DESTROYED' ||
            call.state.toUpperCase() === 'FAILED' ||
            !call.active) {
          console.log('Enhanced Modal - Detected call end state:', call.state, 'Active:', call.active);
        }
        
        // Route all WebRTC call notifications through CallManager
        if (handleWebRTCCall) {
          handleWebRTCCall(call, call.state.toUpperCase());
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
      {/* Render audio stream for active WebRTC calls */}
      {activeCall && activeCall.remoteStream && (
        <Audio stream={activeCall.remoteStream} />
      )}
      {children}
    </EnhancedModalContext.Provider>
  );
};