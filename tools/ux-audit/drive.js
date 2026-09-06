/* eslint-env node */
/**
 * UX denetimi: web hedefinde (expo start --web) giriş yapar, rota listesini gezer,
 * ekran görüntüsü alır; konsol hatalarını, pageerror'ları, `[missing` i18n metnini ve
 * iç içe <button> (validateDOMNesting) durumlarını toplar. out/report.json + out/report.md üretir.
 *
 * Ortam değişkenleri:
 *   BASE_URL   (varsayılan http://localhost:8081)
 *   OUT        (varsayılan tools/ux-audit/out)
 *   ROUTES     (virgülle ayrılmış; verilmezse DEFAULT_ROUTES)
 *   AUDIT_EMAIL / AUDIT_PASSWORD (demo giriş; herhangi e-posta + 6+ karakter)
 *   COLOR_SCHEME (dark|light), LOCALE (tr-TR), SETTLE_MS (rota başına bekleme, varsayılan 3000)
 *   PLAYWRIGHT_PATH (playwright modülü bulunamazsa mutlak yol)
 * Çıkış kodu: 1 = en az bir rota başarısız / pageerror / [missing i18n / iç içe <button>.
 */
const fs = require('node:fs');
const path = require('node:path');

function loadPlaywright() {
  const candidates = [
    'playwright',
    process.env.PLAYWRIGHT_PATH,
    '/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      // sıradaki adayı dene
    }
  }
  throw new Error(
    'playwright bulunamadı: `npm i --no-save playwright && npx playwright install --with-deps chromium`',
  );
}

const DEFAULT_ROUTES = [
  '/',
  '/explore',
  '/zmatch',
  '/live',
  '/profile',
  '/notifications',
  '/settings',
  '/post/new',
  '/hazards',
  '/hazards/report',
  '/market',
  '/market/new',
  '/instructors',
  '/instructors/book',
  '/library',
  '/live-location',
  '/stories/create',
  '/stays',
  '/stays/host',
  '/stays/register',
  '/plans',
  '/first-aid',
  '/first-aid/contacts',
  '/assistant',
  '/assistant/vision',
  '/maps',
  '/maps/planner',
  '/climbing',
  '/climbing/logbook',
  '/climbing/submit',
  '/satellite',
  '/satellite/messages',
  '/satellite/sos',
  '/clubs',
  '/clubs/verify',
  '/clubs/event/new',
  '/fun',
  '/fun/badges',
  '/fun/challenges',
  '/fun/leaderboard',
  '/fun/quiz',
  '/fun/roulette',
  '/fun/passport',
  '/bookings',
];

const BASE_URL = process.env.BASE_URL || 'http://localhost:8081';
const OUT = path.resolve(process.env.OUT || path.join(__dirname, 'out'));
const ROUTES = (process.env.ROUTES || '')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);
const routes = ROUTES.length ? ROUTES : DEFAULT_ROUTES;
const SETTLE_MS = Number(process.env.SETTLE_MS || 3000);
const EMAIL = process.env.AUDIT_EMAIL || 'audit@zirtan.app';
const PASSWORD = process.env.AUDIT_PASSWORD || 'audit123';

const IGNORED = [/ERR_TUNNEL/, /favicon\.ico/, /Download the React DevTools/];
const WARNING_PATTERNS = [
  /validateDOMNesting/i,
  /cannot appear as a descendant of/i,
  /React Compiler/i,
  /Rules of Hooks/i,
  /Cannot update a component/i,
  /Each child in a list should have a unique/i,
  /Maximum update depth/i,
  /act\(\.\.\.\)/,
];

const slug = (r) => (r === '/' ? 'home' : r.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, ''));

