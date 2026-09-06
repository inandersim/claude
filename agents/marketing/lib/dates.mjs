/** Tarih yardımcıları — hepsi UTC tabanlı, deterministik (yerel saat dilimi etkilemez). */

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` → Date (UTC gece yarısı). Geçersizse hata. */
export function parseDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(iso));
  if (!m) throw new Error(`Tarih YYYY-MM-DD olmalı: ${iso}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) throw new Error(`Geçersiz tarih: ${iso}`);
  return d;
}

/** Date → `YYYY-MM-DD`. */
export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(d, n) {
  return new Date(d.getTime() + n * DAY_MS);
}

export function diffDays(a, b) {
  return Math.round((parseDate(isoDate(b)) - parseDate(isoDate(a))) / DAY_MS);
}

/** Verilen tarihten sonraki (ya da o günse kendisi) Pazartesi. */
export function nextMonday(from = new Date()) {
  const base = parseDate(isoDate(from));
  const shift = (8 - base.getUTCDay()) % 7; // Pazar=0 → 1, Pazartesi=1 → 0
  return addDays(base, shift === 0 && base.getUTCDay() !== 1 ? 1 : shift);
}

export const WEEKDAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function weekdayTr(d) {
  return WEEKDAYS_TR[d.getUTCDay()];
}

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const MONTHS_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];
/** Rusçada tarih içinde ay tamlayan hâlde yazılır: «5 октября». */
const MONTHS_RU_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** 1–12 ay numarasını dile göre yazar. */
export function monthName(n, lang = 'tr') {
  const i = ((n - 1) % 12 + 12) % 12;
  if (lang === 'en') return MONTHS_EN[i];
  if (lang === 'de') return MONTHS_DE[i];
  if (lang === 'ru') return MONTHS_RU[i];
  return MONTHS_TR[i];
}

/** [3,4,5,9,10] → "Mart–Mayıs, Eylül–Ekim" (ardışık aralıkları birleştirir). */
export function monthRanges(months, lang = 'tr') {
  const sorted = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  const groups = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (const m of sorted.slice(1)) {
    if (m === prev + 1) {
      prev = m;
      continue;
    }
    groups.push([start, prev]);
    start = m;
    prev = m;
  }
  groups.push([start, prev]);
  return groups
    .map(([a, b]) => (a === b ? monthName(a, lang) : `${monthName(a, lang)}–${monthName(b, lang)}`))
    .join(', ');
}

/** `2026-10-05` → "5 Ekim 2026" / "5 October 2026". */
export function humanDate(iso, lang = 'tr') {
  const d = parseDate(iso);
  const day = d.getUTCDate();
  const month = monthName(d.getUTCMonth() + 1, lang);
  const year = d.getUTCFullYear();
  if (lang === 'en') return `${month} ${day}, ${year}`;
  if (lang === 'de') return `${day}. ${month} ${year}`;
  if (lang === 'ru') return `${day} ${MONTHS_RU_GEN[d.getUTCMonth()]} ${year} г.`;
  return `${day} ${month} ${year}`;
}

/** `HH:MM` metnini dakikaya çevirir (sıralama için). */
export function minutesOf(hhmm) {
  const m = /^(\d{2}):(\d{2})$/u.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}
