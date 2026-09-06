import {
  BUCKETS,
  StorageValidationError,
  buildPath,
  byteLength,
  extensionFor,
  validateUpload,
} from '@/data/remote/storage';

const bytes = (n: number) => new Uint8Array(n);

describe('uzak depolama doğrulaması', () => {
  it('kova tanımları migration ile aynı sınırları taşır', () => {
    expect(BUCKETS.avatars.maxBytes).toBe(5 * 1024 * 1024);
    expect(BUCKETS.avatars.public).toBe(true);
    expect(BUCKETS['vision-uploads'].public).toBe(false);
    expect(BUCKETS['consult-media'].mimeTypes).toContain('image/jpeg');
  });

  it('desteklenmeyen türü reddeder', () => {
    expect(() =>
      validateUpload({ bucket: 'avatars', bytes: bytes(1024), contentType: 'application/pdf' }),
    ).toThrow(StorageValidationError);
  });

  it('boyut sınırını aşan dosyayı reddeder', () => {
    expect(() =>
      validateUpload({
        bucket: 'avatars',
        bytes: bytes(6 * 1024 * 1024),
        contentType: 'image/jpeg',
      }),
    ).toThrow(/çok büyük/);
  });

  it('boş dosyayı reddeder', () => {
    expect(() =>
      validateUpload({ bucket: 'avatars', bytes: bytes(0), contentType: 'image/png' }),
    ).toThrow(/boş/);
  });

  it('geçerli yüklemeyi kabul eder', () => {
    expect(() =>
      validateUpload({ bucket: 'post-media', bytes: bytes(2048), contentType: 'video/mp4' }),
    ).not.toThrow();
  });

  it('yolu RLS düzenine göre kurar', () => {
    const path = buildPath({
      bucket: 'consult-media',
      userId: 'u1',
      bytes: bytes(10),
      contentType: 'image/jpeg',
      fileName: 'foto.jpg',
      scope: 'c9',
    });
    expect(path).toBe('u1/c9/foto.jpg');
  });

  it('dosya adı verilmezse uzantıyı türden üretir', () => {
    const path = buildPath({
      bucket: 'avatars',
      userId: 'u1',
      bytes: bytes(10),
      contentType: 'image/webp',
    });
    expect(path.startsWith('u1/')).toBe(true);
    expect(path.endsWith('.webp')).toBe(true);
  });

  it('yardımcılar', () => {
    expect(extensionFor('application/gpx+xml')).toBe('gpx');
    expect(extensionFor('bilinmeyen/tip')).toBe('bin');
    expect(byteLength(bytes(42))).toBe(42);
    expect(byteLength(new ArrayBuffer(7))).toBe(7);
  });
});
