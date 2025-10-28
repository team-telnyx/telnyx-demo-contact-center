'use client';

import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  Tooltip,
  Box,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SmsIcon from '@mui/icons-material/Sms';
import PhoneIcon from '@mui/icons-material/Phone';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import { useUnreadCount } from '@/hooks/useUnreadCount';

interface SideNavProps {
  isOpen: boolean;
}

const SIDEBAR_WIDTH_OPEN = 280;
const SIDEBAR_WIDTH_CLOSED = 80;
const HEADER_HEIGHT = 70;

const SideNav: React.FC<SideNavProps> = ({ isOpen }) => {
  const pathname = usePathname();
  const { unreadCount, queueUnreadCount, callQueueUnreadCount } = useUnreadCount();

  const items = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Phone', icon: <PhoneIcon />, path: '/phone', badge: callQueueUnreadCount },
    { text: 'Conversations', icon: <SmsIcon />, path: '/sms', badge: unreadCount + queueUnreadCount },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        '& .MuiDrawer-paper': {
          width: isOpen ? SIDEBAR_WIDTH_OPEN : SIDEBAR_WIDTH_CLOSED,
          overflowX: 'hidden',
          top: HEADER_HEIGHT,
          position: 'fixed',
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          transition: (theme) =>
            theme.transitions.create(['width'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          pt: 2,
        },
      }}
    >
      <List sx={{ px: 1.5, gap: 0.5, display: 'flex', flexDirection: 'column' }}>
        {items.map(({ text, icon, path, badge }) => {
          const isActive = pathname === path;

          const listItemContent = (
            <ListItem
              key={text}
              component={Link}
              href={path}
              sx={{
                cursor: 'pointer',
                borderRadius: 2,
                mb: 0.5,
                minHeight: 48,
                px: 2,
                py: 1.5,
                bgcolor: isActive
                  ? (theme) => alpha(theme.palette.primary.main, 0.12)
                  : 'transparent',
                color: isActive ? 'primary.main' : 'text.primary',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  bgcolor: isActive
                    ? (theme) => alpha(theme.palette.primary.main, 0.18)
                    : (theme) => alpha(theme.palette.primary.main, 0.08),
                  transform: 'translateX(4px)',
                },
                '&::before': isActive
                  ? {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 4,
                      height: '60%',
                      bgcolor: 'primary.main',
                      borderRadius: '0 4px 4px 0',
                    }
                  : {},
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: isOpen ? 40 : 'auto',
                  color: 'inherit',
                  justifyContent: 'center',
                }}
              >
                {badge && badge > 0 ? (
                  <Badge
                    badgeContent={badge}
                    color="error"
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.65rem',
                        height: 18,
                        minWidth: 18,
                        fontWeight: 600,
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                      },
                    }}
                  >
                    {icon}
                  </Badge>
                ) : (
                  icon
                )}
              </ListItemIcon>
              {isOpen && (
                <ListItemText
                  primary={text}
                  primaryTypographyProps={{
                    fontSize: '0.9375rem',
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: '-0.01em',
                  }}
                />
              )}
            </ListItem>
          );

          // Wrap in tooltip when sidebar is collapsed
          return !isOpen ? (
            <Tooltip key={text} title={text} placement="right" arrow>
              {listItemContent}
            </Tooltip>
          ) : (
            <Box key={text}>{listItemContent}</Box>
          );
        })}
      </List>
    </Drawer>
  );
};

export default SideNav;