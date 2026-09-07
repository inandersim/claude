import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getDataProvider, type RealtimeApi, type Unsubscribe } from '@/data';

/**
 * Anlık güncelleme aboneliği — geldiğinde ilgili sorguyu tazeler.
 *
 * ## Neden var
 * `src/data/remote/realtime.ts` içindeki yedi abonelik baştan beri yazılıydı
 * ama **hiçbir ekrandan çağrılmıyordu.** Sohbet 4 saniyede bir, konum
 * paylaşımı 10 saniyede bir, SOS oturumu 5 saniyede bir yeniden sorgulanarak
 * güncelleniyordu. Bu hem gecikme hem de doğrudan faturaya yazan sürekli
 * trafik demek: sohbeti açık 1.000 kullanıcı, saatte 900.000 istek.
 *
 * ## Sorgulama neden tümüyle kaldırılmadı
 * Abonelik kopabilir (ağ değişimi, uyku, sunucu tarafı sınır). Sorgulama
 * **yedek** olarak kalır ama abonelik ayaktayken çok daha seyrektir; bu
 * kancayı kullanan ekranlar `realtimeAralik` ile bu ikisini birlikte
 * ayarlar. Mock sağlayıcıda abonelik yoktur ve eski aralık aynen sürer.
 */
export function useRealtime(
  abone: ((api: RealtimeApi, tetikle: () => void) => Unsubscribe) | null,
  key: QueryKey,
): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!abone) return;
    const api = getDataProvider().realtime;
    if (!api) return;
    let kapali = false;
    const kapat = abone(api, () => {
      // Gelen satırı listeye elle eklemek yerine sorgu tazelenir: sıralama,
      // süzme ve sayfalama kuralları tek yerde (sağlayıcıda) kalsın.
      void qc.invalidateQueries({ queryKey: key });
    });
    return () => {
      if (kapali) return;
      kapali = true;
      void kapat();
    };
    // `key` dizi olduğu için kimliği değil içeriği izlenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abone, qc, JSON.stringify(key)]);
}

/**
 * Abonelik varken kullanılacak sorgulama aralığı.
 *
 * Gerçek arka uçta abonelik güncellemeyi taşır; sorgulama yalnızca kopma
 * ihtimaline karşı seyrek bir ağ olarak kalır. Mock'ta abonelik yok, bu
 * yüzden ekranın kendi sık aralığı korunur.
 */
export function realtimeAralik(yedekMs: number, sikMs: number): number {
  return getDataProvider().realtime ? yedekMs : sikMs;
}
