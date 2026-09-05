import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  format,
  isToday,
  isYesterday,
} from 'date-fns';
import { enUS, tr as trLocale } from 'date-fns/locale';

import { t } from '@/core/i18n';

function dateLocale(locale: string) {
  return locale === 'en' ? enUS : trLocale;
}

/** "az önce", "12 dk önce", "3 sa önce", "2 gün önce", ya da tarih */
export function formatRelative(iso: string, now: Date = new Date(), locale = 'tr'): string {
  const date = new Date(iso);
  const minutes = differenceInMinutes(now, date);
  if (minutes < 1) return t('common.justNow');
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  const hours = differenceInHours(now, date);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  const days = differenceInDays(now, date);
  if (days < 7) return t('time.daysAgo', { count: days });
  return format(date, 'd MMM', { locale: dateLocale(locale) });
}

export function formatDate(iso: string, locale = 'tr', pattern = 'd MMMM yyyy'): string {
  return format(new Date(iso), pattern, { locale: dateLocale(locale) });
}

export function formatTime(iso: string): string {
  return format(new Date(iso), 'HH:mm');
}

export type DateGroup = 'today' | 'yesterday' | 'earlier';

export function dateGroup(iso: string): DateGroup {
  const date = new Date(iso);
  if (isToday(date)) return 'today';
  if (isYesterday(date)) return 'yesterday';
  return 'earlier';
}

export function formatDuration(totalMinutes: number, locale = 'tr'): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const h = locale === 'tr' ? 'sa' : 'h';
  const m = locale === 'tr' ? 'dk' : 'm';
  if (hours === 0) return `${minutes} ${m}`;
  if (minutes === 0) return `${hours} ${h}`;
  return `${hours} ${h} ${minutes} ${m}`;
}
