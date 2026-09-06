import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { announcement, hackerNews, launchEmail, pressRelease, productHunt, REDDIT_TARGETS, runLaunch, storeNotes } from './launch.mjs';
import { CHANNEL_IDS } from './channels/index.mjs';
import { checkCompliance, CONTENT_LANGS, NOT_YET } from './lib/brand.mjs';
import { Writer } from './lib/fsx.mjs';

test('duyuru metni dört dilde ve üç uzunlukta', () => {
  for (const lang of CONTENT_LANGS) {
    const a = announcement(lang, '2026-11-03');
    assert.ok(a.title.length > 5, `${lang} başlık`);
    assert.ok(a.tiny.length <= 110, `${lang} tiny uzun`);
    assert.ok(a.short.length > a.tiny.length, `${lang} short`);
    assert.ok(a.medium.length > a.short.length, `${lang} medium`);
    assert.ok(a.cta.length > 10, `${lang} cta`);
    assert.deepEqual(checkCompliance(`${a.title} ${a.medium} ${a.cta}`), [], `${lang}: yasak ifade`);
  }
  assert.match(announcement('tr', '2026-11-03').medium, /3 Kasım 2026/u);
});

test('kuru çalışma tüm kanallar için paket ve belge üretir', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'zirtan-launch-'));
  const writer = new Writer();
  const { results } = await runLaunch({ date: '2026-11-03', writer, out: dir, langs: ['tr', 'en'] });
  assert.ok(results.length >= CHANNEL_IDS.length, 'her kanal için gönderi');
  assert.ok(results.every((r) => r.mode === 'dry-run'));
  assert.ok(results.every((r) => r.ok), 'marka denetimi');
  const files = writer.written.map((w) => w.path);
  for (const name of ['product-hunt.md', 'hacker-news.md', 'reddit-plan.md', 'press-release-tr.md', 'press-release-en.md', 'email-tr.md', 'email-en.md', 'store-release-notes.md', 'timeline.md', 'checklist.md', 'README.md']) {
    assert.ok(files.some((f) => f.endsWith(name)), `${name} yazılmadı`);
  }
  for (const id of CHANNEL_IDS) {
    assert.ok(files.some((f) => f.includes(`/packets/${id}/`)), `${id} paketi yok`);
  }
  const packet = readFileSync(files.find((f) => f.includes('/packets/instagram/')), 'utf8');
  assert.match(packet, /Elle yayın adımları/u);
});

test('Product Hunt metni kurallara uygun', () => {
  const md = productHunt('2026-11-03');
  assert.match(md, /Tagline \(60 karakter\)/u);
  assert.match(md, /maker story/u);
  assert.ok(!/upvote|oy verin/iu.test(md.replace(/Oy isteme.*/gu, '')), 'oy isteme çağrısı olmamalı');
  assert.match(md, /Oy isteme/u);
  assert.deepEqual(checkCompliance(md), []);
});

test('Show HN başlığı ve metni teknik, iddiasız', () => {
  const md = hackerNews();
  const title = md.match(/Show HN: [^\n]+/u)[0];
  assert.ok(title.length <= 80, `başlık ${title.length} karakter`);
  assert.match(md, /PMTiles/u);
  assert.match(md, /NOT implemented/u);
  assert.deepEqual(checkCompliance(md), []);
});

test('Reddit planı subreddit kurallarını ayırır', () => {
  const subs = REDDIT_TARGETS.map((r) => r.sub).join(' ');
  assert.match(subs, /r\/SideProject/u);
  assert.match(subs, /r\/hiking/u);
  const hiking = REDDIT_TARGETS.find((r) => r.sub.includes('r/hiking'));
  assert.match(hiking.rule, /yasak|%10/u);
  assert.match(hiking.angle, /Trip report/u);
});

test('basın bülteni gerçekleri ve sınırları koruyor', () => {
  for (const lang of ['tr', 'en']) {
    const md = pressRelease(lang, '2026-11-03');
    assert.deepEqual(checkCompliance(md), [], `${lang}: yasak ifade`);
    assert.match(md, /23 dil|23 languages/u);
    assert.ok(NOT_YET.some((n) => md.includes(n.split(' ')[0])), `${lang}: "henüz yok" listesi`);
    assert.ok(!/milyon|million users/iu.test(md), 'kullanıcı sayısı iddiası olmamalı');
  }
});

test('e-posta ve mağaza notu hazır', () => {
  for (const lang of ['tr', 'en']) {
    const md = launchEmail(lang, '2026-11-03');
    assert.match(md, /utm_source=email/u);
    assert.match(md, /Konu:|Subject:/u);
    assert.deepEqual(checkCompliance(md), []);
  }
  const store = storeNotes();
  assert.match(store, /What’s New/u);
  assert.match(store, /500 karakter/u);
  assert.deepEqual(checkCompliance(store), []);
});
