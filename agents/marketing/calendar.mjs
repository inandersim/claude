#!/usr/bin/env node
/**
 * 12 haftalık lansman takvimi.
 *
 *   node calendar.mjs                       # sonraki Pazartesi'den 12 hafta
 *   node calendar.mjs --start 2026-10-05 --weeks 12 --launch-week 5
 *   node calendar.mjs --langs tr,en,ru --out out/calendar
 *
 * Üretir: `out/calendar/calendar.json` (hafta + slot ağacı), `calendar.md` (okunur plan),
 * `slots.csv` (tablo), kanal başına `.ics` (elle yayın hatırlatıcısı) ve
 * `repurposing.md` (bir çekim → sekiz çıktı zinciri).
 *
 * Faz mantığı: hazırlık → teaser → lansman haftası → ivme → ritim.
 */

import { listFlag, numberFlag, parseArgs, usage } from './lib/args.mjs';
import { BRAND, CONTENT_LANGS } from './lib/brand.mjs';
import { addDays, humanDate, isoDate, nextMonday, parseDate, weekdayTr } from './lib/dates.mjs';
import { outPath, toCsv, Writer } from './lib/fsx.mjs';
import { lines, mdTable, pick } from './lib/text.mjs';
import { CHANNELS, CHANNEL_IDS } from './channels/index.mjs';
import { toIcs } from './channels/base.mjs';
import { generateContent } from './content/engine.mjs';

/** Haftalık kanal hacmi — tek kişilik ekip için sürdürülebilir (bkz. docs/GROWTH.md §8). */
export const WEEKLY_CADENCE = {
  instagram: 4,
  tiktok: 3,
  youtube: 2,
  telegram: 5,
  x: 5,
  pinterest: 5,
  facebook: 2,
  vk: 2,
  reddit: 1,
  linkedin: 1,
};

/** Kanalın ana dili — içerik seçimi buna göre yapılır. */
const CHANNEL_LANG = {
  instagram: 'tr',
  tiktok: 'tr',
  youtube: 'en',
  telegram: 'tr',
  x: 'en',
  pinterest: 'en',
  facebook: 'tr',
  vk: 'ru',
  reddit: 'en',
  linkedin: 'en',
};

/** Gün tercihleri (0=Pazartesi … 6=Pazar) — kanalın kitlesi ne zaman açık. */
const CHANNEL_DAYS = {
  instagram: [1, 3, 5, 6],
  tiktok: [0, 2, 4],
  youtube: [3, 6],
  telegram: [0, 1, 2, 3, 4],
  x: [0, 1, 2, 3, 4],
  pinterest: [1, 2, 3, 5, 6],
  facebook: [2, 5],
  vk: [1, 4],
  reddit: [2],
  linkedin: [1],
};

