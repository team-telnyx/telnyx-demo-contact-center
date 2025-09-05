import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Button,
  Avatar,
  IconButton,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Snackbar
} from '@mui/material';
import { 
  PhotoCamera,
  Save as SaveIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useAuth } from './AuthContext';
import { getApiBaseUrl } from '../utils/apiUtils';

const Profile = ({ isOpen }) => {
  const marginLeft = isOpen ? '240px' : '64px';
  const { username, isLoggedIn } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);


  const fetchUserData = async (username) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/users/user_data/${username}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load profile data.');
      throw error;
    }
  };
  
  const updateUser = async (username, updatedUserData) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/users/update/${username}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedUserData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  // Fetch user data when component mounts
  useEffect(() => {
    if (username) {
      fetchUserData(username)
        .then(data => {
          setFirstName(data.firstName || '');
          setLastName(data.lastName || '');
          setPhoneNumber(data.phoneNumber || '');
          setAvatar(data.avatar || null);
        })
        .catch(error => {
          console.error('Error loading profile:', error);
        });
    }
  }, [username]);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Update user data
      const updatedUserData = {
        firstName,
        lastName,
        phoneNumber,
      };
      
      // Only include avatar if a new one was uploaded
      if (avatarFile) {
        updatedUserData.avatar = avatarFile;
      }
      
      // Pass the username to the updateUser function
      const result = await updateUser(username, updatedUserData);
      
      if (result) {
        setSuccess(true);
        setAvatarFile(null); // Clear the pending avatar file
        console.log('Profile updated successfully');
        
        // Dispatch custom event to notify other components (like DashboardHeader) to refresh avatar
        window.dispatchEvent(new CustomEvent('profileUpdated'));
      }
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error('Profile update error:', err);
    } finally {
      setLoading(false);
    }
  };
  

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file size should be less than 5MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target.result;
        setAvatar(result);  // Set avatar for display
        setAvatarFile(result);  // Store the base64 for upload
      };
      reader.onerror = () => {
        setError('Error reading the image file.');
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isLoggedIn) {
    return (
      <Box sx={{ mt: 8, ml: marginLeft, p: 3 }}>
        <Alert severity="warning" sx={{ maxWidth: 400 }}>
          Please log in to view your profile.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 8, ml: marginLeft, p: 3 }}>
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Profile Settings
      </Typography>

      <Card elevation={2} sx={{ maxWidth: 600 }}>
        <CardContent sx={{ p: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box display="flex" flexDirection="column" alignItems="center" sx={{ mb: 4 }}>
            <Box sx={{ position: 'relative', mb: 2 }}>
              <Avatar 
                src={avatar} 
                alt={`${firstName} ${lastName}`} 
                sx={{ 
                  width: 120, 
                  height: 120,
                  border: '4px solid',
                  borderColor: 'primary.light'
                }}
              >
                <PersonIcon sx={{ fontSize: 60 }} />
              </Avatar>
              <IconButton 
                color="primary" 
                aria-label="upload picture" 
                component="label"
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  boxShadow: 2
                }}
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileSelect} 
                  hidden 
                />
                <PhotoCamera />
              </IconButton>
            </Box>
            <Typography variant="h6" gutterBottom>
              {firstName} {lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              @{username}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              variant="outlined"
            />
            
            <TextField
              fullWidth
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              variant="outlined"
            />
            
            <TextField
              fullWidth
              label="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              variant="outlined"
              placeholder="+1 (555) 123-4567"
            />
          </Box>
        </CardContent>
        
        <CardActions sx={{ p: 3, justifyContent: 'flex-end' }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSave}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            size="large"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardActions>
      </Card>

      {/* Success Snackbar */}
      <Snackbar 
        open={success} 
        autoHideDuration={6000} 
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccess(false)} severity="success">
          Profile updated successfully!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Profile;
