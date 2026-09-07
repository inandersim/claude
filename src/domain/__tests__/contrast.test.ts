import {
  AA_BUYUK,
  AA_NORMAL,
  contrastRatio,
  hexToRgb,
  okunurRenk,
  relativeLuminance,
  rgbToHex,
} from '../contrast';
import { ADVENTURE_TYPE_META, ADVENTURE_TYPES, DIFFICULTY_GRADES, DIFFICULTY_META } from '../enums';

/** Tema belirteçlerinden gerçek zeminler (src/core/theme/tokens.ts ile aynı). */
const ZEMIN = { acik: '#F6F3EA', acikYuzey: '#FFFFFF', koyu: '#0B1210', gunes: '#FFFFFF' };

describe('kontrast hesabı', () => {
  it('bilinen uç değerleri doğru verir', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('sıra fark etmez', () => {
    expect(contrastRatio('#2F7D4F', '#F6F3EA')).toBeCloseTo(
      contrastRatio('#F6F3EA', '#2F7D4F'),
      5,
    );
  });

  it('kısa ve uzun hex biçimini birlikte okur', () => {
    expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(rgbToHex({ r: 94, g: 227, b: 155 })).toBe('#5EE39B');
  });

  it('bozuk girdide çökmez, nötr döner', () => {
    expect(hexToRgb('yeşil')).toBeNull();
    expect(hexToRgb('#12345')).toBeNull();
    // Oran hesaplanamıyorsa 1 (en kötü) döner; yanlışlıkla "geçti" demez.
    expect(contrastRatio('yeşil', '#FFFFFF')).toBe(1);
  });

  it('parlaklık sıralaması sezgiyle uyumlu', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });
});

describe('okunur renk üretimi', () => {
  it('zaten yeterli olan rengi değiştirmez', () => {
    // Koyu temada macera renkleri zaten geçiyor; dokunulmamalı.
    expect(okunurRenk('#5EE39B', ZEMIN.koyu)).toBe('#5EE39B');
  });

  it('açık zeminde eşiği tutturana kadar koyulaştırır', () => {
    const once = contrastRatio('#5EE39B', ZEMIN.acik);
    const sonra = okunurRenk('#5EE39B', ZEMIN.acik);
    expect(once).toBeLessThan(AA_BUYUK);
    expect(contrastRatio(sonra, ZEMIN.acik)).toBeGreaterThanOrEqual(AA_BUYUK);
  });

  it('koyu zeminde açar', () => {
    const koyuRenk = '#0F6B36';
    expect(contrastRatio(koyuRenk, ZEMIN.koyu)).toBeLessThan(AA_BUYUK);
    expect(contrastRatio(okunurRenk(koyuRenk, ZEMIN.koyu), ZEMIN.koyu)).toBeGreaterThanOrEqual(
      AA_BUYUK,
    );
  });

  it('daha yüksek eşik istenirse onu da tutturur', () => {
    const r = okunurRenk('#5EE39B', ZEMIN.acik, AA_NORMAL);
    expect(contrastRatio(r, ZEMIN.acik)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('tonu korur — yeşil yeşil kalır', () => {
    const r = hexToRgb(okunurRenk('#5EE39B', ZEMIN.acik))!;
    // Kaynakta yeşil baskın; koyulaşınca da baskın kalmalı.
    expect(r.g).toBeGreaterThan(r.r);
    expect(r.g).toBeGreaterThan(r.b);
  });

  it('bozuk renkte kaynağı olduğu gibi döner', () => {
    expect(okunurRenk('yeşil', ZEMIN.acik)).toBe('yeşil');
  });
});

describe('macera ve zorluk renkleri her zeminde okunur hâle gelir', () => {
  const zeminler = [ZEMIN.acik, ZEMIN.acikYuzey, ZEMIN.koyu, ZEMIN.gunes];

  it('her macera türü, her zeminde eşiği geçer', () => {
    const kalanlar: string[] = [];
    for (const tur of ADVENTURE_TYPES) {
      for (const z of zeminler) {
        const r = okunurRenk(ADVENTURE_TYPE_META[tur].color, z);
        if (contrastRatio(r, z) < AA_BUYUK) {
          kalanlar.push(`${tur} @ ${z} → ${contrastRatio(r, z).toFixed(2)}`);
        }
      }
    }
    expect(kalanlar).toEqual([]);
  });

  it('her zorluk derecesi, her zeminde eşiği geçer', () => {
    const kalanlar: string[] = [];
    for (const g of DIFFICULTY_GRADES) {
      for (const z of zeminler) {
        const r = okunurRenk(DIFFICULTY_META[g].color, z);
        if (contrastRatio(r, z) < AA_BUYUK) {
          kalanlar.push(`${g} @ ${z} → ${contrastRatio(r, z).toFixed(2)}`);
        }
      }
    }
    expect(kalanlar).toEqual([]);
  });

  it('ham renkler açık zeminde gerçekten kalıyordu (düzeltme boşa değil)', () => {
    // Bu test düzeltmenin bir şeyi çözdüğünü kanıtlar: ham palet açık
    // zeminde en az bir yerde eşiğin altında.
    const kalanlar = ADVENTURE_TYPES.filter(
      (t) => contrastRatio(ADVENTURE_TYPE_META[t].color, ZEMIN.acik) < AA_BUYUK,
    );
    expect(kalanlar.length).toBeGreaterThan(0);
  });
});