(async () => {
  const { chromium } = loadPlaywright();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: process.env.LOCALE || 'tr-TR',
    colorScheme: process.env.COLOR_SCHEME === 'light' ? 'light' : 'dark',
  });
  const page = await ctx.newPage();
  const log = []; // { type, text, route }
  let currentRoute = '(login)';
  page.on('console', (m) => {
    const text = m.text();
    if (IGNORED.some((re) => re.test(text))) return;
    if (m.type() === 'error')
      log.push({ type: 'error', text: text.slice(0, 400), route: currentRoute });
    else if (m.type() === 'warning' && WARNING_PATTERNS.some((re) => re.test(text))) {
      log.push({ type: 'warning', text: text.slice(0, 400), route: currentRoute });
    }
  });
  page.on('pageerror', (e) =>
    log.push({ type: 'pageerror', text: String(e).slice(0, 400), route: currentRoute }),
  );

  const wait = (ms) => page.waitForTimeout(ms);
  const go = async (p, ms = SETTLE_MS) => {
    await page.goto(BASE_URL + p, { waitUntil: 'networkidle', timeout: 180000 });
    await wait(ms);
  };

  // Giriş akışı: karşılama → "Giriş yap" → form. Oturum zaten açıksa (ana sekme görünür) atla.
  const results = [];
  let loginOk = true;
  try {
    await go('/', 2500);
    const signInLink = page.getByText('Giriş yap').first();
    if (await signInLink.isVisible().catch(() => false)) {
      await signInLink.click();
      await wait(800);
      await page.getByPlaceholder('sen@ornek.com').fill(EMAIL);
      await page.getByPlaceholder('••••••••').fill(PASSWORD);
      await page.getByRole('button', { name: 'Giriş yap' }).click();
      await wait(3500);
    }
    await page.screenshot({ path: path.join(OUT, '00-login.png') });
  } catch (e) {
    loginOk = false;
    log.push({
      type: 'pageerror',
      text: 'LOGIN FAIL ' + String(e).slice(0, 300),
      route: '(login)',
    });
  }

  let i = 0;
  for (const route of routes) {
    i += 1;
    currentRoute = route;
    const before = log.length;
    const entry = {
      route,
      ok: false,
      screenshot: null,
      errors: 0,
      warnings: 0,
      missingI18n: false,
      nestedButtons: 0,
      note: '',
    };
    try {
      await go(route);
      const file = `${String(i).padStart(2, '0')}-${slug(route)}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      entry.screenshot = file;
      const text = await page
        .locator('body')
        .innerText()
        .catch(() => '');
      entry.missingI18n = /\[missing/.test(text);
      entry.nestedButtons = await page
        .evaluate(
          () => document.querySelectorAll('button button, [role="button"] [role="button"]').length,
        )
        .catch(() => 0);
      entry.ok = true;
    } catch (e) {
      entry.note = String(e).slice(0, 200);
    }
    const slice = log.slice(before);
    entry.errors = slice.filter((l) => l.type === 'error' || l.type === 'pageerror').length;
    entry.warnings = slice.filter((l) => l.type === 'warning').length;
    results.push(entry);
    const flags = [
      entry.missingI18n && 'MISSING i18n',
      entry.nestedButtons && `iç içe <button> ×${entry.nestedButtons}`,
    ]
      .filter(Boolean)
      .join(', ');
    console.log(
      `${route}: ${entry.ok ? 'ok' : 'FAIL ' + entry.note} errors+${entry.errors} warnings+${entry.warnings}${flags ? ' (' + flags + ')' : ''}`,
    );
  }
  await browser.close();

  const unique = [...new Map(log.map((l) => [`${l.type}:${l.text}`, l])).values()];
  const failed = results.filter((r) => !r.ok);
  const missing = results.filter((r) => r.missingI18n);
  const nested = results.filter((r) => r.nestedButtons > 0);
  const pageErrors = unique.filter((l) => l.type === 'pageerror');
  const ok = loginOk && !failed.length && !missing.length && !nested.length && !pageErrors.length;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    ok,
    loginOk,
    routes: results,
    log: unique,
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');

  const md = [];
  md.push(`# UX denetimi — ${report.generatedAt.slice(0, 10)}`);
  md.push('');
  md.push(
    `Durum: **${ok ? 'temiz' : 'sorun var'}** · ${results.length} rota · ${failed.length} başarısız · ${missing.length} eksik i18n · ${nested.length} iç içe düğme · ${pageErrors.length} sayfa hatası · giriş ${loginOk ? 'ok' : 'BAŞARISIZ'}`,
  );
  md.push('');
  md.push('| # | Rota | Durum | Hata | Uyarı | i18n | İç içe düğme | Not |');
  md.push('| ---: | --- | :-: | ---: | ---: | :-: | ---: | --- |');
  results.forEach((r, idx) => {
    md.push(
      `| ${idx + 1} | \`${r.route}\` | ${r.ok ? '✅' : '❌'} | ${r.errors} | ${r.warnings} | ${r.missingI18n ? '⚠️' : ''} | ${r.nestedButtons || ''} | ${r.note.replace(/\|/g, '\\|')} |`,
    );
  });
  md.push('');
  if (unique.length) {
    md.push('## Konsol kayıtları (tekilleştirilmiş)');
    md.push('');
    for (const l of unique)
      md.push(`- **${l.type}** \`${l.route}\`: ${l.text.replace(/\n/g, ' ')}`);
    md.push('');
  }
  md.push('## Görsel bulgular');
  md.push('');
  md.push('_ux-auditor ajanı ekran görüntülerini inceleyip bu bölümü doldurur._');
  md.push('');
  fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n'));
  console.log(`\nRapor: ${path.join(OUT, 'report.md')}`);
  console.log(
    'ERRORS:',
    unique.length
      ? '\n' + unique.map((l) => `[${l.type}] ${l.route}: ${l.text}`).join('\n')
      : 'none',
  );
  process.exitCode = ok ? 0 : 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 2;
});
