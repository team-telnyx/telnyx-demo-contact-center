const express = require('express');
const router = express.Router();
const callEventEmitter = require('../utils/eventEmitter');
const Voice = require('../models/Voice');
const Conversations = require('../models/Conversations');
const Messages = require('../models/Messages');

// SSE endpoint for messages/conversations events
router.get('/messages', async (req, res) => {
  const username = req.query.username;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Track if connection is closed
  let isClosed = false;

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date() })}\n\n`);

  // Send assigned conversations data
  const sendAssignedConversations = async () => {
    if (isClosed || !username) return;
    try {
      const conversations = await Conversations.findAll({
        where: {
          agent_assigned: username
        },
        order: [['updatedAt', 'DESC']],
      });

      if (!isClosed) {
        res.write(`data: ${JSON.stringify({
          type: 'ASSIGNED_CONVERSATIONS_UPDATE',
          data: conversations
        })}\n\n`);
      }
    } catch (error) {
      if (!isClosed) {
        console.error('Error fetching assigned conversations:', error);
      }
    }
  };

  // Send unassigned conversations data
  const sendUnassignedConversations = async () => {
    if (isClosed) return;
    try {
      const conversations = await Conversations.findAll({
        where: {
          agent_assigned: null
        },
        order: [['updatedAt', 'DESC']],
      });

      if (!isClosed) {
        res.write(`data: ${JSON.stringify({
          type: 'UNASSIGNED_CONVERSATIONS_UPDATE',
          data: conversations
        })}\n\n`);
      }
    } catch (error) {
      if (!isClosed) {
        console.error('Error fetching unassigned conversations:', error);
      }
    }
  };

  // Send initial data
  sendAssignedConversations();
  sendUnassignedConversations();

  // Cleanup function
  const cleanup = () => {
    if (isClosed) return;
    isClosed = true;
    if (intervalId) clearInterval(intervalId);
  };

  // Periodic updates (every 3 seconds)
  const intervalId = setInterval(() => {
    if (!isClosed) {
      sendAssignedConversations();
      sendUnassignedConversations();
    }
  }, 3000);

  // Cleanup on client disconnect
  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});

// SSE endpoint for call events
router.get('/call-events', async (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Track if connection is closed
  let isClosed = false;

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date() })}\n\n`);

  // Send initial queue data
  const sendQueueData = async () => {
    if (isClosed) return; // Don't send if connection is closed
    try {
      const calls = await Voice.findAll({
        where: {
          status: 'queued',
          direction: 'incoming'  // Only show inbound calls in queue
        },
        order: [['createdAt', 'ASC']],
      });

      const incomingCalls = calls.map(call => ({
        id: call.queue_uuid,
        call_control_id: call.queue_uuid,
        from: call.destination_number,
        to: call.telnyx_number,
        direction: call.direction,
        created_at: call.createdAt,
        status: call.status,
      }));

      if (!isClosed) {
        res.write(`data: ${JSON.stringify({
          type: 'QUEUE_UPDATE',
          data: { incomingCalls }
        })}\n\n`);
      }
    } catch (error) {
      if (!isClosed) {
        console.error('Error fetching queue data:', error);
      }
    }
  };

  // Send initial data
  sendQueueData();

  // Listen for new call events
  const handleNewCall = (callData) => {
    if (isClosed) return;
    try {
      res.write(`data: ${JSON.stringify({
        type: 'NEW_CALL',
        data: callData
      })}\n\n`);
      sendQueueData();
    } catch (error) {
      // Connection closed, clean up
      cleanup();
    }
  };

  const handleCallAccepted = (callData) => {
    if (isClosed) return;
    try {
      res.write(`data: ${JSON.stringify({
        type: 'CALL_ACCEPTED',
        data: callData
      })}\n\n`);
      sendQueueData();
    } catch (error) {
      cleanup();
    }
  };

  const handleCallEnded = (callData) => {
    if (isClosed) return;
    try {
      res.write(`data: ${JSON.stringify({
        type: 'CALL_ENDED',
        data: callData
      })}\n\n`);
      sendQueueData();
    } catch (error) {
      cleanup();
    }
  };

  const handleQueueUpdate = () => {
    if (isClosed) return;
    sendQueueData();
  };

  // Cleanup function
  const cleanup = () => {
    if (isClosed) return;
    isClosed = true;
    callEventEmitter.off('NEW_CALL', handleNewCall);
    callEventEmitter.off('CALL_ACCEPTED', handleCallAccepted);
    callEventEmitter.off('CALL_ENDED', handleCallEnded);
    callEventEmitter.off('QUEUE_UPDATE', handleQueueUpdate);
    if (intervalId) clearInterval(intervalId);
  };

  // Register event listeners
  callEventEmitter.on('NEW_CALL', handleNewCall);
  callEventEmitter.on('CALL_ACCEPTED', handleCallAccepted);
  callEventEmitter.on('CALL_ENDED', handleCallEnded);
  callEventEmitter.on('QUEUE_UPDATE', handleQueueUpdate);

  // Periodic queue updates (every 5 seconds as fallback)
  const intervalId = setInterval(() => {
    if (!isClosed) {
      sendQueueData();
    }
  }, 5000);

  // Cleanup on client disconnect
  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});

module.exports = router;
