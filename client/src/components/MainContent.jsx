import React, { useState, useEffect } from 'react';
import { 
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Avatar
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Phone as PhoneIcon,
  Message as MessageIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useAuth } from './AuthContext';

const MainContent = ({ isOpen }) => {
  const { isLoggedIn, username } = useAuth();
  const marginLeft = isOpen ? '240px' : '64px';

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
    { title: 'Active Calls', value: '3', icon: PhoneIcon, color: 'primary' },
    { title: 'Queue Messages', value: '7', icon: MessageIcon, color: 'info' },
    { title: 'Available Agents', value: '12', icon: PersonIcon, color: 'success' },
    { title: 'Avg Response Time', value: '2.4s', icon: ScheduleIcon, color: 'warning' }
  ];

  const recentActivity = [
    { action: 'Call answered', time: '2 minutes ago', icon: PhoneIcon },
    { action: 'Message processed', time: '5 minutes ago', icon: MessageIcon },
    { action: 'Agent status updated', time: '10 minutes ago', icon: PersonIcon },
    { action: 'Call transferred', time: '15 minutes ago', icon: CheckCircleIcon }
  ];

  return (
    <Box sx={{ mt: 8, ml: marginLeft, p: 3 }}>
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Agent Dashboard
      </Typography>

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
                  {stat.value}
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
