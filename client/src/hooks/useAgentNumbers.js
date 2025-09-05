import { useState, useEffect } from 'react';
import apiService from '../services/apiService';

export const useAgentNumbers = (username) => {
  const [agentNumbers, setAgentNumbers] = useState([]);
  const [callerNumber, setCallerNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAgentNumbers = async () => {
      if (!username) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiService.getAgentsWithTag(username);
        const numbers = response.data || [];
        
        setAgentNumbers(numbers);
        if (numbers.length > 0) {
          setCallerNumber(numbers[0]); // Set default caller number
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching agent numbers:', err);
        setError(err.message || 'Failed to fetch agent numbers');
        setAgentNumbers([]);
        setCallerNumber('');
      } finally {
        setLoading(false);
      }
    };

    fetchAgentNumbers();
  }, [username]);

  const refreshAgentNumbers = async () => {
    if (!username) return;
    
    try {
      const response = await apiService.getAgentsWithTag(username);
      const numbers = response.data || [];
      setAgentNumbers(numbers);
      if (numbers.length > 0 && !callerNumber) {
        setCallerNumber(numbers[0]);
      }
    } catch (err) {
      console.error('Error refreshing agent numbers:', err);
    }
  };

  return {
    agentNumbers,
    callerNumber,
    setCallerNumber,
    loading,
    error,
    refreshAgentNumbers
  };
};