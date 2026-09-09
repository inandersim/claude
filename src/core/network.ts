import { onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

/**
 * Ağ durumu — tek kaynak.
 *
 * ## Neden gerekti
 * Uygulamada ağ durumu tespiti **hiç yoktu.** TanStack Query'nin
 * `onlineManager`'ı da yapılandırılmamıştı, yani sorgular çevrimdışıyken de
 * denenip başarısız oluyordu. Dağda şebekesiz çalışan bir uygulamada bu,
 * temel bir eksik: `createOfflineQueue` (çakışma politikası belgelenmiş,
 * testli, tam bir çevrimdışı yazma kuyruğu) da bu yüzden bağlanamamıştı —
 * "çevrimiçi miyiz" sorusunu soracak kimse yoktu.
 *
 * ## `isInternetReachable` neden `isConnected`'dan önemli
 * Telefon bir baz istasyonuna bağlı ama veri geçmiyor olabilir (kapsama
 * kenarı, tıkalı hotspot, tünel çıkışı). `isConnected` bu durumda `true`
 * döner ve yazmalar sessizce kaybolur. Bilinmiyorsa (`undefined`) çevrimiçi
 * varsayılır: yanlışlıkla çevrimdışı sanıp her yazmayı kuyruğa atmak,
 * gereksiz gecikme demek.
 */

let cevrimici = true;

/** Son bilinen durum. Kuyruk ve sağlayıcı bunu okur. */
export function agVar(): boolean {
  return cevrimici;
}

function durumdanOku(state: Network.NetworkState): boolean {
  // `isInternetReachable` bilinmiyorsa bağlantı durumuna düşülür; o da
  // bilinmiyorsa çevrimiçi varsayılır (bkz. dosya başı).
  return state.isInternetReachable ?? state.isConnected ?? true;
}

/**
 * Dinlemeyi başlatır; durum değişince `onDegisim` çağrılır (yeniden bağlanma
 * anında kuyruğu boşaltmak için). Geri dönen fonksiyon dinlemeyi durdurur.
 */
export function agiIzle(onDegisim?: (cevrimici: boolean) => void): () => void {
  let durdu = false;

  const uygula = (yeni: boolean) => {
    if (durdu || yeni === cevrimici) return;
    cevrimici = yeni;
    onlineManager.setOnline(yeni);
    onDegisim?.(yeni);
  };

  // İlk durum eşzamansız gelir; o ana kadar çevrimiçi varsayılır.
  Network.getNetworkStateAsync()
    .then((s) => uygula(durumdanOku(s)))
    .catch(() => undefined);

  const abone = Network.addNetworkStateListener((e) => uygula(durumdanOku(e)));

  return () => {
    durdu = true;
    abone.remove();
  };
}
