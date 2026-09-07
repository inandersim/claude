/**
 * Etki analizi: doğal dildeki talepten **hangi sistemlerin etkileneceğini** çıkarır.
 *
 * Modül listesi uydurulmaz; depodan okunur (`src/features/*`, `src/domain/*.ts`,
 * `supabase/migrations/*.sql` içindeki tablo adları). Böylece yeni bir modül
 * eklendiğinde bu dosyayı güncellemek gerekmez ve analiz var olmayan bir modülü
 * gösteremez.
 *
 * Eşleşme dile duyarlıdır: Türkçe talepte "rota" ile `tracks`/`routing`,
 * "konaklama" ile `stays` eşleşsin diye modül adlarının yanına takma adlar konur.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { ROOT } from './policy.mjs';

/**
 * Modül adı → Türkçe/İngilizce takma adlar.
 * Yalnızca adından anlaşılmayanlar yazılır; `climbing` → "climbing" zaten eşleşir.
 */
export const ALIASES = {
  tracks: ['rota', 'route', 'iz', 'trail', 'gpx', 'navigasyon', 'navigation', 'trek', 'trekking', 'yürüyüş'],
  maps: ['harita', 'map', 'karo', 'tile', 'offline', 'çevrimdışı', 'pmtiles'],
  weather: ['hava', 'weather', 'yağış', 'rüzgar', 'sıcaklık', 'çığ', 'avalanche'],
  stays: ['konaklama', 'kamp', 'camp', 'camping', 'rezervasyon', 'booking', 'kalacak', 'çadır'],
  presence: ['konum', 'location', 'gps', 'canlı konum', 'live location', 'paylaşım'],
  rescue: ['kurtarma', 'rescue', 'sos', 'acil', 'emergency', '112'],
  firstaid: ['ilk yardım', 'first aid', 'yaralanma'],
  climbing: ['tırmanış', 'tırmanma', 'kaya', 'crag', 'rota derecesi'],
  wildlife: ['yaban', 'hayvan', 'tür', 'species', 'doğa gözlem'],
  heritage: ['arkeolojik', 'tarihi', 'antik', 'ören', 'heritage'],
  kids: ['çocuk', 'aile', 'family', 'kid'],
  courses: ['eğitim', 'kurs', 'ders', 'sertifika', 'course'],
  clubs: ['kulüp', 'club', 'üniversite', 'etkinlik', 'event'],
  groups: ['grup', 'kanal', 'sohbet', 'chat', 'mesaj'],
  social: ['gönderi', 'post', 'paylaşım', 'akış', 'feed', 'yorum', 'beğeni'],
  stories: ['hikâye', 'hikaye', 'anlar', 'story'],
  telemed: ['doktor', 'tele-tıp', 'teletıp', 'sağlık', 'konsültasyon'],
  inventory: ['ekipman', 'gear', 'envanter', 'stok', 'kiralama'],
  market: ['pazar', 'satış', 'ilan', 'market'],
  countries: ['ülke', 'vize', 'visa', 'country'],
  articles: ['yazar', 'blog', 'makale', 'article'],
  tv: ['televizyon', 'belgesel', 'yayın', 'kanal', 'tv'],
  satellite: ['uydu', 'satellite', 'garmin', 'inreach'],
  destinations: ['destinasyon', 'himalaya', 'nepal', 'zirve tırmanışı', 'seyahat planı'],
  ai: ['yapay zekâ', 'yapay zeka', 'asistan', 'assistant', 'öneri', 'recommendation', 'llm'],
  vision: ['kamera', 'fotoğraf analizi', 'görüntü', 'tanıma'],
  auth: ['kayıt', 'giriş', 'login', 'otp', 'sms', 'doğrulama', 'oturum', 'şifre'],
  fun: ['oyun', 'rozet', 'badge', 'meydan okuma', 'challenge', 'puan', 'xp'],
  explore: ['keşif', 'keşfet', 'discover', 'arama', 'search', 'filtre'],
  profile: ['profil', 'kullanıcı', 'user', 'hesap'],
  notifications: ['bildirim', 'notification', 'push'],
  hazards: ['tehlike', 'hazard', 'uyarı', 'risk bildirimi'],
  zmatch: ['eşleşme', 'match', 'arkadaş bul', 'partner'],
  instructors: ['eğitmen', 'rehber', 'guide', 'instructor'],
  library: ['kütüphane', 'içerik', 'library'],
  plans: ['plan', 'dönüş sözü', 'return promise', 'yol planı'],
  live: ['canlı yayın', 'stream', 'drone'],
  feed: ['ana akış', 'akış'],
  chat: ['mesajlaşma', 'dm', 'sohbet'],
};

