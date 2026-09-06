/**
 * Claude API sarmalayıcısı: yapılandırılmış çıktı (JSON şeması) + streaming + basit kullanım özeti.
 * Model kimliği ortamdan (`MARKETING_MODEL`) ya da varsayılan sabitten gelir.
 */
import Anthropic from '@anthropic-ai/sdk';

import { assertValid, type JsonSchema } from './schemas.js';

const DEFAULT_MODEL = 'claude-opus-5';
const DEFAULT_MAX_TOKENS = 32_000;

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
}

export const usageTotals: Usage = { inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheWrite: 0 };

let cached: Anthropic | null = null;

export function getModel(): string {
  return process.env.MARKETING_MODEL?.trim() || DEFAULT_MODEL;
}

export function getMaxTokens(): number {
  const raw = Number.parseInt(process.env.MARKETING_MAX_TOKENS ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_TOKENS;
}

export function getClient(): Anthropic {
  if (cached) return cached;
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error(
      'ANTHROPIC_API_KEY tanımlı değil. `.env.example` dosyasını `.env` olarak kopyalayıp anahtarı gir.',
    );
  }
  cached = new Anthropic({ maxRetries: 3, timeout: 10 * 60_000 });
  return cached;
}

/** Testlerde sahte istemci enjekte etmek için. */
export function setClientForTests(client: Anthropic | null): void {
  cached = client;
}

export interface StructuredRequest {
  /** Sabit, deterministik sistem istemi — önbelleğe alınır. */
  system: string;
  user: string;
  schema: JsonSchema;
  label: string;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
  /** Akış ilerlemesi (yaklaşık karakter sayısı) — CLI nokta basar. */
  onProgress?: (chars: number) => void;
}

function accumulate(message: Anthropic.Message): void {
  usageTotals.inputTokens += message.usage.input_tokens;
  usageTotals.outputTokens += message.usage.output_tokens;
  usageTotals.cacheRead += message.usage.cache_read_input_tokens ?? 0;
  usageTotals.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function explainStop(message: Anthropic.Message, label: string): void {
  if (message.stop_reason === 'max_tokens')
    throw new Error(
      `${label}: yanıt token sınırında kesildi. MARKETING_MAX_TOKENS'ı artır ya da kapsamı daralt (örn. --weeks 4).`,
    );
  if (message.stop_reason === 'refusal')
    throw new Error(
      `${label}: model isteği reddetti (${message.stop_details?.explanation ?? ''}).`,
    );
}

/**
 * Şemaya bağlı JSON üretir. Uzun çıktılar için streaming kullanılır; tam mesaj alınınca
 * JSON ayrıştırılır ve yerel doğrulayıcıdan geçirilir.
 */
export async function generateStructured<T>(req: StructuredRequest): Promise<T> {
  const client = getClient();
  const stream = client.messages.stream({
    model: getModel(),
    max_tokens: req.maxTokens ?? getMaxTokens(),
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: req.user }],
    output_config: {
      effort: req.effort ?? 'high',
      format: { type: 'json_schema', schema: req.schema },
    },
  });
  let chars = 0;
  stream.on('text', (delta) => {
    chars += delta.length;
    req.onProgress?.(chars);
  });
  const message = await stream.finalMessage();
  accumulate(message);
  explainStop(message, req.label);
  const text = textOf(message);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${req.label}: model geçerli JSON döndürmedi.`);
  }
  return assertValid<T>(req.schema, parsed, req.label);
}

export interface TextRequest {
  system: string;
  user: string;
  label: string;
  maxTokens?: number;
  onText?: (delta: string) => void;
}

/** Serbest metin (Markdown) üretir; akıştaki her parçayı `onText` ile iletir. */
export async function generateText(req: TextRequest): Promise<string> {
  const client = getClient();
  const stream = client.messages.stream({
    model: getModel(),
    max_tokens: req.maxTokens ?? getMaxTokens(),
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: req.user }],
  });
  if (req.onText) stream.on('text', req.onText);
  const message = await stream.finalMessage();
  accumulate(message);
  explainStop(message, req.label);
  return textOf(message);
}

/** Bilinen SDK hatalarını kısa Türkçe açıklamaya çevirir. */
export function describeApiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'API anahtarı geçersiz (401).';
  if (error instanceof Anthropic.RateLimitError)
    return 'Hız sınırı (429) — bir dakika bekleyip tekrar dene.';
  if (error instanceof Anthropic.BadRequestError) return `Geçersiz istek (400): ${error.message}`;
  if (error instanceof Anthropic.APIError) return `API hatası ${error.status}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

export function usageSummary(): string {
  const u = usageTotals;
  return `tokens — giriş ${u.inputTokens} (önbellek okuma ${u.cacheRead}, yazma ${u.cacheWrite}) · çıkış ${u.outputTokens}`;
}
