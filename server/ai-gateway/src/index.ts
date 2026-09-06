import Anthropic from '@anthropic-ai/sdk';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import {
  buildPlanSystem,
  buildSystem,
  MetaSplitter,
  TRIP_PLAN_SCHEMA,
  type GatewayContext,
} from './prompt.js';
import { executeTool, tools } from './tools.js';
import { handleVision } from './vision.js';

/* ------------------------------------------------------------------ */
/* Yapılandırma                                                         */
/* ------------------------------------------------------------------ */

const PORT = Number.parseInt(process.env.PORT ?? '8787', 10);
const MODEL = process.env.ZIRVE_AI_MODEL ?? 'claude-opus-5';
const MAX_TOKENS = Number.parseInt(process.env.ZIRVE_AI_MAX_TOKENS ?? '16000', 10);
const MAX_TOOL_ITERATIONS = 6;
const RATE_LIMIT_PER_MIN = Number.parseInt(process.env.RATE_LIMIT_PER_MIN ?? '30', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
const BODY_LIMIT_BYTES = 256 * 1024;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;

/** `ZIRVE_GATEWAY_KEYS="key1,key2"` — boşsa geliştirme modu (uyarı ile herkese açık). */
const API_KEYS = new Set(
  (process.env.ZIRVE_GATEWAY_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean),
);

// API anahtarı ortamdan okunur (ANTHROPIC_API_KEY); uygulamaya asla gömülmez.
const client = new Anthropic({ maxRetries: 2, timeout: 120_000 });

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                          */
/* ------------------------------------------------------------------ */

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function setCors(res: ServerResponse): void {
  res.setHeader('access-control-allow-origin', CORS_ORIGIN);
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type, x-zirtan-key, accept');
  res.setHeader('access-control-max-age', '600');
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sseWrite(res: ServerResponse, event: string, data: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > BODY_LIMIT_BYTES) throw new HttpError(413, 'İstek gövdesi çok büyük');
    chunks.push(buf);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new HttpError(400, 'JSON nesnesi bekleniyor');
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Geçersiz JSON');
  }
}

/* ------------------------------------------------------------------ */
/* Kimlik doğrulama + hız sınırı                                        */
/* ------------------------------------------------------------------ */

function authenticate(req: IncomingMessage): string {
  const header = req.headers['x-zirtan-key'];
  const key = Array.isArray(header) ? header[0] : header;
  if (API_KEYS.size === 0) {
    // Geliştirme modu: anahtar yok; IP'ye göre sınırlama uygulanır.
    return `anon:${req.socket.remoteAddress ?? 'unknown'}`;
  }
  if (!key || !API_KEYS.has(key)) throw new HttpError(401, 'Geçersiz ya da eksik x-zirtan-key');
  return `key:${key}`;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(subject: string): void {
  const now = Date.now();
  const bucket = buckets.get(subject);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(subject, { count: 1, resetAt: now + 60_000 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_PER_MIN)
    throw new HttpError(429, 'Hız sınırı aşıldı; bir dakika sonra tekrar dene');
}

// Eski kovaları temizle (bellek sızıntısı olmasın).
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 60_000).unref();

/* ------------------------------------------------------------------ */
/* İstek doğrulama                                                      */
/* ------------------------------------------------------------------ */

function parseContext(raw: unknown): GatewayContext {
  if (typeof raw !== 'object' || raw === null) return {};
  const c = raw as Record<string, unknown>;
  const coords =
    typeof c.coords === 'object' &&
    c.coords !== null &&
    typeof (c.coords as { latitude?: unknown }).latitude === 'number' &&
    typeof (c.coords as { longitude?: unknown }).longitude === 'number'
      ? (c.coords as { latitude: number; longitude: number })
      : null;
  return {
    locale: typeof c.locale === 'string' ? c.locale.slice(0, 8) : undefined,
    coords,
    adventureTypes: Array.isArray(c.adventureTypes)
      ? c.adventureTypes.filter((t): t is string => typeof t === 'string').slice(0, 8)
      : undefined,
    plan: typeof c.plan === 'string' ? c.plan.slice(0, 16) : undefined,
  };
}

function parseMessages(raw: unknown): Anthropic.MessageParam[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, 'messages boş olamaz');
  const list = raw.slice(-MAX_MESSAGES).map((m): Anthropic.MessageParam => {
    if (typeof m !== 'object' || m === null) throw new HttpError(400, 'Geçersiz mesaj');
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant')
      throw new HttpError(400, 'role user|assistant olmalı');
    if (typeof content !== 'string' || !content.trim())
      throw new HttpError(400, 'content metin olmalı');
    return { role, content: content.slice(0, MAX_MESSAGE_CHARS) };
  });
  // İlk mesaj user olmalı; ardışık aynı roller API tarafından birleştirilir.
  while (list.length > 0 && list[0]?.role !== 'user') list.shift();
  if (list.length === 0 || list[list.length - 1]?.role !== 'user')
    throw new HttpError(400, 'Son mesaj user olmalı');
  return list;
}

