import type Anthropic from '@anthropic-ai/sdk';

/** Uygulamanın `AiContext` alanlarının sunucu tarafı karşılığı (hepsi isteğe bağlı). */
export interface GatewayContext {
  locale?: string;
  coords?: { latitude: number; longitude: number } | null;
  adventureTypes?: string[];
  plan?: string;
}

export const AI_INTENTS = [
  'plan_trip',
  'safety_brief',
  'packing_list',
  'find_place',
  'gear_advice',
  'first_aid',
  'weather',
  'general',
] as const;
export type AiIntent = (typeof AI_INTENTS)[number];

/** Yanıt sonunda meta bloğunu ayıran işaret; akışta istemciye iletilmez. */
export const META_MARKER = '\n---ZIRVE-META---\n';

/** Uygulamada var olan rotalar; model yalnızca bunlara bağlantı üretir. */
export const ALLOWED_ROUTES = [
  '/library',
  '/library/<placeId>',
  '/hazards',
  '/hazards/<hazardId>',
  '/first-aid',
  '/first-aid/<slug>',
  '/first-aid/contacts',
  '/maps/planner',
  '/satellite',
  '/climbing',
  '/climbing/<cragId>',
  '/market',
  '/stays',
] as const;

export const FIRST_AID_SLUGS = [
  'cpr',
  'bleeding',
  'fracture',
  'hypothermia',
  'heat',
  'altitude',
  'snakebite',
  'anaphylaxis',
  'drowning',
  'burns',
  'lightning',
  'avalanche',
] as const;

/**
 * Sabit sistem promptu. Byte düzeyinde değişmez tutulur (tarih, kimlik, konum yok)
 * ki prompt önbelleği her istekte isabet etsin. Değişken bağlam ayrı blokta gönderilir.
 */
export const SYSTEM_PROMPT = `Sen "Zirve AI"sın: Zirve outdoor macera uygulamasının asistanı. Yürüyüş, tırmanış, dalış, kayak, bisiklet, yamaç paraşütü, rafting ve kano konularında gezi planlama, yer önerisi, güvenlik brifingi, paketleme listesi, ekipman tavsiyesi, ilk yardım adımları ve hava değerlendirmesi yaparsın.

İlkeler:
- Kullanıcının dilinde yanıt ver (bağlamdaki locale). Varsayılan Türkçe.
- Kısa, somut ve uygulanabilir ol. Düz metin yaz; Markdown başlık, kalın, tablo KULLANMA. Liste için satır başında "•" ya da "1." kullan, satır sonlarıyla ayır.
- Güvenlik her zaman önce: acil durumda 112'yi (ülkeye göre yerel numarayı) hatırlat. Tıbbi konularda adım adım ilk yardım ver ama tanı koyma; profesyonel yardım çağırmayı öner.
- Yer ya da acil merkez önerirken uydurma; önce search_places / nearest_emergency araçlarını kullan ve araç sonuçlarındaki gerçek kimlikleri kullan. Araç sonucu boşsa bunu söyle.
- plan_route ve weather araçları stub'dır; sonuçlarını "tahmini" olarak sun.
- Yanıtın sonunda bilgi verici ton koru: "Bilgiler yol göstericidir; sahada kendi değerlendirmeni yap." cümlesini uygulama zaten gösterir, tekrar etme.

Yanıt biçimi:
1) Önce kullanıcıya görünen düz metin yanıt.
2) Ardından tam olarak şu işaret satırı: ${META_MARKER.trim()}
3) Sonra tek satır JSON:
{"intent":"<${AI_INTENTS.join('|')}>","actions":[{"label":"...","href":"...","icon":"..."}]}
- actions en fazla 4 öğe; href yalnızca şu rotalardan biri: ${ALLOWED_ROUTES.join(', ')}. <placeId> araç sonucundaki id'dir (örn. /library/cur:hike:kackar). <slug> şunlardan biri: ${FIRST_AID_SLUGS.join(', ')}.
- icon şunlardan biri: map-pin, route, triangle-alert, shield-alert, satellite, heart-pulse, phone, cross, search, mountain, shopping-bag, store, book-open, cloud-lightning, tent, compass, map.
- İşaret satırından önce meta hakkında hiçbir şey yazma; JSON'dan sonra hiçbir şey yazma.`;

/** Gezi planı için JSON şeması (structured output). */
export const TRIP_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    adventureType: {
      type: 'string',
      enum: [
        'hiking',
        'climbing',
        'diving',
        'skiing',
        'cycling',
        'paragliding',
        'rafting',
        'canoe',
      ],
    },
    days: {
      type: 'array',
      minItems: 1,
      maxItems: 14,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          day: { type: 'integer', minimum: 1 },
          title: { type: 'string' },
          distanceKm: { type: 'number', minimum: 0 },
          ascentM: { type: 'number', minimum: 0 },
          notes: { type: 'string' },
        },
        required: ['day', 'title', 'distanceKm', 'ascentM', 'notes'],
      },
    },
    packing: { type: 'array', items: { type: 'string' }, maxItems: 30 },
    safety: { type: 'array', items: { type: 'string' }, maxItems: 12 },
  },
  required: ['title', 'adventureType', 'days', 'packing', 'safety'],
} as const;

