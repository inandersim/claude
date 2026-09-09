/**
 * İstemci tarafında kimlik üretimi.
 *
 * **Neden gerekti:** ağ yokken kuyruğa alınan bir yazma, sunucudan satır
 * döndüremez. Kimliği istemci verirse ekrana dönen nesne ile sonradan
 * yazılacak satır aynı olur; kullanıcı kaydını hemen görür ve bağlantı
 * gelince aynı kayıt sunucuya gider. Postgres tarafındaki
 * `DEFAULT gen_random_uuid()` verilen değeri ezmez.
 *
 * `crypto.randomUUID` her ortamda yok (Hermes sürümüne göre değişir), bu
 * yüzden sırayla düşülür: `randomUUID` → `getRandomValues` → `Math.random`.
 * Son basamak kriptografik değildir ama burada gizlilik değil **benzersizlik**
 * aranıyor; 122 rastgele bit çakışma için fazlasıyla yeterli.
 */

type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: <T extends Uint8Array>(array: T) => T;
};

function kripto(): CryptoLike | null {
  const g = globalThis as { crypto?: CryptoLike };
  return g.crypto ?? null;
}

/** RFC 4122 sürüm 4 UUID. */
export function uuidV4(): string {
  const c = kripto();
  if (typeof c?.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      // Bazı ortamlarda güvenli bağlam dışında fırlatır; aşağıya düşülür.
    }
  }

  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Sürüm (4) ve varyant (10xx) bitleri — RFC 4122 zorunlu kılıyor.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i]!.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
