import type Anthropic from '@anthropic-ai/sdk';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { FIRST_AID_SLUGS } from './prompt.js';

/* ------------------------------------------------------------------ */
/* Sabitler                                                             */
/* ------------------------------------------------------------------ */

export const VISION_SITUATIONS = [
  'terrain',
  'weather',
  'gear',
  'injury',
  'wildlife',
  'plant',
  'map',
  'water',
  'camp',
  'other',
] as const;
export type VisionSituation = (typeof VISION_SITUATIONS)[number];

export const RISK_LEVELS = ['low', 'moderate', 'high', 'extreme'] as const;

/** Claude'un kabul ettiği görüntü türleri. */
export const IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

/** Ham görüntü üst sınırı (base64 çözülmüş). */
export const VISION_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** JSON gövde üst sınırı: 5 MB görüntü base64 ile ~6,7 MB + alanlar. */
export const VISION_BODY_LIMIT_BYTES = 8 * 1024 * 1024;
export const VISION_MAX_TOKENS = 4096;
const MAX_QUESTION_CHARS = 1000;

/** Uygulama içi rotalar; model yalnızca bunlara bağlantı üretir. */
export const VISION_ALLOWED_ROUTES = [
  '/first-aid/<slug>',
  '/hazards',
  '/hazards/<hazardId>',
  '/satellite/sos',
  '/destinations/ams',
  '/maps/planner',
] as const;
const ALLOWED_PREFIXES = VISION_ALLOWED_ROUTES.map((r) => r.replace(/<[^>]+>$/, ''));

const VISION_ICONS = [
  'heart-pulse',
  'triangle-alert',
  'satellite',
  'mountain',
  'route',
  'cloud-lightning',
  'tent',
  'compass',
  'droplets',
  'paw-print',
  'map',
  'shield-alert',
] as const;

/* ------------------------------------------------------------------ */
/* Şema (structured output)                                             */
/* ------------------------------------------------------------------ */

export const VISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    observations: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: { type: 'string' },
      description: 'Görüntüde gerçekten görülen şeyler; kısa maddeler',
    },
    risk: { type: 'string', enum: [...RISK_LEVELS] },
    advice: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string' } },
    avoid: { type: 'array', maxItems: 8, items: { type: 'string' } },
    actions: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          href: { type: 'string' },
          icon: { type: 'string', enum: [...VISION_ICONS] },
        },
        required: ['label', 'href', 'icon'],
      },
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['observations', 'risk', 'advice', 'avoid', 'actions', 'confidence'],
} as const;

/* ------------------------------------------------------------------ */
/* Prompt                                                               */
/* ------------------------------------------------------------------ */

/** Duruma göre modele verilen değerlendirme rehberi (sabit; önbelleklenen blokta). */
const SITUATION_GUIDES: Record<VisionSituation, string> = {
  terrain:
    'Arazi: eğimi tahmin et (30–45° kar yamacı çığ için en tehlikeli), kaya düşmesi belirtileri (taze kırık, moloz), zemin (kaygan/gevşek/buzlu), karniş, geçiş zorluğu ve geri dönüş seçeneği.',
  weather:
    'Hava: bulut tipleri (kümülonimbus/örs → fırtına ve yıldırım, mercek → rüzgâr, alçalan tabaka → cephe), görüş, 30/30 yıldırım kuralı, kalan güvenli süre tahmini.',
  gear: 'Ekipman: yıpranma (kılıf kesiği, aşınmış bağlantı halkası, çatlak kask), doğru kurulum (çift geçirilmiş kayış, kilitli karabina, doğru düğüm), eksik parça.',
  injury:
    'Yaralanma: görülen belirtiler (kanama, şişlik, deformasyon, renk), ABC önceliği, adım adım ilk yardım, ne zaman 112 / uydu SOS. Tanı koyma; olasılık dilinde konuş.',
  wildlife:
    'Yaban hayatı: olası tür (emin değilsen söyle), tehlike düzeyi, mesafe, geri çekilme davranışı (ayı: koşma; yılan: dokunma; yaban domuzu: yolunu kesme; çoban köpeği: baton indir).',
  plant:
    'Bitki/mantar: olası tür ve benzerleri, temas/yeme riski. Yabani mantar için her zaman "yemeyin" de; kesin tanımlama yapma.',
  map: 'Harita/pusula: harita türü, ölçek, kontur yoğunluğu, kuzey hizası, görünen semboller, önerilen yön. Kullanıcı koordinatı verildiyse haritayla ilişkilendir.',
  water:
    'Su: akış/durgunluk, bulanıklık, köpük/yosun, yukarı akış kirleticileri; arıtma önerisi (kaynatma, filtre, tablet, UV) ve süreler.',
  camp: 'Kamp yeri: rüzgâr maruziyeti, su/taşkın izleri, çığ koridoru, ölü ağaç/dal, zemin drenajı, soğuk hava gölü; alternatif yer önerisi.',
  other:
    'Genel: fotoğrafta güvenlikle ilgili ne varsa değerlendir, belirsizse ne sorman gerektiğini söyle.',
};

