/**
 * `AdminApi`'nin tohum veriye dayalı uygulaması (varsayılan).
 * Gerçekçi ağ gecikmesi taklit edilir ve her tehlikeli işlem denetim günlüğüne yazılır.
 */
import type { ID, ISODate } from '@/domain';

import type {
  AccountStatus,
  AdminApi,
  AdminBookingRow,
  AdminHazardRow,
  AdminRole,
  AdminSettings,
  AdminUserDetail,
  AdminUserRow,
  AuditEntry,
  CommissionReport,
  ContentDetail,
  ContentPatch,
  ContentRow,
  ContentStatus,
  CreateContentInput,
  Dispute,
  DisputeOutcome,
  Kpi,
  MetricRange,
  ModerationAction,
  ModerationReport,
  OverviewMetrics,
  Paged,
  PageQuery,
  RefundInput,
  SocialPostItem,
  SosIncident,
  VerificationRequest,
  VerificationStatusAdmin,
} from './adminApi';
import { buildSeries, getStore, rescueOptions } from './mockStore';

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

const BASE_LATENCY = 90;

function delay<T>(value: T, weight = 1): Promise<T> {
  const ms = BASE_LATENCY * weight + Math.random() * 160;
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

function nowIso(): ISODate {
  return new Date().toISOString();
}

function matchesQuery(haystack: string[], query?: string): boolean {
  if (!query || !query.trim()) return true;
  const needle = query.trim().toLocaleLowerCase('tr');
  return haystack.some((field) => field.toLocaleLowerCase('tr').includes(needle));
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), 'tr');
}

export function paginate<T>(items: T[], query: PageQuery, sortKey?: (item: T, key: string) => unknown): Paged<T> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, query.pageSize ?? 20));
  let list = items;
  if (query.sort && sortKey) {
    const dir = query.dir === 'asc' ? 1 : -1;
    list = [...items].sort((a, b) => compare(sortKey(a, query.sort as string), sortKey(b, query.sort as string)) * dir);
  }
  const start = (page - 1) * pageSize;
  return { items: list.slice(start, start + pageSize), total: list.length, page, pageSize };
}

let auditCounter = 0;

function record(
  action: string,
  targetKind: string,
  targetId: string,
  summary: string,
  reason: string | null,
): AuditEntry {
  const store = getStore();
  const account = store.accounts.find((a) => a.id === store.currentAccountId) ?? store.accounts[0];
  auditCounter += 1;
  const entry: AuditEntry = {
    id: `aud_live_${auditCounter}`,
    at: nowIso(),
    actorId: account?.id ?? 'adm_1',
    actorName: account?.name ?? 'Bilinmeyen',
    actorRole: (account?.role ?? 'admin') as AdminRole,
    action,
    targetKind,
    targetId,
    summary,
    reason: reason && reason.trim() ? reason.trim() : null,
    ip: '85.10.20.11',
  };
  store.audit.unshift(entry);
  return entry;
}

function rangeDays(range: MetricRange): number {
  return range === '7d' ? 7 : range === '30d' ? 30 : 90;
}

/* ------------------------------------------------------------------ */
/* Uygulama                                                            */
/* ------------------------------------------------------------------ */

