import React, { useState } from 'react';
import {
  Box,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Divider
} from '@mui/material';
import { CallSplit } from '@mui/icons-material';

const TransferControls = ({
  callControlId,
  outboundCCID,
  callerId,
  sipUsername,
  agentNumbers,
  onTransfer,
  disabled = false
}) => {
  const [selectedAgent, setSelectedAgent] = useState('');
  const [loading, setLoading] = useState(false);

  // Warm transfer functionality removed

  const handleTransfer = async () => {
    if (!selectedAgent) {
      alert('Please select an agent to transfer to');
      return;
    }

    setLoading(true);
    try {
      await onTransfer({
        sipUsername: selectedAgent,
        callerId,
        callControlId,
        outboundCCID
      });
      setSelectedAgent('');
    } catch (error) {
      console.error('Transfer failed:', error);
      alert('Transfer failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Warm transfer functionality removed

  // Filter out current agent from transfer options
  const availableAgents = agentNumbers.filter(agent => agent !== sipUsername);

  if (disabled) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Transfer controls available during active calls
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, backgroundColor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
        Call Transfer
      </Typography>

      {/* Agent Selection */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Select Agent</InputLabel>
        <Select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          label="Select Agent"
          disabled={loading}
        >
          {availableAgents.length === 0 ? (
            <MenuItem disabled>No other agents available</MenuItem>
          ) : (
            availableAgents.map((agent) => (
              <MenuItem key={agent} value={agent}>
                {agent}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {/* Transfer Button */}
      <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleTransfer}
          disabled={loading || !selectedAgent}
          startIcon={<CallSplit />}
        >
          {loading ? 'Transferring...' : 'Transfer Call'}
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
        Transfer call to another agent immediately
      </Typography>
    </Box>
  );
};

export default TransferControls;