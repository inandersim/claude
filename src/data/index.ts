import type { DataProvider } from './repositories';
import { createMockProvider } from './mock/provider';
import { asSupabaseLike, getSupabaseClient, readRemoteConfig } from './remote/client';
import { createRemoteProvider } from './remote/provider';

export * from './repositories';
export { NotFoundError, AuthError } from './mock/provider';

let provider: DataProvider | null = null;

/**
 * Uygulama genelinde tek veri sağlayıcısı.
 *
 * Seçim kuralı:
 *  1. `EXPO_PUBLIC_DATA_PROVIDER=mock` → her zaman mock (açık geçersiz kılma).
 *  2. `EXPO_PUBLIC_SUPABASE_URL` **ve** `EXPO_PUBLIC_SUPABASE_ANON_KEY` tanımlı
 *     → gerçek Supabase sağlayıcısı.
 *  3. Aksi hâlde mock (çevrimdışı demo verisi).
 */
export function getDataProvider(): DataProvider {
  if (!provider) {
    const kind = process.env.EXPO_PUBLIC_DATA_PROVIDER?.trim();
    const config = kind === 'mock' ? null : readRemoteConfig();
    provider = config
      ? createRemoteProvider(asSupabaseLike(getSupabaseClient(config)))
      : createMockProvider();
  }
  return provider;
}

/** Testler için sağlayıcıyı değiştirme kancası. */
export function setDataProvider(next: DataProvider | null): void {
  provider = next;
}
