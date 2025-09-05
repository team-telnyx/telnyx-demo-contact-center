import React, { useState, useEffect, useContext } from 'react';
import { AppBar, Toolbar, IconButton, Typography, Button, Avatar, Badge, Popover, Box, List, ListItem, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import { useAuth } from './AuthContext';
import telnyxLogo from '../assets/telnyx_logo_green.png';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import { getApiBaseUrl } from '../utils/apiUtils';


const ProfilePopover = ({ handleClose }) => (
  <List>
    <ListItem button component={Link} to="/update-user-settings" onClick={handleClose}>
      <ListItemIcon>
        <SettingsIcon />
      </ListItemIcon>
      <ListItemText primary="Update User Settings" />
    </ListItem>
    <ListItem button component={Link} to="/view-profile" onClick={handleClose}>
      <ListItemIcon>
        <PersonIcon />
      </ListItemIcon>
      <ListItemText primary="View Profile" />
    </ListItem>
  </List>
);

const getUsernameFromToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  const decoded = jwtDecode(token);
  return decoded.username;
};

const fetchAvatarAndName = async (setIsOnline) => {
  const username = getUsernameFromToken();
  try {
    const response = await axios.get(`${getApiBaseUrl()}/api/users/user_data/${username}`);
    const { avatar, firstName, lastName, status } = response.data;
    const initials = `${firstName[0]}${lastName[0]}`;
    setIsOnline(status); 
    return { avatar, firstName, lastName, initials };
  } catch (error) {
    console.error("Could not fetch avatar and name:", error);
    return null;
  }
};

const DashboardHeader = ({ setIsOpen, isOpen }) => {
  const { isLoggedIn, isOnline, setIsLoggedIn, setIsOnline } = useAuth(); // Get states from context
  const [anchorEl, setAnchorEl] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);  
  const [firstName, setFirstName] = useState("A");  
  const [lastName, setLastName] = useState(""); 
  const [initials, setInitials] = useState("");

  useEffect(() => {
    if (isLoggedIn) {
      fetchAvatarAndName(setIsOnline).then((data) => {
        if (data) {
          const { avatar, firstName, lastName } = data;
          setAvatarUrl(avatar);
          setFirstName(firstName);
          setLastName(lastName);
          setInitials(`${firstName[0]}${lastName[0]}`);
        }
      });
    }
  }, [isLoggedIn]);

  // Add a function to refresh avatar data
  const refreshAvatarData = async () => {
    if (isLoggedIn) {
      const data = await fetchAvatarAndName(setIsOnline);
      if (data) {
        const { avatar, firstName, lastName } = data;
        setAvatarUrl(avatar);
        setFirstName(firstName);
        setLastName(lastName);
        setInitials(`${firstName[0]}${lastName[0]}`);
      }
    }
  };

  // Listen for custom events to refresh avatar data when profile is updated
  useEffect(() => {
    const handleProfileUpdate = () => {
      refreshAvatarData();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [isLoggedIn]);

  const toggleUserStatus = async () => {
    const username = getUsernameFromToken();
    if (username) {
      try {
        // Toggle the user's status
        const newStatus = !isOnline;
        await axios.patch(`${getApiBaseUrl()}/api/users/update-status/${username}`, {
          status: newStatus
        });
        // Update the isOnline state if the status was successfully updated
        setIsOnline(newStatus);
      } catch (error) {
        console.error('Could not update user status:', error);
      }
    }
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    axios.post(`${getApiBaseUrl()}/api/users/logout`)
      .then((response) => {
        localStorage.removeItem('token');
        setIsLoggedIn(false);  // Update the context state
        setIsOnline(false);  // Update the context state
        console.log(response.data);
      })
      .catch((error) => {
        console.error('Could not log out:', error);
      });
  };
  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  const avatarDisplay = avatarUrl ? 
    <Avatar 
      src={avatarUrl} 
      onClick={handleClick} 
      alt={`${firstName} ${lastName}`}
      sx={{
        border: `3px solid ${isOnline ? '#4caf50' : '#f44336'}`,
        cursor: 'pointer'
      }}
    /> :
    <Avatar 
      onClick={handleClick}
      sx={{
        border: `3px solid ${isOnline ? '#4caf50' : '#f44336'}`,
        cursor: 'pointer'
      }}
    >{initials}</Avatar>;

  return (
    <AppBar
      position="fixed"
      sx={(theme) => ({
        zIndex: theme.zIndex.drawer + 1,
        backgroundColor: theme.palette.secondary.main,
      })}
    >
      <Toolbar>
        <Box display="flex" flexGrow={1}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={() => setIsOpen(!isOpen)}
          >
            <MenuIcon />
          </IconButton>
        </Box>

        <Box display="flex" justifyContent="center" flexGrow={1}>
          <img src={telnyxLogo} width="197" height="60" alt="telnyx logo" />
        </Box>

        <Box display="flex" flexGrow={1} justifyContent="flex-end">
          {isLoggedIn ? (
            <>
              {avatarDisplay}
              <IconButton color="inherit" onClick={toggleUserStatus}>
                <FiberManualRecordIcon color={isOnline ? 'success' : 'error'} />
              </IconButton>
              <Button color="inherit" startIcon={<ExitToAppIcon />} onClick={handleLogout}>
                Logout
              </Button>
              <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'left',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'left',
                }}
                sx={{
                  marginTop: '64px', // or the height of your AppBar
                }}
              >
                <ProfilePopover handleClose={handleClose} />
              </Popover>
            </>
          ) : null}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default DashboardHeader;
