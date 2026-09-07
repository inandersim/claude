/**
 * Etki analizinin **saf** çekirdeği — dosya sistemi yok.
 *
 * Modül ve tablo listesi dışarıdan verilir; bu dosya yalnızca "bu metin hangi
 * modülü işaret ediyor" sorusunu cevaplar. Node tarafı listeleri depodan okur
 * (`impact.mjs`), tarayıcıdaki panel aynı fonksiyonu kendi listesiyle çağırır —
 * kural tek yerde kalır.
 *
 * Eşleşme dile duyarlıdır: Türkçe talepte "rota" ile `tracks`/`routing`,
 * "konaklama" ile `stays` eşleşsin diye modül adlarının yanına takma adlar konur.
 */
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
export function analyzeImpact(text, { modules = [], tables = [] } = {}) {
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

