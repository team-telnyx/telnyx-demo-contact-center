import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  IconButton,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Phone as PhoneIcon,
  PhoneCallback as PhoneCallbackIcon,
  Minimize as MinimizeIcon,
  Close as CloseIcon,
  AccessTime as TimeIcon,
  CalendarToday as CalendarIcon,
  Tag as TagIcon,
  CallReceived as IncomingIcon,
  CallMade as OutgoingIcon
} from '@mui/icons-material';
import Draggable from 'react-draggable';
import { useCallManager } from '../contexts/CallManagerContext';

const UniversalCallModal = () => {
  const callManager = useCallManager();

  // Destructure with fallbacks for safety
  const {
    activeCall = null,
    incomingCalls = [],
    callState = 'IDLE',
    isCallModalOpen = false,
    acceptQueueCall = () => Promise.resolve({ success: false }),
    answerWebRTCCall = () => ({ success: false }),
    declineCall = () => ({ success: false }),
    hangUpCall = () => ({ success: false }),
    closeModal = () => {}
  } = callManager || {};

  // Debug logging for all state changes
  console.log('🎭 UniversalCallModal: RENDER STATE:', {
    activeCall: activeCall?.id,
    callState,
    isCallModalOpen,
    hasCallObject: !!activeCall?.callObject,
    callObjectActive: activeCall?.callObject?.active,
    callObjectState: activeCall?.callObject?.state
  });

  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  // Monitor for call end events and auto-close modal - but only after a delay to prevent race conditions
  useEffect(() => {
    console.log('💫 UniversalCallModal: useEffect triggered - activeCall:', activeCall?.id, 'callState:', callState, 'isCallModalOpen:', isCallModalOpen);

    if (!activeCall && callState === 'IDLE' && isCallModalOpen) {
      console.log('💫 UniversalCallModal: Setting timeout to close modal in 500ms (reduced delay)');
      // Reduced delay for faster modal close on remote hangup
      const timeoutId = setTimeout(() => {
        console.log('💫 UniversalCallModal: ✅ Timeout fired - No active call after delay, closing modal');
        closeModal();
        setIsMinimized(false); // Reset minimized state
      }, 500);

      return () => {
        console.log('💫 UniversalCallModal: Cleanup - clearing timeout');
        clearTimeout(timeoutId);
      };
    } else {
      console.log('💫 UniversalCallModal: Not closing modal - activeCall exists or callState not IDLE or modal not open');
    }
  }, [activeCall, callState, isCallModalOpen, closeModal]);

  // Additional effect to force close modal when call becomes inactive
  useEffect(() => {
    if (activeCall && activeCall.callObject) {
      // Check if WebRTC call object indicates call is no longer active
      if (!activeCall.callObject.active ||
          activeCall.callObject.state === 'ended' ||
          activeCall.callObject.state === 'hangup' ||
          activeCall.callObject.state === 'terminated') {
        console.log('💫 UniversalCallModal: WebRTC call object indicates call ended, forcing close');
        closeModal();
        setIsMinimized(false);
      }
    }
  }, [activeCall, closeModal]);

  // Emergency force close mechanism
  const forceCloseModal = () => {
    console.log('🚨 UniversalCallModal: EMERGENCY FORCE CLOSE TRIGGERED');
    closeModal();
    setIsMinimized(false);
  };

  // Periodic check to ensure modal closes on remote hangup (fallback mechanism)
  useEffect(() => {
    if (activeCall && isCallModalOpen) {
      const checkInterval = setInterval(() => {
        // Check both WebRTC leg and queue call status
        const webRTCActive = activeCall.callObject ? activeCall.callObject.active : true;
        const webRTCState = activeCall.callObject ? activeCall.callObject.state : 'unknown';

        console.log('🕐 UniversalCallModal: Periodic check - type:', activeCall.type, 'WebRTC active:', webRTCActive, 'WebRTC state:', webRTCState, 'callState:', callState);

        // For bridged calls (queue + webrtc), if either leg ends, close modal
        const webRTCEnded = activeCall.callObject && (
          !activeCall.callObject.active ||
          activeCall.callObject.state === 'ended' ||
          activeCall.callObject.state === 'hangup' ||
          activeCall.callObject.state === 'terminated' ||
          activeCall.callObject.state === 'destroyed'
        );

        const queueCallEnded = callState === 'IDLE' || !activeCall;

        if (webRTCEnded || queueCallEnded) {
          console.log('🕐 UniversalCallModal: ⚡ PERIODIC CHECK DETECTED CALL END');
          console.log('🕐   - WebRTC ended:', webRTCEnded);
          console.log('🕐   - Queue ended:', queueCallEnded);
          forceCloseModal();
          clearInterval(checkInterval);
        }
      }, 500); // Check every 500ms for faster response

      // Cleanup interval after 5 minutes
      const cleanup = setTimeout(() => {
        clearInterval(checkInterval);
      }, 300000);

      return () => {
        clearInterval(checkInterval);
        clearTimeout(cleanup);
      };
    }
  }, [activeCall, isCallModalOpen, callState, closeModal]);

  // Removed aggressive server polling that was causing modal to close prematurely on call answer

  // Remove the polling mechanism - WebRTC hangup detection is now handled by event listeners in CallManagerContext

  // Call duration timer
  useEffect(() => {
    let interval;
    if (callState === 'ACTIVE' && activeCall) {
      interval = setInterval(() => {
        try {
          const start = new Date(activeCall.timestamp);
          const now = new Date();
          const duration = Math.floor((now - start) / 1000);
          setCallDuration(duration);
        } catch (error) {
          console.error('UniversalCallModal: Error calculating call duration:', error);
          clearInterval(interval);
        }
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState, activeCall]);

  // Format duration as MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle answer button click
  const handleAnswer = async () => {
    if (!activeCall) return;

    try {
      let result;
      if (activeCall.type === 'queue') {
        result = await acceptQueueCall(activeCall);
      } else if (activeCall.type === 'webrtc') {
        result = answerWebRTCCall(activeCall);
      }

      if (!result?.success) {
        console.error('Failed to answer call:', result?.error);
        // Could show error toast here
      }
    } catch (error) {
      console.error('Error answering call:', error);
    }
  };

  // Handle decline button click
  const handleDecline = () => {
    try {
      if (activeCall) {
        declineCall(activeCall);
      }
    } catch (error) {
      console.error('UniversalCallModal: Error declining call:', error);
    }
  };

  // Handle hang up button click  
  const handleHangUp = () => {
    try {
      console.log('UniversalCallModal: handleHangUp clicked');
      console.log('UniversalCallModal: activeCall:', activeCall);
      if (activeCall) {
        console.log('UniversalCallModal: Calling hangUpCall');
        const result = hangUpCall(activeCall);
        console.log('UniversalCallModal: hangUpCall result:', result);
      } else {
        console.log('UniversalCallModal: No active call to hang up');
      }
    } catch (error) {
      console.error('UniversalCallModal: Error hanging up call:', error);
    }
  };

  // Get call type display text
  const getCallTypeText = (call) => {
    if (!call) return '';
    
    switch (call.type) {
      case 'queue':
        return 'Queue Call';
      case 'webrtc':
        return call.direction === 'inbound' ? 'Incoming Call' : 'Outgoing Call';
      case 'outbound':
        return 'Outbound Call';
      default:
        return 'Call';
    }
  };

  // Get call state text and color for Material-UI
  const getCallStateInfo = (state) => {
    switch (state) {
      case 'INCOMING':
        return { text: 'Incoming...', color: 'info', icon: IncomingIcon };
      case 'ACTIVE':
        return { text: 'Connected', color: 'success', icon: PhoneIcon };
      case 'DIALING':
        return { text: 'Calling...', color: 'warning', icon: OutgoingIcon };
      case 'HOLDING':
        return { text: 'On Hold', color: 'secondary', icon: PhoneIcon };
      default:
        return { text: 'Unknown', color: 'default', icon: PhoneIcon };
    }
  };

  // Render incoming calls queue - DISABLED until connected to live queue API
  const renderIncomingCallsQueue = () => {
    // Disabled waiting calls display - showing stale data
    // TODO: Connect to live queue API from PhonePage or remove entirely
    return null;
  };

  // Render minimized view
  const renderMinimizedView = () => {
    const stateInfo = getCallStateInfo(callState);
    const StateIcon = stateInfo.icon;
    
    return (
      <Paper 
        elevation={8}
        onClick={(e) => {
          e.stopPropagation();
          setIsMinimized(false);
        }}
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          color: 'white',
          p: 1.5,
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          minWidth: '200px',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
          }
        }}
      >
        <StateIcon sx={{ color: `${stateInfo.color}.main`, mr: 1 }} />
        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
          {activeCall?.from || 'Unknown'} • {callState === 'ACTIVE' ? formatDuration(callDuration) : stateInfo.text}
        </Typography>
      </Paper>
    );
  };

  // Render full modal view
  const renderFullView = () => {
    if (!activeCall) {
      console.warn('UniversalCallModal: No active call for full view');
      return null;
    }

    const stateInfo = getCallStateInfo(callState);
    const StateIcon = stateInfo.icon;

    return (
      <Card elevation={8} sx={{ minWidth: '320px', maxWidth: '400px', bgcolor: 'rgba(0, 0, 0, 0.85)' }}>
        {/* Header */}
        <Box 
          className="draggableHeader"
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'move',
            p: 2,
            bgcolor: 'primary.main',
            color: 'primary.contrastText'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StateIcon color={stateInfo.color} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {getCallTypeText(activeCall)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton 
              size="small"
              sx={{ color: 'inherit' }}
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
            >
              <MinimizeIcon />
            </IconButton>
            <IconButton 
              size="small"
              sx={{ color: 'inherit' }}
              onClick={(e) => {
                e.stopPropagation();
                closeModal();
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <CardContent sx={{ color: 'white' }}>
          {/* Call Info */}
          <Typography variant="h6" gutterBottom>
            {activeCall.direction === 'outbound' 
              ? `Calling: ${activeCall.to}` 
              : `From: ${activeCall.from || 'Unknown'}`
            }
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            {callState === 'ACTIVE' && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TimeIcon sx={{ mr: 1, fontSize: '1rem' }} />
                <Typography variant="body2">
                  Duration: {formatDuration(callDuration)}
                </Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <CalendarIcon sx={{ mr: 1, fontSize: '1rem' }} />
              <Typography variant="body2">
                {new Date(activeCall.timestamp).toLocaleString()}
              </Typography>
            </Box>
            {activeCall.callControlId && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TagIcon sx={{ mr: 1, fontSize: '1rem' }} />
                <Typography variant="body2">
                  ID: {activeCall.callControlId.slice(-8)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Call state indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Chip 
              icon={<StateIcon />}
              label={stateInfo.text}
              color={stateInfo.color}
              variant="outlined"
              size="small"
            />
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {callState === 'INCOMING' && (
              <>
                <Button 
                  variant="contained"
                  color="success"
                  fullWidth
                  startIcon={<PhoneIcon />}
                  onClick={handleAnswer}
                  disabled={callState === 'CONNECTING'}
                >
                  Answer
                </Button>
                <Button 
                  variant="contained"
                  color="error"
                  fullWidth
                  startIcon={<PhoneCallbackIcon />}
                  onClick={handleDecline}
                >
                  Decline
                </Button>
              </>
            )}
            
            {(callState === 'ACTIVE' || callState === 'DIALING') && (
              <>
                <Button 
                  variant="contained"
                  color="error"
                  fullWidth
                  startIcon={<PhoneCallbackIcon />}
                  onClick={handleHangUp}
                >
                  End Call
                </Button>
                <Button 
                  variant="outlined"
                  size="small"
                  onClick={closeModal}
                  sx={{ color: 'white', borderColor: 'white' }}
                >
                  Close
                </Button>
              </>
            )}

            {/* Emergency Force Close Button */}
            <Button
              variant="contained"
              color="warning"
              size="small"
              onClick={forceCloseModal}
              sx={{ mt: 1 }}
            >
              🚨 FORCE CLOSE (DEBUG)
            </Button>
          </Box>

          {/* Additional call controls for active calls */}
          {callState === 'ACTIVE' && (
            <>
              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.2)' }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" size="small" sx={{ color: 'white', borderColor: 'white', flex: 1 }}>
                  Mute
                </Button>
                <Button variant="outlined" size="small" sx={{ color: 'white', borderColor: 'white', flex: 1 }}>
                  Hold
                </Button>
                <Button variant="outlined" size="small" sx={{ color: 'white', borderColor: 'white', flex: 1 }}>
                  Transfer
                </Button>
              </Box>
            </>
          )}

          {/* Waiting calls */}
          {renderIncomingCallsQueue()}
        </CardContent>
      </Card>
    );
  };

  // Don't render if modal is closed and there is no active call
  // Note: We intentionally ignore incomingCalls here to prevent the modal container
  // from lingering due to queued items; queue list UI is disabled in this modal.
  if (!isCallModalOpen && !activeCall) {
    console.log('💫 UniversalCallModal: Not rendering - modal closed and no calls');
    return null;
  }

  console.log('💫 UniversalCallModal: Rendering modal - activeCall:', activeCall?.id, 'isCallModalOpen:', isCallModalOpen);

  // Ensure we have a valid portal target
  const portalTarget = document.getElementById('modal-root') || document.body;
  
  const modalContent = (
    <Box
      sx={{
        position: 'fixed',
        top: '70px',
        right: '20px',
        zIndex: 99999,
        pointerEvents: 'auto'
      }}
    >
      <Draggable handle=".draggableHeader" disabled={isMinimized}>
        <Box
          sx={{
            pointerEvents: 'auto',
            position: 'relative',
            zIndex: 1
          }}
        >
          {isMinimized ? renderMinimizedView() : renderFullView()}
        </Box>
      </Draggable>
    </Box>
  );

  try {
    return ReactDOM.createPortal(modalContent, portalTarget);
  } catch (error) {
    console.error('UniversalCallModal: Portal creation failed:', error);
    return null;
  }
};

export default UniversalCallModal;
