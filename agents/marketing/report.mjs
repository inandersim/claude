#!/usr/bin/env node
/**
 * Haftalık büyüme raporu.
 *
 *   node report.mjs --input content/example-growth.csv
 *   node report.mjs --input metrics.csv --week 6 --targets targets.json
 *   node report.mjs --input metrics.csv --json
 *
 * Girdi: birleşik CSV (kanal metriklerinin elle ya da API ile dışa aktarılmış hâli).
 * Beklenen sütunlar (eksik olan 0 sayılır, adlar esnek):
 *   date, channel, post_id, format, reach, impressions, engagements, link_clicks,
 *   installs, signups, activations, followers_delta, invites_sent, invites_qualified
 *
 * Çıktı: `out/reports/week-NN.md` + `.json` + `trend.csv`.
 * Hedeften sapmada kural tabanlı öneri üretir (kes / iki katına çıkar / metni değiştir).
 */

import { readFileSync } from 'node:fs';

import { boolFlag, numberFlag, parseArgs, usage } from './lib/args.mjs';
import { outPath, parseCsv, readJson, toCsv, Writer } from './lib/fsx.mjs';
import { lines, mdTable, num, pct } from './lib/text.mjs';
import { CHANNEL_IDS } from './channels/index.mjs';

/** Sütun adı eş anlamlıları — Meta/TikTok/VK dışa aktarımları farklı adlar kullanır. */
const ALIASES = {
  date: ['date', 'tarih', 'day', 'дата', 'datum'],
  channel: ['channel', 'kanal', 'platform', 'network'],
  postId: ['post_id', 'gonderi', 'gönderi', 'id', 'post'],
  format: ['format', 'biçim', 'bicim', 'type'],
  reach: ['reach', 'erisim', 'erişim', 'unique_views', 'охват'],
  impressions: ['impressions', 'gosterim', 'gösterim', 'views', 'просмотры', 'plays'],
  engagements: ['engagements', 'etkilesim', 'etkileşim', 'interactions', 'likes_total'],
  clicks: ['link_clicks', 'clicks', 'tiklama', 'tıklama', 'переходы', 'outbound_clicks'],
  installs: ['installs', 'kurulum', 'downloads', 'установки'],
  signups: ['signups', 'kayit', 'kayıt', 'registrations'],
  activations: ['activations', 'aktivasyon', 'activated'],
  followers: ['followers_delta', 'takipci', 'takipçi', 'new_followers', 'subscribers_delta'],
  invitesSent: ['invites_sent', 'davet', 'invites'],
  invitesQualified: ['invites_qualified', 'nitelikli_davet', 'qualified'],
};

function field(row, key) {
  for (const name of ALIASES[key]) {
    if (row[name] !== undefined && row[name] !== '') return row[name];
  }
  return '';
}

