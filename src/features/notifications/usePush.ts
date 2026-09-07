/**
 * Oturum açıkken cihazın bildirim adresini kaydeder.
 *
 * Kayıt her açılışta tekrarlanır: adres cihaz güncellemesi ya da uygulama
 * yeniden kurulumuyla değişebilir ve sunucu tarafında `last_seen_at`
 * tazelenmesi ölü cihazların ayıklanmasını mümkün kılar.
 */
import { useEffect } from 'react';

import { getDataProvider } from '@/data';
import type { User } from '@/domain';

import { pushTokenAl } from './push';
import { pushTemizligiAyarla } from './push-session';

export function usePushRegistration(user: User | null): void {
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let gecerli = true;

    void (async () => {
      const token = await pushTokenAl(
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || undefined,
      );
      // `null` normal bir sonuç: izin verilmemiş, ortam desteklemiyor ya da
      // proje kimliği yok. Uygulama bildirimsiz çalışmaya devam eder.
      if (!gecerli || !token) return;
      try {
        await getDataProvider().notifications.registerPushToken(userId, token);
      } catch {
        return;
      }
      if (!gecerli) return;
      // Çıkış anında silinebilmesi için temizliği kaydet.
      pushTemizligiAyarla(async () => {
        await getDataProvider().notifications.unregisterPushToken(userId, token);
      });
    })();

    return () => {
      gecerli = false;
      pushTemizligiAyarla(null);
    };
  }, [userId]);
}
