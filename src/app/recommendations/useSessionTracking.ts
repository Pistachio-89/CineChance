// src/app/recommendations/useSessionTracking.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface SessionFlow {
  recommendationsShown: number;
  filtersChangedCount: number;
  modalOpenedCount: number;
  actionsCount: number;
  recommendationsAccepted: number;
  recommendationsSkipped: number;
  [key: string]: unknown;
}

interface FilterChange {
  timestamp: string;
  parameterName: string;
  previousValue: unknown;
  newValue: unknown;
  changeSource: 'user_input' | 'preset' | 'api' | 'reset';
  [key: string]: unknown;
}

interface UserSessionResponse {
  success: boolean;
  sessionId: string;
  isNew: boolean;
}

interface EventResponse {
  success: boolean;
  eventId: string;
}

interface SignalResponse {
  success: boolean;
  signalId: string;
}

interface FilterSessionResponse {
  success: boolean;
  filterSessionId: string;
}

export function useSessionTracking(userId: string, logId: string | null) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [filterSessionId, setFilterSessionId] = useState<string | null>(null);

  // Метрики сессии
  const sessionMetrics = useRef<SessionFlow>({
    recommendationsShown: 0,
    filtersChangedCount: 0,
    modalOpenedCount: 0,
    actionsCount: 0,
    recommendationsAccepted: 0,
    recommendationsSkipped: 0,
  });

  const filterChanges = useRef<FilterChange[]>([]);
  const sessionStartTime = useRef<number>(0);

  // Получение или создание сессии пользователя
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch('/api/recommendations/user-sessions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        // Проверяем, что ответ - JSON (а не редирект)
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Non-JSON response from user-sessions API');
          return;
        }

        const data: UserSessionResponse = await res.json();
        if (data.success) {
          setSessionId(data.sessionId);
          sessionStartTime.current = Date.now();
        }
      } catch (err) {
        console.error('Error initializing session:', err);
      }
    };

    if (userId) {
      initSession();
    }

    // Завершение сессии при уходе со страницы
    return () => {
      if (sessionId) {
        endSession();
      }
    };
  }, [userId, sessionId]);

  // Завершение сессии
  const endSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      const durationMs = Date.now() - sessionStartTime.current;
      await fetch('/api/recommendations/user-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sessionFlow: sessionMetrics.current,
          durationMs,
          endedAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Error ending session:', err);
    }
  }, [sessionId]);

  // Запись события
  const trackEvent = useCallback(async (
    eventType: string,
    eventData?: Record<string, unknown>
  ) => {
    if (!sessionId) return;

    try {
      await fetch('/api/recommendations/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId,
          recommendationLogId: logId || undefined,
          eventType,
          eventData,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Error tracking event:', err);
    }
  }, [userId, sessionId, logId]);

  // Запись сигнала намерения
  const trackSignal = useCallback(async (
    signalType: string,
    elementContext?: { elementType: string; elementPosition: { x: number; y: number; viewportPercentage: number }; elementVisibility: number },
    rawSignals?: Record<string, unknown>
  ) => {
    if (!sessionId) return;

    try {
      const now = Date.now();
      const temporalContext = logId ? {
        timeSinceShownMs: now - sessionStartTime.current,
        timeSinceSessionStartMs: now - sessionStartTime.current,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
      } : undefined;

      await fetch('/api/recommendations/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId,
          recommendationLogId: logId || undefined,
          signalType,
          elementContext,
          temporalContext,
          rawSignals,
        }),
      });
    } catch (err) {
      console.error('Error tracking signal:', err);
    }
  }, [userId, sessionId, logId]);

  // Начало сессии фильтров
  const startFilterSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch('/api/recommendations/filter-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId,
          initialFilters: {
            types: ['movie', 'tv', 'anime'],
            lists: ['want', 'watched'],
          },
        }),
      });
      const data: FilterSessionResponse = await res.json();
      if (data.success) {
        setFilterSessionId(data.filterSessionId);
        filterChanges.current = [];
      }
    } catch (err) {
      console.error('Error starting filter session:', err);
    }
  }, [userId, sessionId]);

  // Запись изменения фильтра
  const trackFilterChange = useCallback(async (
    parameterName: string,
    previousValue: unknown,
    newValue: unknown
  ) => {
    if (!sessionId) return;

    const change: FilterChange = {
      timestamp: new Date().toISOString(),
      parameterName,
      previousValue,
      newValue,
      changeSource: 'user_input',
    };

    filterChanges.current.push(change);
    sessionMetrics.current.filtersChangedCount++;

    // Записываем событие
    await trackEvent('filter_change', change);

    // Обновляем сессию фильтров
    if (filterSessionId) {
      try {
        await fetch('/api/recommendations/filter-sessions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filterSessionId,
            filterChanges: filterChanges.current,
          }),
        });
      } catch (err) {
        console.error('Error updating filter session:', err);
      }
    }
  }, [sessionId, filterSessionId, trackEvent]);

  // Отслеживание открытия модального окна
  const handleModalOpen = useCallback(() => {
    sessionMetrics.current.modalOpenedCount++;
    trackEvent('action_click', {
      action: 'open_details',
      timeSinceShownMs: 0, // Will be set by caller
    });
    trackSignal('element_visible', {
      elementType: 'overview',
      elementPosition: { x: 0, y: 0, viewportPercentage: 100 },
      elementVisibility: 1,
    });
  }, [trackEvent, trackSignal]);

  // Методы для обновления метрик
  const incrementRecommendationsShown = useCallback(() => {
    sessionMetrics.current.recommendationsShown++;
  }, []);

  const incrementActionsCount = useCallback(() => {
    sessionMetrics.current.actionsCount++;
  }, []);

  const incrementRecommendationsAccepted = useCallback(() => {
    sessionMetrics.current.recommendationsAccepted++;
  }, []);

  const incrementRecommendationsSkipped = useCallback(() => {
    sessionMetrics.current.recommendationsSkipped++;
  }, []);

  return {
    sessionId,
    filterSessionId,
    trackEvent,
    trackSignal,
    startFilterSession,
    trackFilterChange,
    handleModalOpen,
    incrementRecommendationsShown,
    incrementActionsCount,
    incrementRecommendationsAccepted,
    incrementRecommendationsSkipped,
    endSession,
  };
}