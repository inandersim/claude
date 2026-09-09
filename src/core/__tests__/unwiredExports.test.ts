import fs from 'node:fs';
import path from 'node:path';

/**
 * Bağlanmamış dışa aktarım nöbetçisi.
 *
 * Bu oturumda aynı hata dört kez çıktı: `users.updateProfile`, `uploadMedia`,
 * yedi anlık güncelleme aboneliği ve `nearbyPois` — hepsi eksiksiz yazılmış,
 * test edilmiş, belgelenmiş ve **hiçbir yerden çağrılmamıştı.** Yazılmış ama
 * bağlanmamış kod, olmayan koddan daha kötüdür: var sanılır, kimse aramaz,
 * ve eksik olduğu ancak kullanıcı o özelliği denediğinde anlaşılır.
 *
 * Bu paket tek tek düzeltmeleri değil **sınıfı** yakalar: üretim kodunda
 * hiçbir yerden çağrılmayan dışa aktarılmış işlevler listelenir ve liste
 * yalnızca **küçülebilir**. Yeni bir bağlanmamış işlev eklenirse test kırılır.
 *
 * Listedeki her ad bilinçli bir borçtur, kabul değil. Biri bağlandığında
 * listeden çıkarılır; bir daha kopması da böylece engellenmiş olur.
 */
const SRC = path.join(__dirname, '..', '..');

function tsDosyalari(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsDosyalari(p));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const testMi = (f: string) => f.includes('__tests__') || /\.test\.tsx?$/.test(f);

/**
 * Bilinen borç — **yalnızca kısalabilir.**
 *
 * Bir ad buradaysa: ya henüz bağlanmamış bir özellik (bağlanmalı) ya da
 * gerçekten gereksiz (silinmeli). İkisi de iş; listede durması ikisinden
 * birinin yapılacağını hatırlatır.
 */
const BILINEN_BORC = [
  // Özellik yazılmış ama ekrana bağlanmamış
  'amsAdvice',
  'useElevation',
  'useIdentifications',
  'useMyStays',
  'useNearbyHeritage',
  'useToggleLike',
  'useTotalUnread',
  'withHeritageDistance',
  'HashtagStrip',
  'LiveStrip',
  // Yardımcı/eşleyici — kullanılmıyor
  'animalIcon',
  'averageRating',
  'canTransition',
  'countMembers',
  'episodeLabel',
  'fromGeoPath',
  'isBestMonth',
  'isDeterrentAnimal',
  'isDeterrentSound',
  'isHeritageEra',
  'isKidAgeBand',
  'kidAgeBandRank',
  'maxStageElevation',
  'nextStatus',
  'overlayData',
  'rawMapStyle',
  'removeMedia',
  'seasonStart',
  'streakBonus',
  'toAvailability',
  'toDeterrentProfile',
  // Test/geliştirme kancaları — üretimde çağrılmaması normal
  'invalidateCached',
  'resetMapLibreCache',
  'resetPackManager',
  'resetSupabaseClient',
  'setDataProvider',
  // Testi olan ama uygulamadan çağrılmayanlar. Test varlığı bağlı olduğu
  // anlamına gelmiyor: `nearbyPois` de testliydi ve hiç çağrılmıyordu.
  'backoffMs',
  'chooseLink',
  'clearExternalCache',
  'clubXpForEvent',
  'completeChallenge',
  'countryByDialCode',
  'createMemoryBuffer',
  'demRemoteUrl',
  'forecastAgeMin',
  'formatE164',
  'fromGeoLine',
  'fromGpx',
  'groupBySeries',
  'isAvailable',
  'isInsideHazard',
  'isValidPhone',
  'mentionsMe',
  'mergeIntoExisting',
  'nationalNumber',
  'otpSecondsLeft',
  'packSizeEstimateMb',
  'progressPct',
  'releaseDue',
  'scheduleForDay',
  'scrubEndpoint',
  'sortAlphabetically',
  'stickerFor',
  'styleVariants',
  'summarizeDay',
  'systemMessage',
  'tickerText',
  'tokenListesiAyni',
  'totalDescent',
  'trackOverlap',
].sort();

describe('bağlanmamış dışa aktarımlar', () => {
  const dosyalar = tsDosyalari(SRC);

  /** Dışa aktarılan işlev/bileşen adları → tanım dosyası. */
  const disaAktarilan = new Map<string, string>();
  for (const f of dosyalar) {
    if (testMi(f)) continue;
    for (const m of fs
      .readFileSync(f, 'utf8')
      .matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
      disaAktarilan.set(m[1]!, f);
    }
  }

  it('kaynak taranabiliyor (yol kayarsa test boşa düşmesin)', () => {
    expect(disaAktarilan.size).toBeGreaterThan(500);
  });

  it('bilinen borç listesi büyümüyor', () => {
    const sayim = new Map<string, { ic: number; dis: number }>();
    for (const f of dosyalar) {
      const src = fs.readFileSync(f, 'utf8');
      for (const [ad, tanim] of disaAktarilan) {
        const n = (src.match(new RegExp(`\\b${ad}\\b`, 'g')) ?? []).length;
        if (!n) continue;
        const k = sayim.get(ad) ?? { ic: 0, dis: 0 };
        // Tanım dosyasında `export function X` satırının kendisi sayılmaz.
        if (f === tanim) k.ic += n - 1;
        else if (!testMi(f)) k.dis += n;
        sayim.set(ad, k);
      }
    }

    const bagsiz = [...disaAktarilan.keys()]
      .filter((ad) => {
        const k = sayim.get(ad) ?? { ic: 0, dis: 0 };
        return k.dis === 0 && k.ic === 0;
      })
      .sort();

    const yeni = bagsiz.filter((ad) => !BILINEN_BORC.includes(ad));
    expect(yeni).toEqual([]);
  });

  it('borç listesinde artık geçersiz ad kalmamış (bağlananlar çıkarılmalı)', () => {
    // Bir ad bağlandıysa ya da silindiyse listeden de çıkmalı; yoksa liste
    // zamanla gerçeği yansıtmayan bir kalıntıya döner.
    const yok = BILINEN_BORC.filter((ad) => !disaAktarilan.has(ad));
    expect(yok).toEqual([]);
  });
});
