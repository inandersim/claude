import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import rawStyle from '@/assets/map-style/zirtan-outdoor.json';
import {
  BUNDLED_RANGES,
  prepareBundledGlyphs,
  type GlyphStore,
} from '@/features/maps/vector/glyphs.native';
import { FONT_STACK, glyphsUrl, resolveMapStyle } from '@/features/maps/vector/style';

const ROOT = resolve(__dirname, '../../../..');

/** Yazılanları hatırlayan, dosya sistemine dokunmayan sahte bağlantı. */
function fakeStore(overrides: Partial<GlyphStore> = {}) {
  const copied: string[] = [];
  let stamp: string | null = null;
  const store: GlyphStore = {
    root: () => 'file:///belge/glyphs',
    fingerprint: () => 'v1',
    stamp: () => stamp,
    writeStamp: (value) => {
      stamp = value;
    },
    copy: async (range) => {
      copied.push(range);
    },
    ...overrides,
  };
  return { store, copied, current: () => stamp };
}

describe('glyphsUrl önceliği', () => {
  const eski = process.env.EXPO_PUBLIC_GLYPHS_URL;
  afterEach(() => {
    if (eski === undefined) delete process.env.EXPO_PUBLIC_GLYPHS_URL;
    else process.env.EXPO_PUBLIC_GLYPHS_URL = eski;
  });

  it('açık ayar her şeyi geçer', () => {
    process.env.EXPO_PUBLIC_GLYPHS_URL = 'https://cdn.example/glyphs/';
    expect(glyphsUrl({ bundled: 'file:///b/{fontstack}/{range}.pbf', baseUrl: 'http://x' })).toBe(
      'https://cdn.example/glyphs/{fontstack}/{range}.pbf',
    );
  });

  it('paketlenmiş glyph karo sunucusundan önce gelir', () => {
    delete process.env.EXPO_PUBLIC_GLYPHS_URL;
    expect(
      glyphsUrl({ bundled: 'file:///belge/glyphs/{fontstack}/{range}.pbf', baseUrl: 'http://x' }),
    ).toBe('file:///belge/glyphs/{fontstack}/{range}.pbf');
  });

  it('paketlenmiş yoksa karo sunucusuna düşer', () => {
    delete process.env.EXPO_PUBLIC_GLYPHS_URL;
    expect(glyphsUrl({ bundled: null, baseUrl: 'http://sunucu:8090/' })).toBe(
      'http://sunucu:8090/glyphs/{fontstack}/{range}.pbf',
    );
  });

  it('hiçbir kaynak yoksa yerelde null döner', () => {
    delete process.env.EXPO_PUBLIC_GLYPHS_URL;
    expect(glyphsUrl({ isWeb: false })).toBeNull();
    expect(glyphsUrl({ isWeb: true })).toBe('/glyphs/{fontstack}/{range}.pbf');
  });
});

describe('prepareBundledGlyphs', () => {
  it('ilk açılışta tüm aralıkları kopyalar ve damgayı yazar', async () => {
    const { store, copied, current } = fakeStore();
    const url = await prepareBundledGlyphs(store);
    expect(url).toBe('file:///belge/glyphs/{fontstack}/{range}.pbf');
    expect(copied).toEqual([...BUNDLED_RANGES]);
    expect(current()).toBe('v1');
  });

  it('damga tutuyorsa hiçbir şey kopyalamaz', async () => {
    const { store, copied } = fakeStore({ stamp: () => 'v1' });
    await expect(prepareBundledGlyphs(store)).resolves.toContain('{fontstack}');
    expect(copied).toEqual([]);
  });

  it('uygulama güncellenip glyph değişince yeniden açar', async () => {
    const { store, copied } = fakeStore({ stamp: () => 'v0', fingerprint: () => 'v2' });
    await prepareBundledGlyphs(store);
    expect(copied).toEqual([...BUNDLED_RANGES]);
  });

  it('kopyalama yarıda kalırsa damga yazılmaz', async () => {
    const { store, current } = fakeStore({
      copy: async (range) => {
        if (range === BUNDLED_RANGES[1]) throw new Error('disk doldu');
      },
    });
    await expect(prepareBundledGlyphs(store)).resolves.toBeNull();
    expect(current()).toBeNull();
  });

  it('bağlantı tümüyle patlarsa null döner (harita metinsiz ama çalışır)', async () => {
    const { store } = fakeStore({
      root: () => {
        throw new Error('belge klasörü yok');
      },
    });
    await expect(prepareBundledGlyphs(store)).resolves.toBeNull();
  });
});

describe('paketlenmiş glyph dosyaları', () => {
  it('her aralık hem web hem yerel çıktı klasöründe var', () => {
    for (const range of BUNDLED_RANGES) {
      for (const dir of ['public/glyphs', 'assets/glyphs']) {
        const file = resolve(ROOT, dir, FONT_STACK, `${range}.pbf`);
        expect(existsSync(file)).toBe(true);
      }
    }
  });

  it('yerel `require` yolları FONT_STACK ile aynı klasörü gösterir', () => {
    // Metro `require`'ı derleme anında çözer; yol sabit olmak zorunda. Yığın
    // adı değişip bu yol unutulursa yerel derlemede metin sessizce kaybolur.
    const kaynak = readFileSync(
      resolve(ROOT, 'src/features/maps/vector/glyphs.native.ts'),
      'utf8',
    );
    const yollar = [...kaynak.matchAll(/@\/assets\/glyphs\/([^/]+)\/([\d-]+)\.pbf/g)];
    expect(yollar).toHaveLength(BUNDLED_RANGES.length);
    for (const [, stack, range] of yollar) {
      expect(stack).toBe(FONT_STACK);
      expect(BUNDLED_RANGES).toContain(range);
    }
  });

  it('yığın adında boşluk yok — file:// adreslerinde yüzde kodlama sorunu çıkmasın', () => {
    expect(FONT_STACK).toBe(encodeURIComponent(FONT_STACK));
  });

  it('stildeki text-font FONT_STACK ile birebir aynı', () => {
    const style = resolveMapStyle({
      variant: 'light',
      source: { kind: 'pmtiles', url: 'file:///x.pmtiles' },
      glyphs: 'file:///g/{fontstack}/{range}.pbf',
    });
    const symbols = style.layers.filter((l) => l.type === 'symbol');
    expect(symbols.length).toBeGreaterThan(0);
    for (const layer of symbols) {
      const font = (layer.layout as Record<string, unknown> | undefined)?.['text-font'];
      expect(font).toEqual([FONT_STACK]);
    }
    // Ham belgede de aynı ad geçmeli (çözümleyici bunu değiştirmiyor).
    expect(JSON.stringify(rawStyle)).toContain(FONT_STACK);
  });
});
