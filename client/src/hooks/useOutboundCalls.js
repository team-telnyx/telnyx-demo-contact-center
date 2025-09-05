import { useState, useEffect } from 'react';
import socketService from '../services/socketService';

export const useOutboundCalls = () => {
  const [outboundCCID, setOutboundCCID] = useState(null);
  const [webrtcOutboundCCID, setWebrtcOutboundCCID] = useState(null);

  useEffect(() => {
    socketService.connect();
    
    const unsubscribeOutbound = socketService.on('OutboundCCID', (data) => {
      console.log('OutboundCCID received:', data);
      setOutboundCCID(data);
    });

    const unsubscribeWebRTC = socketService.on('WebRTC_OutboundCCID', (data) => {
      console.log('WebRTC_OutboundCCID received:', data);
      setWebrtcOutboundCCID(data);
    });

    const unsubscribeWarmConnected = socketService.on('WARM_TRANSFER_CONNECTED', (data) => {
      console.log('Warm transfer connected:', data);
    });

    const unsubscribeWarmEnded = socketService.on('WARM_TRANSFER_ENDED', (data) => {
      console.log('Warm transfer ended:', data);
    });

    const unsubscribeWarmCompleted = socketService.on('WARM_TRANSFER_COMPLETED', (data) => {
      console.log('Warm transfer completed:', data);
      // Update call control IDs if needed
      if (data.originalAgentId === outboundCCID) {
        setOutboundCCID(null);
      }
      if (data.originalAgentId === webrtcOutboundCCID) {
        setWebrtcOutboundCCID(null);
      }
    });

    return () => {
      unsubscribeOutbound();
      unsubscribeWebRTC();
      unsubscribeWarmConnected();
      unsubscribeWarmEnded();
      unsubscribeWarmCompleted();
    };
  }, [outboundCCID, webrtcOutboundCCID]);

  return {
    outboundCCID,
    webrtcOutboundCCID,
    setOutboundCCID,
    setWebrtcOutboundCCID
  };
};