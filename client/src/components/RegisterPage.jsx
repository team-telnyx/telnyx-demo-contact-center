import React, { useState } from "react";
import axios from 'axios';
import './LoginPage.css'; // Reusing the same CSS file
import telnyxLogo from '../assets/telnyx_logo_black.png'; // Assuming you want to use the same logo
import {Button, FormControl, OutlinedInput, Box, FormLabel, InputLabel, Input} from '@mui/material'; // Reusing Material-UI components
import { useNavigate } from 'react-router-dom';

function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    avatar: '',
    username: '',
    password: ''
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    if (e.target.name === 'avatar') {
      // Handle file input for avatar
      const file = e.target.files[0];
      if (file && file.type.match('image/jpeg')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData({ ...formData, avatar: reader.result });
        };
        reader.readAsDataURL(file);
      } else {
        setError('Please upload a JPG image for the avatar');
      }
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const response = await axios.post(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/users/register`, formData);
      // Handle successful registration
      console.log(response.data); 
      navigate('/login'); // Navigate to login page after successful registration
    } catch (error) {
      setError("Registration failed: " + error.response.data);
      console.error('Registration error:', error);
    }
  };

  return (
    <div className="loginPage">
      <div className="login-wrapper">
      {error && <div className="error">{error}</div>}
        <div className="logo-container">
          <img src={telnyxLogo} alt="Telnyx Logo" />
        </div>
        <Box p={2}>
          <form onSubmit={handleSubmit}>
            {Object.keys(formData).map((field) => field !== 'avatar' && (
              <FormControl fullWidth variant="outlined" margin="normal" key={field}>
                <FormLabel htmlFor={field} style={{ color: '#00a37a' }}>{field.charAt(0).toUpperCase() + field.slice(1)}</FormLabel>
                <OutlinedInput
                  id={field}
                  name={field}
                  label={field.charAt(0).toUpperCase() + field.slice(1)}
                  type={field === "password" ? "password" : "text"}
                  value={formData[field]}
                  onChange={handleChange}
                  notched={false}
                />
              </FormControl>
            ))}
            <FormControl fullWidth variant="outlined" margin="normal">
              <InputLabel htmlFor="avatar" style={{ color: '#00a37a' }}>Avatar (JPG only)</InputLabel>
              <Input
                id="avatar"
                name="avatar"
                type="file"
                onChange={handleChange}
                notched={false}
              />
            </FormControl>
            <Button variant="contained" color="primary" type="submit">
              Register
            </Button>
          </form>
        </Box>
      </div>
    </div>
  );
}

export default RegisterPage;
