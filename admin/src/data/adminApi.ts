/**
 * Yönetim paneli veri sözleşmesi.
 *
 * Panel, mobil uygulamayla **aynı alan modelini** kullanır: buradaki tipler
 * `src/domain/types.ts` ve `src/domain/enums.ts` içindeki tipleri yeniden
 * kullanır (kopyalamaz). `AdminApi` arayüzünün iki uygulaması vardır:
 *
 * - `mockAdminApi` — `src/data/mock/seed*.ts` tohum verisinden okur (varsayılan)
 * - `restAdminApi` — `VITE_ADMIN_API_URL` tanımlıysa gerçek sunucuya bağlanır
 *
 * Uygulama tarafındaki `DataProvider` (bkz. `src/data/repositories/index.ts`)
 * son kullanıcı işlemlerini modellerken, `AdminApi` aynı varlıkların yönetim
 * görünümünü ve yönetimsel eylemlerini modeller.
 */
import type {
  AdventureType,
  ArticleStatus,
  BookingStatus,
  BusinessType,
  GeoPoint,
  HazardSeverity,
  HazardType,
  ID,
  ISODate,
  PaymentStatus,
  Plan,
  SosStage,
  StayStatus,
  User,
} from '@/domain';

/* ------------------------------------------------------------------ */
/* Ortak                                                               */
/* ------------------------------------------------------------------ */

/** Panel kullanıcı rolleri; yetkiler `src/auth/roles.ts` içinde tanımlıdır. */
export type AdminRole = 'admin' | 'moderator' | 'editor' | 'support';

export interface AdminAccount {
  id: ID;
  name: string;
  email: string;
  role: AdminRole;
  avatarUrl: string | null;
  lastActiveAt: ISODate;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type SortDir = 'asc' | 'desc';

export interface PageQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  sort?: string;
  dir?: SortDir;
}

export interface TimePoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export type MetricRange = '7d' | '30d' | '90d';

/* ------------------------------------------------------------------ */
/* 1 — Panorama                                                        */
/* ------------------------------------------------------------------ */

export type KpiFormat = 'count' | 'currency' | 'percent' | 'duration';

export interface Kpi {
  key: string;
  value: number;
  deltaPct: number;
  format: KpiFormat;
}

export interface OverviewMetrics {
  range: MetricRange;
  generatedAt: ISODate;
  kpis: Kpi[];
  series: {
    dau: TimePoint[];
    signups: TimePoint[];
    posts: TimePoint[];
    routes: TimePoint[];
    bookings: TimePoint[];
    revenueTry: TimePoint[];
  };
  planBreakdown: { plan: Plan; users: number }[];
  moduleUsage: { module: string; sessions: number }[];
  openSosCount: number;
  moderationQueueCount: number;
  pendingVerificationCount: number;
  agentSummary: { running: number; succeeded24h: number; failed24h: number; openPrs: number };
}

/* ------------------------------------------------------------------ */
/* 2 — Kullanıcılar                                                    */
/* ------------------------------------------------------------------ */

export type AccountStatus = 'active' | 'suspended' | 'banned';

export interface AdminUserRow {
  id: ID;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  phone: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  plan: Plan;
  status: AccountStatus;
  /** Panel rolü; normal kullanıcıda null */
  role: AdminRole | null;
  trustScore: number;
  locationName: string;
  countryCode: string;
  joinedAt: ISODate;
  lastSeenAt: ISODate;
  postsCount: number;
  reportsAgainst: number;
}

export interface AdminSession {
  id: ID;
  device: string;
  platform: 'ios' | 'android' | 'web';
  ip: string;
  lastActiveAt: ISODate;
  current: boolean;
}

export interface AdminUserDetail extends AdminUserRow {
  /** Uygulamanın kendi kullanıcı kaydı */
  profile: User;
  bio: string;
  coords: GeoPoint;
  totalDistanceKm: number;
  totalAdventures: number;
  followersCount: number;
  followingCount: number;
  favoriteTypes: AdventureType[];
  suspendedUntil: ISODate | null;
  statusReason: string | null;
  sessions: AdminSession[];
  recentActivity: { id: ID; at: ISODate; kind: string; summary: string }[];
  notes: { id: ID; at: ISODate; author: string; text: string }[];
}

