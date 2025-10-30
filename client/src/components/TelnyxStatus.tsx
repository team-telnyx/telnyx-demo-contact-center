'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  Tooltip,
  CircularProgress,
  IconButton,
  Popover,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

interface StatusIndicator {
  indicator: 'none' | 'minor' | 'major' | 'critical';
  description: string;
}

interface Component {
  id: string;
  name: string;
  status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage';
  description: string | null;
  updated_at: string;
}

interface Incident {
  id: string;
  name: string;
  status: string;
  impact: string;
  created_at: string;
  updated_at: string;
  shortlink: string;
}

interface StatusData {
  status: StatusIndicator;
  components: Component[];
  incidents: Incident[];
  scheduled_maintenances: any[];
}

const TelnyxStatus: React.FC = () => {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('https://status.telnyx.com/api/v2/summary.json');

      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }

      const data = await response.json();
      setStatusData(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching Telnyx status:', err);
      setError('Unable to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh every 5 minutes
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchStatus();
  };

  const open = Boolean(anchorEl);

  const getStatusConfig = () => {
    if (loading) {
      return {
        icon: <CircularProgress size={14} sx={{ color: 'text.secondary' }} />,
        label: 'Checking...',
        color: 'default' as const,
      };
    }

    if (error || !statusData) {
      return {
        icon: <InfoIcon sx={{ fontSize: 14 }} />,
        label: 'Unknown',
        color: 'default' as const,
      };
    }

    const { indicator } = statusData.status;

    switch (indicator) {
      case 'none':
        return {
          icon: <CheckCircleIcon sx={{ fontSize: 14 }} />,
          label: 'All Systems Operational',
          color: 'success' as const,
        };
      case 'minor':
        return {
          icon: <WarningIcon sx={{ fontSize: 14 }} />,
          label: 'Minor Issues',
          color: 'warning' as const,
        };
      case 'major':
        return {
          icon: <ErrorIcon sx={{ fontSize: 14 }} />,
          label: 'Major Outage',
          color: 'error' as const,
        };
      case 'critical':
        return {
          icon: <ErrorIcon sx={{ fontSize: 14 }} />,
          label: 'Critical Outage',
          color: 'error' as const,
        };
      default:
        return {
          icon: <InfoIcon sx={{ fontSize: 14 }} />,
          label: 'Unknown Status',
          color: 'default' as const,
        };
    }
  };

  const statusConfig = getStatusConfig();

  const getComponentStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'success.main';
      case 'degraded_performance':
        return 'warning.main';
      case 'partial_outage':
        return 'error.main';
      case 'major_outage':
        return 'error.dark';
      default:
        return 'text.secondary';
    }
  };

  const getComponentStatusLabel = (status: string) => {
    switch (status) {
      case 'operational':
        return 'Operational';
      case 'degraded_performance':
        return 'Degraded';
      case 'partial_outage':
        return 'Partial Outage';
      case 'major_outage':
        return 'Major Outage';
      default:
        return status;
    }
  };

  return (
    <>
      <Tooltip title="Telnyx System Status" arrow>
        <Chip
          icon={statusConfig.icon}
          label={statusConfig.label}
          color={statusConfig.color}
          size="small"
          onClick={handleClick}
          sx={{
            fontWeight: 600,
            fontSize: '0.75rem',
            height: 28,
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: 2,
            },
            '& .MuiChip-icon': {
              ml: 1,
            },
          }}
        />
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 350,
            maxWidth: 450,
            maxHeight: 500,
            overflow: 'auto',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Telnyx Status
            </Typography>
            <IconButton size="small" onClick={handleRefresh} disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>

          {lastUpdated && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Typography>
          )}

          {error && (
            <Typography color="error" variant="body2" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          {statusData && (
            <>
              {/* Overall Status */}
              <Box
                sx={{
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    statusData.status.indicator === 'none'
                      ? alpha(theme.palette.success.main, 0.1)
                      : statusData.status.indicator === 'minor'
                      ? alpha(theme.palette.warning.main, 0.1)
                      : alpha(theme.palette.error.main, 0.1),
                }}
              >
                <Typography variant="body2" fontWeight={600}>
                  {statusData.status.description}
                </Typography>
              </Box>

              {/* Active Incidents */}
              {statusData.incidents && statusData.incidents.length > 0 && (
                <>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Active Incidents
                  </Typography>
                  <List dense>
                    {statusData.incidents.slice(0, 3).map((incident) => (
                      <ListItem key={incident.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={incident.name}
                          secondary={`Impact: ${incident.impact} • ${incident.status}`}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                  <Divider sx={{ my: 2 }} />
                </>
              )}

              {/* Component Status */}
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Component Status
              </Typography>
              <List dense>
                {statusData.components
                  .filter((c) => c.status !== 'operational')
                  .slice(0, 5)
                  .map((component) => (
                    <ListItem key={component.id} sx={{ px: 0 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: getComponentStatusColor(component.status),
                          mr: 1,
                        }}
                      />
                      <ListItemText
                        primary={component.name}
                        secondary={getComponentStatusLabel(component.status)}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                {statusData.components.filter((c) => c.status !== 'operational').length === 0 && (
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText
                      primary="All components operational"
                      primaryTypographyProps={{ variant: 'body2', color: 'success.main' }}
                    />
                  </ListItem>
                )}
              </List>

              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography
                  component="a"
                  href="https://status.telnyx.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="caption"
                  sx={{
                    color: 'primary.main',
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  View full status page →
                </Typography>
              </Box>
            </>
          )}
        </Box>
      </Popover>
    </>
  );
};

export default TelnyxStatus;
