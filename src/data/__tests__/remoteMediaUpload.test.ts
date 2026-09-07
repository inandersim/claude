import { createRemoteContext, medyaAdresi, medyaAdresleri } from '../remote/context';
import type { SupabaseLike } from '../remote/postgrest';

const db = {} as SupabaseLike;

const ctxIle = (yukleyici?: Parameters<ReturnType<typeof createRemoteContext>['setMedyaYukleyici']>[0]) => {
  const ctx = createRemoteContext(db);
  if (yukleyici) ctx.setMedyaYukleyici(yukleyici);
  return ctx;
};

/** Çağrıları kaydeden sahte yükleyici. */
const sahte = () => {
  const cagrilar: { bucket: string; userId: string; localUri: string }[] = [];
  const fn = async (g: { bucket: string; userId: string; localUri: string }) => {
    cagrilar.push(g);
    return `https://cdn.test/${g.bucket}/${g.userId}/yuklendi.jpg`;
  };
  return { fn, cagrilar };
};

describe('yerel medya adresi yükleme noktası', () => {
  it('cihazdaki dosyayı yükler ve genel adresi döner', async () => {
    const { fn, cagrilar } = sahte();
    const url = await medyaAdresi(ctxIle(fn), 'post-media', 'u1', 'file:///tmp/foto.jpg');
    expect(url).toBe('https://cdn.test/post-media/u1/yuklendi.jpg');
    expect(cagrilar).toEqual([
      { bucket: 'post-media', userId: 'u1', localUri: 'file:///tmp/foto.jpg' },
    ]);
  });

  it('Android content:// ve web blob:/data: adreslerini de yükler', async () => {
    const { fn, cagrilar } = sahte();
    const ctx = ctxIle(fn);
    for (const uri of [
      'content://media/external/images/1',
      'blob:http://localhost/abc',
      'data:image/jpeg;base64,AAA',
      'ph://ABC-123',
      '/var/mobile/foto.jpg',
    ]) {
      await medyaAdresi(ctx, 'post-media', 'u1', uri);
    }
    expect(cagrilar).toHaveLength(5);
  });

  it('zaten uzak olan adrese dokunmaz', async () => {
    const { fn, cagrilar } = sahte();
    const url = 'https://abc.supabase.co/storage/v1/object/public/post-media/u1/x.jpg';
    expect(await medyaAdresi(ctxIle(fn), 'post-media', 'u1', url)).toBe(url);
    expect(cagrilar).toHaveLength(0);
  });

  it('boş adreste yükleyiciyi çağırmaz', async () => {
    const { fn, cagrilar } = sahte();
    const ctx = ctxIle(fn);
    expect(await medyaAdresi(ctx, 'post-media', 'u1', null)).toBeNull();
    expect(await medyaAdresi(ctx, 'post-media', 'u1', '   ')).toBe('   ');
    expect(cagrilar).toHaveLength(0);
  });

  it('yükleyici yoksa adresi olduğu gibi bırakır (sessizce çökmez)', async () => {
    // Testler ve yükleme katmanı olmayan ortamlar bu yoldan geçer.
    const uri = 'file:///tmp/foto.jpg';
    expect(await medyaAdresi(ctxIle(), 'post-media', 'u1', uri)).toBe(uri);
  });

  it('çoklu adreste yalnızca yerel olanları yükler, boşları eler', async () => {
    const { fn, cagrilar } = sahte();
    const sonuc = await medyaAdresleri(ctxIle(fn), 'post-media', 'u1', [
      'file:///a.jpg',
      'https://uzak/b.jpg',
      null,
      '',
      'file:///c.jpg',
    ]);
    expect(sonuc).toEqual([
      'https://cdn.test/post-media/u1/yuklendi.jpg',
      'https://uzak/b.jpg',
      'https://cdn.test/post-media/u1/yuklendi.jpg',
    ]);
    expect(cagrilar.map((c) => c.localUri)).toEqual(['file:///a.jpg', 'file:///c.jpg']);
  });

  it('yükleme hatasını yutmaz — çağıran görsün', async () => {
    // Sessizce yerel adresi yazmak, gönderi kaydedilmiş ama fotoğrafı
    // yalnızca gönderende görünür hâle getirir: en kötü sonuç.
    const ctx = ctxIle(async () => {
      throw new Error('kota doldu');
    });
    await expect(medyaAdresi(ctx, 'post-media', 'u1', 'file:///a.jpg')).rejects.toThrow(
      'kota doldu',
    );
  });
});
