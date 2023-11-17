import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Button,
  Avatar,
  IconButton,
  FormControl,
  FormLabel,
  OutlinedInput,
  InputLabel,
  Input,
  Box
} from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import { useAuth } from './AuthContext';

const Profile = (isOpen) => {
  const marginLeft = isOpen ? '240px' : '64px';
  const { username, isLoggedIn } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatar, setAvatar] = useState(null);


  const fetchUserData = async (username) => {
    const response = await fetch(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/users/user_data/${username}`);
    const data = await response.json();
    return data;
  };
  
  const updateUser = async (username, updatedUserData) => {
    const response = await fetch(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/users/update/${username}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedUserData),
    });
    const data = await response.json();
    return data;
  };

  // Fetch user data when component mounts
  useEffect(() => {
    fetchUserData(username).then(data => {
        setFirstName(data.firstName);
        setLastName(data.lastName);
        setPhoneNumber(data.phoneNumber);
        setAvatar(data.avatar);
      });
  }, []);

  const handleSave = async () => {
    // Update user data
    const updatedUserData = {
      firstName,
      lastName,
      phoneNumber,
      avatar: avatar ? avatar.split(',')[1] : null,
    };
    // Pass the username to the updateUser function
    await updateUser(username, updatedUserData);
  };
  

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setAvatar(e.target.result);  // Set avatar to base64 string
      reader.readAsDataURL(file);
    }
  };

  if (!isLoggedIn) {
    return (
      <div style={{ marginTop: '64px', marginLeft }}>
        <h1>Please login to view the message queue.</h1>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '64px', marginLeft }}>
      <Card>
        <CardContent>
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <Avatar src={avatar} alt={`${firstName} ${lastName}`} sx={{ width: 56, height: 56 }} />
            <IconButton color="primary" aria-label="upload picture" component="label">
              <input type="file" accept="image/*" onChange={handleFileSelect} hidden />
              <PhotoCamera />
            </IconButton>
            <FormControl fullWidth variant="outlined" margin="normal">
              <FormLabel htmlFor="firstName">First Name</FormLabel>
              <OutlinedInput
                id="firstName"
                name="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                notched={false}
              />
            </FormControl>
            <FormControl fullWidth variant="outlined" margin="normal">
              <FormLabel htmlFor="lastName">Last Name</FormLabel>
              <OutlinedInput
                id="lastName"
                name="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                notched={false}
              />
            </FormControl>
            <FormControl fullWidth variant="outlined" margin="normal">
              <FormLabel htmlFor="phoneNumber">Phone Number</FormLabel>
              <OutlinedInput
                id="phoneNumber"
                name="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                notched={false}
              />
            </FormControl>
          </Box>
        </CardContent>
        <CardActions>
          <Button variant="contained" color="primary" onClick={handleSave}>
            Save
          </Button>
        </CardActions>
      </Card>
    </div>
  );
};

export default Profile;
