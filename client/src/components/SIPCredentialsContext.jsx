import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
export const SIPCredentialsContext = createContext();

export const SIPCredentialsProvider = ({ children }) => {
  const [sipCredentials, setSipCredentials] = useState(null);
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn) {
    const authToken = localStorage.getItem('token');
    if (authToken) {
      axios.get(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}/api/users/sip-credentials`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      })
      .then(response => {
        const credentials = {
          login: response.data.sipUsername,
          password: response.data.sipPassword
        };
        setSipCredentials(credentials);
      })
      .catch(error => {
        console.error('Error fetching SIP credentials', error);
      });
    }
  }
}, [isLoggedIn]);

  return (
    <SIPCredentialsContext.Provider value={sipCredentials}>
      {sipCredentials ? children : <div>Loading...</div>}
    </SIPCredentialsContext.Provider>
  );
};
