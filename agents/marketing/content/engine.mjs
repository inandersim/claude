#!/usr/bin/env node
/**
 * İçerik motoru: kütüphane verisinden (destinasyon, rota, tür, tarihi alan, kaya alanı,
 * yer, kulüp) dört dilde yayına hazır içerik üretir. Claude API çağrısı yoktur —
 * çıktı deterministiktir, aynı veri hep aynı metni verir.
 *
 *   node content/engine.mjs --langs tr,en,de,ru --limit 24
 *   node content/engine.mjs --archetypes first-10-minutes,itinerary --lang tr
 *   node content/engine.mjs --month 10 --json
 *
 * Çıktı: `out/content/content.json`, içerik başına `.md`, ve `out/content/README.md`.
 */

import { boolFlag, listFlag, numberFlag, parseArgs, usage } from '../lib/args.mjs';
import { BRAND, CONTENT_LANGS, CTAS, HASHTAGS, localTags, SAFETY_NOTE, utmLink } from '../lib/brand.mjs';
import { outPath, Writer } from '../lib/fsx.mjs';
import { hashtagSet, lines, pick, pickMany, slugify, truncate } from '../lib/text.mjs';
import { CHANNELS } from '../channels/index.mjs';
import { ARCHETYPE_IDS, getArchetype } from './archetypes.mjs';
import { looksTurkish } from './lexicon.mjs';
import { counts } from './sources.mjs';

/** Uzunluk → kanal eşlemesi: her kanal gövdenin hangi sürümünü alır? */
export const LENGTH_BY_CHANNEL = {
  x: 'short',
  tiktok: 'short',
  pinterest: 'short',
  instagram: 'medium',
  facebook: 'medium',
  telegram: 'medium',
  vk: 'long',
  linkedin: 'medium',
  reddit: 'long',
  youtube: 'long',
};

/** Arketip → önerilen biçim (kanal biçim listesiyle kesişir). */
const FORMAT_BY_ARCHETYPE = {
  itinerary: 'carousel',
  'first-10-minutes': 'short',
  'hazard-brief': 'carousel',
  'heritage-detour': 'single_image',
  'crag-guide': 'carousel',
  'season-window': 'carousel',
  'budget-permit': 'single_image',
  'route-card': 'single_image',
  'club-call': 'single_image',
  'place-card': 'single_image',
  'unesco-trail': 'long_video',
};

/** Yeniden kullanım zinciri: bir çekimden çıkan içerikler, sırayla. */
export function repurposeChain(item) {
  const isVideo = ['first-10-minutes', 'unesco-trail'].includes(item.archetype);
  const base = isVideo
    ? [
        { channel: 'tiktok', format: 'short', note: 'ana dikey video (15–35 sn), altyazı gömülü' },
        { channel: 'youtube', format: 'short', note: 'aynı dosya, başlıkta #Shorts' },
        { channel: 'instagram', format: 'reel', note: 'filigransız yükleme, kapak karesi ayrı' },
        { channel: 'vk', format: 'short', note: 'VK Clips, Rusça altyazı' },
        { channel: 'telegram', format: 'text', note: 'videonun metin özeti + bağlantı' },
        { channel: 'x', format: 'thread', note: 'aynı içeriğin 4–6 halkalı zinciri' },
        { channel: 'reddit', format: 'text', note: 'uzun sürüm, ürün adı geçmeden' },
        { channel: 'pinterest', format: 'single_image', note: 'dikey kapak + rehber bağlantısı' },
      ]
    : [
        { channel: 'instagram', format: 'carousel', note: 'ana karusel (6–8 kare)' },
        { channel: 'facebook', format: 'single_image', note: 'albüm + uzun metin' },
        { channel: 'telegram', format: 'text', note: 'kart biçimi, 700 karakter' },
        { channel: 'vk', format: 'text', note: 'Rusça uzun gönderi' },
        { channel: 'pinterest', format: 'single_image', note: '2:3 pin, arama başlığı' },
        { channel: 'x', format: 'thread', note: 'sayılarla zincir' },
        { channel: 'linkedin', format: 'text', note: 'kurucu günlüğü tonu (haftada 1)' },
        { channel: 'reddit', format: 'text', note: 'trip report / cevap olarak' },
      ];
  return base;
}

