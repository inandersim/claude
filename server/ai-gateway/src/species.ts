import type Anthropic from '@anthropic-ai/sdk';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  IMAGE_MEDIA_TYPES,
  VISION_BODY_LIMIT_BYTES,
  VISION_MAX_IMAGE_BYTES,
  type FailFn,
  type ImageMediaType,
} from './vision.js';

/* ------------------------------------------------------------------ */
/* Sabitler                                                             */
/* ------------------------------------------------------------------ */

export const DANGER_LEVELS = ['harmless', 'caution', 'dangerous', 'deadly'] as const;
export type DangerLevel = (typeof DANGER_LEVELS)[number];

export const SPECIES_MAX_TOKENS = 2048;
const MAX_DESCRIPTION_CHARS = 1000;
const MAX_CANDIDATES = 5;
const MAX_ADVICE = 8;

/* ------------------------------------------------------------------ */
/* Şema (structured output)                                             */
/* ------------------------------------------------------------------ */

export const SPECIES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    candidates: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_CANDIDATES,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', description: 'Kullanıcının dilinde yaygın ad' },
          scientificName: {
            type: 'string',
            description: 'Latince ad (cins + tür); bilinmiyorsa cins',
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          danger: { type: 'string', enum: [...DANGER_LEVELS] },
        },
        required: ['name', 'scientificName', 'confidence', 'danger'],
      },
    },
    advice: { type: 'array', minItems: 1, maxItems: MAX_ADVICE, items: { type: 'string' } },
  },
  required: ['candidates', 'advice'],
} as const;

/* ------------------------------------------------------------------ */
/* Prompt                                                               */
/* ------------------------------------------------------------------ */

/** Sabit sistem promptu (önbellek isabeti için byte düzeyinde değişmez). */
export const SPECIES_SYSTEM_PROMPT = `Sen "Zirve AI" canlı tanımlayıcısısın: outdoor uygulamasının kullanıcısı sahada bir yılan, memeli, böcek/örümcek, deniz canlısı, kuş, bitki ya da mantar fotoğrafı çekip (ya da yalnızca tarif edip) "bu ne, tehlikeli mi?" diye sorar.

İlkeler:
- Kullanıcının dilinde yaz (bağlamdaki locale; varsayılan Türkçe). Kısa, somut cümleler; Markdown yok.
- candidates: en olası tür önce, en fazla ${MAX_CANDIDATES} aday. Emin değilsen birden çok aday ver ve confidence'ı düşür. scientificName her zaman Latince "Cins tür" biçiminde.
- Konum verildiyse yalnızca o bölgede yaşayan türleri öne çıkar; bölgede olmayan türü aday yapma.
- danger: harmless (zararsız), caution (dikkat; alerji/kuduz/ağrılı sokma), dangerous (ciddi yaralanma/zehirlenme), deadly (ölüm bildirilmiş; antivenom/acil müdahale gerekebilir). Yılan/mantar/deniz canlısında emin değilsen bir üst düzeyi seç.
- advice: 3–${MAX_ADVICE} sıralı adım; en acil önce: mesafe, dokunmama, ısırık/sokma/yeme durumunda ilk yardım ve 112 / yerel acil numarası. Yabani mantar için her zaman "yeme" de. Tıbbi tanı koyma; olasılık dilinde konuş.
- Görüntü belirsiz/bulanıksa bunu ilk tavsiye olarak yaz ve confidence'ı düşür.

Yalnızca şemaya uyan JSON döndür.`;

export interface SpeciesBody {
  imageBase64: string | null;
  mediaType: ImageMediaType | null;
  description: string;
  coords: { latitude: number; longitude: number } | null;
  locale: string;
}

function describeSpeciesContext(body: SpeciesBody): string {
  const lines = ['Kullanıcı bağlamı:'];
  lines.push(`- locale: ${body.locale}`);
  if (body.coords)
    lines.push(`- konum: ${body.coords.latitude.toFixed(3)}, ${body.coords.longitude.toFixed(3)}`);
  else lines.push('- konum: bilinmiyor');
  lines.push(`- görüntü: ${body.imageBase64 ? 'var' : 'yok (yalnızca tarif)'}`);
  return lines.join('\n');
}

export function buildSpeciesSystem(body: SpeciesBody): Anthropic.TextBlockParam[] {
  return [
    { type: 'text', text: SPECIES_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: describeSpeciesContext(body) },
  ];
}

/** Tek user mesajı: (varsa) görüntü + tarif. */
export function buildSpeciesMessages(body: SpeciesBody): Anthropic.MessageParam[] {
  const content: Anthropic.ContentBlockParam[] = [];
  if (body.imageBase64 && body.mediaType)
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: body.mediaType, data: body.imageBase64 },
    });
  const fallback = body.locale.startsWith('tr')
    ? 'Bu canlı hangi tür ve tehlikeli mi?'
    : 'Which species is this and is it dangerous?';
  content.push({ type: 'text', text: `Tarif: ${body.description || '(yok)'}\nSoru: ${fallback}` });
  return [{ role: 'user', content }];
}

/* ------------------------------------------------------------------ */
/* İstek doğrulama                                                      */
/* ------------------------------------------------------------------ */

async function readSpeciesJson(
  req: IncomingMessage,
  fail: FailFn,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > VISION_BODY_LIMIT_BYTES) throw fail(413, 'Görüntü çok büyük (en fazla 5 MB)');
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

