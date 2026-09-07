/**
 * Anlık bildirim (push) — eksik olan halka.
 *
 * Sunucu tarafı zaten hazırdı: `profiles.push_tokens` sütunu şemada, dağıtım
 * `supabase/functions/push-fanout` içinde. Eksik olan tek şey **istemcinin
 * kendi token'ını yazması**ydı; bu yüzden yakındaki tehlike uyarısı, konum
 * paylaşımı daveti ve SOS bildirimi uygulama kapalıyken kimseye ulaşmıyordu.
 *
 * Modül iki katmandan oluşuyor:
 *   · Saf liste mantığı (test edilir) — hangi token saklanır, kaçı, hangi sırayla.
 *   · `expo-notifications` sarmalayıcıları — cihazda çalışır, testte çağrılmaz.
 *
 * Her şey hataya dayanıklı: izin verilmezse, modül yoksa (Expo Go, web) ya da
 * token alınamazsa uygulama **normal çalışmaya devam eder**; yalnızca bildirim
 * gelmez.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { gecerliToken } from '@/domain/push';

export { TOKEN_TAVANI, gecerliToken, tokenCikar, tokenEkle } from '@/domain/push';

/** Bu ortamda push mümkün mü? (web ve Expo Go'da değil.) */
export function pushMumkun(platform: string = Platform.OS): boolean {
  return platform === 'ios' || platform === 'android';
}

/**
 * Android bildirim kanalı.
 *
 * Android 8'den beri kanalı olmayan bildirim **hiç görünmez**. İki kanal var
 * çünkü acil uyarının sessize alınmaması gerekiyor: kullanıcı sosyal
 * bildirimleri kısabilir ama SOS kanalı ayrı kalır.
 *
 * Adlar dağıtım fonksiyonundakiyle **birebir** aynı olmak zorunda:
 * `push-fanout` gönderirken `channelId: 'emergency' | 'default'` yazıyor.
 * Uyuşmazsa bildirim varsayılan kanala düşer ve acil uyarı sessizce
 * önceliğini kaybeder — çökme yok, sadece SOS titremez.
 */
export const KANALLAR = {
  genel: 'default',
  acil: 'emergency',
} as const;

export async function kanallariKur(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(KANALLAR.genel, {
      name: 'Bildirimler',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    await Notifications.setNotificationChannelAsync(KANALLAR.acil, {
      name: 'Acil durum',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      // Acil uyarı kilit ekranında da okunabilmeli.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  } catch {
    // Kanal kurulamadıysa bildirim varsayılan kanala düşer; çökme sebebi değil.
  }
}

/**
 * İzin ister ve cihazın Expo push token'ını döndürür.
 *
 * `null` dönmesi normal bir sonuçtur: kullanıcı izin vermemiş, ortam
 * desteklemiyor ya da proje kimliği tanımsız olabilir. Çağıran bunu hata
 * saymamalı.
 */
export async function pushTokenAl(projeKimligi?: string): Promise<string | null> {
  if (!pushMumkun()) return null;
  try {
    const mevcut = await Notifications.getPermissionsAsync();
    let durum = mevcut.status;
    // Kullanıcı daha önce reddettiyse tekrar sormak rahatsız edicidir ve iOS
    // zaten ikinci kez sormaz; yalnızca hiç sorulmamışsa sor.
    if (durum !== 'granted' && mevcut.canAskAgain) {
      durum = (await Notifications.requestPermissionsAsync()).status;
    }
    if (durum !== 'granted') return null;
    await kanallariKur();
    const { data } = await Notifications.getExpoPushTokenAsync(
      projeKimligi ? { projectId: projeKimligi } : undefined,
    );
    return gecerliToken(data) ? data : null;
  } catch {
    return null;
  }
}
