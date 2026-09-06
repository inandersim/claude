import type Anthropic from '@anthropic-ai/sdk';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { FIRST_AID_SLUGS } from './prompt.js';

/* ------------------------------------------------------------------ */
/* Sabitler                                                             */
/* ------------------------------------------------------------------ */

export const TRIAGE_URGENCIES = ['low', 'medium', 'high', 'critical'] as const;
export type TriageUrgency = (typeof TRIAGE_URGENCIES)[number];

export const TRIAGE_MAX_TOKENS = 2048;
const TRIAGE_BODY_LIMIT_BYTES = 64 * 1024;
const MAX_COMPLAINT_CHARS = 2000;
const MAX_STEPS = 8;

export interface TriageBody {
  complaint: string;
  locale: 'tr' | 'en';
  species: { commonName: string | null; firstAidSlug: string | null } | null;
}

export interface TriageResult {
  urgency: TriageUrgency;
  steps: string[];
  firstAidSlug: string | null;
  callEmergency: boolean;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

export type FailFn = (status: number, message: string) => Error;

export interface TriageDeps {
  client: Anthropic;
  model: string;
  fail: FailFn;
  sendJson: (res: ServerResponse, status: number, body: unknown) => void;
}

/* ------------------------------------------------------------------ */
/* Şema ve prompt                                                       */
/* ------------------------------------------------------------------ */

export const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    urgency: { type: 'string', enum: [...TRIAGE_URGENCIES] },
    steps: {
      type: 'array',
      minItems: 2,
      maxItems: MAX_STEPS,
      items: { type: 'string' },
      description: 'Doktor gelene kadar sırayla yapılacaklar; kısa, emir kipinde',
    },
    firstAidSlug: {
      type: ['string', 'null'],
      enum: [...FIRST_AID_SLUGS, null],
    },
    callEmergency: { type: 'boolean' },
    rationale: { type: 'string', description: 'Tek cümle; kullanıcıya gösterilmez' },
  },
  required: ['urgency', 'steps', 'firstAidSlug', 'callEmergency', 'rationale'],
} as const;

/**
 * Sabit sistem promptu (önbellek dostu). Değişken bağlam kullanıcı mesajında gönderilir.
 */
export const TRIAGE_SYSTEM = `Sen Zirtan outdoor uygulamasının tele-tıp ön triyaj asistanısın. Kullanıcı doğada (dağ, orman, deniz, kamp) bir sağlık sorunu yaşıyor ve çevrimiçi doktor bekliyor. Görevin: şikâyeti okuyup ACİLİYET belirlemek ve doktor gelene kadar uygulanacak İLK ADIMLARI vermek.

Kurallar:
- urgency: critical = hayati tehlike (bilinç kaybı, nefes darlığı, anafilaksi, ağır kanama, HAPE/HACE, dekompresyon, boğulma, göğüs ağrısı); high = hızla kötüleşebilir (yılan ısırığı, kırık şüphesi ile deformite, hipotermi, sıcak çarpması, AMS ilerleyen); medium = tıbbi değerlendirme gerekli ama stabil (burkulma, yanık, akrep sokması hafif); low = bilgi amaçlı (kene, hafif döküntü).
- callEmergency: critical ve high için true.
- steps: WMS / ERC kılavuzlarına uygun, sahada uygulanabilir, en fazla ${MAX_STEPS} madde. Yılan ısırığında turnike/kesme/emme YASAK. Anafilakside adrenalin oto-enjektör. İrtifa hastalığında İN. Dalış hastalığında oksijen + basınç odası.
- firstAidSlug: uygulamadaki rehberlerden biri (${FIRST_AID_SLUGS.join(', ')}) ya da null.
- Dil: istekteki locale ne ise (tr/en) steps o dilde olsun. Kısa cümleler, tıbbi jargon yok.
- Tanı koyma; ilaç dozu verme (yalnızca kılavuzlardaki standart ilk yardım ilaçları: aspirin 300 mg, parasetamol, adrenalin oto-enjektör). Tele-tıp acil servisin yerini tutmaz; şüphede aciliyeti yükselt.`;

/* ------------------------------------------------------------------ */
/* Gövde okuma / doğrulama                                              */
/* ------------------------------------------------------------------ */

