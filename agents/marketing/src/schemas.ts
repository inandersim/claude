/**
 * JSON şemaları (Claude API yapılandırılmış çıktı için) + TypeScript tipleri + bağımlılıksız
 * küçük bir doğrulayıcı. Şemalar bilinçli olarak sade tutulur (type / enum / properties /
 * required / items / additionalProperties / min-max) ki hem API hem `validate` aynı dili konuşsun.
 */

/* ------------------------------------------------------------------ */
/* Ortak sabitler                                                        */
/* ------------------------------------------------------------------ */

export const CHANNEL_IDS = [
  'instagram',
  'facebook',
  'vk',
  'tiktok',
  'youtube',
  'telegram',
  'reddit',
] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];

export const POST_FORMATS = [
  'reel',
  'carousel',
  'single_image',
  'story',
  'short',
  'long_video',
  'text',
  'thread',
  'poll',
  'live',
  'collab',
] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export const OBJECTIVES = [
  'awareness',
  'acquisition',
  'activation',
  'retention',
  'referral',
  'community',
] as const;
export type Objective = (typeof OBJECTIVES)[number];

export const LANG_CODES = ['tr', 'en', 'ru'] as const;

export const AUDIENCE_IDS = [
  'uni-clubs',
  'camping',
  'diving',
  'guides',
  'ru-speakers',
  'solo-hikers',
  'general',
] as const;

/* ------------------------------------------------------------------ */
/* JSON Schema tipi (alt küme)                                           */
/* ------------------------------------------------------------------ */

export type JsonSchema = {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  enum?: readonly (string | number)[];
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';
const TIME_PATTERN = '^([01]\\d|2[0-3]):[0-5]\\d$';

/* ------------------------------------------------------------------ */
/* Plan                                                                  */
/* ------------------------------------------------------------------ */

export interface PlanItem {
  date: string;
  channel: ChannelId;
  format: PostFormat;
  lang: (typeof LANG_CODES)[number];
  audience: (typeof AUDIENCE_IDS)[number];
  theme: string;
  objective: Objective;
  kpi: { metric: string; target: number };
  notes: string;
}

export interface PlanWeek {
  week: number;
  startDate: string;
  theme: string;
  goal: string;
  focusChannels: ChannelId[];
  items: PlanItem[];
}

export interface Plan {
  title: string;
  startDate: string;
  weeks: PlanWeek[];
}

export const PLAN_ITEM_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    date: { type: 'string', pattern: DATE_PATTERN, description: 'YYYY-MM-DD' },
    channel: { type: 'string', enum: CHANNEL_IDS },
    format: { type: 'string', enum: POST_FORMATS },
    lang: { type: 'string', enum: LANG_CODES },
    audience: { type: 'string', enum: AUDIENCE_IDS },
    theme: { type: 'string', minLength: 3, maxLength: 160 },
    objective: { type: 'string', enum: OBJECTIVES },
    kpi: {
      type: 'object',
      additionalProperties: false,
      properties: {
        metric: {
          type: 'string',
          description: 'örn. reach, saves, shares, profile_visits, link_clicks, installs, members',
        },
        target: { type: 'number', minimum: 0 },
      },
      required: ['metric', 'target'],
    },
    notes: { type: 'string', maxLength: 400 },
  },
  required: ['date', 'channel', 'format', 'lang', 'audience', 'theme', 'objective', 'kpi', 'notes'],
};

export const PLAN_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    startDate: { type: 'string', pattern: DATE_PATTERN },
    weeks: {
      type: 'array',
      minItems: 1,
      maxItems: 16,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          week: { type: 'integer', minimum: 1 },
          startDate: { type: 'string', pattern: DATE_PATTERN },
          theme: { type: 'string' },
          goal: { type: 'string' },
          focusChannels: { type: 'array', items: { type: 'string', enum: CHANNEL_IDS } },
          items: { type: 'array', minItems: 1, maxItems: 40, items: PLAN_ITEM_SCHEMA },
        },
        required: ['week', 'startDate', 'theme', 'goal', 'focusChannels', 'items'],
      },
    },
  },
  required: ['title', 'startDate', 'weeks'],
};

/* ------------------------------------------------------------------ */
/* Gönderiler                                                            */
/* ------------------------------------------------------------------ */

