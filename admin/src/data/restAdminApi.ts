/**
 * `AdminApi`'nin gerçek sunucu uygulaması.
 *
 * `VITE_ADMIN_API_URL` tanımlıysa devreye girer. Uç noktalar, arayüzdeki
 * yöntem adlarıyla birebir eşleşir; böylece sunucu ekibi sözleşmeyi tek
 * yerden (bkz. `adminApi.ts`) takip edebilir.
 *
 *   GET  /metrics/overview?range=30d
 *   GET  /users?page=1&pageSize=20&query=...&sort=...&dir=...
 *   POST /users/:id/status        { status, reason, days }
 *   POST /moderation/act          { ids, action, reason }
 *   POST /bookings/:id/refund     { amountTry, reason }
 *   POST /cto/requests            { text }        → talep alımı (adım 1–6)
 *   POST /cto/requests/:id/approve { evidence }   → insan onayı
 *   …
 *
 * `cto/*` uçları sunucuda `agents/cto` betiklerini çalıştırır; kural motoru
 * orada tektir (bkz. `docs/AI_CTO.md` §0).
 */
import type {
  AdminApi,
  AdminBookingRow,
  AdminHazardRow,
  AdminSettings,
  AdminUserDetail,
  AdminUserRow,
  ContentDetail,
  ContentRow,
  CtoRequest,
  Dispute,
  ReleaseInfo,
  SocialPostItem,
  SosIncident,
  VerificationRequest,
} from './adminApi';

type QueryValue = string | number | boolean | null | undefined;

export interface RestConfig {
  baseUrl: string;
  token?: string | undefined;
  /** Test edilebilirlik için enjekte edilebilir fetch */
  fetchImpl?: typeof fetch;
}

