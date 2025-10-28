'use client';

import React, { useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Box,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneDisabledIcon from '@mui/icons-material/PhoneDisabled';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAuth } from '@/contexts/AuthContext';
import { EnhancedModalContext } from '@/contexts/EnhancedModalContext';
import SoftphoneMini from './SoftphoneMini';

interface DashboardHeaderProps {
  onToggleSidebar: () => void;
  isOpen: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ onToggleSidebar, isOpen }) => {
  const router = useRouter();
  const { username, logout } = useAuth();
  const modalContext = useContext(EnhancedModalContext);
  const clientStatus = modalContext?.clientStatus || 'NOT READY';
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleMenuClose();
    router.push('/profile');
  };

  const handleLogout = () => {
    handleMenuClose();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      logout();
      window.location.href = '/login';
    }
  };

  // Determine status chip properties
  const getStatusChip = () => {
    switch (clientStatus) {
      case 'READY':
        return {
          label: 'Connected',
          color: 'success' as const,
          icon: <PhoneIcon sx={{ fontSize: '14px' }} />,
        };
      case 'RECONNECTING':
        return {
          label: 'Reconnecting',
          color: 'warning' as const,
          icon: <PhoneIcon sx={{ fontSize: '14px' }} />,
        };
      case 'ERROR':
        return {
          label: 'Disconnected',
          color: 'error' as const,
          icon: <PhoneDisabledIcon sx={{ fontSize: '14px' }} />,
        };
      default:
        return {
          label: 'Connecting',
          color: 'default' as const,
          icon: <PhoneIcon sx={{ fontSize: '14px' }} />,
        };
    }
  };

  const statusChip = getStatusChip();

  return (
    <AppBar
      position="fixed"
      elevation={0}
      color="default"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        height: 70,
        justifyContent: 'center',
      }}
    >
      <Toolbar
        sx={{
          minHeight: 70,
          px: { xs: 2, sm: 3 },
          gap: 2,
        }}
      >
        {/* Menu Icon */}
        <Tooltip title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'} arrow>
          <IconButton
            aria-label="toggle sidebar"
            edge="start"
            onClick={onToggleSidebar}
            sx={{
              borderRadius: 2,
              transition: 'all 0.2s',
              color: 'text.primary',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                transform: 'scale(1.1)',
              },
            }}
          >
            <MenuIcon />
          </IconButton>
        </Tooltip>

        {/* Brand Logo & Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
          <Box
            component="img"
            src="/telnyx-logo.png"
            alt="Telnyx Logo"
            sx={{
              height: 28,
              width: 'auto',
            }}
          />
          <Typography
            variant="h6"
            component="div"
            sx={{
              fontWeight: 700,
              fontSize: '1.25rem',
              letterSpacing: '-0.01em',
              display: { xs: 'none', sm: 'block' },
              color: 'text.primary',
            }}
          >
            Contact Center
          </Typography>
        </Box>

        {/* Right Side Actions */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 2 },
          }}
        >
          {/* Status Chip */}
          <Chip
            icon={statusChip.icon}
            label={statusChip.label}
            color={statusChip.color}
            size="small"
            sx={{
              fontWeight: 600,
              fontSize: '0.75rem',
              height: 28,
              display: { xs: 'none', md: 'flex' },
              '& .MuiChip-icon': {
                ml: 1,
              },
            }}
          />

          {/* Softphone Mini */}
          <SoftphoneMini />

          {/* User Profile - Clickable */}
          <Tooltip title="Account Settings" arrow>
            <Box
              onClick={handleMenuOpen}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 0.75,
                borderRadius: 2,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                backdropFilter: 'blur(8px)',
                border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                transition: 'all 0.2s',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(0, 232, 150, 0.3)',
                },
              }}
            >
              <Avatar
                sx={{
                  bgcolor: 'secondary.main',
                  width: 32,
                  height: 32,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                }}
              >
                {username?.charAt(0).toUpperCase()}
              </Avatar>
              <Typography
                variant="body2"
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  color: 'text.primary',
                }}
              >
                {username}
              </Typography>
            </Box>
          </Tooltip>

          {/* User Menu */}
          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
            onClick={handleMenuClose}
            PaperProps={{
              elevation: 0,
              sx: {
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                mt: 1.5,
                minWidth: 200,
                '& .MuiAvatar-root': {
                  width: 32,
                  height: 32,
                  ml: -0.5,
                  mr: 1,
                },
                '&:before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 14,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={handleProfileClick}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Profile & Settings</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Sign Out</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default DashboardHeader;
