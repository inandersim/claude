/**
 * Satır içi SVG illüstrasyonlar: logo, hero dağ silüeti, kart kapakları, telefon çerçevesi,
 * yükseklik profili, QR yer tutucu ve mağaza rozetleri.
 */
import { esc } from './lib.js';

/* Logo: üç katmanlı zirve işareti */
export function logoMark(size = 32, cls = 'logo-mark') {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="lg-${size}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A8DDE"/><stop offset="1" stop-color="#2F7D4F"/></linearGradient></defs>
  <rect width="64" height="64" rx="16" fill="url(#lg-${size})"/>
  <path d="M10 48 24 22l7 12 6-8 17 22Z" fill="#F5F1E8" opacity=".95"/>
  <path d="M24 22l4 7-3 3-4-4z" fill="#3A8DDE" opacity=".5"/>
  <circle cx="46" cy="17" r="5" fill="#E8722A"/>
</svg>`;
}

export function logoMarkStandalone() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 64 64">
  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A8DDE"/><stop offset="1" stop-color="#2F7D4F"/></linearGradient></defs>
  <rect width="64" height="64" rx="16" fill="url(#lg)"/>
  <path d="M10 48 24 22l7 12 6-8 17 22Z" fill="#F5F1E8" opacity=".95"/>
  <path d="M24 22l4 7-3 3-4-4z" fill="#3A8DDE" opacity=".5"/>
  <circle cx="46" cy="17" r="5" fill="#E8722A"/>
</svg>
`;
}

export function wordmarkStandalone(dark = false) {
  const fg = dark ? '#F5F1E8' : '#10201B';
  const bg = dark ? '#10201B' : 'none';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="128" viewBox="0 0 480 128">
  <rect width="480" height="128" rx="24" fill="${bg}"/>
  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A8DDE"/><stop offset="1" stop-color="#2F7D4F"/></linearGradient></defs>
  <g transform="translate(24 24) scale(1.25)">
    <rect width="64" height="64" rx="16" fill="url(#lg)"/>
    <path d="M10 48 24 22l7 12 6-8 17 22Z" fill="#F5F1E8" opacity=".95"/>
    <circle cx="46" cy="17" r="5" fill="#E8722A"/>
  </g>
  <text x="130" y="86" font-family="Manrope, Inter, system-ui, sans-serif" font-size="64" font-weight="800" letter-spacing="-2" fill="${fg}">Zirtan</text>
</svg>
`;
}

/* Favicon (basit, küçük boyutta okunur) */
export function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#2F7D4F"/>
  <path d="M10 48 24 22l7 12 6-8 17 22Z" fill="#F5F1E8"/>
  <circle cx="46" cy="17" r="5" fill="#E8722A"/>
</svg>
`;
}

/* Hero: katmanlı dağ silüeti, gün doğumu gökyüzü */
export function heroMountains() {
  return `<svg class="hero-art" viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--hero-sky-1)"/>
      <stop offset="1" stop-color="var(--hero-sky-2)"/>
    </linearGradient>
    <linearGradient id="sunGlow" cx="0.5" cy="0.5"><stop offset="0" stop-color="#E8722A"/><stop offset="1" stop-color="#F5B47A"/></linearGradient>
  </defs>
  <rect width="1440" height="560" fill="url(#sky)"/>
  <circle cx="1080" cy="230" r="70" fill="url(#sunGlow)" opacity=".9"/>
  <g class="cloud" opacity=".55" fill="#fff">
    <ellipse cx="300" cy="150" rx="90" ry="22"/><ellipse cx="350" cy="140" rx="60" ry="26"/>
    <ellipse cx="880" cy="110" rx="70" ry="18"/><ellipse cx="920" cy="104" rx="46" ry="20"/>
  </g>
  <path fill="var(--hero-m1)" d="M0 420 120 330 210 380 330 260 440 350 520 300 620 390 700 330 800 420 900 300 1000 380 1100 320 1220 400 1320 340 1440 420V560H0Z"/>
  <path fill="var(--hero-m2)" d="M0 470 90 410 180 450 300 380 420 450 500 410 620 470 740 400 840 460 960 380 1060 450 1180 400 1290 470 1380 430 1440 470V560H0Z"/>
  <path fill="var(--hero-m3)" d="M0 520 110 480 220 510 340 470 460 510 580 480 700 520 820 470 930 510 1050 480 1170 520 1290 490 1440 520V560H0Z"/>
</svg>`;
}

