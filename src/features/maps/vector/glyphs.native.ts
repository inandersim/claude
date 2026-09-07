/**
 * Paketlenmiş SDF glyph'leri — iOS/Android.
 *
 * Sorun: MapLibre metni `glyphs` şablonundan (`.../{fontstack}/{range}.pbf`)
 * **çalışma anında** ister. Uygulama paketindeki varlıkların yolu ise
 * öngörülebilir değil (Metro dosya adlarını karıştırır, Android'de varlıklar
 * APK içindedir). Bu yüzden glyph'ler ilk açılışta belge klasörüne açılır ve
 * MapLibre'ye gerçek bir `file://` şablonu verilir.
 *
 * Neden kopyalama bir kez: dosyalar 150 KB civarı ve hiç değişmiyor. Uygulama
 * güncellenip glyph'ler değiştiğinde fark edilsin diye varlıkların özet
 * değerlerinden bir **damga** yazılır; damga tutmuyorsa dosyalar yeniden
 * açılır. Kopyalama yarıda kalırsa damga yazılmaz — sonraki açılışta baştan
 * denenir.
 *
 * Başarısızlık zararsızdır: `null` dönerse `glyphsUrl` sıradaki kaynağa düşer,
 * o da yoksa harita metinsiz ama çalışır durumda kalır.
 */
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

import { FONT_STACK } from './style';

/**
 * Uygulamayla gelen kod noktası blokları.
 * `tools/glyphs/build-glyphs.mjs` içindeki `DEFAULT_RANGES` ile aynı olmalı.
 */
export const BUNDLED_RANGES: readonly string[] = ['0-255', '256-511'];

/** Belge klasörü altındaki hedef klasör (`{fontstack}` bunun altındadır). */
const GLYPH_DIR = 'glyphs';
/** Damga dosyası: paketteki glyph'lerin kimliği. */
const STAMP = '.stamp';

/**
 * Metro varlık kimlikleri — **tembel**, yalnızca gerçekten kopyalanırken okunur.
 * Yol sabit olmak zorunda (Metro `require`'ı derleme anında çözer), bu yüzden
 * klasör adının `FONT_STACK` ile aynı kaldığını bir test doğruluyor.
 */
function assetModule(range: string): number {
  const modules: Record<string, number> = {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    '0-255': require('@/assets/glyphs/Zirtan-SemiBold/0-255.pbf'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    '256-511': require('@/assets/glyphs/Zirtan-SemiBold/256-511.pbf'),
  };
  const mod = modules[range];
  if (mod === undefined) throw new Error(`paketlenmiş glyph aralığı yok: ${range}`);
  return mod;
}

/** Dosya sistemi bağlantısı; testler kendi uygulamasını verir. */
export interface GlyphStore {
  /** `glyphs/` kökünü oluşturur ve `file://` adresini döndürür (sonda `/` yok). */
  root(): string;
  /** Paketteki glyph'lerin kimliği — içerik değişince değişir. */
  fingerprint(): string;
  /** Diskteki damga; hiç yazılmadıysa `null`. */
  stamp(): string | null;
  writeStamp(value: string): void;
  /** Bir aralığı paketten çıkarıp `<root>/<FONT_STACK>/<aralık>.pbf` yapar. */
  copy(range: string): Promise<void>;
}

/** `expo-asset` + `expo-file-system` tabanlı gerçek bağlantı. */
export function fileSystemGlyphStore(): GlyphStore {
  const rootDir = () => new Directory(Paths.document, GLYPH_DIR);
  const stackDir = () => new Directory(rootDir(), FONT_STACK);
  const trim = (uri: string) => uri.replace(/\/+$/, '');
  return {
    root() {
      const d = stackDir();
      if (!d.exists) d.create({ intermediates: true });
      return trim(rootDir().uri);
    },
    fingerprint() {
      return BUNDLED_RANGES.map((range) => {
        const asset = Asset.fromModule(assetModule(range));
        // Özet yoksa (bazı geliştirme kurulumlarında) ada düşülür; o durumda
        // damga sabit kalır ve kopyalama yalnızca ilk açılışta yapılır.
        return `${range}:${asset.hash ?? asset.name}`;
      }).join('|');
    },
    stamp() {
      const f = new File(rootDir(), STAMP);
      if (!f.exists) return null;
      try {
        return f.textSync();
      } catch {
        return null;
      }
    },
    writeStamp(value) {
      new File(rootDir(), STAMP).write(value);
    },
    async copy(range) {
      const asset = Asset.fromModule(assetModule(range));
      await asset.downloadAsync();
      const source = asset.localUri ?? asset.uri;
      if (!source) throw new Error(`glyph varlığı açılamadı: ${range}`);
      const target = new File(stackDir(), `${range}.pbf`);
      if (target.exists) target.delete();
      await new File(source).copy(target);
    },
  };
}

/**
 * Glyph'leri diske açar ve MapLibre şablonunu döndürür.
 * Bağlantı dışarıdan verilebilir — testler dosya sistemine dokunmaz.
 */
export async function prepareBundledGlyphs(
  store: GlyphStore = fileSystemGlyphStore(),
): Promise<string | null> {
  try {
    const root = store.root();
    const want = store.fingerprint();
    if (store.stamp() !== want) {
      for (const range of BUNDLED_RANGES) await store.copy(range);
      // Damga en sonda: yarıda kalan bir kopyalama bir dahaki açılışta
      // yeniden denenir.
      store.writeStamp(want);
    }
    return `${root}/{fontstack}/{range}.pbf`;
  } catch {
    return null;
  }
}

let cached: Promise<string | null> | null = null;

/** Uygulama ömrü boyunca tek sefer çalışır (her harita açılışında değil). */
export function bundledGlyphsUrl(): Promise<string | null> {
  cached ??= prepareBundledGlyphs();
  return cached;
}

/** Test/geliştirme için önbelleği sıfırlar. */
export function resetBundledGlyphs(): void {
  cached = null;
}