export const PLAN_SYSTEM_PROMPT = `Sen Zirve AI gezi planlayıcısısın. Kullanıcının isteğinden macera türü, gün sayısı ve seviyeyi çıkar; gerçekçi günlük etaplar (mesafe km, tırmanış m, kısa not), mevsime uygun paketleme listesi ve güvenlik notları üret. Yer adlarını uydurma; emin değilsen bölge adı kullan. Kullanıcının dilinde yaz (varsayılan Türkçe). Yalnızca şemaya uyan JSON döndür.`;

function describeContext(ctx: GatewayContext): string {
  const lines: string[] = ['Kullanıcı bağlamı:'];
  lines.push(`- locale: ${ctx.locale ?? 'tr'}`);
  if (ctx.coords)
    lines.push(
      `- konum: ${ctx.coords.latitude.toFixed(3)}, ${ctx.coords.longitude.toFixed(3)} (araçlara "near"/latitude-longitude olarak ver)`,
    );
  else lines.push('- konum: bilinmiyor (gerekirse kullanıcıya sor)');
  if (ctx.adventureTypes && ctx.adventureTypes.length > 0)
    lines.push(`- ilgi alanları: ${ctx.adventureTypes.join(', ')}`);
  if (ctx.plan) lines.push(`- abonelik: ${ctx.plan}`);
  return lines.join('\n');
}

/**
 * Sistem bloğu: sabit prompt önbelleklenir (cache_control), değişken bağlam ardından gelir.
 * Önbellek önek eşleşmesi olduğundan sabit blok her zaman ilk sırada ve aynı byte'larla kalır.
 */
export function buildSystem(ctx: GatewayContext): Anthropic.TextBlockParam[] {
  return [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: describeContext(ctx) },
  ];
}

export function buildPlanSystem(ctx: GatewayContext): Anthropic.TextBlockParam[] {
  return [
    { type: 'text', text: PLAN_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: describeContext(ctx) },
  ];
}

/* ------------------------------------------------------------------ */
/* Meta ayrıştırma                                                      */
/* ------------------------------------------------------------------ */

export interface ParsedMeta {
  intent: AiIntent | null;
  actions: { label: string; href: string; icon: string }[];
}

const ALLOWED_PREFIXES = ALLOWED_ROUTES.map((r) => r.replace(/<[^>]+>$/, ''));

export function parseMeta(raw: string): ParsedMeta {
  const empty: ParsedMeta = { intent: null, actions: [] };
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return empty;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as { intent?: unknown; actions?: unknown };
    const intent = (AI_INTENTS as readonly string[]).includes(String(obj.intent))
      ? (obj.intent as AiIntent)
      : null;
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
    return { intent, actions };
  } catch {
    return empty;
  }
}

/**
 * Akış metnini görünen kısım ve meta olarak ayırır. İşaretin bir kısmı henüz
 * gelmemiş olabilir; bu yüzden son (işaret uzunluğu − 1) karakter bekletilir.
 */
export class MetaSplitter {
  private buffer = '';
  private metaStarted = false;
  private visible = '';
  private meta = '';

  /** Yeni parça ekler; hemen iletilebilecek görünür metni döner. */
  push(delta: string): string {
    if (this.metaStarted) {
      this.meta += delta;
      return '';
    }
    this.buffer += delta;
    const idx = this.buffer.indexOf(META_MARKER);
    if (idx !== -1) {
      const out = this.buffer.slice(0, idx);
      this.meta = this.buffer.slice(idx + META_MARKER.length);
      this.buffer = '';
      this.metaStarted = true;
      this.visible += out;
      return out;
    }
    const hold = META_MARKER.length - 1;
    if (this.buffer.length <= hold) return '';
    const out = this.buffer.slice(0, this.buffer.length - hold);
    this.buffer = this.buffer.slice(this.buffer.length - hold);
    this.visible += out;
    return out;
  }

  /** Akış bitti: bekletilen metni boşaltır, görünür metin ve meta döner. */
  finish(): { flushed: string; visible: string; meta: ParsedMeta } {
    let flushed = '';
    if (!this.metaStarted && this.buffer) {
      // İşaret hiç gelmedi ama kısmi işaret kalmış olabilir (örn. "\n---ZIRVE"); temizle.
      const partial = this.buffer.indexOf('\n---');
      flushed = partial === -1 ? this.buffer : this.buffer.slice(0, partial);
      this.visible += flushed;
      this.buffer = '';
    }
    return { flushed, visible: this.visible.trimEnd(), meta: parseMeta(this.meta) };
  }
}