/* Kart kapağı: macera türüne göre renk ve ikon desenli SVG (dosya olarak yazılır) */
const COVER_THEMES = {
  hiking: ['#2F7D4F', '#7CB342'],
  climbing: ['#B85C2B', '#E8722A'],
  diving: ['#1C5FA8', '#3A8DDE'],
  skiing: ['#4B6C9E', '#A8C4EA'],
  cycling: ['#5A7D2F', '#C1D96B'],
  paragliding: ['#3A8DDE', '#8CC7F2'],
  rafting: ['#2B7FA6', '#5FC1D8'],
  canoe: ['#2A6F7A', '#69B7B2'],
  campsite: ['#3D6B3F', '#8CBF77'],
  peak: ['#4E5D73', '#9DB0C8'],
  cave: ['#4A3F5C', '#8E7BAF'],
  ski: ['#4B6C9E', '#A8C4EA'],
  dive_centre: ['#1C5FA8', '#3A8DDE'],
  hiking_route: ['#2F7D4F', '#7CB342'],
  viewpoint: ['#7A5C2E', '#D9A857'],
  shelter: ['#6B4F3A', '#C9A27D'],
  hut: ['#6B4F3A', '#C9A27D'],
  default: ['#2F7D4F', '#3A8DDE'],
};

export function coverSvg(kind) {
  const [a, b] = COVER_THEMES[kind] ?? COVER_THEMES.default;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#fff" opacity=".25"/></pattern>
  </defs>
  <rect width="640" height="360" fill="url(#g)"/>
  <rect width="640" height="360" fill="url(#p)"/>
  <path fill="#fff" opacity=".16" d="M0 300 90 220 160 270 250 170 340 250 420 200 520 290 600 230 640 260V360H0Z"/>
  <path fill="#10201B" opacity=".18" d="M0 330 80 290 170 320 270 270 380 320 470 280 560 330 640 300V360H0Z"/>
  <circle cx="530" cy="90" r="34" fill="#F5F1E8" opacity=".55"/>
</svg>
`;
}

export const COVER_KINDS = Object.keys(COVER_THEMES);

/* Telefon çerçevesi */
export function phone(src, alt, cls = '') {
  return `<figure class="phone ${cls}">
  <div class="phone-frame">
    <span class="phone-notch"></span>
    <img src="${esc(src)}" alt="${esc(alt)}" width="390" height="844" loading="lazy" decoding="async"/>
  </div>
  ${alt ? `<figcaption>${esc(alt)}</figcaption>` : ''}
</figure>`;
}

/* Yükseklik profili: [[km, m], ...] */
export function elevationProfile(profile, { t, locale, id = 'ep' } = {}) {
  if (!profile || profile.length < 2) return '';
  const W = 720;
  const H = 200;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const kms = profile.map((p) => p[0]);
  const eles = profile.map((p) => p[1]);
  const maxKm = Math.max(...kms) || 1;
  let minE = Math.min(...eles);
  let maxE = Math.max(...eles);
  if (maxE - minE < 50) {
    maxE = minE + 50;
  }
  const span = maxE - minE;
  const x = (km) => padL + (km / maxKm) * (W - padL - padR);
  const y = (e) => padT + (1 - (e - minE) / span) * (H - padT - padB);
  const pts = profile.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${x(maxKm).toFixed(1)},${(H - padB).toFixed(1)} L${padL},${(H - padB).toFixed(1)} Z`;
  const fmt = (n) => new Intl.NumberFormat(locale ?? 'tr-TR').format(Math.round(n));
  const yTicks = [minE, minE + span / 2, maxE];
  const xTicks = [0, maxKm / 4, maxKm / 2, (3 * maxKm) / 4, maxKm];
  const label = t ? t('common.elevationProfile') : 'Elevation profile';
  return `<svg class="elev" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
  <defs>
    <linearGradient id="${id}-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".45"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".04"/></linearGradient>
  </defs>
  ${yTicks
    .map(
      (e) =>
        `<line x1="${padL}" x2="${W - padR}" y1="${y(e).toFixed(1)}" y2="${y(e).toFixed(1)}" class="elev-grid"/><text x="${padL - 6}" y="${(y(e) + 4).toFixed(1)}" class="elev-label" text-anchor="end">${fmt(e)}</text>`,
    )
    .join('')}
  ${xTicks
    .map(
      (km) =>
        `<text x="${x(km).toFixed(1)}" y="${H - 10}" class="elev-label" text-anchor="middle">${km >= 10 ? fmt(km) : (Math.round(km * 10) / 10).toString().replace('.', locale === 'tr-TR' ? ',' : '.')} km</text>`,
    )
    .join('')}
  <path d="${area}" fill="url(#${id}-fill)"/>
  <path d="${line}" class="elev-line"/>
</svg>`;
}

