import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [username, setUsername] = useState(""); 
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('token');
    } catch (error) {
      console.error('AuthContext: Error accessing localStorage during initialization:', error);
      return null;
    }
  });

  useEffect(() => {
    const checkLoginStatus = () => {
      console.log('AuthContext: Starting login check');
      setIsLoading(true);
      
      try {
        // Add safety check for localStorage availability (Safari private mode issue)
        let token = null;
        try {
          token = localStorage.getItem('token');
        } catch (localStorageError) {
          console.error('AuthContext: localStorage not available:', localStorageError);
          setIsLoggedIn(false);
          setUsername("");
          setIsLoading(false);
          return;
        }
        
        console.log('AuthContext: Token from localStorage:', token ? 'exists' : 'none');
        
        if (token) {
          try {
            console.log('AuthContext: About to decode token with jwtDecode');
            const decodedToken = jwtDecode(token);
            console.log('AuthContext: Successfully decoded token:', decodedToken);
            
            // Check if token is expired
            const isTokenExpired = decodedToken.exp * 1000 < Date.now();
            console.log('AuthContext: Is Token Expired:', isTokenExpired);

            if (!isTokenExpired) {
              setUsername(decodedToken.username);
              setIsLoggedIn(true);
              console.log('AuthContext: Set user as logged in:', decodedToken.username);
            } else {
              // Handle token expiration
              console.log('AuthContext: Token expired, clearing auth state');
              setIsLoggedIn(false);
              localStorage.removeItem('token');
              setUsername("");
            }
          } catch (error) {
            console.error('AuthContext: Error decoding token:', error);
            // Handle decoding error
            setIsLoggedIn(false);
            localStorage.removeItem('token');
            setUsername("");
          }
        } else {
          console.log('AuthContext: No token found, setting not logged in');
          setIsLoggedIn(false);
          setUsername("");
        }
      } catch (error) {
        console.error('AuthContext: Unexpected error in checkLoginStatus:', error);
        setIsLoggedIn(false);
        setUsername("");
      } finally {
        console.log('AuthContext: Login check completed, setting loading to false');
        setIsLoading(false);
      }
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
