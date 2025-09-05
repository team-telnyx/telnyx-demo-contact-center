import React, { useContext } from 'react';
import { Grid, Box, Typography } from '@mui/material';
import { useAuth } from '../AuthContext';
import { SIPCredentialsContext } from '../SIPCredentialsContext';
import { ModalContext } from '../ModalContext';
import { useUnreadCount } from '../UnreadCount';

// Import new modular components
import CallControls from './CallControls';
import QueueTable from './QueueTable';
import AgentDashboard from './AgentDashboard';
import TransferControls from './TransferControls';

// Import custom hooks
import { useCallQueue } from '../../hooks/useCallQueue';
import { useAgentNumbers } from '../../hooks/useAgentNumbers';
import { useOutboundCalls } from '../../hooks/useOutboundCalls';

// Import API service
import apiService from '../../services/apiService';

const PhonePageRefactored = ({ isOpen }) => {
  const { username } = useAuth();
  const sipCredentials = useContext(SIPCredentialsContext);
  const sipUsername = sipCredentials.login;
  const { setCallQueueUnreadCount } = useUnreadCount();

  // WebRTC and call state from ModalContext
  const {
    clientStatus,
    callState,
    dialNumber,
    callerInfo,
    handleDialClick,
    handleCall,
    handleHangUp,
    handleBackspace,
    handleHold,
    handleUnhold,
    onHold,
    activeCall,
    Audio,
    callControlId
  } = useContext(ModalContext);

  // Custom hooks for data management
  const { queueData, loading: queueLoading, acceptCall } = useCallQueue();
  const { agentNumbers, callerNumber, setCallerNumber } = useAgentNumbers(username);
  const { outboundCCID, webrtcOutboundCCID } = useOutboundCalls();

  // Set unread count to 0 when viewing phone page
  React.useEffect(() => {
    setCallQueueUnreadCount(0);
  }, [setCallQueueUnreadCount]);

  // Handlers for call actions
  const handleAcceptCall = async (call) => {
    try {
      const result = await acceptCall({
        ...call,
        sipUsername
      });
      
      if (!result.success) {
        alert(`Failed to accept call: ${result.error}`);
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      alert('Failed to accept call. Please try again.');
    }
  };

  const handleTransfer = async (transferData) => {
    try {
      await apiService.transferCall(transferData);
    } catch (error) {
      console.error('Transfer failed:', error);
      throw error;
    }
  };

  // Warm transfer handlers removed

  // Layout calculations
  const marginLeft = isOpen ? '240px' : '64px';
  const isCallActive = callState === 'active' || callState === 'ringing' || callState === 'connecting';

  return (
    <Box
      sx={{
        marginLeft: marginLeft,
        padding: 3,
        minHeight: '100vh',
        backgroundColor: 'grey.50',
        transition: 'margin-left 0.3s'
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          Phone Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage calls, queue, and agent transfers
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Call Controls & Queue */}
        <Grid item xs={12} lg={8}>
          <Grid container spacing={3}>
            {/* Call Controls */}
            <Grid item xs={12} md={6}>
              <CallControls
                callState={callState}
                onHold={onHold}
                handleCall={handleCall}
                handleHangUp={handleHangUp}
                handleHold={handleHold}
                handleUnhold={handleUnhold}
                dialNumber={dialNumber}
                callerInfo={callerInfo}
                Audio={Audio}
              />
            </Grid>

            {/* Transfer Controls */}
            <Grid item xs={12} md={6}>
              <TransferControls
                callControlId={callControlId}
                outboundCCID={outboundCCID}
                callerId={{ number: callerNumber }}
                sipUsername={sipUsername}
                agentNumbers={agentNumbers}
                onTransfer={handleTransfer}
                disabled={!isCallActive}
              />
            </Grid>

            {/* Call Queue */}
            <Grid item xs={12}>
              <QueueTable
                queueData={queueData}
                onAcceptCall={handleAcceptCall}
                sipUsername={sipUsername}
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Right Column - Agent Dashboard */}
        <Grid item xs={12} lg={4}>
          <AgentDashboard />
        </Grid>
      </Grid>

      {/* Debug Info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 4, p: 2, backgroundColor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Debug Info</Typography>
          <Typography variant="caption" component="div">
            Call State: {callState} | On Hold: {onHold ? 'Yes' : 'No'}
            <br />
            Call Control ID: {callControlId}
            <br />
            Outbound CCID: {outboundCCID}
            <br />
            WebRTC Outbound CCID: {webrtcOutboundCCID}
            <br />
            SIP Username: {sipUsername}
            <br />
            Caller Number: {callerNumber}
            <br />
            Queue Items: {queueData.length}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default PhonePageRefactored;