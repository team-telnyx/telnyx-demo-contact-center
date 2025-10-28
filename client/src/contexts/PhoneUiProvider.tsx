'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PhoneUiContextType {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  selectedFromNumber: string;
  availableNumbers: string[];
  setSelectedFromNumber: (number: string) => void;
  isLoadingNumbers: boolean;
}

const PhoneUiContext = createContext<PhoneUiContextType | undefined>(undefined);

export const usePhoneUi = () => {
  const context = useContext(PhoneUiContext);
  if (!context) {
    throw new Error('usePhoneUi must be used within PhoneUiProvider');
  }
  return context;
};

export const PhoneUiProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>('');
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([]);
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(true);

  const toggle = () => setIsOpen((prev) => !prev);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  // Fetch available phone numbers on mount
  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      try {
        const apiHost = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
        const apiPort = process.env.NEXT_PUBLIC_API_PORT || '3000';
        const protocol = apiHost.startsWith('http') ? '' : 'http://';

        const response = await fetch(`${protocol}${apiHost}:${apiPort}/api/users/phone-numbers`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            setAvailableNumbers(data);

            // Load default phone number from localStorage
            const defaultNumber = localStorage.getItem('defaultPhoneNumber');
            if (defaultNumber && data.includes(defaultNumber)) {
              setSelectedFromNumber(defaultNumber);
            } else if (data[0]) {
              // Fallback to first available number
              setSelectedFromNumber(data[0]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching phone numbers:', error);
      } finally {
        setIsLoadingNumbers(false);
      }
    };

    fetchPhoneNumbers();
  }, []);

  // Listen for profile updates to refresh default number
  useEffect(() => {
    const handleProfileUpdate = () => {
      const defaultNumber = localStorage.getItem('defaultPhoneNumber');
      if (defaultNumber && availableNumbers.includes(defaultNumber)) {
        setSelectedFromNumber(defaultNumber);
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, [availableNumbers]);

  return (
    <PhoneUiContext.Provider
      value={{
        isOpen,
        toggle,
        open,
        close,
        selectedFromNumber,
        availableNumbers,
        setSelectedFromNumber,
        isLoadingNumbers
      }}
    >
      {children}
    </PhoneUiContext.Provider>
  );
};
