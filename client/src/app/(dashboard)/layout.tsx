'use client';

import React, { ReactNode } from 'react';
import Dashboard from '@/components/Dashboard';
import ProtectedRoute from '@/components/ProtectedRoute';
import { CallManagerProvider } from '@/contexts/CallManagerContext';
import { ConversationManagerProvider } from '@/contexts/ConversationManagerContext';
import { EnhancedModalProvider } from '@/contexts/EnhancedModalContext';
import { SIPCredentialsProvider, SIPCredentialsContext } from '@/contexts/SIPCredentialsContext';
import { PhoneUiProvider } from '@/contexts/PhoneUiProvider';
import { UnreadCountProvider } from '@/hooks/useUnreadCount';
import { DataCacheProvider } from '@/contexts/DataCacheContext';
import { useAuth } from '@/contexts/AuthContext';
import { TelnyxRTCContext } from '@telnyx/react-client';

// Wrapper component that initializes TelnyxRTC with credentials from context
const TelnyxRTCWrapper: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [client, setClient] = React.useState<any>(null);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const sipCredentials = React.useContext(SIPCredentialsContext);

  // Initialize and connect TelnyxRTC client
  React.useEffect(() => {
    if (typeof window !== 'undefined' && sipCredentials && !client && !isConnecting) {
      setIsConnecting(true);
      console.log('TelnyxRTCWrapper: Initializing with credentials:', {
        login: sipCredentials.login,
        hasPassword: !!sipCredentials.password
      });

      import('@telnyx/webrtc').then(({ TelnyxRTC }) => {
        try {
          const telnyxClient = new TelnyxRTC({
            login: sipCredentials.login,
            password: sipCredentials.password,
            debug: false,
          });

          console.log('TelnyxRTC client created, connecting...');
          telnyxClient.connect();
          console.log('TelnyxRTC client connect() called');

          setClient(telnyxClient);
          setIsConnecting(false);

          console.log('✅ TelnyxRTC client initialized and connecting');
        } catch (err) {
          console.error('❌ Failed to initialize TelnyxRTC:', err);
          setIsConnecting(false);
        }
      });
    }
  }, [sipCredentials, client, isConnecting]);

  // Monitor client connection status
  React.useEffect(() => {
    if (client) {
      const checkStatus = setInterval(() => {
        console.log('TelnyxRTC Status Check:', {
          connected: client.connected,
          ready: client._client ? 'Client exists' : 'No client',
        });
      }, 10000);

      return () => clearInterval(checkStatus);
    }
  }, [client]);

  return <TelnyxRTCContext.Provider value={client}>{children}</TelnyxRTCContext.Provider>;
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { username } = useAuth();

  return (
    <ProtectedRoute>
      <SIPCredentialsProvider>
        <TelnyxRTCWrapper>
          <UnreadCountProvider>
            <DataCacheProvider>
              <CallManagerProvider username={username}>
                <ConversationManagerProvider>
                  <EnhancedModalProvider>
                    <PhoneUiProvider>
                      <Dashboard>
                        {children}
                      </Dashboard>
                    </PhoneUiProvider>
                  </EnhancedModalProvider>
                </ConversationManagerProvider>
              </CallManagerProvider>
            </DataCacheProvider>
          </UnreadCountProvider>
        </TelnyxRTCWrapper>
      </SIPCredentialsProvider>
    </ProtectedRoute>
  );
}
