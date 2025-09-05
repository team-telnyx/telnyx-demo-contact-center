import React, { useState } from 'react';
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
  Container,
  Message
} from 'semantic-ui-react';
import { useCallActions } from '../../hooks/useCallActions';
import { useCallQueue } from '../../hooks/useCallQueue';

const SimpleEnhancedPhonePage = ({ isOpen }) => {
  const {
    // Call state
    activeCall,
    incomingCalls,
    callState,
    callHistory,
    clientStatus,
    
    // Actions
    makeCall,
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
  
  const [callerNumber, setCallerNumber] = useState('+14168305230');

  // Status indicator
  const getStatusColor = () => {
    switch (clientStatus) {
      case 'READY': return 'green';
      case 'ERROR': return 'red';
      default: return 'yellow';
    }
  };

  const getStatusText = () => {
    switch (clientStatus) {
      case 'READY': return 'Ready for calls';
      case 'ERROR': return 'Connection error';
      default: return 'Connecting...';
    }
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
      if (dialNumber && callerNumber && makeCall) {
        makeCall(callerNumber, dialNumber);
        setDialNumber('');
      }
    };

    return (
      <Card>
        <Card.Content>
          <Header as="h3">
            <Icon name="phone" />
            Dialpad
          </Header>
          
          <Input
            fluid
            value={dialNumber}
            onChange={(e) => setDialNumber(e.target.value)}
            placeholder="Enter number to call"
            style={{ marginBottom: '10px' }}
          />
          
          <Input
            fluid
            value={callerNumber}
            onChange={(e) => setCallerNumber(e.target.value)}
            placeholder="Your caller ID"
            size="small"
            style={{ marginBottom: '15px' }}
          />

          <Grid columns={3} style={{ marginBottom: '15px' }}>
            {buttons.map((row, rowIndex) => (
              <Grid.Row key={rowIndex}>
                {row.map((digit) => (
                  <Grid.Column key={digit}>
                    <Button
                      fluid
                      onClick={() => handleDialClick && handleDialClick(digit)}
                      style={{ minHeight: '50px', fontSize: '18px' }}
                    >
                      {digit}
                    </Button>
                  </Grid.Column>
                ))}
              </Grid.Row>
            ))}
          </Grid>

          <Button.Group fluid>
            <Button
              primary
              onClick={handleCall}
              disabled={!dialNumber || !canReceiveCalls()}
              icon="phone"
              content="Call"
            />
            <Button
              onClick={handleBackspace}
              disabled={!dialNumber}
              icon="backspace"
            />
          </Button.Group>
        </Card.Content>
      </Card>
    );
  };

  // Queue calls component
  const QueueCalls = () => {
    const handleAcceptQueueCall = async (call) => {
      if (acceptQueueCallDirectly) {
        const result = await acceptQueueCallDirectly(call);
        if (!result.success) {
          console.error('Failed to accept call:', result.error);
        }
      }
    };

    return (
      <Card>
        <Card.Content>
          <Header as="h3">
            <Icon name="music" />
            Call Queue
            {queueData.length > 0 && (
              <Label color="red" circular size="small" style={{ marginLeft: '10px' }}>
                {queueData.length}
              </Label>
            )}
          </Header>

          {queueData.length === 0 ? (
            <Message info>
              <Icon name="info circle" />
              No calls in queue
            </Message>
          ) : (
            <List divided>
              {queueData.map((call, index) => (
                <List.Item key={call.call_control_id || index} style={{ padding: '10px 0' }}>
                  <List.Content floated="right">
                    <Button
                      positive
                      size="small"
                      onClick={() => handleAcceptQueueCall(call)}
                      disabled={isCallActive()}
                      icon="phone"
                      content="Accept"
                    />
                  </List.Content>
                  <List.Content>
                    <List.Header>From: {call.from || 'Unknown'}</List.Header>
                    <List.Description>
                      Queue: {call.queue || 'General'} • {new Date(call.created_at || Date.now()).toLocaleTimeString()}
                    </List.Description>
                  </List.Content>
                </List.Item>
              ))}
            </List>
          )}
        </Card.Content>
      </Card>
    );
  };

  // Active call info
  const ActiveCallInfo = () => {
    const callInfo = getCurrentCallInfo && getCurrentCallInfo();
    
    if (!callInfo) return null;

    return (
      <Message positive style={{ marginBottom: '20px' }}>
        <Message.Header>
          Active Call - {callInfo.type?.toUpperCase()}
        </Message.Header>
        <p>
          {callInfo.from} → {callInfo.to}<br/>
          Status: {callInfo.state} | Duration: {callInfo.duration || '00:00'}
        </p>
        <Button.Group size="small">
          <Button
            negative
            onClick={() => hangUpCall && hangUpCall()}
            icon="phone slash"
            content="Hang Up"
          />
          <Button
            basic
            onClick={() => openModal && openModal('queue')}
            icon="expand"
            content="Show Details"
          />
        </Button.Group>
      </Message>
    );
  };

  // Call history component  
  const CallHistory = () => (
    <Card>
      <Card.Content>
        <Header as="h3">
          <Icon name="history" />
          Recent Calls
        </Header>
        
        {(!callHistory || callHistory.length === 0) ? (
          <Message info>
            <Icon name="info circle" />
            No recent calls
          </Message>
        ) : (
          <List divided>
            {callHistory.slice(0, 5).map((call, index) => (
              <List.Item key={call.id || index} style={{ padding: '8px 0' }}>
                <List.Content floated="right">
                  <Label 
                    color={call.state === 'COMPLETED' ? 'green' : 'grey'}
                    size="small"
                  >
                    {call.state}
                  </Label>
                </List.Content>
                <List.Content>
                  <List.Header>
                    {call.direction === 'inbound' ? 'From' : 'To'}: {call.from || call.to}
                  </List.Header>
                  <List.Description>
                    {call.type?.toUpperCase()} • {new Date(call.timestamp).toLocaleString()}
                  </List.Description>
                </List.Content>
              </List.Item>
            ))}
          </List>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <Container style={{ marginTop: '20px' }}>
      <Header as="h2">
        <Icon name="phone" />
        Phone System
      </Header>
      
      {/* Status indicator */}
      <Segment style={{ marginBottom: '20px' }}>
        <Label color={getStatusColor()} style={{ marginRight: '10px' }}>
          <Icon name="circle" />
          WebRTC Status: {getStatusText()}
        </Label>
        {getCallCount() > 0 && (
          <Label color="red">
            <Icon name="phone" />
            {getCallCount()} Active Call(s)
          </Label>
        )}
      </Segment>
      
      <ActiveCallInfo />
      
      <Grid columns={2} stackable>
        {/* Left Column - Dialpad and Controls */}
        <Grid.Column>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Dialpad />
            
            {/* Incoming calls indicator */}
            {hasIncomingCalls() && (
              <Message warning>
                <Message.Header>
                  <Icon name="bell" />
                  {incomingCalls.length} Incoming Call(s)
                </Message.Header>
                <p>Click the call modal to answer</p>
                <Button
                  size="small"
                  onClick={() => openModal && openModal('queue')}
                  icon="expand"
                  content="Show Calls"
                />
              </Message>
            )}
          </div>
        </Grid.Column>
        
        {/* Right Column - Queue and History */}
        <Grid.Column>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <QueueCalls />
            <CallHistory />
          </div>
        </Grid.Column>
      </Grid>
    </Container>
  );
};

export default SimpleEnhancedPhonePage;