/** Deponun gerçek modül listesi. */
export function listModules(root = ROOT) {
  const featureDir = resolve(root, 'src', 'features');
  const features = existsSync(featureDir)
    ? readdirSync(featureDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
  const domainDir = resolve(root, 'src', 'domain');
  const domains = existsSync(domainDir)
    ? readdirSync(domainDir)
        .filter((f) => f.endsWith('.ts') && !['index.ts', 'types.ts', 'enums.ts'].includes(f))
        .map((f) => f.replace(/\.ts$/, ''))
    : [];
  return [...new Set([...features, ...domains])].sort();
}

/** Şemadaki tablo adları (migration dosyalarındaki `CREATE TABLE`'lardan). */
export function listTables(root = ROOT) {
  const dir = resolve(root, 'supabase', 'migrations');
  if (!existsSync(dir)) return [];
  const names = new Set();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, file), 'utf8');
    for (const m of sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"?([a-z0-9_]+)"?/gi)) {
      names.add(m[1].toLowerCase());
    }
  }
  return [...names].sort();
}

const normalize = (s) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/[â]/g, 'a')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Terim metinde **kelime başında** geçiyor mu?
 *
 * Düz `includes` çok gevşek: "kamp alanlarını" içindeki `anlar` alt dizisi
 * "Anlar" (hikâye) modülünü tetikliyordu. Sonu serbest bırakılır çünkü Türkçe
 * ekler kelimeyi uzatır — "rota" terimi "rotaları" ile eşleşmeli.
 */
export function containsTerm(hay, term) {
  const t = normalize(term);
  if (!t) return false;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^0-9a-zçğıöşü])${escaped}`, 'u').test(hay);
}

/**
 * Talep metninden etkilenen modülleri çıkarır.
 *
 * `matched` her modül için hangi kelimenin eşleştiğini taşır — analiz ekranında
 * "neden bu modül?" sorusunun cevabı görünür olsun diye.
 */
export function analyzeImpact(text, { root = ROOT, modules = listModules(root), tables = listTables(root) } = {}) {
  const hay = normalize(text);
  const matched = [];
  for (const mod of modules) {
    const terms = [mod, ...(ALIASES[mod] ?? [])];
    const hit = terms.find((t) => containsTerm(hay, t));
    if (hit) matched.push({ module: mod, term: hit });
  }
  const touchedTables = tables.filter(
    (t) => containsTerm(hay, t.replace(/_/g, ' ')) || containsTerm(hay, t),
  );
  return {
    modules: matched.map((m) => m.module),
    matched,
    tables: touchedTables,
    // Hiçbir modül eşleşmediyse bu bir bilgi değil, bir uyarıdır: talep ya çok
    // genel ya da yeni bir alan açıyor. İki durumda da insan okumalı.
    unresolved: matched.length === 0,
  };
}

/** Etkilenen modüllerden olası dosya yollarını türetir (kaba, plan için yeterli). */
export function likelyPaths(modules, { root = ROOT } = {}) {
  const paths = [];
  for (const m of modules) {
    if (existsSync(resolve(root, 'src', 'features', m))) paths.push(`src/features/${m}/**`);
    if (existsSync(resolve(root, 'src', 'domain', `${m}.ts`))) paths.push(`src/domain/${m}.ts`);
    if (existsSync(resolve(root, 'src', 'app', '(app)', m))) paths.push(`src/app/(app)/${m}/**`);
  }
  return [...new Set(paths)].sort();
}
