'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Avatar,
  Paper,
  CardHeader,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Message as MessageIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import apiService from '@/services/apiService';

interface DashboardMetrics {
  activeCalls: number;
  queuedMessages: number;
  availableAgents: number;
  avgResponseTime: string;
}

const MainContent: React.FC = () => {
  const router = useRouter();
  const { isLoggedIn, username } = useAuth();
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({
    activeCalls: 0,
    queuedMessages: 0,
    availableAgents: 0,
    avgResponseTime: '0s',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (isLoggedIn) {
      fetchDashboardMetrics();
      // Refresh metrics every 2 minutes
      const refreshInterval = setInterval(() => {
        fetchDashboardMetrics();
      }, 120000);

      return () => {
        clearInterval(refreshInterval);
      };
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <Box sx={{ mt: 8, p: 3 }}>
        <Alert severity="warning" sx={{ maxWidth: 400 }}>
          Please log in to access this page.
        </Alert>
      </Box>
    );
  }

  const dashboardStats = [
    { title: 'Your Active Calls', value: dashboardMetrics.activeCalls.toString(), icon: PhoneIcon, color: 'primary' as const },
    { title: 'Assigned Messages', value: dashboardMetrics.queuedMessages.toString(), icon: MessageIcon, color: 'info' as const },
    { title: 'Available Agents', value: dashboardMetrics.availableAgents.toString(), icon: PersonIcon, color: 'success' as const },
    { title: 'Avg Response Time', value: dashboardMetrics.avgResponseTime, icon: ScheduleIcon, color: 'warning' as const },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #00CC83 0%, #00995E 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 0.5,
            }}
          >
            Agent Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Welcome back, <strong>{username}</strong>
          </Typography>
        </Box>
        <Tooltip title="Refresh Dashboard Data" arrow>
          <span>
            <IconButton
              onClick={fetchDashboardMetrics}
              disabled={loading}
              color="primary"
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: 'primary.dark',
                  transform: 'rotate(180deg)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {dashboardStats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              elevation={0}
              sx={{
                position: 'relative',
                overflow: 'visible',
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette[stat.color].light}15 0%, ${theme.palette[stat.color].main}08 100%)`,
                border: (theme) => `1px solid ${theme.palette[stat.color].light}40`,
              }}
            >
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Avatar
                  sx={{
                    bgcolor: `${stat.color}.main`,
                    color: 'white',
                    mx: 'auto',
                    mb: 2,
                    width: 64,
                    height: 64,
                    boxShadow: (theme) => `0 8px 24px ${theme.palette[stat.color].main}40`,
                  }}
                >
                  <stat.icon sx={{ fontSize: 32 }} />
                </Avatar>
                <Typography
                  variant="h3"
                  component="div"
                  sx={{
                    fontWeight: 700,
                    mb: 1,
                    color: `${stat.color}.main`,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {loading ? <CircularProgress size={32} color={stat.color} /> : stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {stat.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card elevation={0}>
            <CardHeader
              title="Quick Actions"
              avatar={
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <DashboardIcon />
                </Avatar>
              }
              sx={{
                '& .MuiCardHeader-title': {
                  fontWeight: 600,
                  fontSize: '1.25rem',
                },
              }}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Paper
                    elevation={0}
                    onClick={() => router.push('/phone')}
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      border: (theme) => `2px solid ${theme.palette.primary.main}20`,
                      borderRadius: 3,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: 'primary.main',
                        boxShadow: (theme) => `0 12px 24px ${theme.palette.primary.main}20`,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        bgcolor: 'primary.main',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 4px 12px rgba(0, 204, 131, 0.3)',
                      }}
                    >
                      <PhoneIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Phone Center
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Make calls, manage queue, transfer calls
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper
                    elevation={0}
                    onClick={() => router.push('/sms')}
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      border: (theme) => `2px solid ${theme.palette.info.main}20`,
                      borderRadius: 3,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: 'info.main',
                        boxShadow: (theme) => `0 12px 24px ${theme.palette.info.main}20`,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        bgcolor: 'info.main',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                      }}
                    >
                      <MessageIcon sx={{ fontSize: 32 }} />
                    </Box>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Message Center
                    </Typography>
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
          <Card elevation={0} sx={{ height: '100%' }}>
            <CardHeader
              title="System Status"
              avatar={
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <ScheduleIcon />
                </Avatar>
              }
              sx={{
                '& .MuiCardHeader-title': {
                  fontWeight: 600,
                  fontSize: '1.25rem',
                },
              }}
            />
            <CardContent>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'success.light',
                  color: 'success.dark',
                  mb: 2,
                  textAlign: 'center',
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  All systems operational
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                Telnyx Contact Center - Next.js with Material-UI
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MainContent;