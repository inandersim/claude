/**
 * Mock veri deposu.
 *
 * Uygulamanın `src/data/mock/seed*.ts` tohum verisinden okur ve panelin
 * ihtiyaç duyduğu yönetimsel görünümleri (rapor kuyruğu, doğrulama talepleri,
 * emanet durumları, ajan çalışmaları…) deterministik olarak türetir.
 * Deterministik üretim sayesinde sayfa yenilendiğinde veriler değişmez.
 *
 * Not: buradaki tüm veriler demo amaçlıdır; gerçek sunucu geldiğinde
 * `restAdminApi` aynı `AdminApi` arayüzünü uygular ve bu dosya devre dışı kalır.
 */
import { LANGUAGE_META } from '@/core/i18n/languages';
import { distanceKm } from '@/domain/geo';
import type { GeoPoint, ID, ISODate, PaymentStatus, Plan, SosStage } from '@/domain';

import { seedArticles } from '@/data/mock/seed.articles';
import { seedClubs } from '@/data/mock/seed.clubs';
import { seedCourses, seedEnrollments } from '@/data/mock/seed.courses';
import { seedDestinations } from '@/data/mock/seed.destinations';
import { seedBusinesses, seedEmergencyCenters, seedStayBookings } from '@/data/mock/seed.extra';
import { seedHeritageSites } from '@/data/mock/seed.heritage';
import { seedInventoryBookings, seedPayments } from '@/data/mock/seed.inventory';
import { seedSosSessions } from '@/data/mock/seed.satellite';
import { seedDoctors } from '@/data/mock/seed.telemed';
import { seedNews, seedTvPrograms } from '@/data/mock/seed.tv';
import { seedSpecies, seedWildlifeQuestions } from '@/data/mock/seed.wildlife';
import {
  seedBookings,
  seedComments,
  seedHazards,
  seedInstructors,
  seedMessages,
  seedPosts,
  seedUsers,
} from '@/data/mock/seed';

import type {
  AccountStatus,
  AdminAccount,
  AdminBookingRow,
  AdminHazardRow,
  AdminRole,
  AdminUserDetail,
  AdminUserRow,
  AgentFinding,
  AgentPullRequest,
  AgentRun,
  AsoKeyword,
  AuditEntry,
  Campaign,
  CiRun,
  ContentDetail,
  ContentKind,
  ContentRow,
  Dispute,
  MarketingChannel,
  ModerationLogEntry,
  ModerationReport,
  ReportReason,
  ReportTargetKind,
  ReleaseInfo,
  ReferralStats,
  SocialPostItem,
  SosIncident,
  SystemHealth,
  AdminSettings,
  TimePoint,
  VerificationDocKind,
  VerificationKind,
  VerificationRequest,
} from './adminApi';

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

/** Deterministik sözde-rastgele üreteç (mulberry32). */
export function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const NOW = Date.now();

function isoDaysAgo(days: number): ISODate {
  return new Date(NOW - days * 86_400_000).toISOString();
}

function isoHoursAgo(hours: number): ISODate {
  return new Date(NOW - hours * 3_600_000).toISOString();
}

function isoDaysAhead(days: number): ISODate {
  return new Date(NOW + days * 86_400_000).toISOString();
}

