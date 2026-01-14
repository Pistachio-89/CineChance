// src/app/recommendations/SessionTracker.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useSessionTracking } from './useSessionTracking';

interface SessionTrackerProps {
  userId: string;
  logId: string | null;
  children: (tracking: ReturnType<typeof useSessionTracking>) => React.ReactNode;
}

export default function SessionTracker({ userId, logId, children }: SessionTrackerProps) {
  const tracking = useSessionTracking(userId, logId);

  // Автоматическое завершение сессии при размонтировании
  useEffect(() => {
    return () => {
      if (tracking.sessionId) {
        tracking.endSession();
      }
    };
  }, [tracking.sessionId, tracking.endSession]);

  return <>{children(tracking)}</>;
}