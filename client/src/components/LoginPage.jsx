import React, { useState, useEffect } from "react";
import axios from 'axios';
import telnyxLogo from '../assets/telnyx_logo_black.png';
import { useAuth } from './AuthContext'; 
import {
  Button, 
  TextField, 
  Box, 
  Typography,
  Container,
  Alert,
  Stack,
  Divider,
  Card,
  CardContent
} from '@mui/material'; 
import { Login as LoginIcon, PersonAdd as RegisterIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/apiUtils';

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { setIsLoggedIn, setToken, isLoggedIn, isLoading } = useAuth();
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      console.log('LoginPage: User already logged in, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [isLoggedIn, isLoading, navigate]);

  const handleRegister = () => {
    navigate('/register'); // Path to my registration page
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const response = await axios.post(`${getApiBaseUrl()}/api/users/login`, {
        username,
        password
      });

      // You will get the token from the backend in the response
      const { token } = response.data;

      // Save token to local storage or state or use it.
      localStorage.setItem('token', token);
      setToken(token);
      setIsLoggedIn(true);
      navigate('/dashboard');
      

      console.log(`Login successful, token received: ${token}`);

    } catch (error) {
      setError("Login failed: Incorrect username or password");
      console.error(error);
    }
  };

  // Show loading while checking authentication status
  if (isLoading) {
    return (
      <Container component="main" maxWidth="sm">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography>Loading...</Typography>
        </Box>
      </Container>
    );
  }

  // Don't render login form if already logged in (will redirect)
  if (isLoggedIn) {
    return null;
  }
  
  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Card elevation={8} sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent sx={{ p: 4 }}>
            {/* Logo */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <img 
                src={telnyxLogo} 
                alt="Telnyx Logo" 
                style={{ maxWidth: '200px', height: 'auto' }}
              />
            </Box>

            <Typography 
              variant="h4" 
              component="h1" 
              align="center" 
              gutterBottom
              sx={{ fontWeight: 600, mb: 3 }}
            >
              Welcome Back
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <Stack spacing={3}>
                <TextField
                  fullWidth
                  id="username"
                  label="Username"
                  name="username"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                
                <TextField
                  fullWidth
                  id="password"
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<LoginIcon />}
                  sx={{ mt: 3, mb: 2, py: 1.5 }}
                >
                  Sign In
                </Button>

                <Divider>or</Divider>

                <Button
                  fullWidth
                  variant="outlined"
                  size="large"
                  startIcon={<RegisterIcon />}
                  onClick={handleRegister}
                >
                  Create Account
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3 }}>
          © 2024 Contact Center v2. Powered by Telnyx.
        </Typography>
      </Box>
    </Container>
  );
}

export default LoginPage;
