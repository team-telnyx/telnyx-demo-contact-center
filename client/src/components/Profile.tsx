'use client';

import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Avatar,
  IconButton,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Snackbar,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Chip,
  Paper,
} from '@mui/material';
import {
  PhotoCamera,
  Save as SaveIcon,
  Person as PersonIcon,
  Mic as MicIcon,
  Speaker as SpeakerIcon,
  Phone as PhoneIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { SIPCredentialsContext } from '@/contexts/SIPCredentialsContext';
import { getApiBaseUrl } from '@/utils/apiUtils';

interface ProfileProps {
  isOpen: boolean;
}

const Profile: React.FC<ProfileProps> = ({ isOpen }) => {
  const { username, isLoggedIn } = useAuth();
  const sipCredentials = useContext(SIPCredentialsContext);

  // Profile data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<string | null>(null);

  // Audio settings
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('');
  const [defaultPhoneNumber, setDefaultPhoneNumber] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([]);

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fetchUserData = async (username: string) => {
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

  const updateUser = async (username: string, updatedUserData: any) => {
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

  // Fetch audio devices
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return;

      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const ins = devices.filter((d) => d.kind === 'audioinput');
      const outs = devices.filter((d) => d.kind === 'audiooutput');

      setAudioInputs(ins);
      setAudioOutputs(outs);

      // Load saved preferences
      const savedMicId = localStorage.getItem('defaultMicrophoneId');
      const savedSpeakerId = localStorage.getItem('defaultSpeakerId');

      if (savedMicId && ins.find(d => d.deviceId === savedMicId)) {
        setSelectedMicId(savedMicId);
      } else if (ins[0]?.deviceId) {
        setSelectedMicId(ins[0].deviceId);
      }

      if (savedSpeakerId && outs.find(d => d.deviceId === savedSpeakerId)) {
        setSelectedSpeakerId(savedSpeakerId);
      } else if (outs[0]?.deviceId) {
        setSelectedSpeakerId(outs[0].deviceId);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  }, []);

  // Load phone numbers from SIP credentials context
  useEffect(() => {
    if (sipCredentials?.phoneNumbers && sipCredentials.phoneNumbers.length > 0) {
      setAvailableNumbers(sipCredentials.phoneNumbers);

      // Load saved default number
      const savedNumber = localStorage.getItem('defaultPhoneNumber');
      if (savedNumber && sipCredentials.phoneNumbers.includes(savedNumber)) {
        setDefaultPhoneNumber(savedNumber);
      } else {
        // Set first number as default if no saved number or saved number is invalid
        setDefaultPhoneNumber(sipCredentials.phoneNumbers[0]);
      }
    }
  }, [sipCredentials]);

  // Fetch user data when component mounts
  useEffect(() => {
    if (username) {
      fetchUserData(username)
        .then((data) => {
          setFirstName(data.firstName || '');
          setLastName(data.lastName || '');
          setPhoneNumber(data.phoneNumber || '');
          setAvatar(data.avatar || null);
        })
        .catch((error) => {
          console.error('Error loading profile:', error);
        });
    }
  }, [username]);

  // Fetch devices on mount
  useEffect(() => {
    refreshDevices();

    const onDeviceChange = () => refreshDevices();
    try {
      navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
    } catch (_) {}

    return () => {
      try {
        navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
      } catch (_) {}
    };
  }, [refreshDevices]);

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      // Save audio device preferences
      if (selectedMicId) {
        localStorage.setItem('defaultMicrophoneId', selectedMicId);
      }
      if (selectedSpeakerId) {
        localStorage.setItem('defaultSpeakerId', selectedSpeakerId);
      }
      if (defaultPhoneNumber) {
        localStorage.setItem('defaultPhoneNumber', defaultPhoneNumber);
      }

      // Update user data
      const updatedUserData: any = {
        firstName,
        lastName,
        phoneNumber,
      };

      if (avatarFile) {
        updatedUserData.avatar = avatarFile;
      }

      const result = await updateUser(username!, updatedUserData);

      if (result) {
        setSuccess(true);
        setAvatarFile(null);
        window.dispatchEvent(new CustomEvent('profileUpdated'));
      }
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error('Profile update error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file size should be less than 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setAvatar(result);
        setAvatarFile(result);
      };
      reader.onerror = () => {
        setError('Error reading the image file.');
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isLoggedIn) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <Typography variant="h5" color="text.secondary">
          Please log in to view your profile.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography
        variant="h3"
        component="h1"
        gutterBottom
        sx={{
          fontWeight: 700,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #00E896 0%, #00CC83 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 4,
        }}
      >
        Profile & Settings
      </Typography>

      <Grid container spacing={3}>
        {/* Profile Information */}
        <Grid item xs={12} md={6}>
          <Card elevation={0}>
            <CardHeader
              title="Profile Information"
              avatar={
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <PersonIcon />
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
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              <Box display="flex" flexDirection="column" alignItems="center" sx={{ mb: 4 }}>
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <Avatar
                    src={avatar || undefined}
                    alt={`${firstName} ${lastName}`}
                    sx={{
                      width: 120,
                      height: 120,
                      border: '4px solid',
                      borderColor: 'primary.main',
                      boxShadow: '0 4px 12px rgba(0, 232, 150, 0.3)',
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
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                        transform: 'scale(1.1)',
                      },
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input type="file" accept="image/*" onChange={handleFileSelect} hidden />
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

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
          </Card>
        </Grid>

        {/* Audio & Phone Settings */}
        <Grid item xs={12} md={6}>
          <Card elevation={0}>
            <CardHeader
              title="Device Settings"
              avatar={
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <MicIcon />
                </Avatar>
              }
              action={
                <IconButton onClick={refreshDevices} size="small">
                  <RefreshIcon />
                </IconButton>
              }
              sx={{
                '& .MuiCardHeader-title': {
                  fontWeight: 600,
                  fontSize: '1.25rem',
                },
              }}
            />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Microphone Selection */}
                <FormControl fullWidth>
                  <InputLabel>Default Microphone</InputLabel>
                  <Select
                    value={selectedMicId}
                    label="Default Microphone"
                    onChange={(e) => setSelectedMicId(e.target.value)}
                  >
                    {audioInputs.map((device) => (
                      <MenuItem key={device.deviceId} value={device.deviceId}>
                        {device.label || 'Default Microphone'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Speaker Selection */}
                <FormControl fullWidth>
                  <InputLabel>Default Speaker</InputLabel>
                  <Select
                    value={selectedSpeakerId}
                    label="Default Speaker"
                    onChange={(e) => setSelectedSpeakerId(e.target.value)}
                  >
                    {audioOutputs.map((device) => (
                      <MenuItem key={device.deviceId} value={device.deviceId}>
                        {device.label || 'Default Speaker'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Default Phone Number */}
                <FormControl fullWidth>
                  <InputLabel>Default Phone Number</InputLabel>
                  <Select
                    value={defaultPhoneNumber}
                    label="Default Phone Number"
                    onChange={(e) => setDefaultPhoneNumber(e.target.value)}
                  >
                    {availableNumbers.map((number) => (
                      <MenuItem key={number} value={number}>
                        {number}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </CardContent>
          </Card>

          {/* SIP Connection Details */}
          <Card elevation={0} sx={{ mt: 3 }}>
            <CardHeader
              title="SIP Connection Details"
              avatar={
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <InfoIcon />
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
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    SIP Username
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {sipCredentials?.login || 'Not configured'}
                  </Typography>
                </Paper>

                <Paper
                  sx={{
                    p: 2,
                    bgcolor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Connection Status
                  </Typography>
                  <Chip
                    label={sipCredentials ? 'Configured' : 'Not Configured'}
                    color={sipCredentials ? 'success' : 'default'}
                    size="small"
                  />
                </Paper>

                <Alert severity="info" sx={{ mt: 1 }}>
                  SIP credentials are automatically configured for your account. Contact your administrator if you experience connection issues.
                </Alert>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Save Button */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          size="large"
          sx={{
            boxShadow: '0 4px 12px rgba(0, 232, 150, 0.3)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 16px rgba(0, 232, 150, 0.4)',
            },
          }}
        >
          {loading ? 'Saving...' : 'Save All Settings'}
        </Button>
      </Box>

      {/* Success Snackbar */}
      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccess(false)} severity="success" sx={{ width: '100%' }}>
          Profile and settings updated successfully!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Profile;
