import { useCallActions } from './useCallActions';

/**
 * Legacy compatibility hook that provides the old ModalContext interface
 * This helps migrate existing components gradually to the new system
 */
export const useLegacyModalContext = () => {
  const callActions = useCallActions();
  
  return {
    // Map new system to old interface
    clientStatus: callActions.clientStatus,
    callState: callActions.callState,
    dialNumber: callActions.dialNumber,
    callerInfo: callActions.activeCall ? {
      name: callActions.activeCall.from,
      number: callActions.activeCall.from
    } : {},
    handleDialClick: callActions.handleDialClick,
    handleCall: callActions.makeCall,
    handleHangUp: callActions.hangUpCall,
    handleBackspace: callActions.handleBackspace,
    activeCall: callActions.activeCall,
    callControlId: callActions.activeCall?.callControlId,
    
    // Legacy methods that might not be fully implemented
    handleHold: () => console.warn('Hold not implemented in new system'),
    handleUnhold: () => console.warn('Unhold not implemented in new system'),
    onHold: false,
    
    // Additional properties that were in old context
    isModalOpen: callActions.isCallModalOpen,
    toggleModal: callActions.closeModal,
    handleAnswer: () => {
      if (callActions.activeCall?.type === 'queue') {
        return callActions.acceptQueueCall(callActions.activeCall);
      } else if (callActions.activeCall?.type === 'webrtc') {
        return callActions.answerWebRTCCall(callActions.activeCall);
      }
    },
    handleDecline: () => {
      if (callActions.activeCall) {
        return callActions.declineCall(callActions.activeCall);
      }
    },
    callDirection: callActions.activeCall?.direction,
    audioDevices: callActions.audioDevices
  };
};