const n = (v) => {
  const x = Number(String(v).replace(/[%\s]/gu, '').replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
};

/** CSV satırlarını normalleştirir. */
export function normalizeRows(rows) {
  return rows.map((r) => ({
    date: String(field(r, 'date')),
    channel: String(field(r, 'channel')).toLowerCase(),
    postId: String(field(r, 'postId')),
    format: String(field(r, 'format')),
    reach: n(field(r, 'reach')),
    impressions: n(field(r, 'impressions')),
    engagements: n(field(r, 'engagements')),
    clicks: n(field(r, 'clicks')),
    installs: n(field(r, 'installs')),
    signups: n(field(r, 'signups')),
    activations: n(field(r, 'activations')),
    followers: n(field(r, 'followers')),
    invitesSent: n(field(r, 'invitesSent')),
    invitesQualified: n(field(r, 'invitesQualified')),
  }));
}

const sum = (rows, key) => rows.reduce((a, r) => a + (r[key] ?? 0), 0);

/** Toplamlar ve türetilmiş oranlar. */
export function aggregate(rows) {
  const reach = sum(rows, 'reach');
  const clicks = sum(rows, 'clicks');
  const installs = sum(rows, 'installs');
  const signups = sum(rows, 'signups');
  const activations = sum(rows, 'activations');
  const invitesSent = sum(rows, 'invitesSent');
  const invitesQualified = sum(rows, 'invitesQualified');
  return {
    posts: rows.length,
    reach,
    impressions: sum(rows, 'impressions'),
    engagements: sum(rows, 'engagements'),
    clicks,
    installs,
    signups,
    activations,
    followers: sum(rows, 'followers'),
    invitesSent,
    invitesQualified,
    engagementRate: reach > 0 ? sum(rows, 'engagements') / reach : 0,
    ctr: reach > 0 ? clicks / reach : 0,
    installPerClick: clicks > 0 ? installs / clicks : 0,
    signupRate: installs > 0 ? signups / installs : 0,
    activationRate: signups > 0 ? activations / signups : 0,
    inviteQualifyRate: invitesSent > 0 ? invitesQualified / invitesSent : 0,
    kFactor: installs > 0 ? invitesQualified / installs : 0,
  };
}

/** Kanal ve biçim kırılımları. */
export function breakdown(rows, key) {
  const groups = new Map();
  for (const r of rows) {
    const k = r[key] || '—';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups.entries()]
    .map(([name, group]) => ({ name, ...aggregate(group) }))
    .sort((a, b) => b.reach - a.reach);
}

/** Varsayılan haftalık hedefler (docs/GROWTH.md §4–5 ile aynı mantık). */
export const DEFAULT_TARGETS = {
  reach: 40_000,
  clicks: 1200,
  installs: 300,
  activations: 60,
  engagementRate: 0.03,
  ctr: 0.02,
  installPerClick: 0.15,
  activationRate: 0.35,
  kFactor: 0.4,
};

/** Kural tabanlı öneriler — sapmaya göre ne yapılacağını söyler. */
export function recommend(now, previous, byChannel, byFormat, targets = DEFAULT_TARGETS) {
  const out = [];
  const push = (priority, area, action, why) => out.push({ priority, area, action, why });

  if (now.engagementRate < targets.engagementRate) {
    push(
      'high',
      'içerik',
      'Kancayı değiştir: ilk satır soru ya da sayı olsun; karusel ilk karesini manzaradan ekrana çevir.',
      `Etkileşim oranı ${pct(now.engagementRate)}, hedef ${pct(targets.engagementRate)}.`,
    );
  }
  if (now.ctr < targets.ctr) {
    push('high', 'CTA', 'CTA’yı tek eyleme indir ve bağlantıyı ilk yoruma/bio’ya taşı; bağlantı metnini kısalt.', `Tıklama oranı ${pct(now.ctr)}, hedef ${pct(targets.ctr)}.`);
  }
  if (now.installPerClick < targets.installPerClick) {
    push(
      'high',
      'landing/ASO',
      'Mağaza ekran görüntüsü ve alt başlığı değiştir (`node aso.mjs`); landing sayfasında ilk ekranı sadeleştir.',
      `Tıklama → kurulum ${pct(now.installPerClick)}, hedef ${pct(targets.installPerClick)}.`,
    );
  }
  if (now.activationRate < targets.activationRate) {
    push(
      'high',
      'ilk deneyim',
      'Onboarding’de ilk 5 dakikada bir rota indirtme ve acil kişi ekletme adımı öne alınsın.',
      `Aktivasyon ${pct(now.activationRate)}, hedef ${pct(targets.activationRate)}.`,
    );
  }
  if (now.kFactor < targets.kFactor) {
    push(
      'medium',
      'referans',
      'Paylaşım düğmesini rota tamamlama ve rozet ekranına taşı; davet metnini kısalt (`node referral.mjs`).',
      `K faktörü ${now.kFactor.toFixed(2)}, hedef ${targets.kFactor}.`,
    );
  }

  for (const ch of byChannel) {
    if (ch.posts >= 2 && ch.engagementRate < 0.02) {
      push('medium', `kanal:${ch.name}`, 'İki hafta üst üste %2 altındaysa bu kanalda biçimi değiştir ya da hacmi yarıya indir.', `Etkileşim ${pct(ch.engagementRate)} (${ch.posts} gönderi).`);
    }
    if (ch.engagementRate > 0.05 && ch.reach > 0) {
      push('high', `kanal:${ch.name}`, 'Kazanan kanal: haftalık hacmi iki katına çıkar, en iyi gönderiyi 6 hafta sonra yeniden yayınla.', `Etkileşim ${pct(ch.engagementRate)}.`);
    }
  }

  const bestFormat = byFormat[0];
  if (bestFormat && byFormat.length > 1) {
    push('medium', 'biçim', `“${bestFormat.name}” biçimini haftada bir artır; en zayıf biçimi (${byFormat[byFormat.length - 1].name}) bırak.`, `${bestFormat.name} erişimi ${num(bestFormat.reach)}.`);
  }

  if (previous) {
    const delta = previous.reach > 0 ? (now.reach - previous.reach) / previous.reach : 0;
    if (delta < -0.2) {
      push('high', 'hacim', 'Erişim düşüşü: yayın sıklığı ve saatleri takvimle uyuşuyor mu kontrol et (`node calendar.mjs`).', `Erişim geçen haftaya göre ${pct(delta)}.`);
    } else if (delta > 0.3) {
      push('low', 'hacim', 'Yükselişi tetikleyen içeriği tespit et ve serisini kur (3 bölüm).', `Erişim geçen haftaya göre +${pct(delta)}.`);
    }
  }

  if (out.length === 0) push('low', 'genel', 'Hedeflerin üstündesin: hacmi artırmadan önce aktivasyonu ölç.', 'Tüm metrikler hedefte.');
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 12);
}