/* QR yer tutucu (deterministik desen) */
export function qrPlaceholder(label) {
  const cells = [];
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  for (let yy = 0; yy < 21; yy += 1) {
    for (let xx = 0; xx < 21; xx += 1) {
      const finder = (xx < 7 && yy < 7) || (xx > 13 && yy < 7) || (xx < 7 && yy > 13);
      if (finder) {
        const fx = xx % 14;
        const fy = yy % 14;
        const on =
          fx === 0 ||
          fx === 6 ||
          fy === 0 ||
          fy === 6 ||
          (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
        if (on) cells.push(`<rect x="${xx}" y="${yy}" width="1" height="1"/>`);
      } else if (rnd() > 0.55) {
        cells.push(`<rect x="${xx}" y="${yy}" width="1" height="1"/>`);
      }
    }
  }
  return `<svg class="qr" viewBox="-1 -1 23 23" role="img" aria-label="${esc(label)}"><rect x="-1" y="-1" width="23" height="23" fill="#fff"/><g fill="#10201B">${cells.join('')}</g></svg>`;
}

/* Mağaza rozetleri */
export function storeBadges({ t, ios, android, cls = '' }) {
  return `<div class="stores ${cls}">
  <a class="store" href="${esc(ios)}" rel="noopener" hreflang="x-default">
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.365 1.43c0 1.14-.42 2.2-1.24 3.1-.98 1.08-2.16 1.7-3.36 1.6-.04-1.1.44-2.2 1.24-3.06.87-.98 2.24-1.7 3.36-1.64zM20.9 17.2c-.6 1.38-.9 1.99-1.68 3.2-1.08 1.66-2.6 3.72-4.5 3.74-1.68.02-2.12-1.1-4.4-1.08-2.28.02-2.76 1.1-4.44 1.08-1.9-.02-3.34-1.86-4.42-3.52C-1.6 16.06-.9 9.96 2.6 7.32c1.68-1.34 3.74-1.34 5.02-.66 1.06.56 1.66.7 2.7.02 1.34-.82 3.48-1.36 5.38.2-.76.46-2.5 1.62-2.48 4.1.02 2.94 2.58 4.16 2.68 4.22-.02.06-.34.9-1 2z"/></svg>
    <span><small>${esc(t('common.comingSoon'))}</small>${esc(t('home.storeIos'))}</span>
  </a>
  <a class="store" href="${esc(android)}" rel="noopener" hreflang="x-default">
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3.6 1.8 13.3 12 3.6 22.2c-.3-.2-.5-.6-.5-1V2.8c0-.4.2-.8.5-1zm11 8.9L5.4 1.4l10.4 6c.3.2.6.4.8.6l-2 2.7zm2.9 2.9L21 11.6c.7.4.7 1.4 0 1.8l-3.5 2-2.4-2.4 2.4-2.4zm-2.9 2.9 2 2.7c-.2.2-.5.4-.8.6l-10.4 6 9.2-9.3z"/></svg>
    <span><small>${esc(t('common.comingSoon'))}</small>${esc(t('home.storeAndroid'))}</span>
  </a>
</div>`;
}
