import React, { useState, useEffect } from 'react';
import { Grid, Table, TableHead, TableRow, TableCell, TableBody, Button } from '@mui/material';
import axios from 'axios';
import { useAuth } from './AuthContext'; // Replace with your actual Auth hook
import { useUnreadCount } from './UnreadCount';
import { io } from "socket.io-client";

const MessageQueue = ({ isOpen }) => {
  const { isLoggedIn, username } = useAuth();
  const marginLeft = isOpen ? '240px' : '64px';
  const [queue, setQueue] = useState([]);
  const { setQueueUnreadCount } = useUnreadCount();

  useEffect(() => {
    setQueueUnreadCount(0);

    const fetchUnassignedConversations = async () => {
      try {
        const res = await axios.get(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/conversations/unassignedConversations`);
        setQueue(res.data);
      } catch (error) {
        console.error('Error fetching unassigned conversations:', error);
      }
    };

    // Socket.IO setup
    const socket = io(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}`);

    socket.on("connect", () => {
      console.log('Connected to the server');
    });

    socket.on("NEW_CONVERSATION", (newConversation) => {
      // Assume the message is a new conversation since that's what the server sends on this event
      console.log('New conversation received:', newConversation);
      setQueue((prev) => [...prev, newConversation]);
      setQueueUnreadCount(prevCount => prevCount + 1);
    });

    // Assuming you have a CONVERSATION_ASSIGNED event from the server
    socket.on("CONVERSATION_ASSIGNED", (assignedConversation) => {
      setQueue((prev) => prev.filter((conv) => conv.conversation_id !== assignedConversation.conversation_id));
    });

    fetchUnassignedConversations();

    return () => {
      socket.disconnect();
    };
  }, [setQueueUnreadCount, setQueue]);

  const handleAssignMessage = async (index) => {

    try {
      await axios.post(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/conversations/assignAgent`, {
      conversation_id: queue[index].conversation_id,
      user: username
    });

      setQueue((prevQueue) => prevQueue.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Error assigning message:', error);
    }
  };

  if (!isLoggedIn) {
    return (
      <div style={{ marginTop: '64px', marginLeft }}>
        <h1>Please login to view the message queue.</h1>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '64px', marginLeft }}>
      <h1>Message Queue</h1>
      <hr />
      <Grid container>
        <Grid item xs={12}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Telnyx Phone Number</TableCell>
                <TableCell>End User Phone Number</TableCell>
                <TableCell>Assign Function</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.isArray(queue) && queue.map((msg, index) => (
                <TableRow key={index}>
                  <TableCell>{msg.from_number}</TableCell>
                  <TableCell>{msg.to_number}</TableCell>
                  <TableCell>
                    <Button variant="contained" color="primary" size="small" onClick={() => handleAssignMessage(index)}>
                      Assign to me
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Grid>
      </Grid>
    </div>
  );
};

export default MessageQueue;
