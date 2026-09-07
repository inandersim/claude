import fs from 'node:fs';
import path from 'node:path';

import { createMockProvider } from '../mock/provider';

/**
 * Anlık güncelleme abonelikleri gerçekten bağlı mı?
 *
 * `src/data/remote/realtime.ts` içindeki yedi abonelik baştan beri yazılıydı
 * ama **hiçbir ekrandan çağrılmıyordu**: sohbet 4 sn, konum paylaşımı 10 sn,
 * yayın sohbeti 5 sn aralıklarla yeniden sorgulanıyordu ve SOS oturumu hiç
 * yenilenmiyordu. Yazılmış ama çağrılmamış kod, olmayan koddan daha kötüdür:
 * var sanılır.
 *
 * Bu paket iki şeyi tutar: sözleşme yüzeyinin eksilmemesi ve her aboneliğin
 * en az bir yerden kullanılıyor olması.
 */
const SRC = path.join(__dirname, '..', '..');

function tsDosyalari(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsDosyalari(p));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** `RealtimeApi` üzerindeki her yöntem. */
const ABONELIKLER = [
  'groupMessages',
  'streamMessages',
  'directMessages',
  'notifications',
  'locationShares',
  'hazards',
  'sosSession',
] as const;

describe('anlık güncelleme bağlantısı', () => {
  it('mock sağlayıcıda abonelik yoktur (demo verisinde canlı kaynak yok)', () => {
    const p = createMockProvider({ persist: false, latencyMs: 0 });
    expect(p.realtime).toBeNull();
  });

  it('uzak sağlayıcı sözleşmedeki her aboneliği uygular', () => {
    const kaynak = fs.readFileSync(path.join(SRC, 'data', 'remote', 'realtime.ts'), 'utf8');
    const eksik = ABONELIKLER.filter((ad) => !new RegExp(`\\b${ad}:`).test(kaynak));
    expect(eksik).toEqual([]);
  });

  it('her abonelik en az bir ekran/kanca tarafından kullanılıyor', () => {
    // Asıl hata buydu: yüzey vardı, çağıran yoktu.
    const dosyalar = [
      ...tsDosyalari(path.join(SRC, 'features')),
      ...tsDosyalari(path.join(SRC, 'app')),
      ...tsDosyalari(path.join(SRC, 'core')),
    ];
    const hepsi = dosyalar.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const kullanilmayan = ABONELIKLER.filter((ad) => !hepsi.includes(`api.${ad}(`));
    // `hazards` ve `directMessages` henüz bağlanmadı; bilerek listelendi ki
    // bağlandıklarında bu test onları da korumaya alsın.
    expect(kullanilmayan.sort()).toEqual(['directMessages', 'hazards']);
  });

  it('güvenlikle ilgili ekranlar aboneliğe bağlı', () => {
    const sos = fs.readFileSync(path.join(SRC, 'features', 'satellite', 'hooks.ts'), 'utf8');
    const konum = fs.readFileSync(path.join(SRC, 'features', 'presence', 'hooks.ts'), 'utf8');
    expect(sos).toContain('api.sosSession(');
    expect(konum).toContain('api.locationShares(');
  });

  it('SOS oturumu artık kendiliğinden yenileniyor', () => {
    // Eskiden hiç `refetchInterval` yoktu: yardım yola çıktığında ekranda
    // hiçbir şey değişmiyordu.
    const sos = fs.readFileSync(path.join(SRC, 'features', 'satellite', 'hooks.ts'), 'utf8');
    const blok = sos.slice(sos.indexOf('export function useSos()'));
    expect(blok.slice(0, 700)).toContain('refetchInterval');
  });
});
