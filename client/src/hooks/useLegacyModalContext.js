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
    
    // Hold functionality using WebRTC call.hold()
    handleHold: () => {
      if (callActions.activeCall && callActions.activeCall.type === 'webrtc' && callActions.activeCall.callObject) {
        try {
          console.log('Putting WebRTC call on hold');
          callActions.activeCall.callObject.hold();
        } catch (error) {
          console.error('Error putting call on hold:', error);
        }
      } else {
        console.warn('Hold not available - no active WebRTC call');
      }
    },
    handleUnhold: () => {
      if (callActions.activeCall && callActions.activeCall.type === 'webrtc' && callActions.activeCall.callObject) {
        try {
          console.log('Taking WebRTC call off hold');
          callActions.activeCall.callObject.unhold();
        } catch (error) {
          console.error('Error taking call off hold:', error);
        }
      } else {
        console.warn('Unhold not available - no active WebRTC call');
      }
    },
    onHold: callActions.callState === 'HOLDING',
    
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