/** Arketip + dil + konu → tam içerik nesnesi. */
export function buildItem(archetype, subject, lang, options = {}) {
  const raw = archetype.build(subject, lang);
  const id = `${archetype.id}-${slugify(raw.subject.slug ?? raw.subject.name)}-${lang}`;
  const campaign = options.campaign ?? 'evergreen';
  const link = utmLink({
    path: options.path ?? `rehber/${raw.subject.slug ?? slugify(raw.subject.name)}`,
    source: options.source ?? 'social',
    campaign,
    content: id,
  });
  const tagPool = HASHTAGS[lang] ?? HASHTAGS.en;
  const hashtags = hashtagSet(
    [
      ...pickMany(`${id}-core`, tagPool.core, 3),
      ...pickMany(`${id}-niche`, tagPool.niche, 4),
      ...pickMany(`${id}-local`, localTags(raw.subject.country, lang), 3),
    ],
    12,
  );
  const cta = pick(id, CTAS[lang] ?? CTAS.en);
  const ignore = [raw.subject.name, subject.university, subject.name, subject.locationName, subject.region].filter(Boolean);
  const qa = [];
  if (lang !== 'tr') {
    for (const field of ['hook', 'short', 'medium', 'long']) {
      if (looksTurkish(raw[field], ignore)) qa.push(`${field}: Türkçe cümle sızıntısı — elle kontrol et`);
    }
  }
  for (const note of raw.translationNotes ?? []) qa.push(`çevrilmemiş veri satırı atlandı: "${truncate(note, 60)}"`);

  return {
    id,
    archetype: archetype.id,
    archetypeLabel: archetype.label,
    lang,
    subject: raw.subject,
    title: raw.title,
    hook: raw.hook,
    body: { short: raw.short, medium: raw.medium, long: raw.long },
    cta,
    link,
    hashtags,
    keywords: raw.keywords ?? [],
    safety: archetype.needsSafetyNote === true,
    safetyNote: archetype.needsSafetyNote ? SAFETY_NOTE[lang] ?? SAFETY_NOTE.en : '',
    visual: raw.visual,
    sources: raw.sources ?? [],
    format: FORMAT_BY_ARCHETYPE[archetype.id] ?? 'single_image',
    repurpose: repurposeChain({ archetype: archetype.id }),
    qa,
  };
}

/**
 * İçerik üretir.
 * @param {{langs?: string[], archetypes?: string[], limit?: number, month?: number, campaign?: string}} options
 */
export function generateContent(options = {}) {
  const langs = options.langs?.length ? options.langs : CONTENT_LANGS;
  const ids = options.archetypes?.length ? options.archetypes : ARCHETYPE_IDS;
  const perArchetype = options.perArchetype ?? 3;
  const items = [];
  for (const id of ids) {
    const archetype = getArchetype(id);
    let subjects = archetype.subjects();
    if (options.month && archetype.id === 'season-window') subjects = subjects.filter((s) => s.month === options.month);
    if (options.country) subjects = subjects.filter((s) => (s.countryCode ?? s.country ?? 'TR') === options.country);
    const chosen = subjects.slice(0, perArchetype);
    for (const subject of chosen) {
      for (const lang of langs) items.push(buildItem(archetype, subject, lang, options));
    }
  }
  return options.limit ? items.slice(0, options.limit) : items;
}

/** İçeriği belirli bir kanalın gönderi nesnesine çevirir (`channel.publish` girdisi). */
export function toPost(item, channelId, options = {}) {
  const channel = CHANNELS[channelId];
  if (!channel) throw new Error(`Bilinmeyen kanal: ${channelId}`);
  const length = LENGTH_BY_CHANNEL[channelId] ?? 'medium';
  const spec = channel.spec;
  const format = spec.formats.includes(item.format) ? item.format : spec.formats[0];
  return {
    id: `${channelId}-${item.id}`,
    contentId: item.id,
    channel: channelId,
    lang: item.lang,
    date: options.date ?? null,
    bestTime: options.bestTime ?? (spec.bestTimes[item.lang] ?? spec.bestTimes.tr)[0],
    format,
    title: item.title,
    body: item.body[length],
    cta: item.cta,
    link: utmLink({
      path: `rehber/${item.subject.slug}`,
      source: channelId,
      medium: options.medium ?? 'organic',
      campaign: options.campaign ?? 'evergreen',
      content: item.id,
    }),
    hashtags: item.hashtags,
    safety: item.safety,
    visual: item.visual,
    sources: item.sources,
    media: options.media ?? [],
    subreddit: options.subreddit,
  };
}

