import fs from 'node:fs';
import path from 'node:path';

/**
 * `notFound.*` yalnızca **gerçek rota hatası** içindir.
 *
 * Uçtan uca tarama şunu gösterdi: parametresiz açılan ekranlar
 * ("eğitmen seçilmedi", "kulüp seçilmedi", "kişinin henüz anı yok")
 * yönlendirici hatası olan "Sayfa bulunamadı — aradığın rota haritada yok
 * gibi görünüyor" metnini basıyordu. Rota da var, ekran da var; eksik olan
 * yalnızca bir seçim ya da veri. Kullanıcıya kırık bir bağlantı tıkladığını
 * söylemek hem yanlış hem de çıkışsız.
 *
 * Kural: `app/+not-found.tsx` dışında hiçbir ekran `notFound.title` /
 * `notFound.description` kullanmaz. Alan adına uygun bir metin yazılır.
 */
const APP = path.join(__dirname, '..', '..', 'app');
const IZINLI = new Set(['+not-found.tsx']);

function tsxDosyalari(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsxDosyalari(p));
    else if (e.name.endsWith('.tsx') && !IZINLI.has(e.name)) out.push(p);
  }
  return out;
}

describe("ekranlar rota hatası metnini veri durumu için kullanmıyor", () => {
  const dosyalar = tsxDosyalari(APP);

  it('ekran dizini bulunur (yol kayarsa test boşa düşmesin)', () => {
    expect(dosyalar.length).toBeGreaterThan(50);
  });

  it("hiçbir ekran notFound.title / notFound.description basmıyor", () => {
    const bulgular: string[] = [];
    for (const dosya of dosyalar) {
      fs.readFileSync(dosya, 'utf8')
        .split('\n')
        .forEach((satir, i) => {
          if (/t\(['"]notFound\.(title|description)['"]\)/.test(satir)) {
            bulgular.push(`${path.relative(APP, dosya)}:${i + 1} → ${satir.trim()}`);
          }
        });
    }
    expect(bulgular).toEqual([]);
  });
});
