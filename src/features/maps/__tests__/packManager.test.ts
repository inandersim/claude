import type { MapPack } from '@/domain';
import {
  MapPackManager,
  combinedProgress,
  compareVersions,
  createMemoryStorage,
  demFileName,
  demRemoteUrl,
  isOutdated,
  packFileName,
  packRemoteUrl,
  packReducer,
} from '@/features/maps/pack-manager';

const BASE = 'https://tiles.example';

const pack: MapPack = {
  id: 'pack_uludag',
  name: 'Uludağ',
  countryCode: 'TR',
  bbox: [29.0, 40.02, 29.45, 40.35],
  sizeMb: 0,
  version: '2026.08',
  format: 'pmtiles',
  status: 'available',
  progress: 0,
  updatedAt: '2026-08-01T00:00:00.000Z',
  localPath: null,
};

/** Belirli sayıda baytı Content-Length ile döndüren sahte fetch. */
function fakeFetch(bytes = 4096, ok = true) {
  return jest.fn(async () =>
    ok
      ? ({
          ok: true,
          status: 200,
          headers: { get: () => String(bytes) },
          arrayBuffer: async () => new ArrayBuffer(bytes),
        } as unknown as Response)
      : ({ ok: false, status: 404 } as unknown as Response),
  );
}

/** Hiç bitmeyen indirme: iptali sınamak için. */
function hangingFetch(signalHolder: { abort?: () => void }) {
  return jest.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        headers: { get: () => '1024' },
        arrayBuffer: async () => {
          signalHolder.abort?.();
          return new ArrayBuffer(1024);
        },
      }) as unknown as Response,
  );
}

describe('sürüm karşılaştırma', () => {
  it('noktalı sürümleri sayısal olarak sıralar', () => {
    expect(compareVersions('2026.08', '2026.09')).toBe(-1);
    expect(compareVersions('2026.10', '2026.9')).toBe(1);
    expect(compareVersions('1.4.2', '1.4.2')).toBe(0);
    expect(compareVersions('2027.01', '2026.12')).toBe(1);
  });

  it('yalnızca yereldeki sürüm eskiyse güncelleme vardır', () => {
    expect(isOutdated('2026.08', '2026.09')).toBe(true);
    expect(isOutdated('2026.09', '2026.09')).toBe(false);
    expect(isOutdated('2026.10', '2026.09')).toBe(false);
    expect(isOutdated(null, '2026.09')).toBe(false);
  });
});

describe('paket durum makinesi', () => {
  it('indirme başlarken ilerleme sıfırlanır', () => {
    const next = packReducer(pack, { type: 'download' });
    expect(next.status).toBe('downloading');
    expect(next.progress).toBe(0);
    expect(next.localPath).toBeNull();
  });

  it('ilerleme yalnızca indirme sırasında ve 0..1 aralığında güncellenir', () => {
    const downloading = packReducer(pack, { type: 'download' });
    expect(packReducer(downloading, { type: 'progress', progress: 0.5 }).progress).toBe(0.5);
    expect(packReducer(downloading, { type: 'progress', progress: 2 }).progress).toBe(1);
    expect(packReducer(downloading, { type: 'progress', progress: -1 }).progress).toBe(0);
    // İndirme yokken ilerleme yok sayılır
    expect(packReducer(pack, { type: 'progress', progress: 0.5 })).toBe(pack);
  });

  it('tamamlanınca sürüm, boyut ve yerel yol yazılır', () => {
    const done = packReducer(packReducer(pack, { type: 'download' }), {
      type: 'complete',
      version: '2026.09',
      sizeMb: 24,
      localPath: 'file:///map-packs/pack_uludag.pmtiles',
      at: '2026-09-06T00:00:00.000Z',
    });
    expect(done).toMatchObject({
      status: 'downloaded',
      progress: 1,
      version: '2026.09',
      sizeMb: 24,
      localPath: 'file:///map-packs/pack_uludag.pmtiles',
    });
  });

  it('iptal ve hata paketi tekrar indirilebilir duruma döndürür', () => {
    const downloading = packReducer(pack, { type: 'download' });
    for (const type of ['cancel', 'fail'] as const) {
      const next = packReducer(downloading, { type });
      expect(next.status).toBe('available');
      expect(next.progress).toBe(0);
      expect(next.localPath).toBeNull();
    }
    // İndirilmiş paket iptalden etkilenmez
    const installed = { ...pack, status: 'downloaded' as const };
    expect(packReducer(installed, { type: 'cancel' })).toBe(installed);
  });

  it('silme her durumdan "indirilebilir"e döndürür', () => {
    const installed = { ...pack, status: 'downloaded' as const, progress: 1, localPath: 'file:///x' };
    expect(packReducer(installed, { type: 'remove' })).toMatchObject({
      status: 'available',
      progress: 0,
      localPath: null,
    });
  });

  it('sunucuda yeni sürüm varsa güncelleme durumuna geçer', () => {
    const installed = { ...pack, status: 'downloaded' as const, version: '2026.08' };
    expect(packReducer(installed, { type: 'remote-version', version: '2026.09' }).status).toBe(
      'update_available',
    );
    expect(packReducer(installed, { type: 'remote-version', version: '2026.08' }).status).toBe(
      'downloaded',
    );
    // İndirilmemiş pakette sürüm bilgisi durum değiştirmez
    expect(packReducer(pack, { type: 'remote-version', version: '2027.01' }).status).toBe(
      'available',
    );
  });
});

