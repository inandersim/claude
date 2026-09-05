import type { DataProvider } from './repositories';
import { createMockProvider } from './mock/provider';

export * from './repositories';
export { NotFoundError, AuthError } from './mock/provider';

let provider: DataProvider | null = null;

/**
 * Uygulama genelinde tek veri sağlayıcısı.
 * EXPO_PUBLIC_DATA_PROVIDER=remote olduğunda gerçek API istemcisi burada bağlanır.
 */
export function getDataProvider(): DataProvider {
  if (!provider) {
    const kind = process.env.EXPO_PUBLIC_DATA_PROVIDER ?? 'mock';
    if (kind === 'remote') {
      // Gerçek API istemcisi henüz eklenmedi; mock sağlayıcıya düşer.
      // TODO(api): src/data/remote/provider.ts ile aynı DataProvider sözleşmesini uygula.
      provider = createMockProvider();
    } else {
      provider = createMockProvider();
    }
  }
  return provider;
}

/** Testler için sağlayıcıyı değiştirme kancası. */
export function setDataProvider(next: DataProvider | null): void {
  provider = next;
}