export interface Scene {
  n: number;
  durationSec: number;
  visual: string;
  onScreenText: string;
  voiceover: string;
}

export interface MediaRef {
  type: 'image' | 'video';
  /** Herkese açık URL (Instagram için zorunlu). */
  url: string;
  /** Yerel dosya yolu (Facebook / VK / Telegram multipart yükleme). */
  path: string;
  alt: string;
}

export interface Post {
  id: string;
  date: string;
  channel: ChannelId;
  format: PostFormat;
  lang: (typeof LANG_CODES)[number];
  title: string;
  body: string;
  hashtags: string[];
  cta: string;
  bestTime: string;
  link: string;
  /** Reel / Short / uzun video için sahne sahne senaryo; diğer biçimlerde boş dizi. */
  scenes: Scene[];
  /** Hikâye / karusel kareleri; tek görselde boş dizi. */
  frames: string[];
  media: MediaRef[];
  /** Görsel brief: fotoğrafçı/tasarımcı için ne çekilecek/çizilecek. */
  visualBrief: string;
  notes: string;
}

export interface PostsFile {
  week: number;
  generatedAt: string;
  posts: Post[];
}

export const POST_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9-]+$' },
    date: { type: 'string', pattern: DATE_PATTERN },
    channel: { type: 'string', enum: CHANNEL_IDS },
    format: { type: 'string', enum: POST_FORMATS },
    lang: { type: 'string', enum: LANG_CODES },
    title: { type: 'string', maxLength: 120 },
    body: { type: 'string', minLength: 1, maxLength: 4000 },
    hashtags: { type: 'array', maxItems: 30, items: { type: 'string', pattern: '^#\\S+$' } },
    cta: { type: 'string', maxLength: 200 },
    bestTime: { type: 'string', pattern: TIME_PATTERN, description: 'Yerel saat HH:MM' },
    link: { type: 'string', maxLength: 300 },
    scenes: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          n: { type: 'integer', minimum: 1 },
          durationSec: { type: 'number', minimum: 0.5, maximum: 120 },
          visual: { type: 'string' },
          onScreenText: { type: 'string' },
          voiceover: { type: 'string' },
        },
        required: ['n', 'durationSec', 'visual', 'onScreenText', 'voiceover'],
      },
    },
    frames: { type: 'array', maxItems: 12, items: { type: 'string' } },
    media: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['image', 'video'] },
          url: { type: 'string' },
          path: { type: 'string' },
          alt: { type: 'string' },
        },
        required: ['type', 'url', 'path', 'alt'],
      },
    },
    visualBrief: { type: 'string', maxLength: 800 },
    notes: { type: 'string', maxLength: 600 },
  },
  required: [
    'id',
    'date',
    'channel',
    'format',
    'lang',
    'title',
    'body',
    'hashtags',
    'cta',
    'bestTime',
    'link',
    'scenes',
    'frames',
    'media',
    'visualBrief',
    'notes',
  ],
};

export const POSTS_FILE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    week: { type: 'integer', minimum: 1 },
    generatedAt: { type: 'string' },
    posts: { type: 'array', minItems: 1, maxItems: 60, items: POST_SCHEMA },
  },
  required: ['week', 'generatedAt', 'posts'],
};

/* ------------------------------------------------------------------ */
/* Yanıtlar                                                              */
/* ------------------------------------------------------------------ */

export interface Mention {
  id: string;
  channel: ChannelId;
  kind: 'comment' | 'dm' | 'mention' | 'review';
  author: string;
  text: string;
  lang?: string;
  postId?: string;
}

export interface Reply {
  id: string;
  language: string;
  intent: 'question' | 'praise' | 'complaint' | 'safety' | 'spam' | 'partnership' | 'other';
  reply: string;
  escalate: boolean;
  escalateReason: string;
  followUp: string;
}

export interface RepliesFile {
  replies: Reply[];
}

export const REPLIES_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    replies: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          language: { type: 'string' },
          intent: {
            type: 'string',
            enum: ['question', 'praise', 'complaint', 'safety', 'spam', 'partnership', 'other'],
          },
          reply: { type: 'string', maxLength: 1000 },
          escalate: { type: 'boolean' },
          escalateReason: { type: 'string' },
          followUp: { type: 'string', description: 'Ekibin yapması gereken iş (boş olabilir)' },
        },
        required: ['id', 'language', 'intent', 'reply', 'escalate', 'escalateReason', 'followUp'],
      },
    },
  },
  required: ['replies'],
};