describe('dosya adı ve adres', () => {
  it('yol geçişi denemelerini temizler', () => {
    expect(packFileName('pack_uludag')).toBe('pack_uludag.pmtiles');
    expect(packFileName('../../etc/passwd')).toBe('etcpasswd.pmtiles');
    expect(() => packFileName('///')).toThrow();
  });

  it('taban adres yoksa uzak adres üretilmez', () => {
    expect(packRemoteUrl('pack_uludag', BASE)).toBe(`${BASE}/tiles/pack_uludag.pmtiles`);
    expect(packRemoteUrl('pack_uludag', null)).toBeNull();
  });
});

describe('MapPackManager', () => {
  it('indirir, ilerleme bildirir ve disk kullanımını günceller', async () => {
    const storage = createMemoryStorage(fakeFetch(2 * 1024 * 1024));
    const progress: number[] = [];
    const manager = new MapPackManager({
      storage,
      baseUrl: BASE,
      onProgress: (_, p) => progress.push(p),
    });

    const result = await manager.download(pack, { version: '2026.09' });

    expect(result.status).toBe('downloaded');
    expect(result.version).toBe('2026.09');
    expect(result.sizeMb).toBe(2);
    expect(result.localPath).toContain('pack_uludag.pmtiles');
    expect(progress.length).toBeGreaterThan(1);
    expect(progress[progress.length - 1]).toBe(1);
    expect(manager.isInstalled(pack.id)).toBe(true);
    expect(manager.installedVersion(pack.id)).toBe('2026.09');
    expect(manager.diskUsageMb()).toBe(2);
  });

  it('taban adres yoksa indirme reddedilir', async () => {
    const manager = new MapPackManager({ storage: createMemoryStorage(), baseUrl: null });
    await expect(manager.download(pack)).rejects.toThrow(/EXPO_PUBLIC_TILES_URL/);
  });

  it('sunucu hatasında paket yeniden indirilebilir kalır ve dosya bırakılmaz', async () => {
    const storage = createMemoryStorage(fakeFetch(0, false));
    const manager = new MapPackManager({ storage, baseUrl: BASE });
    const result = await manager.download(pack);
    expect(result.status).toBe('available');
    expect(manager.isInstalled(pack.id)).toBe(false);
  });

  it('iptal edilen indirme dosya bırakmaz', async () => {
    const holder: { abort?: () => void } = {};
    const storage = createMemoryStorage(hangingFetch(holder));
    const manager = new MapPackManager({ storage, baseUrl: BASE });
    holder.abort = () => manager.cancel(pack.id);
    const result = await manager.download(pack);
    expect(result.status).toBe('available');
    expect(result.progress).toBe(0);
    expect(manager.isInstalled(pack.id)).toBe(false);
    expect(manager.cancel(pack.id)).toBe(false);
  });

  it('silme dosyayı ve künyeyi kaldırır', async () => {
    const storage = createMemoryStorage(fakeFetch(1024 * 1024));
    const manager = new MapPackManager({ storage, baseUrl: BASE });
    await manager.download(pack, { version: '2026.09' });
    const removed = await manager.remove(pack);
    expect(removed.status).toBe('available');
    expect(manager.isInstalled(pack.id)).toBe(false);
    expect(manager.installedVersion(pack.id)).toBeNull();
    expect(manager.diskUsageBytes()).toBe(0);
  });

  it('reconcile diskteki gerçeği ve sunucu sürümünü birleştirir', async () => {
    const storage = createMemoryStorage(fakeFetch(1024 * 1024));
    const manager = new MapPackManager({ storage, baseUrl: BASE });

    // Disk boşken "indirilmiş" görünen paket düzeltilir
    const stale = { ...pack, status: 'downloaded' as const, localPath: 'file:///yok' };
    expect(manager.reconcile(stale).status).toBe('available');

    await manager.download(pack, { version: '2026.08' });
    expect(manager.reconcile(pack, '2026.08').status).toBe('downloaded');
    expect(manager.reconcile(pack, '2026.09').status).toBe('update_available');
  });
});

/** URL'e göre farklı boyut döndüren sahte fetch (vektör + DEM ayrımı için). */
function fetchByUrl(sizes: Record<string, number>, failing: string[] = []) {
  return jest.fn(async (input: URL | RequestInfo) => {
    const url = String(input);
    if (failing.some((f) => url.includes(f))) {
      return { ok: false, status: 500 } as unknown as Response;
    }
    const key = Object.keys(sizes).find((k) => url.includes(k));
    const bytes = key ? sizes[key]! : 1024;
    return {
      ok: true,
      status: 200,
      headers: { get: () => String(bytes) },
      arrayBuffer: async () => new ArrayBuffer(bytes),
    } as unknown as Response;
  });
}

