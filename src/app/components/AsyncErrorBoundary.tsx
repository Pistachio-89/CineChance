import React, { useState, useEffect, useCallback } from 'react';
/* eslint-disable @typescript-eslint/no-unused-vars */
import { logError } from '../../lib/logger';

interface AsyncErrorBoundaryProps {
  children: (props: { setError: (e: Error) => void }) => React.ReactNode;
  fallback?: React.ReactNode;
  componentName?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function AsyncErrorBoundary({ children, fallback, componentName = 'Unknown' }: AsyncErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);
  const [errorCode, setErrorCode] = useState<string>('');
  const [isDismissed, setIsDismissed] = useState(false);

  // Generate unique error code
  const generateErrorCode = useCallback((): string => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ERR-${timestamp}-${random}`;
  }, []);

  // Handle manual dismiss
  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    setError(null);
    setErrorCode('');
  }, []);

  // Reset dismiss state when error changes
  useEffect(() => {
    if (error) {
      setIsDismissed(false);
      const code = generateErrorCode();
      setErrorCode(code);
    }
  }, [error, generateErrorCode]);

  useEffect(() => {
    if (error) {
      logError(`AsyncErrorBoundary[${componentName}]`, error, { errorCode });
    }
  }, [error, errorCode, componentName]);

  // Don't render error if dismissed
  if (isDismissed || !error) {
    return <>{children({ setError })}</>;
  }

  return fallback || (
    <div className="inline-block w-full p-4 my-2 border border-red-500 rounded-lg bg-red-50 dark:bg-red-900/20">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
              Ошибка в компоненте: {componentName}
            </h3>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">
              Произошла асинхронная ошибка. Пожалуйста, попробуйте позже.
            </p>
            <p className="text-xs text-red-500 dark:text-red-400 mt-2 font-mono">
              Код ошибки: {errorCode}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-100 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/40 transition-colors"
            aria-label="Закрыть сообщение об ошибке"
          >
            Закрыть
          </button>
        </div>
        <button
          onClick={() => {
            setError(null);
            setErrorCode('');
            setIsDismissed(false);
          }}
          className="self-start px-3 py-1.5 mt-1 text-sm text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
        >
          Обновить
        </button>
      </div>
    </div>
  );
}
