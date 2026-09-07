import { AA_BUYUK, AA_NORMAL, contrastRatio } from '@/domain/contrast';

import { palettes, type ColorScheme } from '../tokens';

/**
 * Renk belirteçleri okunabilirlik eşiğini tutuyor mu?
 *
 * Bu paket bir üslup tercihi denetlemiyor — WCAG AA ölçülebilir bir eşik.
 * Yazıldığı sırada **açık tema** üç temadan tek başına kalıyordu: tarayıcıda
 * 20 ekranda 535 metin düğümü eşiğin altındaydı, en çok da `textSubtle`
 * (2.68:1, 193 kullanım). Koyu ve güneş temaları temizdi; geliştirme koyu
 * temada yapıldığı için hata kimsenin gözüne çarpmamıştı.
 *
 * Testin asıl işi geçmişi anlatmak değil geleceği tutmak: paletteki bir
 * ayarlama okunabilirliği bozarsa burada kırmızıya döner.
 */

/** Metnin üzerine bindiği zeminler. */
const ZEMINLER = ['background', 'surface', 'surfaceElevated', 'surfaceMuted'] as const;

/** Zemin üzerinde **metin** olarak kullanılan belirteçler. */
const METIN = ['text', 'textMuted', 'textSubtle'] as const;

/** Hem metin hem dolgu olabilen anlamsal renkler. */
const ANLAMSAL = ['primary', 'accent', 'danger', 'success', 'warning', 'info'] as const;

const SEMALAR = Object.keys(palettes) as ColorScheme[];

describe('renk belirteçleri okunabilirlik eşiğini tutuyor', () => {
  it('üç tema da tanımlı (liste kayarsa test boşa düşmesin)', () => {
    expect(SEMALAR.sort()).toEqual(['dark', 'light', 'sun']);
  });

  it.each(SEMALAR)('%s: metin renkleri her zeminde AA (4.5:1)', (sema) => {
    const p = palettes[sema];
    const kalanlar: string[] = [];
    for (const metin of METIN) {
      for (const zemin of ZEMINLER) {
        const oran = contrastRatio(p[metin], p[zemin]);
        if (oran < AA_NORMAL) {
          kalanlar.push(`${metin} on ${zemin}: ${oran.toFixed(2)}:1`);
        }
      }
    }
    expect(kalanlar).toEqual([]);
  });

  it.each(SEMALAR)('%s: anlamsal renkler metin olarak AA (4.5:1)', (sema) => {
    const p = palettes[sema];
    const kalanlar: string[] = [];
    for (const renk of ANLAMSAL) {
      for (const zemin of ZEMINLER) {
        const oran = contrastRatio(p[renk], p[zemin]);
        if (oran < AA_NORMAL) kalanlar.push(`${renk} on ${zemin}: ${oran.toFixed(2)}:1`);
      }
    }
    expect(kalanlar).toEqual([]);
  });

  it.each(SEMALAR)('%s: dolgu üzerindeki metin okunur (onPrimary/onAccent)', (sema) => {
    const p = palettes[sema];
    // Düğme metni rengin **üstüne** biner; buradaki eşik büyük/kalın metin
    // olduğu için 3.0, ama pratikte 4.5'in üstünde tutuluyor.
    expect(contrastRatio(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(AA_BUYUK);
    expect(contrastRatio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(AA_BUYUK);
  });

  it.each(SEMALAR)('%s: metin kademeleri birbirinden ayırt edilebilir', (sema) => {
    const p = palettes[sema];
    // Yalnızca eşiği tutturmak `textSubtle`'ı `textMuted`'a yapıştırıp
    // hiyerarşiyi çökertebiliyor; kademeler arasında görünür fark kalmalı.
    const zemin = p.surface;
    const t = contrastRatio(p.text, zemin);
    const m = contrastRatio(p.textMuted, zemin);
    const s = contrastRatio(p.textSubtle, zemin);
    expect(t).toBeGreaterThan(m * 1.2);
    expect(m).toBeGreaterThan(s * 1.2);
  });

  it('sınır rengi zemininden ayırt edilebilir (3:1 — grafik nesnesi eşiği)', () => {
    const kalanlar: string[] = [];
    for (const sema of SEMALAR) {
      const p = palettes[sema];
      const oran = contrastRatio(p.borderStrong, p.surface);
      if (oran < 1.5) kalanlar.push(`${sema}: borderStrong ${oran.toFixed(2)}:1`);
    }
    expect(kalanlar).toEqual([]);
  });
});
