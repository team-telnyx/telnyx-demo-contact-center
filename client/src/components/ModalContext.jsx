import React, { createContext, useState, useContext, useEffect } from 'react';
import { TelnyxRTCContext, useNotification, useCallbacks, Audio } from '@telnyx/react-client';

export const ModalContext = createContext();

export const ModalProvider = ({ children }) => {
  const client = useContext(TelnyxRTCContext);
  const notification = useNotification();
  const activeCall = notification && notification.call;
  const [clientStatus, setClientStatus] = useState("NOT READY");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [callObject, setCallObject] = useState({});
  const [callState, setCallState] = useState("IDLE");
  const [dialNumber, setDialNumber] = useState('');
  const [callerInfo, setCallerInfo] = useState({});
  const [onHold, setOnHold] = useState(false);
  const [callDirection, setCallDirection] = useState(null);
  const [audioDevices, setAudioDevices] = useState([]);
  const [callControlId, setCallControlId] = useState(null);

  useEffect(() => {
    client.connect();
    const getDevices = async () => {
      let result = await client.getAudioInDevices();
      setAudioDevices(result);
      console.log("Audio devices found:", result);
    };
    getDevices({audio: true});
  }, []);

  const handleDialClick = (digit) => {
    setDialNumber((prevNumber) => prevNumber + digit);
  };

  const handleAnswer = () => {
    if (callObject) {
      callObject.answer();
      setCallState("ACTIVE");
    }
  };

  const handleDecline = () => {
    if (callObject) {
      callObject.hangup();
      setCallState("IDLE");
      setIsModalOpen(false);
    }
  };

  const handleCall = (callerNumber, dialNumber) => {
    try {
      const newCall = client.newCall({ callerNumber: callerNumber, destinationNumber: dialNumber });
      setCallObject(newCall);
      setCallState("DIALING");
    } catch (error) {
      console.error('Error initiating call:', error);
    }
  };
  

  const handleHangUp = () => {
    if (callObject) {
      callObject.hangup();
      setClientStatus("Disconnected");
      console.log("WebRTC client disconnected");
      setIsModalOpen(false);  // Close the modal when the call is hung up
    }
  };

  const handleHold = () => {
    if (activeCall) {
      activeCall.hold();
      setOnHold(true);  
    }
  };

  const handleUnhold = () => {
    if (activeCall) {
      activeCall.unhold();
      setOnHold(false);  
    }
  };

  const handleBackspace = () => {
    setDialNumber((prevDialNumber) => prevDialNumber.slice(0, -1));
  };

  useCallbacks({
    onReady: () => {
        setClientStatus("READY");
        console.log("WebRTC client ready");
      },
      onError: () => {
        setClientStatus("ERROR");
        console.log("WebRTC client registration error");
      },
      onSocketError: () => {
        setClientStatus("ERROR");
        console.log("WebRTC client socket error");
      },
      onSocketClose: () => {
        setClientStatus("ERROR");
        console.log("WebRTC client disconnected");
      },
    onNotification: (message) => {
      console.log('Notification message type:', message.type);
      if (message.type === "callUpdate") {
        const call = message.call;
        console.log(call)
        console.log('Call state:', call.state.toUpperCase());
        setCallDirection(call.direction);
        if (call.state.toUpperCase() === "RINGING") {
          setCallState("INCOMING");
          setCallerInfo({ name: call.options.remoteCallerName, number: call.options.remoteCallerNumber });
          setCallObject(call);
          setIsModalOpen(true);
        } else if (call.state.toUpperCase() === "ACTIVE") {
          setCallState("ACTIVE");
          setCallerInfo({ number: call.options.remoteCallerNumber });
          setCallControlId(call.options.telnyxCallControlId);
          setCallObject(call);
          setIsModalOpen(true);
        } else if (call.state.toUpperCase() === "HANGUP") {
          setCallState("IDLE");
          setIsModalOpen(false);  // Close the modal on hangup
        }
      }
    },
  });

  return (
    <ModalContext.Provider
        value={{ 
          isModalOpen, 
          toggleModal: () => setIsModalOpen(prev => !prev), 
          callState, 
          handleAnswer, 
          handleDecline, 
          handleCall, 
          handleHangUp,
          handleHold,
          handleUnhold,
          onHold,
          handleBackspace,
          handleDialClick,
          dialNumber,
          clientStatus,
          setDialNumber,
          callerInfo,
          callDirection,
          audioDevices,
          callControlId,
        }}
    >
      {activeCall && activeCall.remoteStream && <Audio stream={activeCall.remoteStream} />}  
      {children}
    </ModalContext.Provider>
  );
};
