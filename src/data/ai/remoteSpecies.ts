import {
  imageSizeGuard,
  parseSpeciesResponse,
  stripDataUrl,
  type GeoPoint,
  type RemoteIdentification,
  type Species,
} from '@/domain';

import { RemoteAiError } from './remoteAi';
import { guessMediaType } from './remoteVision';

/* ------------------------------------------------------------------ */
/* Tipler                                                               */
/* ------------------------------------------------------------------ */

export interface RemoteSpeciesClientOptions {
  baseUrl: string;
  apiKey?: string | null;
  /** Test ve platform farkları için enjekte edilebilir fetch */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Gateway'e giden gövde (`POST /v1/species`). */
export interface RemoteSpeciesBody {
  imageBase64: string | null;
  mediaType: string | null;
  description: string;
  coords: GeoPoint | null;
  locale: string;
}

export interface RemoteSpeciesInput {
  imageUri: string | null;
  imageBase64: string | null;
  description: string;
  coords: GeoPoint | null;
  locale: string;
}

/** İstek gövdesi: görüntü varsa boyut denetlenir; görüntü yoksa yalnızca açıklama gönderilir. */
export function toRemoteSpeciesBody(input: RemoteSpeciesInput): RemoteSpeciesBody {
  const description = input.description.trim().slice(0, 1000);
  if (!input.imageBase64) {
    if (!description) throw new RemoteAiError('Görüntü ya da açıklama gerekli');
    return {
      imageBase64: null,
      mediaType: null,
      description,
      coords: input.coords,
      locale: input.locale,
    };
  }
  const guard = imageSizeGuard(input.imageBase64);
  if (!guard.ok)
    throw new RemoteAiError(guard.needsResize ? 'Görüntü çok büyük' : 'Görüntü verisi boş', 413);
  const { data, mediaType } = stripDataUrl(input.imageBase64);
  return {
    imageBase64: data,
    mediaType: guessMediaType(input.imageUri, mediaType),
    description,
    coords: input.coords,
    locale: input.locale,
  };
}

/* ------------------------------------------------------------------ */
/* İstemci                                                              */
/* ------------------------------------------------------------------ */

/**
 * `server/ai-gateway` `/v1/species` uç noktasıyla konuşan istemci. Yanıt yerel tür listesiyle
 * eşlenir (`parseSpeciesResponse`); API anahtarı uygulamada tutulmaz.
 */
export class RemoteSpeciesClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor({
    baseUrl,
    apiKey = null,
    fetchImpl,
    timeoutMs = 90_000,
  }: RemoteSpeciesClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = timeoutMs;
  }

  async identify(input: RemoteSpeciesInput, species: Species[]): Promise<RemoteIdentification> {
    const body = toRemoteSpeciesBody(input);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
    };
    if (this.apiKey) headers['x-zirtan-key'] = this.apiKey;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/v1/species`, {
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
      const parsed = parseSpeciesResponse(json, species);
      if (parsed.candidates.length === 0) throw new RemoteAiError('Boş tür yanıtı');
      return parsed;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/** Görüntü istemcisiyle aynı ortam değişkenleri: `EXPO_PUBLIC_AI_GATEWAY_URL` (+ `_KEY`). */
export function getRemoteSpeciesClient(): RemoteSpeciesClient | null {
  const url = process.env.EXPO_PUBLIC_AI_GATEWAY_URL?.trim();
  if (!url) return null;
  return new RemoteSpeciesClient({
    baseUrl: url,
    apiKey: process.env.EXPO_PUBLIC_AI_GATEWAY_KEY?.trim() || null,
  });
}
