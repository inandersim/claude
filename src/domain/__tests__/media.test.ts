import { MEDYA_CACHE_CONTROL, medyaCdnTabani, medyaUrl } from '@/domain/media';

const SUPA = 'https://abc.supabase.co/storage/v1/object/public/post-media/u1/foto.jpg';
const CDN = 'https://cdn.zirtan.app';

describe('medya adresi CDN yönlendirmesi', () => {
  it('Supabase genel adresi CDN yoluna çevrilir', () => {
    expect(medyaUrl(SUPA, CDN)).toBe('https://cdn.zirtan.app/post-media/u1/foto.jpg');
  });

  it('CDN tanımlı değilse adres olduğu gibi kalır', () => {
    // Yönlendirme kapatılabilir olmalı: göç gerekmeden eski davranışa dönüş.
    expect(medyaUrl(SUPA, null)).toBe(SUPA);
    expect(medyaUrl(SUPA, '   ')).toBe(SUPA);
  });

  it('sondaki bölü işareti çift bölü üretmez', () => {
    expect(medyaUrl(SUPA, `${CDN}///`)).toBe('https://cdn.zirtan.app/post-media/u1/foto.jpg');
  });

  it('zaten CDN adresi ikinci kez yazılmaz', () => {
    const cdnli = 'https://cdn.zirtan.app/post-media/u1/foto.jpg';
    expect(medyaUrl(cdnli, CDN)).toBe(cdnli);
  });

  it('dış görsel, yerel dosya ve data adresi dokunulmadan geçer', () => {
    for (const url of [
      'https://images.unsplash.com/photo-1.jpg',
      'file:///var/mobile/foto.jpg',
      'data:image/png;base64,iVBOR',
      'https://abc.supabase.co/storage/v1/object/sign/gizli/u1/a.jpg',
    ]) {
      expect(medyaUrl(url, CDN)).toBe(url);
    }
  });

  it('boş girdi çökmez', () => {
    expect(medyaUrl(null, CDN)).toBeNull();
    expect(medyaUrl(undefined, CDN)).toBeNull();
    expect(medyaUrl('', CDN)).toBeNull();
  });

  it('yol boşsa yönlendirme yapılmaz', () => {
    const bozuk = 'https://abc.supabase.co/storage/v1/object/public/';
    expect(medyaUrl(bozuk, CDN)).toBe(bozuk);
  });
});

describe('önbellek politikası', () => {
  it('bir yıl ve değişmez', () => {
    // Dosya adı her yüklemede benzersiz → içerik değişmez. Eski bir saatlik
    // ömür CDN'in işe yaramasını engelliyordu.
    expect(MEDYA_CACHE_CONTROL).toContain('immutable');
    expect(MEDYA_CACHE_CONTROL).toContain('31536000');
  });
});

describe('yapılandırma', () => {
  it('ortam değişkeni okunur, sondaki bölü kırpılır', () => {
    expect(medyaCdnTabani({ EXPO_PUBLIC_MEDIA_CDN_URL: 'https://cdn.x/' })).toBe('https://cdn.x');
    expect(medyaCdnTabani({})).toBeNull();
    expect(medyaCdnTabani({ EXPO_PUBLIC_MEDIA_CDN_URL: '  ' })).toBeNull();
  });
});
