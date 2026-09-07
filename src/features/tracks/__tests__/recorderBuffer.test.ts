import type { TrackPoint } from '@/domain';
import {
  createMemoryBuffer,
  decodePoint,
  decodePoints,
  encodePoint,
  encodePoints,
  mergePoints,
} from '@/features/tracks/recorder-buffer';
import { ayriIzinGerekir, olaydanNoktalar } from '@/features/tracks/recorder-background';

const nokta = (t: number | null, lat = 40, lon = 29, ele: number | null = 100): TrackPoint => ({
  latitude: lat,
  longitude: lon,
  elevationM: ele,
  t,
});

describe('nokta kodlama', () => {
  it('gidiş dönüşte nokta aynen korunur', () => {
    const p = nokta(1700000000000, 40.1234567, 29.7654321, 1234.5);
    expect(decodePoint(encodePoint(p))).toEqual(p);
  });

  it('yükseklik ve zaman null olabilir', () => {
    const p = nokta(null, 40, 29, null);
    expect(decodePoint(encodePoint(p))).toEqual(p);
  });

  it('bozuk satır atılır, kalan kayıt okunur', () => {
    // Uygulama öldürülürken son satır yarım kalabilir; bütün kayıt bu yüzden
    // düşmemeli.
    const metin = encodePoints([nokta(1), nokta(2)]) + '[40.5,29.5,10';
    const okunan = decodePoints(metin);
    expect(okunan).toHaveLength(2);
    expect(okunan.map((p) => p.t)).toEqual([1, 2]);
  });

  it('anlamsız satırlar sessizce yoksayılır', () => {
    expect(decodePoint('null')).toBeNull();
    expect(decodePoint('{}')).toBeNull();
    expect(decodePoint('[1]')).toBeNull();
    expect(decodePoint('["a","b",1,2]')).toBeNull();
    expect(decodePoint('[null,null,1,2]')).toBeNull();
  });

  it('boş liste boş metin üretir (dosyaya gereksiz satır sonu yazılmaz)', () => {
    expect(encodePoints([])).toBe('');
    expect(decodePoints('')).toEqual([]);
  });
});

describe('mergePoints', () => {
  it('zaman damgasına göre sıralar', () => {
    const birlesik = mergePoints([nokta(30), nokta(10)], [nokta(20)]);
    expect(birlesik.map((p) => p.t)).toEqual([10, 20, 30]);
  });

  it('devir anında iki dinleyiciye düşen aynı ölçüm tek nokta olur', () => {
    // Ön plan dinleyicisi ile arka plan görevi kısa süre birlikte çalışır;
    // aynı fiziksel ölçümün zaman damgası ikisinde de aynıdır.
    const onPlan = [nokta(100, 40.0, 29.0), nokta(200, 40.1, 29.1)];
    const arkaPlan = [nokta(200, 40.1, 29.1), nokta(300, 40.2, 29.2)];
    const birlesik = mergePoints(onPlan, arkaPlan);
    expect(birlesik.map((p) => p.t)).toEqual([100, 200, 300]);
  });

  it('ilk gelen kazanır — ön plan ölçümünün yüksekliği korunur', () => {
    const onPlan = [nokta(100, 40, 29, 1500)];
    const arkaPlan = [nokta(100, 40, 29, null)];
    expect(mergePoints(onPlan, arkaPlan)[0]?.elevationM).toBe(1500);
  });

  it('mesafeye göre ayıklama yapılmaz — yerinde duran yürüyüşçü silinmez', () => {
    // Aynı koordinat, farklı zaman: duraklama gerçek veridir.
    const duruyor = [nokta(100, 40, 29), nokta(102, 40, 29), nokta(104, 40, 29)];
    expect(mergePoints(duruyor)).toHaveLength(3);
  });

  it('zamansız noktalar (içe aktarılan parça) sona eklenir ve ayıklanmaz', () => {
    const birlesik = mergePoints([nokta(null), nokta(null)], [nokta(50)]);
    expect(birlesik).toHaveLength(3);
    expect(birlesik[0]?.t).toBe(50);
  });

  it('boş girdiyle çökmez', () => {
    expect(mergePoints()).toEqual([]);
    expect(mergePoints([], [])).toEqual([]);
  });
});

describe('bellek tamponu', () => {
  it('eklenen noktalar okunur, temizlenince boşalır', () => {
    const tampon = createMemoryBuffer();
    tampon.append([nokta(1), nokta(2)]);
    tampon.append([nokta(3)]);
    expect(tampon.readAll().map((p) => p.t)).toEqual([1, 2, 3]);
    tampon.clear();
    expect(tampon.readAll()).toEqual([]);
  });

  it('boş ekleme dosyayı büyütmez', () => {
    const tampon = createMemoryBuffer();
    tampon.append([]);
    expect(tampon.text()).toBe('');
  });
});

describe('arka plan görev verisi', () => {
  it('konum olayını TrackPoint dizisine çevirir', () => {
    const noktalar = olaydanNoktalar({
      locations: [
        { coords: { latitude: 40.5, longitude: 29.5, altitude: 1200 }, timestamp: 111 },
        { coords: { latitude: 40.6, longitude: 29.6, altitude: null }, timestamp: 222 },
      ],
    });
    expect(noktalar).toEqual([
      { latitude: 40.5, longitude: 29.5, elevationM: 1200, t: 111 },
      { latitude: 40.6, longitude: 29.6, elevationM: null, t: 222 },
    ]);
  });

  it('geçersiz koordinatlı ölçüm atılır', () => {
    const noktalar = olaydanNoktalar({
      locations: [
        { coords: { latitude: NaN, longitude: 29, altitude: null }, timestamp: 1 },
        { coords: { latitude: 40, longitude: 29, altitude: null }, timestamp: 2 },
      ],
    });
    expect(noktalar).toHaveLength(1);
    expect(noktalar[0]?.t).toBe(2);
  });

  it('boş ya da bozuk olay boş dizi döndürür', () => {
    for (const veri of [null, undefined, {}, { locations: [] }]) {
      expect(olaydanNoktalar(veri)).toEqual([]);
    }
  });
});

describe('platform izin kararı', () => {
  it('Android ayrı izin istemez — kalıcı bildirimli ön plan servisi yeterli', () => {
    // `ACCESS_BACKGROUND_LOCATION` manifestte bilerek yok (Play politikası).
    // İzni istemek burada "reddedildi" döndürüp özelliği sessizce kapatırdı.
    expect(ayriIzinGerekir('android')).toBe(false);
  });

  it('iOS "her zaman" izni ister — arka planda konum başka türlü gelmez', () => {
    expect(ayriIzinGerekir('ios')).toBe(true);
  });

  it('web arka plan kaydı yapmaz', () => {
    expect(ayriIzinGerekir('web')).toBe(false);
  });
});
