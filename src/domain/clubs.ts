import type { ClubEventKind, ClubRole, MembershipStatus } from './enums';
import type { Club, ClubEvent, ClubFilter, ClubMember, ISODate } from './types';

/**
 * Üniversite kulüpleri — saf iş mantığı.
 *
 * Üyelik durumu kuralı: `ClubMember.joinedAt` boş string (`''`) ise kayıt
 * henüz onaylanmamış bir **üyelik talebi**dir (`requested`). Dolu ISO tarih
 * ise gerçek üyeliktir (`member`). Böylece ayrı bir talep tablosuna gerek
 * kalmadan `t.clubMembers` içinde bekleyen talepler taşınır. Üye sayısı
 * (`memberCount`) yalnızca onaylı üyeleri sayar.
 */

export const CLUBS_MODULE = 'clubs';

/** Onaylanmamış talep işareti — `joinedAt` alanına yazılır. */
export const PENDING_JOIN = '';

export type ClubMedal = 'gold' | 'silver' | 'bronze';

export interface ClubMembership {
  status: MembershipStatus;
  role: ClubRole | null;
}

/** RSVP'yi engelleyen neden; `null` → katılabilir. */
export type RsvpBlocker = 'past' | 'members_only' | 'full';

export type SeasonTerm = 'fall' | 'spring' | 'summer';

export interface Season {
  year: number;
  term: SeasonTerm;
}

/* ------------------------------------------------------------------ */
/* Liste & sıralama                                                    */
/* ------------------------------------------------------------------ */

