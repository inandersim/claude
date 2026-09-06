/**
 * Telemetri okuma ve doğrulama (bağımlılıksız, Node 22).
 *
 * Sözleşme: agents/selfheal/telemetry.schema.json. Doğrulama şemadan sürülür —
 * şema değişince bu dosyayı değiştirmeye gerek yoktur (desteklenen alt küme:
 * type, required, enum, properties, additionalProperties, pattern, minimum,
 * maximum, maxLength, format:date-time). Tür başına `detail` şekli şemadaki
 * `$defs.detail_<kind>` ile doğrulanır.
 *
 * Kaynak seçimi:
 *   1. `ZIRTAN_TELEMETRY_URL` tanımlıysa oradan GET ile çekilir (yalnızca okuma;
 *      hiçbir veri gönderilmez, gövde yollanmaz, kimlik bilgisi eklenmez).
 *   2. Aksi halde `agents/selfheal/fixtures/telemetry.json` kullanılır.
 *
 * Gizlilik: `scrubEvent` kişisel veri sızabilecek alanları kırpar (rota kimlikleri,
 * sorgu dizeleri, e-posta/telefon benzeri diziler, uzun yığın izleri).
 */
import { join } from 'node:path';
import { readJsonSafe, SELFHEAL_DIR, clamp01 } from './util.mjs';

export const SCHEMA_PATH = join(SELFHEAL_DIR, 'telemetry.schema.json');
export const FIXTURE_PATH = join(SELFHEAL_DIR, 'fixtures', 'telemetry.json');

/** Şemayı okur (tek sefer, önbellekli). */
let cachedSchema = null;
export function loadSchema(path = SCHEMA_PATH) {
  if (!cachedSchema || path !== SCHEMA_PATH) {
    const schema = readJsonSafe(path);
    if (!schema) throw new Error(`Telemetri şeması okunamadı: ${path}`);
    if (path === SCHEMA_PATH) cachedSchema = schema;
    else return schema;
  }
  return cachedSchema;
}

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * JSON Schema'nın küçük bir alt kümesini uygular. Hata listesi döner (boş = geçerli).
 * Bilinçli olarak eksiktir: yalnızca telemetry.schema.json'un kullandığı anahtar
 * kelimeleri destekler; bilinmeyen anahtar kelimeler sessizce yok sayılır.
 */
