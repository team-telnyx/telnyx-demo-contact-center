import React, { useState } from "react";
import axios from 'axios';
import './LoginPage.css';
import vwLogo from '../assets/telnyx_logo_black.png';
import { useAuth } from './AuthContext'; // Importing AuthContext
import {Button, FormControl, OutlinedInput, Box, FormLabel} from '@mui/material'; // Importing Material-UI components
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { setIsLoggedIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/users/login`, {
        username,
        password
      });

      // You will get the token from the backend in the response
      const { token } = response.data;

      // Save token to local storage or state or use it as you need.
      localStorage.setItem('token', token);
      setIsLoggedIn(true);
      navigate('/dashboard');
      
      // You might also want to save the user info to your state here.

      console.log(`Login successful, token received: ${token}`);

    } catch (error) {
      // Handle Error Here
      console.error(error);
    }
  };
  
  return (
    <div className="loginPage">
    <div className="login-wrapper">
      <div className="logo-container">
        <img src={vwLogo} alt="Company Logo" />
      </div>
      <Box p={2}>
      <form onSubmit={handleSubmit}>
        <FormControl fullWidth variant="outlined" margin="normal">
          <FormLabel htmlFor="username" style={{ color: '#00a37a' }}>Username</FormLabel>
          <OutlinedInput
            id="username"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            notched={false}
          />
        </FormControl>
        <FormControl fullWidth variant="outlined" margin="normal">
          <FormLabel htmlFor="password" style={{ color: '#00a37a' }}>Password</FormLabel>
          <OutlinedInput
            id="password"
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            notched={false}
          />
        </FormControl>
        <Button variant="contained" color="primary" type="submit">
          Login
        </Button>
      </form>
      </Box>
    </div>
    </div>
  );
}

export default LoginPage;
