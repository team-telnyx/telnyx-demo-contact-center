import React, { useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { SIPCredentialsContext } from './SIPCredentialsContext';
import { useLegacyModalContext } from '../hooks/useLegacyModalContext';  
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
  Chip,
  IconButton,
  Tooltip
} from '@mui/material'; 
import { 
  Phone as PhoneIcon,
  PhoneCallback as PhoneCallbackIcon,
  Clear as ClearIcon,
  SwapHoriz as TransferIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import axios from 'axios';
import { io } from "socket.io-client";
import { useUnreadCount } from './UnreadCount';
import { getApiBaseUrl, getWebSocketUrl } from '../utils/apiUtils';

const getAgentsWithTag = async (tag) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${getApiBaseUrl()}/api/telnyx/phone-numbers`, {
      params: {
        tag: tag,
        page: 1,
        size: 20,
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const agentNumbers = response.data.data || [];
    return agentNumbers;
  } catch (error) {
    console.error('Error fetching agent numbers:', error);
    console.error('Response:', error.response?.data);
    return [];
  }
};



const PhonePage = ({ isOpen }) => {
  const { isLoggedIn, username } = useAuth();
  const marginLeft = isOpen ? '240px' : '64px';
  const [agentNumbers, setAgentNumbers] = useState([]);
  const [callerNumber, setCallerNumber] = useState('');
  const [queueData, setQueueData] = useState([]);
  const [agentQueueData, setAgentQueueData] = useState([]);
  const [outboundCCID, setoutboundCCID] = useState([]);
  const [webrtcOutboundCCID, setwebrtcOutboundCCID] = useState([]);
  const sipCredentials = useContext(SIPCredentialsContext); // Use SIPCredentialsContext
  const sipUsername = sipCredentials.login;
  const { setCallQueueUnreadCount } = useUnreadCount();
  const [isQueuePollingEnabled, setIsQueuePollingEnabled] = useState(true);
  
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
    callControlId
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
    //get outbound calll control id from websocket
    const socket = io(getWebSocketUrl());
    socket.on('connect', () => {
      console.log('Connected to websocket');
    });
    socket.on('disconnect', () => {
      console.log('Disconnected from websocket');
    });
    socket.on('OutboundCCID', (data) => {
      console.log('OutboundCCID:', data);
      setoutboundCCID(data);
      // Re-enable queue polling when outbound call is initiated
      if (data) {
        setIsQueuePollingEnabled(true);
      }
    });
    socket.on('WebRTC_OutboundCCID', (data) => {
      console.log('WebRTC_OutboundCCID:', data);
      setwebrtcOutboundCCID(data);
      // Re-enable queue polling when WebRTC outbound call is initiated
      if (data) {
        setIsQueuePollingEnabled(true);
      }
    });
    
    // Listen for new calls to re-enable polling
    socket.on('NEW_CALL', (data) => {
      console.log('NEW_CALL received:', data);
      setIsQueuePollingEnabled(true);
    });
    
    // Listen for call hangup events to close modal
    socket.on('CALL_HANGUP', (hangupData) => {
      console.log('PhonePage: Call hangup received:', hangupData);
      // Force close modal by resetting call state if this matches current call
      // This is a fallback in case CallManagerContext doesn't handle it
    });
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
    const fetchAllData = async () => {
        await fetchAgentData();
        // Only fetch queue data if polling is enabled
        if (isQueuePollingEnabled) {
          await fetchQueueData();
        }
    };

    fetchAllData();  // Initial fetch

    const intervalId = setInterval(fetchAllData, 5000);  // Fetch every 5 seconds
    return () => clearInterval(intervalId);  // Clear interval on component unmount
  }, [callControlId, isQueuePollingEnabled]);

  

  const fetchAgentData = async () => {
    try {
      const response = await axios.get(`${getApiBaseUrl()}/api/users/agents`);
      const filteredAgents = response.data.filter(agent => agent.username !== username);
      setAgentQueueData(filteredAgents);
    } catch (error) {
      console.error('Error fetching agent data:', error);
    }
  };

  const fetchQueueData = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/voice/queue`);
      if (!response.ok) {
        // Check if it's a 404 error indicating queue doesn't exist
        if (response.status === 404) {
          console.log('Queue not found (404), disabling polling until call.initiated');
          setIsQueuePollingEnabled(false);
          setQueueData([]);
          return;
        }
        throw new Error('Network response was not ok ' + response.statusText);
      }
      const data = await response.json();
      console.log(data);
      setQueueData(data.data);
    } catch (error) {
      console.error('There has been a problem with your fetch operation:', error);
    }
  };
  // CallTransferButton component
const CallAcceptButton = ({ callControlId, callerId }) => {  
  const handleTransfer = async () => {
    await fetch(`${getApiBaseUrl()}/api/voice/accept-call`, {
      method: 'POST',
      body: JSON.stringify({ sipUsername: sipUsername, callControlId: callControlId, callerId: callerId }),  // include callControlId here
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  return <Button primary size="small" onClick={handleTransfer}>Accept</Button>;
};


  const AgentCallTransferButton = ({ callControlId, agentUsername, callState, agentStatus, callerId, outboundCCID }) => {  
    const isDisabled = callState !== "ACTIVE" || !agentStatus;
    const handleTransfer = async () => {
      await fetch(`${getApiBaseUrl()}/api/voice/transfer`, {
        method: 'POST',
        body: JSON.stringify({ sipUsername: agentUsername, callerId: callerId, outboundCCID: outboundCCID, callControlId: callControlId }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    };
    return <Button primary size="small" onClick={handleTransfer} disabled={isDisabled}>Transfer</Button>;
  };

  // Warm transfer components removed

  if (!isLoggedIn) {
    return (
      <div style={{ marginTop: '64px', marginLeft }}>
        <h1>Please login to access this page.</h1>
      </div>
    );
  }
  console.log("OUTBOUND CCID", outboundCCID)
  const options = agentNumbers.map((num, index) => ({ key: index, text: num, value: num }));
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
                    {Array.isArray(queueData) && queueData.map((call, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {call.from}
                          </Typography>
                        </TableCell>
                        <TableCell>{call.to}</TableCell>
                        <TableCell>
                          <Chip 
                            label={`${call.wait_time_secs}s`}
                            size="small"
                            color={call.wait_time_secs > 60 ? 'error' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={call.queue_position}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <CallAcceptButton callControlId={call.call_control_id} callerId={call.from} />
                        </TableCell>
                      </TableRow>
                    ))}
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
                            <AgentCallTransferButton 
                              agentUsername={agent.username} 
                              callerId={callerInfo} 
                              callState={callState} 
                              agentStatus={agent.status} 
                              callControlId={callControlId} 
                              outboundCCID={outboundCCID}
                            />
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
