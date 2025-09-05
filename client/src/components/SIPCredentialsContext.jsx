import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { getApiBaseUrl } from '../utils/apiUtils';
export const SIPCredentialsContext = createContext();

export const SIPCredentialsProvider = ({ children }) => {
  const [sipCredentials, setSipCredentials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    console.log('SIPCredentialsProvider: isLoggedIn changed:', isLoggedIn);
    
    if (isLoggedIn) {
      const authToken = localStorage.getItem('token');
      console.log('SIPCredentialsProvider: authToken exists:', !!authToken);
      
      if (authToken) {
        console.log('SIPCredentialsProvider: Fetching SIP credentials...');
        setLoading(true);
        setError(null);
        
        axios.get(`${getApiBaseUrl()}/api/users/sip-credentials`, {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        })
        .then(response => {
          console.log('SIPCredentialsProvider: Received SIP credentials:', response.data);
          const credentials = {
            login: response.data.sipUsername,
            password: response.data.sipPassword
          };
          setSipCredentials(credentials);
          setLoading(false);
        })
        .catch(error => {
          console.error('SIPCredentialsProvider: Error fetching SIP credentials:', error);
          setError(error);
          setLoading(false);
          
          // Check if it's an authentication error
          if (error.response && error.response.status === 401) {
            console.log('SIPCredentialsProvider: Authentication failed, clearing token');
            localStorage.removeItem('token');
            // Don't set fallback credentials for auth errors
            setSipCredentials(null);
          } else {
            // Set fallback credentials for other errors to prevent infinite loading
            console.log('SIPCredentialsProvider: Setting fallback credentials due to error');
            setSipCredentials({
              login: 'phillip1995',
              password: 'avaya123'
            });
          }
        });
      } else {
        console.log('SIPCredentialsProvider: No auth token, setting loading false');
        setLoading(false);
      }
    } else {
      console.log('SIPCredentialsProvider: Not logged in, clearing credentials');
      setSipCredentials(null);
      setLoading(false);
    }
  }, [isLoggedIn]);

  if (loading) {
    console.log('SIPCredentialsProvider: Still loading...');
    return <div>Loading SIP credentials...</div>;
  }

  if (error && !sipCredentials) {
    console.log('SIPCredentialsProvider: Error and no credentials');
    return <div>Error loading SIP credentials: {error.message}</div>;
  }

  console.log('SIPCredentialsProvider: Rendering children with credentials:', !!sipCredentials);
  return (
    <SIPCredentialsContext.Provider value={sipCredentials}>
      {children}
    </SIPCredentialsContext.Provider>
  );
};
