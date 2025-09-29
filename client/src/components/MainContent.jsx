import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Avatar,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Phone as PhoneIcon,
  Message as MessageIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from './AuthContext';
import apiService from '../services/apiService';
import { io } from "socket.io-client";

const MainContent = ({ isOpen }) => {
  const { isLoggedIn, username } = useAuth();
  const marginLeft = isOpen ? '240px' : '64px';

  const [dashboardMetrics, setDashboardMetrics] = useState({
    activeCalls: 0,
    queuedMessages: 0,
    availableAgents: 0,
    avgResponseTime: '0s'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isLoggedIn) {
      fetchDashboardMetrics();

      // Set up real-time updates via socket
      const socket = io(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}`);

      socket.on("connect", () => {
        console.log('Dashboard connected to socket');
      });

      // Listen for events that should trigger a metrics refresh
      socket.on("NEW_CALL", () => {
        fetchDashboardMetrics();
      });

      socket.on("CALL_ENDED", () => {
        fetchDashboardMetrics();
      });

      // Event-driven metric updates
      socket.on("NEW_MESSAGE", () => {
        fetchDashboardMetrics();
      });

      socket.on("AGENT_STATUS_UPDATED", () => {
        fetchDashboardMetrics();
      });

      // Listen for call events to update metrics
      socket.on("NEW_CALL", () => {
        fetchDashboardMetrics();
      });

      socket.on("CALL_HANGUP", () => {
        fetchDashboardMetrics();
      });

      socket.on("CALL_ACCEPTED", () => {
        fetchDashboardMetrics();
      });

      // Reduced polling frequency - most updates are now event-driven
      const refreshInterval = setInterval(() => {
        fetchDashboardMetrics();
      }, 120000); // Every 2 minutes instead of 30 seconds

      return () => {
        socket.disconnect();
        clearInterval(refreshInterval);
      };
    }
  }, [isLoggedIn]);

  const fetchDashboardMetrics = async () => {
    try {
      setLoading(true);
      const metrics = await apiService.getDashboardMetrics();
      setDashboardMetrics(metrics);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <Box sx={{ mt: 8, ml: marginLeft, p: 3 }}>
        <Alert severity="warning" sx={{ maxWidth: 400 }}>
          Please log in to access this page.
        </Alert>
      </Box>
    );
  }

  const dashboardStats = [
    { title: 'Your Active Calls', value: dashboardMetrics.activeCalls.toString(), icon: PhoneIcon, color: 'primary' },
    { title: 'Assigned Messages', value: dashboardMetrics.queuedMessages.toString(), icon: MessageIcon, color: 'info' },
    { title: 'Available Agents', value: dashboardMetrics.availableAgents.toString(), icon: PersonIcon, color: 'success' },
    { title: 'Avg Response Time', value: dashboardMetrics.avgResponseTime, icon: ScheduleIcon, color: 'warning' }
  ];

  const recentActivity = [
    { action: 'Call answered', time: '2 minutes ago', icon: PhoneIcon },
    { action: 'Message processed', time: '5 minutes ago', icon: MessageIcon },
    { action: 'Agent status updated', time: '10 minutes ago', icon: PersonIcon },
    { action: 'Call transferred', time: '15 minutes ago', icon: CheckCircleIcon }
  ];

  return (
    <Box sx={{ mt: 8, ml: marginLeft, p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 600 }}>
          Agent Dashboard
        </Typography>
        <Tooltip title="Refresh Dashboard Data">
          <IconButton onClick={fetchDashboardMetrics} disabled={loading} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {dashboardStats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card elevation={2}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Avatar
                  sx={{
                    bgcolor: `${stat.color}.light`,
                    color: `${stat.color}.main`,
                    mx: 'auto',
                    mb: 2,
                    width: 56,
                    height: 56
                  }}
                >
                  <stat.icon fontSize="large" />
                </Avatar>
                <Typography variant="h4" component="div" sx={{ fontWeight: 600, mb: 1 }}>
                  {loading ? <CircularProgress size={24} /> : stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card elevation={2}>
            <CardHeader 
              title="Quick Actions" 
              avatar={<DashboardIcon />}
              sx={{ '& .MuiCardHeader-title': { fontWeight: 600 } }}
            />
            <CardContent>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Welcome back, <strong>{username}</strong>! Here are your main actions:
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <PhoneIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h6" gutterBottom>Phone Center</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Make calls, manage queue, transfer calls
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <MessageIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
                    <Typography variant="h6" gutterBottom>Message Center</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Handle SMS, view conversations
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardHeader 
              title="Recent Activity" 
              avatar={<ScheduleIcon />}
              sx={{ '& .MuiCardHeader-title': { fontWeight: 600 } }}
            />
            <CardContent sx={{ p: 0 }}>
              <List>
                {recentActivity.map((activity, index) => (
                  <ListItem key={index} divider={index < recentActivity.length - 1}>
                    <ListItemIcon>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.light' }}>
                        <activity.icon fontSize="small" />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={activity.action}
                      secondary={activity.time}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MainContent;