function normalize(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Metin (ad / üniversite / şehir), şehir, macera türü ve ülke filtresi. */
export function filterClubs(clubs: Club[], filter: ClubFilter = {}): Club[] {
  const q = filter.query ? normalize(filter.query.trim()) : '';
  const city = filter.city ? normalize(filter.city) : '';
  return clubs.filter((club) => {
    if (filter.countryCode && club.countryCode !== filter.countryCode) return false;
    if (filter.adventureType && !club.adventureTypes.includes(filter.adventureType)) return false;
    if (city && normalize(club.city) !== city) return false;
    if (q) {
      const haystack = normalize(`${club.name} ${club.university} ${club.city}`);
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Dönem XP'sine göre azalan; eşitlikte üye sayısı, sonra ad. Girdiyi değiştirmez. */
export function rankClubs(clubs: Club[]): Club[] {
  return [...clubs].sort(
    (a, b) =>
      b.seasonXp - a.seasonXp ||
      b.memberCount - a.memberCount ||
      a.name.localeCompare(b.name, 'tr'),
  );
}

/** Sıraya (1 tabanlı) göre madalya; ilk üç dışında `null`. */
export function clubBadgeFor(rank: number): ClubMedal | null {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}

/** Şehir listesi (benzersiz, alfabetik). */
export function clubCities(clubs: Club[]): string[] {
  return [...new Set(clubs.map((c) => c.city))].sort((a, b) => a.localeCompare(b, 'tr'));
}

/* ------------------------------------------------------------------ */
/* Üyelik                                                              */
/* ------------------------------------------------------------------ */

/** `joinedAt === ''` kaydı bekleyen talep olarak yorumlanır. */
export function membershipOf(
  members: ClubMember[],
  clubId: string,
  userId: string,
): ClubMembership {
  const record = members.find((m) => m.clubId === clubId && m.userId === userId);
  if (!record) return { status: 'none', role: null };
  if (record.joinedAt === PENDING_JOIN) return { status: 'requested', role: null };
  return { status: 'member', role: record.role };
}

/** Onaylı üye mi (talepler hariç). */
export function isApprovedMember(member: ClubMember): boolean {
  return member.joinedAt !== PENDING_JOIN;
}

/** Yönetici mi: officer veya president. */
export function canManage(role: ClubRole | null | undefined): boolean {
  return role === 'officer' || role === 'president';
}

/** Kulübün onaylı üye sayısı (kayıtlardan). */
export function countMembers(members: ClubMember[], clubId: string): number {
  return members.filter((m) => m.clubId === clubId && isApprovedMember(m)).length;
}

/* ------------------------------------------------------------------ */
/* Etkinlikler                                                         */
/* ------------------------------------------------------------------ */

/** Henüz bitmemiş etkinlikler, başlangıca göre artan. */
export function upcomingEvents<T extends ClubEvent>(events: T[], now: number | Date): T[] {
  const ts = typeof now === 'number' ? now : now.getTime();
  return events
    .filter((e) => new Date(e.endsAt).getTime() >= ts)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/** Geçmiş etkinlikler, en yeni önce. */
export function pastEvents<T extends ClubEvent>(events: T[], now: number | Date): T[] {
  const ts = typeof now === 'number' ? now : now.getTime();
  return events
    .filter((e) => new Date(e.endsAt).getTime() < ts)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
}

export function isPastEvent(event: Pick<ClubEvent, 'endsAt'>, now: number | Date): boolean {
  const ts = typeof now === 'number' ? now : now.getTime();
  return new Date(event.endsAt).getTime() < ts;
}

/** Kalan kontenjan; kapasitesiz etkinlikte `null`. */
export function eventCapacityLeft(
  event: Pick<ClubEvent, 'capacity' | 'attendeeCount'>,
): number | null {
  if (event.capacity === null) return null;
  return Math.max(0, event.capacity - event.attendeeCount);
}

export function isEventFull(event: Pick<ClubEvent, 'capacity' | 'attendeeCount'>): boolean {
  const left = eventCapacityLeft(event);
  return left !== null && left <= 0;
}

/**
 * RSVP engeli: geçmiş etkinlik, yalnızca üyelere açık (üye değil) ya da dolu.
 * Hâlihazırda RSVP vermiş kullanıcı kontenjan kontrolüne takılmaz (iptal edebilsin).
 */
export function rsvpBlocker(
  event: Pick<ClubEvent, 'endsAt' | 'openToAll' | 'capacity' | 'attendeeCount'>,
  membership: MembershipStatus,
  now: number | Date,
  alreadyRsvped = false,
): RsvpBlocker | null {
  if (isPastEvent(event, now)) return 'past';
  if (!event.openToAll && membership !== 'member') return 'members_only';
  if (!alreadyRsvped && isEventFull(event)) return 'full';
  return null;
}

export function canRsvp(
  event: Pick<ClubEvent, 'endsAt' | 'openToAll' | 'capacity' | 'attendeeCount'>,
  membership: MembershipStatus,
  now: number | Date,
  alreadyRsvped = false,
): boolean {
  return rsvpBlocker(event, membership, now, alreadyRsvped) === null;
}

/** Etkinlik türü başına katılımcı puanı. */
export const CLUB_EVENT_XP: Record<ClubEventKind, number> = {
  trip: 40,
  training: 30,
  competition: 50,
  talk: 15,
  social: 10,
};

/** Etkinliğin kulübe kazandırdığı XP: katılımcı × tür puanı. */
export function clubXpForEvent(event: Pick<ClubEvent, 'kind' | 'attendeeCount'>): number {
  return Math.max(0, event.attendeeCount) * CLUB_EVENT_XP[event.kind];
}

/* ------------------------------------------------------------------ */
/* Öğrenci doğrulama                                                   */
/* ------------------------------------------------------------------ */

const STUDENT_DOMAIN_PATTERNS: RegExp[] = [
  /\.edu\.[a-z]{2}$/, // edu.tr, edu.au, edu.cn ...
  /(^|\.)edu$/, // .edu
  /\.ac\.[a-z]{2}$/, // ac.uk, ac.jp, ac.il, ac.nz ...
  /(^|\.)uni-[a-z0-9-]+\.de$/, // uni-heidelberg.de
  /(^|\.)tu-[a-z0-9-]+\.de$/, // tu-berlin.de
  /(^|\.)(ethz|epfl|unibe|uzh)\.ch$/,
  /(^|\.)(univ|u)-[a-z0-9-]+\.fr$/, // univ-grenoble-alpes.fr
  /(^|\.)uni[a-z]+\.it$/, // unimi.it, unibo.it
  /(^|\.)student\.[a-z0-9-]+\.[a-z]{2,}$/,
];

/** Sözlük: e-posta alan adı → üniversite adı. */
export const UNIVERSITY_DOMAINS: Record<string, string> = {
  'metu.edu.tr': 'ODTÜ',
  'odtu.edu.tr': 'ODTÜ',
  'boun.edu.tr': 'Boğaziçi Üniversitesi',
  'itu.edu.tr': 'İTÜ',
  'hacettepe.edu.tr': 'Hacettepe Üniversitesi',
  'ege.edu.tr': 'Ege Üniversitesi',
  'bilkent.edu.tr': 'Bilkent Üniversitesi',
  'ktu.edu.tr': 'Karadeniz Teknik Üniversitesi',
  'akdeniz.edu.tr': 'Akdeniz Üniversitesi',
  'sabanciuniv.edu': 'Sabancı Üniversitesi',
  'ankara.edu.tr': 'Ankara Üniversitesi',
  'deu.edu.tr': 'Dokuz Eylül Üniversitesi',
  'yildiz.edu.tr': 'Yıldız Teknik Üniversitesi',
  'gazi.edu.tr': 'Gazi Üniversitesi',
  'ku.edu.tr': 'Koç Üniversitesi',
  'istanbul.edu.tr': 'İstanbul Üniversitesi',
  'marmara.edu.tr': 'Marmara Üniversitesi',
  'erciyes.edu.tr': 'Erciyes Üniversitesi',
  'atauni.edu.tr': 'Atatürk Üniversitesi',
  'uludag.edu.tr': 'Bursa Uludağ Üniversitesi',
  'ethz.ch': 'ETH Zürich',
  'ed.ac.uk': 'University of Edinburgh',
  'cam.ac.uk': 'University of Cambridge',
  'ox.ac.uk': 'University of Oxford',
  'u-tokyo.ac.jp': 'University of Tokyo',
  'mit.edu': 'MIT',
  'stanford.edu': 'Stanford University',
  'uni-heidelberg.de': 'Universität Heidelberg',
  'tu-berlin.de': 'TU Berlin',
};

function emailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return null;
  return domain;
}

/** Alan adı öğrenci/akademik kalıplarından birine uyuyor mu. */
export function isStudentEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  if (UNIVERSITY_DOMAINS[domain]) return true;
  return STUDENT_DOMAIN_PATTERNS.some((re) => re.test(domain));
}

/**
 * Alan adından üniversite adı tahmini. Sözlükte yoksa alt alan adlarını
 * kırparak dener (`ceng.metu.edu.tr` → ODTÜ); yine bulunamazsa ilk etikete
 * göre genel bir ad üretir. Öğrenci e-postası değilse `null`.
 */
export function universityFromEmail(email: string): string | null {
  const domain = emailDomain(email);
  if (!domain || !isStudentEmail(email)) return null;
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i += 1) {
    const candidate = parts.slice(i).join('.');
    const hit = UNIVERSITY_DOMAINS[candidate];
    if (hit) return hit;
  }
  // Genel fallback: "edu"/"ac"/"student" gibi jenerik etiketleri at, ilk anlamlı etiketi kullan.
  const generic = new Set(['edu', 'ac', 'student', 'students', 'mail', 'stu', 'ogr', 'ogrenci']);
  const label = parts.find((p) => !generic.has(p)) ?? parts[0]!;
  const pretty = label
    .replace(/^(uni|univ|tu)-/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return domain.endsWith('.tr') ? `${pretty} Üniversitesi` : `${pretty} University`;
}

/* ------------------------------------------------------------------ */
/* Dönem                                                               */
/* ------------------------------------------------------------------ */

/** Akademik dönem: Eyl–Oca güz (Ocak bir önceki yılın güzü), Şub–Haz bahar, Tem–Ağu yaz. */
export function seasonOf(now: number | Date): Season {
  const d = typeof now === 'number' ? new Date(now) : now;
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  if (month === 1) return { year: year - 1, term: 'fall' };
  if (month >= 9) return { year, term: 'fall' };
  if (month >= 7) return { year, term: 'summer' };
  return { year, term: 'spring' };
}

const TERM_LABELS: Record<'tr' | 'en', Record<SeasonTerm, string>> = {
  tr: { fall: 'Güz', spring: 'Bahar', summer: 'Yaz' },
  en: { fall: 'Fall', spring: 'Spring', summer: 'Summer' },
};

/** "2026 Güz" / "Fall 2026" */
export function seasonLabel(now: number | Date, locale: string = 'tr'): string {
  const { year, term } = seasonOf(now);
  if (locale === 'tr') return `${year} ${TERM_LABELS.tr[term]}`;
  return `${TERM_LABELS.en[term]} ${year}`;
}

/** Dönem başlangıcı (ISO) — sıralama açıklaması için. */
export function seasonStart(now: number | Date): ISODate {
  const { year, term } = seasonOf(now);
  const month = term === 'fall' ? 8 : term === 'spring' ? 1 : 6;
  return new Date(Date.UTC(year, month, 1)).toISOString();
}
