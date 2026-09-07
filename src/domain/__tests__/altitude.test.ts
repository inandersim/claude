import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DENIZ_SEVIYESI_HPA,
  GUNLUK_KAZANC_SINIRI_M,
  IRTIFA_RISKLERI,
  NABIZ_UYARI_YUZDE,
  OLCUM_SINIRLARI,
  RISK_ESIGI_M,
  TAVSIYELER,
  basincHPa,
  beklenenSpo2,
  gecerliOlcum,
  irtifaDegerlendir,
  kanBasinciYorumu,
  nabizYukselmesi,
  olcumleriTemizle,
  solunanOksijenMmHg,
  type IrtifaGirdisi,
} from '@/domain/altitude';

describe('atmosfer modeli', () => {
  it('deniz seviyesinde standart basınç', () => {
    expect(basincHPa(0)).toBeCloseTo(DENIZ_SEVIYESI_HPA, 2);
    expect(basincHPa(-100)).toBeCloseTo(DENIZ_SEVIYESI_HPA, 2);
  });

  it('~5.500 m\'de basınç deniz seviyesinin yarısı', () => {
    // Bilinen fizik gerçeği: atmosfer kütlesinin yarısı 5.500 m'nin altında.
    const oran = basincHPa(5500) / DENIZ_SEVIYESI_HPA;
    expect(oran).toBeGreaterThan(0.49);
    expect(oran).toBeLessThan(0.53);
  });

  it('irtifa arttıkça basınç tekdüze azalır', () => {
    let onceki = Infinity;
    for (let h = 0; h <= 8000; h += 500) {
      const p = basincHPa(h);
      expect(p).toBeLessThan(onceki);
      onceki = p;
    }
  });

  it('deniz seviyesinde solunan oksijen ~149 mmHg', () => {
    // Ders kitabı değeri: 0,2095 × (760 − 47) ≈ 149.
    expect(solunanOksijenMmHg(0)).toBeGreaterThan(147);
    expect(solunanOksijenMmHg(0)).toBeLessThan(151);
  });

  it('Everest zirvesinde solunan oksijen deniz seviyesinin üçte birinden az', () => {
    expect(solunanOksijenMmHg(8848) / solunanOksijenMmHg(0)).toBeLessThan(0.34);
  });
});

describe('beklenen SpO2', () => {
  it('irtifayla düşer ve bant simetriktir', () => {
    const deniz = beklenenSpo2(0);
    const yuksek = beklenenSpo2(4500);
    expect(deniz.beklenen).toBeGreaterThan(yuksek.beklenen);
    expect(deniz.beklenen - deniz.alt).toBeCloseTo(3, 5);
  });

  it('üst uç %100\'ü aşmaz', () => {
    expect(beklenenSpo2(0).ust).toBeLessThanOrEqual(100);
  });

  it('tablo dışında uçlara sabitlenir', () => {
    expect(beklenenSpo2(-500).beklenen).toBe(beklenenSpo2(0).beklenen);
    expect(beklenenSpo2(9000).beklenen).toBe(beklenenSpo2(6500).beklenen);
  });

  it('ara irtifa aradeğerlenir — tablo noktası olmayan yerde de anlamlı', () => {
    const orta = beklenenSpo2(3000).beklenen;
    expect(orta).toBeLessThan(beklenenSpo2(2500).beklenen);
    expect(orta).toBeGreaterThan(beklenenSpo2(3500).beklenen);
  });
});

describe('nabız sapması', () => {
  it('kendi bazaline göre yüzde hesaplanır', () => {
    expect(nabizYukselmesi(66, 55)).toBeCloseTo(20, 1);
    expect(nabizYukselmesi(55, 55)).toBe(0);
  });

  it('bazal yoksa sinyal kullanılmaz — uydurma bazal varsayılmaz', () => {
    // 55 atımlık sporcuda 70 anlamlı, 75 atımlıda değil; mutlak eşik yanıltır.
    expect(nabizYukselmesi(70, null)).toBeNull();
    expect(nabizYukselmesi(70, 0)).toBeNull();
    expect(nabizYukselmesi(0, 55)).toBeNull();
  });
});

describe('kan basıncı — yalnızca ölçülmüş değerin yorumu', () => {
  it('kategoriler', () => {
    expect(kanBasinciYorumu({ sistolik: 120, diyastolik: 78 })).toBe('normal');
    expect(kanBasinciYorumu({ sistolik: 145, diyastolik: 85 })).toBe('yuksek');
    expect(kanBasinciYorumu({ sistolik: 130, diyastolik: 95 })).toBe('yuksek');
    expect(kanBasinciYorumu({ sistolik: 185, diyastolik: 100 })).toBe('cokYuksek');
    expect(kanBasinciYorumu({ sistolik: 85, diyastolik: 55 })).toBe('dusuk');
  });

  it('anlamsız girdi sessizce "normal" sayılmaz', () => {
    // Ters ya da bozuk ölçüm kullanıcıyı yanlış güvene sokmamalı.
    for (const bp of [
      { sistolik: 80, diyastolik: 120 },
      { sistolik: 0, diyastolik: 0 },
      { sistolik: NaN, diyastolik: 80 },
      { sistolik: -120, diyastolik: -80 },
    ]) {
      expect(kanBasinciYorumu(bp)).toBe('gecersiz');
    }
  });
});