/** 12 haftanın faz iskeleti; lansman haftası `--launch-week` ile kayar. */
export const PHASES = [
  {
    id: 'foundation',
    label: 'Temel',
    weeks: 2,
    theme: 'Hesaplar, bio, ilk içerik seti ve topluluk dinleme',
    goal: 'Her kanalda yayın hattı çalışır durumda; ilk 9 gönderi ve 3 topluluk teması',
    focus: ['instagram', 'telegram', 'x', 'pinterest'],
    kpi: [
      { metric: 'takipçi (IG)', target: 300 },
      { metric: 'Telegram abone', target: 100 },
      { metric: 'içerik hattı (hafta)', target: 25 },
    ],
    tasks: [
      'Profil, bio ve tek bağlantı (zirtan.app/ig) her kanalda hazır; UTM şeması test edildi.',
      'Reddit hesabı yaş/karma eşiğine hazırlanıyor: günde 10 dakika değerli yorum.',
      'Facebook gruplarına katıl, kuralları oku; ilk iki hafta yalnızca yorum.',
      'Pinterest panoları: Türkiye trekking, Nepal, kamp ekipmanı, dağda güvenlik.',
    ],
  },
  {
    id: 'teaser',
    label: 'Teaser',
    weeks: 2,
    theme: 'Geri sayım, kapalı test, kulüp ve rehber ortakları',
    goal: 'Lansman gününde tetiklenecek 20 ortak (kulüp + rehber + grup yöneticisi)',
    focus: ['instagram', 'telegram', 'tiktok', 'linkedin'],
    kpi: [
      { metric: 'ortak kulüp', target: 8 },
      { metric: 'Pro Guide adayı', target: 6 },
      { metric: 'bekleme listesi e-postası', target: 400 },
    ],
    tasks: [
      'Kulüp/rehber DM turu: haftada 10 mesaj, kişiselleştirilmiş (şablon değil).',
      '“Yakında” yerine işe yarar teaser: rota kartları ve ilk yardım serisi zaten yayında.',
      'Product Hunt hunter’ı ve ilk 20 yorumcuyu belirle; Show HN taslağını yaz.',
      'Basın listesi (20 isim) ve basın kiti sayfası (zirtan.app/basin) hazır.',
    ],
  },
  {
    id: 'launch',
    label: 'Lansman haftası',
    weeks: 1,
    theme: 'Uygulama canlı: duyuru, Product Hunt, Show HN, basın, ortak tetikleme',
    goal: 'Lansman gününde tüm kanallarda eşzamanlı duyuru + 500 kurulum',
    focus: CHANNEL_IDS,
    kpi: [
      { metric: 'kurulum (hafta)', target: 500 },
      { metric: 'Product Hunt sırası', target: 10 },
      { metric: 'basın/blog bağlantısı', target: 5 },
    ],
    tasks: [
      'Lansman günü Salı: 00:01 PT Product Hunt, 09:00 TRT tüm kanallar, 16:00 Show HN.',
      'Tüm yorumlara 10 dakika içinde yanıt (reply taslakları hazır).',
      'Ortaklar (kulüp/rehber/grup) aynı gün kendi kanallarında paylaşır.',
      'Mağaza sürüm notu, basın bülteni (tr/en) ve e-posta duyurusu aynı saatte.',
    ],
  },
  {
    id: 'momentum',
    label: 'İvme',
    weeks: 3,
    theme: 'UGC, Rusça açılım, kulüp etkinlikleri, rehber ortaklıkları',
    goal: 'Organik döngü: kullanıcı içeriği ve davet zinciri kendi başına dönüyor',
    focus: ['instagram', 'vk', 'telegram', 'tiktok', 'reddit'],
    kpi: [
      { metric: 'UGC gönderisi (hafta)', target: 2 },
      { metric: 'VK üye', target: 400 },
      { metric: 'davet başına kurulum', target: 0.3 },
    ],
    tasks: [
      'Haftada 2 UGC: yazılı izin, @atıf, “izinle paylaşıldı” ibaresi.',
      'Rusça içerik haftası: Likya Yolu ve Kapadokya uzun gönderileri + VK Clips.',
      '“Güvenli dağ günü” kulüp atölyesi; her etkinlikten 1 Reel + 1 karusel.',
      'Reddit: yalnızca trip report ve soru cevaplama; ürün adı geçmiyor.',
    ],
  },
  {
    id: 'rhythm',
    label: 'Ritim ve ölçüm',
    weeks: 4,
    theme: 'Kazanan biçimleri iki katına çıkar, kaybedeni kes, sezon içeriğine geç',
    goal: 'Haftalık rapor kararları uygular: %5 üstü etkileşim biçimi 2×, %2 altı kesilir',
    focus: ['instagram', 'youtube', 'telegram', 'pinterest', 'x'],
    kpi: [
      { metric: 'WAU', target: 1500 },
      { metric: 'aktivasyon (7 gün içinde eşleşme/rota)', target: 0.35 },
      { metric: 'K faktörü', target: 0.4 },
    ],
    tasks: [
      'Pazartesi `report.mjs` → karar; Salı çekim; Çarşamba yayın; Perşembe ortaklık.',
      'En iyi 10 içeriği yeniden yayınla (Pinterest ve Shorts’ta ceza yok).',
      'ASO metinlerini ayda bir değiştir; A/B için tek değişken.',
      'Kışa hazırlık serisi: çığ, hipotermi, kısa gün planlaması.',
    ],
  },
];

/** Faz iskeletini hafta hafta açar. */
export function expandPhases(weeks, launchWeek) {
  const order = [];
  for (const phase of PHASES) {
    for (let i = 0; i < phase.weeks; i += 1) order.push(phase);
  }
  // Lansman fazını istenen haftaya kaydır.
  const currentLaunch = order.findIndex((p) => p.id === 'launch') + 1;
  if (launchWeek !== currentLaunch) {
    const launch = order.splice(currentLaunch - 1, 1)[0];
    order.splice(Math.max(0, Math.min(order.length, launchWeek - 1)), 0, launch);
  }
  while (order.length < weeks) order.push(PHASES[PHASES.length - 1]);
  return order.slice(0, weeks);
}