export interface UserQuery extends PageQuery {
  plan?: Plan | 'all';
  status?: AccountStatus | 'all';
  role?: AdminRole | 'all' | 'none';
  phoneVerified?: 'all' | 'yes' | 'no';
}

/* ------------------------------------------------------------------ */
/* 3 — Moderasyon                                                      */
/* ------------------------------------------------------------------ */

export type ReportTargetKind = 'post' | 'comment' | 'message' | 'article' | 'question';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'nudity'
  | 'violence'
  | 'misinformation'
  | 'illegal'
  | 'other';
export type ReportStatus = 'open' | 'approved' | 'removed' | 'warned' | 'escalated';
export type ModerationAction = 'approve' | 'remove' | 'warn' | 'escalate';

export interface ModerationReport {
  id: ID;
  targetKind: ReportTargetKind;
  targetId: ID;
  excerpt: string;
  imageUrl: string | null;
  authorId: ID;
  authorName: string;
  authorAvatarUrl: string | null;
  authorTrustScore: number;
  reason: ReportReason;
  reportCount: number;
  reporters: { id: ID; name: string }[];
  severity: 'low' | 'medium' | 'high';
  status: ReportStatus;
  locationName: string;
  createdAt: ISODate;
  decidedAt: ISODate | null;
  decidedBy: string | null;
}

export interface ModerationQuery extends PageQuery {
  targetKind?: ReportTargetKind | 'all';
  reason?: ReportReason | 'all';
  status?: ReportStatus | 'all';
  severity?: 'low' | 'medium' | 'high' | 'all';
}

export interface ModerationLogEntry {
  id: ID;
  at: ISODate;
  reportId: ID;
  targetKind: ReportTargetKind;
  targetId: ID;
  action: ModerationAction;
  moderator: string;
  reason: string;
}

/* ------------------------------------------------------------------ */
/* 4 — Doğrulama talepleri                                             */
/* ------------------------------------------------------------------ */

export type VerificationKind = 'instructor' | 'business' | 'club' | 'doctor' | 'writer';
export type VerificationStatusAdmin = 'pending' | 'approved' | 'rejected' | 'more_info';
export type VerificationDocKind =
  | 'id_card'
  | 'certificate'
  | 'license'
  | 'tax_record'
  | 'diploma'
  | 'portfolio'
  | 'insurance';

export interface VerificationDocument {
  id: ID;
  kind: VerificationDocKind;
  fileName: string;
  sizeKb: number;
  uploadedAt: ISODate;
  /** Demo ortamında oluşturulan önizleme metni */
  preview: string;
}

export interface VerificationRequest {
  id: ID;
  kind: VerificationKind;
  applicantId: ID;
  applicantName: string;
  applicantAvatarUrl: string | null;
  subjectName: string;
  subjectType: BusinessType | AdventureType | string;
  locationName: string;
  submittedAt: ISODate;
  status: VerificationStatusAdmin;
  documents: VerificationDocument[];
  fields: { label: string; value: string }[];
  applicantNote: string;
  decidedAt: ISODate | null;
  decidedBy: string | null;
  decisionReason: string | null;
}

export interface VerificationQuery extends PageQuery {
  kind?: VerificationKind | 'all';
  status?: VerificationStatusAdmin | 'all';
}

/* ------------------------------------------------------------------ */
/* 5 — Rezervasyon & ödeme                                             */
/* ------------------------------------------------------------------ */

export type BookingKind = 'stay' | 'instructor' | 'course';

export interface AdminBookingRow {
  id: ID;
  reference: string;
  kind: BookingKind;
  guestId: ID;
  guestName: string;
  providerId: ID;
  providerName: string;
  startAt: ISODate;
  endAt: ISODate;
  guests: number;
  nights: number;
  totalTry: number;
  platformFeeTry: number;
  commissionPct: number;
  refundedTry: number;
  status: StayStatus | BookingStatus;
  paymentStatus: PaymentStatus;
  provider: 'iyzico' | 'stripe' | 'mock';
  disputed: boolean;
  createdAt: ISODate;
  timeline: { status: PaymentStatus; at: ISODate }[];
}

export interface BookingQuery extends PageQuery {
  kind?: BookingKind | 'all';
  paymentStatus?: PaymentStatus | 'all';
  disputed?: 'all' | 'yes' | 'no';
}

export interface RefundInput {
  bookingId: ID;
  amountTry: number;
  reason: string;
}

