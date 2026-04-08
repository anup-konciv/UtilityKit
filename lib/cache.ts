/**
 * Tiny TTL cache for live-network tools.
 *
 * Built specifically for the offline-fallback use case in tools like
 * Weather, Currency Converter, News Reader and Translate. The contract:
 *
 *   - `set(key, value)` writes the value with a timestamp.
 *   - `get<T>(key, ttlMs?)` returns `{ value, ageMs, fresh }` or `null`
 *     if there's nothing cached. `fresh` is `true` when the cached entry
 *     is younger than `ttlMs` (defaults to 1 hour).
 *   - `clear(key?)` invalidates one entry or the whole cache.
 *
 * Storage layout:
 *   `KEYS.toolHistory`-style: each entry is namespaced under a single
 *   AsyncStorage key `uk_cache` so we never inflate the central KEYS map.
 *
 * Tools should follow this pattern:
 *
 *   const cached = await cache.get<Forecast>(`weather:${cityKey}`);
 *   if (cached?.fresh) return cached.value;          // happy path
 *   try {
 *     const fresh = await fetchWeather(...);
 *     await cache.set(`weather:${cityKey}`, fresh);
 *     return fresh;
 *   } catch (err) {
 *     if (cached) return cached.value;               // offline fallback
 *     throw err;
 *   }
 */
import { loadJSON, saveJSON } from './storage';

const STORE_KEY = 'uk_cache_v1';

type CacheEntry<T> = {
  value: T;
  storedAt: number;
};

type CacheBag = Record<string, CacheEntry<unknown>>;

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

async function readBag(): Promise<CacheBag> {
  return loadJSON<CacheBag>(STORE_KEY, {});
}

async function writeBag(bag: CacheBag): Promise<void> {
  await saveJSON(STORE_KEY, bag);
}

export type CacheHit<T> = {
  value: T;
  ageMs: number;
  fresh: boolean;
};

export const cache = {
  async get<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): Promise<CacheHit<T> | null> {
    const bag = await readBag();
    const entry = bag[key];
    if (!entry) return null;
    const ageMs = Date.now() - entry.storedAt;
    return {
      value: entry.value as T,
      ageMs,
      fresh: ageMs < ttlMs,
    };
  },

  async set<T>(key: string, value: T): Promise<void> {
    const bag = await readBag();
    bag[key] = { value, storedAt: Date.now() };
    await writeBag(bag);
  },

  async clear(key?: string): Promise<void> {
    if (!key) {
      await writeBag({});
      return;
    }
    const bag = await readBag();
    delete bag[key];
    await writeBag(bag);
  },
};
