import React from 'react';
import { Segment, Header, Label, Button, Icon } from 'semantic-ui-react';
import { useCallActions } from '../hooks/useCallActions';

/**
 * Small widget that can be placed on any page to show call status
 * and provide quick access to call functions
 */
const CallStatusWidget = ({ compact = false }) => {
  const {
    activeCall,
    incomingCalls,
    callState,
    clientStatus,
    openModal,
    isCallActive,
    hasIncomingCalls,
    getCallCount,
    canReceiveCalls
  } = useCallActions();

  // Don't render if no relevant call activity and WebRTC not ready
  if (!canReceiveCalls() && !isCallActive() && !hasIncomingCalls()) {
    return null;
  }

  const getStatusColor = () => {
    if (isCallActive()) return 'success';
    if (hasIncomingCalls()) return 'error';
    if (canReceiveCalls()) return 'primary';
    return 'default';
  };

  const getStatusText = () => {
    if (isCallActive()) return `Active: ${activeCall?.from}`;
    if (hasIncomingCalls()) return `${incomingCalls.length} Incoming`;
    if (canReceiveCalls()) return 'Ready for calls';
    return 'Connecting...';
  };

  // Compact version for header/sidebar
  if (compact) {
    return (
      <Button 
        icon
        onClick={() => openModal('queue')}
        color={getStatusColor()}
        size="small"
        style={{ position: 'relative' }}
      >
        <Icon name="phone" />
        {getCallCount() > 0 && (
          <Label
            color="red"
            circular
            size="mini"
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px'
            }}
          >
            {getCallCount()}
          </Label>
        )}
      </Button>
    );
  }

  // Full widget version
  return (
    <Segment 
      style={{ 
        marginBottom: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
      onClick={() => openModal('queue')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Icon 
            name="circle" 
            color={getStatusColor()}
            style={{ marginRight: '8px' }}
          />
          <div>
            <Header as="h5" style={{ margin: 0 }}>
              Phone Status
            </Header>
            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
              {getStatusText()}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isCallActive() && (
            <Label color="green" size="small">
              <Icon name="phone" />
              ACTIVE
            </Label>
          )}
          
          {hasIncomingCalls() && (
            <Label color="red" size="small">
              <Icon name="bell" />
              {incomingCalls.length} INCOMING
            </Label>
          )}

          {!isCallActive() && !hasIncomingCalls() && canReceiveCalls() && (
            <Label color="blue" size="small">
              READY
            </Label>
          )}
        </div>
      </div>

      {/* Quick call info for active calls */}
      {isCallActive() && activeCall && (
        <Segment basic style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f8f8f8' }}>
          <p style={{ margin: 0, fontSize: '11px' }}>
            {activeCall.type?.toUpperCase()} • {activeCall.from} → {activeCall.to}
          </p>
        </Segment>
      )}
    </Segment>
  );
};

export default CallStatusWidget;