/** Hafta içi slotları üretir; içerik havuzundan sırayla atar. */
function weekSlots(weekNo, monday, phase, pool, cursor) {
  const slots = [];
  for (const channelId of CHANNEL_IDS) {
    const cadence = WEEKLY_CADENCE[channelId] ?? 1;
    const spec = CHANNELS[channelId].spec;
    const days = CHANNEL_DAYS[channelId] ?? [0, 2, 4];
    const lang = CHANNEL_LANG[channelId] ?? 'tr';
    const langPool = pool[lang]?.length ? pool[lang] : pool.tr;
    for (let n = 0; n < cadence; n += 1) {
      const dayOffset = days[n % days.length] + (n >= days.length ? 1 : 0);
      const date = isoDate(addDays(monday, Math.min(6, dayOffset)));
      const times = spec.bestTimes[lang] ?? spec.bestTimes.tr;
      const content = langPool[cursor.i % langPool.length];
      cursor.i += 1;
      slots.push({
        week: weekNo,
        phase: phase.id,
        date,
        weekday: weekdayTr(parseDate(date)),
        time: times[n % times.length],
        channel: channelId,
        lang,
        format: spec.formats.includes(content.format) ? content.format : spec.formats[0],
        contentId: content.id,
        title: content.title,
        archetype: content.archetype,
        objective: phase.id === 'launch' ? 'acquisition' : n === 0 ? 'awareness' : 'community',
        launchDay: false,
      });
    }
  }
  slots.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date < b.date ? -1 : 1));
  return slots;
}

/** Lansman haftasına özel slotlar (duyuru dizisi). */
function launchDaySlots(monday) {
  const day = isoDate(addDays(monday, 1)); // Salı
  const plan = [
    { time: '10:01', channel: 'x', note: 'Product Hunt canlı — ilk tweet zinciri (00:01 PT)' },
    { time: '09:00', channel: 'instagram', note: 'Duyuru karuseli + story serisi' },
    { time: '09:05', channel: 'telegram', note: 'Kanal duyurusu + anket' },
    { time: '09:10', channel: 'facebook', note: 'Sayfa gönderisi; gruplara yalnızca soru gelirse' },
    { time: '09:20', channel: 'vk', note: 'Rusça duyuru gönderisi' },
    { time: '11:00', channel: 'linkedin', note: 'Kurucu günlüğü + basın kiti bağlantısı' },
    { time: '12:00', channel: 'tiktok', note: '30 sn tanıtım videosu' },
    { time: '13:00', channel: 'youtube', note: 'Tanıtım videosu + Shorts kesiti' },
    { time: '16:00', channel: 'reddit', note: 'r/SideProject: “I built…” şeffaf gönderi' },
    { time: '17:00', channel: 'pinterest', note: 'Rehber pinleri (5 pano)' },
  ];
  return plan.map((p) => ({
    week: 0,
    phase: 'launch',
    date: day,
    weekday: weekdayTr(parseDate(day)),
    time: p.time,
    channel: p.channel,
    lang: CHANNEL_LANG[p.channel] ?? 'tr',
    format: CHANNELS[p.channel].spec.formats[0],
    contentId: `launch-${p.channel}`,
    title: `Lansman duyurusu — ${CHANNELS[p.channel].spec.label}`,
    archetype: 'launch',
    objective: 'acquisition',
    launchDay: true,
    note: p.note,
  }));
}

