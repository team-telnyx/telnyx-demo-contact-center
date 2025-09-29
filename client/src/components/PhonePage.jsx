import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
// import { SIPCredentialsContext } from './SIPCredentialsContext'; // No longer needed
import { useLegacyModalContext } from '../hooks/useLegacyModalContext';
import { useCallManager } from '../contexts/CallManagerContext';  
import { 
  Grid, 
  Card, 
  CardContent,
  CardHeader,
  Table, 
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button, 
  TextField, 
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Box,
  Paper,
  Chip
} from '@mui/material'; 
import { 
  Phone as PhoneIcon,
  PhoneCallback as PhoneCallbackIcon,
  Clear as ClearIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useUnreadCount } from './UnreadCount';
import apiService from '../services/apiService';

const getAgentsWithTag = async (tag) => {
  try {
    const response = await apiService.getAgentsWithTag(tag, 1, 20);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching agent numbers:', error);
    // apiService handles 401 errors and redirects to login automatically
    return [];
  }
};



const PhonePage = ({ isOpen }) => {
  const { isLoggedIn, username } = useAuth();
  const marginLeft = isOpen ? '240px' : '64px';
  const [agentNumbers, setAgentNumbers] = useState([]);
  const [callerNumber, setCallerNumber] = useState('');
  const [agentQueueData, setAgentQueueData] = useState([]);

  // Use queue data from CallManagerContext instead of local polling
  const { incomingCalls: queueData, acceptQueueCall } = useCallManager();
  // const sipCredentials = useContext(SIPCredentialsContext); // No longer needed since using apiService
  const { setCallQueueUnreadCount } = useUnreadCount();
  
  const {
    clientStatus,
    callState,
    dialNumber,
    // callerInfo, // Not used in PhonePage
    handleDialClick,
    handleCall,
    handleHangUp,
    handleBackspace,
    handleHold,
    handleUnhold,
    onHold,
    activeCall
    // callControlId // Not used in PhonePage
  } = useLegacyModalContext();  // Use legacy compatibility layer
  
  // Handle keyboard input for dialer
  const handleKeyDown = (event) => {
    const validKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#', '+'];
    if (validKeys.includes(event.key)) {
      handleDialClick(event.key);
    } else if (event.key === 'Backspace') {
      handleBackspace();
    }
  };

  // Handle paste functionality
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      // Only allow numbers, +, *, # characters
      const cleanText = text.replace(/[^\d+*#]/g, '');
      if (cleanText) {
        // Add each character to dial number
        cleanText.split('').forEach(char => handleDialClick(char));
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  useEffect(() => {
    // Add keyboard event listener
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleDialClick, handleBackspace]);

  useEffect(() => {
    // REMOVED: Duplicate websocket connection that was interfering with CallManagerContext
    // CallManagerContext already handles all call-related websocket events including:
    // - NEW_CALL, CALL_HANGUP, CALL_ACCEPTED, etc.
    // - OutboundCCID and WebRTC_OutboundCCID should be handled there if needed

    setCallQueueUnreadCount(0);
    const fetchAgentNumbers = async () => {
      if (username) {
        console.log(`PhonePage: Fetching phone numbers for tag: ${username}`);
        const numbers = await getAgentsWithTag(username); 
        console.log(`PhonePage: Received ${numbers.length} phone numbers:`, numbers);
        
        setAgentNumbers(numbers);
        if (numbers.length > 0) {
          setCallerNumber(numbers[0]); // set default callerNumber
          console.log(`PhonePage: Set default caller number to: ${numbers[0]}`);
        } else {
          console.log(`PhonePage: No phone numbers found for tag: ${username}`);
        }
      }
    };

    fetchAgentNumbers();
  }, [username, setCallQueueUnreadCount]);

  useEffect(() => {
    // Only fetch agent data since queue data is handled by CallManagerContext via WebSocket
    fetchAgentData();
  }, []);

  

  const fetchAgentData = async () => {
    try {
      const agents = await apiService.getAgents();
      const filteredAgents = agents.filter(agent => agent.username !== username);
      setAgentQueueData(filteredAgents);
    } catch (error) {
      console.error('Error fetching agent data:', error);
      // apiService handles 401 errors and redirects to login automatically
    }
  };

  // REMOVED: fetchQueueData - now using CallManagerContext.incomingCalls which is updated via WebSocket
  // CallAcceptButton component
const CallAcceptButton = ({ call }) => {
  const handleAccept = async () => {
    try {
      console.log('PhonePage: Accepting call via CallManagerContext:', call);
      const result = await acceptQueueCall(call);
      if (!result?.success) {
        console.error('PhonePage: Failed to accept call:', result?.error);
      }
    } catch (error) {
      console.error('PhonePage: Error accepting call:', error);
    }
  };

  return <Button primary size="small" onClick={handleAccept}>Accept</Button>;
};



  // Warm transfer components removed

  if (!isLoggedIn) {
    return (
      <div style={{ marginTop: '64px', marginLeft }}>
        <h1>Please login to access this page.</h1>
      </div>
    );
  }
  return (
    <Box sx={{ mt: 8, ml: marginLeft, p: 3 }}>
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Phone Center
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardHeader 
              title="Phone Controls" 
              sx={{ 
                bgcolor: 'primary.main', 
                color: 'primary.contrastText',
                '& .MuiCardHeader-title': { fontWeight: 600 }
              }}
              avatar={<PhoneIcon />}
            />
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <Chip 
                  label={`Status: ${clientStatus}`} 
                  color={clientStatus === 'READY' ? 'success' : 'default'}
                  variant="outlined"
                />
                <Chip 
                  label={`Call: ${callState}`} 
                  color={callState === 'ACTIVE' ? 'primary' : 'default'}
                  variant="outlined"
                />
              </Box>
              
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <TextField 
                  value={dialNumber} 
                  fullWidth
                  variant="outlined"
                  size="large"
                  InputProps={{ 
                    readOnly: true,
                    sx: { fontSize: '1.5rem', textAlign: 'center' }
                  }}
                  placeholder="Enter number to dial"
                  sx={{ mb: 2 }}
                />
                
                {activeCall && activeCall.remoteStream && (
                  <audio 
                    autoPlay 
                    ref={(audio) => {
                      if (audio) {
                        audio.srcObject = activeCall.remoteStream;
                      }
                    }} 
                  />
                )}
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Caller Number</InputLabel>
                  <Select
                    value={callerNumber}
                    label="Caller Number"
                    onChange={(e) => setCallerNumber(e.target.value)}
                  >
                    {agentNumbers.map((num, index) => (
                      <MenuItem key={index} value={num}>{num}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                {/* Dial Pad */}
                <Grid container spacing={1} sx={{ mb: 2 }}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((num, index) => (
                    <Grid item xs={4} key={index}>
                      <Button 
                        fullWidth 
                        variant="outlined" 
                        size="large"
                        onClick={() => handleDialClick(num)}
                        sx={{ minHeight: '50px', fontSize: '1.2rem' }}
                      >
                        {num}
                      </Button>
                    </Grid>
                  ))}
                  <Grid item xs={4}>
                    <Button 
                      fullWidth 
                      variant="outlined" 
                      size="large"
                      onClick={() => handleDialClick('+')}
                      sx={{ minHeight: '50px', fontSize: '1.2rem' }}
                    >
                      +
                    </Button>
                  </Grid>
                </Grid>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button 
                    fullWidth 
                    variant="outlined" 
                    startIcon={<ClearIcon />}
                    onClick={handleBackspace}
                  >
                    Clear
                  </Button>
                  <Button 
                    fullWidth 
                    variant="outlined"
                    onClick={handlePaste}
                  >
                    Paste
                  </Button>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    color="success"
                    size="large"
                    startIcon={<PhoneIcon />}
                    onClick={() => handleCall(callerNumber, dialNumber)}
                  >
                    Call
                  </Button>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    color="error"
                    size="large"
                    startIcon={<PhoneCallbackIcon />}
                    disabled={!['ACTIVE', 'TRYING', 'RINGING'].includes(callState)} 
                    onClick={handleHangUp}
                  >
                    Hang Up
                  </Button>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    fullWidth 
                    variant="outlined"
                    startIcon={<ScheduleIcon />}
                    disabled={callState !== "ACTIVE"} 
                    onClick={handleHold}
                  >
                    Hold
                  </Button>
                  <Button 
                    fullWidth 
                    variant="outlined"
                    disabled={callState !== "ACTIVE" && !onHold} 
                    onClick={handleUnhold}
                  >
                    Unhold
                  </Button>
                </Box>
              </Paper>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardHeader 
              title="Call Queue" 
              sx={{ 
                bgcolor: 'secondary.main', 
                color: 'secondary.contrastText',
                '& .MuiCardHeader-title': { fontWeight: 600 }
              }}
              avatar={<ScheduleIcon />}
            />
            <CardContent sx={{ p: 0 }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell>Wait Time (s)</TableCell>
                      <TableCell>Position</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(queueData) && queueData.map((call, index) => {
                      // Calculate wait time from timestamp
                      const waitTime = call.timestamp ? Math.floor((Date.now() - new Date(call.timestamp).getTime()) / 1000) : 0;

                      return (
                        <TableRow key={call.id || index} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {call.from}
                            </Typography>
                          </TableCell>
                          <TableCell>{call.to}</TableCell>
                          <TableCell>
                            <Chip
                              label={`${waitTime}s`}
                              size="small"
                              color={waitTime > 60 ? 'error' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={index + 1}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <CallAcceptButton call={call} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!Array.isArray(queueData) || queueData.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No calls in queue
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
          
          <Card elevation={2} sx={{ mt: 2 }}>
            <CardHeader 
              title="Agent Dashboard" 
              sx={{ 
                bgcolor: 'info.main', 
                color: 'info.contrastText',
                '& .MuiCardHeader-title': { fontWeight: 600 }
              }}
              avatar={<PersonIcon />}
            />
            <CardContent sx={{ p: 0 }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell>First Name</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(agentQueueData) && agentQueueData.map((agent, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {agent.username}
                          </Typography>
                        </TableCell>
                        <TableCell>{agent.firstName}</TableCell>
                        <TableCell>
                          <Chip 
                            label={agent.status ? 'Available' : 'Busy'}
                            color={agent.status ? 'success' : 'error'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {/* Warm transfer buttons removed */}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!Array.isArray(agentQueueData) || agentQueueData.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No agents available
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PhonePage;
