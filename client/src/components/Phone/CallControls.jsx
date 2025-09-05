import React from 'react';
import { Button, Box, Typography } from '@mui/material';
import { Call, CallEnd, VolumeOff, VolumeUp, Pause, PlayArrow } from '@mui/icons-material';

const CallControls = ({
  callState,
  onHold,
  handleCall,
  handleHangUp,
  handleHold,
  handleUnhold,
  dialNumber,
  callerInfo,
  Audio
}) => {
  const renderCallButton = () => {
    if (callState === 'new' || callState === 'connecting') {
      return (
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleCall}
          startIcon={<Call />}
          disabled={callState === 'connecting'}
          sx={{ minWidth: 150 }}
        >
          {callState === 'connecting' ? 'Connecting...' : 'Call'}
        </Button>
      );
    }

    if (callState === 'ringing' || callState === 'active') {
      return (
        <Button
          variant="contained"
          color="error"
          size="large"
          onClick={handleHangUp}
          startIcon={<CallEnd />}
          sx={{ minWidth: 150 }}
        >
          End Call
        </Button>
      );
    }

    return null;
  };

  const renderHoldButton = () => {
    if (callState !== 'active') return null;

    return (
      <Button
        variant="outlined"
        color="secondary"
        size="large"
        onClick={onHold ? handleUnhold : handleHold}
        startIcon={onHold ? <PlayArrow /> : <Pause />}
        sx={{ minWidth: 120, ml: 2 }}
      >
        {onHold ? 'Unhold' : 'Hold'}
      </Button>
    );
  };

  const renderCallInfo = () => {
    if (callState === 'new') return null;

    return (
      <Box sx={{ mb: 2, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          {callState === 'connecting' && 'Connecting to'}
          {callState === 'ringing' && 'Calling'}
          {callState === 'active' && (onHold ? 'On Hold with' : 'Connected to')}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>
          {callerInfo?.number || dialNumber}
        </Typography>
        {callerInfo?.name && (
          <Typography variant="subtitle1" color="textSecondary">
            {callerInfo.name}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        p: 3,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        boxShadow: 1,
      }}
    >
      {renderCallInfo()}
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {renderCallButton()}
        {renderHoldButton()}
      </Box>

      {/* Audio element for call audio */}
      {Audio && (
        <Box sx={{ mt: 2, opacity: 0, height: 0 }}>
          {Audio}
        </Box>
      )}

      {/* Call status indicator */}
      {callState !== 'new' && (
        <Box
          sx={{
            mt: 2,
            px: 2,
            py: 0.5,
            borderRadius: 1,
            backgroundColor: 
              callState === 'active' && !onHold ? 'success.light' :
              callState === 'active' && onHold ? 'warning.light' :
              callState === 'connecting' ? 'info.light' :
              'grey.200',
            color: 'white',
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
            {callState === 'active' && !onHold && 'ACTIVE'}
            {callState === 'active' && onHold && 'ON HOLD'}
            {callState === 'connecting' && 'CONNECTING'}
            {callState === 'ringing' && 'RINGING'}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default CallControls;