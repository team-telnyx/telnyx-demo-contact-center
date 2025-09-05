import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  Box,
  Typography,
  Chip
} from '@mui/material';
import { Phone, Schedule } from '@mui/icons-material';

const QueueTable = ({ queueData, onAcceptCall, sipUsername }) => {
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getWaitTimeColor = (waitTime) => {
    if (waitTime < 30) return 'success';
    if (waitTime < 60) return 'warning';
    return 'error';
  };

  if (!queueData || queueData.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 4,
          backgroundColor: 'background.paper',
          borderRadius: 2,
          boxShadow: 1
        }}
      >
        <Schedule sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          No calls in queue
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Incoming calls will appear here
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Call Queue ({queueData.length})
        </Typography>
      </Box>
      
      <Table>
        <TableHead>
          <TableRow>
            <TableCell><strong>Caller</strong></TableCell>
            <TableCell><strong>Wait Time</strong></TableCell>
            <TableCell><strong>Queue</strong></TableCell>
            <TableCell align="center"><strong>Action</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {queueData.map((call, index) => (
            <TableRow 
              key={call.call_control_id || index}
              hover
              sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
            >
              <TableCell>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                    {call.from || 'Unknown'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {call.call_control_id?.substring(0, 8)}...
                  </Typography>
                </Box>
              </TableCell>
              
              <TableCell>
                <Chip
                  icon={<Schedule />}
                  label={formatDuration(call.queue_time_secs || 0)}
                  color={getWaitTimeColor(call.queue_time_secs || 0)}
                  variant="outlined"
                  size="small"
                />
              </TableCell>
              
              <TableCell>
                <Typography variant="body2">
                  {call.queue_name || 'General Queue'}
                </Typography>
              </TableCell>
              
              <TableCell align="center">
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<Phone />}
                  onClick={() => onAcceptCall(call)}
                  sx={{ minWidth: 100 }}
                >
                  Accept
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

export default QueueTable;