import { useContext } from 'react';
import { useCallManager } from '../contexts/CallManagerContext';
import { EnhancedModalContext } from '../components/EnhancedModalContext';

/**
 * Custom hook that provides call actions for components
 * Combines CallManager and Enhanced Modal functionality
 */
export const useCallActions = () => {
  const callManager = useCallManager();
  const modalContext = useContext(EnhancedModalContext);
  
  return {
    // Call Manager actions (queue calls, call state management)
    ...callManager,
    
    // Enhanced Modal actions (WebRTC calls, dialing) - with safe fallbacks
    makeCall: modalContext?.handleCall || (() => console.warn('makeCall not available')),
    setDialNumber: modalContext?.setDialNumber || (() => {}),
    dialNumber: modalContext?.dialNumber || '',
    clientStatus: modalContext?.clientStatus || 'NOT READY',
    audioDevices: modalContext?.audioDevices || [],
    handleDialClick: modalContext?.handleDialClick || (() => {}),
    handleBackspace: modalContext?.handleBackspace || (() => {}),
    
    // Convenience methods
    isCallActive: () => callManager.callState === 'ACTIVE',
    hasIncomingCalls: () => callManager.incomingCalls.length > 0,
    getCallCount: () => callManager.incomingCalls.length + (callManager.activeCall ? 1 : 0),
    
    // Call routing helpers
    canReceiveCalls: () => modalContext?.clientStatus === 'READY',
    getCurrentCallInfo: () => {
      if (callManager.activeCall) {
        return {
          id: callManager.activeCall.id,
          from: callManager.activeCall.from,
          to: callManager.activeCall.to,
          duration: callManager.activeCall.duration,
          state: callManager.callState,
          type: callManager.activeCall.type
        };
      }
      return null;
    }
  };
};