describe('değerlendirme', () => {
  const temel: IrtifaGirdisi = { irtifaM: 4200 };

  it('eşik altında ve belirtisiz: normal, uyarı yok', () => {
    const s = irtifaDegerlendir({ irtifaM: 1200 });
    expect(s.risk).toBe('normal');
    expect(s.tavsiyeler).toEqual([]);
    expect(s.nedenler).toEqual([]);
  });

  it('eşik üstünde belirtisiz bile temel öneriler verir ama risk yükseltmez', () => {
    const s = irtifaDegerlendir(temel);
    expect(s.risk).toBe('normal');
    expect(s.tavsiyeler).toContain('hidrasyon');
    expect(s.tavsiyeler).toContain('spo2Olc');
    expect(RISK_ESIGI_M).toBe(2500);
  });

  it('hızlı tırmanış dinlenme önerir', () => {
    const s = irtifaDegerlendir({ ...temel, son24saatKazancM: GUNLUK_KAZANC_SINIRI_M + 200 });
    expect(s.risk).toBe('dinlen');
    expect(s.tavsiyeler).toContain('yavaslat');
    expect(s.nedenler).toContain('hizliTirmanis');
  });

  it('nabız bazale göre eşiği aşarsa dinlenme önerir', () => {
    const s = irtifaDegerlendir({
      ...temel,
      dinlenmeNabzi: Math.round(55 * (1 + NABIZ_UYARI_YUZDE / 100)),
      bazalNabiz: 55,
    });
    expect(s.nabizYukselmeYuzde).toBeGreaterThanOrEqual(NABIZ_UYARI_YUZDE);
    expect(s.risk).toBe('dinlen');
  });

  it('SpO2 bandın biraz altında izleme, çok altında iniş', () => {
    const bant = beklenenSpo2(4200);
    const az = irtifaDegerlendir({ ...temel, spo2: bant.alt - 2 });
    const cok = irtifaDegerlendir({ ...temel, spo2: bant.alt - 8 });
    expect(az.risk).toBe('izle');
    expect(cok.risk).toBe('in');
    expect(cok.tavsiyeler).toContain('inisYap');
    expect(az.spo2Dusuk).toBe(true);
  });

  it('bant içindeki SpO2 uyarı üretmez', () => {
    const s = irtifaDegerlendir({ ...temel, spo2: beklenenSpo2(4200).beklenen });
    expect(s.spo2Dusuk).toBe(false);
    expect(s.nedenler).not.toContain('spo2Dusuk');
  });

  it('ölçülmüş çok yüksek tansiyon inişe götürür; tahmin edilmiş değer yok', () => {
    const s = irtifaDegerlendir({ ...temel, kanBasinci: { sistolik: 190, diyastolik: 105 } });
    expect(s.kanBasinciDurumu).toBe('cokYuksek');
    expect(s.risk).toBe('in');
    expect(s.tavsiyeler).toContain('hekimeDanis');
  });

  it('tansiyon ölçümü yoksa alan null kalır — asla uydurulmaz', () => {
    // Nabızdan tansiyon türetmek klinik olarak geçersiz; modül bunu yapmaz.
    const s = irtifaDegerlendir({ ...temel, dinlenmeNabzi: 95, bazalNabiz: 55 });
    expect(s.kanBasinciDurumu).toBeNull();
  });
});

describe('kırmızı bayraklar hiçbir girdiyle hafifleyemez', () => {
  /** Kırmızı bayrak taşıyan her girdi, en iyi olası ölçümlerle bile `acil` kalmalı. */
  const kirmiziBayraklar: Partial<IrtifaGirdisi>[] = [
    { ataksi: true },
    { bilincBulanikligi: true },
    { istirahatteNefesDarligi: true },
    { amsSiddeti: 'severe' },
  ];

  const mukemmelOlcumler: IrtifaGirdisi = {
    irtifaM: 4200,
    spo2: 99,
    dinlenmeNabzi: 54,
    bazalNabiz: 55,
    son24saatKazancM: 0,
    kanBasinci: { sistolik: 118, diyastolik: 76 },
    amsSiddeti: 'none',
  };

  it.each(kirmiziBayraklar)('%o → acil, iniş ve yardım', (bayrak) => {
    const s = irtifaDegerlendir({ ...mukemmelOlcumler, ...bayrak });
    expect(s.risk).toBe('acil');
    expect(s.tavsiyeler).toContain('hemenIn');
    expect(s.tavsiyeler).toContain('yardimCagir');
  });

  it('düşük irtifada bile kırmızı bayrak yok sayılmaz', () => {
    const s = irtifaDegerlendir({ irtifaM: 800, ataksi: true });
    expect(s.risk).toBe('acil');
  });
});

