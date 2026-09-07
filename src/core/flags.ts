/**
 * Lansman kapsamı — hangi modüller açık?
 *
 * Uygulamada 39 özellik modülü ve 145 ekran var. İlk sürümde hepsini açmak üç
 * şeyi birden bozar:
 *
 *   1. **Mağaza incelemesi.** Konum + acil durum + sağlık + ödeme + drone + UGC
 *      bir arada, ilk sürümde, ekstra inceleme çeker.
 *   2. **Boş ekran.** 200 kullanıcıda 27 modülün çoğu boş görünür; boş ekran
 *      "bu uygulama ölü" demektir.
 *   3. **Maliyet ve destek.** Her açık modül ayrı sorgu, ayrı hata, ayrı soru.
 *
 * Bu yüzden kapsam bir **anahtar**: `EXPO_PUBLIC_LAUNCH_SCOPE=v1` dar kapsamı,
 * `full` tamamını açar. Karar tek dizide durur ve değiştirmek tek satır.
 *
 * **Bugün anahtar kapalı.** Varsayılan `full`; hiçbir modül gizli değil.
 * Burada duran şey mekanizma — daraltma kararı ayrı ve bilinçli bir adım.
 *
 * Kapalı modül **silinmez**: kodu, testleri ve çevirisi yerinde durur; yalnızca
 * girişleri gizlenir ve rotası engellenir. Böylece kapsam genişletmek bir
 * geliştirme değil, bir anahtar çevirmedir.
 */

/** `src/features` altındaki modüllerle birebir. */
export const MODULLER = [
  'ai',
  'articles',
  'auth',
  'chat',
  'climbing',
  'clubs',
  'countries',
  'courses',
  'destinations',
  'explore',
  'feed',
  'firstaid',
  'fun',
  'groups',
  'hazards',
  'heritage',
  'instructors',
  'inventory',
  'kids',
  'library',
  'live',
  'maps',
  'market',
  'media',
  'notifications',
  'plans',
  'presence',
  'profile',
  'rescue',
  'satellite',
  'social',
  'stays',
  'stories',
  'telemed',
  'tracks',
  'tv',
  'vision',
  'weather',
  'wildlife',
  'zmatch',
] as const;

export type Modul = (typeof MODULLER)[number];

/**
 * v1 kapsamı: **çevrimdışı harita + güvenlik + birlikte çıkma.**
 *
 * Seçim ilkesi: rakiplerde bir arada olmayan şeyle çık, düşük kullanıcı
 * yoğunluğunda **boş görünmeyen** modülleri aç. Çevrimdışı harita, arazi ve
 * ilk yardım tek kullanıcıyla bile çalışır; kulüp, market, TV ve tele-tıp
 * çalışmaz.
 *
 * ZMatch listede çünkü "yakındakini bul" bir kulübün içinde 30 kişiyle bile
 * işe yarar. Akış listede çünkü ana sekme o; olmazsa uygulamanın evi kalmaz.
 */
export const V1_KAPSAMI: readonly Modul[] = [
  'auth',
  'explore',
  'feed',
  'firstaid',
  'hazards',
  'library',
  'maps',
  'notifications',
  'profile',
  'rescue',
  'social',
  'tracks',
  'weather',
  'zmatch',
];

export type Kapsam = 'v1' | 'full';

/** Varsayılan `full`: geliştirme ve test her şeyi görür; daraltma bilinçlidir. */
export function aktifKapsam(
  env: Record<string, string | undefined> = process.env,
): Kapsam {
  return env.EXPO_PUBLIC_LAUNCH_SCOPE?.trim() === 'v1' ? 'v1' : 'full';
}

export function modulAcik(modul: Modul, kapsam: Kapsam = aktifKapsam()): boolean {
  return kapsam === 'full' || V1_KAPSAMI.includes(modul);
}

/**
 * Rota kökü → modül eşlemesi.
 *
 * Yalnızca **modül köküne** bakılır (`/tracks/record` → `tracks`): alt rotalar
 * modülleriyle birlikte açılıp kapanır ve eşleme listesi ekran sayısıyla
 * büyümez.
 */
const ROTA_MODULU: Record<string, Modul> = {
  assistant: 'ai',
  articles: 'articles',
  chat: 'chat',
  climbing: 'climbing',
  clubs: 'clubs',
  countries: 'countries',
  courses: 'courses',
  destinations: 'destinations',
  explore: 'explore',
  'first-aid': 'firstaid',
  fun: 'fun',
  groups: 'groups',
  hazards: 'hazards',
  heritage: 'heritage',
  instructors: 'instructors',
  inventory: 'inventory',
  kids: 'kids',
  library: 'library',
  live: 'live',
  maps: 'maps',
  market: 'market',
  notifications: 'notifications',
  plans: 'plans',
  post: 'social',
  presence: 'presence',
  profile: 'profile',
  rescue: 'rescue',
  satellite: 'satellite',
  stays: 'stays',
  stories: 'stories',
  telemed: 'telemed',
  tracks: 'tracks',
  tv: 'tv',
  weather: 'weather',
  wildlife: 'wildlife',
  zmatch: 'zmatch',
};

/** `/tracks/record` → `tracks`; tanınmayan yol için `null`. */
export function rotaninModulu(yol: string): Modul | null {
  const kok = yol.replace(/^\/+/, '').split(/[/?#]/)[0];
  if (!kok) return null;
  return ROTA_MODULU[kok] ?? null;
}

/**
 * Bu rota açık mı?
 *
 * Tanınmayan yol **açık** sayılır: kapsam listesi bir güvenlik sınırı değil,
 * ürün kararıdır. Yeni bir rota eklendiğinde uygulama sessizce kırılmamalı —
 * eşlemenin eksikliğini `flags.test.ts` yakalıyor.
 */
export function rotaAcik(yol: string, kapsam: Kapsam = aktifKapsam()): boolean {
  const modul = rotaninModulu(yol);
  return modul === null || modulAcik(modul, kapsam);
}
