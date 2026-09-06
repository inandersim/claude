import { Pool } from 'pg';
import { createPgPostgrest } from '@/data/__tests__/contract/pgPostgrest';
import { toUser, toPost } from '@/data/remote/mappers';

const pool = new Pool({ host: '/tmp', port: 54329, user: 'postgres', database: 'zirtan_test', max: 4 });
let uid: string | null = null;
const client = createPgPostgrest(pool, { getUserId: () => uid, setUserId: (v) => { uid = v; } });

afterAll(async () => { await pool.end(); });

test('profil + gömülü acil kişiler', async () => {
  const { data, error } = await client.from('profiles').select('*, emergency_contacts!user_id(*)').limit(3);
  expect(error).toBeNull();
  const rows = data as Record<string, unknown>[];
  expect(rows.length).toBe(3);
  const u = toUser(rows[0]!);
  expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(typeof u.coords.latitude).toBe('number');
  expect(u.coords.latitude).not.toBe(0);
  console.log('user', u.username, u.coords, u.plan, u.emergencyContacts.length);
});

test('gönderi + yazar gömülü', async () => {
  const { data, error } = await client.from('posts').select('*, author:profiles!author_id(*)').order('created_at', { ascending: false }).limit(2);
  expect(error).toBeNull();
  const rows = data as Record<string, unknown>[];
  const p = toPost(rows[0]!);
  expect(p.caption.length).toBeGreaterThan(0);
  expect(toUser(rows[0]!.author as Record<string, unknown>).username.length).toBeGreaterThan(0);
  console.log('post', p.id, p.adventureType, p.coords, p.hashtags);
});

test('rpc feed_posts', async () => {
  const me = await client.from('profiles').select('id').limit(1);
  uid = String((me.data as Record<string, unknown>[])[0]!.id);
  const { data, error } = await client.rpc('feed_posts', { tab: 'all', max_rows: 5 });
  expect(error).toBeNull();
  expect((data as unknown[]).length).toBeGreaterThan(0);
});

test('rpc skaler (is_unit_available)', async () => {
  const units = await client.from('stay_units').select('id').limit(1);
  const unitId = String((units.data as Record<string, unknown>[])[0]!.id);
  const { data, error } = await client.rpc('is_unit_available', { unit: unitId, from_date: '2030-01-01', to_date: '2030-01-03' });
  expect(error).toBeNull();
  expect(typeof data).toBe('boolean');
});

test('or süzgeci + in', async () => {
  const { data, error } = await client.from('groups').select('*').limit(2);
  expect(error).toBeNull();
  const ids = (data as Record<string, unknown>[]).map((r) => String(r.id));
  const res = await client.from('group_messages').select('*').in('group_id', ids).limit(5);
  expect(res.error).toBeNull();
});