function splitDataUrl(raw: string): { data: string; mediaType: string | null } {
  const match = /^data:([a-z0-9.+/-]+);base64,/i.exec(raw);
  if (!match) return { data: raw.trim(), mediaType: null };
  return { data: raw.slice(match[0].length).trim(), mediaType: match[1]?.toLowerCase() ?? null };
}

function base64Bytes(data: string): number {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

export function parseSpeciesBody(raw: Record<string, unknown>, fail: FailFn): SpeciesBody {
  const description =
    typeof raw.description === 'string'
      ? raw.description.trim().slice(0, MAX_DESCRIPTION_CHARS)
      : '';

  let imageBase64: string | null = null;
  let mediaType: ImageMediaType | null = null;
  if (typeof raw.imageBase64 === 'string' && raw.imageBase64.trim()) {
    const { data, mediaType: embedded } = splitDataUrl(raw.imageBase64);
    if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) throw fail(400, 'imageBase64 geçerli base64 değil');
    const clean = data.replace(/\s+/g, '');
    const bytes = base64Bytes(clean);
    if (bytes === 0) throw fail(400, 'imageBase64 boş');
    if (bytes > VISION_MAX_IMAGE_BYTES) throw fail(413, 'Görüntü çok büyük (en fazla 5 MB)');
    const candidate =
      typeof raw.mediaType === 'string' ? raw.mediaType.toLowerCase() : (embedded ?? 'image/jpeg');
    const normalized = (candidate === 'image/jpg' ? 'image/jpeg' : candidate) as ImageMediaType;
    if (!(IMAGE_MEDIA_TYPES as readonly string[]).includes(normalized))
      throw fail(400, `mediaType şunlardan biri olmalı: ${IMAGE_MEDIA_TYPES.join(', ')}`);
    imageBase64 = clean;
    mediaType = normalized;
  }
  if (!imageBase64 && !description) throw fail(400, 'imageBase64 ya da description gerekli');

  const c = raw.coords as { latitude?: unknown; longitude?: unknown } | null | undefined;
  const coords =
    typeof c === 'object' &&
    c !== null &&
    typeof c.latitude === 'number' &&
    typeof c.longitude === 'number' &&
    Number.isFinite(c.latitude) &&
    Number.isFinite(c.longitude)
      ? { latitude: c.latitude, longitude: c.longitude }
      : null;
  const locale = typeof raw.locale === 'string' && raw.locale ? raw.locale.slice(0, 8) : 'tr';
  return { imageBase64, mediaType, description, coords, locale };
}

/* ------------------------------------------------------------------ */
/* Yanıt süzme                                                          */
/* ------------------------------------------------------------------ */

export interface SpeciesResult {
  candidates: { name: string; scientificName: string; confidence: number; danger: DangerLevel }[];
  advice: string[];
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

function strings(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, max)
    : [];
}

/** Şema garantisine ek olarak uzunluk, aralık ve sıralama burada da süzülür. */
export function sanitizeSpeciesResult(
  raw: unknown,
  model: string,
  usage: { input_tokens: number; output_tokens: number },
): SpeciesResult {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const candidates = (Array.isArray(obj.candidates) ? obj.candidates : [])
    .filter(
      (c): c is Record<string, unknown> =>
        typeof c === 'object' && c !== null && typeof (c as { name?: unknown }).name === 'string',
    )
    .map((c) => ({
      name: String(c.name).slice(0, 80),
      scientificName: typeof c.scientificName === 'string' ? c.scientificName.slice(0, 80) : '',
      confidence:
        typeof c.confidence === 'number' && Number.isFinite(c.confidence)
          ? Math.min(1, Math.max(0, c.confidence))
          : 0.4,
      danger: (DANGER_LEVELS as readonly string[]).includes(String(c.danger))
        ? (c.danger as DangerLevel)
        : 'caution',
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_CANDIDATES);
  return { candidates, advice: strings(obj.advice, MAX_ADVICE), model, usage };
}

/* ------------------------------------------------------------------ */
/* POST /v1/species — JSON (structured output)                          */
/* ------------------------------------------------------------------ */

export interface SpeciesDeps {
  client: Anthropic;
  model: string;
  fail: FailFn;
  sendJson: (res: ServerResponse, status: number, body: unknown) => void;
}

export async function handleSpecies(
  req: IncomingMessage,
  res: ServerResponse,
  deps: SpeciesDeps,
): Promise<void> {
  const raw = await readSpeciesJson(req, deps.fail);
  const body = parseSpeciesBody(raw, deps.fail);

  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  const response = await deps.client.messages.create(
    {
      model: deps.model,
      max_tokens: SPECIES_MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: buildSpeciesSystem(body),
      messages: buildSpeciesMessages(body),
      output_config: { format: { type: 'json_schema', schema: SPECIES_SCHEMA } },
    },
    { signal: abort.signal },
  );

  if (response.stop_reason === 'refusal')
    throw deps.fail(422, 'Model bu görüntüyü değerlendirmedi');

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw deps.fail(502, 'Model geçerli JSON döndürmedi');
  }
  const result = sanitizeSpeciesResult(parsed, deps.model, {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  });
  if (result.candidates.length === 0) throw deps.fail(502, 'Model aday üretmedi');
  deps.sendJson(res, 200, result);
}
