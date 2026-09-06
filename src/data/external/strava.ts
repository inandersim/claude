import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type { TrackPoint } from '@/domain';
import { stravaStreamsToPoints } from '@/domain/tracks';

/* ------------------------------------------------------------------ */
/* Tipler                                                               */
/* ------------------------------------------------------------------ */

export interface StravaTokens {
  accessToken: string;
  refreshToken: string | null;
  /** epoch saniye */
  expiresAt: number | null;
  athleteName: string | null;
}

export interface StravaActivity {
  id: string;
  name: string;
  /** Strava sport_type: Hike, Run, Ride, BackcountrySki… */
  sportType: string;
  distanceM: number;
  elevationGainM: number;
  movingTimeSec: number;
  startDate: string;
  /** Akışlar (latlng/altitude/time) — sunucu isteğe bağlı ekler */
  streams: {
    latlng: [number, number][];
    altitude: number[] | null;
    time: number[] | null;
  } | null;
}

export class StravaError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/* Yapılandırma                                                         */
/* ------------------------------------------------------------------ */

/** Strava, ağ geçidi (`EXPO_PUBLIC_AI_GATEWAY_URL`) üzerinden çalışır; gizli anahtar sunucuda kalır. */
export function isStravaConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_AI_GATEWAY_URL?.trim() &&
    process.env.EXPO_PUBLIC_STRAVA_ENABLED === '1',
  );
}

/** OAuth dönüş bağlantısı: `zirtan://strava` (deep link) */
export function stravaRedirectUrl(): string {
  return Linking.createURL('strava');
}

/* ------------------------------------------------------------------ */
/* İstemci                                                              */
/* ------------------------------------------------------------------ */

/** Ağ geçidi üzerinden Strava OAuth ve etkinlik listesi. */
export class StravaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;

  constructor(baseUrl: string, apiKey: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { accept: 'application/json', ...extra };
    if (this.apiKey) headers['x-zirtan-key'] = this.apiKey;
    return headers;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, init);
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const message =
        (body as { error?: string } | null)?.error ?? `Strava gateway error ${res.status}`;
      throw new StravaError(res.status, message);
    }
    return body as T;
  }

  /** Yetkilendirme adresi (sunucu client_id'yi ekler) */
  async authUrl(redirect: string): Promise<string> {
    const data = await this.request<{ url: string }>(
      `/v1/strava/auth-url?redirect=${encodeURIComponent(redirect)}`,
      { headers: this.headers() },
    );
    return data.url;
  }

  /** code → token değişimi (client secret sunucuda) */
  async exchange(code: string): Promise<StravaTokens> {
    const data = await this.request<{
      access_token: string;
      refresh_token?: string;
      expires_at?: number;
      athlete?: { firstname?: string; lastname?: string };
    }>('/v1/strava/token', {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ code }),
    });
    const name = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_at ?? null,
      athleteName: name || null,
    };
  }

  /** Son etkinlikler (+ akışlar) */
  async activities(accessToken: string, limit = 10): Promise<StravaActivity[]> {
    const data = await this.request<{ activities: StravaActivity[] }>(
      `/v1/strava/activities?limit=${limit}&streams=1`,
      { headers: this.headers({ authorization: `Bearer ${accessToken}` }) },
    );
    return data.activities;
  }

  /**
   * OAuth akışı: `expo-web-browser` ile yetki sayfası açılır, `zirtan://strava?code=…` dönüşü
   * yakalanır; başarısızsa `Linking.openURL` ile açılır ve `null` döner (deep link dinlenmeli).
   */
  async connect(): Promise<StravaTokens | null> {
    const redirect = stravaRedirectUrl();
    const url = await this.authUrl(redirect);
    try {
      const result = await WebBrowser.openAuthSessionAsync(url, redirect);
      if (result.type !== 'success') return null;
      const code = parseCode(result.url);
      if (!code) return null;
      return this.exchange(code);
    } catch {
      await Linking.openURL(url);
      return null;
    }
  }
}

/** Dönüş adresinden `code` parametresini okur */
export function parseCode(url: string): string | null {
  const match = /[?&]code=([^&#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]!) : null;
}

/** Strava etkinliğini TrackPoint dizisine çevirir (akış yoksa boş dizi) */
export function activityToPoints(activity: StravaActivity): TrackPoint[] {
  if (!activity.streams) return [];
  return stravaStreamsToPoints(
    activity.streams.latlng,
    activity.streams.altitude,
    activity.streams.time,
    Date.parse(activity.startDate),
  );
}

/** Ortam yapılandırılmışsa istemci; değilse null. */
export function getStravaClient(): StravaClient | null {
  if (!isStravaConfigured()) return null;
  const url = process.env.EXPO_PUBLIC_AI_GATEWAY_URL!.trim();
  return new StravaClient(url, process.env.EXPO_PUBLIC_AI_GATEWAY_KEY?.trim() || null);
}
