import React from 'react';
import { Drawer, List, ListItem, ListItemText, ListItemIcon, Badge } from '@mui/material';
import { Link } from 'react-router-dom';
import SmsIcon from '@mui/icons-material/Sms';
import PhoneIcon from '@mui/icons-material/Phone';
import DashboardIcon from '@mui/icons-material/Dashboard';
import QueueIcon from '@mui/icons-material/Queue';
import { useUnreadCount } from './UnreadCount';

// Accept isOpen as a prop
const SideNav = ({ isOpen }) => {
  const { unreadCount, queueUnreadCount, callQueueUnreadCount } = useUnreadCount();
  const items = [
    { text: 'Agent Dashboard', icon: <DashboardIcon />, path: 'dashboard' },
    { text: 'Phone', icon: <PhoneIcon />, path: 'phone' },
    { text: 'Conversations', icon: <SmsIcon />, path: 'sms' },
    { text: 'Message Queue', icon: <QueueIcon />, path: 'message_queue' }
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        '& .MuiDrawer-paper': {
          width: isOpen ? 240 : 64,
          overflowX: 'hidden',
          top: '64px'
        }
      }}
    >
      <List>
        {items.map(({ text, icon, path }) => (
          <ListItem button key={text} component={Link} to={`/${path}`}>
          <ListItemIcon>
            {text === 'Conversations' ? (
              <Badge badgeContent={unreadCount} color="secondary">
                {icon}
              </Badge>
            ) : text === 'Message Queue' ? (
              <Badge badgeContent={queueUnreadCount} color="secondary">
                {icon}
              </Badge>
            ) : text === 'Phone' ? ( // Add badge for Phone
              <Badge badgeContent={callQueueUnreadCount} color="secondary">
                {icon}
              </Badge>
            ) : (
              icon
            )}
          </ListItemIcon>
            {isOpen && <ListItemText primary={text} />}
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
};


export default SideNav;
