import networkLogger from './logger';

type FetchWithRetryOptions = {
  retries?: number;
  factor?: number; // exponential factor
  minTimeoutMs?: number;
  maxTimeoutMs?: number;
  jitter?: boolean;
  timeoutMs?: number; // per-request timeout
};

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function computeDelay(attempt: number, opts: FetchWithRetryOptions) {
  const factor = opts.factor ?? 2;
  const min = opts.minTimeoutMs ?? 100;
  const max = opts.maxTimeoutMs ?? 10000;
  let delayMs = Math.min(min * Math.pow(factor, attempt - 1), max);
  if (opts.jitter) {
    const rand = Math.random();
    delayMs = Math.floor(rand * delayMs);
  }
  return delayMs;
}

export async function fetchWithRetry(input: RequestInfo, init?: RequestInit, options: FetchWithRetryOptions = {}): Promise<Response> {
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 0;

  let lastError: any = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const attemptStart = Date.now();
    try {
      // Timeout handling
      const controller = new AbortController();
      const signal = controller.signal;
      const combinedInit: RequestInit = { ...(init ?? {}), signal };

      let timeoutId: NodeJS.Timeout | undefined;
      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs) as unknown as NodeJS.Timeout;
      }

      networkLogger.debug('Attempt', attempt, 'fetch', typeof input === 'string' ? input : '[RequestInfo]', 'options', { timeoutMs });

      const res = await fetch(input, combinedInit);

      if (timeoutId) clearTimeout(timeoutId);

      if (!res.ok && (res.status === 429 || res.status >= 500)) {
        // Retryable status codes
        const delayMs = computeDelay(attempt, options);
        networkLogger.warn('Retryable response', { attempt, url: typeof input === 'string' ? input : '[RequestInfo]', status: res.status, delayMs });
        if (attempt < retries) await delay(delayMs);
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }

      // Successful or non-retryable
      return res;
    } catch (err) {
      lastError = err;
      const delayMs = computeDelay(attempt, options);
      networkLogger.error('Fetch error', { attempt, url: typeof input === 'string' ? input : '[RequestInfo]', error: String(err), delayMs });
      if (attempt < retries) await delay(delayMs);
    } finally {
      const duration = Date.now() - attemptStart;
      networkLogger.debug('Attempt finished', { attempt, duration });
    }
  }

  throw lastError;
}

export default fetchWithRetry;