export function validateAgainst(schema, value, path = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;

  const type = schema.type;
  const typeOk = (t) => {
    switch (t) {
      case 'object':
        return value !== null && typeof value === 'object' && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && Number.isFinite(value);
      case 'integer':
        return Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return true;
    }
  };
  if (type && !typeOk(type)) {
    errors.push(`${path}: tür '${type}' bekleniyordu, '${Array.isArray(value) ? 'array' : typeof value}' geldi`);
    return errors; // tür yanlışsa alt kuralları denemenin anlamı yok
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: '${value}' izinli değerlerden biri değil (${schema.enum.join(', ')})`);
  }
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: '${value}' biçime uymuyor (${schema.pattern})`);
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      errors.push(`${path}: ${value.length} karakter, en fazla ${schema.maxLength} olmalı`);
    }
    if (schema.format === 'date-time' && !ISO_DATE_TIME.test(value)) {
      errors.push(`${path}: '${value}' ISO-8601 zaman damgası değil`);
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) {
      errors.push(`${path}: ${value} en az ${schema.minimum} olmalı`);
    }
    if (schema.maximum != null && value > schema.maximum) {
      errors.push(`${path}: ${value} en fazla ${schema.maximum} olmalı`);
    }
  }
  if (type === 'object' || (value && typeof value === 'object' && !Array.isArray(value))) {
    for (const key of schema.required ?? []) {
      if (value[key] === undefined) errors.push(`${path}.${key}: zorunlu alan eksik`);
    }
    const props = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${path}.${key}: şemada tanımsız alan (sözleşme dışı veri)`);
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (value[key] !== undefined) errors.push(...validateAgainst(sub, value[key], `${path}.${key}`));
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => errors.push(...validateAgainst(schema.items, item, `${path}[${i}]`)));
  }
  return errors;
}

/**
 * Tek bir olayı doğrular: önce üst şema, sonra `kind`'a göre `$defs.detail_<kind>`.
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateEvent(event, schema = loadSchema()) {
  const errors = validateAgainst(schema, event, '$');
  const detailSchema = schema.$defs?.[`detail_${event?.kind}`];
  if (detailSchema) {
    if (event.detail === undefined) {
      errors.push(`$.detail: '${event.kind}' türü için zorunlu`);
    } else {
      errors.push(...validateAgainst(detailSchema, event.detail, '$.detail'));
    }
  } else if (event?.kind) {
    errors.push(`$.kind: '${event.kind}' için detail şeması tanımlı değil`);
  }
  return { ok: errors.length === 0, errors };
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE = /(?:\+\d[\d\s-]{7,}\d)/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const LONG_NUM = /\b\d{7,}\b/g;

/** Serbest metinden kişisel veri benzeri dizileri temizler. */
export function scrubText(text, maxLength = 4000) {
  if (typeof text !== 'string') return text;
  return text
    .replace(EMAIL, '[eposta]')
    .replace(PHONE, '[telefon]')
    .replace(UUID, '[uuid]')
    .replace(LONG_NUM, '[sayı]')
    .slice(0, maxLength);
}

/**
 * Bir olayı gizlilik açısından temizler: rota/uç nokta kimlikleri maskelenir,
 * sorgu dizesi atılır, serbest metinler `scrubText`ten geçer.
 * Şema dışı alanlar burada düşürülmez — onlar doğrulamada hata olarak raporlanır.
 */
export function scrubEvent(event) {
  const maskPath = (p) =>
    String(p)
      .split('?')[0]
      .split('/')
      .map((seg) => (/^\d+$/.test(seg) || UUID.test(seg) || seg.length > 24 ? '[id]' : seg))
      .join('/');
  const out = { ...event };
  if (out.route) out.route = maskPath(out.route);
  if (out.detail) {
    const d = { ...out.detail };
    if (d.endpoint) d.endpoint = maskPath(d.endpoint);
    if (d.message) d.message = scrubText(d.message, 400);
    if (d.stack) d.stack = scrubText(d.stack, 4000);
    out.detail = d;
  }
  return out;
}

/**
 * Telemetriyi yükler. Ağ yalnızca `url` (ya da ZIRTAN_TELEMETRY_URL) verildiğinde
 * kullanılır ve yalnızca GET'tir.
 *
 * @returns {Promise<{window: object, events: object[], invalid: {index:number, id?:string, errors:string[]}[], source: string}>}
 */
export async function loadTelemetry({ url = process.env.ZIRTAN_TELEMETRY_URL, fixture = FIXTURE_PATH, fetchImpl = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  let payload;
  let source;
  if (url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      payload = await res.json();
      source = `http:${url}`;
    } finally {
      clearTimeout(timer);
    }
  } else {
    payload = readJsonSafe(fixture);
    source = `fixture:${fixture}`;
    if (!payload) throw new Error(`Telemetri fixture bulunamadı: ${fixture}`);
  }
  return normalizeTelemetry(payload, source);
}

/** Ham yükü doğrular, temizler ve pencere bilgisiyle birlikte döner. */
export function normalizeTelemetry(payload, source = 'unknown') {
  const schema = loadSchema();
  const rawEvents = Array.isArray(payload) ? payload : (payload?.events ?? []);
  const window = (Array.isArray(payload) ? null : payload?.window) ?? {
    from: rawEvents[0]?.ts ?? new Date().toISOString(),
    to: rawEvents.at(-1)?.ts ?? new Date().toISOString(),
    totalSessions: Math.max(1, rawEvents.length),
  };
  const windowErrors = validateAgainst(schema.$defs.window, { ...window, source: undefined }, '$.window')
    .filter((e) => !e.includes('.source'));

  const events = [];
  const invalid = [];
  rawEvents.forEach((raw, index) => {
    const event = scrubEvent(raw);
    const { ok, errors } = validateEvent(event, schema);
    if (ok) events.push(event);
    else invalid.push({ index, id: raw?.id, errors });
  });
  return { window: { ...window, errors: windowErrors }, events, invalid, source };
}

/**
 * Aynı imzaya sahip olayları toplar. İmza = tür + en ayırt edici detay alanı.
 * Bulgu üretimi bu grupların üzerine kurulur.
 */
export function signatureOf(event) {
  const d = event.detail ?? {};
  switch (event.kind) {
    case 'crash':
    case 'error':
      return `${event.kind}:${firstFrame(d.stack) || d.message?.slice(0, 80) || 'bilinmeyen'}`;
    case 'slow_screen':
    case 'empty_screen':
      return `${event.kind}:${d.screen}`;
    case 'failed_request':
      return `${event.kind}:${d.method ?? 'GET'} ${d.endpoint}:${d.status}`;
    case 'flow_abandon':
      return `${event.kind}:${d.flow}/${d.step}`;
    case 'i18n_missing':
      return `${event.kind}:${d.key}@${d.locale}`;
    default:
      return `${event.kind}:${event.id}`;
  }
}

/** Yığın izinden uygulama koduna ait ilk kareyi (dosya:satır) çıkarır. */
export function firstFrame(stack) {
  if (typeof stack !== 'string') return null;
  for (const line of stack.split('\n')) {
    const m = line.match(/(src\/[\w./[\]()-]+\.(?:tsx?|jsx?)):(\d+)(?::(\d+))?/);
    if (m) return `${m[1]}:${m[2]}`;
  }
  return null;
}

/**
 * Olayları imzaya göre gruplar.
 * @returns {Array<{signature:string, kind:string, events:object[], count:number, sessions:number, routes:string[], platforms:string[], sample:object}>}
 */
export function groupBySignature(events) {
  const groups = new Map();
  for (const event of events) {
    const signature = signatureOf(event);
    let g = groups.get(signature);
    if (!g) {
      g = {
        signature,
        kind: event.kind,
        events: [],
        count: 0,
        sessions: 0,
        routes: new Set(),
        platforms: new Set(),
        sample: event,
      };
      groups.set(signature, g);
    }
    g.events.push(event);
    g.count += event.count ?? 1;
    g.sessions += event.sessions ?? (event.sessionHash ? 1 : 0);
    if (event.route) g.routes.add(event.route);
    if (event.detail?.screen) g.routes.add(event.detail.screen);
    g.platforms.add(event.platform);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, routes: [...g.routes], platforms: [...g.platforms] }))
    .sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature));
}

/** Etkilenen oturum oranı (0..1). */
export function affectedRatio(group, totalSessions) {
  if (!totalSessions) return 0;
  return clamp01((group.sessions || group.count) / totalSessions);
}
