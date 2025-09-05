import { useState, useEffect, useRef, useCallback } from 'react';
import socketService from '../services/socketService';
import apiService from '../services/apiService';

export const useCallQueue = () => {
  const [queueData, setQueueData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPollingEnabled, setIsPollingEnabled] = useState(true);
  const isPollingEnabledRef = useRef(true);

  // Update ref when state changes
  useEffect(() => {
    isPollingEnabledRef.current = isPollingEnabled;
  }, [isPollingEnabled]);

  const fetchQueueData = useCallback(async () => {
    if (!isPollingEnabledRef.current) {
      console.log('Polling disabled, skipping queue fetch');
      return;
    }

    try {
      setLoading(true);
      const data = await apiService.getQueueData();
      setQueueData(data.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching queue data:', err);
      
      // Check if it's a 404 error indicating queue doesn't exist
      if (err.response?.status === 404) {
        console.log('Queue not found (404), disabling polling until call.initiated');
        setIsPollingEnabled(false);
        isPollingEnabledRef.current = false;
        setError('Queue not available - waiting for call initiation');
        setQueueData([]);
      } else {
        setError(err.message || 'Failed to fetch queue data');
        setQueueData([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initializeSocket = () => {
      socketService.connect();
      
      // Set up event handlers
      const unsubscribeNewCall = socketService.on('NEW_CALL', (data) => {
        console.log('New call received:', data);
        // Re-enable polling when a new call comes in
        setIsPollingEnabled(true);
        isPollingEnabledRef.current = true;
        fetchQueueData();
      });

      const unsubscribeCallAccepted = socketService.on('CALL_ACCEPTED', (data) => {
        console.log('Call accepted:', data);
        fetchQueueData();
      });

      const unsubscribeCallEnded = socketService.on('CALL_ENDED', (data) => {
        console.log('Call ended:', data);
        fetchQueueData();
      });

      // Listen for outbound call initiated events to re-enable polling
      const unsubscribeOutboundCCID = socketService.on('WebRTC_OutboundCCID', (data) => {
        console.log('Outbound call initiated:', data);
        setIsPollingEnabled(true);
        isPollingEnabledRef.current = true;
        fetchQueueData();
      });

      return () => {
        unsubscribeNewCall();
        unsubscribeCallAccepted();
        unsubscribeCallEnded();
        unsubscribeOutboundCCID();
      };
    };

    // Initialize
    initializeSocket();
    fetchQueueData();

    // Refresh queue data every 30 seconds (only when polling is enabled)
    const refreshInterval = setInterval(() => {
      if (isPollingEnabledRef.current) {
        fetchQueueData();
      }
    }, 30000);

    const cleanup = initializeSocket();

    return () => {
      if (cleanup) cleanup();
      clearInterval(refreshInterval);
    };
  }, []);

  const acceptCall = async (call) => {
    try {
      await apiService.acceptCall({
        sipUsername: call.sipUsername, // This should be passed from the component
        callControlId: call.call_control_id,
        callerId: call.from
      });
      
      // Refresh queue data after accepting call
      const data = await apiService.getQueueData();
      setQueueData(data.data || []);
      
      return { success: true };
    } catch (error) {
      console.error('Error accepting call:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    queueData,
    loading,
    error,
    acceptCall,
    refreshQueue: () => {
      fetchQueueData();
    },
    isPollingEnabled
  };
};