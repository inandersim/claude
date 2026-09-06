import { fetchWithRetry } from './http.js';

/**
 * Wikivoyage (CC BY-SA 3.0) seyahat rehberlerini destinasyon taslağına dönüştürür.
 * "Get in" → ulaşım, "Sleep" → konaklama/kamp, "Do" → aktiviteler, "Stay safe" → güvenlik,
 * "Fees and permits" → izinler, "Understand" → özet.
 */

export const WIKIVOYAGE_API = (lang) => `https://${lang}.wikivoyage.org/w/api.php`;

/** Bölüm başlığı → destinasyon alanı eşlemesi (İngilizce ve Türkçe başlıklar). */
export const SECTION_MAP = {
  understand: 'summary',
  anlayın: 'summary',
  'get in': 'transport',
  ulaşım: 'transport',
  'get around': 'transport',
  'fees and permits': 'permits',
  'fees & permits': 'permits',
  izinler: 'permits',
  sleep: 'sleep',
  lodging: 'sleep',
  konaklama: 'sleep',
  do: 'activities',
  yapın: 'activities',
  'stay safe': 'safety',
  güvenlik: 'safety',
  'stay healthy': 'health',
  sağlık: 'health',
  prepare: 'gear',
  hazırlık: 'gear',
  eat: 'food',
  drink: 'food',
  connect: 'connectivity',
  climate: 'season',
  'when to go': 'season',
  'go next': 'nearby',
};

