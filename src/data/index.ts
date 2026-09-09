import type { DataProvider } from './repositories';
import { createMockProvider } from './mock/provider';
import { asSupabaseLike, getSupabaseClient, readRemoteConfig } from './remote/client';
import { createRemoteProvider } from './remote/provider';
import { agVar, agiIzle } from '@/core/network';
import { createMedyaYukleyici } from '@/features/media/upload';

import { createOfflineQueue } from './remote/offline';

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
    if (config) {
      const client = asSupabaseLike(getSupabaseClient(config));
      const remote = createRemoteProvider(client);
      // Cihazdaki fotoğrafları küçültüp EXIF'ini silerek yükleyen katman.
      // Veri katmanı bunu arayüz olarak alır; yerel modül bağımlılığı
      // `src/features/media` altında kalır (bkz. `remote/context.ts`).
      remote.context.setMedyaYukleyici(createMedyaYukleyici(client));

      // Çevrimdışı yazma kuyruğu. Dağda şebeke yoktur; ağ hatasında kaybolan
      // bir kayıt yerine sıraya alınır ve bağlantı gelince gönderilir.
      const kuyruk = createOfflineQueue({ isOnline: agVar });
      remote.context.setKuyruk(kuyruk);
      // Bağlantı geri geldiğinde bekleyenleri gönder. Dinleme uygulama ömrü
      // boyunca açık kalır; ayrıca `onlineManager` da buradan beslenir.
      agiIzle((cevrimici) => {
        if (cevrimici) void kuyruk.flush(client).catch(() => undefined);
      });
      // Açılışta da bir kez denenir: uygulama kapalıyken bağlantı gelmiş olabilir.
      void kuyruk.flush(client).catch(() => undefined);

      provider = remote;
    } else {
      // Mock'ta yükleme yok: yerel `file://` adresi zaten aynı cihazda
      // çizilecek, gidecek bir sunucu da yok.
      provider = createMockProvider();
    }
  }
  return provider;
}

/** Testler için sağlayıcıyı değiştirme kancası. */
export function setDataProvider(next: DataProvider | null): void {
  provider = next;
}
