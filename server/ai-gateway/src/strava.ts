import type { IncomingMessage, ServerResponse } from 'node:http';

/* ------------------------------------------------------------------ */
/* Sabitler                                                             */
/* ------------------------------------------------------------------ */

const STRAVA_AUTHORIZE = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN = 'https://www.strava.com/oauth/token';
const STRAVA_API = 'https://www.strava.com/api/v3';
/** Yalnızca okuma kapsamı: etkinlik listesi + akışlar */
const STRAVA_SCOPE = 'read,activity:read';
const MAX_ACTIVITIES = 30;
const BODY_LIMIT_BYTES = 16 * 1024;
const STRAVA_TIMEOUT_MS = 15_000;

/** Uygulamanın dönüş bağlantıları — açık liste dışındaki redirect reddedilir. */
const ALLOWED_REDIRECT_PREFIXES = ['zirve://', 'exp://', 'http://localhost', 'https://'];

/* ------------------------------------------------------------------ */
/* Tipler                                                               */
/* ------------------------------------------------------------------ */

export type FailFn = (status: number, message: string) => Error;

export interface StravaDeps {
  fail: FailFn;
  sendJson: (res: ServerResponse, status: number, body: unknown) => void;
  /** Test için enjekte edilebilir fetch */
  fetchImpl?: typeof fetch;
}

interface StravaActivitySummary {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  distance: number;
  total_elevation_gain: number;
  moving_time: number;
  start_date: string;
}

interface StravaStreamSet {
  latlng?: { data: [number, number][] };
  altitude?: { data: number[] };
  time?: { data: number[] };
}

export interface GatewayActivity {
  id: string;
  name: string;
  sportType: string;
  distanceM: number;
  elevationGainM: number;
  movingTimeSec: number;
  startDate: string;
  streams: {
    latlng: [number, number][];
    altitude: number[] | null;
    time: number[] | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                          */
/* ------------------------------------------------------------------ */

function credentials(fail: FailFn): { clientId: string; clientSecret: string } {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret)
    throw fail(503, 'Strava yapılandırılmadı (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET)');
  return { clientId, clientSecret };
}

export function isStravaConfigured(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim());
}

/** Dönüş adresi açık listede mi? */
export function isAllowedRedirect(redirect: string): boolean {
  return ALLOWED_REDIRECT_PREFIXES.some((p) => redirect.startsWith(p)) && !/\s/.test(redirect);
}

async function readJson(req: IncomingMessage, fail: FailFn): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > BODY_LIMIT_BYTES) throw fail(413, 'İstek gövdesi çok büyük');
    chunks.push(buf);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw fail(400, 'JSON nesnesi bekleniyor');
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) throw fail(400, 'Geçersiz JSON');
    throw error;
  }
}

function bearerToken(req: IncomingMessage, fail: FailFn): string {
  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (!token) throw fail(401, 'Strava erişim jetonu gerekli (Authorization: Bearer …)');
  return token;
}

async function stravaFetch<T>(
  fetchImpl: typeof fetch,
  fail: FailFn,
  url: string,
  init: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STRAVA_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    if (res.status === 401) throw fail(401, 'Strava jetonu geçersiz ya da süresi dolmuş');
    if (res.status === 429) throw fail(429, 'Strava hız sınırı aşıldı, biraz sonra dene');
    if (!res.ok) throw fail(502, `Strava yanıtı ${res.status}`);
    return (await res.json()) as T;
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') throw fail(504, 'Strava zaman aşımı');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Strava özet etkinliğini uygulama biçimine çevirir */
export function toGatewayActivity(
  a: StravaActivitySummary,
  streams: StravaStreamSet | null,
): GatewayActivity {
  const latlng = streams?.latlng?.data ?? [];
  return {
    id: String(a.id),
    name: a.name,
    sportType: a.sport_type ?? a.type ?? 'Workout',
    distanceM: a.distance,
    elevationGainM: a.total_elevation_gain,
    movingTimeSec: a.moving_time,
    startDate: a.start_date,
    streams:
      latlng.length > 0
        ? {
            latlng,
            altitude: streams?.altitude?.data ?? null,
            time: streams?.time?.data ?? null,
          }
        : null,
  };
}

/* ------------------------------------------------------------------ */
/* İşleyiciler                                                          */
/* ------------------------------------------------------------------ */

/**
 * `GET /v1/strava/auth-url?redirect=zirve://strava` → `{ url }`
 * Uygulama bu adresi tarayıcıda açar; Strava `redirect?code=…` ile döner.
 */
export async function handleStravaAuthUrl(
  req: IncomingMessage,
  res: ServerResponse,
  deps: StravaDeps,
): Promise<void> {
  const { clientId } = credentials(deps.fail);
  const url = new URL(req.url ?? '/', 'http://localhost');
  const redirect = url.searchParams.get('redirect') ?? '';
  if (!redirect || !isAllowedRedirect(redirect)) throw deps.fail(400, 'Geçersiz redirect');
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirect,
    approval_prompt: 'auto',
    scope: STRAVA_SCOPE,
  });
  deps.sendJson(res, 200, { url: `${STRAVA_AUTHORIZE}?${params.toString()}` });
}