/** Tarihleri ISO haftasına böler. */
export function groupByWeek(rows) {
  const weeks = new Map();
  for (const r of rows) {
    const d = new Date(`${r.date}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) continue;
    const target = new Date(d);
    target.setUTCDate(target.getUTCDate() - ((target.getUTCDay() + 6) % 7));
    const key = target.toISOString().slice(0, 10);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(r);
  }
  return [...weeks.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([start, group]) => ({ start, rows: group }));
}

function reportMarkdown({ week, weekNo, now, previous, byChannel, byFormat, recommendations, targets }) {
  const trend = (key) => {
    if (!previous || !previous[key]) return '—';
    const d = (now[key] - previous[key]) / previous[key];
    return `${d >= 0 ? '+' : ''}${pct(d)}`;
  };
  const status = (value, target, invert = false) => {
    const ok = invert ? value <= target : value >= target;
    return ok ? 'hedefte' : 'altında';
  };

  return lines(
    `# Büyüme raporu — ${weekNo}. hafta (${week.start} başlangıçlı)`,
    '',
    `${now.posts} gönderi · ${num(now.reach)} erişim · ${num(now.installs)} kurulum · ${num(now.activations)} aktivasyon`,
    '',
    '## Huni',
    '',
    mdTable(
      ['Adım', 'Değer', 'Oran', 'Hedef', 'Durum', 'Geçen haftaya göre'],
      [
        ['Erişim', num(now.reach), '—', num(targets.reach), status(now.reach, targets.reach), trend('reach')],
        ['Etkileşim', num(now.engagements), pct(now.engagementRate), pct(targets.engagementRate), status(now.engagementRate, targets.engagementRate), trend('engagementRate')],
        ['Tıklama', num(now.clicks), pct(now.ctr), pct(targets.ctr), status(now.ctr, targets.ctr), trend('clicks')],
        ['Kurulum', num(now.installs), pct(now.installPerClick), pct(targets.installPerClick), status(now.installPerClick, targets.installPerClick), trend('installs')],
        ['Kayıt', num(now.signups), pct(now.signupRate), '—', '—', trend('signups')],
        ['Aktivasyon', num(now.activations), pct(now.activationRate), pct(targets.activationRate), status(now.activationRate, targets.activationRate), trend('activations')],
        ['K faktörü', now.kFactor.toFixed(2), '—', String(targets.kFactor), status(now.kFactor, targets.kFactor), trend('kFactor')],
      ],
    ),
    '',
    '## Kanal kırılımı',
    '',
    mdTable(
      ['Kanal', 'Gönderi', 'Erişim', 'Etkileşim oranı', 'Tıklama oranı', 'Kurulum', 'Takipçi'],
      byChannel.map((c) => [c.name, c.posts, num(c.reach), pct(c.engagementRate), pct(c.ctr), num(c.installs), num(c.followers)]),
    ),
    '',
    '## Biçim kırılımı',
    '',
    mdTable(
      ['Biçim', 'Gönderi', 'Erişim', 'Etkileşim oranı', 'Kurulum'],
      byFormat.map((f) => [f.name, f.posts, num(f.reach), pct(f.engagementRate), num(f.installs)]),
    ),
    '',
    '## Öneriler',
    '',
    mdTable(
      ['Öncelik', 'Alan', 'Ne yapılacak', 'Neden'],
      recommendations.map((r) => [r.priority, r.area, r.action, r.why]),
    ),
    '',
    '## Karar kuralları',
    '',
    '- Etkileşim oranı > %5 → o biçimin haftalık hacmini iki katına çıkar.',
    '- İki hafta üst üste < %2 → biçimi kes, yerine kazanan biçimin varyantını koy.',
    '- Tıklama → kurulum < %10 → mağaza metni ve ekran görüntülerini değiştir (tek değişken).',
    '- Aktivasyon < %35 → içerik değil ürün sorunu: ilk 5 dakikayı düzelt.',
    '- Erişim düşerken etkileşim oranı sabitse sorun hacimde, içerikte değil.',
    '',
    '_Veri kaynağı: kanal dışa aktarımları (bkz. `node dispatch.mjs metrics`). Rakamlar elle doğrulanmadan dışarıya paylaşılmaz._',
  );
}

export function main(argv = process.argv.slice(2)) {
  const { flags } = parseArgs(argv);
  if (flags.help) {
    console.log(
      usage('report.mjs — haftalık büyüme raporu üretir', [
        '--input <dosya.csv>   metrik CSV (zorunlu)',
        '--week N              rapor edilecek hafta sırası (varsayılan: son hafta)',
        '--targets <json>      hedef dosyası (varsayılan gömülü hedefler)',
        '--all                 veri setindeki tüm haftalar için rapor üret',
        '--out <klasör>        çıktı klasörü (varsayılan out/reports)',
      ]),
    );
    return 0;
  }
  const input = typeof flags.input === 'string' ? flags.input : '';
  if (!input) {
    console.error('Girdi gerekli: --input <metrics.csv>');
    return 1;
  }
  const rows = normalizeRows(parseCsv(readFileSync(input, 'utf8')));
  if (rows.length === 0) {
    console.error('CSV boş ya da okunamadı.');
    return 1;
  }
  const unknown = [...new Set(rows.map((r) => r.channel))].filter((c) => c && !CHANNEL_IDS.includes(c));
  const targets = typeof flags.targets === 'string' ? { ...DEFAULT_TARGETS, ...readJson(flags.targets, {}) } : DEFAULT_TARGETS;
  const weeks = groupByWeek(rows);
  const writer = new Writer();
  const dir = typeof flags.out === 'string' ? flags.out : outPath('reports');

  const indexes = boolFlag(flags.all, false)
    ? weeks.map((_, i) => i)
    : [flags.week ? Math.min(weeks.length, numberFlag(flags.week, weeks.length)) - 1 : weeks.length - 1];

  const summaries = [];
  for (const i of indexes) {
    const week = weeks[i];
    const now = aggregate(week.rows);
    const previous = i > 0 ? aggregate(weeks[i - 1].rows) : null;
    const byChannel = breakdown(week.rows, 'channel');
    const byFormat = breakdown(week.rows, 'format');
    const recommendations = recommend(now, previous, byChannel, byFormat, targets);
    const weekNo = i + 1;
    writer.text(`${dir}/week-${String(weekNo).padStart(2, '0')}.md`, reportMarkdown({ week, weekNo, now, previous, byChannel, byFormat, recommendations, targets }));
    writer.json(`${dir}/week-${String(weekNo).padStart(2, '0')}.json`, { week: weekNo, start: week.start, totals: now, byChannel, byFormat, recommendations, targets });
    summaries.push({ weekNo, start: week.start, ...now, recommendations: recommendations.length });
  }

  writer.text(
    `${dir}/trend.csv`,
    toCsv(
      ['week', 'start', 'posts', 'reach', 'engagements', 'engagement_rate', 'clicks', 'ctr', 'installs', 'activations', 'k_factor'],
      weeks.map((w, i) => {
        const a = aggregate(w.rows);
        return [i + 1, w.start, a.posts, a.reach, a.engagements, a.engagementRate.toFixed(4), a.clicks, a.ctr.toFixed(4), a.installs, a.activations, a.kFactor.toFixed(3)];
      }),
    ),
  );

  const last = summaries[summaries.length - 1];
  console.log(`${weeks.length} hafta bulundu; ${summaries.length} rapor yazıldı.`);
  console.log(`Son rapor: ${last.weekNo}. hafta — erişim ${num(last.reach)}, kurulum ${num(last.installs)}, aktivasyon ${num(last.activations)}, K ${last.kFactor.toFixed(2)}, ${last.recommendations} öneri.`);
  if (unknown.length > 0) console.log(`Uyarı: tanınmayan kanal adı: ${unknown.join(', ')}`);
  console.log(writer.summary().join('\n'));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
