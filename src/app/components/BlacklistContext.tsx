// src/app/components/BlacklistContext.tsx
'use client';
 

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface BlacklistContextType {
  blacklistedIds: Set<number>;
  isLoading: boolean;
  checkBlacklist: (tmdbId: number) => boolean;
}

const BlacklistContext = createContext<BlacklistContextType>({
  blacklistedIds: new Set(),
  isLoading: true,
  checkBlacklist: () => false,
});

export function BlacklistProvider({ children }: { children: ReactNode }) {
  const [blacklistedIds, setBlacklistedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Single batch request to fetch all blacklisted IDs
    const fetchBlacklist = async () => {
      try {
        const res = await fetch('/api/blacklist/all');
        if (res.ok) {
          const ids = await res.json();
          setBlacklistedIds(new Set(ids));
        }
      } catch (error) {
        logger.error('Failed to fetch blacklist', { error: error instanceof Error ? error.message : String(error) });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlacklist();
  }, []);

  const checkBlacklist = (tmdbId: number): boolean => {
    return blacklistedIds.has(tmdbId);
  };

  return (
    <BlacklistContext.Provider value={{ blacklistedIds, isLoading, checkBlacklist }}>
      {children}
    </BlacklistContext.Provider>
  );
}

export function useBlacklist() {
  return useContext(BlacklistContext);
}