/**
 * `POST /v1/strava/token { code }` → Strava token yanıtı (access/refresh/expires_at/athlete).
 * `{ refresh_token }` verilirse yenileme yapılır. Client secret yalnızca burada kullanılır.
 */
export async function handleStravaToken(
  req: IncomingMessage,
  res: ServerResponse,
  deps: StravaDeps,
): Promise<void> {
  const { clientId, clientSecret } = credentials(deps.fail);
  const body = await readJson(req, deps.fail);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const refresh = typeof body.refresh_token === 'string' ? body.refresh_token.trim() : '';
  if (!code && !refresh) throw deps.fail(400, '`code` ya da `refresh_token` gerekli');

  const form = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  if (code) {
    form.set('code', code);
    form.set('grant_type', 'authorization_code');
  } else {
    form.set('refresh_token', refresh);
    form.set('grant_type', 'refresh_token');
  }
  const token = await stravaFetch<{
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
    athlete?: { id?: number; firstname?: string; lastname?: string };
  }>(deps.fetchImpl ?? fetch, deps.fail, STRAVA_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  deps.sendJson(res, 200, {
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? null,
    expires_at: token.expires_at ?? null,
    athlete: token.athlete
      ? { firstname: token.athlete.firstname ?? null, lastname: token.athlete.lastname ?? null }
      : null,
  });
}

/**
 * `GET /v1/strava/activities?limit=10&streams=1` (Bearer) → `{ activities }`
 * `streams=1` ise her etkinlik için latlng/altitude/time akışları eklenir (en fazla 30).
 */
export async function handleStravaActivities(
  req: IncomingMessage,
  res: ServerResponse,
  deps: StravaDeps,
): Promise<void> {
  credentials(deps.fail);
  const token = bearerToken(req, deps.fail);
  const url = new URL(req.url ?? '/', 'http://localhost');
  const limit = Math.min(
    MAX_ACTIVITIES,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '10', 10) || 10),
  );
  const withStreams = url.searchParams.get('streams') === '1';
  const fetchImpl = deps.fetchImpl ?? fetch;
  const headers = { authorization: `Bearer ${token}` };

  const summaries = await stravaFetch<StravaActivitySummary[]>(
    fetchImpl,
    deps.fail,
    `${STRAVA_API}/athlete/activities?per_page=${limit}`,
    { headers },
  );

  const activities: GatewayActivity[] = [];
  for (const a of summaries) {
    let streams: StravaStreamSet | null = null;
    if (withStreams) {
      try {
        streams = await stravaFetch<StravaStreamSet>(
          fetchImpl,
          deps.fail,
          `${STRAVA_API}/activities/${a.id}/streams?keys=latlng,altitude,time&key_by_type=true`,
          { headers },
        );
      } catch {
        // Akışı olmayan (manuel) etkinlik → akışsız devam
        streams = null;
      }
    }
    activities.push(toGatewayActivity(a, streams));
  }
  deps.sendJson(res, 200, { activities });
}