describe('risk yalnızca yükselir', () => {
  it('daha ağır bir sinyal eklemek riski düşürmez', () => {
    const sira = (r: string) => IRTIFA_RISKLERI.indexOf(r as never);
    const temel: IrtifaGirdisi = { irtifaM: 4200 };
    const adimlar: Partial<IrtifaGirdisi>[] = [
      {},
      { son24saatKazancM: 900 },
      { son24saatKazancM: 900, amsSiddeti: 'moderate' },
      { son24saatKazancM: 900, amsSiddeti: 'moderate', istirahatteNefesDarligi: true },
    ];
    let onceki = -1;
    for (const adim of adimlar) {
      const r = sira(irtifaDegerlendir({ ...temel, ...adim }).risk);
      expect(r).toBeGreaterThanOrEqual(onceki);
      onceki = r;
    }
  });
});

describe('tavsiye sırası aciliyete göre', () => {
  it('iniş ve yardım her zaman listenin başında', () => {
    const s = irtifaDegerlendir({
      irtifaM: 5000,
      ataksi: true,
      son24saatKazancM: 900,
      amsSiddeti: 'severe',
    });
    expect(s.tavsiyeler[0]).toBe('hemenIn');
    expect(s.tavsiyeler[1]).toBe('yardimCagir');
  });

  it('her tavsiye kodu bilinen listede ve yinelenmiyor', () => {
    const s = irtifaDegerlendir({
      irtifaM: 4800,
      spo2: 70,
      amsSiddeti: 'moderate',
      son24saatKazancM: 800,
      dinlenmeNabzi: 90,
      bazalNabiz: 55,
    });
    expect(new Set(s.tavsiyeler).size).toBe(s.tavsiyeler.length);
    for (const k of s.tavsiyeler) expect(TAVSIYELER).toContain(k);
  });
});

describe('ölçüm doğrulama', () => {
  it('sınırlar içindeki değer yuvarlanarak kabul edilir', () => {
    expect(gecerliOlcum('spo2', 94.4)).toBe(94);
    expect(gecerliOlcum('restingHr', 55)).toBe(55);
    expect(gecerliOlcum('systolic', 120)).toBe(120);
  });

  it('sınır dışı değer kırpılmaz, **düşürülür**', () => {
    // Kırpmak (300 → 260) uydurma bir ölçüm üretir ve kullanıcıyı yanlış
    // güvene sokar; ölçüm olmaması daha güvenli.
    expect(gecerliOlcum('systolic', 300)).toBeNull();
    expect(gecerliOlcum('spo2', 20)).toBeNull();
    expect(gecerliOlcum('restingHr', 500)).toBeNull();
  });

  it('sayı olmayan girdi null', () => {
    for (const v of [null, undefined, '95', NaN, Infinity]) {
      expect(gecerliOlcum('spo2', v)).toBeNull();
    }
  });

  it('tansiyon bir çift: biri geçersizse ikisi de düşer', () => {
    const a = olcumleriTemizle({ systolic: 120, diastolic: 500 });
    expect(a.systolic).toBeNull();
    expect(a.diastolic).toBeNull();
  });

  it('ters girilen tansiyon kabul edilmez', () => {
    const a = olcumleriTemizle({ systolic: 70, diastolic: 120 });
    expect(a.systolic).toBeNull();
    expect(a.diastolic).toBeNull();
  });

  it('geçerli çift korunur, diğer alanlar bağımsız', () => {
    const a = olcumleriTemizle({ spo2: 92, restingHr: 5, systolic: 130, diastolic: 85 });
    expect(a).toEqual({ spo2: 92, restingHr: null, systolic: 130, diastolic: 85 });
  });

  it('sınırlar migration 0037 ile aynı', () => {
    // Şema CHECK'i ile kod sınırı ayrışırsa, uygulamanın kabul ettiği değer
    // veritabanında reddedilir ve kayıt sessizce düşer.
    const migration = readFileSync(
      resolve(__dirname, '../../../supabase/migrations/0037_ams_measurements.sql'),
      'utf8',
    );
    for (const [alan, [alt, ust]] of Object.entries(OLCUM_SINIRLARI)) {
      const sutun = alan === 'restingHr' ? 'resting_hr' : alan;
      expect(migration).toMatch(new RegExp(`${sutun}[^\\n]*BETWEEN ${alt} AND ${ust}`));
    }
  });
});