/* ------------------------------------------------------------------ */
/* Hata eşleme (SDK'nın tipli hataları)                                 */
/* ------------------------------------------------------------------ */

function mapError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof HttpError)
    return { status: error.status, code: 'bad_request', message: error.message };
  if (error instanceof Anthropic.RateLimitError)
    return {
      status: 429,
      code: 'upstream_rate_limited',
      message: 'Model hız sınırında; biraz sonra tekrar dene',
    };
  if (error instanceof Anthropic.AuthenticationError)
    return {
      status: 500,
      code: 'gateway_misconfigured',
      message: 'Ağ geçidi API anahtarı geçersiz',
    };
  if (error instanceof Anthropic.BadRequestError)
    return { status: 400, code: 'upstream_bad_request', message: error.message };
  if (error instanceof Anthropic.APIConnectionTimeoutError)
    return { status: 504, code: 'upstream_timeout', message: 'Model yanıt vermedi' };
  if (error instanceof Anthropic.APIError)
    return { status: error.status ?? 502, code: 'upstream_error', message: error.message };
  if (error instanceof Anthropic.AnthropicError)
    // İstek kurulamadı (örn. ANTHROPIC_API_KEY eksik)
    return {
      status: 500,
      code: 'gateway_misconfigured',
      message: 'Ağ geçidi yapılandırması eksik',
    };
  if (error instanceof Error && error.name === 'AbortError')
    return { status: 499, code: 'client_closed', message: 'İstemci bağlantıyı kapattı' };
  return { status: 500, code: 'internal', message: 'Beklenmeyen hata' };
}

