'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { getApiBaseUrl } from '@/utils/apiUtils';

interface SIPCredentials {
  login: string;
  password: string;
  phoneNumbers?: string[];
}

export const SIPCredentialsContext = createContext<SIPCredentials | null>(null);

export const SIPCredentialsProvider = ({ children }: { children: ReactNode }) => {
  const [sipCredentials, setSipCredentials] = useState<SIPCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
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

        // Fetch both SIP credentials and phone numbers
        Promise.all([
          axios.get(`${getApiBaseUrl()}/api/users/sip-credentials`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }),
          axios.get(`${getApiBaseUrl()}/api/users/phone-numbers`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          })
        ])
          .then(([sipResponse, numbersResponse]) => {
            console.log('SIPCredentialsProvider: Received SIP credentials:', sipResponse.data);
            console.log('SIPCredentialsProvider: Received phone numbers:', numbersResponse.data);
            const credentials = {
              login: sipResponse.data.sipUsername,
              password: sipResponse.data.sipPassword,
              phoneNumbers: numbersResponse.data || [],
            };
            setSipCredentials(credentials);
            setLoading(false);
          })
          .catch((error) => {
            console.error('SIPCredentialsProvider: Error fetching credentials:', error);
            setError(error);
            setLoading(false);

            // Check if it's an authentication error
            if (error.response && error.response.status === 401) {
              console.log('SIPCredentialsProvider: Authentication failed, clearing token');
              localStorage.removeItem('token');
              setSipCredentials(null);
            } else {
              // Set fallback credentials for other errors to prevent infinite loading
              console.log('SIPCredentialsProvider: Setting fallback credentials due to error');
              setSipCredentials({
                login: 'phillip1995',
                password: 'avaya123',
                phoneNumbers: [],
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

  // Don't block rendering - let the app load with null credentials
  // Components that need credentials can handle the null case
  console.log('SIPCredentialsProvider: Rendering with credentials:', !!sipCredentials, 'loading:', loading);
  return <SIPCredentialsContext.Provider value={sipCredentials}>{children}</SIPCredentialsContext.Provider>;
};