/**
 * Sabit sistem promptu (byte düzeyinde değişmez; önbellek isabeti için).
 * Kullanıcı bağlamı ayrı blokta gönderilir.
 */
export const VISION_SYSTEM_PROMPT = `Sen "Zirve AI" görüntü değerlendiricisisin: outdoor macera uygulamasının kullanıcısı sahada kamerayla bir fotoğraf çekip durum seçer ve "burada ne yapmalıyım?" diye sorar. Fotoğrafı dikkatle incele ve yalnızca gördüğüne dayanarak gözlem, risk ve uygulanabilir tavsiye üret.

İlkeler:
- Kullanıcının dilinde yaz (bağlamdaki locale; varsayılan Türkçe). Kısa, somut cümleler; Markdown yok.
- observations: yalnızca görüntüde gerçekten görülenler. Görüntü belirsiz/karanlık/bulanıksa bunu ilk gözlem olarak yaz ve confidence'ı düşür.
- risk: low (rutin dikkat), moderate (önlem gerekli), high (ciddi tehlike, plan değiştir), extreme (hayati tehlike; hemen uzaklaş/yardım çağır).
- advice: 3–8 sıralı adım; en acil olan ilk sırada. avoid: yapılmaması gerekenler.
- Güvenlik önce: hayati durumda 112'yi (ülkeye göre yerel numara) ya da uydu SOS'u hatırlat. Tıbbi konuda tanı koyma, olasılık dilinde konuş; bitki/mantar için kesin "yenilebilir" deme.
- confidence: görüntü kalitesi ve tanımlama kesinliğine göre 0–1.
- actions: en fazla 4 uygulama içi bağlantı; href yalnızca şu rotalardan biri: ${VISION_ALLOWED_ROUTES.join(', ')}. <slug> şunlardan biri: ${FIRST_AID_SLUGS.join(', ')}. <hazardId> yalnızca bağlamda verilen tehlike kimlikleri. icon şunlardan biri: ${VISION_ICONS.join(', ')}.

Durum rehberleri:
${VISION_SITUATIONS.map((s) => `- ${s}: ${SITUATION_GUIDES[s]}`).join('\n')}

Yalnızca şemaya uyan JSON döndür.`;

export interface VisionBody {
  imageBase64: string;
  mediaType: ImageMediaType;
  situation: VisionSituation;
  question: string;
  coords: { latitude: number; longitude: number } | null;
  altitudeM: number | null;
  locale: string;
}

function describeVisionContext(body: VisionBody): string {
  const lines = ['Kullanıcı bağlamı:'];
  lines.push(`- locale: ${body.locale}`);
  lines.push(`- durum: ${body.situation}`);
  if (body.coords)
    lines.push(`- konum: ${body.coords.latitude.toFixed(4)}, ${body.coords.longitude.toFixed(4)}`);
  else lines.push('- konum: bilinmiyor');
  if (body.altitudeM !== null) lines.push(`- irtifa: ${Math.round(body.altitudeM)} m`);
  return lines.join('\n');
}

export function buildVisionSystem(body: VisionBody): Anthropic.TextBlockParam[] {
  return [
    { type: 'text', text: VISION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: describeVisionContext(body) },
  ];
}

/** Tek user mesajı: görüntü bloğu + metin sorusu. */
export function buildVisionMessages(body: VisionBody): Anthropic.MessageParam[] {
  const question =
    body.question.trim() ||
    (body.locale.startsWith('tr')
      ? 'Bu fotoğrafa göre burada ne yapmalıyım?'
      : 'Based on this photo, what should I do here?');
  return [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: body.mediaType, data: body.imageBase64 },
        },
        { type: 'text', text: `Durum: ${body.situation}\nSoru: ${question}` },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* İstek doğrulama                                                      */
/* ------------------------------------------------------------------ */

/** index.ts'deki HttpError'ı üretmek için enjekte edilen fabrika (döngüsel import yok). */
export type FailFn = (status: number, message: string) => Error;

export interface VisionDeps {
  client: Anthropic;
  model: string;
  fail: FailFn;
  sendJson: (res: ServerResponse, status: number, body: unknown) => void;
}

