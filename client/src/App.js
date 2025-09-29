import React, { useState, useEffect, useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './components/Theme';
import DashboardHeader from './components/DashboardHeader';
import SideNav from './components/SideNav';
import MainContent from './components/MainContent';
import PhonePage from './components/PhonePage';
import SmsPage from './components/SmsPage';
import LoginPage from './components/LoginPage';
import Profile from './components/Profile';
import RegisterPage from './components/RegisterPage';
import { AuthProvider, useAuth } from './components/AuthContext';
import { UnreadCountProvider, useUnreadCount } from './components/UnreadCount';
import { CallManagerProvider } from './contexts/CallManagerContext';
import { EnhancedModalProvider } from './components/EnhancedModalContext';
import UniversalCallModal from './components/UniversalCallModal';
import { TelnyxRTCProvider } from '@telnyx/react-client';
import { io } from "socket.io-client";
import { SIPCredentialsProvider, SIPCredentialsContext } from './components/SIPCredentialsContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </ThemeProvider>
      </Router>
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const { isLoggedIn, isLoading } = useAuth();


  if (isLoading) {
    return <div>Loading...</div>; // Show loading indicator
  }

  if (!isLoggedIn) {
    // Redirect to login if not logged in
    return <Navigate to="/login" replace />
  }

  return (
    <SIPCredentialsProvider>
      <TelnyxRTCProviderWrapper />
    </SIPCredentialsProvider>
  );
}

function TelnyxRTCProviderWrapper() {
  const sipCredentials = useContext(SIPCredentialsContext);
  const { isLoggedIn } = useAuth();
  
  console.log('TelnyxRTCProviderWrapper: sipCredentials:', sipCredentials);
  console.log('TelnyxRTCProviderWrapper: isLoggedIn:', isLoggedIn);
  
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  
  if (!sipCredentials) {
    return <div>Loading WebRTC credentials...</div>;
  }

  return (
    <TelnyxRTCProvider credential={sipCredentials}>
      <CallManagerProvider>
        <EnhancedModalProvider>
          <UnreadCountProvider>
            <AppContent />
          </UnreadCountProvider>
        </EnhancedModalProvider>
      </CallManagerProvider>
    </TelnyxRTCProvider>
  );
}

function AppContent() {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount, setUnreadCount, setQueueUnreadCount, setCallQueueUnreadCount } = useUnreadCount();
  const { username } = useAuth();
  
  useEffect(() => {
    const socket = io(`https://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}`);

    socket.on("connect", () => {
      console.log('App.js: Connected to the server');
      console.log('App.js: Socket ID:', socket.id);
    });

    socket.on("NEW_MESSAGE", (msg) => {
      console.log('App.js: NEW_MESSAGE received:', msg);
      if (msg.isAssigned && msg.assignedAgent === username) {
      setUnreadCount(prevCount => prevCount + 1);
      }
    });

    socket.on("NEW_CONVERSATION", (msg) => {
      console.log('App.js: NEW_CONVERSATION received:', msg);
      setQueueUnreadCount(prevCount => prevCount + 1);
    });

    // NOTE: NEW_CALL is now handled by CallManagerProvider
    // but we still update the unread count for UI badges
    socket.on("NEW_CALL", (msg) => {
      setCallQueueUnreadCount(prevCount => prevCount + 1);
    });

    socket.on("disconnect", () => {
      console.log('Disconnected from the server');
    });

    return () => socket.disconnect();
  }, []);

  return (
    <>
      {/* New Universal Call Modal - works across all pages */}
      <UniversalCallModal />
      
      <DashboardHeader setIsOpen={setIsOpen} isOpen={isOpen} />
      <SideNav isOpen={isOpen} unreadCount={unreadCount} />
      <div style={{ padding: theme.spacing(8, 2, 0, 2), width: '100%' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<MainContent isOpen={isOpen} />} />
          <Route path="phone" element={<PhonePage isOpen={isOpen} />} />
          <Route path="sms" element={<SmsPage isOpen={isOpen} />} />
          <Route path="update-user-settings" element={<Profile isOpen={isOpen}/>} />
          <Route path="view-profile" element={<Profile isOpen={isOpen}/>} />
        </Routes>
      </div>
    </>
  );
}

export default App;