describe('yükseklik (DEM) dosyası', () => {
  it('dosya adı ve adres karo hattıyla aynı sözleşmeye uyar', () => {
    expect(demFileName('pack_uludag')).toBe('pack_uludag-dem.pmtiles');
    expect(demRemoteUrl('pack_uludag', BASE)).toBe(`${BASE}/tiles/pack_uludag-dem.pmtiles`);
    expect(demRemoteUrl('pack_uludag', null)).toBeNull();
    // Yol geçişi vektör paketiyle aynı şekilde engellenir.
    expect(demFileName('../../etc/passwd')).toBe('etcpasswd-dem.pmtiles');
  });

  it('ortak ilerleme geri gitmez ve 0..1 içinde kalır', () => {
    // Boyutlar biliniyorsa bayta göre ağırlık
    const sizes = { tileBytes: 900, demBytes: 100 };
    expect(combinedProgress(0, 0, sizes)).toBe(0);
    expect(combinedProgress(1, 0, sizes)).toBeCloseTo(0.9, 5);
    expect(combinedProgress(1, 1, sizes)).toBe(1);
    // Monotonluk: vektör ilerledikçe ortak değer düşmemeli
    let onceki = 0;
    for (let i = 0; i <= 10; i += 1) {
      const v = combinedProgress(i / 10, 0, sizes);
      expect(v).toBeGreaterThanOrEqual(onceki);
      onceki = v;
    }
    // Boyut bilinmiyorsa varsayılan pay
    expect(combinedProgress(1, 0)).toBeCloseTo(0.8, 5);
    // Aralık dışı girdi kenetlenir
    expect(combinedProgress(5, 5, sizes)).toBe(1);
    expect(combinedProgress(-1, -1, sizes)).toBe(0);
  });

  it('DEM adresi verilince iki dosya da iner ve boyut toplanır', async () => {
    const storage = createMemoryStorage(
      fetchByUrl({ '-dem.pmtiles': 512 * 1024, 'pack_uludag.pmtiles': 1536 * 1024 }),
    );
    const manager = new MapPackManager({ storage, baseUrl: BASE });
    const result = await manager.download(pack, {
      version: '2026.09',
      demUrl: `${BASE}/tiles/pack_uludag-dem.pmtiles`,
      tileBytes: 1536 * 1024,
      demBytes: 512 * 1024,
    });

    expect(result.status).toBe('downloaded');
    expect(manager.hasDem(pack.id)).toBe(true);
    expect(manager.demPath(pack.id)).toContain('pack_uludag-dem.pmtiles');
    // Bildirilen boyut iki dosyanın toplamı olmalı; yalnızca vektörü saymak
    // kullanıcıya diskte yalan söylerdi.
    expect(result.sizeMb).toBe(2);
    expect(manager.diskUsageMb()).toBe(2);
  });

  it('DEM adresi verilmezse yalnızca vektör paketi iner', async () => {
    const storage = createMemoryStorage(fakeFetch(1024 * 1024));
    const manager = new MapPackManager({ storage, baseUrl: BASE });
    await manager.download(pack, { version: '2026.09' });
    expect(manager.isInstalled(pack.id)).toBe(true);
    expect(manager.hasDem(pack.id)).toBe(false);
    expect(manager.demPath(pack.id)).toBeNull();
  });

  it('DEM inemezse paket yine kullanılabilir kalır, yarım dosya bırakılmaz', async () => {
    // Kabartma olmadan harita çalışır; vektör paketi silmek aşırı tepki olurdu.
    const storage = createMemoryStorage(
      fetchByUrl({ 'pack_uludag.pmtiles': 1024 * 1024 }, ['-dem.pmtiles']),
    );
    const manager = new MapPackManager({ storage, baseUrl: BASE });
    const result = await manager.download(pack, {
      version: '2026.09',
      demUrl: `${BASE}/tiles/pack_uludag-dem.pmtiles`,
    });

    expect(result.status).toBe('downloaded');
    expect(manager.isInstalled(pack.id)).toBe(true);
    expect(manager.hasDem(pack.id)).toBe(false);
    expect(storage.files.has(demFileName(pack.id))).toBe(false);
  });

  it('silme DEM dosyasını da kaldırır', async () => {
    // Bırakılırsa disk kullanımı yalan söyler: "sildim ama yer açılmadı".
    const storage = createMemoryStorage(
      fetchByUrl({ '-dem.pmtiles': 512 * 1024, 'pack_uludag.pmtiles': 512 * 1024 }),
    );
    const manager = new MapPackManager({ storage, baseUrl: BASE });
    await manager.download(pack, {
      version: '2026.09',
      demUrl: `${BASE}/tiles/pack_uludag-dem.pmtiles`,
    });
    expect(manager.hasDem(pack.id)).toBe(true);

    await manager.remove(pack);
    expect(manager.isInstalled(pack.id)).toBe(false);
    expect(manager.hasDem(pack.id)).toBe(false);
    expect(manager.diskUsageBytes()).toBe(0);
    expect(storage.list()).toEqual([]);
  });
});
