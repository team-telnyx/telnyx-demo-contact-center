import React, { useState, useEffect, useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, useRoutes, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from './components/Theme';
import DashboardHeader from './components/DashboardHeader';
import SideNav from './components/SideNav';
import MainContent from './components/MainContent';
import PhonePage from './components/PhonePage';
import SmsPage from './components/SmsPage';
import MessageQueue from './components/MessageQueue';
import LoginPage from './components/LoginPage';
import Profile from './components/Profile';
import RegisterPage from './components/RegisterPage';
import { AuthProvider, useAuth } from './components/AuthContext';
import { UnreadCountProvider, useUnreadCount } from './components/UnreadCount';
import 'semantic-ui-css/semantic.min.css';
import { ModalProvider, ModalContext } from './components/ModalContext';
import CustomModal from './components/Modal';
import { TelnyxRTCProvider } from '@telnyx/react-client';
import { io } from "socket.io-client";
import { SIPCredentialsProvider, SIPCredentialsContext } from './components/SIPCredentialsContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <ThemeProvider theme={theme}>
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
  if (!sipCredentials) {
    return <div>Loading...</div>; // Show loading until sipCredentials are fetched
  }

  return (
    <TelnyxRTCProvider credential={sipCredentials}>
      <ModalProvider>
        <UnreadCountProvider>
          <AppContent />
        </UnreadCountProvider>
      </ModalProvider>
    </TelnyxRTCProvider>
  );
}

function AppContent() {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount, setUnreadCount, setQueueUnreadCount, setCallQueueUnreadCount } = useUnreadCount();
  const { username } = useAuth();
  
  useEffect(() => {
    const socket = io("https://osbs.ca:3000");

    socket.on("connect", () => {
      console.log('Connected to the server');
    });

    socket.on("NEW_MESSAGE", (msg) => {
      if (msg.isAssigned && msg.assignedAgent === username) {
      setUnreadCount(prevCount => prevCount + 1);
      }
    });

    socket.on("NEW_CONVERSATION", (msg) => {
      setQueueUnreadCount(prevCount => prevCount + 1);
    });

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
      <CustomModal />
      <DashboardHeader setIsOpen={setIsOpen} isOpen={isOpen} />
      <SideNav isOpen={isOpen} unreadCount={unreadCount} />
      <div style={{ padding: theme.spacing(8, 2, 0, 2), width: '100%' }}>
        <Routes>
          <Route path="dashboard" element={<MainContent isOpen={isOpen} />} />
          <Route path="phone" element={<PhonePage isOpen={isOpen} />} />
          <Route path="sms" element={<SmsPage isOpen={isOpen} />} />
          <Route path="message_queue" element={<MessageQueue isOpen={isOpen} />} />
          <Route path="update-user-settings" element={<Profile isOpen={isOpen}/>} />
          <Route path="view-profile" element={<Profile isOpen={isOpen}/>} />
        </Routes>
      </div>
    </>
  );
}

export default App;