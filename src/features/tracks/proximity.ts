import { useState } from 'react';

import type { GeoPoint, ID, TrackPoi, YaklasanNokta } from '@/domain';
import { distanceM, yaklasmaDegerlendir } from '@/domain';

/**
 * Yürürken yakınlaşılan noktaları duyurur.
 *
 * `nearbyPois`/`poisAlong` domain'de baştan beri vardı ama hiçbir ekrandan
 * çağrılmıyordu; yürüyen kişi 200 m ötedeki çeşmeyi ancak haritayı açıp
 * arayarak bulabiliyordu. Karar mantığı (`yaklasmaDegerlendir`) saf ve
 * testli; burada yalnızca konum değiştikçe çalıştırılıp sonucu ekrana
 * taşıyan ince bir katman var.
 *
 * "Zaten uyarıldı" kümesi `ref` içinde tutulur: state olsaydı her konum
 * güncellemesi yeniden çizim tetikler, oysa çoğu güncellemede uyarılacak
 * yeni bir şey yoktur.
 */
export function useYaklasmaUyarilari(
  konum: GeoPoint | null,
  pois: readonly TrackPoi[] | undefined,
  aktif = true,
): YaklasanNokta[] {
  // "Zaten uyarıldı" kümesi gerçekten durumdur: iki konum güncellemesi
  // arasında yaşaması gerekir. React'in çizim sırasında durum uyarlama
  // (derive state during render) deseni kullanılıyor — efekt içinde
  // `setState` fazladan bir çizim turu demek ve derleyici kuralı da buna
  // izin vermiyor.
  const [durum, setDurum] = useState<{
    konum: GeoPoint | null;
    uyarilanlar: ReadonlySet<ID>;
    uyarilar: YaklasanNokta[];
  }>({ konum: null, uyarilanlar: new Set(), uyarilar: [] });

  if (!aktif) {
    // Kayıt durdu: geçmiş temizlenir, sonraki yürüyüş kendi başına
    // değerlendirilsin — aynı çeşmeyi bir daha duymamak diye bir şey olmasın.
    if (durum.konum || durum.uyarilanlar.size || durum.uyarilar.length) {
      setDurum({ konum: null, uyarilanlar: new Set(), uyarilar: [] });
    }
    return EMPTY;
  }

  if (konum && pois?.length && konum !== durum.konum) {
    const sonuc = yaklasmaDegerlendir(konum, pois, durum.uyarilanlar);
    setDurum({
      konum,
      uyarilanlar: sonuc.uyarilanlar,
      // Yeni uyarı yoksa öncekini koru: liste ekranda titremesin. Ama
      // mesafeler tazelenir — donmuş bir "161 m" kişi uzaklaşırken yanlış
      // bilgi verir ve bu ekranın tek işi doğru mesafeyi söylemek.
      uyarilar: sonuc.uyarilar.length
        ? sonuc.uyarilar
        : tazeMesafeler(durum.uyarilar, konum, sonuc.uyarilanlar),
    });
  }

  return durum.uyarilar;
}

/**
 * Gösterimde duran uyarıların mesafesini günceller ve artık menzilde
 * olmayanları (çıkış yarıçapını aşmış) listeden düşürür.
 */
function tazeMesafeler(
  uyarilar: readonly YaklasanNokta[],
  konum: GeoPoint,
  hala: ReadonlySet<ID>,
): YaklasanNokta[] {
  if (!uyarilar.length) return EMPTY;
  const taze = uyarilar
    .filter((u) => hala.has(u.poi.id))
    .map((u) => ({ poi: u.poi, distanceM: Math.round(distanceM(konum, u.poi.coords)) }))
    .sort((a, b) => a.distanceM - b.distanceM);
  return taze.length ? taze : EMPTY;
}

/** Sabit boş dizi — her çizimde yeni dizi üretip gereksiz render tetiklemesin. */
const EMPTY: YaklasanNokta[] = [];
