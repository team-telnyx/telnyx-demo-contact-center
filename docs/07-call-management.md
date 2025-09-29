# Call Management System

This document details the call management architecture, event flows, and state management within the WebRTC Contact Center application.

## Call Management Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                  Call Management System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ CallManager     │    │ WebSocket       │    │ Telnyx       │ │
│  │ Context         │◄──►│ Event Handler   │◄──►│ Integration  │ │
│  │                 │    │                 │    │              │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                       │     │
│           ▼                       ▼                       ▼     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ Universal Call  │    │ Agent Queue     │    │ Call History │ │
│  │ Modal           │    │ Management      │    │ Tracking     │ │
│  │                 │    │                 │    │              │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Call State Management

#### Call States

```javascript
// Call state enumeration
const CALL_STATES = {
  IDLE: 'IDLE',
  TRYING: 'TRYING',
  RINGING: 'RINGING',
  ACTIVE: 'ACTIVE',
  HOLDING: 'HOLDING',
  TRANSFERRING: 'TRANSFERRING',
  ENDED: 'ENDED',
  FAILED: 'FAILED'
};

// Call types
const CALL_TYPES = {
  QUEUE: 'queue',      // Incoming calls from queue
  WEBRTC: 'webrtc',    // Direct WebRTC calls
  PSTN: 'pstn',        // Traditional phone calls
  OUTBOUND: 'outbound' // Agent-initiated calls
};
```

#### State Transitions

```
Call Lifecycle:

IDLE ──────► TRYING ──────► RINGING ──────► ACTIVE ──────► ENDED
 │              │              │             │ ▲           ▲
 │              ▼              ▼             ▼ │           │
 │           FAILED        DECLINED      HOLDING          │
 │              │              │             │ │           │
 │              └──────────────┴─────────────┘ │           │
 │                                           │           │
 └───────────────────────────────────────────┴───────────┘

Transfer Flow:
ACTIVE ──────► TRANSFERRING ──────► ENDED
   │               │                   │
   │               ▼                   │
   │           FAILED ─────────────────┘
   │               │
   └───────────────┘
```

## CallManagerContext Implementation

### Context Structure

```javascript
// CallManagerContext state
const initialState = {
  // Call state
  activeCall: null,
  incomingCalls: [],
  callHistory: [],
  callState: 'IDLE',

  // Modal management
  isCallModalOpen: false,
  modalType: null,

  // WebSocket connection
  socket: null,
  isConnected: false,

  // Queue management
  queueCalls: [],
  queueMetrics: {
    totalCalls: 0,
    averageWaitTime: 0,
    longestWaitTime: 0
  }
};
```

### Key Methods

#### Call Acceptance Flow

```javascript
const acceptQueueCall = async (call) => {
  try {
    console.log('CallManager: Accepting queue call:', call);

    // 1. Emit acceptance to server
    if (socket) {
      socket.emit('accept_call', {
        callControlId: call.callControlId
      });
    }

    // 2. Remove from incoming calls immediately
    setIncomingCalls(prev => prev.filter(c => c.id !== call.id));

    // 3. Wait for CALL_ACCEPTED WebSocket event to set active call
    // This prevents duplicate call creation

    return { success: true };
  } catch (error) {
    console.error('CallManager: Error accepting call:', error);
    return { success: false, error: error.message };
  }
};
```

#### WebRTC Call Handling

```javascript
const handleWebRTCCall = async (callObject, action) => {
  switch (action) {
    case 'NEW_CALL':
      // Create new call entry
      const newCall = {
        id: callObject.id,
        type: 'webrtc',
        callObject: callObject,
        from: callObject.remoteCallerIdName || 'Unknown',
        to: callObject.destinationNumber,
        timestamp: new Date(),
        state: 'INCOMING',
        direction: 'inbound'
      };

      setActiveCall(newCall);
      setIsCallModalOpen(true);
      break;

    case 'HANGUP':
      // Handle call termination
      setActiveCall(null);
      setCallState('IDLE');
      setIsCallModalOpen(false);
      break;
  }
};
```

### WebSocket Event Handlers

```javascript
// Event handler setup in CallManagerContext
const setupEventHandlers = (socketConnection) => {
  // New incoming call from queue
  socketConnection.on('NEW_CALL', handleIncomingQueueCall);

  // Call accepted by agent
  socketConnection.on('CALL_ACCEPTED', handleCallAccepted);

  // Call status updates
  socketConnection.on('CALL_UPDATE', handleCallUpdate);

  // Call terminated
  socketConnection.on('CALL_HANGUP', handleCallHangup);

  // Transfer events
  socketConnection.on('TRANSFER_INITIATED', handleTransferInitiated);
  socketConnection.on('TRANSFER_COMPLETED', handleTransferCompleted);
};
```

