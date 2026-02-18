// src/app/recommendations/useSessionTracking.ts
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { logger } from '@/lib/logger';

interface SessionFlow {
  recommendationsShown: number;
  filtersChangedCount: number;
  modalOpenedCount: number;
  actionsCount: number;
  recommendationsAccepted: number;
  recommendationsSkipped: number;
  [key: string]: any;
}

interface FilterChange {
  timestamp: string;
  parameterName: string;
  previousValue: any;
  newValue: any;
  changeSource: 'user_input' | 'preset' | 'api' | 'reset';
  [key: string]: any;
}

interface EventPayload {
  userId: string;
  sessionId: string;
  recommendationLogId?: string;
  eventType: string;
  eventData?: Record<string, unknown>;
  timestamp: string;
}

interface SignalPayload {
  userId: string;
  sessionId: string;
  recommendationLogId?: string;
  signalType: string;
  elementContext?: { elementType: string; elementPosition: { x: number; y: number; viewportPercentage: number }; elementVisibility: number };
  temporalContext?: Record<string, unknown>;
  rawSignals?: Record<string, unknown>;
}

// Батч-отправитель для оптимизации запросов
class BatchSender {
  private queue: Array<{ payload: any; endpoint: string; method: string }> = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly batchWindowMs = 100; // Окно батчинга в мс
  private readonly maxBatchSize = 10;

  constructor(
    private onSend: (payloads: Array<{ payload: any; endpoint: string; method: string }>) => Promise<void>
  ) {}

  add(payload: any, endpoint: string, method: string = 'POST') {
    this.queue.push({ payload, endpoint, method });
    
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.batchWindowMs);
    }
  }

  async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) return;

    const toSend = [...this.queue];
    this.queue = [];

    try {
      await this.onSend(toSend);
    } catch (err) {
      logger.error('Error sending batch', { error: err instanceof Error ? err.message : String(err) });
    }
  }
}

export function useSessionTracking(userId: string, logId: string | null) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [filterSessionId, setFilterSessionId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

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
  const pendingEvents = useRef<EventPayload[]>([]);
  const pendingSignals = useRef<SignalPayload[]>([]);

  // Батч-отправитель для событий
  const eventSender = useMemo(() => new BatchSender(async (items) => {
    if (items.length === 0) return;

    // Группируем по endpoint
    const eventsByEndpoint: Record<string, EventPayload[]> = {};
    items.forEach(item => {
      const key = item.endpoint;
      if (!eventsByEndpoint[key]) eventsByEndpoint[key] = [];
      eventsByEndpoint[key].push(item.payload as EventPayload);
    });

    // Отправляем батчи
    await Promise.all(
      Object.entries(eventsByEndpoint).map(([endpoint, payloads]) =>
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch: payloads }),
        }).catch(() => {})
      )
    );
  }), []);

  // Батч-отправитель для сигналов
  const signalSender = useMemo(() => new BatchSender(async (items) => {
    if (items.length === 0) return;

    const signalsByEndpoint: Record<string, SignalPayload[]> = {};
    items.forEach(item => {
      const key = item.endpoint;
      if (!signalsByEndpoint[key]) signalsByEndpoint[key] = [];
      signalsByEndpoint[key].push(item.payload as SignalPayload);
    });

    await Promise.all(
      Object.entries(signalsByEndpoint).map(([endpoint, payloads]) =>
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch: payloads }),
        }).catch(() => {})
      )
    );
  }), []);

  // Инициализация сессии (debounced)
  useEffect(() => {
    if (!userId || isInitialized) return;

    const initSession = async () => {
      try {
        const res = await fetch('/api/recommendations/user-sessions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return;
        }

        const data = await res.json();
        if (data.success) {
          setSessionId(data.sessionId);
          sessionStartTime.current = Date.now();
          setIsInitialized(true);
        }
      } catch (err) {
        logger.error('Error initializing session', { error: err instanceof Error ? err.message : String(err) });
      }
    };

    initSession();
  }, [userId, isInitialized]);

  // Завершение сессии при уходе со страницы
  useEffect(() => {
    return () => {
      if (sessionId) {
        // Отправляем всё перед уходом
        eventSender.flush();
        signalSender.flush();
        
        const endSessionAsync = async () => {
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
            logger.error('Error ending session', { error: err instanceof Error ? err.message : String(err) });
          }
        };
        endSessionAsync();
      }
    };
  }, [sessionId, eventSender, signalSender]);

  // Оптимизированная запись события (с батчингом)
  const trackEvent = useCallback(async (
    eventType: string,
    eventData?: Record<string, unknown>
  ) => {
    if (!sessionId) return;

    const payload: EventPayload = {
      userId,
      sessionId,
      recommendationLogId: logId || undefined,
      eventType,
      eventData,
      timestamp: new Date().toISOString(),
    };

    // Добавляем в батч вместо немедленной отправки
    eventSender.add(payload, '/api/recommendations/events');
  }, [userId, sessionId, logId, eventSender]);

  // Оптимизированная запись сигнала (с батчингом)
  const trackSignal = useCallback(async (
    signalType: string,
    elementContext?: { elementType: string; elementPosition: { x: number; y: number; viewportPercentage: number }; elementVisibility: number },
    rawSignals?: Record<string, unknown>
  ) => {
    if (!sessionId) return;

    const now = Date.now();
    const temporalContext = logId ? {
      timeSinceShownMs: now - sessionStartTime.current,
      timeSinceSessionStartMs: now - sessionStartTime.current,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
    } : undefined;

    const payload: SignalPayload = {
      userId,
      sessionId,
      recommendationLogId: logId || undefined,
      signalType,
      elementContext,
      temporalContext,
      rawSignals,
    };

    signalSender.add(payload, '/api/recommendations/signals');
  }, [userId, sessionId, logId, signalSender]);

  // Начало сессии фильтров (debounced)
  const startFilterSession = useCallback(async () => {
    if (!sessionId || filterSessionId) return;

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
      const data = await res.json();
      if (data.success) {
        setFilterSessionId(data.filterSessionId);
        filterChanges.current = [];
      }
    } catch (err) {
      logger.error('Error starting filter session', { error: err instanceof Error ? err.message : String(err) });
    }
  }, [userId, sessionId, filterSessionId]);

  // Оптимизированное отслеживание изменений фильтров
  const trackFilterChange = useCallback((
    parameterName: string,
    previousValue: any,
    newValue: any
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

    // Записываем событие в батч
    trackEvent('filter_change', change);

    // Обновляем сессию фильтров (debounced)
    if (filterSessionId) {
      const updateFilterSession = async () => {
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
          logger.error('Error updating filter session', { error: err instanceof Error ? err.message : String(err) });
        }
      };
      
      // Debounce обновления
      setTimeout(updateFilterSession, 500);
    }
  }, [sessionId, filterSessionId, trackEvent]);

  // Отслеживание открытия модального окна (оптимизировано)
  const handleModalOpen = useCallback(() => {
    sessionMetrics.current.modalOpenedCount++;
    // Не отправляем немедленно, добавляем в батч
    trackEvent('action_click', {
      action: 'open_details',
      timeSinceShownMs: 0,
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

  // Принудительная отправка всех pending данных
  const flushPending = useCallback(async () => {
    await eventSender.flush();
    await signalSender.flush();
  }, [eventSender, signalSender]);

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
    flushPending,
  };
}
