import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { loadItems, main } from './dispatch.mjs';
import { generateContent } from './content/engine.mjs';

function withOutDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'zirtan-dispatch-'));
  const previous = process.env.ZIRTAN_OUT_DIR;
  process.env.ZIRTAN_OUT_DIR = dir;
  return Promise.resolve(fn(dir)).finally(() => {
    if (previous === undefined) delete process.env.ZIRTAN_OUT_DIR;
    else process.env.ZIRTAN_OUT_DIR = previous;
  });
}

test('loadItems: içerik dosyası, dizi ve takvim biçimlerini tanır', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zirtan-input-'));
  const items = generateContent({ langs: ['tr'], archetypes: ['route-card'], perArchetype: 2 });
  const file = join(dir, 'content.json');
  writeFileSync(file, JSON.stringify({ items }), 'utf8');
  assert.equal(loadItems(file).length, items.length);

  const arrayFile = join(dir, 'array.json');
  writeFileSync(arrayFile, JSON.stringify(items), 'utf8');
  assert.equal(loadItems(arrayFile).length, items.length);

  const calendarFile = join(dir, 'calendar.json');
  writeFileSync(
    calendarFile,
    JSON.stringify({ weeks: [{ slots: [{ contentId: 'c1', channel: 'telegram', lang: 'tr', date: '2026-11-03', time: '08:00', format: 'text', title: 'Kart' }] }] }),
    'utf8',
  );
  const [slot] = loadItems(calendarFile);
  assert.equal(slot.channel, 'telegram');
  assert.equal(slot.bestTime, '08:00');
  assert.equal(slot.fromCalendar, true);
  assert.equal(slot.body, '', 'takvim slotu gövde taşımaz');

  assert.ok(loadItems('', { limit: 3 }).length > 0, 'girdi yoksa içerik üretir');
  assert.throws(() => loadItems(join(dir, 'yok.json')), /bulunamadı/u);
});

test('publish komutu kanal paketlerini yazar (kuru çalışma)', async () => {
  await withOutDir(async (dir) => {
    const code = await main(['publish', '--channels', 'x,telegram', '--limit', '2', '--langs', 'tr']);
    assert.equal(code, 0);
    const packets = join(dir, 'packets');
    assert.ok(existsSync(join(packets, 'x')));
    assert.ok(existsSync(join(packets, 'telegram')));
    assert.ok(existsSync(join(packets, 'publish-log.json')));
    const log = JSON.parse(readFileSync(join(packets, 'publish-log.json'), 'utf8'));
    assert.equal(log.live, false);
    assert.ok(log.results.every((r) => r.mode === 'dry-run'));
    const readme = readFileSync(join(packets, 'README.md'), 'utf8');
    assert.match(readme, /Yayın paketleri/u);
    const files = readdirSync(join(packets, 'x'));
    assert.ok(files.length > 0);
    assert.match(readFileSync(join(packets, 'x', files[0]), 'utf8'), /En iyi saat|en iyi saat/u);
  });
});

test('publish takvim slotlarını gövdesiz yayınlamaz', async () => {
  await withOutDir(async (dir) => {
    const input = join(dir, 'calendar.json');
    writeFileSync(
      input,
      JSON.stringify({ weeks: [{ slots: [{ contentId: 'c1', channel: 'telegram', lang: 'tr', date: '2026-11-03', time: '08:00', format: 'text', title: 'Kart' }] }] }),
      'utf8',
    );
    assert.equal(await main(['publish', '--input', input, '--channels', 'telegram']), 0);
    const log = JSON.parse(readFileSync(join(dir, 'packets', 'publish-log.json'), 'utf8'));
    assert.equal(log.results.length, 0, 'gövdesiz slot yayınlanmamalı');
  });
});

test('schedule komutu .ics ve slot listesi üretir', async () => {
  await withOutDir(async (dir) => {
    const code = await main(['schedule', '--channels', 'instagram', '--limit', '4']);
    assert.equal(code, 0);
    assert.ok(existsSync(join(dir, 'packets', 'instagram', 'schedule.ics')));
    const entries = JSON.parse(readFileSync(join(dir, 'packets', 'schedule.json'), 'utf8'));
    assert.ok(entries.length >= 1);
    assert.ok(entries.every((e) => e.channel === 'instagram'));
  });
});

test('metrics komutu elle toplama yönergesi üretir', async () => {
  await withOutDir(async (dir) => {
    const code = await main(['metrics']);
    assert.equal(code, 0);
    const guide = readFileSync(join(dir, 'metrics', 'nasil-toplanir.md'), 'utf8');
    assert.match(guide, /Birleşik CSV başlığı/u);
    const metrics = JSON.parse(readFileSync(join(dir, 'metrics', 'metrics.json'), 'utf8'));
    assert.equal(metrics.length, 10);
    assert.ok(metrics.every((m) => m.mode === 'dry-run'));
  });
});

test('reply komutu yanıt taslakları ve yükseltme işaretler', async () => {
  await withOutDir(async (dir) => {
    const input = join(dir, 'mentions.json');
    writeFileSync(
      input,
      JSON.stringify([
        { id: 'm1', channel: 'instagram', author: 'a', text: 'Uygulama ücretsiz mi?' },
        { id: 'm2', channel: 'telegram', author: 'b', text: 'Arkadaşım yaralandı, ne yapmalıyım?' },
      ]),
      'utf8',
    );
    const code = await main(['reply', '--input', input]);
    assert.equal(code, 0);
    const drafts = JSON.parse(readFileSync(join(dir, 'replies', 'replies.json'), 'utf8'));
    assert.equal(drafts.length, 2);
    assert.equal(drafts[1].escalate, true);
    assert.match(readFileSync(join(dir, 'replies', 'replies.md'), 'utf8'), /YÜKSELT/u);
  });
});

test('channels komutu kanal kurallarını yazdırır, bilinmeyen komut hata verir', async () => {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    assert.equal(await main(['channels', '--channels', 'pinterest']), 0);
    assert.equal(await main(['yokkomut']), 1);
  } finally {
    console.log = original;
  }
  assert.match(logs.join('\n'), /Pinterest/u);
});
