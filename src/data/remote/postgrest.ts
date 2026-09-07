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

/** `select`/`insert`/`update`/`delete` üzerine zincirlenebilen süzgeçler. */
export interface FilterBuilder<T> extends PromiseLike<PostgrestResponse<T>> {
  eq(column: string, value: unknown): this;
  neq(column: string, value: unknown): this;
  gt(column: string, value: unknown): this;
  gte(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
  lte(column: string, value: unknown): this;
  like(column: string, pattern: string): this;
  ilike(column: string, pattern: string): this;
  is(column: string, value: null | boolean): this;
  in(column: string, values: readonly unknown[]): this;
  /** Dizi/aralık sütunu verilen değerleri **içeriyor** mu */
  contains(column: string, value: readonly unknown[] | string): this;
  /** Dizi sütunu verilen değerlerden en az biriyle **kesişiyor** mu */
  overlaps(column: string, value: readonly unknown[]): this;
  /** `or('a.eq.1,b.is.null')` biçiminde PostgREST süzgeci */
  or(filters: string): this;
  not(column: string, operator: string, value: unknown): this;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string },
  ): this;
  limit(count: number): this;
  range(from: number, to: number): this;
  /** Mutasyon sonrası dönecek sütunlar (PostgREST `Prefer: return=representation`). */
  select(columns?: string): this;
  /** Tam olarak bir satır bekler; yoksa hata döner. */
  single(): PromiseLike<PostgrestResponse<Row>>;
  /** En fazla bir satır bekler; yoksa `data: null`. */
  maybeSingle(): PromiseLike<PostgrestResponse<Row | null>>;
}

/** `insert`/`upsert` da aynı süzgeç yüzeyini döner. */
export type MutationBuilder = FilterBuilder<Row[]>;

export interface QueryBuilder {
  select(
    columns?: string,
    options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean },
  ): FilterBuilder<Row[]>;
  insert(values: Row | Row[]): MutationBuilder;
  upsert(
    values: Row | Row[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): MutationBuilder;
  update(values: Row): FilterBuilder<Row[]>;
  delete(): FilterBuilder<Row[]>;
}

/** Realtime kanalı (yalnızca kullandığımız yüzey). */
export interface RealtimeChannelLike {
  on(
    type: 'postgres_changes',
    filter: {
      event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
      schema: string;
      table: string;
      filter?: string;
    },
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
  createSignedUrl(
    path: string,
    expiresIn: number,
  ): Promise<PostgrestResponse<{ signedUrl: string } | null>>;
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
  /**
   * Telefona SMS doğrulama kodu gönderir (Supabase Auth `signInWithOtp`).
   * Kullanıcı yoksa `shouldCreateUser` ile oluşturulur.
   */
  signInWithOtp(input: {
    phone: string;
    options?: { shouldCreateUser?: boolean; data?: Row; channel?: 'sms' | 'whatsapp' };
  }): Promise<PostgrestResponse<{ user: { id: string } | null }>>;
  /** SMS kodunu doğrular ve oturum açar. */
  verifyOtp(input: {
    phone: string;
    token: string;
    type: 'sms' | 'phone_change';
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

/** `{ data, error }` sonucunu açar; hata varsa `RemoteError` fırlatır. */
export async function unwrap<T>(
  promise: PromiseLike<PostgrestResponse<T>>,
  context: string,
): Promise<T> {
  const result = await promise;
  if (result.error) throw new RemoteError(result.error, context);
  return result.data;
}

/**
 * Sınırsız bir liste sorgusunun **varsayılan tavanı**.
 *
 * Neden var: bu katmandaki 443 sorgu zincirinin 313'ü hiçbir sınır
 * taşımıyordu. 100 kullanıcıda kimse fark etmez; ölçtüğümüz gerçek şemada bir
 * akış satırı (gönderi + gömülü yazar profili) **1.980 bayt** ve PostgREST'in
 * varsayılan tavanı 1.000 satır. Yani her akış açılışı ~2 MB indiriyordu:
 * 100 bin kullanıcıda aylık ~22 TB, ~2.000 dolar. 20 satırlık sayfayla aynı
 * yük ~440 GB ve ~40 dolar.
 *
 * Tavan bir **emniyet ağıdır**, sayfa boyu değil: ekranlar kendi sayfa boyunu
 * `rows(..., { limit })` ile verir.
 */
export const VARSAYILAN_TAVAN = 200;

export interface RowsOptions {
  /**
   * Bu sorgunun tavanı. `null` **bilinçli sınırsız** demektir (ör. sabit ve
   * küçük bir sözlük tablosu) ve yorumla gerekçelendirilmelidir.
   */
  limit?: number | null;
  /** Ofsetli sayfalama: `[from, to]`, iki uç da dahil (PostgREST `range`). */
  range?: [number, number];
}

/**
 * Satır listesi bekleyen sorgular için kısayol.
 *
 * **Kural:** repository'lerde `.limit()` / `.range()` **zincirlenmez**; sınır
 * her zaman buradan geçer. Böylece hem tek yerden denetlenebilir hem de
 * "zincirdeki 20'yi burada 200'e genişletmek" gibi sessiz hatalar imkânsız
 * olur. Kuralı `remoteLimits.test.ts` koruyor.
 */
export async function rows(
  source: FilterBuilder<Row[]> | PromiseLike<PostgrestResponse<Row[]>>,
  context: string,
  options: RowsOptions = {},
): Promise<Row[]> {
  const builder = source as Partial<FilterBuilder<Row[]>>;
  let sorgu = source as PromiseLike<PostgrestResponse<Row[]>>;
  if (typeof builder.limit === 'function' && typeof builder.range === 'function') {
    if (options.range) {
      sorgu = builder.range(options.range[0], options.range[1]) as FilterBuilder<Row[]>;
    } else if (options.limit !== null) {
      sorgu = builder.limit(options.limit ?? VARSAYILAN_TAVAN) as FilterBuilder<Row[]>;
    }
  }
  return (await unwrap(sorgu, context)) ?? [];
}

/**
 * En fazla bir satır bekleyen sorgular için kısayol.
 *
 * `maybeSingle()` birden çok satır dönerse hata verir; "en yenisini al" gibi
 * sorgular bu yüzden `{ limit: 1 }` geçer. Sınır burada da zincirle değil
 * seçenekle veriliyor — kural tek: **repository'de `.limit()` zincirlenmez.**
 */
export async function maybeRow(
  builder: FilterBuilder<Row[]>,
  context: string,
  options: { limit?: number } = {},
): Promise<Row | null> {
  const sorgu = options.limit === undefined ? builder : builder.limit(options.limit);
  return await unwrap(sorgu.maybeSingle(), context);
}

/** Tam olarak bir satır bekleyen sorgular için kısayol. */
export async function oneRow(builder: FilterBuilder<Row[]>, context: string): Promise<Row> {
  return await unwrap(builder.single(), context);
}
