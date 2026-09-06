/**
 * Şablon yardımcıları: kaçış, çeviri, URL üretimi, biçimlendirme.
 * Tüm şablonlar `ctx` nesnesi alır: { lang, t, url, site, data, ... }.
 */

export const SECTIONS = {
  home: { tr: '', en: '' },
  routes: { tr: 'rotalar', en: 'routes' },
  destinations: { tr: 'destinasyonlar', en: 'destinations' },
  places: { tr: 'yerler', en: 'places' },
  climbing: { tr: 'tirmanis', en: 'climbing' },
  courses: { tr: 'egitimler', en: 'courses' },
  pro: { tr: 'pro', en: 'pro' },
  community: { tr: 'topluluk', en: 'community' },
  safety: { tr: 'guvenlik', en: 'safety' },
  about: { tr: 'hakkimizda', en: 'about' },
  press: { tr: 'basin', en: 'press' },
  privacy: { tr: 'gizlilik', en: 'privacy' },
  kvkk: { tr: 'kvkk', en: 'kvkk' },
  download: { tr: 'indir', en: 'download' },
};

export const LANGS = ['tr', 'en'];

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Sözlükten iç içe anahtar okur: t('home.features.zmatch.title', {n: 3}). */
export function makeT(dict) {
  return function t(key, vars) {
    const value = key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), dict);
    if (value === undefined) return key;
    if (typeof value !== 'string' || !vars) return value;
    return value.replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
    );
  };
}

/** Dile göre bölüm yolu: url('tr','routes','kackar') → /rotalar/kackar/ */
export function makeUrl(basePath) {
  const base = basePath.replace(/\/$/, '');
  return function url(lang, section, slug) {
    const parts = [];
    if (lang !== 'tr') parts.push(lang);
    const sec = SECTIONS[section]?.[lang] ?? section;
    if (sec) parts.push(sec);
    if (slug) parts.push(slug);
    const p = parts.length ? `/${parts.join('/')}/` : '/';
    return `${base}${p}`;
  };
}

export function assetUrl(basePath, file) {
  return `${basePath.replace(/\/$/, '')}/${file.replace(/^\//, '')}`;
}

export function fmtNumber(n, locale, digits = 0) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
}

export function fmtKm(n, t, locale) {
  return `${fmtNumber(n, locale, n < 10 ? 1 : 0)} ${t('common.km')}`;
}

export function fmtM(n, t, locale) {
  return `${fmtNumber(Math.round(n), locale)} ${t('common.m')}`;
}

export function fmtDuration(min, t) {
  if (min == null) return '—';
  if (min >= 60 * 24 * 2) return `${Math.round(min / 60 / 8)} ${t('common.days')}`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} ${t('common.min')}`;
  return m ? `${h} ${t('common.hour')} ${m} ${t('common.min')}` : `${h} ${t('common.hour')}`;
}

export function fmtTry(n, locale) {
  return `₺${fmtNumber(n, locale)}`;
}

export function fmtDate(iso, locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(iso));
}

export function monthList(months, t, short = true) {
  const names = t(short ? 'monthsShort' : 'months');
  return months.map((m) => names[m - 1]).join(', ');
}

export function countryName(code, locale) {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function flag(code) {
  if (!code || code.length !== 2) return '';
  const A = 0x1f1e6;
  return String.fromCodePoint(A + code.charCodeAt(0) - 65, A + code.charCodeAt(1) - 65);
}

export function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

export function truncate(text, n = 160) {
  const s = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`;
}

/** "Başlık\nParagraf\n\nBaşlık\nParagraf" biçimindeki rehber metnini HTML'e çevirir. */
export function guideToHtml(text) {
  const blocks = String(text ?? '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split('\n');
      if (lines.length > 1 && lines[0].length < 60 && !/[.!?:]$/.test(lines[0])) {
        const id = slugifyText(lines[0]);
        return `<h3 id="g-${id}">${esc(lines[0])}</h3>${lines
          .slice(1)
          .map((l) => `<p>${esc(l)}</p>`)
          .join('')}`;
      }
      return lines.map((l) => `<p>${esc(l)}</p>`).join('');
    })
    .join('\n');
}

export function guideHeadings(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((b) => b.trim().split('\n'))
    .filter((lines) => lines.length > 1 && lines[0].length < 60 && !/[.!?:]$/.test(lines[0]))
    .map((lines) => ({ id: `g-${slugifyText(lines[0])}`, label: lines[0] }));
}

const TR_MAP = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  Ç: 'c',
  Ğ: 'g',
  İ: 'i',
  Ö: 'o',
  Ş: 's',
  Ü: 'u',
};
export function slugifyText(input) {
  return String(input)
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => TR_MAP[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function centerOf(points) {
  if (!points.length) return { lat: 39, lng: 35 };
  const lat = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const lng = points.reduce((a, p) => a + p.lng, 0) / points.length;
  return { lat, lng };
}

export const DIFFICULTY_COLORS = {
  beginner: '#2F9E6B',
  easy: '#7CB342',
  moderate: '#E0A300',
  hard: '#E8722A',
  extreme: '#D23F3F',
};
