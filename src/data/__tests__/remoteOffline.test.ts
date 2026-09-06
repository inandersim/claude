import {
  backoffMs,
  createOfflineQueue,
  isConflict,
  isRejected,
  isTransient,
} from '@/data/remote/offline';
import { RemoteError, type PostgrestResponse, type Row, type SupabaseLike } from '@/data/remote/postgrest';

/** Bellek içi AsyncStorage taklidi. */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: async (k: string) => map.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: async (k: string) => {
      map.delete(k);
    },
  };
}

interface Call {
  op: string;
  table: string;
  values?: Row | Row[];
}

/** Kuyruk testleri için asgari `SupabaseLike` taklidi. */
function fakeClient(script: (call: Call) => PostgrestResponse<Row[]>['error']) {
  const calls: Call[] = [];
  const builder = (op: string, table: string, values?: Row | Row[]) => {
    const call: Call = { op, table, values };
    calls.push(call);
    const self = {
      eq: () => self,
      select: () => self,
      then: (resolve: (r: PostgrestResponse<Row[]>) => unknown) =>
        Promise.resolve(resolve({ data: [], error: script(call) })),
    };
    return self as never;
  };
  const client = {
    from: (table: string) => ({
      select: () => builder('select', table),
      insert: (values: Row | Row[]) => builder('insert', table, values),
      upsert: (values: Row | Row[]) => builder('upsert', table, values),
      update: (values: Row) => builder('update', table, values),
      delete: () => builder('delete', table),
    }),
    rpc: (fn: string, args?: Row) => builder('rpc', fn, args),
    auth: {} as never,
  } as unknown as SupabaseLike;
  return { client, calls };
}

describe('çevrimdışı kuyruk', () => {
  it('ağ yokken hiçbir şey göndermez, sıra korunur', async () => {
    const { client, calls } = fakeClient(() => null);
    const queue = createOfflineQueue({ storage: memoryStorage(), isOnline: () => false });
    await queue.enqueue({ kind: 'insert', target: 'post_likes', payload: { post_id: 'a' } });
    await queue.enqueue({ kind: 'insert', target: 'post_likes', payload: { post_id: 'b' } });
    const result = await queue.flush(client);
    expect(result.sent).toBe(0);
    expect(result.remaining).toBe(2);
    expect(calls).toHaveLength(0);
    expect((await queue.list()).map((m) => (m.payload as Row).post_id)).toEqual(['a', 'b']);
  });

  it('bağlantı gelince oluşturulma sırasıyla gönderir', async () => {
    const { client, calls } = fakeClient(() => null);
    const queue = createOfflineQueue({ storage: memoryStorage() });
    await queue.enqueue({ kind: 'insert', target: 'post_likes', payload: { post_id: 'a' } });
    await queue.enqueue({ kind: 'delete', target: 'post_likes', match: { post_id: 'b' } });
    await queue.enqueue({ kind: 'rpc', target: 'award_xp', payload: { target_user: 'u' } });

    const result = await queue.flush(client);
    expect(result.sent).toBe(3);
    expect(result.remaining).toBe(0);
    expect(calls.map((c) => `${c.op}:${c.table}`)).toEqual([
      'insert:post_likes',
      'delete:post_likes',
      'rpc:award_xp',
    ]);
    expect(await queue.size()).toBe(0);
  });

  it('benzersizlik ihlalinde sunucu kazanır ve işlem düşer', async () => {
    const { client } = fakeClient((call) =>
      call.op === 'insert' ? { message: 'duplicate key', code: '23505' } : null,
    );
    const queue = createOfflineQueue({ storage: memoryStorage() });
    await queue.enqueue({ kind: 'insert', target: 'post_likes', payload: { post_id: 'a' } });
    const result = await queue.flush(client);
    expect(result.conflicts).toBe(1);
    expect(result.remaining).toBe(0);
    expect(result.details[0]?.outcome).toBe('conflict');
  });

  it('rezervasyon çakışmasında (23P01) sessizce üzerine yazmaz', async () => {
    const { client } = fakeClient(() => ({ message: 'exclusion', code: '23P01' }));
    const queue = createOfflineQueue({ storage: memoryStorage() });
    await queue.enqueue({ kind: 'rpc', target: 'reserve_unit', payload: { unit: 'u' } });
    const result = await queue.flush(client);
    expect(result.conflicts).toBe(1);
    expect(result.details[0]?.outcome).toBe('conflict');
  });

  it('yetki hatasında yeniden denemez', async () => {
    const { client } = fakeClient(() => ({ message: 'permission denied', code: '42501' }));
    const queue = createOfflineQueue({ storage: memoryStorage() });
    await queue.enqueue({ kind: 'update', target: 'posts', payload: { caption: 'x' }, match: { id: '1' } });
    const result = await queue.flush(client);
    expect(result.rejected).toBe(1);
    expect(result.remaining).toBe(0);
  });

  it('geçici hatada kuyrukta kalır, sırayı bozmaz ve deneme sayısı artar', async () => {
    let fail = true;
    const { client, calls } = fakeClient(() =>
      fail ? { message: 'connection failure', code: '08006' } : null,
    );
    const queue = createOfflineQueue({ storage: memoryStorage() });
    await queue.enqueue({ kind: 'insert', target: 'a', payload: { n: 1 } });
    await queue.enqueue({ kind: 'insert', target: 'b', payload: { n: 2 } });

    const first = await queue.flush(client);
    expect(first.sent).toBe(0);
    expect(first.remaining).toBe(2);
    expect((await queue.list())[0]?.attempts).toBe(1);
    // İlk geçici hatadan sonra kalanlar denenmez (sıra korunur)
    expect(calls).toHaveLength(1);

    fail = false;
    const second = await queue.flush(client);
    expect(second.sent).toBe(2);
    expect(await queue.size()).toBe(0);
  });

  it('deneme sınırı aşılınca kalıcı reddedilir', async () => {
    const { client } = fakeClient(() => ({ message: 'network', code: '08006' }));
    const queue = createOfflineQueue({ storage: memoryStorage(), maxAttempts: 2 });
    await queue.enqueue({ kind: 'insert', target: 'a', payload: {} });
    expect((await queue.flush(client)).remaining).toBe(1);
    const second = await queue.flush(client);
    expect(second.rejected).toBe(1);
    expect(second.remaining).toBe(0);
  });

  it('hata sınıflandırması', () => {
    expect(isTransient(new RemoteError({ message: 'x', code: '08006' }, 'c'))).toBe(true);
    expect(isTransient(new TypeError('Network request failed'))).toBe(true);
    expect(isConflict(new RemoteError({ message: 'x', code: '23505' }, 'c'))).toBe(true);
    expect(isConflict(new RemoteError({ message: 'x', code: '23P01' }, 'c'))).toBe(true);
    expect(isRejected(new RemoteError({ message: 'x', code: '42501' }, 'c'))).toBe(true);
    expect(isRejected(new RemoteError({ message: 'x', code: '23505' }, 'c'))).toBe(false);
  });

  it('üstel bekleme artar ve sınırlanır', () => {
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(3)).toBe(9000);
    expect(backoffMs(100)).toBe(60_000);
  });
});
