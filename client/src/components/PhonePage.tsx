'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCallManager } from '@/contexts/CallManagerContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { getState as getCallStoreState } from '@/lib/call-store';
import {
  Grid,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Typography,
  Box,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import apiService from '@/services/apiService';

interface Agent {
  username: string;
  firstName: string;
  lastName?: string;
  sipUsername: string;
  status: boolean;
}

interface PhonePageProps {
  isOpen: boolean;
}

const PhonePage: React.FC<PhonePageProps> = ({ isOpen }) => {
  const { isLoggedIn, username } = useAuth();
  const [agentQueueData, setAgentQueueData] = useState<Agent[]>([]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');

  // Use queue data from CallManagerContext instead of local polling
  const { incomingCalls: queueData, acceptQueueCall, activeCall, callState } = useCallManager();
  const { setCallQueueUnreadCount } = useUnreadCount();
  const { getCachedAgents } = useDataCache();

  // Check call-store as fallback for active call detection
  const [hasActiveCall, setHasActiveCall] = useState(false);
  const [callStoreState, setCallStoreState] = useState<any>(null);

  useEffect(() => {
    // Poll call-store state to detect active calls
    const checkCallStore = () => {
      const storeState = getCallStoreState();
      setCallStoreState(storeState);

      // Consider a call active if it exists in call-store and has an active status
      // Status can be 'connected', 'ringing', 'dialing', 'holding', 'active' when actually on a call
      const isActive = storeState && storeState.call &&
        (storeState.status === 'connected' ||
         storeState.status === 'ringing' ||
         storeState.status === 'dialing' ||
         storeState.status === 'holding' ||
         storeState.status === 'active');
      setHasActiveCall(isActive);

      console.log('🔍 [PhonePage] Call store state:', storeState);
      console.log('🔍 [PhonePage] Call object:', storeState?.call);
      console.log('🔍 [PhonePage] Call ID from call object:', storeState?.call?.id);
      console.log('🔍 [PhonePage] Has active call (from store):', isActive);
    };

    checkCallStore();
    const interval = setInterval(checkCallStore, 1000); // Check every second

    return () => clearInterval(interval);
  }, []);

  // Debug: Log activeCall state from CallManager
  useEffect(() => {
    console.log('🔍 [PhonePage] activeCall (from CallManager):', activeCall);
    console.log('🔍 [PhonePage] activeCall state:', activeCall?.state);
  }, [activeCall]);

  // Determine if we should show transfer button - check multiple sources
  // 1. CallManager activeCall with state === 'ACTIVE' (uppercase)
  // 2. CallManager callState === 'ACTIVE' (uppercase)
  // 3. call-store hasActiveCall (checks for connected/ringing/dialing/holding)
  const showTransferButton =
    (activeCall && activeCall.state === 'ACTIVE') ||
    callState === 'ACTIVE' ||
    hasActiveCall;

  // Debug logging
  console.log('🔍 [PhonePage] showTransferButton:', showTransferButton);
  console.log('🔍 [PhonePage] activeCall from CallManager:', activeCall);
  console.log('🔍 [PhonePage] callState from CallManager:', callState);
  console.log('🔍 [PhonePage] hasActiveCall from call-store:', hasActiveCall);

  useEffect(() => {
    setCallQueueUnreadCount(0);
  }, [setCallQueueUnreadCount]);

  useEffect(() => {
    // Fetch agent data using cache for faster navigation
    fetchAgentData();
  }, []);

  const fetchAgentData = async () => {
    try {
      const agents = await getCachedAgents();
      const filteredAgents = agents.filter((agent: Agent) => agent.username !== username);
      setAgentQueueData(filteredAgents);
    } catch (error) {
      console.error('Error fetching agent data:', error);
    }
  };

  // Handle accepting next call from queue
  const handleAcceptNextCall = async (event?: React.MouseEvent) => {
    try {
      console.log('🔵 [PhonePage] handleAcceptNextCall STARTED');
      console.log('🔵 [PhonePage] Event object:', event);
      console.log('🔵 [PhonePage] Event target:', event?.target);
      console.log('🔵 [PhonePage] Event type:', event?.type);

      // Prevent any default behavior and stop propagation
      if (event) {
        event.preventDefault();
        event.stopPropagation();
        console.log('🔵 [PhonePage] Event prevented and stopped');
      }

      console.log('🔵 [PhonePage] Calling acceptQueueCall...');
      const result = await acceptQueueCall();
      console.log('🔵 [PhonePage] acceptQueueCall returned:', result);

      if (!result?.success) {
        console.error('🔴 [PhonePage] Failed to accept call:', result?.error);
      } else {
        console.log('✅ [PhonePage] Call accepted successfully');
      }
    } catch (error) {
      console.error('🔴 [PhonePage] Error accepting call:', error);
    }
    console.log('🔵 [PhonePage] handleAcceptNextCall COMPLETED');
  };

  // Handle transfer call to another agent
  const handleTransferSubmit = async (targetAgent: Agent) => {
    if (!targetAgent) {
      setTransferError('Please select an agent');
      return;
    }

    setTransferring(true);
    setTransferError('');
    setTransferSuccess('');

    try {
      console.log('🔄 [PhonePage] Initiating transfer to agent:', targetAgent.sipUsername);
      console.log('🔄 [PhonePage] activeCall from CallManager:', activeCall);
      console.log('🔄 [PhonePage] Call store state:', callStoreState);

      // If activeCall is not available, fetch fresh data from the server
      let callToTransfer = activeCall;
      if (!callToTransfer || !callToTransfer.callControlId) {
        console.log('🔄 [PhonePage] activeCall not available, fetching from server...');
        try {
          const sessionData = await apiService.getMyActiveSession();
          console.log('🔄 [PhonePage] Active session from server:', sessionData);
          console.log('🔄 [PhonePage] Session object:', sessionData?.session);
          console.log('🔄 [PhonePage] Legs array:', sessionData?.legs);

          if (sessionData?.session && sessionData?.legs) {
            // Log all legs to see their statuses
            sessionData.legs.forEach((leg: any, index: number) => {
              console.log(`🔄 [PhonePage] Leg ${index}:`, {
                leg_type: leg.leg_type,
                status: leg.status,
                call_control_id: leg.call_control_id,
                accepted_by: leg.accepted_by
              });
            });

            // Find agent leg - don't filter by status, just by leg_type
            const agentLeg = sessionData.legs.find((l: any) => l.leg_type === 'agent');
            console.log('🔄 [PhonePage] Found agent leg:', agentLeg);

            if (agentLeg) {
              callToTransfer = {
                id: agentLeg.call_control_id,
                type: 'queue',
                from: sessionData.session.from_number || 'Unknown',
                to: sessionData.session.to_number || '',
                timestamp: new Date(sessionData.session.started_at || Date.now()),
                state: 'ACTIVE',
                callControlId: agentLeg.call_control_id,
                customerCallId: sessionData.session.sessionKey,
                bridgeId: sessionData.session.sessionKey,
                direction: 'inbound'
              };
            } else {
              console.error('🔴 [PhonePage] No agent leg found in session legs');
            }
          } else {
            console.error('🔴 [PhonePage] Invalid session data:', {
              hasSession: !!sessionData?.session,
              hasLegs: !!sessionData?.legs,
              sessionData
            });
          }
        } catch (error) {
          console.error('🔴 [PhonePage] Failed to fetch active session:', error);
        }
      }

      if (!callToTransfer || !callToTransfer.callControlId) {
        setTransferError('No active call found to transfer');
        return;
      }

      console.log('🔄 [PhonePage] callToTransfer object:', callToTransfer);
      console.log('🔄 [PhonePage] callControlId being sent:', callToTransfer.callControlId);

      // Build caller ID object from active call
      const callerId = {
        name: callToTransfer.from || 'Unknown',
        number: callToTransfer.from || 'Unknown'
      };

      await apiService.transferCall(
        targetAgent.sipUsername,
        callerId,
        callToTransfer.callControlId,
        undefined // outboundCCID not needed for queue calls
      );

      setTransferSuccess(`Transfer initiated to ${targetAgent.firstName} ${targetAgent.lastName}`);
      setTransferDialogOpen(false);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setTransferSuccess('');
      }, 3000);
    } catch (error: any) {
      console.error('🔴 [PhonePage] Transfer error:', error);
      setTransferError(error.response?.data?.message || error.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Box>
      {/* Success/Error Alerts */}
      {transferSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setTransferSuccess('')}>
          {transferSuccess}
        </Alert>
      )}

      {transferError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setTransferError('')}>
          {transferError}
        </Alert>
      )}

      <Typography
        variant="h3"
        component="h1"
        gutterBottom
        sx={{
          fontWeight: 700,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #00CC83 0%, #00995E 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 4,
        }}
      >
        Queue Management
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card elevation={0}>
            <CardHeader
              title="Call Queue"
              avatar={
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: 'secondary.main',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: (theme) => `0 4px 12px ${theme.palette.secondary.main}40`,
                  }}
                >
                  <ScheduleIcon />
                </Box>
              }
              sx={{
                '& .MuiCardHeader-title': {
                  fontWeight: 600,
                  fontSize: '1.25rem',
                },
              }}
              action={
                Array.isArray(queueData) && queueData.length > 0 && (
                  <Button
                    type="button"
                    variant="contained"
                    color="success"
                    size="medium"
                    onClick={handleAcceptNextCall}
                    startIcon={<PhoneIcon />}
                    sx={{
                      mr: 1,
                      mt: 1,
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 16px rgba(16, 185, 129, 0.4)',
                      },
                    }}
                  >
                    Accept Next Call
                  </Button>
                )
              }
            />
            <CardContent sx={{ p: 0 }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell>Wait Time (s)</TableCell>
                      <TableCell>Position</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(queueData) &&
                      queueData.map((call, index) => {
                        // Calculate wait time from timestamp
                        const waitTime = call.timestamp
                          ? Math.floor((Date.now() - new Date(call.timestamp).getTime()) / 1000)
                          : 0;

                        return (
                          <TableRow key={call.id || index} hover>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {call.from}
                              </Typography>
                            </TableCell>
                            <TableCell>{call.to}</TableCell>
                            <TableCell>
                              <Chip label={`${waitTime}s`} size="small" color={waitTime > 60 ? 'error' : 'default'} />
                            </TableCell>
                            <TableCell>
                              <Chip label={index + 1} size="small" variant="outlined" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {(!Array.isArray(queueData) || queueData.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No calls in queue
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ mt: 3 }}>
            <CardHeader
              title="Agent Dashboard"
              avatar={
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: 'info.main',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: (theme) => `0 4px 12px ${theme.palette.info.main}40`,
                  }}
                >
                  <PersonIcon />
                </Box>
              }
              sx={{
                '& .MuiCardHeader-title': {
                  fontWeight: 600,
                  fontSize: '1.25rem',
                },
              }}
            />
            <CardContent sx={{ p: 0 }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell>First Name</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(agentQueueData) &&
                      agentQueueData.map((agent, index) => (
                        <TableRow key={index} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {agent.username}
                            </Typography>
                          </TableCell>
                          <TableCell>{agent.firstName}</TableCell>
                          <TableCell>
                            <Chip
                              label={agent.status ? 'Available' : 'Busy'}
                              color={agent.status ? 'success' : 'error'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                              {showTransferButton && agent.status && (
                                <Button
                                  variant="outlined"
                                  color="primary"
                                  size="small"
                                  startIcon={<SwapHorizIcon />}
                                  onClick={() => handleTransferSubmit(agent)}
                                  disabled={transferring}
                                  sx={{
                                    '&:hover': {
                                      transform: 'translateY(-2px)',
                                    },
                                  }}
                                >
                                  Transfer
                                </Button>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    {(!Array.isArray(agentQueueData) || agentQueueData.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No agents available
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Transfer Dialog */}
      <Dialog
        open={transferDialogOpen}
        onClose={() => !transferring && setTransferDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SwapHorizIcon color="primary" />
            <Typography variant="h6">Transfer Call</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {(activeCall || callStoreState?.call) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Current Call:
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {activeCall?.from || callStoreState?.fromNumber || 'Unknown'}
              </Typography>
            </Box>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select an available agent to transfer this call:
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {agentQueueData
              .filter(agent => agent.status && agent.username !== username)
              .map((agent) => (
                <Button
                  key={agent.username}
                  variant="outlined"
                  fullWidth
                  onClick={() => handleTransferSubmit(agent)}
                  disabled={transferring}
                  sx={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    py: 2,
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <PersonIcon />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" fontWeight="medium">
                        {agent.firstName} {agent.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        @{agent.username}
                      </Typography>
                    </Box>
                  </Box>
                </Button>
              ))}

            {agentQueueData.filter(agent => agent.status && agent.username !== username).length === 0 && (
              <Alert severity="warning">
                No available agents to transfer to
              </Alert>
            )}
          </Box>

          {transferring && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <CircularProgress size={24} />
              <Typography variant="body2">
                Initiating transfer...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)} disabled={transferring}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PhonePage;