/** İçerik için Markdown dosyası (elle kullanım ve inceleme). */
export function itemMarkdown(item) {
  return lines(
    `# ${item.title}`,
    '',
    `- Arketip: ${item.archetypeLabel} (${item.archetype}) · Dil: ${item.lang} · Biçim: ${item.format}`,
    `- Konu: ${item.subject.kind} · ${item.subject.name}`,
    `- Bağlantı: ${item.link}`,
    item.safety ? `- Güvenlik içeriği: yasal not zorunlu` : null,
    '',
    '## Kanca',
    '',
    item.hook,
    '',
    '## Kısa (X · TikTok · Pinterest)',
    '',
    item.body.short,
    '',
    '## Orta (Instagram · Facebook · Telegram · LinkedIn)',
    '',
    item.body.medium,
    '',
    '## Uzun (Reddit · YouTube · VK · blog)',
    '',
    item.body.long,
    '',
    `## CTA\n\n${item.cta}`,
    '',
    `## Hashtag\n\n${item.hashtags.join(' ')}`,
    '',
    '## Görsel',
    '',
    item.visual.brief,
    item.visual.shots?.length ? `\nÇekim listesi:\n${item.visual.shots.map((s) => `- ${s}`).join('\n')}` : null,
    `\nOran: ${item.visual.aspect} · Alt metin: ${item.visual.alt}`,
    '',
    '## Yeniden kullanım zinciri',
    '',
    item.repurpose.map((r, i) => `${i + 1}. ${r.channel} (${r.format}) — ${r.note}`).join('\n'),
    '',
    '## Kaynak ve lisans',
    '',
    item.sources.map((s) => `- ${s}`).join('\n'),
    item.safetyNote ? `\n> ${item.safetyNote}` : null,
    item.qa.length ? `\n## QA\n\n${item.qa.map((q) => `- ${q}`).join('\n')}` : null,
  );
}

export function main(argv = process.argv.slice(2)) {
  const { flags } = parseArgs(argv);
  if (flags.help) {
    console.log(
      usage('İçerik motoru — kütüphane verisinden çok dilli içerik üretir', [
        '--langs tr,en,de,ru       üretilecek diller (varsayılan dördü)',
        '--archetypes a,b          arketip süzgeci (varsayılan hepsi)',
        `                          geçerli: ${ARCHETYPE_IDS.join(', ')}`,
        '--per-archetype 3         arketip başına konu sayısı',
        '--limit 24                toplam içerik sayısı',
        '--month 10                "season-window" arketipini bu aya sabitler',
        '--country TR              ülke süzgeci',
        '--json                    yalnızca JSON yaz (Markdown üretme)',
      ]),
    );
    return 0;
  }

  const items = generateContent({
    langs: listFlag(flags.langs ?? flags.lang, CONTENT_LANGS),
    archetypes: listFlag(flags.archetypes, ARCHETYPE_IDS),
    perArchetype: numberFlag(flags['per-archetype'], 3),
    limit: flags.limit ? numberFlag(flags.limit, 0) : 0,
    month: flags.month ? numberFlag(flags.month, 0) : 0,
    country: typeof flags.country === 'string' ? flags.country : undefined,
    campaign: typeof flags.campaign === 'string' ? flags.campaign : 'evergreen',
  });

  const writer = new Writer();
  const dir = typeof flags.out === 'string' ? flags.out : outPath('content');
  writer.json(`${dir}/content.json`, { generatedAt: new Date().toISOString().slice(0, 10), count: items.length, items });
  if (!boolFlag(flags.json, false)) {
    for (const item of items) writer.text(`${dir}/${item.lang}/${item.id}.md`, itemMarkdown(item));
  }

  const byArchetype = {};
  const byLang = {};
  for (const i of items) {
    byArchetype[i.archetype] = (byArchetype[i.archetype] ?? 0) + 1;
    byLang[i.lang] = (byLang[i.lang] ?? 0) + 1;
  }
  const qaCount = items.filter((i) => i.qa.length > 0).length;
  writer.text(
    `${dir}/README.md`,
    lines(
      '# Üretilen içerik',
      '',
      `${items.length} içerik · diller: ${Object.entries(byLang).map(([k, v]) => `${k} (${v})`).join(', ')}`,
      `Veri kümesi: ${Object.entries(counts()).map(([k, v]) => `${k} ${v}`).join(' · ')}`,
      qaCount ? `QA notu olan içerik: ${qaCount}` : 'QA notu yok.',
      '',
      '| # | Başlık | Arketip | Dil | Biçim |',
      '| --- | --- | --- | --- | --- |',
      ...items.map((i, n) => `| ${n + 1} | ${i.title.replace(/\|/gu, '·')} | ${i.archetype} | ${i.lang} | ${i.format} |`),
      '',
      `Marka: ${BRAND.name} · ${BRAND.site}`,
    ),
  );

  console.log(`${items.length} içerik üretildi (${Object.keys(byArchetype).length} arketip, ${Object.keys(byLang).length} dil).`);
  console.log(writer.summary().slice(0, 6).join('\n'));
  if (writer.count > 6) console.log(`… toplam ${writer.count} dosya`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
