import { sleep, throttle } from './rateLimit.js';

const USER_AGENT =
  process.env.BLOAT_USER_AGENT ??
  'Mozilla/5.0 (compatible; SIYF-Bloat-Ingest/0.1; +https://github.com/nicholasxdavis/bloat-cdn)';

const MAX_RETRIES = Math.max(0, Number(process.env.BLOAT_FETCH_RETRIES ?? 3));
const RETRY_BASE_MS = Math.max(250, Number(process.env.BLOAT_RETRY_DELAY_MS ?? 2000));
const FETCH_TIMEOUT_MS = Math.max(5000, Number(process.env.BLOAT_FETCH_TIMEOUT_MS ?? 45000));

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof FetchError) return RETRY_STATUSES.has(err.status);
  if (err instanceof Error && err.name === 'AbortError') return true;
  return err instanceof TypeError;
}

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await throttle();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json,text/csv,text/plain,*/*',
          'User-Agent': USER_AGENT,
          ...init?.headers,
        },
      });

      clearTimeout(timer);

      if (!res.ok) {
        const err = new FetchError(`HTTP ${res.status} for ${url}`, res.status, url);
        if (RETRY_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
          lastError = err;
          const retryAfter = Number(res.headers.get('retry-after'));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : RETRY_BASE_MS * (attempt + 1);
          await sleep(delay);
          continue;
        }
        throw err;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES && isRetryableError(err)) {
        await sleep(RETRY_BASE_MS * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new FetchError(`Failed after retries: ${url}`, 0, url);
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const text = await fetchText(url, init);
  return JSON.parse(text) as T;
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetchWithRetry(url, init);
  return res.text();
}

export async function fetchBytes(
  url: string,
  init?: RequestInit,
): Promise<{ bytes: Buffer; contentType: string | null }> {
  const res = await fetchWithRetry(url, {
    ...init,
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'User-Agent': USER_AGENT,
      ...init?.headers,
    },
  });

  const arrayBuffer = await res.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    contentType: res.headers.get('content-type'),
  };
}

export function isHtmlPayload(text: string): boolean {
  return text.includes('<!DOCTYPE') || text.includes('<html');
}
