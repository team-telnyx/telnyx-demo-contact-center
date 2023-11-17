import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { Card, CardContent, CardHeader, Button, Dialog, DialogTitle, DialogContent, DialogActions, FormLabel, TextField } from '@mui/material';
import { useUnreadCount } from './UnreadCount';
import './SmsPage.css';
import { io } from "socket.io-client";

const telnyxApiKey = process.env.REACT_APP_TELNYX_API_KEY; 
const getAgentsWithTag = async (tag) => {
  try {
    const response = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      params: {
        'page[number]': 1,
        'page[size]': 20,
        'filter[tag]': tag,
      },
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`,
      },
    });

    const phoneNumbers = response.data.data;
    const agentNumbers = phoneNumbers.map((phoneNumber) => phoneNumber.phone_number);
    return agentNumbers;
  } catch (error) {
    console.error('Error fetching agent numbers:', error);
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
  const { setUnreadCount } = useUnreadCount();

  useEffect(() => {
    setUnreadCount(0);
    const socket = io("https://osbs.ca:3000");

    socket.on("connect", () => {
        console.log('Connected to the server');
    });

    socket.on("NEW_MESSAGE", (msg) => {
        if (selectedConversation && msg.conversation_id === selectedConversation.conversation_id) {
            setConversationMessages(prev => [...prev, msg]);
        }
        setConversations(prevConversations => {
            return prevConversations.map(conv => {
                if (conv.conversation_id === msg.conversation_id) {
                  if (msg.isAssigned && msg.assignedAgent === username) {
                    return {
                        ...conv,
                        last_message: msg.text_body 
                    };
                }}
                return conv;
            });
        });
        console.log("New message received:", msg);
    });

    socket.on("CONVERSATION_ASSIGNED", (assignedConversation) => {
      setConversations(prevConversations =>
          prevConversations.filter(conv => conv.conversation_id !== assignedConversation.conversation_id)
      );
  });
  

    socket.on("disconnect", () => {
        console.log('Disconnected from the server');
    });

    return () => socket.disconnect();
}, [selectedConversation, conversationMessages, setUnreadCount, setConversations, setConversationMessages]);


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
          const res = await axios.get(`https://osbs.ca:3000/api/conversations/assignedTo/${username}`);
          setConversations(res.data);
        } catch (err) {
          console.error('Error fetching conversations:', err);
        }
      };
      fetchAssignedConversations();
    }
  }, [username]);

  const selectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    try {
      const res = await axios.get(`https://osbs.ca:3000/api/conversations/conversationMessages/${conversation.conversation_id}`);
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
  
  const agentNumberOptions = agentNumbers.map((number, index) => (
    <option key={index} value={number}>
      {number}
    </option>
  ));
  // function to handle new messages 
  const handleCompose = () => {
    // Perform the API call to send the message here
    fetch('https://osbs.ca:3000/api/conversations/composeMessage', {
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
      fetch('https://osbs.ca:3000/api/conversations/composeMessage', {
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
  if (!isLoggedIn) {
    return (
      <div style={{ marginTop: '64px', marginLeft }}>
        <h1>Please login to access this page.</h1>
      </div>
    );
  }
  
  return (
    <div style={{ marginTop: '64px', marginLeft }}>
    <h1>Conversations</h1>
    <hr />
    <div className="smsPage">
      <div className="smsColumns">
        <div className="leftColumn">
        <Card>
        <CardHeader 
            title="Conversations"
            style={{backgroundColor: "black"}} 
            action={
                <Button variant="contained" color="primary" onClick={handleOpenComposeDialog}>
                    Compose
                </Button>
            }
        />
        <CardContent>
            <div className="conversationList">
                {conversations.map((conversation, index) => (
                    <Card key={index} variant="outlined" className="conversationCard">
                        <CardContent onClick={() => selectConversation(conversation)}>
                            <div>
                                {conversation.from_number}:
                                <div className="last-message">{conversation.last_message}</div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </CardContent>
    </Card>
        </div>
        <div className="rightColumn">
          <Card>
            <CardHeader style={{backgroundColor: "black"}} title="Messages" />
            <CardContent>
              {selectedConversation ? (
                <>
                  <ul className="messageList">
                    {conversationMessages.map((msg, index) => {
                      const isOutbound = msg.direction === "outbound"; // Replace with your logic
                      const messageClass = isOutbound ? "sent" : "received";
                      const status = isOutbound ? "Sent" : "Delivered"; // Replace with your actual status
                      const hoverInfo = `Number: ${isOutbound ? msg.telnyx_number : msg.destination_number}, Status: ${status}`;

                      return (
                        <li
                          key={index}
                          className={`messageItem ${messageClass}`}
                          title={hoverInfo} 
                        >
                          {msg.text_body}
                        </li>
                      );
                    })}
                  </ul>
                  <Card>
                  <div className="inputField">
                    <TextField
                      fullWidth
                      variant="outlined"
                      value={newMessage.body}
                      onChange={(e) => setNewMessage({ ...newMessage, body: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') { handleReply(); e.preventDefault(); } }}
                        placeholder="Type a message..."
                    />
                    <Button variant="contained" color="primary" onClick={handleReply}>Send</Button>
                  </div>
                </Card>
                </>
              ) : (
                <p>Select a conversation to view messages.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
      <Dialog open={isComposeDialogOpen} onClose={handleCloseComposeDialog}>
        <DialogTitle>Compose New Message</DialogTitle>
        <DialogContent>
        <select
          value={composeAgentNumber}
          onChange={(e) => setComposeAgentNumber(e.target.value)}
        >
          {agentNumberOptions}
        </select>
        <br></br>
          <FormLabel htmlFor="To" style={{ color: '#00a37a' }}>To:</FormLabel>
          <TextField
            autoFocus
            margin="dense"
            type="text"
            fullWidth
            value={newMessage.to}
            onChange={(e) => setNewMessage({ ...newMessage, to: e.target.value })}
            
          />
          <FormLabel htmlFor="Message Body" style={{ color: '#00a37a' }}>Message Body:</FormLabel>
          <TextField
            margin="dense"
            type="text"
            fullWidth
            value={newMessage.body}
            onChange={(e) => setNewMessage({ ...newMessage, body: e.target.value })}
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
    </div>
  );
};

export default SmsPage;
