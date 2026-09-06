import type { IconName } from '@/components/ui/Icon';
import type { TranslationKey } from '@/core/i18n';

import type { AdventureType, NewsCategory, TvChannelKind, TvProgramKind } from './enums';
import type { ID, ISODate, NewsItem, TvFilter, TvProgram, TvSchedule } from './types';

/* ------------------------------------------------------------------ */
/* Sabitler                                                            */
/* ------------------------------------------------------------------ */

/** Bu oranın üstü "tamamlandı" sayılır. */
export const WATCH_COMPLETED_RATIO = 0.95;
/** Bu oranın altı "yeni başladı" sayılır; izlemeye devam et listesine girmez. */
export const WATCH_STARTED_RATIO = 0.05;

export type NewsSeverity = NewsItem['severity'];
export const NEWS_SEVERITIES: NewsSeverity[] = ['critical', 'warning', 'info'];

/** Demo videoların lisans notu (Blender Foundation, CC BY). */
export const BLENDER_CREDITS =
  'Demo video: Blender Foundation açık filmleri (CC BY 3.0) — gerçek içerik altyapısı bağlanana kadar örnek akış.';

/* ------------------------------------------------------------------ */
/* Meta veriler (ikon / renk / i18n)                                   */
/* ------------------------------------------------------------------ */

export interface TvMeta {
  labelKey: TranslationKey;
  icon: IconName;
  color: string;
}

export const newsSeverityMeta: Record<NewsSeverity, TvMeta> = {
  critical: { labelKey: 'tv.severity.critical', icon: 'siren', color: '#DC2626' },
  warning: { labelKey: 'tv.severity.warning', icon: 'triangle-alert', color: '#D97706' },
  info: { labelKey: 'tv.severity.info', icon: 'info', color: '#2563EB' },
};

export const newsCategoryMeta: Record<NewsCategory, TvMeta> = {
  weather: { labelKey: 'tv.category.weather', icon: 'cloud-lightning', color: '#0EA5E9' },
  closure: { labelKey: 'tv.category.closure', icon: 'ban', color: '#DC2626' },
  rescue: { labelKey: 'tv.category.rescue', icon: 'life-buoy', color: '#EA580C' },
  event: { labelKey: 'tv.category.event', icon: 'calendar-days', color: '#7C3AED' },
  gear: { labelKey: 'tv.category.gear', icon: 'backpack', color: '#0D9488' },
  community: { labelKey: 'tv.category.community', icon: 'users', color: '#16A34A' },
  science: { labelKey: 'tv.category.science', icon: 'brain', color: '#2563EB' },
};

export const channelKindMeta: Record<TvChannelKind, TvMeta> = {
  documentary: { labelKey: 'tv.channelKind.documentary', icon: 'video', color: '#0D9488' },
  news: { labelKey: 'tv.channelKind.news', icon: 'radio', color: '#DC2626' },
  live: { labelKey: 'tv.channelKind.live', icon: 'radio-tower', color: '#E11D48' },
  education: { labelKey: 'tv.channelKind.education', icon: 'graduation-cap', color: '#2563EB' },
  community: { labelKey: 'tv.channelKind.community', icon: 'users', color: '#16A34A' },
};

export const programKindMeta: Record<TvProgramKind, TvMeta> = {
  documentary: { labelKey: 'tv.programKind.documentary', icon: 'video', color: '#0D9488' },
  news: { labelKey: 'tv.programKind.news', icon: 'radio', color: '#DC2626' },
  series: { labelKey: 'tv.programKind.series', icon: 'layers', color: '#7C3AED' },
  short: { labelKey: 'tv.programKind.short', icon: 'zap', color: '#D97706' },
  live_replay: { labelKey: 'tv.programKind.live_replay', icon: 'radio-tower', color: '#E11D48' },
  tutorial: { labelKey: 'tv.programKind.tutorial', icon: 'graduation-cap', color: '#2563EB' },
};

/* ------------------------------------------------------------------ */
/* Program filtreleme / gruplama                                       */
/* ------------------------------------------------------------------ */

const normalize = (s: string) => s.toLocaleLowerCase('tr-TR').trim();

