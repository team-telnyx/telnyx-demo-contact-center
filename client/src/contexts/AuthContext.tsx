'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

interface AuthContextType {
  isLoggedIn: boolean;
  isOnline: boolean;
  setIsLoggedIn: (value: boolean) => void;
  setIsOnline: (value: boolean) => void;
  username: string;
  isLoading: boolean;
  loginWithToken: (token: string) => Promise<boolean>;
  logout: () => void;
}

interface DecodedToken {
  username: string;
  exp: number;
  [key: string]: any;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = () => {
      console.log('AuthContext: Initializing auth state');
      setIsLoading(true);

      try {
        if (typeof window === 'undefined') {
          setIsLoading(false);
          return;
        }

        const token = localStorage.getItem('token');
        console.log('AuthContext: Token from localStorage:', token ? 'exists' : 'none');

        if (token) {
          try {
            const decodedToken = jwtDecode<DecodedToken>(token);
            const isTokenExpired = decodedToken.exp * 1000 < Date.now();

            if (!isTokenExpired) {
              setUsername(decodedToken.username);
              setIsLoggedIn(true);
              // Also set token in cookie for middleware
              document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
              console.log('AuthContext: User authenticated:', decodedToken.username);
            } else {
              localStorage.removeItem('token');
              document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
              setIsLoggedIn(false);
              setUsername("");
              console.log('AuthContext: Token expired, cleared');
            }
          } catch (error) {
            console.error('AuthContext: Token decode error:', error);
            localStorage.removeItem('token');
            setIsLoggedIn(false);
            setUsername("");
          }
        } else {
          setIsLoggedIn(false);
          setUsername("");
        }
      } catch (error) {
        console.error('AuthContext: Initialization error:', error);
        setIsLoggedIn(false);
        setUsername("");
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []); // Only run on mount

  const loginWithToken = async (token: string): Promise<boolean> => {
    console.log('AuthContext: loginWithToken called');

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
        // Also set token in cookie for middleware
        document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      }

      const decodedToken = jwtDecode<DecodedToken>(token);
      const isTokenExpired = decodedToken.exp * 1000 < Date.now();

      if (!isTokenExpired) {
        setUsername(decodedToken.username);
        setIsLoggedIn(true);
        setIsLoading(false);
        console.log('AuthContext: loginWithToken successful for user:', decodedToken.username);
        return true;
      } else {
        console.log('AuthContext: loginWithToken - token expired');
        return false;
      }
    } catch (error) {
      console.error('AuthContext: loginWithToken error:', error);
      return false;
    }
  };

  const logout = () => {
    console.log('AuthContext: Logging out');
    setIsLoggedIn(false);
    setUsername("");
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  };

  const value: AuthContextType = {
    isLoggedIn,
    isOnline,
    setIsLoggedIn,
    setIsOnline,
    username,
    isLoading,
    loginWithToken,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};