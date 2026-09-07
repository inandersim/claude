// Metro paketleyici yapılandırması — Expo varsayılanının üzerine.
//
// İki sorunu çözer:
//
// 1. **Gereksiz tarama.** Depoda uygulamanın yanında dört ayrı Node projesi
//    var (`admin`, `server/ai-gateway`, `agents/marketing`, `website`). Metro
//    kök klasörü baştan sona tarar; bu klasörlerin `node_modules`'ı ve üretilen
//    çıktılar pakete hiç girmediği hâlde binlerce dosya olarak dizine ekleniyor.
//
// 2. **Windows'ta `EMFILE: too many open files`.** Windows'ta aynı anda açık
//    dosya tanıtıcısı sayısı Linux'taki gibi yükseltilemez; Metro'nun dönüşüm
//    işçileri ile önbellek yazımları sınırı aşınca paketleme yarıda kalıyor.
//    İşçi sayısı sınırlanır ve önbellek sistem `Temp` klasörü yerine proje
//    içine alınır (virüs taramasından dışlaması da kolaylaşır).
//
// 3. **Harita glyph'leri (`.pbf`) uygulamayla gitsin.** `assets/glyphs/` altındaki
//    SDF paketleri koddan `require` edilir; Metro tanımadığı uzantıyı kaynak
//    dosya sanıp ayrıştırmaya çalışır ve paketleme hata verir.

const os = require('node:os');
const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

/**
 * Paketlemeye hiç girmeyen, taranması boşuna olan klasörler.
 * Proje köküne göre yazılır; `node_modules` içindeki aynı adlı klasörler
 * (ör. bir paketin kendi `out/` dizini) yanlışlıkla engellenmesin diye
 * desen kökten başlar.
 */
const IGNORED = [
  'admin/node_modules',
  'admin/dist',
  'server/*/node_modules',
  'agents/*/node_modules',
  'website/dist',
  'out', // harita karoları ve yönlendirme grafikleri (yüzlerce MB olabilir)
  'docs/health',
  '.expo/static-tmp',
  'supabase/.temp',
];

/** Hem `/` hem `\` ayıracını kabul eder (Windows'ta yollar ters bölülü gelir). */
const SEP = '[\\\\/]';
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const segments = (glob) =>
  glob
    .split('/')
    .map((part) => (part === '*' ? `[^\\\\/]+` : escape(part)))
    .join(SEP);

const ROOT = __dirname.split(path.sep).map(escape).join(SEP);

config.resolver.blockList = new RegExp(
  `^${ROOT}${SEP}(?:${IGNORED.map(segments).join('|')})${SEP}`,
);

// Harita yazı tipi paketleri: kaynak değil, varlık. Çevrimdışı yerel derlemede
// metnin çizilebilmesi için bunların uygulama paketine girmesi şart
// (bkz. src/features/maps/vector/glyphs.native.ts).
config.resolver.assetExts = [...config.resolver.assetExts, 'pbf'];

// Windows: tanıtıcı sınırı düşük olduğu için işçi sayısı sınırlanır.
// Diğer platformlarda Expo varsayılanı (çekirdek sayısı - 1) korunur.
if (process.platform === 'win32') {
  config.maxWorkers = Math.max(1, Math.min(4, os.cpus().length - 1));
}

// Önbellek proje içinde: `%TEMP%` altındaki kısa (8.3) yollar ve gerçek zamanlı
// virüs taraması Windows'ta hem yavaşlığın hem EMFILE hatasının kaynağı.
config.cacheStores = [
  new FileStore({ root: path.join(__dirname, 'node_modules', '.cache', 'metro') }),
];

module.exports = config;