async function readVisionJson(
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

/** `data:image/jpeg;base64,…` önekini ayıklar; medya türünü de döner. */
function splitDataUrl(raw: string): { data: string; mediaType: string | null } {
  const match = /^data:([a-z0-9.+/-]+);base64,/i.exec(raw);
  if (!match) return { data: raw.trim(), mediaType: null };
  return { data: raw.slice(match[0].length).trim(), mediaType: match[1]?.toLowerCase() ?? null };
}

function base64Bytes(data: string): number {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

export function parseVisionBody(raw: Record<string, unknown>, fail: FailFn): VisionBody {
  if (typeof raw.imageBase64 !== 'string' || !raw.imageBase64.trim())
    throw fail(400, 'imageBase64 gerekli');
  const { data, mediaType: embedded } = splitDataUrl(raw.imageBase64);
  if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) throw fail(400, 'imageBase64 geçerli base64 değil');
  const clean = data.replace(/\s+/g, '');
  const bytes = base64Bytes(clean);
  if (bytes === 0) throw fail(400, 'imageBase64 boş');
  if (bytes > VISION_MAX_IMAGE_BYTES) throw fail(413, 'Görüntü çok büyük (en fazla 5 MB)');

  const mediaCandidate =
    typeof raw.mediaType === 'string' ? raw.mediaType.toLowerCase() : (embedded ?? 'image/jpeg');
  const mediaType = (
    mediaCandidate === 'image/jpg' ? 'image/jpeg' : mediaCandidate
  ) as ImageMediaType;
  if (!(IMAGE_MEDIA_TYPES as readonly string[]).includes(mediaType))
    throw fail(400, `mediaType şunlardan biri olmalı: ${IMAGE_MEDIA_TYPES.join(', ')}`);

  const situation = (VISION_SITUATIONS as readonly string[]).includes(String(raw.situation))
    ? (raw.situation as VisionSituation)
    : 'other';
  const question =
    typeof raw.question === 'string' ? raw.question.trim().slice(0, MAX_QUESTION_CHARS) : '';
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
  const altitudeM =
    typeof raw.altitudeM === 'number' && Number.isFinite(raw.altitudeM) ? raw.altitudeM : null;
  const locale = typeof raw.locale === 'string' && raw.locale ? raw.locale.slice(0, 8) : 'tr';

  return { imageBase64: clean, mediaType, situation, question, coords, altitudeM, locale };
}

/* ------------------------------------------------------------------ */
/* Yanıt süzme                                                          */
/* ------------------------------------------------------------------ */

export interface VisionResult {
  situation: VisionSituation;
  observations: string[];
  risk: (typeof RISK_LEVELS)[number];
  advice: string[];
  avoid: string[];
  actions: { label: string; href: string; icon: string }[];
  confidence: number;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

function strings(value: unknown, max: number): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, max)
    : [];
}

/** Şema garantisine ek olarak rota önekleri ve uzunluklar burada da süzülür. */
export function sanitizeVisionResult(
  raw: unknown,
  body: VisionBody,
  model: string,
  usage: { input_tokens: number; output_tokens: number },
): VisionResult {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const risk = (RISK_LEVELS as readonly string[]).includes(String(obj.risk))
    ? (obj.risk as VisionResult['risk'])
    : 'moderate';
  const confidence =
    typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
      ? Math.min(1, Math.max(0, obj.confidence))
      : 0.5;
  const actions = Array.isArray(obj.actions)
    ? obj.actions
        .filter(
          (a): a is { label: string; href: string; icon?: string } =>
            typeof a === 'object' &&
            a !== null &&
            typeof (a as { label?: unknown }).label === 'string' &&
            typeof (a as { href?: unknown }).href === 'string',
        )
        .filter((a) => ALLOWED_PREFIXES.some((p) => a.href === p || a.href.startsWith(p)))
        .slice(0, 4)
        .map((a) => ({
          label: a.label.slice(0, 40),
          href: a.href,
          icon: typeof a.icon === 'string' ? a.icon : 'arrow-up-right',
        }))
    : [];
  return {
    situation: body.situation,
    observations: strings(obj.observations, 8),
    risk,
    advice: strings(obj.advice, 10),
    avoid: strings(obj.avoid, 8),
    actions,
    confidence,
    model,
    usage,
  };
}

/* ------------------------------------------------------------------ */
/* POST /v1/vision — JSON (structured output)                           */
/* ------------------------------------------------------------------ */

export async function handleVision(
  req: IncomingMessage,
  res: ServerResponse,
  deps: VisionDeps,
): Promise<void> {
  const raw = await readVisionJson(req, deps.fail);
  const body = parseVisionBody(raw, deps.fail);

  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  const response = await deps.client.messages.create(
    {
      model: deps.model,
      max_tokens: VISION_MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: buildVisionSystem(body),
      messages: buildVisionMessages(body),
      output_config: { format: { type: 'json_schema', schema: VISION_SCHEMA } },
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
  const result = sanitizeVisionResult(parsed, body, deps.model, {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  });
  deps.sendJson(res, 200, result);
}
