import { useCallback, useRef } from 'react';

/**
 * Хук для дебаунсинга функций
 * @param callback Функция для дебаунсинга
 * @param delay Задержка в миллисекундах
 * @returns Дебаунсенная функция
 */
export function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((...args: Parameters<T>) => {
    // Отменяем предыдущий таймаут
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Устанавливаем новый таймаут
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

/**
 * Хук для дебаунсинга асинхронных функций
 * @param callback Асинхронная функция для дебаунсинга
 * @param delay Задержка в миллисекундах
 * @returns Дебаунсенная функция
 */
export function useAsyncDebounce<T extends (...args: any[]) => Promise<any>>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPendingRef = useRef(false);

  return useCallback((...args: Parameters<T>) => {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      // Отменяем предыдущий таймаут
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Устанавливаем новый таймаут
      timeoutRef.current = setTimeout(async () => {
        try {
          if (!isPendingRef.current) {
            isPendingRef.current = true;
            const result = await callback(...args);
            resolve(result);
          }
        } catch (error) {
          reject(error);
        } finally {
          isPendingRef.current = false;
        }
      }, delay);
    });
  }, [callback, delay]) as T;
}
