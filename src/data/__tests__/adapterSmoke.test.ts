import { Pool } from 'pg';

import { toUser, toPost } from '@/data/remote/mappers';
import type { SupabaseLike } from '@/data/remote/postgrest';

import { isPostgresLikelyAvailable, readPgEnv, type PgEnv } from './contract/pgHarness';
import { createPgPostgrest } from './contract/pgPostgrest';

/**
 * Uzak sağlayıcı eşleyicilerinin (mappers) **gerçek** şema üzerinde duman testi.
 *
 * Gerçek bir Supabase sunucusu gerekmez; `supabase/test/run.sh` ile kurulan
 * yerel Postgres+PostGIS şablonuna bağlanır. Postgres yoksa paket atlanır —
 * kardeş sözleşme paketleriyle aynı kural (bkz. `remoteProviderContract`).
 * Kurulum:
 *   PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./supabase/test/run.sh
 */
const available = isPostgresLikelyAvailable();

let pool: Pool | null = null;
let client: SupabaseLike | null = null;
let uid: string | null = null;

beforeAll(() => {
  if (!available) return;
  const env: PgEnv = readPgEnv();
  pool = new Pool({
    host: env.host,
    port: env.port,
    user: env.user,
    password: env.password,
    database: env.template,
    max: 4,
  });
  client = createPgPostgrest(pool, {
    getUserId: () => uid,
    setUserId: (v) => {
      uid = v;
    },
  });
});

afterAll(async () => {
  if (pool) await pool.end();
});

/** Paket atlandığında bile tip güvenli erişim. */
const db = (): SupabaseLike => {
  if (!client) throw new Error('Postgres yok');
  return client;
};

const describeIfPg = () => (available ? describe : describe.skip);

if (!available) {
  console.warn(
    '[duman] Yerel Postgres bulunamadı — eşleyici duman testleri atlandı. Kurulum:\n' +
      '  PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./supabase/test/run.sh\n' +
      '  (ya da ZIRTAN_TEST_PG=1 ile TCP bağlantısını zorla)',
  );
}

describeIfPg()('duman · uzak eşleyiciler (yerel Postgres)', () => {
  test('profil + gömülü acil kişiler', async () => {
    const { data, error } = await db()
      .from('profiles')
      .select('*, emergency_contacts!user_id(*)')
      .limit(3);
    expect(error).toBeNull();
    const rows = data as Record<string, unknown>[];
    expect(rows.length).toBe(3);
    const u = toUser(rows[0]!);
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof u.coords.latitude).toBe('number');
    expect(u.coords.latitude).not.toBe(0);
  });

  test('gönderi + yazar gömülü', async () => {
    const { data, error } = await db()
      .from('posts')
      .select('*, author:profiles!author_id(*)')
      .order('created_at', { ascending: false })
      .limit(2);
    expect(error).toBeNull();
    const rows = data as Record<string, unknown>[];
    const p = toPost(rows[0]!);
    expect(p.caption.length).toBeGreaterThan(0);
    expect(toUser(rows[0]!.author as Record<string, unknown>).username.length).toBeGreaterThan(0);
  });

  test('rpc feed_posts', async () => {
    const me = await db().from('profiles').select('id').limit(1);
    uid = String((me.data as Record<string, unknown>[])[0]!.id);
    const { data, error } = await db().rpc('feed_posts', { tab: 'all', max_rows: 5 });
    expect(error).toBeNull();
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  test('rpc skaler (is_unit_available)', async () => {
    const units = await db().from('stay_units').select('id').limit(1);
    const unitId = String((units.data as Record<string, unknown>[])[0]!.id);
    const { data, error } = await db().rpc('is_unit_available', {
      unit: unitId,
      from_date: '2030-01-01',
      to_date: '2030-01-03',
    });
    expect(error).toBeNull();
    expect(typeof data).toBe('boolean');
  });

  test('or süzgeci + in', async () => {
    const { data, error } = await db().from('groups').select('*').limit(2);
    expect(error).toBeNull();
    const ids = (data as Record<string, unknown>[]).map((r) => String(r.id));
    const res = await db().from('group_messages').select('*').in('group_id', ids).limit(5);
    expect(res.error).toBeNull();
  });
});
