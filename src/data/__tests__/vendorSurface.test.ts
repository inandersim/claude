import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Sağlayıcı kilitlenmesinin yüzeyini ölçer ve **büyümesini engeller**.
 *
 * Karar `docs/adr/0007-kendi-arka-uc-platformumuz.md`: kendi platformumuzu
 * yazmıyoruz, karşılığında Supabase'e bağımlılığı dört adaptör dosyasında
 * tutuyoruz. Bu test o sözü koruyor — sağlayıcıya özgü bir çağrı repository
 * ya da özellik katmanına sızarsa kırılır.
 */

const KOK = resolve(__dirname, '../../..');

/** Sağlayıcıya bağımlı olmasına **izin verilen** dosyalar. */
const ADAPTORLER = [
  'src/data/remote/postgrest.ts',
  'src/data/remote/client.ts',
  'src/data/remote/storage.ts',
  'src/data/remote/realtime.ts',
];

function tsDosyalari(dir: string, out: string[] = []): string[] {
  for (const girdi of readdirSync(join(KOK, dir), { withFileTypes: true })) {
    const yol = `${dir}/${girdi.name}`;
    if (girdi.isDirectory()) tsDosyalari(yol, out);
    else if (/\.tsx?$/.test(girdi.name)) out.push(yol);
  }
  return out;
}

/**
 * Taranan kaynaklar. Testler hariç: bu dosyanın kendisi arama desenlerini
 * metin olarak taşıyor ve kendini ihlal olarak yakalıyordu.
 */
const kaynaklar = tsDosyalari('src').filter((yol) => !yol.includes('__tests__'));
const oku = (yol: string) => readFileSync(join(KOK, yol), 'utf8');

describe('sağlayıcı kilitlenme yüzeyi', () => {
  it('`@supabase/supabase-js` yalnızca adaptör katmanında içe aktarılıyor', () => {
    const ihlaller = kaynaklar.filter(
      (yol) => !ADAPTORLER.includes(yol) && oku(yol).includes("from '@supabase/supabase-js'"),
    );
    expect(ihlaller).toEqual([]);
  });

  it('sağlayıcıya özgü çağrılar repository ve özellik katmanına sızmıyor', () => {
    // `.channel(` canlı abonelik, `.storage.from(` dosya, `createClient(` istemci
    // kurulumu — üçü de yalnızca adaptörlerde olmalı.
    const desenler = [/\bcreateClient\s*\(/, /\.storage\s*\.from\s*\(/, /(?<!\w)\.channel\s*\(/];
    const ihlaller: string[] = [];
    for (const yol of kaynaklar) {
      if (ADAPTORLER.includes(yol)) continue;
      const src = oku(yol);
      for (const desen of desenler) {
        if (desen.test(src)) ihlaller.push(`${yol} → ${desen}`);
      }
    }
    expect(ihlaller).toEqual([]);
  });

  it('adaptör yüzeyi küçük kalıyor', () => {
    // Büyürse taşınma maliyeti sessizce artar. Sınır bir bütçe: aşmak yasak
    // değil, ama ADR-0007'deki hesabın güncellenmesini gerektirir.
    const toplam = ADAPTORLER.reduce((n, yol) => n + oku(yol).split('\n').length, 0);
    expect(toplam).toBeLessThanOrEqual(900);
  });

  it('sözleşmenin ikinci uygulaması hâlâ duruyor ve Postgres kullanıyor', () => {
    // "Çıkabilir miyiz" sorusunun kanıtı bu dosya: aynı arayüzün doğrudan
    // Postgres'e karşı çalışan uygulaması. Silinirse kanıt da gider.
    const ikinci = oku('src/data/__tests__/contract/pgPostgrest.ts');
    expect(ikinci).toContain('SupabaseLike');
    expect(ikinci).toContain('pg');
    expect(ikinci.split('\n').length).toBeGreaterThan(500);
  });

  it('26 repository ve tüm özellik katmanı sağlayıcıdan habersiz', () => {
    const bulasik = kaynaklar.filter(
      (yol) =>
        (yol.startsWith('src/features/') || yol.startsWith('src/data/remote/repos/')) &&
        /supabase/i.test(oku(yol)),
    );
    // Yorumda geçmesi sorun değil; içe aktarma ya da çağrı olmamalı.
    const gercek = bulasik.filter((yol) => /from '@supabase|createClient\(/.test(oku(yol)));
    expect(gercek).toEqual([]);
  });
});
