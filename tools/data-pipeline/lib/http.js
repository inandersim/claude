import { USER_AGENT } from './config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Üstel bekleme ve 429/5xx yeniden denemeli fetch.
 * @param {string} url
 * @param {RequestInit & { retries?: number; baseDelayMs?: number }} [init]
 */
export async function fetchWithRetry(url, init = {}) {
  const { retries = 5, baseDelayMs = 2000, ...rest } = init;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(rest.headers ?? {}) },
      });
      if (res.ok) return res;
      if (res.status === 429 || res.status === 504 || res.status === 503 || res.status === 502) {
        const retryAfter = Number(res.headers.get('retry-after')) || 0;
        const delay = Math.max(retryAfter * 1000, baseDelayMs * 2 ** attempt);
        console.warn(
          `  ↻ ${res.status} — ${Math.round(delay / 1000)}s sonra tekrar (${attempt + 1}/${retries})`,
        );
        await sleep(delay);
        continue;
      }
      throw new Error(`HTTP ${res.status} ${res.statusText} — ${url.slice(0, 120)}`);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError ?? new Error('fetch başarısız');
}
