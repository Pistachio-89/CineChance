// src/hooks/useLazyData.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';

/**
 * Хук для поочередной (lazy) загрузки данных
 * Загружает данные только когда элемент попадает в viewport
 * Использует Intersection Observer для отслеживания видимости
 */
export function useLazyData<T>(
  fetcher: () => Promise<T>,
  _dependencies: any[] = [],
  options: IntersectionObserverInit = { rootMargin: '200px', threshold: 0.01 }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const fetcherRef = useRef(fetcher);

  // Обновляем fetcher при изменении
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  // Функция загрузки данных
  const loadData = useCallback(async () => {
    if (hasLoaded || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetcherRef.current();
      setData(result);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Не устанавливаем hasLoaded = true, чтобы можно было повторить попытку
    } finally {
      setLoading(false);
    }
  }, [hasLoaded, loading]);

  // Устанавливаем observer
  useEffect(() => {
    elementRef.current = document.createElement('div');
    
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasLoaded && !loading) {
          loadData();
        }
      });
    }, options);

    // Наблюдаем за текущим элементом (будет привязан через ref в компоненте)
    if (elementRef.current) {
      observerRef.current.observe(elementRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadData, hasLoaded, loading, options]);

  return {
    data,
    loading,
    error,
    hasLoaded,
    loadData,
    elementRef,
  };
}

/**
 * Хук для sequential (поочередной) загрузки списка данных
 * Загружает элементы по очереди с задержкой между загрузками
 */
export function useSequentialLoad<T>(
  items: T[],
  fetcher: (_item: T, _index: number) => Promise<T>,
  options: { delay?: number; batchSize?: number } = { delay: 100, batchSize: 2 }
) {
  const { delay = 100, batchSize = 2 } = options;
  
  const [processedItems, setProcessedItems] = useState<(T & { _loaded?: boolean })[]>([]);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (completed) return;

    const processItems = async () => {
      setLoading(true);
      
      let loadedInBatch = 0;

      for (let i = 0; i < items.length; i++) {
        // Ждем перед загрузкой следующей группы
        if (loadedInBatch >= batchSize) {
          await new Promise(resolve => setTimeout(resolve, delay));
          loadedInBatch = 0;
        }

        try {
          const result = await fetcher(items[i], i);
          setProcessedItems(prev => {
            const updated = [...prev];
            if (updated[i]) {
              updated[i] = { ...result, _loaded: true };
            }
            return updated;
          });
          loadedInBatch++;
        } catch (error) {
          logger.error('Failed to load item', { index: i, error: error instanceof Error ? error.message : String(error) });
        }
      }

      setCompleted(true);
      setLoading(false);
    };

    processItems();
  }, [items, fetcher, delay, batchSize, completed]);

  return {
    items: processedItems,
    loading,
    completed,
  };
}
