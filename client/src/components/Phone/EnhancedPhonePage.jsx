import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Card, 
  Button, 
  Input, 
  Label,
  List,
  Divider,
  Header,
  Icon,
  Segment,
  Container
} from 'semantic-ui-react';
import { useCallActions } from '../../hooks/useCallActions';
import { useCallQueue } from '../../hooks/useCallQueue';

const EnhancedPhonePage = ({ isOpen }) => {
  const {
    // Call state
    activeCall,
    incomingCalls,
    callState,
    callHistory,
    clientStatus,
    
    // Actions
    makeCall,
    acceptQueueCall,
    declineCall,
    hangUpCall,
    openModal,
    
    // Dialer
    dialNumber,
    setDialNumber,
    handleDialClick,
    handleBackspace,
    
    // Utilities
    isCallActive,
    hasIncomingCalls,
    getCallCount,
    canReceiveCalls,
    getCurrentCallInfo
  } = useCallActions();
  
  const { queueData, acceptCall: acceptQueueCallDirectly } = useCallQueue();
  
  const [callerNumber, setCallerNumber] = useState('+14168305230'); // Default caller ID

  // Status indicator component
  const StatusIndicator = () => {
    const getStatusColor = () => {
      switch (clientStatus) {
        case 'READY': return 'success';
        case 'ERROR': return 'error';
        default: return 'warning';
      }
    };

    const getStatusText = () => {
      switch (clientStatus) {
        case 'READY': return 'Ready for calls';
        case 'ERROR': return 'Connection error';
        default: return 'Connecting...';
      }
    };

    return (
      <Box display="flex" alignItems="center" mb={2}>
        <StatusIcon color={getStatusColor()} />
        <Typography variant="body2" sx={{ ml: 1 }}>
          WebRTC Status: {getStatusText()}
        </Typography>
        {getCallCount() > 0 && (
          <Badge badgeContent={getCallCount()} color="error" sx={{ ml: 2 }}>
            <PhoneIcon />
          </Badge>
        )}
      </Box>
    );
  };

  // Dialpad component
  const Dialpad = () => {
    const buttons = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['*', '0', '#']
    ];

    const handleCall = () => {
      if (dialNumber && callerNumber) {
        makeCall(callerNumber, dialNumber);
        setDialNumber('');
      }
    };

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <DialpadIcon /> Dialpad
          </Typography>
          
          <TextField
            fullWidth
            variant="outlined"
            value={dialNumber}
            onChange={(e) => setDialNumber(e.target.value)}
            placeholder="Enter number to call"
            margin="normal"
          />
          
          <TextField
            fullWidth
            variant="outlined"
            value={callerNumber}
            onChange={(e) => setCallerNumber(e.target.value)}
            placeholder="Your caller ID"
            margin="normal"
            size="small"
          />

          <Grid container spacing={1} sx={{ mt: 1 }}>
            {buttons.map((row, rowIndex) => (
              <Grid container item spacing={1} key={rowIndex}>
                {row.map((digit) => (
                  <Grid item xs={4} key={digit}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => handleDialClick(digit)}
                      sx={{ minHeight: '50px', fontSize: '18px' }}
                    >
                      {digit}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleCall}
              disabled={!dialNumber || !canReceiveCalls()}
              startIcon={<PhoneIcon />}
              fullWidth
            >
              Call
            </Button>
            <Button
              variant="outlined"
              onClick={handleBackspace}
              disabled={!dialNumber}
            >
              ⌫
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // Queue calls component
  const QueueCalls = () => {
    const handleAcceptQueueCall = async (call) => {
      const result = await acceptQueueCallDirectly(call);
      if (!result.success) {
        console.error('Failed to accept call:', result.error);
      }
    };

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <QueueIcon /> Call Queue
            {queueData.length > 0 && (
              <Chip 
                label={queueData.length} 
                color="error" 
                size="small" 
                sx={{ ml: 1 }} 
              />
            )}
          </Typography>

          {queueData.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              No calls in queue
            </Typography>
          ) : (
            <List dense>
              {queueData.map((call, index) => (
                <React.Fragment key={call.call_control_id || index}>
                  <ListItem>
                    <ListItemText
                      primary={`From: ${call.from || 'Unknown'}`}
                      secondary={`Queue: ${call.queue || 'General'} • ${new Date(call.created_at || Date.now()).toLocaleTimeString()}`}
                    />
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      onClick={() => handleAcceptQueueCall(call)}
                      startIcon={<PhoneCallbackIcon />}
                      disabled={isCallActive()}
                    >
                      Accept
                    </Button>
                  </ListItem>
                  {index < queueData.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    );
  };

  // Active call info
  const ActiveCallInfo = () => {
    const callInfo = getCurrentCallInfo();
    
    if (!callInfo) return null;

    return (
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
        <Typography variant="h6">
          Active Call - {callInfo.type?.toUpperCase()}
        </Typography>
        <Typography variant="body1">
          {callInfo.from} → {callInfo.to}
        </Typography>
        <Typography variant="body2">
          Status: {callInfo.state} | Duration: {callInfo.duration || '00:00'}
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Button
            variant="contained"
            color="error"
            size="small"
            onClick={() => hangUpCall()}
            sx={{ mr: 1 }}
          >
            Hang Up
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => openModal('queue')}
            sx={{ color: 'white', borderColor: 'white' }}
          >
            Show Details
          </Button>
        </Box>
      </Paper>
    );
  };

  // Call history component
  const CallHistory = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <HistoryIcon /> Recent Calls
        </Typography>
        
        {callHistory.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            No recent calls
          </Typography>
        ) : (
          <List dense>
            {callHistory.slice(0, 5).map((call, index) => (
              <React.Fragment key={call.id || index}>
                <ListItem>
                  <ListItemText
                    primary={`${call.direction === 'inbound' ? 'From' : 'To'}: ${call.from || call.to}`}
                    secondary={`${call.type?.toUpperCase()} • ${new Date(call.timestamp).toLocaleString()}`}
                  />
                  <Chip 
                    label={call.state} 
                    size="small" 
                    color={call.state === 'COMPLETED' ? 'success' : 'default'}
                  />
                </ListItem>
                {index < callHistory.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ flexGrow: 1, p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Phone System
      </Typography>
      
      <StatusIndicator />
      <ActiveCallInfo />
      
      <Grid container spacing={3}>
        {/* Left Column - Dialpad and Controls */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Dialpad />
            
            {/* Incoming calls indicator */}
            {hasIncomingCalls() && (
              <Paper sx={{ p: 2, bgcolor: 'warning.light' }}>
                <Typography variant="h6" color="warning.contrastText">
                  🔔 {incomingCalls.length} Incoming Call(s)
                </Typography>
                <Typography variant="body2" color="warning.contrastText">
                  Click the call modal to answer
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => openModal('queue')}
                  sx={{ mt: 1 }}
                >
                  Show Calls
                </Button>
              </Paper>
            )}
          </Box>
        </Grid>
        
        {/* Right Column - Queue and History */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <QueueCalls />
            <CallHistory />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EnhancedPhonePage;