/* ------------------------------------------------------------------ */
/* POST /v1/chat — SSE                                                  */
/* ------------------------------------------------------------------ */

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req);
  const messages = parseMessages(body.messages);
  const context = parseContext(body.context);

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write(': zirtan-ai\n\n');

  const abort = new AbortController();
  res.on('close', () => abort.abort());
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 15_000);

  const splitter = new MetaSplitter();
  const system = buildSystem(context);
  const usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
  const toolCalls: string[] = [];

  try {
    // Manuel araç döngüsü: her turda akış; tool_use gelirse sonuçları tek user mesajında döndür.
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const stream = client.messages.stream(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: 'adaptive' },
          system,
          tools,
          messages,
        },
        { signal: abort.signal },
      );

      stream.on('text', (delta) => {
        const out = splitter.push(delta);
        if (out) sseWrite(res, 'delta', { text: out });
      });

      const message = await stream.finalMessage();
      usage.input_tokens += message.usage.input_tokens;
      usage.output_tokens += message.usage.output_tokens;
      usage.cache_read_input_tokens += message.usage.cache_read_input_tokens ?? 0;
      usage.cache_creation_input_tokens += message.usage.cache_creation_input_tokens ?? 0;

      if (message.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: message.content });
        continue;
      }

      const toolUses = message.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (message.stop_reason !== 'tool_use' || toolUses.length === 0) {
        if (message.stop_reason === 'refusal') sseWrite(res, 'notice', { code: 'refusal' });
        if (message.stop_reason === 'max_tokens') sseWrite(res, 'notice', { code: 'truncated' });
        break;
      }

      messages.push({ role: 'assistant', content: message.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const use of toolUses) {
        toolCalls.push(use.name);
        sseWrite(res, 'tool', { name: use.name, input: use.input });
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: await executeTool(use.name, use.input),
        });
      }
      messages.push({ role: 'user', content: results });
    }

    const { flushed, visible, meta } = splitter.finish();
    if (flushed) sseWrite(res, 'delta', { text: flushed });
    sseWrite(res, 'done', {
      content: visible,
      intent: meta.intent,
      actions: meta.actions,
      tools: toolCalls,
      usage,
      model: MODEL,
    });
  } catch (error) {
    const mapped = mapError(error);
    if (mapped.code !== 'client_closed') console.error('[chat]', mapped.code, error);
    sseWrite(res, 'error', { code: mapped.code, message: mapped.message });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
}

/* ------------------------------------------------------------------ */
/* POST /v1/plan-trip — JSON (structured output)                        */
/* ------------------------------------------------------------------ */

async function handlePlanTrip(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson(req);
  const prompt =
    typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_MESSAGE_CHARS) : '';
  if (!prompt) throw new HttpError(400, 'prompt gerekli');
  const context = parseContext(body.context);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    system: buildPlanSystem(context),
    messages: [{ role: 'user', content: prompt }],
    output_config: { format: { type: 'json_schema', schema: TRIP_PLAN_SCHEMA } },
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  let plan: unknown;
  try {
    plan = JSON.parse(text);
  } catch {
    throw new HttpError(502, 'Model geçerli JSON döndürmedi');
  }
  sendJson(res, 200, plan);
}

/* ------------------------------------------------------------------ */
/* Sunucu                                                               */
/* ------------------------------------------------------------------ */

const server = createServer(async (req, res) => {
  setCors(res);
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && url.pathname === '/healthz') {
      sendJson(res, 200, { ok: true, model: MODEL, auth: API_KEYS.size > 0 ? 'key' : 'open' });
      return;
    }
    if (
      req.method === 'POST' &&
      (url.pathname === '/v1/chat' ||
        url.pathname === '/v1/plan-trip' ||
        url.pathname === '/v1/vision')
    ) {
      const subject = authenticate(req);
      rateLimit(subject);
      if (url.pathname === '/v1/chat') await handleChat(req, res);
      else if (url.pathname === '/v1/vision')
        // Görüntü analizi: kendi gövde sınırı (8 MB) ve JSON şeması vision.ts içinde.
        await handleVision(req, res, {
          client,
          model: MODEL,
          fail: (status, message) => new HttpError(status, message),
          sendJson,
        });
      else await handlePlanTrip(req, res);
      return;
    }
    sendJson(res, 404, { error: 'not_found' });
  } catch (error) {
    const mapped = mapError(error);
    if (mapped.status >= 500) console.error('[gateway]', error);
    sendJson(res, mapped.status, { error: mapped.code, message: mapped.message });
  }
});

server.listen(PORT, () => {
  if (API_KEYS.size === 0)
    console.warn(
      '[gateway] ZIRVE_GATEWAY_KEYS tanımlı değil — geliştirme modu, kimlik doğrulama yok',
    );
  if (!process.env.ANTHROPIC_API_KEY)
    console.warn('[gateway] ANTHROPIC_API_KEY tanımlı değil — model çağrıları başarısız olur');
  console.log(`[gateway] http://localhost:${PORT}  model=${MODEL}`);
});
