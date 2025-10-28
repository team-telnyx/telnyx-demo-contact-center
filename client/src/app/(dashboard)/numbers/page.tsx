'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Phone as PhoneIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import apiService from '@/services/apiService';

interface PhoneNumber {
  id: string;
  phone_number: string;
  status: string;
  tags: string[];
  connection_name?: string;
}

interface Agent {
  username: string;
  sipUsername: string;
  firstName: string;
  lastName: string;
}

const NumberManagementPage: React.FC = () => {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [numbersResponse, agentsResponse] = await Promise.all([
        apiService.getAllPhoneNumbers(),
        apiService.getAgents()
      ]);

      setPhoneNumbers(numbersResponse.data || []);
      setAgents(agentsResponse || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.response?.data?.message || error.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssignClick = (number: PhoneNumber) => {
    setSelectedNumber(number);
    setSelectedAgent(null);
    setAssignDialogOpen(true);
  };

  const handleAssignSubmit = async () => {
    if (!selectedNumber || !selectedAgent) {
      setError('Please select both a number and an agent');
      return;
    }

    try {
      await apiService.assignNumber(
        selectedNumber.id,
        selectedAgent.sipUsername,
        selectedNumber.phone_number
      );

      setSuccess(`Successfully assigned ${selectedNumber.phone_number} to ${selectedAgent.firstName} ${selectedAgent.lastName}`);
      setAssignDialogOpen(false);
      setSelectedNumber(null);
      setSelectedAgent(null);

      // Refresh data
      fetchData();
    } catch (error: any) {
      console.error('Error assigning number:', error);
      setError(error.response?.data?.message || error.message || 'Failed to assign number');
    }
  };

  const handleUnassign = async (number: PhoneNumber) => {
    if (!confirm(`Are you sure you want to unassign ${number.phone_number}?`)) {
      return;
    }

    try {
      await apiService.unassignNumber(number.id, number.phone_number);
      setSuccess(`Successfully unassigned ${number.phone_number}`);

      // Refresh data
      fetchData();
    } catch (error: any) {
      console.error('Error unassigning number:', error);
      setError(error.response?.data?.message || error.message || 'Failed to unassign number');
    }
  };

  const isAssigned = (number: PhoneNumber) => {
    return number.tags && number.tags.length > 0;
  };

  const getAssignedAgent = (number: PhoneNumber) => {
    if (!isAssigned(number)) return null;
    const sipUsername = number.tags[0];
    return agents.find(agent => agent.sipUsername === sipUsername);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <PhoneIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight="bold">
            Phone Number Management
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchData} disabled={isLoading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper elevation={2}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Phone Number</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Assigned To</strong></TableCell>
                  <TableCell><strong>Connection</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {phoneNumbers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No phone numbers found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  phoneNumbers.map((number) => {
                    const agent = getAssignedAgent(number);
                    const assigned = isAssigned(number);

                    return (
                      <TableRow key={number.id} hover>
                        <TableCell>
                          <Typography variant="body1" fontWeight="medium">
                            {number.phone_number}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={number.status}
                            size="small"
                            color={number.status === 'active' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          {assigned && agent ? (
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {agent.firstName} {agent.lastName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                @{agent.username}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Unassigned
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {number.connection_name || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {assigned ? (
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<PersonRemoveIcon />}
                              onClick={() => handleUnassign(number)}
                            >
                              Unassign
                            </Button>
                          ) : (
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<PersonAddIcon />}
                              onClick={() => handleAssignClick(number)}
                            >
                              Assign
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Assign Dialog */}
      <Dialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Assign Phone Number
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Assign <strong>{selectedNumber?.phone_number}</strong> to an agent
            </Typography>

            <Autocomplete
              options={agents}
              getOptionLabel={(agent) => `${agent.firstName} ${agent.lastName} (@${agent.username})`}
              value={selectedAgent}
              onChange={(_, newValue) => setSelectedAgent(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Agent"
                  variant="outlined"
                  fullWidth
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssignSubmit}
            variant="contained"
            disabled={!selectedAgent}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NumberManagementPage;
