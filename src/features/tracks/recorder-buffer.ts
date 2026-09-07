/**
 * İz kaydının **dayanıklı** nokta tamponu.
 *
 * Neden gerekli: arka plan konum görevi (`expo-task-manager`) uygulamanın React
 * ağacından **ayrı bir JS bağlamında** çalışır — bileşen durumuna yazamaz. Üstelik
 * Android ekran kapalıyken uygulamayı bellekten atabilir; o anda yalnızca React
 * durumunda duran noktalar kaybolur.
 *
 * Bu yüzden noktalar diske, satır başına bir JSON kaydı olarak eklenir. Biçim
 * bilinçli olarak JSON Lines: dosyanın sonuna eklemek tüm dosyayı yeniden
 * yazmadan mümkün, yarım kalan son satır da kalan kaydı bozmuyor.
 */
import type { TrackPoint } from '@/domain';

/** Tamponun dosya sistemine bağlantısı; testler bellek uygulamasını verir. */
export interface PointBuffer {
  append(points: TrackPoint[]): void;
  readAll(): TrackPoint[];
  clear(): void;
}

/** Bir noktayı tek satıra kodlar (alan sırası sabit — dosya elle de okunabilir). */
export function encodePoint(p: TrackPoint): string {
  return JSON.stringify([p.latitude, p.longitude, p.elevationM, p.t]);
}

/**
 * Tek satırı çözer. Bozuk satır **atılır**, hata fırlatılmaz: uygulama
 * öldürülürken yarım yazılmış son satır bütün kaydı düşürmemeli.
 */
export function decodePoint(line: string): TrackPoint | null {
  try {
    const v = JSON.parse(line) as unknown;
    if (!Array.isArray(v) || v.length < 4) return null;
    const [lat, lon, ele, t] = v as [unknown, unknown, unknown, unknown];
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      latitude: lat,
      longitude: lon,
      elevationM: typeof ele === 'number' ? ele : null,
      t: typeof t === 'number' ? t : null,
    };
  } catch {
    return null;
  }
}

export function encodePoints(points: TrackPoint[]): string {
  return points.map(encodePoint).join('\n') + (points.length ? '\n' : '');
}

export function decodePoints(text: string): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const p = decodePoint(line);
    if (p) out.push(p);
  }
  return out;
}

/**
 * İki nokta dizisini birleştirir.
 *
 * Ön plan dinleyicisi ile arka plan görevi **devir anında bir süre birlikte**
 * çalışır; aynı fiziksel konum ölçümü ikisine de düşer. Ölçümün zaman damgası
 * işletim sisteminden geldiği için ikisinde de aynıdır — bu yüzden ayıklama
 * tam zaman damgası eşitliğine bakar. Mesafeye göre ayıklamak izin şeklini
 * değiştirirdi (yerinde duran yürüyüşçünün noktaları silinirdi), o yüzden
 * yapılmıyor.
 *
 * Zaman damgası olmayan noktalar (içe aktarılan parçalar) sıraları korunarak
 * sona eklenir; ayıklanmazlar çünkü ayırt edilemezler.
 */
export function mergePoints(...gruplar: TrackPoint[][]): TrackPoint[] {
  const zamanli = new Map<number, TrackPoint>();
  const zamansiz: TrackPoint[] = [];
  for (const grup of gruplar) {
    for (const p of grup) {
      if (typeof p.t === 'number') {
        // İlk gelen kazanır: ön plan ölçümü genelde daha erken yazılır ve
        // yükseklik alanı doludur.
        if (!zamanli.has(p.t)) zamanli.set(p.t, p);
      } else {
        zamansiz.push(p);
      }
    }
  }
  const sirali = [...zamanli.values()].sort((a, b) => (a.t as number) - (b.t as number));
  return [...sirali, ...zamansiz];
}

/** Testler ve web için bellek içi tampon. */
export function createMemoryBuffer(): PointBuffer & { text: () => string } {
  let metin = '';
  return {
    text: () => metin,
    append(points) {
      metin += encodePoints(points);
    },
    readAll() {
      return decodePoints(metin);
    },
    clear() {
      metin = '';
    },
  };
}
