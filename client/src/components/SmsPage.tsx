'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Box,
  Typography,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  CircularProgress
} from '@mui/material';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useConversationManager } from '@/contexts/ConversationManagerContext';
import Draggable from 'react-draggable';
import CountryCodeSelector from './CountryCodeSelector';
import { validatePhoneNumberWithCountry, buildPhoneNumber } from '@/utils/phoneValidation';

// TypeScript interfaces
interface Conversation {
  conversation_id: string;
  from_number: string;
  to_number: string;
  last_message?: string;
  isAssigned?: boolean;
  assignedAgent?: string;
}

interface Message {
  id?: string;
  conversation_id: string;
  text_body: string;
  direction: 'inbound' | 'outbound';
  destination_number: string;
  telnyx_number: string;
  isAssigned?: boolean;
  assignedAgent?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface NewMessage {
  to: string;
  body: string;
}

interface SmsPageProps {
  isOpen: boolean;
}

// Use NEXT_PUBLIC_API_URL if available (for production/Workers),
// otherwise construct from HOST/PORT (for local development)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (() => {
  const protocol = (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_HTTPS === 'true') ? 'https' : 'http';
  const port = process.env.NEXT_PUBLIC_API_PORT ? `:${process.env.NEXT_PUBLIC_API_PORT}` : '';
  const host = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
  return `${protocol}://${host}${port}/api`;
})();

const getAgentsWithTag = async (tag: string): Promise<string[]> => {
  try {
    const token = localStorage.getItem('token');

    const response = await axios.get(
      `${API_BASE_URL}/telnyx/phone-numbers`,
      {
        params: {
          tag: tag,
          page: 1,
          size: 20,
        },
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // response.data.data is an array of phone number objects, extract just the phone_number strings
    const phoneNumberObjects = response.data.data || [];
    const agentNumbers: string[] = Array.isArray(phoneNumberObjects)
      ? phoneNumberObjects.map((obj: any) => typeof obj === 'string' ? obj : obj.phone_number)
      : [];
    return agentNumbers;
  } catch (error) {
    console.error('Error fetching agent numbers:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response:', error.response?.data);
    }
    return [];
  }
};

// Draggable Paper component for Dialog
function DraggablePaperComponent(props: any) {
  const nodeRef = useRef(null);
  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".draggable-dialog-title"
      cancel={'[class*="MuiDialogContent-root"]'}
    >
      <Paper ref={nodeRef} {...props} />
    </Draggable>
  );
}

