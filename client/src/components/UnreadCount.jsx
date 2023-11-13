import React, { createContext, useContext, useState } from 'react';

const UnreadCountContext = createContext();

export function UnreadCountProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0); 
  const [queueUnreadCount, setQueueUnreadCount] = useState(0); // New state
  const [callQueueUnreadCount, setCallQueueUnreadCount] = useState(0);
  return (
    <UnreadCountContext.Provider value={{ unreadCount, setUnreadCount, queueUnreadCount, setQueueUnreadCount, callQueueUnreadCount, setCallQueueUnreadCount }}>
      {children}
    </UnreadCountContext.Provider>
  );
}

export function useUnreadCount() {
  const context = useContext(UnreadCountContext);
  if (!context) {
    throw new Error('useUnreadCount must be used within an UnreadCountProvider');
  }
  return context;
}
