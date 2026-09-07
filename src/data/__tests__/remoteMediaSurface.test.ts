import fs from 'node:fs';
import path from 'node:path';

/**
 * Yerel adres sızıntısına karşı nöbet.
 *
 * Sekiz ayrı ekranda aynı hata vardı: seçilen fotoğrafın `file://…` adresi
 * doğrudan veritabanı satırına yazılıyordu — fotoğrafı gönderen dışında
 * herkes kırık görsel görüyordu. Düzeltme `medyaAdresi()` çağrısını zorunlu
 * kılıyor; bu paket dokuzuncu ekranın aynı hatayı tekrar kurmasını engeller.
 *
 * Kural: uzak sağlayıcı bir INSERT/UPDATE gövdesinde `input.<...>Uri`
 * değerini **doğrudan** kullanamaz; `medyaAdresi`/`medyaAdresleri` üzerinden
 * geçmelidir.
 */
const REPO_DIR = path.join(__dirname, '..', 'remote', 'repos');

/** `image_url: input.imageUri` gibi doğrudan atamalar. */
const DOGRUDAN_ATAMA = /^\s*[a-z_]+:\s*input\.[a-zA-Z]*[Uu]ri\b/;
/** `images: input.imageUri ? [input.imageUri] : []` gibi sarmalanmış hâller. */
const SARMALANMIS = /^\s*[a-z_]+:\s*input\.[a-zA-Z]*[Uu]ri\s*\?/;

describe('uzak sağlayıcı — yerel medya adresi sızıntısı', () => {
  const dosyalar = fs
    .readdirSync(REPO_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => path.join(REPO_DIR, f));

  it('repo dizini bulunur (yol kayarsa test sessizce boşa düşmesin)', () => {
    expect(dosyalar.length).toBeGreaterThan(5);
  });

  it('hiçbir satır seçilen dosya adresini doğrudan yazmıyor', () => {
    const bulgular: string[] = [];
    for (const dosya of dosyalar) {
      const satirlar = fs.readFileSync(dosya, 'utf8').split('\n');
      satirlar.forEach((satir, i) => {
        if (DOGRUDAN_ATAMA.test(satir) || SARMALANMIS.test(satir)) {
          bulgular.push(`${path.basename(dosya)}:${i + 1} → ${satir.trim()}`);
        }
      });
    }
    expect(bulgular).toEqual([]);
  });
});