const SmsPage: React.FC<SmsPageProps> = ({ isOpen }) => {
  const { isLoggedIn, username, isLoading: authLoading } = useAuth();
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [agentNumbers, setAgentNumbers] = useState<string[]>([]);
  const [composeAgentNumber, setComposeAgentNumber] = useState<string>('');
  const [newMessage, setNewMessage] = useState<NewMessage>({ to: '', body: '' });
  const [isComposeDialogOpen, setIsComposeDialogOpen] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false); // Loading state for sending messages
  const [composeCountryCode, setComposeCountryCode] = useState<string>('+1'); // Default to US
  const [composeValidationError, setComposeValidationError] = useState<string | null>(null);
  const { setUnreadCount, setQueueUnreadCount } = useUnreadCount();
  const { getCachedAgentNumbers } = useDataCache();
  const { markConversationAsRead, assignedConversations, unassignedConversations, subscribeToNewMessages } = useConversationManager();
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);

  // Use conversations from ConversationManagerContext
  const conversations = assignedConversations.filter(c => c.agent_assigned === username);
  const messageQueue = unassignedConversations;

  // Initialize unread counts
  useEffect(() => {
    setUnreadCount(0);
    setQueueUnreadCount(0);
  }, [setUnreadCount, setQueueUnreadCount]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [conversationMessages]);

  // Conversations are now loaded via WebSocket through ConversationManagerContext
  // The context provides assignedConversations and unassignedConversations
  // which are automatically updated in real-time

  useEffect(() => {
    if (username) {
      const fetchAgentNumbers = async () => {
        const numbers = await getCachedAgentNumbers(username);
        setAgentNumbers(numbers);
        if (numbers.length > 0) setComposeAgentNumber(numbers[0]);
      };
      fetchAgentNumbers();

      // Note: SSE (via ConversationManagerContext) handles loading conversations
      // No need to fetch here - it would conflict with SSE's unread-only filtering
    }
  }, [username, getCachedAgentNumbers]);

  // Subscribe to NEW_MESSAGE events from ConversationManagerContext
  useEffect(() => {
    if (!selectedConversation) return;

    console.log('📡 SmsPage: Subscribing to NEW_MESSAGE events for conversation:', selectedConversation.conversation_id);

    const unsubscribe = subscribeToNewMessages((conversationId, message) => {
      console.log('📨 SmsPage: NEW_MESSAGE event received');
      console.log('📨 Event conversation ID:', conversationId);
      console.log('📨 Selected conversation ID:', selectedConversation.conversation_id);

      // If it's for the currently selected conversation, refresh messages
      if (conversationId === selectedConversation.conversation_id) {
        console.log('🔄 SmsPage: New message for current conversation, refreshing...');
        fetchConversationMessages(selectedConversation.conversation_id);
      }
    });

    return () => {
      console.log('📡 SmsPage: Unsubscribing from NEW_MESSAGE events');
      unsubscribe();
    };
  }, [selectedConversation, subscribeToNewMessages]);

  // Helper function to fetch messages for a conversation
  const fetchConversationMessages = async (conversationId: string) => {
    try {
      const res = await axios.get<Message[]>(
        `${API_BASE_URL}/conversations/conversationMessages/${conversationId}`
      );
      setConversationMessages(res.data);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await fetchConversationMessages(conversation.conversation_id);

    // Mark conversation as read to clear notifications and badge
    await markConversationAsRead(conversation.conversation_id);
  };

  const handleOpenComposeDialog = () => {
    setIsComposeDialogOpen(true);
  };

  const handleCloseComposeDialog = () => {
    setIsComposeDialogOpen(false);
    setNewMessage({ to: '', body: '' });
    setComposeValidationError(null);
  };

  // function to handle new messages
  const handleCompose = async () => {
    if (isSending) return; // Prevent duplicate sends

    // Build full phone number with country code if needed
    let toNumber = newMessage.to.trim();
    if (toNumber && !toNumber.startsWith('+') && !toNumber.includes('sip:')) {
      toNumber = buildPhoneNumber(composeCountryCode, toNumber);
    }

    // Validate phone number with country-specific rules
    const validationError = validatePhoneNumberWithCountry(newMessage.to, composeCountryCode);
    if (validationError) {
      setComposeValidationError(validationError);
      return;
    }

    setComposeValidationError(null);
    setIsSending(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/conversations/composeMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            From: composeAgentNumber,
            Text: newMessage.body,
            To: toNumber, // Use validated phone number
            agentUsername: username, // Include username for auto-assignment
          }),
        }
      );

      // Check if response is ok
      if (!response.ok) {
        console.error('Response not OK:', response.status, response.statusText);
        const text = await response.text();
        console.error('Response text:', text);
        return;
      }

      // Check content type before parsing JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Response is not JSON:', text);
        return;
      }

      const data = await response.json();
      console.log('Message sent:', data);

      // Message will appear via webhook (message.sent) - SSE will detect it
      setNewMessage({ to: '', body: '' });
      handleCloseComposeDialog();
    } catch (error) {
      console.error('Error in handleCompose:', error);
    } finally {
      setIsSending(false);
    }
  };

  //handle replies to existing conversations messages
  const handleReply = async () => {
    if (isSending) return; // Prevent duplicate sends

    // Check if a conversation is selected
    if (selectedConversation) {
      setIsSending(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/conversations/composeMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              From: selectedConversation.to_number,
              Text: newMessage.body,
              To: selectedConversation.from_number,
              agentUsername: username, // Include username for auto-assignment
            }),
          }
        );

        // Check if response is ok
        if (!response.ok) {
          console.error('Response not OK:', response.status, response.statusText);
          const text = await response.text();
          console.error('Response text:', text);
          return;
        }

        // Check content type before parsing JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Response is not JSON:', text);
          return;
        }

        const data = await response.json();
        console.log('Reply sent:', data);

        // Message will appear via webhook (message.sent) - SSE will detect it
        setNewMessage({ to: '', body: '' });
      } catch (error) {
        console.error('Error in handleReply:', error);
      } finally {
        setIsSending(false);
      }
    } else {
      console.error('No conversation selected');
    }
  };

  // Handle assigning message from queue to current agent
  const handleAssignMessage = async (index: number) => {
    try {
      const conversationToAssign = messageQueue[index];

      // First assign the agent
      await axios.post(
        `${API_BASE_URL}/conversations/assignAgent`,
        {
          conversation_id: conversationToAssign.conversation_id,
          user: username,
        }
      );

      // Optimistically show the assigned conversation in the detail pane
      const updatedConversation = {
        ...conversationToAssign,
        agent_assigned: username || '',
        assigned: true,
      };
      setSelectedConversation(updatedConversation);
      await fetchConversationMessages(updatedConversation.conversation_id);
    } catch (error) {
      console.error('Error assigning message:', error);
    }
  };

  if (!isLoggedIn) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <Typography variant="h5" color="text.secondary">
          Please login to access this page.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box>
        {/* DEBUG INFO - REMOVE AFTER TESTING */}
        <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(255, 255, 0, 0.1)', border: '1px solid yellow' }}>
          <Typography variant="body2">
            DEBUG: Auth Loading: {authLoading ? 'YES' : 'NO'} | Username: {username || 'NONE'} |
            Assigned: {assignedConversations.length} | Unassigned: {unassignedConversations.length}
          </Typography>
        </Box>

        <Typography
          variant="h3"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #00E896 0%, #00CC83 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 4,
          }}
        >
          Conversations & Message Queue
        </Typography>

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            height: 'calc(100vh - 200px)',
            overflowX: 'auto',
            minWidth: 'min-content',
          }}
        >
          {/* Message Queue Panel */}
          <Card
            elevation={0}
            sx={{ minWidth: '350px', maxWidth: '350px', display: 'flex', flexDirection: 'column' }}
          >
            <CardHeader
              title="Message Queue"
              sx={{
                '& .MuiCardHeader-title': {
                  fontWeight: 600,
                  fontSize: '1.25rem',
                },
              }}
              action={
                <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
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
                        <Typography variant="body2">{msg.to_number}</Typography>
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
          <Card
            elevation={0}
            sx={{ minWidth: '350px', maxWidth: '350px', display: 'flex', flexDirection: 'column' }}
          >
            <CardHeader
              title="My Conversations"
              sx={{
                '& .MuiCardHeader-title': {
                  fontWeight: 600,
                  fontSize: '1.25rem',
                },
              }}
              action={
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={handleOpenComposeDialog}
                  sx={{
                    boxShadow: '0 4px 12px rgba(0, 232, 150, 0.3)',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 16px rgba(0, 232, 150, 0.4)',
                    },
                  }}
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
                    bgcolor:
                      selectedConversation?.conversation_id === conversation.conversation_id
                        ? 'action.selected'
                        : 'inherit',
                    borderRadius: '12px !important',
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
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2, textAlign: 'center' }}
                >
                  No conversations assigned
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Messages Panel */}
          <Card
            elevation={0}
            sx={{ minWidth: '400px', flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <CardHeader
              title={
                selectedConversation
                  ? `Messages with ${selectedConversation.from_number}`
                  : 'Messages'
              }
              sx={{
                '& .MuiCardHeader-title': {
                  fontWeight: 600,
                  fontSize: '1.25rem',
                },
              }}
            />
            <CardContent sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'background.default' }}>
              {selectedConversation ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Box
                    ref={messagesContainerRef}
                    id="messages-container"
                    sx={{
                      flex: 1,
                      overflow: 'auto',
                      mb: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      py: 2
                    }}
                  >
                    {conversationMessages.map((msg, index) => {
                      const isOutbound = msg.direction === 'outbound';
                      const timestamp = msg.createdAt ? new Date(msg.createdAt) : new Date();
                      const timeString = timestamp.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      });

                      return (
                        <Box
                          key={msg.id || index}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isOutbound ? 'flex-end' : 'flex-start',
                            mb: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              position: 'relative',
                              maxWidth: '70%',
                              px: 2,
                              py: 1.5,
                              borderRadius: isOutbound
                                ? '18px 18px 4px 18px'
                                : '18px 18px 18px 4px',
                              bgcolor: isOutbound
                                ? 'primary.main'  // Telnyx green
                                : 'rgba(255, 255, 255, 0.08)', // Dark gray for inbound
                              color: 'white',
                              boxShadow: isOutbound
                                ? '0 2px 8px rgba(0, 204, 131, 0.3)'
                                : '0 1px 4px rgba(0,0,0,0.3)',
                              wordWrap: 'break-word',
                              wordBreak: 'break-word',
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontSize: '15px',
                                lineHeight: 1.4,
                                whiteSpace: 'pre-wrap'
                              }}
                            >
                              {msg.text_body}
                            </Typography>
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: '11px',
                              color: 'text.secondary',
                              mt: 0.5,
                              px: 0.5
                            }}
                          >
                            {isOutbound ? 'Delivered' : ''} {timeString}
                          </Typography>
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isSending) {
                          handleReply();
                          e.preventDefault();
                        }
                      }}
                      placeholder="Type a message..."
                      multiline
                      maxRows={3}
                      disabled={isSending}
                    />
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleReply}
                      disabled={isSending || !newMessage.body.trim()}
                      sx={{ whiteSpace: 'nowrap', minWidth: '80px' }}
                      startIcon={isSending ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                      {isSending ? 'Sending' : 'Send'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ textAlign: 'center', mt: 4 }}
                >
                  Select a conversation to view messages
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
      <Dialog
        open={isComposeDialogOpen}
        onClose={() => !isSending && handleCloseComposeDialog()}
        maxWidth="sm"
        fullWidth
        hideBackdrop={true} // Remove backdrop so both modals are clearly visible
        disableScrollLock={true} // Prevent scroll locking that might interfere
        disableEnforceFocus={true} // Allow focus on other modals
        disableAutoFocus={false}
        disableRestoreFocus={true}
        PaperComponent={DraggablePaperComponent}
        sx={{
          zIndex: 1300, // Dialog at standard modal level, below Softphone (1400)
          pointerEvents: 'none', // Allow clicks to pass through the entire Dialog root
          '& .MuiDialog-container': {
            alignItems: 'flex-start',
            paddingTop: '15vh', // Position lower to avoid Softphone overlap
            pointerEvents: 'none', // Allow clicks to pass through container
          },
          '& .MuiDialog-paper': {
            marginLeft: 'auto',
            marginRight: '20px', // Position slightly to the right
            pointerEvents: 'auto', // But enable clicks on the dialog itself
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', // Add shadow for depth
            m: 0, // Remove default margins
          }
        }}
      >
        <DialogTitle
          className="draggable-dialog-title"
          sx={{
            cursor: 'move',
            userSelect: 'none',
            bgcolor: 'primary.main',
            color: 'white',
            fontWeight: 600,
          }}
        >
          Compose New Message
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth margin="normal" variant="outlined" disabled={isSending}>
            <InputLabel>From Number</InputLabel>
            <Select
              value={composeAgentNumber}
              onChange={(e: SelectChangeEvent<string>) => setComposeAgentNumber(e.target.value)}
              label="From Number"
            >
              {agentNumbers.map((number, index) => (
                <MenuItem key={index} value={number}>
                  {number}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <CountryCodeSelector
              value={composeCountryCode}
              onChange={setComposeCountryCode}
              size="small"
            />
            <TextField
              autoFocus
              label="To"
              type="text"
              fullWidth
              variant="outlined"
              value={newMessage.to}
              onChange={(e) => {
                setNewMessage({ ...newMessage, to: e.target.value });
                setComposeValidationError(null);
              }}
              placeholder="Phone number or SIP URI"
              disabled={isSending}
              error={!!composeValidationError}
              helperText={composeValidationError}
              size="small"
            />
          </Box>

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
            disabled={isSending}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseComposeDialog} color="primary" disabled={isSending}>
            Cancel
          </Button>
          <Button
            onClick={handleCompose}
            color="primary"
            disabled={isSending || !newMessage.to.trim() || !newMessage.body.trim()}
            startIcon={isSending ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isSending ? 'Sending...' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SmsPage;