async function readTriageJson(
  req: IncomingMessage,
  fail: FailFn,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > TRIAGE_BODY_LIMIT_BYTES) throw fail(413, 'İstek gövdesi çok büyük');
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

export function parseTriageBody(raw: Record<string, unknown>, fail: FailFn): TriageBody {
  const complaint = typeof raw.complaint === 'string' ? raw.complaint.trim() : '';
  if (complaint.length < 3) throw fail(400, 'complaint alanı gerekli (en az 3 karakter)');
  if (complaint.length > MAX_COMPLAINT_CHARS)
    throw fail(400, `complaint en fazla ${MAX_COMPLAINT_CHARS} karakter olabilir`);
  const locale: 'tr' | 'en' =
    typeof raw.locale === 'string' && raw.locale.toLowerCase().startsWith('en') ? 'en' : 'tr';

  let species: TriageBody['species'] = null;
  if (typeof raw.species === 'object' && raw.species !== null) {
    const s = raw.species as Record<string, unknown>;
    species = {
      commonName: typeof s.commonName === 'string' ? s.commonName.slice(0, 80) : null,
      firstAidSlug:
        typeof s.firstAidSlug === 'string' &&
        (FIRST_AID_SLUGS as readonly string[]).includes(s.firstAidSlug)
          ? s.firstAidSlug
          : null,
    };
  }
  return { complaint, locale, species };
}

export function buildTriageMessages(body: TriageBody): Anthropic.MessageParam[] {
  const lines = [
    `Locale: ${body.locale}`,
    body.species
      ? `Species hint: ${body.species.commonName ?? '-'} (guide: ${body.species.firstAidSlug ?? '-'})`
      : null,
    '',
    'Complaint:',
    body.complaint,
  ].filter((l): l is string => l !== null);
  return [{ role: 'user', content: lines.join('\n') }];
}

/** Model çıktısını doğrular ve sınırlar; eksik alanlarda güvenli tarafa yuvarlar. */
export function sanitizeTriageResult(
  parsed: unknown,
  model: string,
  usage: { input_tokens: number; output_tokens: number },
): TriageResult {
  const o = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<
    string,
    unknown
  >;
  const urgency: TriageUrgency =
    typeof o.urgency === 'string' && (TRIAGE_URGENCIES as readonly string[]).includes(o.urgency)
      ? (o.urgency as TriageUrgency)
      : 'high';
  const steps = Array.isArray(o.steps)
    ? o.steps
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, MAX_STEPS)
    : [];
  const firstAidSlug =
    typeof o.firstAidSlug === 'string' &&
    (FIRST_AID_SLUGS as readonly string[]).includes(o.firstAidSlug)
      ? o.firstAidSlug
      : null;
  const callEmergency =
    typeof o.callEmergency === 'boolean'
      ? o.callEmergency || urgency === 'critical' || urgency === 'high'
      : urgency === 'critical' || urgency === 'high';
  return { urgency, steps, firstAidSlug, callEmergency, model, usage };
}

/* ------------------------------------------------------------------ */
/* POST /v1/triage — JSON                                               */
/* ------------------------------------------------------------------ */

/**
 * Şikâyetten aciliyet + ilk adımlar + rehber slug'ı üretir. `index.ts` bu
 * işleyiciyi `/v1/triage` rotasına bağlar (kimlik doğrulama ve hız sınırı orada).
 */
export async function handleTriage(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TriageDeps,
): Promise<void> {
  const raw = await readTriageJson(req, deps.fail);
  const body = parseTriageBody(raw, deps.fail);

  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  const response = await deps.client.messages.create(
    {
      model: deps.model,
      max_tokens: TRIAGE_MAX_TOKENS,
      system: TRIAGE_SYSTEM,
      messages: buildTriageMessages(body),
      output_config: { format: { type: 'json_schema', schema: TRIAGE_SCHEMA } },
    },
    { signal: abort.signal },
  );

  if (response.stop_reason === 'refusal') throw deps.fail(422, 'Model bu isteği değerlendirmedi');

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
  const result = sanitizeTriageResult(parsed, deps.model, {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  });
  if (result.steps.length === 0) throw deps.fail(502, 'Model adım üretmedi');
  deps.sendJson(res, 200, result);
}
