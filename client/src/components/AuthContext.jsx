import React, { createContext, useContext, useState, useEffect } from 'react';
import jwt_decode from 'jwt-decode';

export const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [username, setUsername] = useState(""); 
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const checkLoginStatus = () => {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const decodedToken = jwt_decode(token);
          console.log('Decoded Token:', decodedToken);
          // Check if token is expired
          const isTokenExpired = decodedToken.exp * 1000 < Date.now();
          console.log('Is Token Expired:', isTokenExpired); // Debug token expiry

          if (!isTokenExpired) {
            setUsername(decodedToken.username);
            setIsLoggedIn(true);
            console.log(decodedToken.username);
          } else {
            // Handle token expiration
            setIsLoggedIn(false);
            localStorage.removeItem('token');
            setUsername(""); // Reset username to empty string
          }
        } catch (error) {
          console.error('Error decoding token:', error);
          // Handle decoding error
          setIsLoggedIn(false);
          localStorage.removeItem('token');
          setUsername(""); // Reset username to empty string
        }
      } else {
        setIsLoggedIn(false);
        setUsername(""); // Reset username to empty string
      }
      setIsLoading(false);
    };

    checkLoginStatus();
  }, [token]);

  const value = {
    isLoggedIn,
    isOnline,
    setIsLoggedIn,
    setIsOnline,
    username,
    isLoading,
    setToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
