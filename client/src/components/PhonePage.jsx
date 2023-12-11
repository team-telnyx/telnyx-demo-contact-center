import React, { useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { SIPCredentialsContext } from './SIPCredentialsContext';
import { ModalContext } from './ModalContext';  
import { Grid, Card, CardContent, CardHeader, Table, TableBody, TableCell, TableHead, TableRow, Button, Input, Select, MenuItem } from '@mui/material'; 
import axios from 'axios';
import { io } from "socket.io-client";
import { useUnreadCount } from './UnreadCount';
const telnyxApiKey = process.env.REACT_APP_TELNYX_API_KEY;

const getAgentsWithTag = async (tag) => {
  try {
    const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      params: {
        'page[number]': 1,
        'page[size]': 20,
        'filter[tag]': tag,
      },
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`,
      },
    });

    const phoneNumbers = response.data.data;
    const agentNumbers = phoneNumbers.map((phoneNumber) => phoneNumber.phone_number);
    return agentNumbers;
  } catch (error) {
    console.error('Error fetching agent numbers:', error);
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
  const [isConferenceCreated, setIsConferenceCreated] = useState(false);
  
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
  } = useContext(ModalContext);  // Access values and methods from ModalContext
  
  useEffect(() => {
    //get outbound calll control id from websocket
    const socket = io(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}`);
    socket.on('connect', () => {
      console.log('Connected to websocket');
    });
    socket.on('disconnect', () => {
      console.log('Disconnected from websocket');
    });
    socket.on('OutboundCCID', (data) => {
      console.log('OutboundCCID:', data);
      setoutboundCCID(data);
    });
    socket.on('WebRTC_OutboundCCID', (data) => {
      console.log('WebRTC_OutboundCCID:', data);
      setwebrtcOutboundCCID(data);
    });
    setCallQueueUnreadCount(0);
    const fetchAgentNumbers = async () => {
      if (username) {
      const numbers = await getAgentsWithTag(username); 
      
      setAgentNumbers(numbers);
      if (numbers.length > 0) setCallerNumber(numbers[0]); // set default callerNumber
      }
    };

    fetchAgentNumbers();
  }, [username, setCallQueueUnreadCount]);

  useEffect(() => {
    const checkConferenceStatus = async () => {
      try {
        console.log("CALL CONTROL ID", callControlId)
        const response = await axios.get(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/voice/conference-status/${callControlId}`);
        setIsConferenceCreated(response.data.isConferenceCreated);
      } catch (error) {
        console.error('Error fetching conference status:', error);
      }
    };
    const fetchAllData = async () => {
        await fetchAgentData();
        await fetchQueueData();
        await checkConferenceStatus();
    };

    fetchAllData();  // Initial fetch

    const intervalId = setInterval(fetchAllData, 5000);  // Fetch every 5 seconds
    return () => clearInterval(intervalId);  // Clear interval on component unmount
  }, [callControlId]);

  

  const fetchAgentData = async () => {
    try {
      const response = await axios.get(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/users/agents`);
      const filteredAgents = response.data.filter(agent => agent.username !== username);
      setAgentQueueData(filteredAgents);
    } catch (error) {
      console.error('Error fetching agent data:', error);
    }
  };

  const fetchQueueData = async () => {
    try {
      const response = await fetch(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/voice/queue`);
      if (!response.ok) {
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
    await fetch(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/voice/accept-call`, {
      method: 'POST',
      body: JSON.stringify({ sipUsername: sipUsername, callControlId: callControlId, callerId: callerId }),  // include callControlId here
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  return <Button variant="contained" color="primary" size="small" onClick={handleTransfer}>Accept</Button>;
};


  const AgentCallTransferButton = ({ callControlId, agentUsername, callState, agentStatus, callerId, outboundCCID }) => {  
    const isDisabled = callState !== "ACTIVE" || !agentStatus;
    const handleTransfer = async () => {
      await fetch(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/voice/transfer`, {
        method: 'POST',
        body: JSON.stringify({ sipUsername: agentUsername, callerId: callerId, outboundCCID: outboundCCID, callControlId: callControlId }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    };
    return <Button variant="contained" color="primary" size="small" onClick={handleTransfer} disabled={isDisabled}>Transfer</Button>;
  };

  const WarmTransferButton = ({ webrtcOutboundCCID, outboundCCID, callControlId, agentUsername, callerId, callState, agentStatus }) => {  
    const [buttonText, setButtonText] = useState('Warm Transfer');
    const isDisabled = callState !== "ACTIVE" || !agentStatus;
    const handleTransfer = async () => {
      if (buttonText === 'Warm Transfer') {
      try {
        const response = await fetch(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/voice/warm-transfer`, {
          method: 'POST',
          body: JSON.stringify({ sipUsername: agentUsername, callControlId: callControlId, webrtcOutboundCCID: webrtcOutboundCCID, outboundCCID: outboundCCID, callerId: callerId }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        console.log('Conference created:', data);
      } catch (error) {
        console.error('Error handling warm transfer:', error);
      }
    }
    };
  
    return <Button variant="contained" color="secondary" size="small" onClick={handleTransfer} disabled={isDisabled}>Warm Transfer</Button>;
  };

  const CompleteWarmTransferButton = ({ callControlId, outboundCCID, agentStatus }) => {
    const isDisabled = !isConferenceCreated;
    console.log("CALL CONTROL ID COMPLETE", callControlId, outboundCCID, agentStatus)
    console.log("IS DISABLED", callState, agentStatus)
    const handleCompleteTransfer = async () => {
      try {
        const response = await axios.post(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/voice/complete-warm-transfer`, {
        callControlId: callControlId,
        outboundCCID: outboundCCID
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
        console.log('Warm transfer completed:', response.data);
      } catch (error) {
        console.error('Error completing warm transfer:', error);
      }
    };
  
    return <Button variant="contained" color="primary" size="small" onClick={handleCompleteTransfer} disabled={isDisabled}>Complete Warm Transfer</Button>;
  };

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
    <div style={{ marginTop: '64px', marginLeft }}>
    <h1>Phone Page</h1>
    <hr />
    {/* Wrap the webRTC client code with ModalProvider */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader style={{backgroundColor: "black"}} title="Phone Controls" />
            <CardContent>
                <div>Client Status: {clientStatus}</div>
                <div>Call State: {callState}</div>
                <div style={{ border: '1px solid #ccc', padding: '15px' }}>
                <Input value={dialNumber} readOnly style={{ width: '100%', height: '50px' }} />
                {activeCall && activeCall.remoteStream && <Audio stream={activeCall.remoteStream} />}
                <Select
                  value={callerNumber}
                  onChange={(e) => setCallerNumber(e.target.value)}
                  style={{ width: '100%', marginBottom: '10px' }}
                >
                  {agentNumbers.map((num, index) => (
                    <MenuItem key={index} value={num}>{num}</MenuItem>
                  ))}
                </Select>
                <Grid container>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((num, index) => (
                    <Grid item key={index} xs={4}>
                      <Button fullWidth variant="outlined" onClick={() => handleDialClick(num)}>{num}</Button>
                    </Grid>
                  ))}
                </Grid>
                <Grid container style={{ marginTop: '10px' }}>
                  <Grid item xs={12}>
                    <Button fullWidth variant="outlined" onClick={handleBackspace}>Backspace</Button>
                  </Grid>
                 </Grid>
                <Grid container style={{ marginTop: '10px' }}>
                  <Grid item xs={6}>
                    <Button fullWidth color='primary' variant="contained" onClick={() => handleCall(callerNumber, dialNumber)}>Call</Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button fullWidth color='secondary' variant="contained" disabled={!['ACTIVE', 'TRYING', 'RINGING'].includes(callState)} onClick={handleHangUp}>Hang Up</Button>
                  </Grid>
                </Grid>
                <Grid container style={{ marginTop: '10px' }}>
                  <Grid item xs={6}>
                    <Button fullWidth variant="contained" disabled={callState !== "ACTIVE"} onClick={handleHold}>Hold</Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button fullWidth variant="contained" disabled={callState !== "ACTIVE" && !onHold} onClick={handleUnhold}>Unhold</Button>
                  </Grid>
                </Grid>
              </div>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader style={{backgroundColor: "black"}} title="Queue Table" />
            <CardContent>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell>Wait Time (seconds)</TableCell>
                    <TableCell>Queue Position</TableCell>
                    <TableCell>Call Function</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.isArray(queueData) && queueData.map((call, index) => (
                    <TableRow key={index}>
                      <TableCell>{call.from}</TableCell>
                      <TableCell>{call.to}</TableCell>
                      <TableCell>{call.wait_time_secs}</TableCell>
                      <TableCell>{call.queue_position}</TableCell>
                      <TableCell><CallAcceptButton callControlId={call.call_control_id} callerId={call.from} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card style={{ marginTop: '16px' }}>  {/* Adding margin for spacing between cards */}
            <CardHeader style={{backgroundColor: "black"}} title="Agent Dashboard" />
            <CardContent>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>First Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Call Function</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.isArray(agentQueueData) && agentQueueData.map((agent, index) => (
                    <TableRow key={index}>
                      <TableCell>{agent.username}</TableCell>
                      <TableCell>{agent.firstName}</TableCell>
                      <TableCell>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: agent.status ? 'green' : 'red' }} />
                      </TableCell>
                      <TableCell>
                        <AgentCallTransferButton agentUsername={agent.username} callerId={callerInfo} callState={callState} agentStatus={agent.status} callControlId={callControlId} outboundCCID={outboundCCID}/>
                        <WarmTransferButton webrtcOutboundCCID={webrtcOutboundCCID} outboundCCID={outboundCCID} callControlId={callControlId} agentUsername={agent.username} callerId={callerInfo} callState={callState} agentStatus={agent.status}/>
                        <CompleteWarmTransferButton callControlId={callControlId} outboundCCID={outboundCCID} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
  </div>
);
};

export default PhonePage;
