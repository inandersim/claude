import AsyncStorage from '@react-native-async-storage/async-storage';

import { RemoteError, type Row, type SupabaseLike } from './postgrest';

/**
 * Çevrimdışı yazma kuyruğu.
 *
 * Dağda şebeke yoktur: yazma işlemleri ağ yokken **sıraya girer**, bağlantı
 * gelince **oluşturulma sırasına göre** gönderilir. Okuma işlemleri kuyruğa
 * girmez (React Query önbelleği bunu zaten yapar).
 *
 * ## Çakışma politikası (belgelenmiş)
 *
 * | Durum | Davranış |
 * |---|---|
 * | Ağ hatası / 5xx / zaman aşımı | Yeniden denenir, üstel bekleme (1s, 4s, 9s…), en fazla `maxAttempts` |
 * | Benzersizlik ihlali (23505) | **Sunucu kazanır** — işlem başarılı sayılır ve kuyruktan düşer (aynı beğeni/katılım iki kez yazılmaz) |
 * | Dışlama kısıtı (23P01, rezervasyon çakışması) | **Sunucu kazanır** — işlem `conflict` ile düşer; kullanıcıya bildirilir, sessizce üzerine yazılmaz |
 * | Yetki/RLS hatası (42501, PGRST301) | `rejected` — yeniden denenmez |
 * | Diğer 4xx / kısıt ihlali | `rejected` — yeniden denenmez, ayrıntı saklanır |
 *
 * Aynı satıra iki farklı cihazdan yazıldığında **son yazan kazanır**
 * (`update` tam alan kümesini gönderir). Sayaçlar (beğeni, üye, onay) uygulama
 * tarafından değil veritabanı tetikleyicileriyle güncellendiği için kuyruk
 * tekrar oynatıldığında çift sayım oluşmaz.
 *
 * Kuyruk `AsyncStorage`'da saklanır; uygulama kapansa bile korunur.
 */

const STORAGE_KEY = 'zirtan.offline.queue.v1';

export type MutationKind = 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';

export interface QueuedMutation {
  id: string;
  kind: MutationKind;
  /** `insert|update|upsert|delete` için tablo, `rpc` için fonksiyon adı. */
  target: string;
  /** Gönderilecek satır(lar) ya da RPC argümanları. */
  payload?: Row | Row[];
  /** `update`/`delete` için eşitlik süzgeçleri. */
  match?: Row;
  /** `upsert` için çakışma sütunları. */
  onConflict?: string;
  createdAt: string;
  attempts: number;
  /** Son hatanın kısa açıklaması (tanı için). */
  lastError?: string;
}

export type FlushOutcome = 'sent' | 'conflict' | 'rejected' | 'retry';

export interface FlushResult {
  sent: number;
  conflicts: number;
  rejected: number;
  remaining: number;
  /** İşlem başına sonuç (kullanıcıya bildirim için). */
  details: { mutation: QueuedMutation; outcome: FlushOutcome; error?: string }[];
}

export interface OfflineQueueOptions {
  /** Kalıcı depolama; varsayılan AsyncStorage. */
  storage?: Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Ağ var mı? Yoksa `flush` hiç denemez. */
  isOnline?: () => boolean | Promise<boolean>;
  /** Kalıcı hata sayılmadan önceki deneme sayısı. */
  maxAttempts?: number;
  /** Kimlik üreteci (test için sabitlenebilir). */
  newId?: () => string;
  /** Zaman kaynağı (test için). */
  now?: () => Date;
}

/** Yeniden denenebilir (geçici) hata mı? */
export function isTransient(error: unknown): boolean {
  if (error instanceof RemoteError) {
    const code = error.code ?? '';
    // Bağlantı/kaynak hataları ve kilit zaman aşımları geçicidir.
    return (
      code === '' ||
      code.startsWith('08') ||
      code.startsWith('53') ||
      code === '40001' ||
      code === '40P01' ||
      code === '57014'
    );
  }
  return true; // ağ istisnaları (TypeError: Network request failed)
}

/** Sunucunun kazandığı çakışma mı? */
export function isConflict(error: unknown): boolean {
  if (!(error instanceof RemoteError)) return false;
  return error.code === '23505' || error.code === '23P01';
}

/** Yeniden denenmemesi gereken kalıcı hata mı? */
export function isRejected(error: unknown): boolean {
  return !isTransient(error) && !isConflict(error);
}

export interface OfflineQueue {
  enqueue(mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'attempts'>): Promise<QueuedMutation>;
  list(): Promise<QueuedMutation[]>;
  size(): Promise<number>;
  clear(): Promise<void>;
  /** Bekleyenleri sırayla gönderir; ağ yoksa hiçbir şey yapmaz. */
  flush(client: SupabaseLike): Promise<FlushResult>;
}

