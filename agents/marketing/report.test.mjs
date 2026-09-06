import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { aggregate, breakdown, DEFAULT_TARGETS, groupByWeek, normalizeRows, recommend } from './report.mjs';
import { parseCsv } from './lib/fsx.mjs';

const rows = normalizeRows(parseCsv(readFileSync(new URL('./content/example-growth.csv', import.meta.url), 'utf8')));

test('örnek CSV okunur ve normalleşir', () => {
  assert.ok(rows.length >= 20);
  for (const r of rows) {
    assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/u);
    assert.ok(r.channel.length >= 1); // "x" tek harfli kanal kimliğidir
    assert.ok(r.reach >= 0 && r.installs >= 0);
  }
});

test('sütun adı eş anlamlıları tanınır', () => {
  const [row] = normalizeRows([
    { tarih: '2026-11-09', kanal: 'instagram', 'erişim': '1.000', 'tıklama': '25', kurulum: '4', aktivasyon: '2' },
  ]);
  assert.equal(row.date, '2026-11-09');
  assert.equal(row.channel, 'instagram');
  assert.equal(row.clicks, 25);
  assert.equal(row.installs, 4);
  assert.equal(row.activations, 2);
});

test('toplamlar ve oranlar doğru hesaplanır', () => {
  const a = aggregate([
    { reach: 1000, impressions: 1500, engagements: 50, clicks: 30, installs: 6, signups: 4, activations: 2, followers: 10, invitesSent: 10, invitesQualified: 3 },
    { reach: 1000, impressions: 1500, engagements: 30, clicks: 10, installs: 4, signups: 2, activations: 1, followers: 5, invitesSent: 0, invitesQualified: 0 },
  ]);
  assert.equal(a.reach, 2000);
  assert.equal(a.posts, 2);
  assert.equal(a.engagementRate, 0.04);
  assert.equal(a.ctr, 0.02);
  assert.equal(a.installPerClick, 0.25);
  assert.equal(a.signupRate, 0.6);
  assert.equal(a.activationRate, 0.5);
  assert.equal(a.kFactor, 0.3);
  const empty = aggregate([]);
  assert.equal(empty.engagementRate, 0);
  assert.equal(empty.kFactor, 0);
});

test('kırılım erişime göre sıralar', () => {
  const byChannel = breakdown(rows, 'channel');
  assert.ok(byChannel.length >= 8);
  for (let i = 1; i < byChannel.length; i += 1) assert.ok(byChannel[i - 1].reach >= byChannel[i].reach);
  assert.ok(breakdown(rows, 'format').length >= 4);
});

test('haftalara Pazartesi başlangıcıyla bölünür', () => {
  const weeks = groupByWeek(rows);
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].start, '2026-11-09');
  assert.equal(weeks[1].start, '2026-11-16');
  assert.ok(weeks[0].rows.length > 0);
});

test('hedefin altındaki metrik öneri üretir', () => {
  const weak = aggregate([{ reach: 1000, engagements: 5, clicks: 5, installs: 0, signups: 0, activations: 0, invitesSent: 0, invitesQualified: 0 }]);
  const recs = recommend(weak, null, [], [], DEFAULT_TARGETS);
  const areas = recs.map((r) => r.area);
  assert.ok(areas.includes('içerik'), 'düşük etkileşim önerisi');
  assert.ok(areas.includes('CTA'), 'düşük tıklama önerisi');
  assert.ok(recs.every((r) => ['high', 'medium', 'low'].includes(r.priority)));
  assert.ok(recs.every((r) => r.action.length > 20 && r.why.length > 10));
  assert.equal(recs[0].priority, 'high', 'yüksek öncelik başta');
});

test('hedeflerin üstünde ise öneri listesi sakin kalır', () => {
  const strong = aggregate([{ reach: 1000, engagements: 200, clicks: 100, installs: 40, signups: 30, activations: 20, invitesSent: 50, invitesQualified: 20 }]);
  const recs = recommend(strong, null, [], [], DEFAULT_TARGETS);
  assert.equal(recs.length, 1);
  assert.match(recs[0].action, /Hedeflerin üstündesin/u);
});

test('kanal kuralları: kes ve iki katına çıkar', () => {
  const now = aggregate([{ reach: 1000, engagements: 200, clicks: 100, installs: 40, signups: 30, activations: 20, invitesSent: 50, invitesQualified: 20 }]);
  const byChannel = [
    { name: 'x', posts: 3, reach: 500, engagementRate: 0.01, ctr: 0.01, installs: 1, followers: 1 },
    { name: 'telegram', posts: 3, reach: 800, engagementRate: 0.09, ctr: 0.05, installs: 20, followers: 30 },
  ];
  const recs = recommend(now, null, byChannel, [{ name: 'reel', reach: 900 }, { name: 'thread', reach: 100 }], DEFAULT_TARGETS);
  assert.ok(recs.some((r) => r.area === 'kanal:x' && /yarıya indir|değiştir/u.test(r.action)));
  assert.ok(recs.some((r) => r.area === 'kanal:telegram' && /iki katına/u.test(r.action)));
  assert.ok(recs.some((r) => r.area === 'biçim'));
});

test('erişim düşüşü ve yükselişi ayrı öneri verir', () => {
  const previous = aggregate([{ reach: 10_000, engagements: 500, clicks: 200, installs: 40, signups: 30, activations: 15 }]);
  const dropped = aggregate([{ reach: 5000, engagements: 250, clicks: 100, installs: 20, signups: 15, activations: 8 }]);
  const recs = recommend(dropped, previous, [], [], DEFAULT_TARGETS);
  assert.ok(recs.some((r) => r.area === 'hacim' && /düşüşü/u.test(r.action) === false ? r.why.includes('göre') : true));
  assert.ok(recs.some((r) => r.area === 'hacim'));
});