/** Takvimi kurar. */
export function buildCalendar(options = {}) {
  const start = options.start ? parseDate(options.start) : nextMonday(options.now ?? new Date());
  const weeks = options.weeks ?? 12;
  const launchWeek = options.launchWeek ?? 5;
  const langs = options.langs ?? CONTENT_LANGS;
  const content = generateContent({ langs, perArchetype: 4 });
  const pool = {};
  for (const lang of langs) pool[lang] = content.filter((c) => c.lang === lang);
  const phases = expandPhases(weeks, launchWeek);
  const cursor = { i: 0 };

  const out = [];
  for (let w = 1; w <= weeks; w += 1) {
    const monday = addDays(start, (w - 1) * 7);
    const phase = phases[w - 1];
    const slots = weekSlots(w, monday, phase, pool, cursor);
    if (w === launchWeek) {
      const extra = launchDaySlots(monday).map((s) => ({ ...s, week: w }));
      slots.push(...extra);
      slots.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date < b.date ? -1 : 1));
    }
    out.push({
      week: w,
      phase: phase.id,
      phaseLabel: phase.label,
      startDate: isoDate(monday),
      endDate: isoDate(addDays(monday, 6)),
      theme: phase.theme,
      goal: phase.goal,
      focusChannels: phase.focus,
      kpi: phase.kpi,
      tasks: phase.tasks,
      isLaunchWeek: w === launchWeek,
      slots,
    });
  }

  return {
    title: `${BRAND.name} — 12 haftalık lansman takvimi`,
    generatedAt: new Date().toISOString().slice(0, 10),
    startDate: isoDate(start),
    launchDate: isoDate(addDays(start, (launchWeek - 1) * 7 + 1)),
    weeks: out,
    cadence: WEEKLY_CADENCE,
    totalSlots: out.reduce((a, w) => a + w.slots.length, 0),
  };
}

/** Yeniden kullanım zinciri belgesi: bir çekimden çıkan sekiz çıktı. */
export function repurposingMarkdown() {
  return lines(
    '# Yeniden kullanım zinciri',
    '',
    'Kural: **bir çekim, sekiz çıktı.** Salı günü çekilen tek dikey video ile Çarşamba',
    'başlayan hafta beslenir; hiçbir kanal için ayrı çekim yapılmaz.',
    '',
    mdTable(
      ['Sıra', 'Kanal', 'Biçim', 'Ne değişir', 'Ne zaman'],
      [
        ['1', 'tiktok', 'short', 'Ana kurgu, gömülü altyazı, 15–35 sn', 'Çekimden 1 gün sonra'],
        ['2', 'youtube', 'short', 'Aynı dosya, başlıkta #Shorts, sabit yorumda bağlantı', 'Aynı gün +2 saat'],
        ['3', 'instagram', 'reel', 'Filigransız dosya, kapak karesi ayrı tasarlanır', 'Ertesi gün'],
        ['4', 'vk', 'short', 'Rusça altyazı, Clips olarak', 'Ertesi gün'],
        ['5', 'x', 'thread', 'Videonun metin hâli: 4–6 halka, son halkada bağlantı', '+2 gün'],
        ['6', 'telegram', 'text', 'Kart özeti + anket', '+2 gün'],
        ['7', 'pinterest', 'single_image', 'Dikey kapak (1000×1500) + rehber bağlantısı', '+3 gün'],
        ['8', 'reddit', 'text', 'Uzun trip report; ürün adı geçmez', '+4 gün (haftada 1)'],
      ],
    ),
    '',
    '## Metin içerikler için zincir',
    '',
    mdTable(
      ['Sıra', 'Kanal', 'Biçim', 'Not'],
      [
        ['1', 'instagram', 'carousel', '6–8 kare; ilk kare manzara, son kare CTA'],
        ['2', 'facebook', 'single_image', 'Albüm + uzun metin; gruplarda link yok'],
        ['3', 'telegram', 'text', '700 karakter kart'],
        ['4', 'vk', 'text', 'Rusça uzun gönderi (fiyatlar ₺ ve ₽)'],
        ['5', 'pinterest', 'single_image', 'Arama başlıklı pin, panoya göre'],
        ['6', 'x', 'thread', 'Sayılarla zincir'],
        ['7', 'linkedin', 'text', 'Kurucu günlüğü (haftada 1)'],
        ['8', 'blog', 'seo', 'zirtan.app/rehber/<slug> — SSS ve iç bağlantılarla'],
      ],
    ),
    '',
    '## Kural',
    '',
    '- Aynı metin iki kanala **aynen** gitmez: uzunluk, ton ve hashtag kanal biçimlendiricisinden geçer.',
    '- Aynı içerik 6 hafta sonra yeniden yayınlanabilir (Pinterest ve Shorts bunu cezalandırmaz).',
    '- Reddit ve Facebook gruplarında paylaşım, o başlıktaki soruya cevap değilse yapılmaz.',
  );
}

