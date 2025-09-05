import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Box,
  Grid
} from '@mui/material';
import { Person, Phone, Schedule } from '@mui/icons-material';
import apiService from '../../services/apiService';

const AgentDashboard = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const agentData = await apiService.getAgents();
        setAgents(agentData);
      } catch (error) {
        console.error('Error fetching agents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
    
    // Refresh agent status every 30 seconds
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case true:
      case 'available':
        return 'success';
      case false:
      case 'busy':
        return 'error';
      case 'away':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    if (typeof status === 'boolean') {
      return status ? 'Available' : 'Offline';
    }
    return status || 'Unknown';
  };

  const onlineAgents = agents.filter(agent => agent.status === true || agent.status === 'available');
  const totalAgents = agents.length;

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Typography>Loading agent dashboard...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
            Agent Dashboard
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'success.light', borderRadius: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                  {onlineAgents.length}
                </Typography>
                <Typography variant="body2" sx={{ color: 'white' }}>
                  Online
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center', p: 2, backgroundColor: 'grey.400', borderRadius: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                  {totalAgents}
                </Typography>
                <Typography variant="body2" sx={{ color: 'white' }}>
                  Total
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Agent</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Phone</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agents.map((agent, index) => (
                <TableRow key={agent.username || index} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Person sx={{ fontSize: 20, color: 'text.secondary' }} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {agent.firstName} {agent.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{agent.username}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={getStatusLabel(agent.status)}
                      color={getStatusColor(agent.status)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {agent.phoneNumber || 'N/A'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AgentDashboard;