export const mockAdminApi: AdminApi = {
  source: 'mock',

  auth: {
    async me() {
      const store = getStore();
      const account = store.accounts.find((a) => a.id === store.currentAccountId) ?? store.accounts[0];
      if (!account) throw new Error('Panel hesabı bulunamadı');
      return delay(account, 0.4);
    },
    async signInAs(accountId) {
      const store = getStore();
      const account = store.accounts.find((a) => a.id === accountId);
      if (!account) throw new Error('Hesap bulunamadı');
      store.currentAccountId = accountId;
      record('auth.switch_role', 'account', accountId, `Panel rolü değişti: ${account.role}`, null);
      return delay(account, 0.4);
    },
    async accounts() {
      return delay(getStore().accounts, 0.3);
    },
  },

  metrics: {
    async overview(range) {
      const store = getStore();
      const days = rangeDays(range);
      const dau = buildSeries(11, days, 4200, 0.34, 0.22);
      const signups = buildSeries(12, days, 260, 0.5, 0.4);
      const posts = buildSeries(13, days, 940, 0.28, 0.3);
      const routes = buildSeries(14, days, 380, 0.42, 0.35);
      const bookings = buildSeries(15, days, 74, 0.6, 0.45);
      const revenueTry = buildSeries(16, days, 38_000, 0.55, 0.3);

      const sum = (list: { value: number }[]) => list.reduce((s, p) => s + p.value, 0);
      const half = (list: { value: number }[]) => {
        const mid = Math.floor(list.length / 2);
        const first = sum(list.slice(0, mid));
        const second = sum(list.slice(mid));
        return first === 0 ? 0 : Math.round(((second - first) / first) * 1000) / 10;
      };

      const last = (list: { value: number }[]) => list[list.length - 1]?.value ?? 0;

      const kpis: Kpi[] = [
        { key: 'dau', value: last(dau), deltaPct: half(dau), format: 'count' },
        { key: 'signups', value: sum(signups), deltaPct: half(signups), format: 'count' },
        { key: 'posts', value: sum(posts), deltaPct: half(posts), format: 'count' },
        { key: 'routes', value: sum(routes), deltaPct: half(routes), format: 'count' },
        { key: 'bookings', value: sum(bookings), deltaPct: half(bookings), format: 'count' },
        { key: 'revenue', value: sum(revenueTry), deltaPct: half(revenueTry), format: 'currency' },
      ];

      const planBreakdown = (['free', 'pro', 'pro_guide', 'business'] as const).map((plan) => ({
        plan,
        users: store.users.filter((u) => u.plan === plan).length,
      }));

      const metrics: OverviewMetrics = {
        range,
        generatedAt: nowIso(),
        kpis,
        series: { dau, signups, posts, routes, bookings, revenueTry },
        planBreakdown,
        moduleUsage: [
          { module: 'Akış', sessions: 18_420 },
          { module: 'Haritalar', sessions: 12_960 },
          { module: 'Destinasyonlar', sessions: 9_640 },
          { module: 'Rotalar', sessions: 8_310 },
          { module: 'Tırmanış', sessions: 5_120 },
          { module: 'Zirtan TV', sessions: 4_480 },
          { module: 'Kulüpler', sessions: 3_260 },
          { module: 'Tele-tıp', sessions: 1_540 },
        ],
        openSosCount: store.sos.filter((s) => s.stage !== 'resolved').length,
        moderationQueueCount: store.reports.filter((r) => r.status === 'open').length,
        pendingVerificationCount: store.verifications.filter((v) => v.status === 'pending').length,
        agentSummary: {
          running: store.agentRuns.filter((r) => r.status === 'running').length,
          succeeded24h: store.agentRuns.filter(
            (r) => r.status === 'success' && Date.parse(r.startedAt) > Date.now() - 86_400_000,
          ).length,
          failed24h: store.agentRuns.filter(
            (r) => r.status === 'failed' && Date.parse(r.startedAt) > Date.now() - 86_400_000,
          ).length,
          openPrs: store.agentPrs.filter((p) => p.status === 'open').length,
        },
      };
      return delay(metrics, 1.4);
    },
  },

  users: {
    async list(query) {
      const store = getStore();
      const filtered = store.users.filter((u) => {
        if (query.plan && query.plan !== 'all' && u.plan !== query.plan) return false;
        if (query.status && query.status !== 'all' && u.status !== query.status) return false;
        if (query.role && query.role !== 'all') {
          if (query.role === 'none' ? u.role !== null : u.role !== query.role) return false;
        }
        if (query.phoneVerified && query.phoneVerified !== 'all') {
          const want = query.phoneVerified === 'yes';
          if (u.phoneVerified !== want) return false;
        }
        return matchesQuery([u.displayName, u.username, u.email, u.locationName, u.id], query.query);
      });
      return delay(
        paginate(filtered, { ...query, sort: query.sort ?? 'lastSeenAt' }, (u, key) => {
          switch (key) {
            case 'displayName':
              return u.displayName;
            case 'plan':
              return u.plan;
            case 'status':
              return u.status;
            case 'trustScore':
              return u.trustScore;
            case 'joinedAt':
              return u.joinedAt;
            case 'postsCount':
              return u.postsCount;
            case 'reportsAgainst':
              return u.reportsAgainst;
            default:
              return u.lastSeenAt;
          }
        }),
        1,
      );
    },

    async get(id) {
      const detail = getStore().userDetails.get(id) ?? null;
      return delay(detail, 0.8);
    },

    async setStatus(id, status: AccountStatus, reason, days) {
      const store = getStore();
      const row = store.users.find((u) => u.id === id);
      const detail = store.userDetails.get(id);
      if (!row || !detail) throw new Error('Kullanıcı bulunamadı');
      row.status = status;
      detail.status = status;
      detail.statusReason = reason;
      detail.suspendedUntil =
        status === 'suspended' && days ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
      const label =
        status === 'active' ? 'Hesap yeniden etkinleştirildi' : status === 'suspended' ? `Hesap ${days ?? 7} gün askıya alındı` : 'Hesap yasaklandı';
      record('users.status', 'user', id, `${row.displayName}: ${label}`, reason);
      return delay(row, 0.7);
    },

    async setRole(id, role, reason) {
      const store = getStore();
      const row = store.users.find((u) => u.id === id);
      const detail = store.userDetails.get(id);
      if (!row || !detail) throw new Error('Kullanıcı bulunamadı');
      row.role = role;
      detail.role = role;
      record('users.role', 'user', id, `${row.displayName}: rol → ${role ?? 'yok'}`, reason);
      return delay(row, 0.7);
    },

    async setPlan(id, plan, reason) {
      const store = getStore();
      const row = store.users.find((u) => u.id === id);
      const detail = store.userDetails.get(id);
      if (!row || !detail) throw new Error('Kullanıcı bulunamadı');
      row.plan = plan;
      detail.plan = plan;
      record('users.plan', 'user', id, `${row.displayName}: plan → ${plan}`, reason);
      return delay(row, 0.7);
    },

    async revokeSessions(id, reason) {
      const store = getStore();
      const detail = store.userDetails.get(id);
      if (!detail) throw new Error('Kullanıcı bulunamadı');
      detail.sessions = [];
      record('users.revoke_sessions', 'user', id, `${detail.displayName}: tüm oturumlar kapatıldı`, reason);
      return delay(detail, 0.7);
    },

    async addNote(id, text) {
      const store = getStore();
      const detail = store.userDetails.get(id);
      if (!detail) throw new Error('Kullanıcı bulunamadı');
      const account = store.accounts.find((a) => a.id === store.currentAccountId);
      detail.notes = [
        { id: `note_${detail.notes.length + 1}`, at: nowIso(), author: account?.name ?? '—', text },
        ...detail.notes,
      ];
      record('users.note', 'user', id, `${detail.displayName}: not eklendi`, null);
      return delay(detail, 0.5);
    },
  },

  moderation: {
    async list(query) {
      const store = getStore();
      const filtered = store.reports.filter((r) => {
        if (query.targetKind && query.targetKind !== 'all' && r.targetKind !== query.targetKind) return false;
        if (query.reason && query.reason !== 'all' && r.reason !== query.reason) return false;
        if (query.status && query.status !== 'all' && r.status !== query.status) return false;
        if (query.severity && query.severity !== 'all' && r.severity !== query.severity) return false;
        return matchesQuery([r.excerpt, r.authorName, r.locationName, r.targetId], query.query);
      });
      return delay(
        paginate(filtered, { ...query, sort: query.sort ?? 'createdAt' }, (r, key) => {
          switch (key) {
            case 'reportCount':
              return r.reportCount;
            case 'severity':
              return { low: 0, medium: 1, high: 2 }[r.severity];
            case 'authorName':
              return r.authorName;
            case 'status':
              return r.status;
            default:
              return r.createdAt;
          }
        }),
        1,
      );
    },

    async act(ids, action: ModerationAction, reason) {
      const store = getStore();
      const account = store.accounts.find((a) => a.id === store.currentAccountId);
      const updated: ModerationReport[] = [];
      for (const id of ids) {
        const report = store.reports.find((r) => r.id === id);
        if (!report) continue;
        report.status =
          action === 'approve' ? 'approved' : action === 'remove' ? 'removed' : action === 'warn' ? 'warned' : 'escalated';
        report.decidedAt = nowIso();
        report.decidedBy = account?.name ?? '—';
        store.moderationLog.unshift({
          id: `mlog_${store.moderationLog.length + 1}`,
          at: nowIso(),
          reportId: report.id,
          targetKind: report.targetKind,
          targetId: report.targetId,
          action,
          moderator: account?.name ?? '—',
          reason,
        });
        updated.push(report);
      }
      record(
        `moderation.${action}`,
        'report',
        ids.join(','),
        `${ids.length} bildirim işlendi: ${action}`,
        reason,
      );
      return delay(updated, 0.9);
    },

    async log(query) {
      const store = getStore();
      const all = store.moderationLog.filter((l) => matchesQuery([l.moderator, l.targetId, l.reason], query.query));
      return delay(paginate(all, { ...query, sort: query.sort ?? 'at' }, (l) => l.at), 0.6);
    },
  },

  verification: {
    async list(query) {
      const store = getStore();
      const filtered = store.verifications.filter((v) => {
        if (query.kind && query.kind !== 'all' && v.kind !== query.kind) return false;
        if (query.status && query.status !== 'all' && v.status !== query.status) return false;
        return matchesQuery([v.applicantName, v.subjectName, v.locationName, v.id], query.query);
      });
      return delay(
        paginate(filtered, { ...query, sort: query.sort ?? 'submittedAt' }, (v, key) => {
          switch (key) {
            case 'applicantName':
              return v.applicantName;
            case 'kind':
              return v.kind;
            case 'status':
              return v.status;
            default:
              return v.submittedAt;
          }
        }),
        0.9,
      );
    },

    async get(id) {
      return delay(getStore().verifications.find((v) => v.id === id) ?? null, 0.5);
    },

    async decide(id, status: Exclude<VerificationStatusAdmin, 'pending'>, reason) {
      const store = getStore();
      const request = store.verifications.find((v) => v.id === id);
      if (!request) throw new Error('Başvuru bulunamadı');
      const account = store.accounts.find((a) => a.id === store.currentAccountId);
      request.status = status;
      request.decidedAt = nowIso();
      request.decidedBy = account?.name ?? '—';
      request.decisionReason = reason || null;
      if (status === 'approved') {
        const user = store.users.find((u) => u.id === request.applicantId);
        const detail = store.userDetails.get(request.applicantId);
        if (user && request.kind === 'instructor') {
          user.plan = 'pro_guide';
          if (detail) detail.plan = 'pro_guide';
        }
        if (user && request.kind === 'business') {
          user.plan = 'business';
          if (detail) detail.plan = 'business';
        }
      }
      record(`verification.${status}`, 'verification', id, `${request.subjectName} (${request.kind})`, reason);
      return delay(request as VerificationRequest, 0.8);
    },
  },

  bookings: {
    async list(query) {
      const store = getStore();
      const filtered = store.bookings.filter((b) => {
        if (query.kind && query.kind !== 'all' && b.kind !== query.kind) return false;
        if (query.paymentStatus && query.paymentStatus !== 'all' && b.paymentStatus !== query.paymentStatus) return false;
        if (query.disputed && query.disputed !== 'all') {
          const want = query.disputed === 'yes';
          if (b.disputed !== want) return false;
        }
        return matchesQuery([b.reference, b.guestName, b.providerName, b.id], query.query);
      });
      return delay(
        paginate(filtered, { ...query, sort: query.sort ?? 'createdAt' }, (b, key) => {
          switch (key) {
            case 'totalTry':
              return b.totalTry;
            case 'guestName':
              return b.guestName;
            case 'providerName':
              return b.providerName;
            case 'paymentStatus':
              return b.paymentStatus;
            case 'startAt':
              return b.startAt;
            default:
              return b.createdAt;
          }
        }),
        1,
      );
    },

    async get(id) {
      return delay(getStore().bookings.find((b) => b.id === id) ?? null, 0.5);
    },

    async release(id, reason) {
      const store = getStore();
      const booking = store.bookings.find((b) => b.id === id);
      if (!booking) throw new Error('Rezervasyon bulunamadı');
      if (booking.paymentStatus === 'refunded') throw new Error('İade edilmiş ödeme aktarılamaz');
      booking.paymentStatus = 'released';
      booking.timeline = [...booking.timeline, { status: 'released', at: nowIso() }];
      record('bookings.release', 'booking', id, `${booking.reference}: emanet aktarıldı (${booking.totalTry} ₺)`, reason);
      return delay(booking as AdminBookingRow, 0.9);
    },

    async refund(input: RefundInput) {
      const store = getStore();
      const booking = store.bookings.find((b) => b.id === input.bookingId);
      if (!booking) throw new Error('Rezervasyon bulunamadı');
      const remaining = booking.totalTry - booking.refundedTry;
      if (input.amountTry <= 0 || input.amountTry > remaining) {
        throw new Error(`İade tutarı 1–${remaining} ₺ aralığında olmalı`);
      }
      booking.refundedTry += input.amountTry;
      booking.paymentStatus = 'refunded';
      booking.status = 'cancelled';
      booking.timeline = [...booking.timeline, { status: 'refunded', at: nowIso() }];
      record(
        'bookings.refund',
        'booking',
        booking.id,
        `${booking.reference}: ${input.amountTry} ₺ iade edildi`,
        input.reason,
      );
      return delay(booking as AdminBookingRow, 1);
    },

    async disputes(query) {
      const store = getStore();
      const filtered = store.disputes.filter((d) =>
        matchesQuery([d.reference, d.openedByName, d.againstName, d.reason], query.query),
      );
      return delay(paginate(filtered, { ...query, sort: query.sort ?? 'openedAt' }, (d) => d.openedAt), 0.7);
    },

    async resolveDispute(id, outcome: DisputeOutcome, note) {
      const store = getStore();
      const dispute = store.disputes.find((d) => d.id === id);
      if (!dispute) throw new Error('Uyuşmazlık bulunamadı');
      dispute.status = 'resolved';
      dispute.outcome = outcome;
      dispute.note = note;
      const booking = store.bookings.find((b) => b.id === dispute.bookingId);
      if (booking) {
        booking.disputed = false;
        if (outcome === 'refund_guest') {
          booking.refundedTry = booking.totalTry;
          booking.paymentStatus = 'refunded';
        } else if (outcome === 'release_provider') {
          booking.paymentStatus = 'released';
        }
      }
      record('bookings.dispute', 'dispute', id, `${dispute.reference}: ${outcome}`, note);
      return delay(dispute as Dispute, 0.9);
    },

    async commission(range) {
      const store = getStore();
      const since = Date.now() - rangeDays(range) * 86_400_000;
      const rows = store.bookings.filter((b) => Date.parse(b.createdAt) >= since);
      const grossTry = rows.reduce((s, b) => s + b.totalTry, 0);
      const commissionTry = rows.reduce((s, b) => s + b.platformFeeTry, 0);
      const refundedTry = rows.reduce((s, b) => s + b.refundedTry, 0);
      const kinds: CommissionReport['byKind'] = (['stay', 'instructor', 'course'] as const).map((kind) => {
        const subset = rows.filter((b) => b.kind === kind);
        return {
          kind,
          grossTry: subset.reduce((s, b) => s + b.totalTry, 0),
          commissionTry: subset.reduce((s, b) => s + b.platformFeeTry, 0),
          bookings: subset.length,
        };
      });
      const byMonth = new Map<string, { grossTry: number; commissionTry: number }>();
      for (const b of rows) {
        const month = b.createdAt.slice(0, 7);
        const entry = byMonth.get(month) ?? { grossTry: 0, commissionTry: 0 };
        entry.grossTry += b.totalTry;
        entry.commissionTry += b.platformFeeTry;
        byMonth.set(month, entry);
      }
      const report: CommissionReport = {
        range,
        grossTry,
        commissionTry,
        netTry: grossTry - commissionTry - refundedTry,
        refundedTry,
        bookings: rows.length,
        byKind: kinds,
        byMonth: [...byMonth.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, v]) => ({ month, ...v })),
      };
      return delay(report, 1);
    },
  },

  sos: {
    async incidents(query) {
      const store = getStore();
      const filtered = store.sos.filter((s) => {
        if (query.status === 'open' && s.stage === 'resolved') return false;
        if (query.status === 'resolved' && s.stage !== 'resolved') return false;
        return matchesQuery([s.userName, s.locationName, s.id], query.query);
      });
      return delay(
        paginate(filtered, { ...query, sort: query.sort ?? 'startedAt' }, (s, key) =>
          key === 'stage' ? s.stage : key === 'userName' ? s.userName : s.startedAt,
        ),
        0.8,
      );
    },

    async get(id) {
      return delay(getStore().sos.find((s) => s.id === id) ?? null, 0.4);
    },

    async centers(id) {
      const incident = getStore().sos.find((s) => s.id === id);
      if (!incident) return delay([], 0.4);
      return delay(rescueOptions(incident.coords), 0.6);
    },

    async assignCenter(id, centerId, note) {
      const store = getStore();
      const incident = store.sos.find((s) => s.id === id);
      if (!incident) throw new Error('Olay bulunamadı');
      const center = rescueOptions(incident.coords).find((c) => c.id === centerId);
      incident.assignedCenterId = centerId;
      incident.assignedCenterName = center?.name ?? centerId;
      if (incident.stage === 'sent') incident.stage = 'acknowledged';
      incident.timeline = [
        ...incident.timeline,
        { at: nowIso(), label: `Kurtarma merkezi atandı: ${center?.name ?? centerId}`, actor: 'Panel' },
      ];
      record('sos.assign', 'sos', id, `${incident.userName}: ${center?.name ?? centerId} atandı`, note);
      return delay(incident as SosIncident, 0.8);
    },

    async resolve(id, note) {
      const store = getStore();
      const incident = store.sos.find((s) => s.id === id);
      if (!incident) throw new Error('Olay bulunamadı');
      incident.stage = 'resolved';
      incident.resolvedAt = nowIso();
      incident.timeline = [...incident.timeline, { at: nowIso(), label: 'Olay kapatıldı', actor: 'Panel' }];
      record('sos.resolve', 'sos', id, `${incident.userName}: olay kapatıldı`, note);
      return delay(incident as SosIncident, 0.8);
    },

    async hazards(query) {
      const store = getStore();
      const filtered = store.hazards.filter((h) => {
        if (query.severity && query.severity !== 'all' && h.severity !== query.severity) return false;
        if (query.review && query.review !== 'all' && h.review !== query.review) return false;
        return matchesQuery([h.title, h.locationName, h.reporterName, h.description], query.query);
      });
      return delay(
        paginate(filtered, { ...query, sort: query.sort ?? 'createdAt' }, (h, key) =>
          key === 'confirmations' ? h.confirmations : key === 'severity' ? h.severity : h.createdAt,
        ),
        0.7,
      );
    },

    async reviewHazard(id, review, reason) {
      const store = getStore();
      const hazard = store.hazards.find((h) => h.id === id);
      if (!hazard) throw new Error('Tehlike bildirimi bulunamadı');
      hazard.review = review;
      record(`hazard.${review}`, 'hazard', id, `${hazard.title}: ${review}`, reason);
      return delay(hazard as AdminHazardRow, 0.7);
    },
  },

  content: {
    async list(query) {
      const store = getStore();
      const filtered = store.contentRows.filter((c) => {
        if (query.kind && query.kind !== 'all' && c.kind !== query.kind) return false;
        if (query.status && query.status !== 'all' && c.status !== query.status) return false;
        if (query.missingOnly && c.missingLocales.length === 0) return false;
        return matchesQuery([c.title, c.subtitle, c.region, c.id], query.query);
      });
      return delay(
        paginate(filtered, { ...query, sort: query.sort ?? 'updatedAt' }, (c, key) => {
          switch (key) {
            case 'title':
              return c.title;
            case 'kind':
              return c.kind;
            case 'status':
              return c.status;
            case 'views':
              return c.views;
            case 'translatedCount':
              return c.translatedCount;
            default:
              return c.updatedAt;
          }
        }),
        1,
      );
    },

    async get(id) {
      return delay(getStore().contentDetails.get(id) ?? null, 0.6);
    },

    async create(input: CreateContentInput) {
      const store = getStore();
      const id = `c_new_${Date.now().toString(36)}`;
      const row: ContentRow = {
        id,
        kind: input.kind,
        title: input.title,
        subtitle: input.subtitle,
        status: input.status,
        coverUrl: null,
        region: input.region,
        updatedAt: nowIso(),
        translatedCount: 1,
        localeCount: 23,
        missingLocales: [],
        views: 0,
      };
      const detail: ContentDetail = {
        ...row,
        body: input.body,
        fields: [],
        translations: [{ locale: 'tr', complete: true, missingFields: [] }],
      };
      detail.translations = detail.translations.concat(
        ['en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'zh', 'ko', 'hi', 'ne', 'ar', 'ka', 'el', 'pl', 'cs', 'nl', 'sv', 'nb', 'id', 'th'].map(
          (locale) => ({ locale, complete: false, missingFields: ['title', 'subtitle', 'body'] }),
        ),
      );
      row.missingLocales = detail.translations.filter((t) => !t.complete).map((t) => t.locale);
      detail.missingLocales = row.missingLocales;
      store.contentRows.unshift(row);
      store.contentDetails.set(id, detail);
      record('content.create', 'content', id, `${input.kind}: ${input.title} oluşturuldu`, null);
      return delay(detail, 0.9);
    },

    async update(id, patch: ContentPatch, reason) {
      const store = getStore();
      const detail = store.contentDetails.get(id);
      const row = store.contentRows.find((c) => c.id === id);
      if (!detail || !row) throw new Error('İçerik bulunamadı');
      if (patch.title !== undefined) {
        detail.title = patch.title;
        row.title = patch.title;
      }
      if (patch.subtitle !== undefined) {
        detail.subtitle = patch.subtitle;
        row.subtitle = patch.subtitle;
      }
      if (patch.body !== undefined) detail.body = patch.body;
      if (patch.status !== undefined) {
        detail.status = patch.status;
        row.status = patch.status;
      }
      detail.updatedAt = nowIso();
      row.updatedAt = detail.updatedAt;
      record('content.update', 'content', id, `${row.title} güncellendi`, reason);
      return delay(detail, 0.8);
    },

    async setStatus(id, status: ContentStatus, reason) {
      const store = getStore();
      const row = store.contentRows.find((c) => c.id === id);
      const detail = store.contentDetails.get(id);
      if (!row) throw new Error('İçerik bulunamadı');
      row.status = status;
      row.updatedAt = nowIso();
      if (detail) {
        detail.status = status;
        detail.updatedAt = row.updatedAt;
      }
      record(`content.${status}`, 'content', id, `${row.title}: durum → ${status}`, reason);
      return delay(row as ContentRow, 0.7);
    },
  },

  marketing: {
    async campaigns(query) {
      const store = getStore();
      const filtered = store.campaigns.filter((c) => {
        if (query.channel && query.channel !== 'all' && c.channel !== query.channel) return false;
        return matchesQuery([c.name, c.goal], query.query);
      });
      return delay(paginate(filtered, { ...query, sort: query.sort ?? 'startAt' }, (c, key) =>
        key === 'budgetTry' ? c.budgetTry : key === 'name' ? c.name : c.startAt,
      ), 0.8);
    },

    async posts(query) {
      const store = getStore();
      const filtered = store.socialPosts.filter((p) => {
        if (query.channel && query.channel !== 'all' && p.channel !== query.channel) return false;
        if (query.status && query.status !== 'all' && p.status !== query.status) return false;
        return matchesQuery([p.body], query.query);
      });
      return delay(paginate(filtered, { ...query, sort: query.sort ?? 'scheduledAt' }, (p, key) =>
        key === 'impressions' ? p.impressions : key === 'channel' ? p.channel : p.scheduledAt,
      ), 0.8);
    },

    async schedulePost(id, scheduledAt) {
      const store = getStore();
      const post = store.socialPosts.find((p) => p.id === id);
      if (!post) throw new Error('Gönderi bulunamadı');
      post.scheduledAt = scheduledAt;
      post.status = 'queued';
      record('marketing.schedule', 'social_post', id, `Gönderi ${scheduledAt} için kuyruğa alındı`, null);
      return delay(post as SocialPostItem, 0.6);
    },

    async setPostStatus(id, status) {
      const store = getStore();
      const post = store.socialPosts.find((p) => p.id === id);
      if (!post) throw new Error('Gönderi bulunamadı');
      post.status = status;
      record('marketing.post_status', 'social_post', id, `Gönderi durumu → ${status}`, null);
      return delay(post as SocialPostItem, 0.6);
    },

    async referrals() {
      return delay(getStore().referrals, 0.8);
    },

    async aso() {
      return delay(getStore().aso, 0.6);
    },
  },

  agents: {
    async runs(query) {
      const store = getStore();
      const filtered = store.agentRuns.filter((r) => matchesQuery([r.agent, r.task], query.query));
      return delay(paginate(filtered, { ...query, sort: query.sort ?? 'startedAt' }, (r, key) =>
        key === 'durationSec' ? r.durationSec : key === 'agent' ? r.agent : r.startedAt,
      ), 0.8);
    },
    async pullRequests() {
      return delay(getStore().agentPrs, 0.6);
    },
    async findings(query) {
      const store = getStore();
      const filtered = store.findings.filter((f) => matchesQuery([f.title, f.agent, f.area], query.query));
      return delay(paginate(filtered, { ...query, sort: query.sort ?? 'foundAt' }, (f, key) =>
        key === 'severity' ? { low: 0, medium: 1, high: 2, critical: 3 }[f.severity] : f.foundAt,
      ), 0.7);
    },
    async ci() {
      return delay(getStore().ci, 0.5);
    },
    async health() {
      return delay(getStore().health, 0.7);
    },
    async releases() {
      return delay(getStore().releases, 0.6);
    },
    async rollback(version, reason) {
      const store = getStore();
      const target = store.releases.find((r) => r.version === version);
      if (!target) throw new Error('Sürüm bulunamadı');
      store.releases = store.releases.map((r) => ({ ...r, current: r.version === version }));
      record('release.rollback', 'release', version, `Üretim sürümü ${version} sürümüne alındı`, reason);
      return delay(store.releases, 1);
    },
  },

  settings: {
    async get() {
      return delay(getStore().settings, 0.6);
    },
    async update(patch, reason) {
      const store = getStore();
      const settings = store.settings;
      if (patch.flags) {
        for (const change of patch.flags) {
          const flag = settings.flags.find((f) => f.key === change.key);
          if (!flag) continue;
          if (change.enabled !== undefined) flag.enabled = change.enabled;
          if (change.rolloutPct !== undefined) flag.rolloutPct = change.rolloutPct;
          if (change.audience !== undefined) flag.audience = change.audience;
          flag.updatedAt = nowIso();
          record('settings.flag', 'flag', flag.key, `${flag.label}: ${flag.enabled ? 'açık' : 'kapalı'} · %${flag.rolloutPct}`, reason);
        }
      }
      if (patch.maintenance) {
        settings.maintenance = { ...settings.maintenance, ...patch.maintenance };
        record('settings.maintenance', 'setting', 'maintenance', `Bakım modu: ${settings.maintenance.enabled ? 'açık' : 'kapalı'}`, reason);
      }
      if (patch.announcement) {
        settings.announcement = { ...settings.announcement, ...patch.announcement };
        record('settings.announcement', 'setting', 'announcement', `Duyuru bandı: ${settings.announcement.enabled ? 'açık' : 'kapalı'}`, reason);
      }
      if (patch.rateLimits) {
        for (const change of patch.rateLimits) {
          const rule = settings.rateLimits.find((r) => r.key === change.key);
          if (rule) rule.perMinute = change.perMinute;
        }
        record('settings.rate_limits', 'setting', 'rate_limits', 'Oran sınırları güncellendi', reason);
      }
      if (patch.commissions) {
        for (const change of patch.commissions) {
          const rule = settings.commissions.find((r) => r.key === change.key);
          if (rule) rule.pct = change.pct;
        }
        record('settings.commissions', 'setting', 'commissions', 'Komisyon oranları güncellendi', reason);
      }
      return delay(settings as AdminSettings, 0.9);
    },
  },

  audit: {
    async list(query) {
      const store = getStore();
      const filtered = store.audit.filter((entry) => {
        if (query.actorId && query.actorId !== 'all' && entry.actorId !== query.actorId) return false;
        if (query.targetKind && query.targetKind !== 'all' && entry.targetKind !== query.targetKind) return false;
        return matchesQuery([entry.summary, entry.action, entry.actorName, entry.targetId], query.query);
      });
      return delay(paginate(filtered, { ...query, sort: query.sort ?? 'at' }, (e, key) =>
        key === 'actorName' ? e.actorName : key === 'action' ? e.action : e.at,
      ), 0.6);
    },
  },
};

export type { AdminUserRow, AdminUserDetail, ID };
