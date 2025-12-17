'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Box } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { useAuth } from '@/contexts/AuthContext';
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
      const message = event.message || event.error?.message || '';
      if (message.includes("The mark 'peer-creation-start' does not exist") ||
          message.includes("does not exist") ||
          message.includes("measure") ||
          message.includes("Performance")) {
        console.warn('Suppressed Telnyx SDK performance metrics error');
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason?.message || event.reason;
      if (typeof error === 'string' && (
        error.includes("The mark 'peer-creation-start' does not exist") ||
        error.includes("does not exist") ||
        error.includes("measure") ||
        error.includes("Performance")
      )) {
        console.warn('Suppressed Telnyx SDK performance metrics promise rejection');
        event.preventDefault();
        return;
      }
    };

    // Override console.error to suppress performance metrics errors
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      if (message.includes("The mark 'peer-creation-start' does not exist") ||
          message.includes("Failed to execute 'measure' on 'Performance'")) {
        // Silently ignore these errors
        return;
      }
      originalConsoleError.apply(console, args);
    };

    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      // Restore original window.open and console.error
      window.open = originalWindowOpen;
      console.error = originalConsoleError;
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
    </ThemeProvider>
  );
};

export default Dashboard;
