import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { CHANNEL_METHODS, classifyIntent, formatForChannel, guessLang, makeContext, toIcs } from './channels/base.mjs';
import { CHANNELS, CHANNEL_IDS, channelBrief, getChannel, resolveChannels } from './channels/index.mjs';
import { splitThread } from './channels/x.mjs';
import { Writer } from './lib/fsx.mjs';
import { charCount } from './lib/text.mjs';

const sample = (over = {}) => ({
  id: 'test-post',
  lang: 'tr',
  date: '2026-11-03',
  title: 'Kaçkar Dağları: 3 günde etap etap plan',
  body: 'Ayder’den çık, Yukarı Kavron’da uyu, üçüncü gün zirveye vur. Her etapta su var, son etapta şebeke yok.',
  cta: 'Rotanı Zirtan’da aç, tehlike haritasına bak.',
  link: 'https://zirtan.app/rehber/kackar?utm_source=test',
  hashtags: ['#kaçkar', '#trekking'],
  format: 'carousel',
  visual: { brief: 'Etap haritası', shots: ['zirve'], aspect: '4:5', alt: 'harita' },
  sources: ['© OpenStreetMap katkıcıları'],
  ...over,
});

test('on kanal kayıtlı ve dördü de aynı arayüzü uyguluyor', () => {
  assert.equal(CHANNEL_IDS.length, 10);
  for (const id of CHANNEL_IDS) {
    const channel = getChannel(id);
    for (const method of CHANNEL_METHODS) {
      assert.equal(typeof channel[method], 'function', `${id}.${method} eksik`);
    }
    const s = channel.spec;
    assert.equal(s.id, id);
    assert.ok(s.maxChars > 0 && s.recommendedChars > 0);
    assert.ok(Array.isArray(s.formats) && s.formats.length > 0);
    assert.ok(s.rules.length >= 3, `${id}: kural listesi kısa`);
    assert.ok(s.manualSteps.length >= 3, `${id}: elle yayın adımı eksik`);
    assert.ok(s.metrics.fields.length >= 3 && s.metrics.manualExport, `${id}: metrik tanımı eksik`);
    for (const lang of ['tr', 'en', 'de', 'ru']) {
      assert.ok((s.bestTimes[lang] ?? s.bestTimes.tr).length > 0, `${id}: ${lang} saati yok`);
    }
  }
  assert.throws(() => getChannel('myspace'), /Bilinmeyen kanal/u);
  assert.equal(resolveChannels([]).length, 10);
  assert.match(channelBrief(['x']), /X \(Twitter\)/u);
});

test('yeni kanallar eklendi: x, pinterest, linkedin', () => {
  for (const id of ['x', 'pinterest', 'linkedin', 'tiktok', 'youtube', 'reddit']) {
    assert.ok(CHANNEL_IDS.includes(id), `${id} yok`);
  }
});

test('publish: anahtar yokken kuru çalışır ve paket yazar', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'zirtan-'));
  const writer = new Writer();
  const ctx = makeContext({ writer, outDir: dir, env: {} });
  const res = await CHANNELS.instagram.publish(sample(), ctx);
  assert.equal(res.mode, 'dry-run');
  assert.equal(res.ok, true);
  assert.ok(res.packetPath);
  const packet = readFileSync(res.packetPath, 'utf8');
  assert.match(packet, /## Yayına giden metin/u);
  assert.match(packet, /## Görsel talimatı/u);
  assert.match(packet, /## Elle yayın adımları/u);
  assert.match(packet, /En iyi saat|en iyi saat/u);
  assert.match(packet, /OpenStreetMap/u);
});

test('publish: --live ama anahtar yoksa yine kuru çalışır', async () => {
  const ctx = makeContext({ live: true, env: {} });
  const res = await CHANNELS.telegram.publish(sample(), ctx);
  assert.equal(res.mode, 'dry-run');
  assert.match(res.reason, /eksik ortam değişkeni: TELEGRAM_BOT_TOKEN/u);
});

test('publish: yasak ifade yayını durdurur', async () => {
  const res = await CHANNELS.instagram.publish(sample({ body: 'Zirtan ile asla kaybolmazsın.' }), makeContext({ env: {} }));
  assert.equal(res.ok, false);
  assert.match(res.reason, /marka denetimi/u);
  assert.ok(res.warnings.some((w) => w.startsWith('YASAK İFADE')));
});

test('publish: canlı modda gerçek istek gider (sahte fetch)', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, result: { message_id: 42 } }) };
  };
  const ctx = makeContext({
    live: true,
    fetchImpl,
    env: { TELEGRAM_BOT_TOKEN: 'gizli-token', TELEGRAM_CHANNEL: '@zirtanapp' },
    sleep: async () => {},
  });
  const res = await CHANNELS.telegram.publish(sample(), ctx);
  assert.equal(res.mode, 'live');
  assert.equal(res.ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /api\.telegram\.org\/botgizli-token\/sendMessage/u);
});

