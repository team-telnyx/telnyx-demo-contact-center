import React, { useContext } from 'react';
import ReactDOM from 'react-dom';
import { Button, Header, Icon } from 'semantic-ui-react';
import Draggable from 'react-draggable';
import { ModalContext } from './ModalContext';

const CustomModal = () => {
  const { isModalOpen, callState, handleAnswer, handleDecline, handleHangUp, callerInfo, callDirection } = useContext(ModalContext);

  const overlay = (
    <div style={{
      position: 'fixed',
      top: '64px',
      right: '0',
      zIndex: 1000,
      pointerEvents: 'none',  // This line allows clicks to pass through to underlying elements
    }}>
      <Draggable handle=".draggableHeader">
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '16px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          pointerEvents: 'auto',  // This line enables interaction with the overlay contents
        }}>
          <div 
            className="draggableHeader" 
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              cursor: 'move'
            }}
          >
            <Header as='h3' style={{ color: 'white' }}>
              {callDirection === 'outbound' ? 'Outgoing Call' : 'Incoming Call'}
            </Header>
            <Icon name='close' style={{ cursor: 'pointer', color: 'white' }} onClick={() => handleHangUp()} />
          </div>
          <div style={{ margin: '16px 0' }}>
            <Header as='h4' style={{ color: 'white' }}>
              {callDirection === 'outbound'
                ? <>Calling: {callerInfo.number}</>
                : <>Name: {callerInfo.name || "Unknown"}<br />Number: {callerInfo.number}</>}
            </Header>
          </div>
          <div>
            {callState === "INCOMING" && (
              <>
                <Button color='green' onClick={handleAnswer}>
                  Answer
                </Button>
                <Button color='red' onClick={handleDecline} style={{ marginLeft: '10px' }}>
                  Decline
                </Button>
              </>
            )}
            {callState === "ACTIVE" && (
              <Button color='red' onClick={handleHangUp}>
                Hang Up
              </Button>
            )}
          </div>
        </div>
      </Draggable>
    </div>
  );

  return isModalOpen ? ReactDOM.createPortal(overlay, document.body) : null;
};

export default CustomModal;
