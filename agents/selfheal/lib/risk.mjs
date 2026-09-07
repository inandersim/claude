/**
 * Yetki sınırı: self-heal hattının hangi dosyalara dokunabileceği ve hangilerinin
 * insan onayı gerektirdiği burada — tek yerde — tanımlıdır.
 *
 * Üç liste vardır ve şu sırayla uygulanır:
 *   1. DENY   — hiçbir koşulda değiştirilemez (sır, kilit dosyası, CI, ajanın kendi kuralları).
 *   2. ALLOW  — otomatik düzeltmenin dokunabileceği yollar. Listede yoksa değiştirilemez.
 *   3. RISKY  — ALLOW içinde ama para/can güvenliği/kimlik alanı: PR açılır fakat
 *               `needs-human` etiketiyle ve otomatik birleştirme olmadan.
 *
 * Bu dosya self-heal hattının kendi DENY listesindedir: hat kendi güvenlik kurallarını
 * değiştiremez (self-modification lock). Değişiklik yalnızca insan PR'ı ile yapılır.
 */

/** Hiçbir koşulda otomatik değiştirilemeyecek yollar. */
export const DENY = [
  { pattern: '.env*', reason: 'ortam sırları' },
  { pattern: '**/secrets/**', reason: 'sır klasörü' },
  { pattern: '**/*.pem', reason: 'özel anahtar' },
  { pattern: '**/*.key', reason: 'özel anahtar' },
  { pattern: '**/*.keystore', reason: 'imzalama anahtarı' },
  { pattern: '**/*.p8', reason: 'imzalama anahtarı' },
  { pattern: '**/*.p12', reason: 'imzalama anahtarı' },
  { pattern: 'package-lock.json', reason: 'bağımlılık kilidi — yalnızca insan/dependency-update' },
  { pattern: 'package.json', reason: 'bağımlılık ve betik tanımı — yalnızca insan' },
  { pattern: 'eas.json', reason: 'yayın profilleri' },
  { pattern: 'app.json', reason: 'uygulama şeması ve izinler' },
  { pattern: '.github/**', reason: 'CI/CD tanımı — hat kendi tetikleyicisini değiştiremez' },
  { pattern: '.claude/**', reason: 'ajan talimatları — hat kendi talimatını değiştiremez' },
  {
    pattern: 'agents/selfheal/**',
    reason: 'self-heal hattının kendi kuralları (self-modification lock)',
  },
  {
    pattern: 'agents/cto/**',
    reason: 'AI CTO hattının kuralları ve politikası (self-modification lock)',
  },
  { pattern: 'docs/AI_CTO.md', reason: 'mühendislik tüzüğü — yalnızca insan PR\'ı' },
  { pattern: 'node_modules/**', reason: 'bağımlılık kaynağı' },
  { pattern: '.git/**', reason: 'depo iç yapısı' },
  { pattern: 'server/**/node_modules/**', reason: 'bağımlılık kaynağı' },
];

/** Otomatik düzeltmenin dokunabileceği yollar (DENY her zaman önceliklidir). */
export const ALLOW = [
  'src/**/*.ts',
  'src/**/*.tsx',
  'src/**/__tests__/**',
  'tools/**/*.js',
  'tools/**/*.mjs',
  'docs/health/self/**',
];

/**
 * Riskli alanlar: düzeltme yine de önerilir ama PR `needs-human` etiketiyle açılır,
 * otomatik birleştirilmez ve kanarya aşamaları zorunludur.
 */
export const RISKY = [
  { pattern: 'src/domain/pricing.ts', category: 'odeme', reason: 'fiyatlandırma mantığı' },
  { pattern: 'src/domain/marketplace.ts', category: 'odeme', reason: 'pazar yeri işlemleri' },
  { pattern: 'src/domain/inventory.ts', category: 'odeme', reason: 'stok ve sipariş' },
  {
    pattern: 'src/features/inventory/**',
    category: 'odeme',
    reason: 'ödeme zaman çizelgesi ekranları',
  },
  { pattern: 'src/features/market/**', category: 'odeme', reason: 'satın alma akışı' },
  { pattern: 'src/features/courses/**', category: 'odeme', reason: 'rezervasyon ve ücret akışı' },
  { pattern: '**/*payment*', category: 'odeme', reason: 'ödeme' },
  { pattern: '**/*checkout*', category: 'odeme', reason: 'ödeme' },
  { pattern: 'src/domain/emergency.ts', category: 'sos', reason: 'acil durum mantığı' },
  { pattern: 'src/domain/rescue.ts', category: 'sos', reason: 'kurtarma çağrısı' },
  { pattern: 'src/domain/satellite.ts', category: 'sos', reason: 'uydu SOS' },
  { pattern: 'src/domain/telemed.ts', category: 'sos', reason: 'tele-sağlık' },
  { pattern: 'src/features/satellite/**', category: 'sos', reason: 'uydu SOS ekranları' },
  { pattern: 'src/features/rescue/**', category: 'sos', reason: 'kurtarma ekranları' },
  { pattern: 'src/features/firstaid/**', category: 'sos', reason: 'ilk yardım ve SOS düğmesi' },
  { pattern: 'src/features/telemed/**', category: 'sos', reason: 'tele-sağlık ekranları' },
  { pattern: 'src/app/(app)/satellite/**', category: 'sos', reason: 'SOS rotaları' },
  { pattern: '**/*sos*', category: 'sos', reason: 'SOS' },
  { pattern: '**/*emergency*', category: 'sos', reason: 'acil durum' },
  { pattern: 'src/features/auth/**', category: 'kimlik', reason: 'kimlik doğrulama' },
  { pattern: 'src/app/(auth)/**', category: 'kimlik', reason: 'giriş/kayıt rotaları' },
  { pattern: 'src/domain/trust.ts', category: 'kimlik', reason: 'güven ve doğrulama puanı' },
  { pattern: 'src/data/session*', category: 'kimlik', reason: 'oturum deposu' },
  { pattern: '**/*auth*', category: 'kimlik', reason: 'kimlik' },
];

