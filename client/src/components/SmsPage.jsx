import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { Card, CardContent, CardHeader, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Table, TableHead, TableRow, TableCell, TableBody, Box, Typography, Paper, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { useUnreadCount } from './UnreadCount';
import './SmsPage.css';
import { io } from "socket.io-client";

const getAgentsWithTag = async (tag) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/telnyx/phone-numbers`, {
      params: {
        tag: tag,
        page: 1,
        size: 20,
      },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const agentNumbers = response.data.data || [];
    return agentNumbers;
  } catch (error) {
    console.error('Error fetching agent numbers:', error);
    console.error('Response:', error.response?.data);
    return [];
  }
};

const SmsPage = ({ isOpen }) => {
  const { isLoggedIn, username } = useAuth();
  const marginLeft = isOpen ? '240px' : '64px';
  const [conversationMessages, setConversationMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [agentNumbers, setAgentNumbers] = useState([]);
  const [composeAgentNumber, setComposeAgentNumber] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isComposeDialogOpen, setIsComposeDialogOpen] = useState(false);
  const [messageQueue, setMessageQueue] = useState([]);
  const { setUnreadCount, setQueueUnreadCount } = useUnreadCount();

  useEffect(() => {
    setUnreadCount(0);
    setQueueUnreadCount(0);
    const socket = io(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}`);

    socket.on("connect", () => {
        console.log('SmsPage: Connected to websocket server');
        console.log('SmsPage: Socket ID:', socket.id);
    });

    socket.on("NEW_MESSAGE", (msg) => {
        if (selectedConversation && msg.conversation_id === selectedConversation.conversation_id) {
            setConversationMessages(prev => [...prev, msg]);
        }
        setConversations(prevConversations => {
            return prevConversations.map(conv => {
                if (conv.conversation_id === msg.conversation_id) {
                    return {
                        ...conv,
                        last_message: msg.text_body
                    };
                }
                return conv;
            });
        });

        // If message is unassigned, add conversation to message queue if not already there
        console.log('Message isAssigned:', msg.isAssigned, 'assignedAgent:', msg.assignedAgent);
        if (!msg.isAssigned) {
            console.log('Adding unassigned message to queue');
            setMessageQueue(prevQueue => {
                const existsInQueue = prevQueue.some(conv => conv.conversation_id === msg.conversation_id);
                console.log('Exists in queue:', existsInQueue, 'Queue length:', prevQueue.length);
                if (!existsInQueue) {
                    // Fetch the conversation details and add to queue
                    const newConversation = {
                        conversation_id: msg.conversation_id,
                        from_number: msg.destination_number,
                        to_number: msg.telnyx_number,
                        last_message: msg.text_body
                    };
                    console.log('Adding new conversation to queue:', newConversation);
                    return [...prevQueue, newConversation];
                } else {
                    // Update existing conversation in queue
                    console.log('Updating existing conversation in queue');
                    return prevQueue.map(conv =>
                        conv.conversation_id === msg.conversation_id
                            ? { ...conv, last_message: msg.text_body }
                            : conv
                    );
                }
            });
        } else {
            console.log('Message is assigned, not adding to queue');
        }

        console.log("SmsPage: NEW_MESSAGE received:", msg);
    });

    socket.on("NEW_CONVERSATION", (newConversation) => {
      console.log('SmsPage: NEW_CONVERSATION received:', newConversation);
      setMessageQueue((prev) => {
        console.log('SmsPage: Adding to message queue, current queue size:', prev.length);
        return [...prev, newConversation];
      });
    });

    socket.on("CONVERSATION_ASSIGNED", (assignedConversation) => {
      setConversations(prevConversations =>
          prevConversations.filter(conv => conv.conversation_id !== assignedConversation.conversation_id)
      );
      setMessageQueue((prev) => prev.filter((conv) => conv.conversation_id !== assignedConversation.conversation_id));
    });

    socket.on("disconnect", () => {
        console.log('Disconnected from the server');
    });

    return () => socket.disconnect();
}, [selectedConversation, setUnreadCount, setQueueUnreadCount, username]);


  useEffect(() => {
    if (username) {
      const fetchAgentNumbers = async () => {
        const numbers = await getAgentsWithTag(username);
        setAgentNumbers(numbers);
        if (numbers.length > 0) setComposeAgentNumber(numbers[0]);
      };
      fetchAgentNumbers();

      // Fetch conversations directly without relying on globalConversations
      const fetchAssignedConversations = async () => {
        try {
          const res = await axios.get(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/conversations/assignedTo/${username}`);
          setConversations(res.data);
        } catch (err) {
          console.error('Error fetching conversations:', err);
        }
      };

      // Fetch unassigned conversations for message queue
      const fetchUnassignedConversations = async () => {
        try {
          console.log('Fetching unassigned conversations...');
          const res = await axios.get(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/conversations/unassignedConversations`);
          console.log('Unassigned conversations response:', res.data);
          setMessageQueue(res.data);
        } catch (error) {
          console.error('Error fetching unassigned conversations:', error);
          console.error('Error details:', error.response?.data);
        }
      };

      fetchAssignedConversations();
      fetchUnassignedConversations();
    }
  }, [username]);

  const selectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    try {
      const res = await axios.get(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/conversations/conversationMessages/${conversation.conversation_id}`);
      setConversationMessages(res.data);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const handleOpenComposeDialog = () => {
    setIsComposeDialogOpen(true);
  };

  const handleCloseComposeDialog = () => {
    setIsComposeDialogOpen(false);
    setNewMessage({ to: '', body: '' });
  };  
  
  // function to handle new messages 
  const handleCompose = () => {
    // Perform the API call to send the message here
    fetch(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/conversations/composeMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: composeAgentNumber,
        Text: newMessage.body,
        To: newMessage.to,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log('Message sent:', data);
        setNewMessage({ to: '', body: '' });
      })
      .catch((error) => {
        console.error('Error:', error);
      });
      handleCloseComposeDialog();
  };

  //handle replies to existing conversations messages
  const handleReply = () => {
    // Check if a conversation is selected
    if (selectedConversation) {
      // Perform the API call to send the message here
      fetch(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/conversations/composeMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          From: selectedConversation.from_number,  
          Text: newMessage.body,
          To: selectedConversation.to_number, 
        }),
      })
      .then((response) => response.json())
      .then((data) => {
        console.log('Reply sent:', data);
        setNewMessage({ to: '', body: '' });
      })
      .catch((error) => {
        console.error('Error:', error);
      });
    } else {
      console.error("No conversation selected");
    }
  };

  // Handle assigning message from queue to current agent
  const handleAssignMessage = async (index) => {
    try {
      await axios.post(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/conversations/assignAgent`, {
        conversation_id: messageQueue[index].conversation_id,
        user: username
      });
      
      // Remove from queue and add to conversations
      const assignedConversation = messageQueue[index];
      setMessageQueue((prevQueue) => prevQueue.filter((_, i) => i !== index));
      setConversations(prevConversations => [...prevConversations, assignedConversation]);
    } catch (error) {
      console.error('Error assigning message:', error);
    }
  };
  if (!isLoggedIn) {
    return (
      <div style={{ marginTop: '64px', marginLeft }}>
        <h1>Please login to access this page.</h1>
      </div>
    );
  }
  
  return (
    <>
      <Box sx={{ mt: 8, ml: marginLeft, p: 3 }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          Conversations & Message Queue
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          height: 'calc(100vh - 200px)',
          overflowX: 'auto',
          minWidth: 'min-content'
        }}>
          
          {/* Message Queue Panel */}
          <Card elevation={2} sx={{ minWidth: '350px', maxWidth: '350px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader 
              title="Message Queue"
              sx={{ 
                bgcolor: 'primary.main', 
                color: 'primary.contrastText',
                '& .MuiCardHeader-title': { fontWeight: 600 },
                m: 0
              }}
              action={
                <Typography variant="body2" sx={{ color: 'inherit' }}>
                  {messageQueue.length} unassigned
                </Typography>
              }
            />
            <CardContent sx={{ p: 0, flex: 1, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {messageQueue.map((msg, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {msg.from_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {msg.to_number}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button 
                          variant="contained" 
                          color="primary" 
                          size="small" 
                          onClick={() => handleAssignMessage(index)}
                          sx={{ fontSize: '0.75rem' }}
                        >
                          Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {messageQueue.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No unassigned messages
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Conversations Panel */}
          <Card elevation={2} sx={{ minWidth: '350px', maxWidth: '350px', display: 'flex', flexDirection: 'column' }}>
            <CardHeader 
              title="My Conversations"
              sx={{ 
                bgcolor: 'secondary.main', 
                color: 'secondary.contrastText',
                '& .MuiCardHeader-title': { fontWeight: 600 },
                m: 0
              }}
              action={
                <Button 
                  variant="contained" 
                  color="primary" 
                  size="small"
                  onClick={handleOpenComposeDialog}
                >
                  Compose
                </Button>
              }
            />
            <CardContent sx={{ flex: 1, overflow: 'auto', p: 1 }}>
              {conversations.map((conversation, index) => (
                <Card 
                  key={index} 
                  variant="outlined" 
                  sx={{ 
                    mb: 1, 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    bgcolor: selectedConversation?.conversation_id === conversation.conversation_id ? 'action.selected' : 'inherit',
                    borderRadius: '12px !important'
                  }}
                  onClick={() => selectConversation(conversation)}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {conversation.from_number}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {conversation.last_message || 'No messages yet'}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
              {conversations.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                  No conversations assigned
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Messages Panel */}
          <Card elevation={2} sx={{ minWidth: '400px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <CardHeader 
              title={selectedConversation ? `Messages with ${selectedConversation.from_number}` : 'Messages'}
              sx={{ 
                bgcolor: 'info.main', 
                color: 'info.contrastText',
                '& .MuiCardHeader-title': { fontWeight: 600 },
                m: 0
              }}
            />
            <CardContent sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {selectedConversation ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
                    {conversationMessages.map((msg, index) => {
                      const isOutbound = msg.direction === "outbound";
                      return (
                        <Box
                          key={index}
                          sx={{
                            display: 'flex',
                            justifyContent: isOutbound ? 'flex-end' : 'flex-start',
                            mb: 1
                          }}
                        >
                          <Paper
                            elevation={1}
                            sx={{
                              p: 1.5,
                              maxWidth: '70%',
                              bgcolor: isOutbound ? 'primary.main' : 'grey.100',
                              color: isOutbound ? 'primary.contrastText' : 'text.primary',
                              borderRadius: '16px !important'
                            }}
                          >
                            <Typography variant="body2">
                              {msg.text_body}
                            </Typography>
                          </Paper>
                        </Box>
                      );
                    })}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      value={newMessage.body}
                      onChange={(e) => setNewMessage({ ...newMessage, body: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { handleReply(); e.preventDefault(); } }}
                      placeholder="Type a message..."
                      multiline
                      maxRows={3}
                    />
                    <Button 
                      variant="contained" 
                      color="primary" 
                      onClick={handleReply}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Send
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                  Select a conversation to view messages
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
      <Dialog open={isComposeDialogOpen} onClose={handleCloseComposeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Compose New Message</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth margin="normal" variant="outlined">
            <InputLabel>From Number</InputLabel>
            <Select
              value={composeAgentNumber}
              onChange={(e) => setComposeAgentNumber(e.target.value)}
              label="From Number"
            >
              {agentNumbers.map((number, index) => (
                <MenuItem key={index} value={number}>
                  {number}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <TextField
            autoFocus
            margin="normal"
            label="To"
            type="text"
            fullWidth
            variant="outlined"
            value={newMessage.to}
            onChange={(e) => setNewMessage({ ...newMessage, to: e.target.value })}
            placeholder="+1234567890"
          />
          
          <TextField
            margin="normal"
            label="Message Body"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={newMessage.body}
            onChange={(e) => setNewMessage({ ...newMessage, body: e.target.value })}
            placeholder="Type your message here..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseComposeDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleCompose} color="primary">
            Send
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SmsPage;
