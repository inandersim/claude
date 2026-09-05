import type { AiAction, AiContext, AiIntent, TripPlan } from '@/domain';
import { AI_INTENTS } from '@/domain';

/* ------------------------------------------------------------------ */
/* Tipler                                                               */
/* ------------------------------------------------------------------ */

export interface RemoteChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RemoteChatResult {
  content: string;
  intent: AiIntent | null;
  actions: AiAction[];
}

export interface SseEvent {
  event: string;
  data: string;
}

/** Ağ geçidinin `done` olayında gönderdiği yük. */
interface DonePayload {
  content?: string;
  intent?: string | null;
  actions?: AiAction[];
}

/* ------------------------------------------------------------------ */
/* SSE ayrıştırma                                                       */
/* ------------------------------------------------------------------ */

/**
 * SSE tamponunu olaylara böler. Tamamlanmamış son blok `rest` olarak geri döner
 * (bir sonraki parça ile birleştirilir).
 */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (data.length > 0) events.push({ event, data: data.join('\n') });
  }
  return { events, rest };
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isIntent(value: unknown): value is AiIntent {
  return typeof value === 'string' && (AI_INTENTS as readonly string[]).includes(value);
}

function sanitizeActions(input: unknown): AiAction[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (a): a is AiAction =>
        typeof a === 'object' &&
        a !== null &&
        typeof (a as AiAction).label === 'string' &&
        typeof (a as AiAction).href === 'string' &&
        (a as AiAction).href.startsWith('/'),
    )
    .map((a) => ({
      label: a.label,
      href: a.href,
      icon: typeof a.icon === 'string' ? a.icon : 'arrow-up-right',
    }))
    .slice(0, 6);
}

/* ------------------------------------------------------------------ */
/* İstemci                                                              */
/* ------------------------------------------------------------------ */

export class RemoteAiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'RemoteAiError';
    this.status = status;
  }
}

export interface RemoteAiClientOptions {
  baseUrl: string;
  apiKey?: string | null;
  /** Test ve platform farkları için enjekte edilebilir fetch */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * `server/ai-gateway` ile konuşan istemci. API anahtarı uygulamada tutulmaz;
 * yalnızca gateway'in kendi `x-zirve-key` anahtarı gönderilir.
 */
export class RemoteAiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor({ baseUrl, apiKey = null, fetchImpl, timeoutMs = 60_000 }: RemoteAiClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = timeoutMs;
  }

  private headers(accept: string): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json', accept };
    if (this.apiKey) h['x-zirve-key'] = this.apiKey;
    return h;
  }

  private async post(path: string, body: unknown, accept: string): Promise<Response> {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(accept),
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new RemoteAiError(text || `Gateway ${res.status}`, res.status);
      }
      return res;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Sohbet: SSE akışını okur, `onDelta` ile parça parça iletir, tamamlanmış sonucu döner. */
  async chat(
    messages: RemoteChatMessage[],
    context: AiContext,
    onDelta?: (text: string) => void,
  ): Promise<RemoteChatResult> {
    const res = await this.post('/v1/chat', { messages, context }, 'text/event-stream');
    let content = '';
    let done: DonePayload | null = null;

    const handle = (ev: SseEvent) => {
      if (ev.event === 'delta') {
        const payload = parseJson<{ text?: string }>(ev.data);
        if (payload?.text) {
          content += payload.text;
          onDelta?.(payload.text);
        }
      } else if (ev.event === 'done') {
        done = parseJson<DonePayload>(ev.data) ?? {};
      } else if (ev.event === 'error') {
        const payload = parseJson<{ message?: string }>(ev.data);
        throw new RemoteAiError(payload?.message ?? 'Gateway error');
      }
    };

    // Web/Node: akışı parça parça oku; React Native fetch'te body okunamıyorsa tüm metni al.
    const body = res.body as ReadableStream<Uint8Array> | null | undefined;
    if (body && typeof body.getReader === 'function' && typeof TextDecoder !== 'undefined') {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSse(buffer);
        buffer = parsed.rest;
        parsed.events.forEach(handle);
      }
      const tail = parseSse(`${buffer}\n\n`);
      tail.events.forEach(handle);
    } else {
      const text = await res.text();
      const parsed = parseSse(`${text}\n\n`);
      parsed.events.forEach(handle);
    }

    const final: DonePayload = done ?? {};
    return {
      content: (final.content && final.content.length > 0 ? final.content : content).trim(),
      intent: isIntent(final.intent) ? final.intent : null,
      actions: sanitizeActions(final.actions),
    };
  }

  /** Yapılandırılmış gezi planı (JSON). */
  async planTrip(prompt: string, context: AiContext): Promise<TripPlan> {
    const res = await this.post('/v1/plan-trip', { prompt, context }, 'application/json');
    const plan = (await res.json()) as Partial<TripPlan>;
    if (!plan || !Array.isArray(plan.days) || typeof plan.title !== 'string')
      throw new RemoteAiError('Geçersiz plan yanıtı');
    return {
      title: plan.title,
      adventureType: plan.adventureType ?? context.adventureTypes[0] ?? 'hiking',
      days: plan.days,
      packing: Array.isArray(plan.packing) ? plan.packing : [],
      safety: Array.isArray(plan.safety) ? plan.safety : [],
    };
  }

  async health(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/healthz`);
      return res.ok;
    } catch {
      return false;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Yapılandırma                                                         */
/* ------------------------------------------------------------------ */

/** `EXPO_PUBLIC_AI_GATEWAY_URL` ayarlıysa uzak istemci; değilse null (yerel cevap). */
export function getRemoteAiClient(): RemoteAiClient | null {
  const url = process.env.EXPO_PUBLIC_AI_GATEWAY_URL?.trim();
  if (!url) return null;
  return new RemoteAiClient({
    baseUrl: url,
    apiKey: process.env.EXPO_PUBLIC_AI_GATEWAY_KEY?.trim() || null,
  });
}

/** Ekranlarda "bulut / çevrimdışı" rozetini göstermek için. */
export function isRemoteAiConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_AI_GATEWAY_URL?.trim());
}
