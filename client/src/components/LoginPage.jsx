import React, { useState } from "react";
import axios from 'axios';
import './LoginPage.css';
import telnyxLogo from '../assets/telnyx_logo_black.png';
import { useAuth } from './AuthContext'; 
import {Button, FormControl, OutlinedInput, Box, FormLabel} from '@mui/material'; 
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { setIsLoggedIn } = useAuth();
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = () => {
    navigate('/register'); // Path to my registration page
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const response = await axios.post(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/users/login`, {
        username,
        password
      });

      // You will get the token from the backend in the response
      const { token } = response.data;

      // Save token to local storage or state or use it.
      localStorage.setItem('token', token);
      setIsLoggedIn(true);
      navigate('/dashboard');
      

      console.log(`Login successful, token received: ${token}`);

    } catch (error) {
      setError("Login failed: Incorrect username or password");
      console.error(error);
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
        </Button><br />
        <Button 
          variant="outlined" 
          color="secondary" 
          onClick={handleRegister}
          style={{ marginTop: '10px' }}
        >
          Register
        </Button>
      </form>
      </Box>
    </div>
    </div>
  );
}

export default LoginPage;
