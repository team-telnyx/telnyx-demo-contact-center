'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  IconButton,
  Divider,
  Chip,
  Link,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
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

const TelnyxStatusDashboard: React.FC = () => {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    // Refresh every 2 minutes
    const interval = setInterval(fetchStatus, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (!statusData) return 'text.secondary';
    const { indicator } = statusData.status;

    switch (indicator) {
      case 'none':
        return 'success.main';
      case 'minor':
        return 'warning.main';
      case 'major':
      case 'critical':
        return 'error.main';
      default:
        return 'text.secondary';
    }
  };

  const getStatusIcon = () => {
    if (loading) return <CircularProgress size={24} />;
    if (!statusData) return <ErrorIcon color="disabled" />;

    const { indicator } = statusData.status;

    switch (indicator) {
      case 'none':
        return <CheckCircleIcon sx={{ color: 'success.main', fontSize: 32 }} />;
      case 'minor':
        return <WarningIcon sx={{ color: 'warning.main', fontSize: 32 }} />;
      case 'major':
      case 'critical':
        return <ErrorIcon sx={{ color: 'error.main', fontSize: 32 }} />;
      default:
        return <ErrorIcon color="disabled" />;
    }
  };

  const getComponentStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'success';
      case 'degraded_performance':
        return 'warning';
      case 'partial_outage':
        return 'error';
      case 'major_outage':
        return 'error';
      default:
        return 'default';
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

  // Show specific key components
  const keyComponentNames = [
    'Programmable Voice - Voice API',
    'Programmable Messaging - Long Codes',
    'API Gateway'
  ];

  const keyComponents = statusData?.components.filter((c) =>
    keyComponentNames.some((name) => c.name.includes(name))
  ) || [];

  const nonOperationalComponents = statusData?.components.filter((c) => c.status !== 'operational') || [];

  return (
    <Box>
      {/* Header with refresh */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {getStatusIcon()}
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, color: getStatusColor() }}>
              {loading ? 'Checking...' : statusData?.status.description || 'Unknown Status'}
            </Typography>
            {lastUpdated && (
              <Typography variant="caption" color="text.secondary">
                Updated {lastUpdated.toLocaleTimeString()}
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton onClick={fetchStatus} disabled={loading} size="small">
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Active Incidents */}
      {statusData?.incidents && statusData.incidents.length > 0 && (
        <>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'error.main' }}>
            Active Incidents ({statusData.incidents.length})
          </Typography>
          <List dense sx={{ mb: 2 }}>
            {statusData.incidents.slice(0, 3).map((incident) => (
              <ListItem
                key={incident.id}
                sx={{
                  px: 0,
                  py: 1,
                  borderLeft: 3,
                  borderColor: 'error.main',
                  pl: 2,
                  mb: 1,
                  bgcolor: (theme) => alpha(theme.palette.error.main, 0.05),
                  borderRadius: 1,
                }}
              >
                <ListItemText
                  primary={incident.name}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                      <Chip label={incident.impact} size="small" color="error" sx={{ height: 20 }} />
                      <Typography variant="caption" color="text.secondary">
                        {incident.status}
                      </Typography>
                    </Box>
                  }
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                />
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Non-operational components (if any) */}
      {nonOperationalComponents.length > 0 ? (
        <>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Service Status
          </Typography>
          <List dense>
            {nonOperationalComponents.map((component) => (
              <ListItem key={component.id} sx={{ px: 0, py: 0.5 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: `${getComponentStatusColor(component.status)}.main`,
                    mr: 1.5,
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
          </List>
        </>
      ) : (
        <>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Key Services
          </Typography>
          <List dense>
            {keyComponents.length > 0 ? (
              keyComponents.map((component) => (
                <ListItem key={component.id} sx={{ px: 0, py: 0.5 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'success.main',
                      mr: 1.5,
                    }}
                  />
                  <ListItemText
                    primary={component.name}
                    secondary="Operational"
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption', color: 'success.main' }}
                  />
                </ListItem>
              ))
            ) : (
              <ListItem sx={{ px: 0 }}>
                <ListItemText
                  primary="All services operational"
                  primaryTypographyProps={{ variant: 'body2', color: 'success.main' }}
                />
              </ListItem>
            )}
          </List>
        </>
      )}

      <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Link
          href="https://status.telnyx.com"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'primary.main',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
        >
          View full status page
          <OpenInNewIcon sx={{ fontSize: 16 }} />
        </Link>
      </Box>
    </Box>
  );
};

export default TelnyxStatusDashboard;
