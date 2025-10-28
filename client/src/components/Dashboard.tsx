'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Box, Container } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { CallManagerProvider } from '@/contexts/CallManagerContext';
import { EnhancedModalProvider } from '@/contexts/EnhancedModalContext';
import { SIPCredentialsProvider, SIPCredentialsContext } from '@/contexts/SIPCredentialsContext';
import { PhoneUiProvider } from '@/contexts/PhoneUiProvider';
import { UnreadCountProvider } from '@/hooks/useUnreadCount';
import { DataCacheProvider } from '@/contexts/DataCacheContext';
import { useAuth } from '@/contexts/AuthContext';
import { TelnyxRTCContext } from '@telnyx/react-client';
import DashboardHeader from './DashboardHeader';
import SideNav from './SideNav';
import Softphone from './Softphone';
import theme from '@/theme/Theme';

interface DashboardProps {
  children: ReactNode;
}

const SIDEBAR_WIDTH_OPEN = 280;
const SIDEBAR_WIDTH_CLOSED = 80;
const HEADER_HEIGHT = 70;

const Dashboard: React.FC<DashboardProps> = ({ children }) => {
  const { username } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    // Intercept window.open to detect what's causing blank tab
    const originalWindowOpen = window.open;
    (window as any).open = function(...args: any[]) {
      console.error('🚨🚨🚨 window.open CALLED 🚨🚨🚨');
      console.error('🚨 Arguments:', args);
      console.error('🚨 Stack trace:', new Error().stack);
      console.error('🚨🚨🚨 END window.open 🚨🚨🚨');
      return originalWindowOpen.apply(window, args);
    };

    // Add global error handler to suppress Telnyx SDK performance metrics errors
    const handleError = (event: ErrorEvent) => {
      if (event.message && event.message.includes("The mark 'peer-creation-start' does not exist")) {
        console.warn('Suppressed Telnyx SDK performance metrics error:', event.message);
        event.preventDefault();
        return true;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason?.message || event.reason;
      if (typeof error === 'string' && error.includes("The mark 'peer-creation-start' does not exist")) {
        console.warn('Suppressed Telnyx SDK performance metrics promise rejection:', error);
        event.preventDefault();
        return;
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      // Restore original window.open
      window.open = originalWindowOpen;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SIPCredentialsProvider>
        <TelnyxRTCWrapper>
          <UnreadCountProvider>
            <DataCacheProvider>
              <CallManagerProvider username={username}>
                <EnhancedModalProvider>
                  <PhoneUiProvider>
                  <Box
                    sx={{
                      minHeight: '100vh',
                      display: 'flex',
                      flexDirection: 'column',
                      bgcolor: 'background.default',
                    }}
                  >
                    {/* Header */}
                    <DashboardHeader onToggleSidebar={toggleSidebar} isOpen={isOpen} />

                    {/* Main Layout */}
                    <Box
                      sx={{
                        display: 'flex',
                        flex: 1,
                        pt: `${HEADER_HEIGHT}px`,
                      }}
                    >
                      {/* Sidebar */}
                      <SideNav isOpen={isOpen} />

                      {/* Main Content Area */}
                      <Box
                        component="main"
                        sx={{
                          flexGrow: 1,
                          minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
                          ml: isOpen ? `${SIDEBAR_WIDTH_OPEN}px` : `${SIDEBAR_WIDTH_CLOSED}px`,
                          transition: (theme) =>
                            theme.transitions.create(['margin'], {
                              easing: theme.transitions.easing.sharp,
                              duration: theme.transitions.duration.leavingScreen,
                            }),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: { xs: 2, sm: 3, md: 4 },
                        }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            maxWidth: '1600px',
                          }}
                        >
                          {children}
                        </Box>
                      </Box>
                    </Box>

                    {/* Softphone */}
                    <Softphone />
                  </Box>
                  </PhoneUiProvider>
                </EnhancedModalProvider>
              </CallManagerProvider>
            </DataCacheProvider>
          </UnreadCountProvider>
        </TelnyxRTCWrapper>
      </SIPCredentialsProvider>
    </ThemeProvider>
  );
};

// Wrapper component that initializes TelnyxRTC with credentials from context
const TelnyxRTCWrapper: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [client, setClient] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const sipCredentials = React.useContext(SIPCredentialsContext);

  // Initialize and connect TelnyxRTC client
  useEffect(() => {
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
            debug: false, // Disable debug mode to prevent performance metrics errors
          });

          console.log('TelnyxRTC client created, connecting...');

          // Connect immediately after creation
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
  useEffect(() => {
    if (client) {
      const checkStatus = setInterval(() => {
        console.log('TelnyxRTC Status Check:', {
          connected: client.connected,
          ready: client._client ? 'Client exists' : 'No client',
        });
      }, 10000); // Check every 10 seconds

      return () => clearInterval(checkStatus);
    }
  }, [client]);

  return <TelnyxRTCContext.Provider value={client}>{children}</TelnyxRTCContext.Provider>;
};

export default Dashboard;
