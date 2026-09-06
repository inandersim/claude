/** Metin yardımcıları: slug, kısaltma, hashtag seti, deterministik varyant seçimi. */

const TR_MAP = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', İ: 'i', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' };

/** Türkçe/Kiril/Almanca karakterleri sadeleştirip slug üretir. */
export function slugify(input) {
  return String(input)
    .replace(/[çğıöşüİÇĞÖŞÜ]/gu, (c) => TR_MAP[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

/** FNV-1a 32 bit — deterministik varyant seçimi için (rastgelelik yok). */
export function hash32(input) {
  let h = 0x811c9dc5;
  const s = String(input);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Aynı tohumla her zaman aynı öğe — "şablon kokusu"nu kıran varyant havuzu seçicisi. */
export function pick(seed, list) {
  if (list.length === 0) throw new Error('pick: boş liste');
  return list[hash32(seed) % list.length];
}

/** Tohuma göre n öğe (tekrarsız, deterministik). */
export function pickMany(seed, list, n) {
  const out = [];
  const pool = [...list];
  let h = hash32(seed);
  while (out.length < Math.min(n, list.length)) {
    h = (Math.imul(h, 0x01000193) + 0x9e3779b9) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}

/** Kelime sınırında keser, sona "…" ekler. */
export function truncate(text, max) {
  const t = String(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, Math.max(0, max - 1));
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function normalizeHashtag(tag) {
  const t = String(tag).trim().replace(/^#+/u, '').replace(/\s+/gu, '');
  return t ? `#${t}` : '';
}

/** Tekilleştirilmiş, sınırlanmış hashtag listesi. */
export function hashtagSet(tags, max) {
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const tag = normalizeHashtag(raw);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase('tr');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

/** Karakter sayısı (emoji ve Kiril dâhil kod noktası bazlı). */
export function charCount(text) {
  return [...String(text)].length;
}

/**
 * Satırları birleştirir: `null`/`undefined` atılır, boş satır korunur (Markdown paragrafı),
 * üst üste gelen boş satırlar tek boş satıra indirilir.
 */
export function lines(...parts) {
  return parts
    .flat()
    .filter((l) => l !== undefined && l !== null)
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/** Markdown tablo üretir. */
export function mdTable(header, rows) {
  const esc = (v) => String(v ?? '').replace(/\|/gu, '\\|').replace(/\n/gu, ' ');
  return [
    `| ${header.map(esc).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
  ].join('\n');
}

/** Sayıyı yerel biçimde yazar (1234 → "1.234"). */
export function num(n, lang = 'tr') {
  const locale = { tr: 'tr-TR', en: 'en-US', de: 'de-DE', ru: 'ru-RU' }[lang] ?? 'tr-TR';
  return new Intl.NumberFormat(locale).format(Math.round(Number(n) || 0));
}

/** Yüzde (0.0345 → "%3,5" / "3.5%"; negatifte Türkçe "-%3,5"). */
export function pct(value, lang = 'tr', digits = 1) {
  const v = (Number(value) || 0) * 100;
  const sign = v < 0 ? '-' : '';
  const s = Math.abs(v).toFixed(digits).replace('.', lang === 'en' ? '.' : ',');
  return lang === 'tr' ? `${sign}%${s}` : `${sign}${s}%`;
}

/** Dakika → "4 sa 20 dk" / "4h 20m". */
export function duration(min, lang = 'tr') {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (lang === 'en') return h > 0 ? `${h}h ${m}m` : `${m}m`;
  if (lang === 'de') return h > 0 ? `${h} Std ${m} Min` : `${m} Min`;
  if (lang === 'ru') return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
  return h > 0 ? `${h} sa ${m} dk` : `${m} dk`;
}
