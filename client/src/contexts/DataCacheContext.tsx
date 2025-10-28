'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import apiService from '@/services/apiService';

interface CachedData {
  agents: any[] | null;
  agentNumbers: any[] | null;
  conversations: any[] | null;
  lastFetch: {
    agents: number;
    agentNumbers: number;
    conversations: number;
  };
}

interface DataCacheContextType {
  getCachedAgents: () => Promise<any[]>;
  getCachedAgentNumbers: (username: string) => Promise<any[]>;
  getCachedConversations: () => Promise<any[]>;
  invalidateAgents: () => void;
  invalidateAgentNumbers: () => void;
  invalidateConversations: () => void;
  invalidateAll: () => void;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

const CACHE_DURATION = 30000; // 30 seconds

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<CachedData>({
    agents: null,
    agentNumbers: null,
    conversations: null,
    lastFetch: {
      agents: 0,
      agentNumbers: 0,
      conversations: 0,
    },
  });

  const getCachedAgents = useCallback(async () => {
    const now = Date.now();
    const isCacheValid = cache.agents && now - cache.lastFetch.agents < CACHE_DURATION;

    if (isCacheValid) {
      console.log('📦 Using cached agents data');
      return cache.agents!;
    }

    console.log('🔄 Fetching fresh agents data');
    const agents = await apiService.getAgents();
    setCache((prev) => ({
      ...prev,
      agents,
      lastFetch: { ...prev.lastFetch, agents: now },
    }));
    return agents;
  }, [cache.agents, cache.lastFetch.agents]);

  const getCachedAgentNumbers = useCallback(
    async (username: string) => {
      const now = Date.now();
      const isCacheValid = cache.agentNumbers && now - cache.lastFetch.agentNumbers < CACHE_DURATION;

      if (isCacheValid) {
        console.log('📦 Using cached agent numbers');
        return cache.agentNumbers!;
      }

      console.log('🔄 Fetching fresh agent numbers');
      const numbers = await apiService.getAgentsWithTag(username, 1, 50);
      setCache((prev) => ({
        ...prev,
        agentNumbers: numbers.data || [],
        lastFetch: { ...prev.lastFetch, agentNumbers: now },
      }));
      return numbers.data || [];
    },
    [cache.agentNumbers, cache.lastFetch.agentNumbers]
  );

  const getCachedConversations = useCallback(async () => {
    const now = Date.now();
    const isCacheValid = cache.conversations && now - cache.lastFetch.conversations < CACHE_DURATION;

    if (isCacheValid) {
      console.log('📦 Using cached conversations');
      return cache.conversations!;
    }

    console.log('🔄 Fetching fresh conversations');
    const conversations = await apiService.getConversations();
    setCache((prev) => ({
      ...prev,
      conversations,
      lastFetch: { ...prev.lastFetch, conversations: now },
    }));
    return conversations;
  }, [cache.conversations, cache.lastFetch.conversations]);

  const invalidateAgents = useCallback(() => {
    setCache((prev) => ({
      ...prev,
      agents: null,
      lastFetch: { ...prev.lastFetch, agents: 0 },
    }));
  }, []);

  const invalidateAgentNumbers = useCallback(() => {
    setCache((prev) => ({
      ...prev,
      agentNumbers: null,
      lastFetch: { ...prev.lastFetch, agentNumbers: 0 },
    }));
  }, []);

  const invalidateConversations = useCallback(() => {
    setCache((prev) => ({
      ...prev,
      conversations: null,
      lastFetch: { ...prev.lastFetch, conversations: 0 },
    }));
  }, []);

  const invalidateAll = useCallback(() => {
    setCache({
      agents: null,
      agentNumbers: null,
      conversations: null,
      lastFetch: {
        agents: 0,
        agentNumbers: 0,
        conversations: 0,
      },
    });
  }, []);

  return (
    <DataCacheContext.Provider
      value={{
        getCachedAgents,
        getCachedAgentNumbers,
        getCachedConversations,
        invalidateAgents,
        invalidateAgentNumbers,
        invalidateConversations,
        invalidateAll,
      }}
    >
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache must be used within DataCacheProvider');
  }
  return context;
}
