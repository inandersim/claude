import AsyncStorage from '@react-native-async-storage/async-storage';

/* ------------------------------------------------------------------ */
/* AsyncStorage tabanlı TTL önbellek                                    */
/* ------------------------------------------------------------------ */

const PREFIX = 'zirtan.ext.cache.v1:';

/** Sık kullanılan TTL değerleri (ms). */
export const CACHE_TTL = {
  /** Hava tahmini */
  weather: 30 * 60_000,
  /** Yükseklik — değişmez, uzun tut */
  elevation: 30 * 24 * 3_600_000,
  /** Çığ bülteni — günde bir-iki kez yayınlanır */
  avalanche: 2 * 3_600_000,
} as const;

interface Envelope<T> {
  storedAt: number;
  value: T;
}

export interface CachedResult<T> {
  value: T;
  /** Süresi geçmiş ama yükleyici başarısız olduğu için geri verilen veri */
  stale: boolean;
  /** Önbellekten mi geldi (taze) */
  fromCache: boolean;
  /** Verinin saklandığı an (ms) */
  storedAt: number;
}

/** Bellek içi hızlı katman; AsyncStorage'a her seferinde gitmemek için. */
const memory = new Map<string, Envelope<unknown>>();

async function readEnvelope<T>(key: string): Promise<Envelope<T> | null> {
  const mem = memory.get(key);
  if (mem) return mem as Envelope<T>;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (typeof parsed?.storedAt !== 'number') return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function writeEnvelope<T>(key: string, envelope: Envelope<T>): Promise<void> {
  memory.set(key, envelope);
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // depolama başarısız olsa da bellek katmanı çalışmaya devam eder
  }
}

/**
 * TTL önbellek: taze veri varsa onu, yoksa `loader` sonucunu döner ve saklar.
 * Yükleyici hata verirse (çevrimdışı vb.) süresi geçmiş veri `stale: true` ile döner;
 * hiç veri yoksa hata yeniden fırlatılır.
 */
export async function getCached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  now: number = Date.now(),
): Promise<CachedResult<T>> {
  const existing = await readEnvelope<T>(key);
  if (existing && now - existing.storedAt < ttlMs) {
    return { value: existing.value, stale: false, fromCache: true, storedAt: existing.storedAt };
  }
  try {
    const value = await loader();
    await writeEnvelope(key, { storedAt: now, value });
    return { value, stale: false, fromCache: false, storedAt: now };
  } catch (error) {
    if (existing) {
      return { value: existing.value, stale: true, fromCache: true, storedAt: existing.storedAt };
    }
    throw error;
  }
}

/** Tek anahtarı siler. */
export async function invalidateCached(key: string): Promise<void> {
  memory.delete(key);
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    // yoksay
  }
}

/** Tüm dış veri önbelleğini temizler (ayarlar → önbelleği temizle). */
export async function clearExternalCache(): Promise<void> {
  memory.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(PREFIX));
    if (mine.length > 0) await AsyncStorage.multiRemove(mine);
  } catch {
    // yoksay
  }
}

/** Koordinatı önbellek anahtarı için 2 ondalığa yuvarlar (~1 km). */
export function coordKey(lat: number, lon: number, digits = 2): string {
  return `${lat.toFixed(digits)},${lon.toFixed(digits)}`;
}