/** Wikitext'i sadeleştirir: şablonları, bağlantıları, biçimlendirmeyi düz metne çevirir. */
export function stripWikitext(text) {
  let s = text;
  // {{listing ...}} / {{sleep ...}} şablonları: name= ve content= alanlarını satıra çevir
  s = s.replace(/\{\{(?:listing|see|do|buy|eat|drink|sleep|go)\s*\|([^}]*)\}\}/gi, (_, body) => {
    const fields = Object.fromEntries(
      body
        .split('|')
        .map((f) => f.split('=').map((x) => x.trim()))
        .filter((kv) => kv.length === 2)
        .map(([k, v]) => [k.toLowerCase(), v]),
    );
    const bits = [fields.name, fields.alt, fields.price, fields.hours, fields.content]
      .filter(Boolean)
      .join(' · ');
    return bits ? `• ${bits}` : '';
  });
  s = s.replace(/\{\{[^{}]*\}\}/g, ''); // kalan şablonlar
  s = s.replace(/\{\{[^{}]*\}\}/g, '');
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  s = s.replace(/<ref[^>]*\/>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/\[\[(?:File|Image|Dosya):[^\]]*\]\]/gi, '');
  s = s.replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g, '$2');
  s = s.replace(/\[\[([^\]]*)\]\]/g, '$1');
  s = s.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1');
  s = s.replace(/'{2,}/g, '');
  s = s.replace(/^\*+\s?/gm, '• ');
  s = s.replace(/^#+\s?/gm, '');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/**
 * Wikitext'i `== Başlık ==` bölümlerine ayırır.
 * @returns {{ title: string; level: number; text: string }[]}
 */
export function splitSections(wikitext) {
  const lines = wikitext.split('\n');
  const sections = [];
  let current = { title: 'lead', level: 0, lines: [] };
  for (const line of lines) {
    const m = /^(={2,6})\s*(.+?)\s*\1\s*$/.exec(line);
    if (m) {
      sections.push({ title: current.title, level: current.level, text: current.lines.join('\n') });
      current = { title: m[2].trim(), level: m[1].length, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push({ title: current.title, level: current.level, text: current.lines.join('\n') });
  return sections;
}

/**
 * Bölümleri destinasyon alanlarına eşler; alt bölümler (===) üst bölüme katılır.
 * @param {string} wikitext
 * @returns {Record<string, string>}
 */
export function parseGuideSections(wikitext) {
  const out = {};
  let currentKey = null;
  for (const section of splitSections(wikitext)) {
    const key = SECTION_MAP[section.title.toLowerCase()];
    if (section.level <= 2) currentKey = key ?? null;
    else if (key) currentKey = key;
    const target = currentKey;
    const text = stripWikitext(section.text);
    if (!target || !text) continue;
    const head = section.level > 2 ? `${section.title}\n` : '';
    out[target] = [out[target], head + text].filter(Boolean).join('\n\n');
  }
  return out;
}

/** {{geo|lat|lon}} ya da {{mapframe|lat|lon}} şablonundan koordinat. */
export function parseCoords(wikitext) {
  const m =
    /\{\{(?:geo|mapframe)\s*\|\s*(-?\d+(?:\.\d+)?)\s*\|\s*(-?\d+(?:\.\d+)?)/i.exec(wikitext) ??
    /\|\s*lat\s*=\s*(-?\d+(?:\.\d+)?)\s*\|\s*long?\s*=\s*(-?\d+(?:\.\d+)?)/i.exec(wikitext);
  if (!m) return null;
  return { latitude: Number(m[1]), longitude: Number(m[2]) };
}

/**
 * Sayfayı destinasyon taslağına çevirir (editör onayı gerektirir).
 * @param {{ title: string; lang: string; wikitext: string; revision?: number }} page
 */
export function toDestinationDraft(page, now = new Date().toISOString()) {
  const sections = parseGuideSections(page.wikitext);
  const coords = parseCoords(page.wikitext);
  const slug = page.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const guide = [
    'transport',
    'season',
    'permits',
    'sleep',
    'activities',
    'gear',
    'safety',
    'health',
    'connectivity',
    'food',
  ]
    .filter((k) => sections[k])
    .map((k) => `${GUIDE_HEADINGS[k]}\n${sections[k]}`)
    .join('\n\n');
  return {
    id: `wv_${page.lang}_${slug}`,
    slug,
    name: page.title,
    summary: (sections.summary ?? '').split('\n\n')[0]?.slice(0, 600) ?? '',
    guide,
    coords,
    sections,
    source: 'wikivoyage',
    sourceUrl: `https://${page.lang}.wikivoyage.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    license: 'CC BY-SA 3.0',
    attribution: `Wikivoyage katkıcıları — ${page.title} (CC BY-SA 3.0)`,
    revision: page.revision ?? null,
    status: 'draft',
    importedAt: now,
  };
}

const GUIDE_HEADINGS = {
  transport: 'Nasıl gidilir',
  season: 'Ne zaman',
  permits: 'İzinler ve ücretler',
  sleep: 'Konaklama ve kamp',
  activities: 'Neler yapılır',
  gear: 'Hazırlık ve ekipman',
  safety: 'Güvenlik',
  health: 'Sağlık',
  connectivity: 'Bağlantı',
  food: 'Yeme içme',
};

/** MediaWiki API'den sayfa wikitext'ini çeker. */
export async function fetchWikivoyagePage(title, lang = 'en') {
  const url = new URL(WIKIVOYAGE_API(lang));
  url.search = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'wikitext|revid',
    format: 'json',
    formatversion: '2',
    redirects: '1',
  }).toString();
  const res = await fetchWithRetry(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(`Wikivoyage: ${json.error.info ?? json.error.code}`);
  return {
    title: json.parse.title,
    lang,
    wikitext: json.parse.wikitext,
    revision: json.parse.revid,
  };
}

/** Kategoriye göre sayfa başlıklarını listeler (örn. "Hiking trails", "Category:Nepal"). */
export async function listCategoryPages(category, lang = 'en', limit = 200) {
  const url = new URL(WIKIVOYAGE_API(lang));
  url.search = new URLSearchParams({
    action: 'query',
    list: 'categorymembers',
    cmtitle: category.startsWith('Category:') ? category : `Category:${category}`,
    cmlimit: String(Math.min(limit, 500)),
    cmnamespace: '0',
    format: 'json',
    formatversion: '2',
  }).toString();
  const res = await fetchWithRetry(url.toString());
  const json = await res.json();
  return (json.query?.categorymembers ?? []).map((m) => m.title);
}