## Queue Management

### Queue Call Structure

```javascript
// Queue call object
const queueCall = {
  id: 'unique_call_id',
  type: 'queue',
  callControlId: 'telnyx_call_control_id',
  from: '+1234567890',
  to: '+0987654321',
  timestamp: '2023-12-01T10:00:00Z',
  state: 'INCOMING',
  direction: 'inbound',
  queuePosition: 1,
  waitTime: 45, // seconds
  priority: 'normal'
};
```

### Queue Operations

#### Adding Calls to Queue

```javascript
const handleIncomingQueueCall = (callData) => {
  const callControlId = callData.data?.call_control_id;

  const newCall = {
    id: callControlId,
    type: 'queue',
    from: callData.payload?.from || 'Unknown',
    to: callData.payload?.to || '',
    timestamp: new Date(),
    state: 'INCOMING',
    callControlId: callControlId,
    direction: 'inbound'
  };

  setIncomingCalls(prev => [...prev, newCall]);

  // Update queue metrics
  updateQueueMetrics();
};
```

#### Queue Metrics Calculation

```javascript
const updateQueueMetrics = () => {
  const currentTime = Date.now();
  const totalCalls = incomingCalls.length;

  let totalWaitTime = 0;
  let longestWait = 0;

  incomingCalls.forEach(call => {
    const waitTime = Math.floor((currentTime - new Date(call.timestamp)) / 1000);
    totalWaitTime += waitTime;
    longestWait = Math.max(longestWait, waitTime);
  });

  const averageWaitTime = totalCalls > 0 ? Math.floor(totalWaitTime / totalCalls) : 0;

  setQueueMetrics({
    totalCalls,
    averageWaitTime,
    longestWaitTime: longestWait
  });
};
```

## Universal Call Modal

### Modal State Management

```javascript
// UniversalCallModal state
const [isMinimized, setIsMinimized] = useState(false);
const [callDuration, setCallDuration] = useState(0);
const [isAnswering, setIsAnswering] = useState(false);
const [callControls, setCallControls] = useState({
  muted: false,
  hold: false,
  recording: false
});
```

### Call Control Functions

#### Answer Call

```javascript
const handleAnswer = async () => {
  if (!activeCall) return;

  try {
    setIsAnswering(true);

    let result;
    if (activeCall.type === 'queue') {
      result = await acceptQueueCall(activeCall);
    } else if (activeCall.type === 'webrtc') {
      result = answerWebRTCCall(activeCall);
    }

    if (!result?.success) {
      console.error('Failed to answer call:', result?.error);
    }

    // Clear answering state after delay
    setTimeout(() => {
      setIsAnswering(false);
    }, 1000);
  } catch (error) {
    console.error('Error answering call:', error);
    setIsAnswering(false);
  }
};
```

#### Hold/Unhold

```javascript
const handleHold = () => {
  if (activeCall?.type === 'webrtc' && activeCall.callObject) {
    try {
      activeCall.callObject.hold();
      setCallControls(prev => ({ ...prev, hold: true }));
    } catch (error) {
      console.error('Error putting call on hold:', error);
    }
  }
};

const handleUnhold = () => {
  if (activeCall?.type === 'webrtc' && activeCall.callObject) {
    try {
      activeCall.callObject.unhold();
      setCallControls(prev => ({ ...prev, hold: false }));
    } catch (error) {
      console.error('Error taking call off hold:', error);
    }
  }
};
```

### Remote Hangup Detection

```javascript
// Auto-close modal when call becomes inactive
useEffect(() => {
  if (!activeCall && callState === 'IDLE' && isCallModalOpen) {
    const timeoutId = setTimeout(() => {
      console.log('UniversalCallModal: No active call after delay, closing modal');
      closeModal();
      setIsMinimized(false);
      setIsAnswering(false);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }
}, [activeCall, callState, isCallModalOpen, closeModal]);

// WebRTC-specific hangup detection
useEffect(() => {
  if (activeCall?.type === 'webrtc' && activeCall.callObject) {
    if (!activeCall.callObject.active ||
        activeCall.callObject.state === 'ended' ||
        activeCall.callObject.state === 'hangup' ||
        activeCall.callObject.state === 'terminated') {
      console.log('UniversalCallModal: WebRTC call inactive, closing modal');
      closeModal();
      setIsMinimized(false);
      setIsAnswering(false);
    }
  }
}, [activeCall, closeModal, callState, isCallModalOpen]);
```

## Call Transfer System

### Transfer Types

1. **Blind Transfer**: Transfer without consulting the target
2. **Attended Transfer**: Consult with target before completing transfer
3. **Queue Transfer**: Transfer back to a different queue

### Transfer Implementation