export type DisputeOutcome = 'refund_guest' | 'release_provider' | 'split';

export interface Dispute {
  id: ID;
  bookingId: ID;
  reference: string;
  openedById: ID;
  openedByName: string;
  againstName: string;
  reason: string;
  amountTry: number;
  openedAt: ISODate;
  status: 'open' | 'resolved';
  outcome: DisputeOutcome | null;
  note: string | null;
}

export interface CommissionReport {
  range: MetricRange;
  grossTry: number;
  commissionTry: number;
  netTry: number;
  refundedTry: number;
  bookings: number;
  byKind: { kind: BookingKind; grossTry: number; commissionTry: number; bookings: number }[];
  byMonth: { month: string; grossTry: number; commissionTry: number }[];
}

/* ------------------------------------------------------------------ */
/* 6 — SOS & güvenlik                                                  */
/* ------------------------------------------------------------------ */

export interface SosIncident {
  id: ID;
  userId: ID;
  userName: string;
  userPhone: string;
  coords: GeoPoint;
  locationName: string;
  altitudeM: number;
  stage: SosStage;
  source: 'app' | 'satellite' | 'watch';
  batteryPct: number;
  notifiedContacts: number;
  startedAt: ISODate;
  resolvedAt: ISODate | null;
  assignedCenterId: ID | null;
  assignedCenterName: string | null;
  timeline: { at: ISODate; label: string; actor: string }[];
}

export interface RescueCenterOption {
  id: ID;
  name: string;
  type: string;
  locationName: string;
  phone: string | null;
  distanceKm: number;
}

export interface AdminHazardRow {
  id: ID;
  type: HazardType;
  severity: HazardSeverity;
  title: string;
  description: string;
  locationName: string;
  coords: GeoPoint;
  radiusM: number;
  reporterId: ID;
  reporterName: string;
  reporterTrustScore: number;
  confirmations: number;
  createdAt: ISODate;
  /** Panelde onaylanma durumu */
  review: 'pending' | 'approved' | 'rejected';
  resolvedAt: ISODate | null;
}

export interface HazardQuery extends PageQuery {
  severity?: HazardSeverity | 'all';
  review?: 'pending' | 'approved' | 'rejected' | 'all';
}

/* ------------------------------------------------------------------ */
/* 7 — İçerik                                                          */
/* ------------------------------------------------------------------ */

export type ContentKind =
  | 'destination'
  | 'heritage'
  | 'species'
  | 'course'
  | 'tv_program'
  | 'news'
  | 'article';

export type ContentStatus = 'draft' | 'published' | 'archived';

export interface ContentRow {
  id: ID;
  kind: ContentKind;
  title: string;
  subtitle: string;
  status: ContentStatus;
  coverUrl: string | null;
  region: string;
  updatedAt: ISODate;
  /** Tamamlanan dil sayısı / toplam dil */
  translatedCount: number;
  localeCount: number;
  missingLocales: string[];
  views: number;
}

export interface ContentDetail extends ContentRow {
  body: string;
  fields: { key: string; label: string; value: string }[];
  translations: { locale: string; complete: boolean; missingFields: string[] }[];
}

export interface ContentQuery extends PageQuery {
  kind?: ContentKind | 'all';
  status?: ContentStatus | 'all';
  /** Yalnızca çevirisi eksik kayıtlar */
  missingOnly?: boolean;
}

export interface ContentPatch {
  title?: string;
  subtitle?: string;
  body?: string;
  status?: ContentStatus;
}

export interface CreateContentInput {
  kind: ContentKind;
  title: string;
  subtitle: string;
  body: string;
  region: string;
  status: ContentStatus;
}

/* ------------------------------------------------------------------ */
/* 8 — Pazarlama                                                       */
/* ------------------------------------------------------------------ */

export type MarketingChannel =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'x'
  | 'newsletter'
  | 'app_store';

export interface Campaign {
  id: ID;
  name: string;
  channel: MarketingChannel;
  startAt: ISODate;
  endAt: ISODate;
  budgetTry: number;
  spentTry: number;
  status: 'planned' | 'running' | 'paused' | 'done';
  goal: string;
  installs: number;
  signups: number;
  roiPct: number;
}

export interface SocialPostItem {
  id: ID;
  channel: MarketingChannel;
  body: string;
  scheduledAt: ISODate;
  status: 'draft' | 'queued' | 'published' | 'failed';
  impressions: number;
  clicks: number;
  likes: number;
  campaignId: ID | null;
}