function toSearch(params: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function createRestAdminApi(config: RestConfig): AdminApi {
  const doFetch = config.fetchImpl ?? fetch;
  const base = config.baseUrl.replace(/\/$/, '');

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.token) headers.Authorization = `Bearer ${config.token}`;
    const response = await doFetch(`${base}${path}`, {
      credentials: 'include',
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    });
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const body = (await response.json()) as { message?: string };
        if (body?.message) message = body.message;
      } catch {
        /* gövde okunamadıysa durum kodu yeterli */
      }
      throw new Error(message);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  const get = <T>(path: string, params?: Record<string, QueryValue>) => call<T>(`${path}${toSearch(params)}`);
  const post = <T>(path: string, body?: unknown) =>
    call<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
  const patch = <T>(path: string, body?: unknown) =>
    call<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) });

  const pageParams = (query: Record<string, QueryValue>) => query;

  return {
    source: 'rest',

    auth: {
      me: () => get('/auth/me'),
      signInAs: (accountId) => post(`/auth/sign-in-as/${accountId}`),
      accounts: () => get('/auth/accounts'),
    },

    metrics: {
      overview: (range) => get('/metrics/overview', { range }),
    },

    users: {
      list: (query) => get('/users', pageParams({ ...query })),
      get: (id) => get<AdminUserDetail | null>(`/users/${id}`),
      setStatus: (id, status, reason, days) =>
        post<AdminUserRow>(`/users/${id}/status`, { status, reason, days }),
      setRole: (id, role, reason) => post<AdminUserRow>(`/users/${id}/role`, { role, reason }),
      setPlan: (id, plan, reason) => post<AdminUserRow>(`/users/${id}/plan`, { plan, reason }),
      revokeSessions: (id, reason) => post<AdminUserDetail>(`/users/${id}/revoke-sessions`, { reason }),
      addNote: (id, text) => post<AdminUserDetail>(`/users/${id}/notes`, { text }),
    },

    moderation: {
      list: (query) => get('/moderation/reports', pageParams({ ...query })),
      act: (ids, action, reason) => post('/moderation/act', { ids, action, reason }),
      log: (query) => get('/moderation/log', pageParams({ ...query })),
    },

    verification: {
      list: (query) => get('/verification/requests', pageParams({ ...query })),
      get: (id) => get<VerificationRequest | null>(`/verification/requests/${id}`),
      decide: (id, status, reason) =>
        post<VerificationRequest>(`/verification/requests/${id}/decide`, { status, reason }),
    },

    bookings: {
      list: (query) => get('/bookings', pageParams({ ...query })),
      get: (id) => get<AdminBookingRow | null>(`/bookings/${id}`),
      release: (id, reason) => post<AdminBookingRow>(`/bookings/${id}/release`, { reason }),
      refund: (input) => post<AdminBookingRow>(`/bookings/${input.bookingId}/refund`, input),
      disputes: (query) => get('/bookings/disputes', pageParams({ ...query })),
      resolveDispute: (id, outcome, note) =>
        post<Dispute>(`/bookings/disputes/${id}/resolve`, { outcome, note }),
      commission: (range) => get('/bookings/commission', { range }),
    },

    sos: {
      incidents: (query) => get('/sos/incidents', pageParams({ ...query })),
      get: (id) => get<SosIncident | null>(`/sos/incidents/${id}`),
      centers: (id) => get(`/sos/incidents/${id}/centers`),
      assignCenter: (id, centerId, note) =>
        post<SosIncident>(`/sos/incidents/${id}/assign`, { centerId, note }),
      resolve: (id, note) => post<SosIncident>(`/sos/incidents/${id}/resolve`, { note }),
      hazards: (query) => get('/sos/hazards', pageParams({ ...query })),
      reviewHazard: (id, review, reason) =>
        post<AdminHazardRow>(`/sos/hazards/${id}/review`, { review, reason }),
    },

    content: {
      list: (query) => get('/content', pageParams({ ...query })),
      get: (id) => get<ContentDetail | null>(`/content/${id}`),
      create: (input) => post<ContentDetail>('/content', input),
      update: (id, body, reason) => patch<ContentDetail>(`/content/${id}`, { ...body, reason }),
      setStatus: (id, status, reason) => post<ContentRow>(`/content/${id}/status`, { status, reason }),
    },

    marketing: {
      campaigns: (query) => get('/marketing/campaigns', pageParams({ ...query })),
      posts: (query) => get('/marketing/posts', pageParams({ ...query })),
      schedulePost: (id, scheduledAt) => post<SocialPostItem>(`/marketing/posts/${id}/schedule`, { scheduledAt }),
      setPostStatus: (id, status) => post<SocialPostItem>(`/marketing/posts/${id}/status`, { status }),
      referrals: () => get('/marketing/referrals'),
      aso: () => get('/marketing/aso'),
    },

    agents: {
      runs: (query) => get('/agents/runs', pageParams({ ...query })),
      pullRequests: () => get('/agents/pull-requests'),
      findings: (query) => get('/agents/findings', pageParams({ ...query })),
      ci: () => get('/system/ci'),
      health: () => get('/system/health'),
      releases: () => get('/system/releases'),
      rollback: (version, reason) => post<ReleaseInfo[]>('/system/rollback', { version, reason }),
    },

    cto: {
      policy: () => get('/cto/policy'),
      analyze: (text) => post<CtoRequest>('/cto/analyze', { text }),
      submit: (text) => post<CtoRequest>('/cto/requests', { text }),
      list: (query) => get('/cto/requests', pageParams({ ...query })),
      get: (id) => get<CtoRequest | null>(`/cto/requests/${id}`),
      approve: (id, evidence) => post<CtoRequest>(`/cto/requests/${id}/approve`, { evidence }),
      cancel: (id, reason) => post<CtoRequest>(`/cto/requests/${id}/cancel`, { reason }),
      audit: (query) => get('/cto/audit', pageParams({ ...query })),
    },

    settings: {
      get: () => get<AdminSettings>('/settings'),
      update: (body, reason) => patch<AdminSettings>('/settings', { ...body, reason }),
    },

    audit: {
      list: (query) => get('/audit', pageParams({ ...query })),
    },
  };
}