function dayKey(offsetFromToday: number): string {
  const d = new Date(NOW + offsetFromToday * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function pick<T>(list: readonly T[], r: number): T {
  return list[Math.floor(r * list.length) % list.length] as T;
}

function round(value: number, digits = 0): number {
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

export const LOCALE_CODES = Object.keys(LANGUAGE_META);

/* ------------------------------------------------------------------ */
/* Panel hesapları                                                     */
/* ------------------------------------------------------------------ */

export const adminAccounts: AdminAccount[] = [
  {
    id: 'adm_1',
    name: 'Deniz Kaya',
    email: 'deniz@zirtan.app',
    role: 'admin',
    avatarUrl: 'https://i.pravatar.cc/200?img=12',
    lastActiveAt: isoHoursAgo(0.2),
  },
  {
    id: 'adm_2',
    name: 'Selin Aydın',
    email: 'selin@zirtan.app',
    role: 'moderator',
    avatarUrl: 'https://i.pravatar.cc/200?img=32',
    lastActiveAt: isoHoursAgo(1.4),
  },
  {
    id: 'adm_3',
    name: 'Kerem Doğan',
    email: 'kerem@zirtan.app',
    role: 'editor',
    avatarUrl: 'https://i.pravatar.cc/200?img=15',
    lastActiveAt: isoHoursAgo(5),
  },
  {
    id: 'adm_4',
    name: 'Ayşe Yıldırım',
    email: 'ayse@zirtan.app',
    role: 'support',
    avatarUrl: 'https://i.pravatar.cc/200?img=45',
    lastActiveAt: isoHoursAgo(9),
  },
];

/* ------------------------------------------------------------------ */
/* Kullanıcılar                                                        */
/* ------------------------------------------------------------------ */

const FIRST_NAMES = [
  'Deniz', 'Ece', 'Kaan', 'Selin', 'Mert', 'Zeynep', 'Emre', 'Elif', 'Barış', 'İpek',
  'Onur', 'Derya', 'Kerem', 'Nazlı', 'Tolga', 'Sena', 'Umut', 'Bade', 'Arda', 'Melis',
  'Cem', 'Ayla', 'Berk', 'Ceren', 'Doruk', 'Esra', 'Furkan', 'Gizem', 'Hakan', 'Irmak',
];
const LAST_NAMES = [
  'Kaya', 'Demir', 'Yılmaz', 'Şahin', 'Çelik', 'Aydın', 'Aslan', 'Doğan', 'Kurt', 'Koç',
  'Arslan', 'Polat', 'Erdem', 'Yıldırım', 'Toprak', 'Güneş', 'Bulut', 'Aksoy', 'Taş', 'Ercan',
];
const CITIES: { name: string; code: string; coords: GeoPoint }[] = [
  { name: 'İstanbul', code: 'TR', coords: { latitude: 41.0082, longitude: 28.9784 } },
  { name: 'Ankara', code: 'TR', coords: { latitude: 39.9334, longitude: 32.8597 } },
  { name: 'İzmir', code: 'TR', coords: { latitude: 38.4237, longitude: 27.1428 } },
  { name: 'Antalya', code: 'TR', coords: { latitude: 36.8969, longitude: 30.7133 } },
  { name: 'Rize', code: 'TR', coords: { latitude: 41.0201, longitude: 40.5234 } },
  { name: 'Erzurum', code: 'TR', coords: { latitude: 39.9, longitude: 41.27 } },
  { name: 'Kathmandu', code: 'NP', coords: { latitude: 27.7172, longitude: 85.324 } },
  { name: 'Chamonix', code: 'FR', coords: { latitude: 45.9237, longitude: 6.8694 } },
  { name: 'Tiflis', code: 'GE', coords: { latitude: 41.7151, longitude: 44.8271 } },
  { name: 'Berlin', code: 'DE', coords: { latitude: 52.52, longitude: 13.405 } },
];
const PLANS: Plan[] = ['free', 'free', 'free', 'pro', 'pro', 'pro_guide', 'business'];

function makeUserRows(): { rows: AdminUserRow[]; details: Map<ID, AdminUserDetail> } {
  const rows: AdminUserRow[] = [];
  const details = new Map<ID, AdminUserDetail>();
  const postCountByAuthor = new Map<ID, number>();
  for (const post of seedPosts) {
    postCountByAuthor.set(post.authorId, (postCountByAuthor.get(post.authorId) ?? 0) + 1);
  }

  const roleByUser = new Map<ID, AdminRole>([
    ['u_me', 'admin'],
    ['u_2', 'moderator'],
    ['u_4', 'editor'],
    ['u_6', 'support'],
  ]);

  const total = 148;
  for (let i = 0; i < total; i += 1) {
    const seed = seedUsers[i];
    const r = makeRng(1000 + i);
    const first = pick(FIRST_NAMES, r());
    const last = pick(LAST_NAMES, r());
    const city = pick(CITIES, r());
    const displayName = seed ? seed.displayName : `${first} ${last}`;
    const username =
      seed?.username ??
      `${first.toLocaleLowerCase('tr')}.${last.toLocaleLowerCase('tr')}${i}`
        .replace(/[ıİ]/g, 'i')
        .replace(/[şŞ]/g, 's')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[üÜ]/g, 'u')
        .replace(/[öÖ]/g, 'o')
        .replace(/[çÇ]/g, 'c');
    const id = seed?.id ?? `u_g${i}`;
    const roll = r();
    const status: AccountStatus =
      seed || roll > 0.12 ? 'active' : roll > 0.05 ? 'suspended' : 'banned';
    const plan: Plan = seed?.plan ?? pick(PLANS, r());
    const joinedAt = seed?.joinedAt ?? isoDaysAgo(round(6 + r() * 700));
    const trustScore = seed?.trustScore ?? Math.round(35 + r() * 64);
    const coords = seed?.coords ?? city.coords;
    const locationName = seed?.locationName ?? city.name;

    const row: AdminUserRow = {
      id,
      username,
      displayName,
      avatarUrl: seed?.avatarUrl ?? `https://i.pravatar.cc/200?img=${(i % 70) + 1}`,
      email: `${username.replace(/\./g, '')}@example.com`,
      phone: `+90 5${String(20 + (i % 60)).padStart(2, '0')} ${String(100 + (i % 900))} ${String(
        1000 + ((i * 37) % 9000),
      )}`,
      phoneVerified: r() > 0.28,
      emailVerified: r() > 0.12,
      plan,
      status,
      role: roleByUser.get(id) ?? null,
      trustScore,
      locationName,
      countryCode: seed ? 'TR' : city.code,
      joinedAt,
      lastSeenAt: isoHoursAgo(round(r() * 240, 1)),
      postsCount: postCountByAuthor.get(id) ?? Math.round(r() * 42),
      reportsAgainst: r() > 0.8 ? Math.round(r() * 5) + 1 : 0,
    };
    rows.push(row);

    const detail: AdminUserDetail = {
      ...row,
      profile:
        seed ??
        ({
          id,
          username,
          displayName,
          avatarUrl: row.avatarUrl,
          coverUrl: null,
          bio: 'Demo kullanıcı — tohum veriden türetildi.',
          locationName,
          coords,
          isVerified: r() > 0.85,
          totalDistanceKm: Math.round(r() * 1800),
          totalAdventures: Math.round(r() * 90),
          followersCount: Math.round(r() * 2400),
          followingCount: Math.round(r() * 600),
          trustScore,
          favoriteTypes: [],
          joinedAt,
          plan,
          emergencyContacts: [],
        } as const),
      bio: seed?.bio ?? 'Demo kullanıcı — tohum veriden türetildi.',
      coords,
      totalDistanceKm: seed?.totalDistanceKm ?? Math.round(r() * 1800),
      totalAdventures: seed?.totalAdventures ?? Math.round(r() * 90),
      followersCount: seed?.followersCount ?? Math.round(r() * 2400),
      followingCount: seed?.followingCount ?? Math.round(r() * 600),
      favoriteTypes: seed?.favoriteTypes ?? [],
      suspendedUntil: status === 'suspended' ? isoDaysAhead(round(3 + r() * 20)) : null,
      statusReason:
        status === 'suspended'
          ? 'Tekrarlanan spam bildirimleri'
          : status === 'banned'
            ? 'Sahte rehber ilanı'
            : null,
      sessions: [
        {
          id: `s_${id}_1`,
          device: pick(['iPhone 15 Pro', 'Pixel 8', 'Galaxy S24', 'iPad Air'], r()),
          platform: r() > 0.5 ? 'ios' : 'android',
          ip: `85.10.${Math.round(r() * 255)}.${Math.round(r() * 255)}`,
          lastActiveAt: isoHoursAgo(round(r() * 40, 1)),
          current: true,
        },
        {
          id: `s_${id}_2`,
          device: 'Chrome · macOS',
          platform: 'web',
          ip: `78.180.${Math.round(r() * 255)}.${Math.round(r() * 255)}`,
          lastActiveAt: isoDaysAgo(round(1 + r() * 12)),
          current: false,
        },
      ],
      recentActivity: [
        { id: `act_${id}_1`, at: isoHoursAgo(3), kind: 'post', summary: 'Yeni macera gönderisi' },
        { id: `act_${id}_2`, at: isoDaysAgo(2), kind: 'booking', summary: 'Eğitmen rezervasyonu' },
        { id: `act_${id}_3`, at: isoDaysAgo(5), kind: 'track', summary: 'GPX rota yükledi' },
      ],
      notes: [],
    };
    details.set(id, detail);
  }
  return { rows, details };
}

/* ------------------------------------------------------------------ */
/* Moderasyon                                                          */
/* ------------------------------------------------------------------ */

const REASONS: ReportReason[] = [
  'spam',
  'harassment',
  'nudity',
  'violence',
  'misinformation',
  'illegal',
  'other',
];

function makeReports(users: AdminUserRow[]): ModerationReport[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const reports: ModerationReport[] = [];

  const candidates: {
    kind: ReportTargetKind;
    id: ID;
    text: string;
    authorId: ID;
    imageUrl: string | null;
    locationName: string;
  }[] = [];

  for (const post of seedPosts.slice(0, 26)) {
    candidates.push({
      kind: 'post',
      id: post.id,
      text: post.caption,
      authorId: post.authorId,
      imageUrl: post.imageUrl,
      locationName: post.locationName,
    });
  }
  for (const comment of seedComments.slice(0, 18)) {
    candidates.push({
      kind: 'comment',
      id: comment.id,
      text: comment.content,
      authorId: comment.authorId,
      imageUrl: null,
      locationName: '—',
    });
  }
  for (const message of seedMessages.slice(0, 12)) {
    candidates.push({
      kind: 'message',
      id: message.id,
      text: message.content,
      authorId: message.senderId,
      imageUrl: null,
      locationName: '—',
    });
  }
  for (const article of seedArticles.slice(0, 10)) {
    candidates.push({
      kind: 'article',
      id: article.id,
      text: article.subtitle || article.title,
      authorId: article.authorId,
      imageUrl: article.coverUrl,
      locationName: article.countryCode ?? '—',
    });
  }
  for (const question of seedWildlifeQuestions.slice(0, 10)) {
    candidates.push({
      kind: 'question',
      id: question.id,
      text: question.title,
      authorId: question.authorId,
      imageUrl: question.imageUrl,
      locationName: question.locationName,
    });
  }

  candidates.forEach((c, i) => {
    const r = makeRng(hashString(c.id));
    const author = byId.get(c.authorId);
    const reportCount = 1 + Math.floor(r() * 6);
    const severityRoll = r();
    const decided = i % 5 === 4;
    reports.push({
      id: `rep_${i + 1}`,
      targetKind: c.kind,
      targetId: c.id,
      excerpt: c.text.length > 220 ? `${c.text.slice(0, 220)}…` : c.text,
      imageUrl: c.imageUrl,
      authorId: c.authorId,
      authorName: author?.displayName ?? c.authorId,
      authorAvatarUrl: author?.avatarUrl ?? null,
      authorTrustScore: author?.trustScore ?? 50,
      reason: pick(REASONS, r()),
      reportCount,
      reporters: users.slice(i % 9, (i % 9) + reportCount).map((u) => ({
        id: u.id,
        name: u.displayName,
      })),
      severity: severityRoll > 0.78 ? 'high' : severityRoll > 0.42 ? 'medium' : 'low',
      status: decided ? (r() > 0.5 ? 'removed' : 'approved') : 'open',
      locationName: c.locationName,
      createdAt: isoHoursAgo(round(1 + r() * 260, 1)),
      decidedAt: decided ? isoHoursAgo(round(r() * 40, 1)) : null,
      decidedBy: decided ? 'Selin Aydın' : null,
    });
  });

  return reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ------------------------------------------------------------------ */
/* Doğrulama talepleri                                                 */
/* ------------------------------------------------------------------ */

const DOC_LABELS: Record<VerificationDocKind, string> = {
  id_card: 'Kimlik belgesi',
  certificate: 'Sertifika',
  license: 'Ruhsat / lisans',
  tax_record: 'Vergi levhası',
  diploma: 'Diploma',
  portfolio: 'Portföy',
  insurance: 'Sigorta poliçesi',
};

function docs(prefix: string, kinds: VerificationDocKind[], r: () => number): VerificationRequest['documents'] {
  return kinds.map((kind, i) => ({
    id: `${prefix}_doc${i}`,
    kind,
    fileName: `${prefix}_${kind}.pdf`,
    sizeKb: Math.round(180 + r() * 3400),
    uploadedAt: isoDaysAgo(round(1 + r() * 14)),
    preview: `${DOC_LABELS[kind]} — demo önizleme. Gerçek sunucuda imzalı URL ile açılır.`,
  }));
}

function makeVerifications(users: AdminUserRow[]): VerificationRequest[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const out: VerificationRequest[] = [];
  let n = 0;

  const push = (
    kind: VerificationKind,
    applicantId: ID,
    subjectName: string,
    subjectType: string,
    locationName: string,
    fields: { label: string; value: string }[],
    docKinds: VerificationDocKind[],
    note: string,
  ) => {
    n += 1;
    const r = makeRng(hashString(`${kind}${applicantId}${n}`));
    const applicant = byId.get(applicantId);
    const roll = r();
    const status = n % 4 === 0 ? (roll > 0.5 ? 'approved' : 'rejected') : n % 7 === 0 ? 'more_info' : 'pending';
    out.push({
      id: `ver_${n}`,
      kind,
      applicantId,
      applicantName: applicant?.displayName ?? applicantId,
      applicantAvatarUrl: applicant?.avatarUrl ?? null,
      subjectName,
      subjectType,
      locationName,
      submittedAt: isoDaysAgo(round(r() * 26, 1)),
      status,
      documents: docs(`ver${n}`, docKinds, r),
      fields,
      applicantNote: note,
      decidedAt: status === 'approved' || status === 'rejected' ? isoDaysAgo(round(r() * 5, 1)) : null,
      decidedBy: status === 'approved' || status === 'rejected' ? 'Deniz Kaya' : null,
      decisionReason:
        status === 'rejected' ? 'Sertifika süresi dolmuş, güncel belge bekleniyor.' : null,
    });
  };

  seedInstructors.slice(0, 8).forEach((ins) => {
    push(
      'instructor',
      ins.userId,
      ins.headline,
      ins.specialties[0] ?? 'hiking',
      ins.locationName,
      [
        { label: 'Sertifikalar', value: ins.certifications.join(', ') },
        { label: 'Deneyim', value: `${ins.yearsExperience} yıl` },
        { label: 'Seans ücreti', value: `${ins.pricePerSessionTry} ₺` },
        { label: 'Diller', value: ins.languages.join(', ') },
      ],
      ['id_card', 'certificate', 'insurance'],
      'Pro Guide planına geçmek için başvuruyorum, belgelerim ektedir.',
    );
  });

  seedBusinesses.slice(0, 7).forEach((biz) => {
    push(
      'business',
      biz.ownerId,
      biz.name,
      biz.type,
      biz.locationName,
      [
        { label: 'İşletme türü', value: biz.type },
        { label: 'Telefon', value: biz.phone ?? '—' },
        { label: 'Web', value: biz.website ?? '—' },
        { label: 'Puan', value: `${biz.rating} (${biz.reviewCount} yorum)` },
      ],
      ['tax_record', 'license', 'id_card'],
      'İşletme sayfamızı doğrulatmak istiyoruz.',
    );
  });

  seedClubs.slice(0, 5).forEach((club, i) => {
    push(
      'club',
      seedUsers[(i + 2) % seedUsers.length]?.id ?? 'u_me',
      club.name,
      club.university,
      club.city,
      [
        { label: 'Üniversite', value: club.university },
        { label: 'Üye sayısı', value: String(club.memberCount) },
        { label: 'Kuruluş', value: String(club.foundedYear ?? '—') },
        { label: 'E-posta', value: club.contactEmail ?? '—' },
      ],
      ['license', 'portfolio'],
      'Kulüp resmî belgesi ve rektörlük onayı ektedir.',
    );
  });

  seedDoctors.slice(0, 5).forEach((doc) => {
    push(
      'doctor',
      doc.userId,
      `${doc.title}`,
      doc.specialties[0] ?? 'general',
      doc.institution,
      [
        { label: 'Diploma no', value: doc.licenseNo },
        { label: 'Kurum', value: doc.institution },
        { label: 'Uzmanlık', value: doc.specialties.join(', ') },
        { label: 'Gönüllü', value: doc.volunteer ? 'Evet' : 'Hayır' },
      ],
      ['diploma', 'id_card', 'license'],
      'Tele-tıp modülünde gönüllü olarak yer almak istiyorum.',
    );
  });

  const writerIds = ['u_2', 'u_3', 'u_5', 'u_7'];
  writerIds.forEach((uid, i) => {
    push(
      'writer',
      uid,
      `${byId.get(uid)?.displayName ?? uid} — yazar başvurusu`,
      'article',
      byId.get(uid)?.locationName ?? 'İstanbul',
      [
        { label: 'Örnek yazı', value: seedArticles[i]?.title ?? '—' },
        { label: 'Konular', value: 'trip_report, gear' },
        { label: 'Dil', value: 'tr, en' },
      ],
      ['portfolio', 'id_card'],
      'Blog modülünde yazar olarak katkı vermek istiyorum.',
    );
  });

  return out.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/* ------------------------------------------------------------------ */
/* Rezervasyon & ödeme                                                 */
/* ------------------------------------------------------------------ */

const PAYMENT_FLOW: PaymentStatus[] = ['pending', 'authorized', 'escrow', 'released'];

function makeBookings(users: AdminUserRow[]): AdminBookingRow[] {
  const userById = new Map(users.map((u) => [u.id, u]));
  const bizById = new Map(seedBusinesses.map((b) => [b.id, b]));
  const paymentByBooking = new Map(seedPayments.map((p) => [p.bookingId, p]));
  const rows: AdminBookingRow[] = [];

  const stays = [...seedStayBookings, ...seedInventoryBookings];
  stays.forEach((booking, i) => {
    const r = makeRng(hashString(booking.id));
    const payment = paymentByBooking.get(booking.id);
    const biz = bizById.get(booking.businessId);
    const status: PaymentStatus = payment?.status ?? pick(PAYMENT_FLOW, r());
    rows.push({
      id: booking.id,
      reference: `ZRT-${String(1000 + i)}`,
      kind: 'stay',
      guestId: booking.guestId,
      guestName: userById.get(booking.guestId)?.displayName ?? booking.guestId,
      providerId: booking.businessId,
      providerName: biz?.name ?? booking.businessId,
      startAt: booking.checkIn,
      endAt: booking.checkOut,
      guests: booking.guests,
      nights: booking.nights,
      totalTry: booking.totalTry,
      platformFeeTry: booking.platformFeeTry,
      commissionPct: round((booking.platformFeeTry / Math.max(booking.totalTry, 1)) * 100, 1),
      refundedTry: payment?.refundedTry ?? 0,
      status: booking.status,
      paymentStatus: status,
      provider: payment?.provider ?? 'iyzico',
      disputed: i % 11 === 3,
      createdAt: booking.createdAt,
      timeline: payment?.timeline ?? [
        { status: 'pending', at: booking.createdAt },
        { status: 'authorized', at: booking.createdAt },
      ],
    });
  });

  const instructorByIdMap = new Map(seedInstructors.map((ins) => [ins.id, ins]));
  seedBookings.forEach((booking, i) => {
    const r = makeRng(hashString(booking.id));
    const ins = instructorByIdMap.get(booking.instructorId);
    const providerName = ins ? (userById.get(ins.userId)?.displayName ?? ins.headline) : booking.instructorId;
    const fee = Math.round(booking.priceTry * 0.12);
    const status: PaymentStatus =
      booking.status === 'completed' ? 'released' : booking.status === 'declined' ? 'refunded' : pick(['escrow', 'authorized'], r());
    rows.push({
      id: booking.id,
      reference: `ZRT-E${String(2000 + i)}`,
      kind: 'instructor',
      guestId: booking.studentId,
      guestName: userById.get(booking.studentId)?.displayName ?? booking.studentId,
      providerId: booking.instructorId,
      providerName,
      startAt: booking.date,
      endAt: booking.date,
      guests: 1,
      nights: 0,
      totalTry: booking.priceTry,
      platformFeeTry: fee,
      commissionPct: 12,
      refundedTry: status === 'refunded' ? booking.priceTry : 0,
      status: booking.status,
      paymentStatus: status,
      provider: 'iyzico',
      disputed: i % 9 === 5,
      createdAt: booking.createdAt,
      timeline: [
        { status: 'pending', at: booking.createdAt },
        { status: 'authorized', at: booking.createdAt },
        ...(status === 'released' ? [{ status: 'released' as PaymentStatus, at: booking.date }] : []),
      ],
    });
  });

  const courseById = new Map(seedCourses.map((c) => [c.id, c]));
  seedEnrollments.slice(0, 24).forEach((enrollment, i) => {
    const r = makeRng(hashString(enrollment.id));
    const course = courseById.get(enrollment.courseId);
    const price = course?.priceTry ?? 1200;
    const fee = Math.round(price * 0.15);
    const status: PaymentStatus =
      enrollment.status === 'completed' ? 'released' : pick(['escrow', 'authorized', 'escrow'], r());
    rows.push({
      id: enrollment.id,
      reference: `ZRT-K${String(3000 + i)}`,
      kind: 'course',
      guestId: enrollment.userId,
      guestName: userById.get(enrollment.userId)?.displayName ?? enrollment.userId,
      providerId: enrollment.courseId,
      providerName: course?.title ?? enrollment.courseId,
      startAt: enrollment.enrolledAt,
      endAt: enrollment.completedAt ?? enrollment.enrolledAt,
      guests: 1,
      nights: 0,
      totalTry: price,
      platformFeeTry: fee,
      commissionPct: 15,
      refundedTry: 0,
      status: enrollment.status === 'completed' ? 'completed' : 'confirmed',
      paymentStatus: status,
      provider: 'stripe',
      disputed: false,
      createdAt: enrollment.enrolledAt,
      timeline: [
        { status: 'pending', at: enrollment.enrolledAt },
        { status: 'authorized', at: enrollment.enrolledAt },
        { status: 'escrow', at: enrollment.enrolledAt },
      ],
    });
  });

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function makeDisputes(bookings: AdminBookingRow[]): Dispute[] {
  const disputed = bookings.filter((b) => b.disputed);
  return disputed.map((b, i) => {
    const r = makeRng(hashString(`d${b.id}`));
    return {
      id: `dsp_${i + 1}`,
      bookingId: b.id,
      reference: b.reference,
      openedById: b.guestId,
      openedByName: b.guestName,
      againstName: b.providerName,
      reason: pick(
        [
          'Konaklama ilanda yazan özellikleri karşılamadı.',
          'Eğitmen randevuya gelmedi.',
          'Hava koşulları nedeniyle iptal, iade yapılmadı.',
          'Ek ücret talep edildi.',
        ],
        r(),
      ),
      amountTry: b.totalTry,
      openedAt: isoDaysAgo(round(1 + r() * 20, 1)),
      status: i % 3 === 0 ? 'resolved' : 'open',
      outcome: i % 3 === 0 ? 'refund_guest' : null,
      note: i % 3 === 0 ? 'Misafire tam iade yapıldı.' : null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* SOS & tehlike                                                       */
/* ------------------------------------------------------------------ */

const SOS_STAGE_LABELS: Record<SosStage, string> = {
  idle: 'Beklemede',
  armed: 'Hazırlandı',
  sent: 'Sinyal gönderildi',
  acknowledged: 'Merkez teyit etti',
  resolved: 'Kapatıldı',
};

function makeSosIncidents(users: AdminUserRow[]): SosIncident[] {
  const userById = new Map(users.map((u) => [u.id, u]));
  const out: SosIncident[] = [];

  seedSosSessions.forEach((session, i) => {
    const user = userById.get(session.userId) ?? users[i % users.length];
    const center = seedEmergencyCenters[i % seedEmergencyCenters.length];
    out.push({
      id: session.id,
      userId: session.userId,
      userName: user?.displayName ?? session.userId,
      userPhone: user?.phone ?? '—',
      coords: session.coords,
      locationName: user?.locationName ?? 'Bilinmiyor',
      altitudeM: 1200 + i * 340,
      stage: session.stage,
      source: 'satellite',
      batteryPct: 40 + ((i * 13) % 55),
      notifiedContacts: 2 + (i % 3),
      startedAt: session.startedAt,
      resolvedAt: session.stage === 'resolved' ? session.updatedAt : null,
      assignedCenterId: session.rescueCenterId ?? null,
      assignedCenterName: session.rescueCenterId ? (center?.name ?? null) : null,
      timeline: session.timeline.map((t) => ({
        at: t.at,
        label: `${SOS_STAGE_LABELS[t.stage]} — ${t.note}`,
        actor: 'Sistem',
      })),
    });
  });

  const extra: { stage: SosStage; hoursAgo: number; source: SosIncident['source'] }[] = [
    { stage: 'sent', hoursAgo: 0.4, source: 'app' },
    { stage: 'acknowledged', hoursAgo: 2.1, source: 'app' },
    { stage: 'sent', hoursAgo: 5.5, source: 'watch' },
    { stage: 'resolved', hoursAgo: 26, source: 'app' },
    { stage: 'resolved', hoursAgo: 52, source: 'satellite' },
    { stage: 'acknowledged', hoursAgo: 9, source: 'app' },
  ];
  extra.forEach((e, i) => {
    const user = users[(i * 7 + 3) % users.length];
    const hazard = seedHazards[i % seedHazards.length];
    if (!user || !hazard) return;
    const startedAt = isoHoursAgo(e.hoursAgo);
    out.push({
      id: `sos_x${i + 1}`,
      userId: user.id,
      userName: user.displayName,
      userPhone: user.phone,
      coords: hazard.coords,
      locationName: hazard.locationName,
      altitudeM: 800 + i * 260,
      stage: e.stage,
      source: e.source,
      batteryPct: 12 + i * 11,
      notifiedContacts: 1 + (i % 4),
      startedAt,
      resolvedAt: e.stage === 'resolved' ? isoHoursAgo(e.hoursAgo - 1) : null,
      assignedCenterId: e.stage === 'acknowledged' || e.stage === 'resolved' ? seedEmergencyCenters[i]?.id ?? null : null,
      assignedCenterName:
        e.stage === 'acknowledged' || e.stage === 'resolved' ? seedEmergencyCenters[i]?.name ?? null : null,
      timeline: [
        { at: startedAt, label: 'SOS tetiklendi (uygulama)', actor: user.displayName },
        { at: startedAt, label: 'Acil kişilere bildirim gönderildi', actor: 'Sistem' },
        ...(e.stage === 'acknowledged' || e.stage === 'resolved'
          ? [{ at: isoHoursAgo(e.hoursAgo - 0.3), label: 'Kurtarma merkezi ataması yapıldı', actor: 'Ayşe Yıldırım' }]
          : []),
        ...(e.stage === 'resolved'
          ? [{ at: isoHoursAgo(e.hoursAgo - 1), label: 'Olay kapatıldı — kullanıcı güvende', actor: 'Ayşe Yıldırım' }]
          : []),
      ],
    });
  });

  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function makeHazards(users: AdminUserRow[]): AdminHazardRow[] {
  const userById = new Map(users.map((u) => [u.id, u]));
  return seedHazards.map((h, i) => {
    const reporter = userById.get(h.reporterId);
    return {
      id: h.id,
      type: h.type,
      severity: h.severity,
      title: h.title,
      description: h.description,
      locationName: h.locationName,
      coords: h.coords,
      radiusM: h.radiusM,
      reporterId: h.reporterId,
      reporterName: reporter?.displayName ?? h.reporterId,
      reporterTrustScore: reporter?.trustScore ?? 50,
      confirmations: h.confirmations,
      createdAt: h.createdAt,
      review: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'approved' : h.confirmations > 3 ? 'approved' : 'pending',
      resolvedAt: h.resolvedAt,
    };
  });
}

/* ------------------------------------------------------------------ */
/* İçerik                                                              */
/* ------------------------------------------------------------------ */

interface ContentSeed {
  id: ID;
  kind: ContentKind;
  title: string;
  subtitle: string;
  body: string;
  region: string;
  coverUrl: string | null;
  updatedAt: ISODate;
  views: number;
  fields: { key: string; label: string; value: string }[];
}

const TRANSLATABLE_FIELDS = ['title', 'subtitle', 'summary', 'body'];

function translationStatus(id: string): { locale: string; complete: boolean; missingFields: string[] }[] {
  const r = makeRng(hashString(id));
  return LOCALE_CODES.map((locale, i) => {
    if (locale === 'tr') return { locale, complete: true, missingFields: [] };
    const roll = r();
    // İngilizce çoğunlukla tam; diğer diller kademeli
    const completeChance = locale === 'en' ? 0.92 : Math.max(0.18, 0.8 - i * 0.03);
    if (roll < completeChance) return { locale, complete: true, missingFields: [] };
    const missing = TRANSLATABLE_FIELDS.filter((_, fi) => (hashString(`${id}${locale}${fi}`) % 3) === 0);
    return {
      locale,
      complete: false,
      missingFields: missing.length ? missing : ['body'],
    };
  });
}

function makeContent(): { rows: ContentRow[]; details: Map<ID, ContentDetail> } {
  const seeds: ContentSeed[] = [];

  seedDestinations.slice(0, 40).forEach((d) => {
    seeds.push({
      id: `c_dest_${d.id}`,
      kind: 'destination',
      title: d.name,
      subtitle: d.summary,
      body: d.guide,
      region: `${d.region} · ${d.countryCode}`,
      coverUrl: d.imageUrl,
      updatedAt: d.updatedAt,
      views: 400 + (hashString(d.id) % 24000),
      fields: [
        { key: 'type', label: 'Tür', value: d.type },
        { key: 'difficulty', label: 'Zorluk', value: d.difficulty },
        { key: 'days', label: 'Tipik gün', value: String(d.typicalDays) },
        { key: 'elevation', label: 'Maks. yükseklik', value: `${d.maxElevationM} m` },
      ],
    });
  });

  seedHeritageSites.slice(0, 30).forEach((h) => {
    seeds.push({
      id: `c_her_${h.id}`,
      kind: 'heritage',
      title: h.name,
      subtitle: h.summary,
      body: h.history,
      region: `${h.region} · ${h.countryCode}`,
      coverUrl: h.imageUrl,
      updatedAt: h.updatedAt,
      views: 200 + (hashString(h.id) % 15000),
      fields: [
        { key: 'kind', label: 'Tür', value: h.kind },
        { key: 'unesco', label: 'UNESCO', value: h.isUnesco ? 'Evet' : 'Hayır' },
        { key: 'fee', label: 'Giriş', value: h.entryFeeTry ? `${h.entryFeeTry} ₺` : 'Ücretsiz' },
      ],
    });
  });

  seedSpecies.slice(0, 30).forEach((s) => {
    seeds.push({
      id: `c_spc_${s.id}`,
      kind: 'species',
      title: s.commonName,
      subtitle: s.scientificName,
      body: s.description,
      region: s.countryCodes.join(', '),
      coverUrl: s.imageUrl,
      updatedAt: isoDaysAgo(hashString(s.id) % 120),
      views: 120 + (hashString(s.id) % 9000),
      fields: [
        { key: 'group', label: 'Grup', value: s.group },
        { key: 'danger', label: 'Tehlike', value: s.danger },
        { key: 'hours', label: 'Aktif saat', value: s.activeHours },
      ],
    });
  });

  seedCourses.slice(0, 20).forEach((c) => {
    seeds.push({
      id: `c_crs_${c.id}`,
      kind: 'course',
      title: c.title,
      subtitle: c.summary,
      body: c.description,
      region: c.provider,
      coverUrl: c.imageUrl,
      updatedAt: c.createdAt,
      views: c.enrolledCount * 14,
      fields: [
        { key: 'level', label: 'Seviye', value: c.level },
        { key: 'format', label: 'Format', value: c.format },
        { key: 'price', label: 'Ücret', value: `${c.priceTry} ₺` },
        { key: 'hours', label: 'Süre', value: `${c.durationHours} saat` },
      ],
    });
  });

  seedTvPrograms.slice(0, 24).forEach((p) => {
    seeds.push({
      id: `c_tv_${p.id}`,
      kind: 'tv_program',
      title: p.title,
      subtitle: p.seriesTitle ?? p.kind,
      body: p.description,
      region: p.countryCode ?? '—',
      coverUrl: p.thumbnailUrl,
      updatedAt: p.publishedAt,
      views: p.viewsCount,
      fields: [
        { key: 'kind', label: 'Tür', value: p.kind },
        { key: 'duration', label: 'Süre', value: `${p.durationMin} dk` },
        { key: 'kids', label: 'Çocuklara uygun', value: p.kidsFriendly ? 'Evet' : 'Hayır' },
      ],
    });
  });

  seedNews.slice(0, 24).forEach((n) => {
    seeds.push({
      id: `c_news_${n.id}`,
      kind: 'news',
      title: n.title,
      subtitle: n.summary,
      body: n.body,
      region: n.region,
      coverUrl: null,
      updatedAt: n.publishedAt,
      views: 80 + (hashString(n.id) % 6000),
      fields: [
        { key: 'category', label: 'Kategori', value: n.category },
        { key: 'severity', label: 'Önem', value: n.severity },
        { key: 'source', label: 'Kaynak', value: n.sourceName },
      ],
    });
  });

  seedArticles.slice(0, 20).forEach((a) => {
    seeds.push({
      id: `c_art_${a.id}`,
      kind: 'article',
      title: a.title,
      subtitle: a.subtitle,
      body: a.body,
      region: a.countryCode ?? '—',
      coverUrl: a.coverUrl,
      updatedAt: a.updatedAt,
      views: a.viewsCount,
      fields: [
        { key: 'category', label: 'Kategori', value: a.category },
        { key: 'status', label: 'Yayın durumu', value: a.status },
        { key: 'read', label: 'Okuma', value: `${a.readMinutes} dk` },
      ],
    });
  });

  const rows: ContentRow[] = [];
  const details = new Map<ID, ContentDetail>();

  seeds.forEach((s, i) => {
    const translations = translationStatus(s.id);
    const missingLocales = translations.filter((t) => !t.complete).map((t) => t.locale);
    const status = i % 13 === 5 ? 'draft' : i % 17 === 9 ? 'archived' : 'published';
    const row: ContentRow = {
      id: s.id,
      kind: s.kind,
      title: s.title,
      subtitle: s.subtitle.length > 160 ? `${s.subtitle.slice(0, 160)}…` : s.subtitle,
      status,
      coverUrl: s.coverUrl,
      region: s.region,
      updatedAt: s.updatedAt,
      translatedCount: LOCALE_CODES.length - missingLocales.length,
      localeCount: LOCALE_CODES.length,
      missingLocales,
      views: s.views,
    };
    rows.push(row);
    details.set(s.id, { ...row, body: s.body, fields: s.fields, translations });
  });

  return { rows: rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), details };
}

/* ------------------------------------------------------------------ */
/* Pazarlama                                                           */
/* ------------------------------------------------------------------ */

const CHANNELS: MarketingChannel[] = ['instagram', 'tiktok', 'youtube', 'x', 'newsletter', 'app_store'];

function makeCampaigns(): Campaign[] {
  const specs: { name: string; channel: MarketingChannel; goal: string; days: number }[] = [
    { name: 'Kaçkar sezon açılışı', channel: 'instagram', goal: 'Yeni kayıt', days: -12 },
    { name: 'Likya Yolu rehberi', channel: 'youtube', goal: 'Destinasyon görüntüleme', days: -30 },
    { name: 'Kış güvenliği serisi', channel: 'tiktok', goal: 'Uygulama indirme', days: -5 },
    { name: 'Pro Guide davet', channel: 'newsletter', goal: 'Pro Guide başvurusu', days: 3 },
    { name: 'ASO — yaz güncellemesi', channel: 'app_store', goal: 'Organik indirme', days: -60 },
    { name: 'Kulüp elçileri', channel: 'instagram', goal: 'Kulüp kaydı', days: 10 },
    { name: 'Tele-tıp duyurusu', channel: 'x', goal: 'Modül kullanımı', days: -2 },
    { name: 'Nepal sonbahar', channel: 'youtube', goal: 'Rezervasyon', days: 21 },
  ];
  return specs.map((s, i) => {
    const r = makeRng(4000 + i);
    const budget = 8000 + Math.round(r() * 42000);
    const started = s.days <= 0;
    const spent = started ? Math.round(budget * (0.35 + r() * 0.6)) : 0;
    return {
      id: `cmp_${i + 1}`,
      name: s.name,
      channel: s.channel,
      startAt: s.days <= 0 ? isoDaysAgo(-s.days) : isoDaysAhead(s.days),
      endAt: s.days <= 0 ? isoDaysAhead(round(14 + r() * 20)) : isoDaysAhead(s.days + 21),
      budgetTry: budget,
      spentTry: Math.min(spent, budget),
      status: !started ? 'planned' : r() > 0.8 ? 'paused' : s.days < -40 ? 'done' : 'running',
      goal: s.goal,
      installs: started ? Math.round(400 + r() * 9000) : 0,
      signups: started ? Math.round(120 + r() * 2600) : 0,
      roiPct: started ? round(-20 + r() * 220, 1) : 0,
    };
  });
}

function makeSocialPosts(campaigns: Campaign[]): SocialPostItem[] {
  const bodies = [
    'Kaçkarlar’da sonbahar: 3 günlük rota önerimiz ve kamp noktaları 🏕️',
    'Çığ bülteni nasıl okunur? 60 saniyede anlatıyoruz.',
    'Yeni: Uydu mesajlaşma modülü ile şebekesiz alanda konum paylaşımı.',
    'Likya Yolu’nun en güzel 5 etabı — rehber uygulamada.',
    'Pro Guide olun: doğrulanmış eğitmenler için yeni rozet ve komisyon avantajı.',
    'Yılan ısırığında ne yapılır, ne yapılmaz? Tür tanıma modülü yayında.',
    'Kulüp liderleri için etkinlik takvimi güncellendi.',
    'Zirtan TV: Aladağlar belgeseli bu hafta yayında 🎬',
    'Deprem ve heyelan bildirimlerinde canlı tehlike haritası.',
    'Çocukla doğa: aileler için 40 yeni rota eklendi.',
    'Kış tırmanışı ekipman listesi — indirilebilir kontrol listesi.',
    'Toplulukla birlikte 12.000 km rota doğruladık, teşekkürler!',
  ];
  const out: SocialPostItem[] = [];
  for (let i = 0; i < 34; i += 1) {
    const r = makeRng(5000 + i);
    const future = i % 3 === 0;
    const status: SocialPostItem['status'] = future
      ? i % 6 === 0
        ? 'draft'
        : 'queued'
      : i % 9 === 4
        ? 'failed'
        : 'published';
    const impressions = status === 'published' ? Math.round(1200 + r() * 48000) : 0;
    out.push({
      id: `sp_${i + 1}`,
      channel: pick(CHANNELS, r()),
      body: bodies[i % bodies.length] as string,
      scheduledAt: future ? isoDaysAhead(round(r() * 18, 1)) : isoDaysAgo(round(r() * 40, 1)),
      status,
      impressions,
      clicks: Math.round(impressions * (0.01 + r() * 0.05)),
      likes: Math.round(impressions * (0.02 + r() * 0.06)),
      campaignId: campaigns[i % campaigns.length]?.id ?? null,
    });
  }
  return out.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}

function makeReferrals(users: AdminUserRow[]): ReferralStats {
  const series: TimePoint[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const r = makeRng(6000 + i);
    series.push({ date: dayKey(-i), value: Math.round(30 + r() * 120) });
  }
  const invitesSent = series.reduce((sum, p) => sum + p.value, 0);
  const accepted = Math.round(invitesSent * 0.37);
  return {
    invitesSent,
    accepted,
    conversionPct: round((accepted / invitesSent) * 100, 1),
    rewardTry: accepted * 25,
    series,
    topInviters: users.slice(0, 8).map((u, i) => ({
      userId: u.id,
      name: u.displayName,
      invites: 120 - i * 11,
      joined: 64 - i * 6,
    })),
  };
}

function makeAso(): AsoKeyword[] {
  const specs: [string, string, number][] = [
    ['doğa yürüyüşü', 'tr', 3],
    ['trekking rotaları', 'tr', 5],
    ['kamp uygulaması', 'tr', 8],
    ['dağcılık', 'tr', 2],
    ['gpx rota', 'tr', 11],
    ['çığ bülteni', 'tr', 4],
    ['hiking app', 'en', 24],
    ['trail map offline', 'en', 17],
    ['climbing topo', 'en', 31],
    ['outdoor sos', 'en', 12],
    ['wanderkarte', 'de', 19],
    ['randonnée gps', 'fr', 22],
  ];
  return specs.map(([keyword, locale, rank], i) => {
    const r = makeRng(7000 + i);
    return {
      keyword,
      locale,
      rank,
      prevRank: rank + Math.round(-4 + r() * 9),
      volume: Math.round(800 + r() * 24000),
      difficulty: Math.round(20 + r() * 70),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Ajanlar & sistem                                                    */
/* ------------------------------------------------------------------ */

const AGENTS = [
  'steward',
  'module-builder',
  'test-writer',
  'translator',
  'ux-auditor',
  'security-sentinel',
  'infra-doctor',
  'growth-analyst',
];

const AGENT_TASKS = [
  'i18n eksik anahtar taraması (23 dil)',
  'Yeni modül iskeleti: kids',
  'Jest kapsamını %80 üstüne çıkar',
  'Almanca/İspanyolca çeviri güncellemesi',
  'Playwright ile 42 ekran gezintisi',
  'Bağımlılık güvenlik taraması',
  'EAS build süresi optimizasyonu',
  'Haftalık büyüme raporu',
  'Ödeme emanet akışı testleri',
  'Bundle boyutu analizi',
];

function makeAgentRuns(): AgentRun[] {
  const out: AgentRun[] = [];
  for (let i = 0; i < 46; i += 1) {
    const r = makeRng(8000 + i);
    const running = i < 2;
    const failed = !running && i % 8 === 3;
    const startedAt = isoHoursAgo(round(i * 3.7 + r() * 2, 1));
    const durationSec = Math.round(45 + r() * 1500);
    out.push({
      id: `run_${i + 1}`,
      agent: AGENTS[i % AGENTS.length] as string,
      task: AGENT_TASKS[i % AGENT_TASKS.length] as string,
      status: running ? 'running' : failed ? 'failed' : 'success',
      startedAt,
      finishedAt: running ? null : new Date(Date.parse(startedAt) + durationSec * 1000).toISOString(),
      durationSec: running ? 0 : durationSec,
      filesChanged: Math.round(r() * 24),
      prNumber: r() > 0.55 ? 400 + i : null,
      findings: Math.round(r() * 7),
    });
  }
  return out;
}

function makeAgentPrs(): AgentPullRequest[] {
  const titles = [
    'i18n: eksik 214 anahtar tamamlandı',
    'feat(kids): çocuk modülü ekranları',
    'test: emanet iade akışı testleri',
    'fix(maps): offline paket indirme hatası',
    'chore: expo 57.0.20 yükseltmesi',
    'perf: liste sanallaştırma iyileştirmesi',
    'docs: ödeme akışı diyagramı',
    'fix(a11y): kontrast düzeltmeleri',
  ];
  return titles.map((title, i) => {
    const r = makeRng(9000 + i);
    return {
      number: 412 + i,
      title,
      agent: AGENTS[i % AGENTS.length] as string,
      status: i < 3 ? 'open' : i < 7 ? 'merged' : 'closed',
      checks: i === 1 ? 'failing' : i === 0 ? 'pending' : 'passing',
      openedAt: isoDaysAgo(round(r() * 12, 1)),
      additions: Math.round(20 + r() * 900),
      deletions: Math.round(5 + r() * 400),
    };
  });
}

function makeFindings(): AgentFinding[] {
  const specs: [string, AgentFinding['severity'], string][] = [
    ['Rezervasyon iadesinde yuvarlama hatası', 'high', 'payments'],
    ['SOS ekranında konum izni reddedilince çökme', 'critical', 'emergency'],
    ['i18n: 214 anahtar 6 dilde eksik', 'medium', 'i18n'],
    ['Liste sanallaştırma kapalı — 800+ öğede takılma', 'medium', 'feed'],
    ['Bağımlılık: eski kütüphanede bilinen zafiyet', 'high', 'security'],
    ['Kontrast oranı 3.1 (AA altı) — rozet metni', 'low', 'a11y'],
    ['Harita paketi indirme yeniden denemesi yok', 'medium', 'maps'],
    ['Eğitmen rezervasyonunda çift kayıt riski', 'high', 'bookings'],
    ['Kullanılmayan 12 asset bundle içinde', 'low', 'build'],
    ['Sunucu zaman aşımında hata mesajı yok', 'medium', 'network'],
  ];
  return specs.map(([title, severity, area], i) => {
    const r = makeRng(9500 + i);
    return {
      id: `find_${i + 1}`,
      agent: AGENTS[i % AGENTS.length] as string,
      severity,
      title,
      area,
      foundAt: isoDaysAgo(round(r() * 16, 1)),
      status: i % 4 === 0 ? 'fixed' : i % 9 === 7 ? 'wontfix' : 'open',
    };
  });
}

function makeCi(): CiRun[] {
  const pipelines = ['lint', 'typecheck', 'jest', 'eas-build-android', 'eas-build-ios', 'e2e'];
  return pipelines.flatMap((pipeline, i) =>
    [0, 1].map((k) => {
      const r = makeRng(9800 + i * 3 + k);
      return {
        id: `ci_${pipeline}_${k}`,
        pipeline,
        branch: k === 0 ? 'main' : 'feat/kids-module',
        status: (i === 3 && k === 1 ? 'failing' : i === 5 && k === 0 ? 'running' : 'passing') as CiRun['status'],
        durationSec: Math.round(40 + r() * 900),
        at: isoHoursAgo(round(r() * 20, 1)),
        commit: hashString(`${pipeline}${k}`).toString(16).padStart(8, '0').slice(0, 7),
      };
    }),
  );
}

function makeHealth(): SystemHealth {
  const errorSeries: TimePoint[] = [];
  const latencySeries: TimePoint[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const r = makeRng(10_000 + i);
    errorSeries.push({ date: dayKey(-i), value: round(0.2 + r() * 1.4, 2) });
    latencySeries.push({ date: dayKey(-i), value: Math.round(180 + r() * 240) });
  }
  return {
    errorRatePct: errorSeries[errorSeries.length - 1]?.value ?? 0.4,
    p95Ms: latencySeries[latencySeries.length - 1]?.value ?? 320,
    crashFreePct: 99.62,
    uptimePct: 99.97,
    errorSeries,
    latencySeries,
  };
}

function makeReleases(): ReleaseInfo[] {
  return [
    {
      version: '1.6.0',
      channel: 'production',
      releasedAt: isoDaysAgo(4),
      adoptionPct: 68.4,
      crashFreePct: 99.62,
      current: true,
      notes: 'Miras alanları, çocuk modülü ve uydu SOS iyileştirmeleri.',
    },
    {
      version: '1.5.2',
      channel: 'production',
      releasedAt: isoDaysAgo(19),
      adoptionPct: 24.1,
      crashFreePct: 99.71,
      current: false,
      notes: 'Tele-tıp ve Zirtan TV hata düzeltmeleri.',
    },
    {
      version: '1.5.0',
      channel: 'production',
      releasedAt: isoDaysAgo(46),
      adoptionPct: 6.2,
      crashFreePct: 99.4,
      current: false,
      notes: 'Yaban hayatı tanıma, tele-tıp, TV modülleri.',
    },
    {
      version: '1.7.0-beta.3',
      channel: 'beta',
      releasedAt: isoDaysAgo(1),
      adoptionPct: 1.3,
      crashFreePct: 98.9,
      current: false,
      notes: 'Yönetim paneli entegrasyonu ve yeni harita motoru.',
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Ayarlar                                                             */
/* ------------------------------------------------------------------ */

function makeSettings(): AdminSettings {
  const flagSpecs: [string, string, string, boolean, number, 'all' | 'pro' | 'internal'][] = [
    ['satellite_sos', 'Uydu SOS', 'Uydu cihazlarıyla SOS ve mesajlaşma', true, 100, 'all'],
    ['telemed', 'Tele-tıp', 'Çevrimiçi doktor görüşmesi modülü', true, 100, 'all'],
    ['zirtan_tv', 'Zirtan TV', 'Belgesel ve haber akışı', true, 100, 'all'],
    ['kids_module', 'Çocuk modülü', 'Aileler için rota ve görev sistemi', true, 60, 'all'],
    ['ai_assistant', 'AI asistan', 'Rota planlama asistanı', true, 100, 'pro'],
    ['live_streaming', 'Canlı yayın', 'Kamera ve drone yayınları', false, 25, 'internal'],
    ['marketplace_escrow', 'Pazar emaneti', 'İkinci el alışverişte emanet ödeme', false, 0, 'internal'],
    ['heritage_audio', 'Sesli rehber', 'Miras alanlarında TTS rehber', true, 80, 'all'],
    ['club_leaderboard', 'Kulüp sıralaması', 'Üniversite kulüpleri XP tablosu', true, 100, 'all'],
    ['new_map_engine', 'Yeni harita motoru', 'Vektör tabanlı çevrimdışı harita', false, 10, 'internal'],
  ];
  return {
    flags: flagSpecs.map(([key, label, description, enabled, rolloutPct, audience]) => ({
      key,
      label,
      description,
      enabled,
      rolloutPct,
      audience,
      updatedAt: isoDaysAgo(hashString(key) % 30),
    })),
    maintenance: { enabled: false, message: 'Planlı bakım: 03:00–04:00 (TSİ)', until: null },
    announcement: {
      enabled: true,
      message: 'Kaçkar bölgesinde çığ uyarısı — planlarınızı gözden geçirin.',
      level: 'warning',
      url: null,
    },
    rateLimits: [
      { key: 'api_read', label: 'Okuma isteği', perMinute: 240 },
      { key: 'api_write', label: 'Yazma isteği', perMinute: 60 },
      { key: 'sos_trigger', label: 'SOS tetikleme', perMinute: 5 },
      { key: 'ai_message', label: 'AI mesajı', perMinute: 20 },
      { key: 'upload', label: 'Medya yükleme', perMinute: 12 },
    ],
    commissions: [
      { key: 'stay', label: 'Konaklama', pct: 12 },
      { key: 'instructor', label: 'Eğitmen seansı', pct: 12 },
      { key: 'course', label: 'Kurs', pct: 15 },
      { key: 'marketplace', label: 'Pazar', pct: 5 },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Metrikler                                                           */
/* ------------------------------------------------------------------ */

export function buildSeries(seed: number, days: number, base: number, growth: number, noise: number): TimePoint[] {
  const r = makeRng(seed);
  const out: TimePoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const weekday = new Date(NOW - i * 86_400_000).getDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.28 : 1;
    const trend = base * (1 + growth * ((days - i) / days));
    const value = trend * weekendBoost * (1 - noise / 2 + r() * noise);
    out.push({ date: dayKey(-i), value: Math.max(0, Math.round(value)) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Denetim günlüğü                                                     */
/* ------------------------------------------------------------------ */

function makeAudit(): AuditEntry[] {
  const specs: [string, string, string, string, AdminRole, string][] = [
    ['moderation.remove', 'post', 'p_12', 'Gönderi kaldırıldı (şiddet içerikli)', 'moderator', 'Selin Aydın'],
    ['users.suspend', 'user', 'u_31', 'Kullanıcı 7 gün askıya alındı', 'moderator', 'Selin Aydın'],
    ['verification.approve', 'verification', 'ver_3', 'Eğitmen başvurusu onaylandı', 'admin', 'Deniz Kaya'],
    ['bookings.refund', 'booking', 'b_stay_2', 'Kısmi iade: 1.200 ₺', 'support', 'Ayşe Yıldırım'],
    ['content.publish', 'content', 'c_dest_d_kackar', 'Destinasyon yayınlandı', 'editor', 'Kerem Doğan'],
    ['settings.flag', 'flag', 'kids_module', 'Özellik bayrağı %60 yayına alındı', 'admin', 'Deniz Kaya'],
    ['sos.assign', 'sos', 'sos_x2', 'AKUT Rize ekibi atandı', 'support', 'Ayşe Yıldırım'],
    ['users.role', 'user', 'u_4', 'Editör rolü verildi', 'admin', 'Deniz Kaya'],
    ['moderation.approve', 'post', 'p_7', 'Bildirim reddedildi, içerik kaldı', 'moderator', 'Selin Aydın'],
    ['content.unpublish', 'content', 'c_news_n_3', 'Haber yayından kaldırıldı', 'editor', 'Kerem Doğan'],
    ['bookings.release', 'booking', 'b_stay_5', 'Emanet tutar işletmeye aktarıldı', 'admin', 'Deniz Kaya'],
    ['hazard.approve', 'hazard', 'hz_2', 'Tehlike bildirimi onaylandı', 'moderator', 'Selin Aydın'],
  ];
  return specs.map(([action, targetKind, targetId, summary, actorRole, actorName], i) => ({
    id: `aud_${i + 1}`,
    at: isoHoursAgo(round(2 + i * 5.3, 1)),
    actorId: adminAccounts.find((a) => a.name === actorName)?.id ?? 'adm_1',
    actorName,
    actorRole,
    action,
    targetKind,
    targetId,
    summary,
    reason: i % 3 === 0 ? 'Topluluk kuralları ihlali' : null,
    ip: `85.10.20.${20 + i}`,
  }));
}

/* ------------------------------------------------------------------ */
/* Depo                                                                */
/* ------------------------------------------------------------------ */

export interface MockStore {
  currentAccountId: ID;
  accounts: AdminAccount[];
  users: AdminUserRow[];
  userDetails: Map<ID, AdminUserDetail>;
  reports: ModerationReport[];
  moderationLog: ModerationLogEntry[];
  verifications: VerificationRequest[];
  bookings: AdminBookingRow[];
  disputes: Dispute[];
  sos: SosIncident[];
  hazards: AdminHazardRow[];
  contentRows: ContentRow[];
  contentDetails: Map<ID, ContentDetail>;
  campaigns: Campaign[];
  socialPosts: SocialPostItem[];
  referrals: ReferralStats;
  aso: AsoKeyword[];
  agentRuns: AgentRun[];
  agentPrs: AgentPullRequest[];
  findings: AgentFinding[];
  ci: CiRun[];
  health: SystemHealth;
  releases: ReleaseInfo[];
  settings: AdminSettings;
  audit: AuditEntry[];
}

let store: MockStore | null = null;

export function getStore(): MockStore {
  if (store) return store;
  const { rows: users, details: userDetails } = makeUserRows();
  const bookings = makeBookings(users);
  const { rows: contentRows, details: contentDetails } = makeContent();
  const campaigns = makeCampaigns();
  store = {
    currentAccountId: 'adm_1',
    accounts: adminAccounts,
    users,
    userDetails,
    reports: makeReports(users),
    moderationLog: [],
    verifications: makeVerifications(users),
    bookings,
    disputes: makeDisputes(bookings),
    sos: makeSosIncidents(users),
    hazards: makeHazards(users),
    contentRows,
    contentDetails,
    campaigns,
    socialPosts: makeSocialPosts(campaigns),
    referrals: makeReferrals(users),
    aso: makeAso(),
    agentRuns: makeAgentRuns(),
    agentPrs: makeAgentPrs(),
    findings: makeFindings(),
    ci: makeCi(),
    health: makeHealth(),
    releases: makeReleases(),
    settings: makeSettings(),
    audit: makeAudit(),
  };
  return store;
}

/** Kurtarma merkezi seçenekleri — olay konumuna göre mesafeyle. */
export function rescueOptions(coords: GeoPoint) {
  return seedEmergencyCenters
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type as string,
      locationName: c.locationName,
      phone: c.phone,
      distanceKm: round(distanceKm(coords, c.coords), 1),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);
}

export { isoDaysAgo, isoHoursAgo, isoDaysAhead, dayKey, hashString, round };