/** Filtreye uyan programları döner (sıralamayı değiştirmez). */
export function filterPrograms<T extends TvProgram>(programs: T[], filter: TvFilter): T[] {
  const q = filter.query ? normalize(filter.query) : '';
  return programs.filter((p) => {
    if (filter.channelId && p.channelId !== filter.channelId) return false;
    if (filter.kind && p.kind !== filter.kind) return false;
    if (filter.adventureType && !p.adventureTypes.includes(filter.adventureType)) return false;
    if (filter.kidsOnly && !p.kidsFriendly) return false;
    if (q) {
      const hay = normalize(`${p.title} ${p.description} ${p.seriesTitle ?? ''}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface SeriesGroup<T extends TvProgram = TvProgram> {
  seriesTitle: string;
  episodes: T[];
}

/** Dizi başlığına göre gruplar; bölümler numaraya göre sıralı. Tekil programlar dışarıda kalır. */
export function groupBySeries<T extends TvProgram>(programs: T[]): SeriesGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const p of programs) {
    if (!p.seriesTitle) continue;
    const list = map.get(p.seriesTitle) ?? [];
    list.push(p);
    map.set(p.seriesTitle, list);
  }
  return [...map.entries()].map(([seriesTitle, episodes]) => ({
    seriesTitle,
    episodes: [...episodes].sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0)),
  }));
}

/** Aynı dizideki bir sonraki bölüm; yoksa null. */
export function nextEpisode<T extends TvProgram>(program: TvProgram, all: T[]): T | null {
  if (!program.seriesTitle || program.episode == null) return null;
  const target = program.episode + 1;
  return (
    all.find(
      (p) => p.seriesTitle === program.seriesTitle && p.episode === target && p.id !== program.id,
    ) ?? null
  );
}

/* ------------------------------------------------------------------ */
/* Yayın akışı                                                          */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');

/** Yerel tarih anahtarı: YYYY-MM-DD. */
export function tvDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Verilen güne (YYYY-MM-DD, yerel) düşen akış kayıtları, başlangıca göre sıralı. */
export function scheduleForDay<T extends TvSchedule>(schedule: T[], day: string): T[] {
  return schedule
    .filter((s) => tvDayKey(new Date(s.startsAt)) === day)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/** Şu an yayında olan akış kayıtları (startsAt <= now < endsAt). */
export function nowPlaying<T extends TvSchedule>(schedule: T[], now: Date | number): T[] {
  const ts = typeof now === 'number' ? now : now.getTime();
  return schedule.filter(
    (s) => new Date(s.startsAt).getTime() <= ts && ts < new Date(s.endsAt).getTime(),
  );
}

/** Akış kaydı şu an yayında mı? */
export function isOnAir(item: TvSchedule, now: Date | number): boolean {
  return nowPlaying([item], now).length === 1;
}

/* ------------------------------------------------------------------ */
/* İzleme ilerlemesi                                                    */
/* ------------------------------------------------------------------ */

/** 0..1 arası izleme oranı (geçersiz süre → 0). */
export function progressRatio(positionSec: number, durationSec: number): number {
  if (!Number.isFinite(positionSec) || !Number.isFinite(durationSec) || durationSec <= 0) return 0;
  return Math.min(1, Math.max(0, positionSec / durationSec));
}

/** 0..100 arası tam sayı yüzde. */
export function progressPct(positionSec: number, durationSec: number): number {
  return Math.round(progressRatio(positionSec, durationSec) * 100);
}

export function isWatchCompleted(ratio: number): boolean {
  return ratio >= WATCH_COMPLETED_RATIO;
}

/** "İzlemeye devam et" listesine girecek aralık. */
export function isWatchInProgress(ratio: number): boolean {
  return ratio >= WATCH_STARTED_RATIO && ratio < WATCH_COMPLETED_RATIO;
}

/** Süre etiketi: "1 sa 12 dk" / "45 dk" / "1 h 12 m". */
export function formatDurationLabel(durationMin: number, locale = 'tr'): string {
  const total = Math.max(0, Math.round(durationMin));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const h = locale === 'tr' ? 'sa' : 'h';
  const m = locale === 'tr' ? 'dk' : 'm';
  if (hours === 0) return `${minutes} ${m}`;
  if (minutes === 0) return `${hours} ${h}`;
  return `${hours} ${h} ${minutes} ${m}`;
}

/** Kalan süre etiketi (dakika bazında). */
export function remainingLabel(durationMin: number, ratio: number, locale = 'tr'): string {
  const left = Math.max(0, Math.ceil(durationMin * (1 - ratio)));
  return formatDurationLabel(left, locale);
}

/* ------------------------------------------------------------------ */
/* Öneri                                                               */
/* ------------------------------------------------------------------ */

/**
 * Kullanıcının favori türlerine göre puanlar; izlenmiş olanları sona atar.
 * Puan: favori tür eşleşmesi (+3 / eşleşme), belgesel/dizi (+1), yenilik (+0..2),
 * popülerlik (+0..1). İzlenmiş programlar -10.
 */
export function recommendPrograms<T extends TvProgram>(
  programs: T[],
  favoriteTypes: AdventureType[],
  watched: Iterable<ID>,
  limit = 6,
  now: Date | number = Date.now(),
): T[] {
  const watchedSet = new Set(watched);
  const ts = typeof now === 'number' ? now : now.getTime();
  const maxViews = Math.max(1, ...programs.map((p) => p.viewsCount));
  const scored = programs.map((p) => {
    let score = 0;
    for (const type of p.adventureTypes) if (favoriteTypes.includes(type)) score += 3;
    if (p.kind === 'documentary' || p.kind === 'series') score += 1;
    const ageDays = Math.max(0, (ts - new Date(p.publishedAt).getTime()) / 86_400_000);
    score += Math.max(0, 2 - ageDays / 30);
    score += p.viewsCount / maxViews;
    if (watchedSet.has(p.id)) score -= 10;
    return { p, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.p);
}

/* ------------------------------------------------------------------ */
/* Haberler                                                            */
/* ------------------------------------------------------------------ */

/** Yayınlanmış ve süresi dolmamış haber. */
export function isNewsActive(item: NewsItem, now: Date | number): boolean {
  const ts = typeof now === 'number' ? now : now.getTime();
  if (new Date(item.publishedAt).getTime() > ts) return false;
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= ts) return false;
  return true;
}

const severityRank: Record<NewsSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Aktif olanlar önce; şiddet sırasına, sonra tarihe (yeni önce) göre. */
export function sortNews<T extends NewsItem>(news: T[], now: Date | number): T[] {
  return [...news].sort((a, b) => {
    const aa = isNewsActive(a, now) ? 0 : 1;
    const bb = isNewsActive(b, now) ? 0 : 1;
    if (aa !== bb) return aa - bb;
    const sr = severityRank[a.severity] - severityRank[b.severity];
    if (sr !== 0) return sr;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

/** Alt şerit metni: aktif haber başlıkları, kritik olanlar "SON DAKİKA" önekiyle. */
export function tickerText(
  news: NewsItem[],
  locale = 'tr',
  now: Date | number = Date.now(),
): string {
  const breaking = locale === 'tr' ? 'SON DAKİKA' : 'BREAKING';
  const active = sortNews(
    news.filter((n) => isNewsActive(n, now)),
    now,
  );
  return active
    .map((n) => (n.severity === 'critical' ? `${breaking}: ${n.title}` : n.title))
    .join('  •  ');
}

/* ------------------------------------------------------------------ */
/* Program gönderme                                                    */
/* ------------------------------------------------------------------ */

export interface TvSubmissionInput {
  title: string;
  videoUrl: string;
  durationMin: number;
  description?: string;
  kind?: TvProgramKind;
}

export type TvSubmissionField = 'title' | 'videoUrl' | 'durationMin' | 'description';

export interface TvSubmissionValidation {
  ok: boolean;
  errors: Partial<Record<TvSubmissionField, TranslationKey>>;
}

const HTTP_URL = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/** Başlık ≥ 3 karakter, URL http(s), süre > 0 (en fazla 24 saat). */
export function validateSubmission(input: TvSubmissionInput): TvSubmissionValidation {
  const errors: TvSubmissionValidation['errors'] = {};
  if (!input.title || input.title.trim().length < 3) errors.title = 'tv.submit.errors.title';
  if (!input.videoUrl || !HTTP_URL.test(input.videoUrl.trim()))
    errors.videoUrl = 'tv.submit.errors.url';
  if (!Number.isFinite(input.durationMin) || input.durationMin <= 0 || input.durationMin > 24 * 60)
    errors.durationMin = 'tv.submit.errors.duration';
  if (input.description && input.description.length > 2000)
    errors.description = 'tv.submit.errors.description';
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Bölüm etiketi için yardımcı: "S1 · 2. bölüm" gibi gösterimde kullanılır. */
export function episodeLabel(program: Pick<TvProgram, 'seriesTitle' | 'episode'>): string | null {
  if (!program.seriesTitle || program.episode == null) return null;
  return `${program.seriesTitle} · ${program.episode}`;
}

/** Yayın saat aralığı "HH:MM – HH:MM". */
export function timeRange(startsAt: ISODate, endsAt: ISODate): string {
  const f = (iso: string) => {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return `${f(startsAt)} – ${f(endsAt)}`;
}
