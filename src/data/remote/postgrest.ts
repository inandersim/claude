/**
 * PostgREST istemcisinin bu katmanda kullanılan **yapısal** alt kümesi.
 *
 * `@supabase/supabase-js` istemcisi bu arayüzü çalışma zamanında karşılar
 * (`client.ts` içinde bir kez dönüştürülür). Aynı arayüzü testlerde doğrudan
 * Postgres'e bağlanan ince bir uyarlayıcı da uygular
 * (`src/data/__tests__/contract/pgPostgrest.ts`), böylece uzak sağlayıcı
 * gerçek bir veritabanına karşı çalıştırılabilir.
 *
 * Not: Tipler kasıtlı olarak gevşektir; satırlar `Row` (string → bilinmeyen)
 * olarak gelir ve `mappers.ts` domain tiplerine çevirir.
 */

/** Veritabanından dönen ham satır. */
export type Row = Record<string, unknown>;

export interface PostgrestError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export interface PostgrestResponse<T> {
  data: T;
  error: PostgrestError | null;
  count?: number | null;
}

/** `select`/`update`/`delete` üzerine zincirlenebilen süzgeçler. */
export interface FilterBuilder<T> extends PromiseLike<PostgrestResponse<T>> {
  eq(column: string, value: unknown): FilterBuilder<T>;
  neq(column: string, value: unknown): FilterBuilder<T>;
  gt(column: string, value: unknown): FilterBuilder<T>;
  gte(column: string, value: unknown): FilterBuilder<T>;
  lt(column: string, value: unknown): FilterBuilder<T>;
  lte(column: string, value: unknown): FilterBuilder<T>;
  like(column: string, pattern: string): FilterBuilder<T>;
  ilike(column: string, pattern: string): FilterBuilder<T>;
  is(column: string, value: null | boolean): FilterBuilder<T>;
  in(column: string, values: readonly unknown[]): FilterBuilder<T>;
  /** Dizi/aralık sütunu verilen değerleri **içeriyor** mu */
  contains(column: string, value: readonly unknown[] | string): FilterBuilder<T>;
  /** Dizi sütunu verilen değerlerden en az biriyle **kesişiyor** mu */
  overlaps(column: string, value: readonly unknown[]): FilterBuilder<T>;
  /** `or('a.eq.1,b.is.null')` biçiminde PostgREST süzgeci */
  or(filters: string): FilterBuilder<T>;
  not(column: string, operator: string, value: unknown): FilterBuilder<T>;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string },
  ): FilterBuilder<T>;
  limit(count: number): FilterBuilder<T>;
  range(from: number, to: number): FilterBuilder<T>;
  /** Tam olarak bir satır bekler; yoksa hata döner. */
  single(): PromiseLike<PostgrestResponse<Row>>;
  /** En fazla bir satır bekler; yoksa `data: null`. */
  maybeSingle(): PromiseLike<PostgrestResponse<Row | null>>;
}

/** `insert`/`upsert` sonrası `select()` çağrılabilir. */
export interface MutationBuilder extends FilterBuilder<Row[]> {
  select(columns?: string): FilterBuilder<Row[]>;
}

export interface QueryBuilder {
  select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): FilterBuilder<Row[]>;
  insert(values: Row | Row[]): MutationBuilder;
  upsert(values: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): MutationBuilder;
  update(values: Row): FilterBuilder<Row[]> & { select(columns?: string): FilterBuilder<Row[]> };
  delete(): FilterBuilder<Row[]> & { select(columns?: string): FilterBuilder<Row[]> };
}

/** Realtime kanalı (yalnızca kullandığımız yüzey). */
export interface RealtimeChannelLike {
  on(
    type: 'postgres_changes',
    filter: { event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'; schema: string; table: string; filter?: string },
    callback: (payload: { eventType: string; new: Row; old: Row }) => void,
  ): RealtimeChannelLike;
  subscribe(callback?: (status: string) => void): RealtimeChannelLike;
  unsubscribe(): Promise<'ok' | 'timed out' | 'error'> | void;
}

export interface StorageFileApiLike {
  upload(
    path: string,
    file: ArrayBuffer | Blob | Uint8Array,
    options?: { contentType?: string; upsert?: boolean; cacheControl?: string },
  ): Promise<PostgrestResponse<{ path: string } | null>>;
  remove(paths: string[]): Promise<PostgrestResponse<unknown>>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
  createSignedUrl(path: string, expiresIn: number): Promise<PostgrestResponse<{ signedUrl: string } | null>>;
}

/** `client.auth` — yalnızca AuthRepository'nin kullandığı yüzey. */
export interface AuthApiLike {
  getSession(): Promise<PostgrestResponse<{ session: { user: { id: string } } | null }>>;
  getUser(): Promise<PostgrestResponse<{ user: { id: string } | null }>>;
  signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<PostgrestResponse<{ user: { id: string } | null }>>;
  signUp(input: {
    email: string;
    password: string;
    options?: { data?: Row };
  }): Promise<PostgrestResponse<{ user: { id: string } | null }>>;
  signOut(): Promise<{ error: PostgrestError | null }>;
}

/** Uzak sağlayıcının ihtiyaç duyduğu istemci yüzeyi. */
export interface SupabaseLike {
  from(table: string): QueryBuilder;
  rpc(fn: string, args?: Row): FilterBuilder<Row[]>;
  auth: AuthApiLike;
  channel?(name: string): RealtimeChannelLike;
  removeChannel?(channel: RealtimeChannelLike): void;
  storage?: { from(bucket: string): StorageFileApiLike };
}

/** Sunucudan gelen hata; `code` PostgreSQL SQLSTATE değeridir. */
export class RemoteError extends Error {
  readonly code: string | undefined;
  readonly details: string | null | undefined;
  constructor(error: PostgrestError, context: string) {
    super(`${context}: ${error.message}`);
    this.name = 'RemoteError';
    this.code = error.code;
    this.details = error.details;
  }
}

/** Henüz uzak sağlayıcıda karşılığı yazılmamış metotlar için. */
export class NotImplementedRemotelyError extends Error {
  constructor(method: string, reason: string) {
    super(`${method} uzak sağlayıcıda henüz uygulanmadı: ${reason}`);
    this.name = 'NotImplementedRemotelyError';
  }
}

/** `{ data, error }` sonucunu açar; hata varsa `RemoteError` fırlatır. */
export async function unwrap<T>(
  promise: PromiseLike<PostgrestResponse<T>>,
  context: string,
): Promise<T> {
  const result = await promise;
  if (result.error) throw new RemoteError(result.error, context);
  return result.data;
}

/** Satır listesi bekleyen sorgular için kısayol. */
export async function rows(
  promise: PromiseLike<PostgrestResponse<Row[]>>,
  context: string,
): Promise<Row[]> {
  return (await unwrap(promise, context)) ?? [];
}

/** En fazla bir satır bekleyen sorgular için kısayol. */
export async function maybeRow(
  builder: FilterBuilder<Row[]>,
  context: string,
): Promise<Row | null> {
  return await unwrap(builder.maybeSingle(), context);
}

/** Tam olarak bir satır bekleyen sorgular için kısayol. */
export async function oneRow(builder: FilterBuilder<Row[]>, context: string): Promise<Row> {
  return await unwrap(builder.single(), context);
}
