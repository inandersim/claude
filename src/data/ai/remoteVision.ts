import type { VisionAdvice, VisionRequest } from '@/domain';
import { imageSizeGuard, parseVisionResponse, stripDataUrl } from '@/domain';

import { RemoteAiError } from './remoteAi';

/* ------------------------------------------------------------------ */
/* Tipler                                                               */
/* ------------------------------------------------------------------ */

export interface RemoteVisionClientOptions {
  baseUrl: string;
  apiKey?: string | null;
  /** Test ve platform farkları için enjekte edilebilir fetch */
  fetchImpl?: typeof fetch;
  /** Görüntü yüklemesi + model süresi; sohbetten uzun tutulur */
  timeoutMs?: number;
}

/** Gateway'e giden gövde (`POST /v1/vision`). */
export interface RemoteVisionBody {
  imageBase64: string;
  mediaType: string;
  situation: VisionRequest['situation'];
  question: string;
  coords: VisionRequest['coords'];
  altitudeM: number | null;
  locale: string;
}

/** Dosya uzantısından / data URL'den medya türü; bilinmiyorsa JPEG. */
export function guessMediaType(uri: string | null, embedded: string | null): string {
  if (embedded && embedded.startsWith('image/'))
    return embedded === 'image/jpg' ? 'image/jpeg' : embedded;
  const ext = uri?.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/** `VisionRequest` → gateway gövdesi. Görüntü yoksa ya da çok büyükse hata fırlatır. */
export function toRemoteVisionBody(input: VisionRequest): RemoteVisionBody {
  if (!input.imageBase64) throw new RemoteAiError('Görüntü verisi yok');
  const guard = imageSizeGuard(input.imageBase64);
  if (!guard.ok)
    throw new RemoteAiError(guard.needsResize ? 'Görüntü çok büyük' : 'Görüntü verisi boş', 413);
  const { data, mediaType } = stripDataUrl(input.imageBase64);
  return {
    imageBase64: data,
    mediaType: guessMediaType(input.imageUri, mediaType),
    situation: input.situation,
    question: input.question.trim().slice(0, 1000),
    coords: input.coords,
    altitudeM: input.altitudeM,
    locale: input.locale,
  };
}

/* ------------------------------------------------------------------ */
/* İstemci                                                              */
/* ------------------------------------------------------------------ */

/**
 * `server/ai-gateway` `/v1/vision` uç noktasıyla konuşan istemci. API anahtarı uygulamada
 * tutulmaz; yalnızca gateway'in kendi `x-zirtan-key` anahtarı gönderilir.
 */
export class RemoteVisionClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor({
    baseUrl,
    apiKey = null,
    fetchImpl,
    timeoutMs = 90_000,
  }: RemoteVisionClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = timeoutMs;
  }

  /** Görüntüyü analiz eder; yanıt `VisionAdvice` (`source: 'remote'`). */
  async analyze(input: VisionRequest, now: Date = new Date()): Promise<VisionAdvice> {
    const body = toRemoteVisionBody(input);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
    };
    if (this.apiKey) headers['x-zirtan-key'] = this.apiKey;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/v1/vision`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new RemoteAiError(text || `Gateway ${res.status}`, res.status);
      }
      const json = (await res.json()) as unknown;
      const advice = parseVisionResponse(json, input.situation, now);
      if (advice.advice.length === 0 && advice.observations.length === 0)
        throw new RemoteAiError('Boş görüntü yanıtı');
      return { ...advice, source: 'remote' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Yapılandırma                                                         */
/* ------------------------------------------------------------------ */

/** Sohbet istemcisiyle aynı ortam değişkenleri: `EXPO_PUBLIC_AI_GATEWAY_URL` (+ `_KEY`). */
export function getRemoteVisionClient(): RemoteVisionClient | null {
  const url = process.env.EXPO_PUBLIC_AI_GATEWAY_URL?.trim();
  if (!url) return null;
  return new RemoteVisionClient({
    baseUrl: url,
    apiKey: process.env.EXPO_PUBLIC_AI_GATEWAY_KEY?.trim() || null,
  });
}
