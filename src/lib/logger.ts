// src/lib/logger.ts

/**
 * Универсальный модуль логирования для клиента и сервера.
 * Поддерживает уровни: debug, info, warn, error.
 * В production выводит только warn/error, в dev — всё.
 * Формат: [timestamp] [level] [context] message
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  level?: LogLevel;
  context?: string;
  output?: 'console'; // можно расширить для внешних сервисов
}

const ENV = typeof process !== 'undefined' && process.env && process.env.NODE_ENV ? process.env.NODE_ENV : 'development';
const DEFAULT_LEVEL: LogLevel = ENV === 'production' ? 'warn' : 'debug';

function getTimestamp() {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel, current: LogLevel) {
  const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  return order.indexOf(level) >= order.indexOf(current);
}

function format(level: LogLevel, msg: string, context?: string) {
  return `[${getTimestamp()}] [${level.toUpperCase()}]${context ? ` [${context}]` : ''} ${msg}`;
}

export class Logger {
  private level: LogLevel;
  private context?: string;
  private output: 'console';

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || DEFAULT_LEVEL;
    this.context = options.context;
    this.output = options.output || 'console';
  }

  debug(msg: string, ...args: any[]) {
    if (shouldLog('debug', this.level)) {
      this._log('debug', msg, ...args);
    }
  }
  info(msg: string, ...args: any[]) {
    if (shouldLog('info', this.level)) {
      this._log('info', msg, ...args);
    }
  }
  warn(msg: string, ...args: any[]) {
    if (shouldLog('warn', this.level)) {
      this._log('warn', msg, ...args);
    }
  }
  error(msg: string, ...args: any[]) {
    if (shouldLog('error', this.level)) {
      this._log('error', msg, ...args);
    }
  }

  private _log(level: LogLevel, msg: string, ...args: any[]) {
    const formatted = format(level, msg, this.context);
    if (this.output === 'console') {
      // eslint-disable-next-line no-console
      if (level === 'error') console.error(formatted, ...args);
      else if (level === 'warn') console.warn(formatted, ...args);
      else if (level === 'info') console.info(formatted, ...args);
      else console.debug(formatted, ...args);
    }
    // Можно добавить отправку во внешний сервис
  }
}

// Глобальный логгер по умолчанию
export const logger = new Logger();