/** Kuyruğu kurar. Aynı anahtarla oluşturulan örnekler aynı kuyruğu paylaşır. */
export function createOfflineQueue(options: OfflineQueueOptions = {}): OfflineQueue {
  const storage = options.storage ?? AsyncStorage;
  const isOnline = options.isOnline ?? (() => true);
  const maxAttempts = options.maxAttempts ?? 5;
  const newId = options.newId ?? (() => `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const now = options.now ?? (() => new Date());
  /** Aynı anda yalnızca bir flush çalışsın. */
  let flushing: Promise<FlushResult> | null = null;

  const read = async (): Promise<QueuedMutation[]> => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
    } catch {
      return [];
    }
  };

  const write = async (items: QueuedMutation[]): Promise<void> => {
    if (!items.length) await storage.removeItem(STORAGE_KEY);
    else await storage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const apply = async (client: SupabaseLike, m: QueuedMutation): Promise<void> => {
    const fail = (error: NonNullable<Awaited<ReturnType<typeof send>>>) => {
      throw new RemoteError(error, `${m.kind} ${m.target}`);
    };
    const send = async () => {
      switch (m.kind) {
        case 'insert':
          return (await client.from(m.target).insert(m.payload ?? {})).error;
        case 'upsert':
          return (
            await client
              .from(m.target)
              .upsert(m.payload ?? {}, m.onConflict ? { onConflict: m.onConflict } : undefined)
          ).error;
        case 'update': {
          let query = client.from(m.target).update((m.payload ?? {}) as Row);
          for (const [column, value] of Object.entries(m.match ?? {})) query = query.eq(column, value);
          return (await query).error;
        }
        case 'delete': {
          let query = client.from(m.target).delete();
          for (const [column, value] of Object.entries(m.match ?? {})) query = query.eq(column, value);
          return (await query).error;
        }
        case 'rpc':
          return (await client.rpc(m.target, (m.payload ?? {}) as Row)).error;
        default:
          return { message: `Bilinmeyen işlem türü: ${m.kind}` };
      }
    };
    const error = await send();
    if (error) fail(error);
  };

  const flush = async (client: SupabaseLike): Promise<FlushResult> => {
    if (flushing) return await flushing;
    const run = async (): Promise<FlushResult> => {
      const empty: FlushResult = { sent: 0, conflicts: 0, rejected: 0, remaining: 0, details: [] };
      if (!(await isOnline())) {
        const pending = await read();
        return { ...empty, remaining: pending.length };
      }
      const queue = await read();
      const keep: QueuedMutation[] = [];
      const result: FlushResult = { ...empty, details: [] };

      for (const mutation of queue) {
        try {
          await apply(client, mutation);
          result.sent += 1;
          result.details.push({ mutation, outcome: 'sent' });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (isConflict(error)) {
            // Sunucu kazanır: işlem düşer, kullanıcıya bildirilir.
            result.conflicts += 1;
            result.details.push({ mutation, outcome: 'conflict', error: message });
          } else if (isRejected(error)) {
            result.rejected += 1;
            result.details.push({ mutation, outcome: 'rejected', error: message });
          } else {
            const attempts = mutation.attempts + 1;
            if (attempts >= maxAttempts) {
              result.rejected += 1;
              result.details.push({ mutation, outcome: 'rejected', error: message });
            } else {
              keep.push({ ...mutation, attempts, lastError: message });
              result.details.push({ mutation, outcome: 'retry', error: message });
              // Sıra korunur: ilk geçici hatadan sonra kalanlar da beklemede kalır.
              const rest = queue.slice(queue.indexOf(mutation) + 1);
              keep.push(...rest);
              break;
            }
          }
        }
      }
      await write(keep);
      result.remaining = keep.length;
      return result;
    };
    flushing = run().finally(() => {
      flushing = null;
    });
    return await flushing;
  };

  return {
    async enqueue(input) {
      const mutation: QueuedMutation = {
        ...input,
        id: newId(),
        createdAt: now().toISOString(),
        attempts: 0,
      };
      await write([...(await read()), mutation]);
      return mutation;
    },
    async list() {
      return await read();
    },
    async size() {
      return (await read()).length;
    },
    async clear() {
      await write([]);
    },
    flush,
  };
}

/** Üstel bekleme (ms): 1s, 4s, 9s, 16s… */
export function backoffMs(attempts: number): number {
  return Math.min(60_000, attempts * attempts * 1000);
}
