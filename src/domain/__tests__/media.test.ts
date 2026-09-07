import {
  MEDYA_CACHE_CONTROL,
  MEDYA_UZUN_KENAR,
  boyutPlani,
  kucukBoyYolu,
  medyaCdnTabani,
  medyaUrl,
} from '@/domain/media';

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

describe('görsel boyutlandırma planı', () => {
  it('kameranın ürettiği ölçüyü uzun kenardan sınırlar, oranı korur', () => {
    // 4000x3000 tipik bir telefon fotoğrafı.
    const tam = boyutPlani(4000, 3000, 'full');
    expect(tam.width).toBe(1600);
    expect(tam.height).toBe(1200);
    expect(tam.olcekDegismiyor).toBe(false);

    const kucuk = boyutPlani(4000, 3000, 'thumb');
    expect(kucuk.width).toBe(400);
    expect(kucuk.height).toBe(300);
  });

  it('dikey görselde uzun kenar yüksekliktir', () => {
    const p = boyutPlani(3000, 4000, 'full');
    expect(p.height).toBe(1600);
    expect(p.width).toBe(1200);
  });

  it('küçük kaynağı büyütmez', () => {
    // 800x600 bir görseli 1600'e şişirmek bayt harcar, ayrıntı eklemez.
    const p = boyutPlani(800, 600, 'full');
    expect(p).toMatchObject({ width: 800, height: 600, olcekDegismiyor: true });
  });

  it('tam sınırdaki görseli ölçeklemez', () => {
    expect(boyutPlani(1600, 900, 'full').olcekDegismiyor).toBe(true);
    expect(boyutPlani(1601, 900, 'full').olcekDegismiyor).toBe(false);
  });

  it('bozuk/bilinmeyen ölçüde ölçeklemeye kalkışmaz', () => {
    // Ölçü gelmediyse yanlış bir hedef üretmektense yalnızca yeniden kodla.
    expect(boyutPlani(0, 0, 'full').olcekDegismiyor).toBe(true);
    expect(boyutPlani(-10, 500, 'full').olcekDegismiyor).toBe(true);
  });

  it('çok ince görselde bile en az 1 px üretir', () => {
    const p = boyutPlani(8000, 3, 'thumb');
    expect(p.width).toBe(400);
    expect(p.height).toBeGreaterThanOrEqual(1);
  });

  it('küçük boy tam boydan daha agresif sıkıştırılır', () => {
    expect(boyutPlani(4000, 3000, 'thumb').quality).toBeLessThan(
      boyutPlani(4000, 3000, 'full').quality,
    );
  });

  it('küçük boy her zaman tam boydan küçüktür', () => {
    expect(MEDYA_UZUN_KENAR.thumb).toBeLessThan(MEDYA_UZUN_KENAR.full);
  });
});

describe('küçük boy dosya adı', () => {
  it('uzantıdan önce ek getirir', () => {
    expect(kucukBoyYolu('post-media/u1/abc.jpg')).toBe('post-media/u1/abc_thumb.jpg');
    expect(kucukBoyYolu('a.b/c.d/foto.webp')).toBe('a.b/c.d/foto_thumb.webp');
  });

  it('uzantısız adlarda sona ekler', () => {
    expect(kucukBoyYolu('u1/dosya')).toBe('u1/dosya_thumb');
  });

  it('klasör adındaki noktayı uzantı sanmaz', () => {
    // 'v1.2/foto' içinde son nokta klasörde: uzantı yok, sona eklenmeli.
    expect(kucukBoyYolu('v1.2/foto')).toBe('v1.2/foto_thumb');
  });

  it('nokta ile başlayan dosya adını uzantı sanmaz', () => {
    expect(kucukBoyYolu('u1/.gizli')).toBe('u1/.gizli_thumb');
  });
});