```javascript
const initiateTransfer = async (targetNumber, transferType = 'blind') => {
  if (!activeCall) return { success: false, error: 'No active call' };

  try {
    setCallState('TRANSFERRING');

    const transferData = {
      callControlId: activeCall.callControlId,
      targetNumber,
      transferType,
      agentId: getCurrentAgent().id
    };

    // Emit transfer request
    socket.emit('initiate_transfer', transferData);

    // For blind transfer, end current call immediately
    if (transferType === 'blind') {
      setActiveCall(null);
      setIsCallModalOpen(false);
      setCallState('IDLE');
    }

    return { success: true };
  } catch (error) {
    console.error('Transfer failed:', error);
    setCallState('ACTIVE'); // Revert state
    return { success: false, error: error.message };
  }
};
```

## Call History and Analytics

### Call History Structure

```javascript
const callHistoryEntry = {
  id: 'unique_id',
  agentId: 'agent_id',
  callControlId: 'telnyx_call_id',
  type: 'queue|webrtc|outbound',
  direction: 'inbound|outbound',
  from: '+1234567890',
  to: '+0987654321',
  status: 'completed|missed|failed',
  startTime: '2023-12-01T10:00:00Z',
  endTime: '2023-12-01T10:05:30Z',
  duration: 330, // seconds
  transferredTo: null,
  notes: 'Customer inquiry about billing'
};
```

### Analytics Calculations

```javascript
const calculateCallMetrics = (callHistory) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysCalls = callHistory.filter(call =>
    new Date(call.startTime) >= today
  );

  const metrics = {
    totalCalls: todaysCalls.length,
    answeredCalls: todaysCalls.filter(call => call.status === 'completed').length,
    missedCalls: todaysCalls.filter(call => call.status === 'missed').length,
    averageDuration: 0,
    totalTalkTime: 0
  };

  const completedCalls = todaysCalls.filter(call => call.status === 'completed');
  if (completedCalls.length > 0) {
    metrics.totalTalkTime = completedCalls.reduce((sum, call) => sum + call.duration, 0);
    metrics.averageDuration = Math.floor(metrics.totalTalkTime / completedCalls.length);
  }

  return metrics;
};
```

## Error Handling and Recovery

### Connection Recovery

```javascript
const handleSocketDisconnection = () => {
  console.log('WebSocket disconnected, attempting recovery...');

  // Save current call state
  const currentCallState = {
    activeCall,
    callState,
    isCallModalOpen
  };

  // Attempt reconnection
  setTimeout(() => {
    reconnectSocket();

    // Restore call state if still valid
    if (currentCallState.activeCall) {
      validateCallState(currentCallState);
    }
  }, 3000);
};

const validateCallState = async (savedState) => {
  // Verify call is still active on server
  try {
    const response = await fetch(`/api/voice/call/${savedState.activeCall.id}`);
    if (response.ok) {
      const callData = await response.json();
      if (callData.status === 'active') {
        // Restore state
        setActiveCall(savedState.activeCall);
        setCallState(savedState.callState);
        setIsCallModalOpen(savedState.isCallModalOpen);
      }
    }
  } catch (error) {
    console.error('Failed to validate call state:', error);
    // Reset to clean state
    setActiveCall(null);
    setCallState('IDLE');
    setIsCallModalOpen(false);
  }
};
```

### Call State Synchronization

```javascript
const syncCallState = async () => {
  try {
    const response = await fetch('/api/voice/status');
    const serverState = await response.json();

    // Compare with local state
    if (serverState.activeCall && !activeCall) {
      // Server has active call, local doesn't
      setActiveCall(serverState.activeCall);
      setCallState('ACTIVE');
      setIsCallModalOpen(true);
    } else if (!serverState.activeCall && activeCall) {
      // Local has active call, server doesn't
      setActiveCall(null);
      setCallState('IDLE');
      setIsCallModalOpen(false);
    }
  } catch (error) {
    console.error('Failed to sync call state:', error);
  }
};

// Periodic state synchronization
useEffect(() => {
  const syncInterval = setInterval(syncCallState, 30000); // Every 30 seconds
  return () => clearInterval(syncInterval);
}, []);
```

## Performance Optimization

### Event Debouncing

```javascript
const debouncedUpdateMetrics = useCallback(
  debounce(() => {
    updateQueueMetrics();
  }, 1000),
  [incomingCalls]
);
```

### Memory Management

```javascript
// Cleanup old call history entries
useEffect(() => {
  const cleanupInterval = setInterval(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    setCallHistory(prev => prev.filter(call =>
      new Date(call.startTime) > thirtyDaysAgo
    ));
  }, 24 * 60 * 60 * 1000); // Daily cleanup

  return () => clearInterval(cleanupInterval);
}, []);
```

This call management system provides a robust foundation for handling real-time voice communications with proper state management, error handling, and performance optimization.