function calendarMarkdown(cal) {
  const weekBlocks = cal.weeks.flatMap((w) => [
    `## Hafta ${w.week} · ${w.phaseLabel}${w.isLaunchWeek ? ' — LANSMAN' : ''} (${humanDate(w.startDate)} – ${humanDate(w.endDate)})`,
    '',
    `**Tema:** ${w.theme}`,
    '',
    `**Hedef:** ${w.goal}`,
    '',
    `**Odak kanallar:** ${w.focusChannels.join(', ')}`,
    '',
    `**KPI:** ${w.kpi.map((k) => `${k.metric} → ${k.target}`).join(' · ')}`,
    '',
    '**İşler**',
    '',
    ...w.tasks.map((t) => `- ${t}`),
    '',
    mdTable(
      ['Gün', 'Saat', 'Kanal', 'Biçim', 'Dil', 'İçerik'],
      w.slots.map((s) => [`${s.date} ${s.weekday}`, s.time, s.channel, s.format, s.lang, s.note ?? s.title]),
    ),
    '',
  ]);

  return lines(
    `# ${cal.title}`,
    '',
    `Başlangıç: ${humanDate(cal.startDate)} · Lansman günü: **${humanDate(cal.launchDate)}** · ${cal.weeks.length} hafta · ${cal.totalSlots} gönderi slotu`,
    '',
    'Saatler Europe/Istanbul. Slotlar kanal kadansına ve en iyi saatlere göre üretildi;',
    'içerikler `content/engine.mjs` çıktısından atandı. Değiştirmek serbest — takvim öneridir, emir değil.',
    '',
    '## Haftalık hacim',
    '',
    mdTable(
      ['Kanal', 'Hafta', 'Ana dil', 'Günler'],
      CHANNEL_IDS.map((id) => [id, WEEKLY_CADENCE[id], CHANNEL_LANG[id], (CHANNEL_DAYS[id] ?? []).map((d) => weekdayTr(parseDate('2026-01-05')) && ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][d]).join(', ')]),
    ),
    '',
    ...weekBlocks,
  );
}

export function main(argv = process.argv.slice(2)) {
  const { flags } = parseArgs(argv);
  if (flags.help) {
    console.log(
      usage('calendar.mjs — 12 haftalık lansman takvimi üretir', [
        '--start 2026-10-05     başlangıç Pazartesi (varsayılan: sonraki Pazartesi)',
        '--weeks 12             hafta sayısı',
        '--launch-week 5        lansman haftası',
        '--langs tr,en,de,ru    içerik dilleri',
        '--out <klasör>         çıktı klasörü (varsayılan out/calendar)',
      ]),
    );
    return 0;
  }
  const cal = buildCalendar({
    start: typeof flags.start === 'string' ? flags.start : undefined,
    weeks: numberFlag(flags.weeks, 12),
    launchWeek: numberFlag(flags['launch-week'], 5),
    langs: listFlag(flags.langs ?? flags.lang, CONTENT_LANGS),
  });

  const writer = new Writer();
  const dir = typeof flags.out === 'string' ? flags.out : outPath('calendar');
  writer.json(`${dir}/calendar.json`, cal);
  writer.text(`${dir}/calendar.md`, calendarMarkdown(cal));
  writer.text(`${dir}/repurposing.md`, repurposingMarkdown());
  const allSlots = cal.weeks.flatMap((w) => w.slots);
  writer.text(
    `${dir}/slots.csv`,
    toCsv(
      ['week', 'date', 'weekday', 'time', 'channel', 'lang', 'format', 'archetype', 'content_id', 'title'],
      allSlots.map((s) => [s.week, s.date, s.weekday, s.time, s.channel, s.lang, s.format, s.archetype, s.contentId, s.title]),
    ),
  );
  for (const id of CHANNEL_IDS) {
    const entries = allSlots
      .filter((s) => s.channel === id)
      .map((s) => ({ id: `${s.contentId}-${s.date}`, date: s.date, time: s.time, summary: `${CHANNELS[id].spec.label}: ${s.title}`, description: s.note ?? s.archetype }));
    if (entries.length > 0) writer.text(`${dir}/ics/${id}.ics`, toIcs(entries, `Zirtan · ${CHANNELS[id].spec.label}`));
  }

  console.log(`${cal.weeks.length} hafta · ${cal.totalSlots} slot · lansman günü ${cal.launchDate}`);
  console.log(writer.summary().slice(0, 5).join('\n'));
  console.log(`… toplam ${writer.count} dosya`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