export interface ReferralStats {
  invitesSent: number;
  accepted: number;
  conversionPct: number;
  rewardTry: number;
  series: TimePoint[];
  topInviters: { userId: ID; name: string; invites: number; joined: number }[];
}

export interface AsoKeyword {
  keyword: string;
  locale: string;
  rank: number;
  prevRank: number;
  volume: number;
  difficulty: number;
}

export interface MarketingQuery extends PageQuery {
  channel?: MarketingChannel | 'all';
  status?: SocialPostItem['status'] | 'all';
}

/* ------------------------------------------------------------------ */
/* 9 — Ajanlar & sistem sağlığı                                        */
/* ------------------------------------------------------------------ */

export interface AgentRun {
  id: ID;
  agent: string;
  task: string;
  status: 'running' | 'success' | 'failed';
  startedAt: ISODate;
  finishedAt: ISODate | null;
  durationSec: number;
  filesChanged: number;
  prNumber: number | null;
  findings: number;
}

export interface AgentPullRequest {
  number: number;
  title: string;
  agent: string;
  status: 'open' | 'merged' | 'closed';
  checks: 'passing' | 'failing' | 'pending';
  openedAt: ISODate;
  additions: number;
  deletions: number;
}

export interface AgentFinding {
  id: ID;
  agent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  area: string;
  foundAt: ISODate;
  status: 'open' | 'fixed' | 'wontfix';
}

export interface CiRun {
  id: ID;
  pipeline: string;
  branch: string;
  status: 'passing' | 'failing' | 'running';
  durationSec: number;
  at: ISODate;
  commit: string;
}

export interface SystemHealth {
  errorRatePct: number;
  p95Ms: number;
  crashFreePct: number;
  uptimePct: number;
  errorSeries: TimePoint[];
  latencySeries: TimePoint[];
}

export interface ReleaseInfo {
  version: string;
  channel: 'production' | 'beta';
  releasedAt: ISODate;
  adoptionPct: number;
  crashFreePct: number;
  current: boolean;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* 10 — Ayarlar                                                        */
/* ------------------------------------------------------------------ */

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  rolloutPct: number;
  audience: 'all' | 'pro' | 'internal';
  updatedAt: ISODate;
}

export interface RateLimitRule {
  key: string;
  label: string;
  perMinute: number;
}

export interface CommissionRule {
  key: string;
  label: string;
  pct: number;
}

export interface AdminSettings {
  flags: FeatureFlag[];
  maintenance: { enabled: boolean; message: string; until: ISODate | null };
  announcement: {
    enabled: boolean;
    message: string;
    level: 'info' | 'warning' | 'critical';
    url: string | null;
  };
  rateLimits: RateLimitRule[];
  commissions: CommissionRule[];
}

export interface SettingsPatch {
  flags?: { key: string; enabled?: boolean; rolloutPct?: number; audience?: FeatureFlag['audience'] }[];
  maintenance?: Partial<AdminSettings['maintenance']>;
  announcement?: Partial<AdminSettings['announcement']>;
  rateLimits?: { key: string; perMinute: number }[];
  commissions?: { key: string; pct: number }[];
}

/* ------------------------------------------------------------------ */
/* Denetim günlüğü                                                     */
/* ------------------------------------------------------------------ */

export interface AuditEntry {
  id: ID;
  at: ISODate;
  actorId: ID;
  actorName: string;
  actorRole: AdminRole;
  action: string;
  targetKind: string;
  targetId: string;
  summary: string;
  reason: string | null;
  ip: string;
}

export interface AuditQuery extends PageQuery {
  actorId?: ID | 'all';
  targetKind?: string | 'all';
}

/* ------------------------------------------------------------------ */
/* Arayüz                                                              */
/* ------------------------------------------------------------------ */

export interface AdminApi {
  /** Uygulamanın adı — panelde hangi kaynağa bağlı olduğunu gösterir */
  readonly source: 'mock' | 'rest';

  auth: {
    /** Panelde oturum açmış yönetici */
    me(): Promise<AdminAccount>;
    /** Rol değiştirme (demo: gerçek sunucuda oturum açma ile gelir) */
    signInAs(accountId: ID): Promise<AdminAccount>;
    accounts(): Promise<AdminAccount[]>;
  };