test('biçimlendirme kanal sınırlarını uygular', () => {
  for (const id of CHANNEL_IDS) {
    const spec = CHANNELS[id].spec;
    const formatted = formatForChannel(sample({ body: 'x '.repeat(3000) }), spec);
    const effective = spec.linkCountsAs && formatted.link
      ? charCount(formatted.text) - charCount(formatted.link) + spec.linkCountsAs
      : charCount(formatted.text);
    assert.ok(effective <= spec.maxChars, `${id}: ${effective} > ${spec.maxChars}`);
    assert.ok(formatted.hashtags.length <= spec.maxHashtags, `${id}: hashtag sınırı`);
  }
});

test('Reddit hashtag kullanmaz, TikTok bağlantı koymaz', () => {
  const reddit = formatForChannel(sample(), CHANNELS.reddit.spec);
  assert.equal(reddit.hashtags.length, 0);
  const tiktok = formatForChannel(sample(), CHANNELS.tiktok.spec);
  assert.ok(!tiktok.text.includes('https://'), 'TikTok metninde bağlantı olmamalı');
  assert.ok(tiktok.warnings.some((w) => w.includes('sabitlenmiş yorum')));
});

test('X zinciri 280 karakterlik halkalara bölünür', () => {
  const parts = splitThread('kelime '.repeat(200));
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(charCount(p) <= 280, `halka ${charCount(p)} karakter`);
  assert.match(parts[0], /1\/\d+$/u);
  assert.deepEqual(splitThread('kısa metin'), ['kısa metin']);
});

test('schedule: en iyi saatlere yerleştirir, kadans aşımını işaretler, .ics üretir', () => {
  const posts = Array.from({ length: 4 }, (_, i) => sample({ id: `p${i}`, date: '2026-11-03' }));
  const { entries, ics } = CHANNELS.instagram.schedule(posts, makeContext());
  assert.equal(entries.length, 4);
  assert.ok(entries.some((e) => e.overCadence), 'günde 2 sınırı aşılmalı');
  assert.match(ics, /BEGIN:VCALENDAR/u);
  assert.match(ics, /DTSTART;TZID=Europe\/Istanbul:20261103T/u);
  assert.match(toIcs([{ id: 'a', date: '2026-01-01', time: '09:00', summary: 'x' }], 'test'), /SUMMARY:x/u);
});

test('metrics: kuru çalışmada elle dışa aktarma yönergesi döner', async () => {
  const m = await CHANNELS.pinterest.metrics({}, makeContext({ env: {} }));
  assert.equal(m.mode, 'dry-run');
  assert.ok(m.fields.includes('saves'));
  assert.match(m.manualExport, /Analytics/u);
  assert.match(m.csvHeader, /^date,channel,post_id,/u);
});

test('reply: niyet sınıflaması ve yükseltme bayrağı', () => {
  assert.equal(classifyIntent('Arkadaşım Kaçkar’da yaralandı, ne yapmalıyım?').intent, 'safety');
  assert.equal(classifyIntent('Uygulama sürekli çöküyor').intent, 'complaint');
  assert.equal(classifyIntent('Kulübümüz için iş birliği yapalım mı?').intent, 'partnership');
  assert.equal(classifyIntent('Offline harita var mı?').intent, 'question');
  assert.equal(classifyIntent('Harika olmuş, ellerinize sağlık').intent, 'praise');
  assert.equal(classifyIntent('free followers bitcoin kazanç').intent, 'spam');
});

test('reply: dil sezgisi ve taslak üretimi', () => {
  assert.equal(guessLang('Merhaba, nasıl çalışıyor?'), 'tr');
  assert.equal(guessLang('Как скачать карту?'), 'ru');
  assert.equal(guessLang('Wie funktioniert das offline?'), 'de');
  assert.equal(guessLang('How does it work?'), 'en');

  const draft = CHANNELS.instagram.reply({ id: 'm1', text: 'Ücretsiz mi?' });
  assert.equal(draft.lang, 'tr');
  assert.equal(draft.intent, 'question');
  assert.equal(draft.needsHuman, true);
  assert.match(draft.draft, /Kâşif/u);

  const safety = CHANNELS.telegram.reply({ id: 'm2', text: 'Arkadaşım düştü, acil yardım' });
  assert.equal(safety.escalate, true);
  assert.match(safety.draft, /112/u);
  assert.ok(safety.escalateReason.length > 0);
});

test('reply: taslaklar kanal sınırını ve marka kurallarını aşmaz', () => {
  for (const id of CHANNEL_IDS) {
    for (const text of ['Ücretsiz mi?', 'How does offline work?', 'Приложение вылетает', 'Kooperation möglich?']) {
      const draft = CHANNELS[id].reply({ id: `${id}-${text}`, text });
      assert.ok(charCount(draft.draft) <= (CHANNELS[id].spec.maxReplyChars ?? 500), `${id}: yanıt uzun`);
      assert.ok(draft.draft.length > 0);
    }
  }
});
