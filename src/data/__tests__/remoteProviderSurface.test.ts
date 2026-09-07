import { createMockProvider } from '@/data/mock/provider';
import { createRemoteProvider } from '@/data/remote/provider';
import type { SupabaseLike } from '@/data/remote/postgrest';

/**
 * Sözleşme yüzeyi denetimi: uzak sağlayıcı, mock sağlayıcıdaki **her**
 * repository ve metodu sunmalıdır. Bu test veritabanı gerektirmez.
 */
const stubClient = {
  from: () => ({}) as never,
  rpc: () => ({}) as never,
  auth: {} as never,
} as unknown as SupabaseLike;

const REPOSITORY_KEYS = [
  'auth',
  'users',
  'feed',
  'explore',
  'matches',
  'notifications',
  'messages',
  'hazards',
  'live',
  'market',
  'instructors',
  'library',
  'presence',
  'stories',
  'businesses',
  'billing',
  'emergency',
  'ai',
  'maps',
  'climbing',
  'satellite',
  'inventory',
  'clubs',
  'fun',
  'destinations',
  'vision',
  'social',
  'groups',
  'courses',
  'tracks',
  'weather',
  'countries',
  'articles',
  'wildlife',
  'telemed',
  'tv',
  'heritage',
  'kids',
] as const;

describe('uzak sağlayıcı yüzeyi', () => {
  const mock = createMockProvider({ persist: false, latencyMs: 0 });
  const remote = createRemoteProvider(stubClient);

  it('38 repository sunar', () => {
    expect(REPOSITORY_KEYS).toHaveLength(38);
    for (const key of REPOSITORY_KEYS) {
      expect(typeof (remote as unknown as Record<string, unknown>)[key]).toBe('object');
    }
    expect(typeof remote.reset).toBe('function');
  });

  it('mock sağlayıcıdaki her metodu uygular', () => {
    const missing: string[] = [];
    for (const key of REPOSITORY_KEYS) {
      const mockRepo = (mock as unknown as Record<string, Record<string, unknown>>)[key]!;
      const remoteRepo = (remote as unknown as Record<string, Record<string, unknown>>)[key]!;
      for (const method of Object.keys(mockRepo)) {
        if (typeof mockRepo[method] !== 'function') continue;
        if (typeof remoteRepo[method] !== 'function') missing.push(`${key}.${method}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('toplam metot sayısı sözleşmeyle uyumlu', () => {
    let count = 0;
    for (const key of REPOSITORY_KEYS) {
      const repo = (remote as unknown as Record<string, Record<string, unknown>>)[key]!;
      count += Object.keys(repo).filter((m) => typeof repo[m] === 'function').length;
    }
    expect(count).toBe(312);
  });
});