  metrics: {
    overview(range: MetricRange): Promise<OverviewMetrics>;
  };

  users: {
    list(query: UserQuery): Promise<Paged<AdminUserRow>>;
    get(id: ID): Promise<AdminUserDetail | null>;
    setStatus(id: ID, status: AccountStatus, reason: string, days?: number): Promise<AdminUserRow>;
    setRole(id: ID, role: AdminRole | null, reason: string): Promise<AdminUserRow>;
    setPlan(id: ID, plan: Plan, reason: string): Promise<AdminUserRow>;
    revokeSessions(id: ID, reason: string): Promise<AdminUserDetail>;
    addNote(id: ID, text: string): Promise<AdminUserDetail>;
  };

  moderation: {
    list(query: ModerationQuery): Promise<Paged<ModerationReport>>;
    act(ids: ID[], action: ModerationAction, reason: string): Promise<ModerationReport[]>;
    log(query: PageQuery): Promise<Paged<ModerationLogEntry>>;
  };

  verification: {
    list(query: VerificationQuery): Promise<Paged<VerificationRequest>>;
    get(id: ID): Promise<VerificationRequest | null>;
    decide(
      id: ID,
      status: Exclude<VerificationStatusAdmin, 'pending'>,
      reason: string,
    ): Promise<VerificationRequest>;
  };

  bookings: {
    list(query: BookingQuery): Promise<Paged<AdminBookingRow>>;
    get(id: ID): Promise<AdminBookingRow | null>;
    /** Emanetteki tutarı hizmet sağlayıcıya aktarır */
    release(id: ID, reason: string): Promise<AdminBookingRow>;
    refund(input: RefundInput): Promise<AdminBookingRow>;
    disputes(query: PageQuery): Promise<Paged<Dispute>>;
    resolveDispute(id: ID, outcome: DisputeOutcome, note: string): Promise<Dispute>;
    commission(range: MetricRange): Promise<CommissionReport>;
  };

  sos: {
    incidents(query: PageQuery & { status?: 'open' | 'resolved' | 'all' }): Promise<
      Paged<SosIncident>
    >;
    get(id: ID): Promise<SosIncident | null>;
    centers(id: ID): Promise<RescueCenterOption[]>;
    assignCenter(id: ID, centerId: ID, note: string): Promise<SosIncident>;
    resolve(id: ID, note: string): Promise<SosIncident>;
    hazards(query: HazardQuery): Promise<Paged<AdminHazardRow>>;
    reviewHazard(id: ID, review: 'approved' | 'rejected', reason: string): Promise<AdminHazardRow>;
  };

  content: {
    list(query: ContentQuery): Promise<Paged<ContentRow>>;
    get(id: ID): Promise<ContentDetail | null>;
    create(input: CreateContentInput): Promise<ContentDetail>;
    update(id: ID, patch: ContentPatch, reason: string): Promise<ContentDetail>;
    setStatus(id: ID, status: ContentStatus, reason: string): Promise<ContentRow>;
  };

  marketing: {
    campaigns(query: MarketingQuery): Promise<Paged<Campaign>>;
    posts(query: MarketingQuery): Promise<Paged<SocialPostItem>>;
    schedulePost(id: ID, scheduledAt: ISODate): Promise<SocialPostItem>;
    setPostStatus(id: ID, status: SocialPostItem['status']): Promise<SocialPostItem>;
    referrals(): Promise<ReferralStats>;
    aso(): Promise<AsoKeyword[]>;
  };

  agents: {
    runs(query: PageQuery): Promise<Paged<AgentRun>>;
    pullRequests(): Promise<AgentPullRequest[]>;
    findings(query: PageQuery): Promise<Paged<AgentFinding>>;
    ci(): Promise<CiRun[]>;
    health(): Promise<SystemHealth>;
    releases(): Promise<ReleaseInfo[]>;
    rollback(version: string, reason: string): Promise<ReleaseInfo[]>;
  };

  settings: {
    get(): Promise<AdminSettings>;
    update(patch: SettingsPatch, reason: string): Promise<AdminSettings>;
  };

  audit: {
    list(query: AuditQuery): Promise<Paged<AuditEntry>>;
  };
}

/** Uygulamanın kullandığı makale durumları panelde de görünür (içerik ekranı). */
export type { ArticleStatus };
