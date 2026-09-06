/** insights.csv → deterministik özet metrikler (Claude API’ye yorumlatılmadan önce). */
import { toNumber } from './util/csv.js';

export interface InsightRow {
  date: string;
  channel: string;
  postId: string;
  format: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  followers: number;
  installs: number;
}

const ALIASES: Record<keyof Omit<InsightRow, 'date' | 'channel' | 'postId' | 'format'>, string[]> =
  {
    reach: [
      'reach',
      'impressions',
      'views',
      'plays',
      'erişim',
      'görüntülenme',
      'просмотры',
      'охват',
    ],
    likes: ['likes', 'like', 'beğeni', 'reactions', 'лайки'],
    comments: ['comments', 'yorum', 'комментарии'],
    shares: ['shares', 'reposts', 'paylaşım', 'репосты', 'forwards'],
    saves: ['saves', 'saved', 'kaydetme', 'bookmarks'],
    clicks: ['clicks', 'link_clicks', 'tıklama', 'website_clicks', 'переходы'],
    followers: ['followers', 'new_followers', 'follows', 'takipçi', 'подписчики', 'members'],
    installs: ['installs', 'kurulum', 'downloads', 'установки'],
  };

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) if (row[k] !== undefined && row[k] !== '') return row[k];
  return undefined;
}

export function normalizeRows(rows: Record<string, string>[]): InsightRow[] {
  return rows.map((row) => ({
    date: pick(row, ['date', 'tarih', 'day', 'дата']) ?? '',
    channel: (pick(row, ['channel', 'kanal', 'platform', 'source']) ?? 'unknown').toLowerCase(),
    postId: pick(row, ['post_id', 'postid', 'id', 'post']) ?? '',
    format: (pick(row, ['format', 'type', 'biçim', 'media_type']) ?? 'unknown').toLowerCase(),
    reach: toNumber(pick(row, ALIASES.reach)),
    likes: toNumber(pick(row, ALIASES.likes)),
    comments: toNumber(pick(row, ALIASES.comments)),
    shares: toNumber(pick(row, ALIASES.shares)),
    saves: toNumber(pick(row, ALIASES.saves)),
    clicks: toNumber(pick(row, ALIASES.clicks)),
    followers: toNumber(pick(row, ALIASES.followers)),
    installs: toNumber(pick(row, ALIASES.installs)),
  }));
}

export interface Aggregate {
  key: string;
  posts: number;
  reach: number;
  interactions: number;
  engagementRate: number;
  saves: number;
  shares: number;
  clicks: number;
  followers: number;
  installs: number;
  clickRate: number;
}

function aggregate(key: string, rows: InsightRow[]): Aggregate {
  const sum = (f: (r: InsightRow) => number): number => rows.reduce((a, r) => a + f(r), 0);
  const reach = sum((r) => r.reach);
  const interactions = sum((r) => r.likes + r.comments + r.shares + r.saves);
  const clicks = sum((r) => r.clicks);
  return {
    key,
    posts: rows.length,
    reach,
    interactions,
    engagementRate: reach > 0 ? round(interactions / reach) : 0,
    saves: sum((r) => r.saves),
    shares: sum((r) => r.shares),
    clicks,
    followers: sum((r) => r.followers),
    installs: sum((r) => r.installs),
    clickRate: reach > 0 ? round(clicks / reach) : 0,
  };
}

function round(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function groupBy(rows: InsightRow[], f: (r: InsightRow) => string): Aggregate[] {
  const map = new Map<string, InsightRow[]>();
  for (const r of rows) {
    const k = f(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()].map(([k, v]) => aggregate(k, v)).sort((a, b) => b.reach - a.reach);
}

export interface InsightsSummary {
  period: { from: string; to: string; days: number };
  total: Aggregate;
  byChannel: Aggregate[];
  byFormat: Aggregate[];
  byChannelFormat: Aggregate[];
  byWeek: Aggregate[];
  topPosts: (InsightRow & { engagementRate: number })[];
  bottomPosts: (InsightRow & { engagementRate: number })[];
}

export const MIN_REACH_FOR_RANKING = 100;

export function summarize(rows: InsightRow[]): InsightsSummary {
  const dates = rows
    .map((r) => r.date)
    .filter(Boolean)
    .sort();
  const from = dates[0] ?? '';
  const to = dates[dates.length - 1] ?? '';
  const days = from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 : 0;
  const ranked = rows
    .filter((r) => r.reach >= MIN_REACH_FOR_RANKING)
    .map((r) => ({
      ...r,
      engagementRate: round((r.likes + r.comments + r.shares + r.saves) / r.reach),
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate);
  return {
    period: { from, to, days },
    total: aggregate('total', rows),
    byChannel: groupBy(rows, (r) => r.channel),
    byFormat: groupBy(rows, (r) => r.format),
    byChannelFormat: groupBy(rows, (r) => `${r.channel}/${r.format}`),
    byWeek: groupBy(rows, (r) => isoWeek(r.date)),
    topPosts: ranked.slice(0, 5),
    bottomPosts: ranked.slice(-5).reverse(),
  };
}

/** YYYY-Www (ISO hafta); tarih yoksa "unknown". */
export function isoWeek(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'unknown';
  const d = new Date(t);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - yearStart.getTime()) / 86_400_000 - 3 + ((yearStart.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function summaryToMarkdown(s: InsightsSummary): string {
  const lines: string[] = [];
  lines.push(
    `Dönem: ${s.period.from || '?'} → ${s.period.to || '?'} (${s.period.days} gün), ${s.total.posts} gönderi`,
  );
  lines.push(
    `Toplam erişim ${s.total.reach}, etkileşim ${s.total.interactions} (oran ${pct(s.total.engagementRate)}), tıklama ${s.total.clicks}, takipçi +${s.total.followers}, kurulum ${s.total.installs}`,
  );
  lines.push('');
  lines.push(
    '| Kanal | Gönderi | Erişim | Etkileşim % | Kaydetme | Paylaşım | Tıklama | Takipçi | Kurulum |',
  );
  lines.push(
    '| ----- | ------- | ------ | ----------- | -------- | -------- | ------- | ------- | ------- |',
  );
  for (const a of s.byChannel) lines.push(row(a));
  lines.push('');
  lines.push(
    '| Biçim | Gönderi | Erişim | Etkileşim % | Kaydetme | Paylaşım | Tıklama | Takipçi | Kurulum |',
  );
  lines.push(
    '| ----- | ------- | ------ | ----------- | -------- | -------- | ------- | ------- | ------- |',
  );
  for (const a of s.byFormat) lines.push(row(a));
  if (s.topPosts.length > 0) {
    lines.push('');
    lines.push('En iyi gönderiler (erişim ≥ 100):');
    for (const p of s.topPosts)
      lines.push(
        `- ${p.date} ${p.channel}/${p.format} ${p.postId}: erişim ${p.reach}, etkileşim ${pct(p.engagementRate)}, kaydetme ${p.saves}, tıklama ${p.clicks}`,
      );
  }
  return lines.join('\n');
}

function row(a: Aggregate): string {
  return `| ${a.key} | ${a.posts} | ${a.reach} | ${pct(a.engagementRate)} | ${a.saves} | ${a.shares} | ${a.clicks} | ${a.followers} | ${a.installs} |`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
