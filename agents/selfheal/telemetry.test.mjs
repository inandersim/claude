/**
 * Telemetri sözleşmesi testleri: şema doğrulama, gizlilik temizliği, gruplama.
 * Çalıştır: node --test agents/selfheal/telemetry.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEvent, loadSchema, scrubEvent, scrubText, signatureOf, firstFrame,
  groupBySignature, normalizeTelemetry, loadTelemetry,
} from './lib/telemetry.mjs';

const gecerli = {
  id: 'olay-1',
  ts: '2026-09-05T10:00:00Z',
  kind: 'crash',
  app: { version: '1.0.0', channel: 'production' },
  platform: 'android',
  detail: { message: 'patladı' },
};

test('geçerli olay şemayı geçer', () => {
  const r = validateEvent(gecerli);
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('zorunlu alan eksikse reddedilir', () => {
  const { platform, ...eksik } = gecerli;
  const r = validateEvent(eksik);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('platform')));
});

test('enum dışı değer reddedilir', () => {
  const r = validateEvent({ ...gecerli, platform: 'symbian' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('symbian')));
});

test('şemada tanımsız alan reddedilir (sözleşme dışı veri sızmasın)', () => {
  const r = validateEvent({ ...gecerli, kullaniciEposta: 'a@b.com' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('tanımsız alan')));
});

test('tür başına detail şekli zorunludur', () => {
  const eksikDetail = validateEvent({ ...gecerli, kind: 'slow_screen', detail: { screen: '/x' } });
  assert.equal(eksikDetail.ok, false, 'slow_screen için ms zorunlu');
  const tam = validateEvent({ ...gecerli, kind: 'slow_screen', detail: { screen: '/x', ms: 900 } });
  assert.equal(tam.ok, true, tam.errors.join('; '));
});

test('detail hiç yoksa reddedilir', () => {
  const { detail, ...detailsiz } = gecerli;
  assert.equal(validateEvent(detailsiz).ok, false);
});

test('bozuk zaman damgası reddedilir', () => {
  assert.equal(validateEvent({ ...gecerli, ts: '05.09.2026' }).ok, false);
});

test('sessionHash biçimi zorlanır (16 haneli onaltılık)', () => {
  assert.equal(validateEvent({ ...gecerli, sessionHash: 'abc' }).ok, false);
  assert.equal(validateEvent({ ...gecerli, sessionHash: 'a1b2c3d4e5f60718' }).ok, true);
});

test('şema tüm olay türleri için detail tanımı içerir', () => {
  const schema = loadSchema();
  for (const kind of schema.properties.kind.enum) {
    assert.ok(schema.$defs[`detail_${kind}`], `${kind} için detail şeması eksik`);
  }
});

/* ---------------- gizlilik ---------------- */

test('scrubText kişisel veri benzeri dizileri maskeler', () => {
  const t = scrubText('kullanıcı ali@example.com telefon +90 555 123 4567 kimlik 123456789');
  assert.ok(!t.includes('ali@example.com'));
  assert.ok(!t.includes('555'));
  assert.ok(t.includes('[eposta]'));
});

test('scrubEvent rota ve uç noktadaki kimlikleri maskeler', () => {
  const e = scrubEvent({
    ...gecerli,
    route: '/(app)/stories/98421',
    detail: { message: 'x', endpoint: '/users/550e8400-e29b-41d4-a716-446655440000/posts?token=gizli' },
  });
  assert.equal(e.route, '/(app)/stories/[id]');
  assert.ok(!e.detail.endpoint.includes('token'), 'sorgu dizesi atılmalı');
  assert.ok(!e.detail.endpoint.includes('550e8400'));
});

test('scrubEvent özgün olayı değiştirmez', () => {
  const orijinal = { ...gecerli, route: '/(app)/stories/1' };
  scrubEvent(orijinal);
  assert.equal(orijinal.route, '/(app)/stories/1');
});

/* ---------------- gruplama ---------------- */

test('firstFrame yığın izinden uygulama karesini çıkarır', () => {
  const stack = 'TypeError\n    at node_modules/react/index.js:1:1\n    at f (src/features/a/b.ts:12:9)';
  assert.equal(firstFrame(stack), 'src/features/a/b.ts:12');
  assert.equal(firstFrame(undefined), null);
});

test('aynı imzalı olaylar tek grupta toplanır ve sayılar birikir', () => {
  const olaylar = [
    { ...gecerli, id: 'a', count: 10, sessions: 5, detail: { message: 'aynı hata' } },
    { ...gecerli, id: 'b', count: 3, sessions: 2, platform: 'ios', detail: { message: 'aynı hata' } },
    { ...gecerli, id: 'c', count: 1, sessions: 1, detail: { message: 'başka hata' } },
  ];
  const gruplar = groupBySignature(olaylar);
  assert.equal(gruplar.length, 2);
  assert.equal(gruplar[0].count, 13);
  assert.equal(gruplar[0].sessions, 7);
  assert.deepEqual(gruplar[0].platforms.sort(), ['android', 'ios']);
});

test('imza türe göre ayırt edici alanı kullanır', () => {
  assert.ok(signatureOf({ kind: 'i18n_missing', detail: { key: 'a.b', locale: 'de' } }).includes('a.b@de'));
  assert.ok(signatureOf({ kind: 'failed_request', detail: { endpoint: '/x', status: 500, method: 'POST' } }).includes('500'));
});

/* ---------------- yükleme ---------------- */

test('normalizeTelemetry geçersiz olayları ayırır, geçerlileri korur', () => {
  const { events, invalid } = normalizeTelemetry({
    window: { from: '2026-09-05T00:00:00Z', to: '2026-09-06T00:00:00Z', totalSessions: 100 },
    events: [gecerli, { ...gecerli, id: 'kotu', platform: 'symbian' }],
  });
  assert.equal(events.length, 1);
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0].id, 'kotu');
  assert.ok(invalid[0].errors.length > 0);
});

test('fixture verisi sözleşmeye uyar (bilerek konmuş tek bozuk olay dışında)', async () => {
  const { events, invalid, window } = await loadTelemetry();
  assert.ok(events.length > 10, 'fixture anlamlı sayıda olay içermeli');
  assert.equal(invalid.length, 1, 'fixture doğrulamayı göstermek için tek bozuk olay taşır');
  assert.ok(window.totalSessions > 0);
  assert.deepEqual(window.errors, [], 'pencere zarfı şemaya uymalı');
});

test('loadTelemetry ZIRTAN_TELEMETRY_URL verildiğinde yalnızca GET yapar', async () => {
  let gorulen = null;
  const sahteFetch = async (url, opts) => {
    gorulen = { url, opts };
    return {
      ok: true,
      json: async () => ({ window: { from: gecerli.ts, to: gecerli.ts, totalSessions: 10 }, events: [gecerli] }),
    };
  };
  const r = await loadTelemetry({ url: 'https://ornek.test/telemetri', fetchImpl: sahteFetch });
  assert.equal(gorulen.opts.method, 'GET');
  assert.equal(gorulen.opts.body, undefined, 'uzak sunucuya veri gönderilmemeli');
  assert.equal(r.events.length, 1);
  assert.ok(r.source.startsWith('http:'));
});