/* ------------------------------------------------------------------ */
/* Analiz                                                                */
/* ------------------------------------------------------------------ */

export interface Analysis {
  period: string;
  summary: string;
  highlights: string[];
  byChannel: { channel: ChannelId; verdict: string; keepDoing: string[]; stopDoing: string[] }[];
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    channel: ChannelId;
    action: string;
    rationale: string;
    kpi: string;
  }[];
  nextWeekThemes: string[];
}

export const ANALYSIS_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    period: { type: 'string' },
    summary: { type: 'string', maxLength: 1200 },
    highlights: { type: 'array', maxItems: 8, items: { type: 'string' } },
    byChannel: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          channel: { type: 'string', enum: CHANNEL_IDS },
          verdict: { type: 'string' },
          keepDoing: { type: 'array', items: { type: 'string' } },
          stopDoing: { type: 'array', items: { type: 'string' } },
        },
        required: ['channel', 'verdict', 'keepDoing', 'stopDoing'],
      },
    },
    recommendations: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          channel: { type: 'string', enum: CHANNEL_IDS },
          action: { type: 'string' },
          rationale: { type: 'string' },
          kpi: { type: 'string' },
        },
        required: ['priority', 'channel', 'action', 'rationale', 'kpi'],
      },
    },
    nextWeekThemes: { type: 'array', maxItems: 6, items: { type: 'string' } },
  },
  required: ['period', 'summary', 'highlights', 'byChannel', 'recommendations', 'nextWeekThemes'],
};

/* ------------------------------------------------------------------ */
/* Doğrulayıcı                                                           */
/* ------------------------------------------------------------------ */

export interface ValidationError {
  path: string;
  message: string;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Şemaya göre değeri denetler; hata listesi döner (boş = geçerli). */
export function validate(schema: JsonSchema, value: unknown, path = '$'): ValidationError[] {
  const errors: ValidationError[] = [];
  const push = (message: string): void => {
    errors.push({ path, message });
  };

  if (schema.type) {
    const actual = typeOf(value);
    const ok =
      schema.type === 'integer'
        ? actual === 'number' && Number.isInteger(value)
        : schema.type === actual;
    if (!ok) {
      push(`beklenen tür ${schema.type}, gelen ${actual}`);
      return errors;
    }
  }

  if (schema.enum && !schema.enum.includes(value as string | number)) {
    push(`değer enum dışında: ${JSON.stringify(value)} ∉ [${schema.enum.join(', ')}]`);
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      push(`en az ${schema.minLength} karakter olmalı`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      push(`en fazla ${schema.maxLength} karakter olmalı (${value.length})`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value))
      push(`desene uymuyor: /${schema.pattern}/ → ${JSON.stringify(value)}`);
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) push(`en az ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) push(`en fazla ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      push(`en az ${schema.minItems} öğe olmalı`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      push(`en fazla ${schema.maxItems} öğe olmalı (${value.length})`);
    if (schema.items) {
      value.forEach((item, i) => {
        errors.push(...validate(schema.items as JsonSchema, item, `${path}[${i}]`));
      });
    }
  }

  if (typeOf(value) === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) errors.push({ path: `${path}.${key}`, message: 'zorunlu alan eksik' });
    }
    if (schema.properties) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (key in obj) errors.push(...validate(sub, obj[key], `${path}.${key}`));
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(obj)) {
          if (!(key in schema.properties))
            errors.push({ path: `${path}.${key}`, message: 'tanımsız alan' });
        }
      }
    }
  }

  return errors;
}

/** Doğrulama hatalarını tek satırlık okunur metne çevirir. */
export function formatErrors(errors: ValidationError[]): string {
  return errors.map((e) => `${e.path}: ${e.message}`).join('\n');
}

/** Hata varsa fırlatır; yoksa değeri istenen tipe daraltır. */
export function assertValid<T>(schema: JsonSchema, value: unknown, label: string): T {
  const errors = validate(schema, value);
  if (errors.length > 0) {
    throw new Error(`${label} şemaya uymuyor:\n${formatErrors(errors.slice(0, 20))}`);
  }
  return value as T;
}