/**
 * Küçük glob eşleştirici. Deseni soldan tarayarak regex kurar (ara işaretleyici yok):
 *   iki yıldız + eğik çizgi → sıfır ya da daha çok klasör (desen kök dosyalarla da eşleşir)
 *   iki yıldız             → klasör ayırıcısı dahil her şey
 *   tek yıldız             → tek bir yol bölümü içinde her şey
 *   soru işareti           → tek karakter
 */
export function matchGlob(pattern, path, { caseInsensitive = false } = {}) {
  let rx = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        if (pattern[i + 2] === '/') {
          rx += '(?:[^/]*/)*'; // yildiz-yildiz-egik: sifir ya da daha cok klasor
          i += 2;
        } else {
          rx += '.*';
          i += 1;
        }
      } else {
        rx += '[^/]*';
      }
    } else if (ch === '?') {
      rx += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(ch)) {
      rx += '\\' + ch;
    } else {
      rx += ch;
    }
  }
  return new RegExp('^' + rx + '$', caseInsensitive ? 'i' : '').test(path);
}

/** Yolu normalize eder: baştaki `./`, `/` ve ters bölü ayırıcıları temizlenir. */
export function normalizePath(path) {
  return String(path)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

/**
 * Tek bir yolu sınıflandırır.
 * @returns {{path:string, allowed:boolean, denied:boolean, denyReason:string|null,
 *            risky:boolean, riskCategories:string[], riskReasons:string[]}}
 */
export function classifyPath(inputPath) {
  const path = normalizePath(inputPath);
  // Bulgular bazen tek dosya yerine klasör ipucu verir (`src/features/zmatch/`).
  // Böyle bir ipucunu, içindeki tipik bir kaynak dosyayla temsil ederek değerlendiririz:
  // klasör ancak içindeki dosyalar izinliyse izinli sayılır.
  const isDirHint = path.endsWith('/');
  const probe = isDirHint ? `${path}dosya.ts` : path;
  // DENY ve RISKY büyük/küçük harfe duyarsız eşleşir: depoda `PaymentTimeline.tsx`,
  // `SosButton.tsx`, `HoldSosButton.tsx` gibi adlar var — duyarlı eşleşme bunları kaçırır
  // ve kaçırmanın bedeli (riskli dosyaya sessizce dokunmak) yanlış pozitiften ağırdır.
  // ALLOW duyarlı kalır: izin vermek, yasaklamaktan daha temkinli olmalıdır.
  const ci = { caseInsensitive: true };
  const deny = DENY.find((d) => matchGlob(d.pattern, path, ci) || (isDirHint && matchGlob(d.pattern, probe, ci)));
  const riskHits = RISKY.filter((r) => matchGlob(r.pattern, path, ci) || (isDirHint && matchGlob(r.pattern, probe, ci)));
  const inAllow = ALLOW.some((p) => matchGlob(p, probe));
  return {
    path,
    allowed: !deny && inAllow,
    denied: Boolean(deny),
    denyReason: deny ? `${deny.pattern}: ${deny.reason}` : null,
    risky: riskHits.length > 0,
    riskCategories: [...new Set(riskHits.map((r) => r.category))].sort(),
    riskReasons: riskHits.map((r) => `${r.pattern}: ${r.reason}`),
  };
}

/**
 * Bir değişiklik kümesini (git diff --name-only) değerlendirir.
 * `ok` yalnızca hiçbir yol reddedilmemiş ve hepsi ALLOW içindeyse true olur.
 *
 * @param {string[]} paths
 * @returns {{ok:boolean, files:object[], denied:object[], outsideAllow:object[],
 *            risky:object[], riskCategories:string[], needsHuman:boolean, summary:string}}
 */
export function assessChangeSet(paths = []) {
  const files = paths.filter(Boolean).map(classifyPath);
  const denied = files.filter((f) => f.denied);
  const outsideAllow = files.filter((f) => !f.denied && !f.allowed);
  const risky = files.filter((f) => f.risky);
  const riskCategories = [...new Set(risky.flatMap((f) => f.riskCategories))].sort();
  const ok = denied.length === 0 && outsideAllow.length === 0 && files.length > 0;
  const parts = [`${files.length} dosya`];
  if (denied.length) parts.push(`${denied.length} yasak`);
  if (outsideAllow.length) parts.push(`${outsideAllow.length} izin listesi dışı`);
  if (risky.length) parts.push(`${risky.length} riskli (${riskCategories.join(', ')})`);
  return {
    ok,
    files,
    denied,
    outsideAllow,
    risky,
    riskCategories,
    needsHuman: risky.length > 0,
    summary: parts.join(' · '),
  };
}

/** Bir bulgunun işaret ettiği dosyalar riskli mi? (bulgu önceliklendirmesi kullanır) */
export function findingRisk(finding) {
  const paths = finding?.files ?? [];
  const assessment = assessChangeSet(paths);
  return {
    risky: assessment.risky.length > 0,
    categories: assessment.riskCategories,
    autoFixable: assessment.ok && assessment.risky.length === 0,
  };
}
