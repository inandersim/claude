import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ARCHETYPES, ARCHETYPE_IDS, getArchetype } from './content/archetypes.mjs';
import { buildItem, generateContent, itemMarkdown, LENGTH_BY_CHANNEL, repurposeChain, toPost } from './content/engine.mjs';
import { attribution, FIRST_AID_BY_GROUP, localizeRisks, localizeRules, looksTurkish, rockType } from './content/lexicon.mjs';
import { counts, destinationsInMonth, loadData, riskySpeciesInMonth, speciesByDanger, unescoSites } from './content/sources.mjs';
import { CHANNELS, CHANNEL_IDS } from './channels/index.mjs';
import { checkCompliance, CONTENT_LANGS } from './lib/brand.mjs';
import { charCount } from './lib/text.mjs';

test('veri anlık görüntüsü dolu', () => {
  const c = counts();
  assert.ok(c.destinations >= 15, 'destinasyon');
  assert.ok(c.species >= 30, 'tür');
  assert.ok(c.heritage >= 25, 'tarihi alan');
  assert.ok(c.routes >= 20 && c.crags >= 8 && c.places >= 50 && c.clubs >= 10);
  assert.ok(loadData().meta.sources.length > 0, 'kaynak listesi');
});

test('veri sorguları süzer', () => {
  assert.ok(destinationsInMonth(10).length > 0);
  assert.ok(destinationsInMonth(10).every((d) => d.bestMonths.includes(10)));
  assert.ok(speciesByDanger('deadly').every((s) => s.danger === 'deadly'));
  assert.ok(riskySpeciesInMonth(7).length > 0);
  assert.ok(unescoSites().every((h) => h.isUnesco));
});

test('11 arketip dört dilde içerik üretir', () => {
  assert.ok(ARCHETYPE_IDS.length >= 11);
  for (const archetype of ARCHETYPES) {
    const subjects = archetype.subjects();
    assert.ok(subjects.length > 0, `${archetype.id}: konu yok`);
    for (const lang of CONTENT_LANGS) {
      const item = buildItem(archetype, subjects[0], lang);
      assert.ok(item.title.length > 10, `${archetype.id}/${lang}: başlık`);
      assert.ok(item.body.short.length > 20, `${archetype.id}/${lang}: kısa gövde`);
      assert.ok(item.body.medium.length > item.body.short.length * 0.9);
      assert.ok(item.body.long.length >= item.body.medium.length);
      assert.ok(item.hashtags.length >= 3, `${archetype.id}/${lang}: hashtag`);
      assert.ok(item.visual.brief.length > 30, `${archetype.id}/${lang}: görsel brief`);
      assert.ok(item.visual.alt.length > 5, `${archetype.id}/${lang}: alt metin`);
      assert.ok(item.sources.length > 0, `${archetype.id}/${lang}: kaynak yok`);
      assert.ok(item.link.includes('utm_source='), 'UTM bağlantısı');
      assert.equal(item.lang, lang);
    }
  }
  assert.throws(() => getArchetype('yok'), /Bilinmeyen arketip/u);
});

test('Türkçe dışı içerikte Türkçe cümle sızıntısı yok', () => {
  const leaks = [];
  for (const archetype of ARCHETYPES) {
    for (const subject of archetype.subjects()) {
      for (const lang of ['en', 'de', 'ru']) {
        const raw = archetype.build(subject, lang);
        const ignore = [raw.subject.name, subject.university, subject.name, subject.locationName, subject.region].filter(Boolean);
        for (const f of ['hook', 'short', 'medium', 'long']) {
          if (looksTurkish(raw[f], ignore)) leaks.push(`${archetype.id}/${lang}/${f}`);
        }
      }
    }
  }
  assert.deepEqual(leaks, [], `sızıntı: ${leaks.slice(0, 5).join(', ')}`);
});

test('güvenlik arketipleri yasal not taşır, hiçbiri yasak ifade içermez', () => {
  const items = generateContent({ perArchetype: 2 });
  assert.ok(items.length > 40);
  for (const item of items) {
    assert.deepEqual(checkCompliance(`${item.title}\n${item.body.long}`), [], `${item.id}: yasak ifade`);
    if (item.archetype === 'first-10-minutes' || item.archetype === 'hazard-brief') {
      assert.equal(item.safety, true);
      assert.ok(item.safetyNote.length > 20, `${item.id}: yasal not yok`);
    }
  }
});

test('ilk yardım sözlüğü tüm tür grupları için üç dilde tam', () => {
  const groups = [...new Set(loadData().species.map((s) => s.group))];
  for (const g of groups) {
    const aid = FIRST_AID_BY_GROUP[g];
    assert.ok(aid, `${g} için ilk yardım metni yok`);
    for (const lang of ['en', 'de', 'ru']) {
      assert.ok(aid[lang].do.length >= 3, `${g}/${lang}: yap listesi`);
      assert.ok(aid[lang].dont.length >= 3, `${g}/${lang}: yapma listesi`);
    }
  }
});

test('sözlük: risk ve kural eşlemesi çeviri yerine yerel cümle üretir', () => {
  const { lines: risks, unmapped } = localizeRisks(['Akut dağ hastalığı (AMS)', 'Lukla uçuş iptalleri', 'Kasım sonrası buzlu patika'], 'en');
  assert.equal(risks.length, 3);
  assert.equal(unmapped.length, 0);
  assert.ok(risks.every((r) => !looksTurkish(r)));
  const rules = localizeRules(['Drone uçuşu yasaktır', 'Sütunlara dokunmak yasaktır'], 'de');
  assert.equal(rules.lines.length, 2);
  assert.deepEqual(localizeRisks(['Akut dağ hastalığı'], 'tr').lines, ['Akut dağ hastalığı']);
  assert.equal(rockType('Kireçtaşı', 'ru'), 'известняк');
  assert.match(attribution('en'), /OpenStreetMap contributors/u);
});

test('eşleşmeyen Türkçe veri atlanır ve QA notu düşer', () => {
  const { unmapped } = localizeRules(['Yamaç Evler ayrı biletlidir'], 'en');
  assert.equal(unmapped.length, 1);
  const archetype = getArchetype('heritage-detour');
  const subject = archetype.subjects().find((h) => (h.rules ?? []).some((r) => /biletli/u.test(r)));
  if (subject) {
    const item = buildItem(archetype, subject, 'en');
    assert.ok(item.qa.some((q) => q.includes('çevrilmemiş')), 'QA notu bekleniyor');
  }
});

test('toPost: kanal başına doğru uzunluk ve biçim seçer', () => {
  const [item] = generateContent({ langs: ['tr'], archetypes: ['itinerary'], perArchetype: 1 });
  for (const id of CHANNEL_IDS) {
    const post = toPost(item, id);
    const spec = CHANNELS[id].spec;
    assert.equal(post.channel, id);
    assert.ok(spec.formats.includes(post.format), `${id}: biçim uyumsuz`);
    assert.equal(post.body, item.body[LENGTH_BY_CHANNEL[id]]);
    assert.ok(post.link.includes(`utm_source=${id}`));
    assert.ok(post.bestTime.match(/^\d{2}:\d{2}$/u));
  }
});

test('kanal biçimlendiricisi üretilen içeriği sınırlar içinde tutar', async () => {
  const items = generateContent({ langs: ['tr', 'ru'], perArchetype: 1 });
  for (const item of items.slice(0, 12)) {
    for (const id of ['x', 'tiktok', 'instagram', 'telegram']) {
      const res = await CHANNELS[id].publish(toPost(item, id), { env: {}, live: false, log: () => {}, writer: null, outDir: null, fetchImpl: fetch, now: new Date(), sleep: async () => {} });
      assert.equal(res.ok, true, `${id}/${item.id}: ${res.reason}`);
      const spec = CHANNELS[id].spec;
      // X'te bağlantı t.co ile 23 karakter sayılır; etkin uzunluk buna göre ölçülür.
      const link = res.text.match(/https:\/\/\S+/u)?.[0] ?? '';
      const effective = spec.linkCountsAs && link ? charCount(res.text) - charCount(link) + spec.linkCountsAs : charCount(res.text);
      assert.ok(effective <= spec.maxChars + 1, `${id}/${item.id}: ${effective} > ${spec.maxChars}`);
    }
  }
});

test('yeniden kullanım zinciri sekiz kanal önerir', () => {
  const chain = repurposeChain({ archetype: 'first-10-minutes' });
  assert.equal(chain.length, 8);
  assert.ok(chain.every((c) => CHANNEL_IDS.includes(c.channel)));
  assert.equal(chain[0].channel, 'tiktok');
  assert.ok(repurposeChain({ archetype: 'itinerary' })[0].channel === 'instagram');
});

test('içerik Markdown çıktısı tüm bölümleri taşır', () => {
  const [item] = generateContent({ langs: ['de'], archetypes: ['crag-guide'], perArchetype: 1 });
  const md = itemMarkdown(item);
  for (const heading of ['## Kanca', '## Kısa', '## Orta', '## Uzun', '## CTA', '## Hashtag', '## Görsel', '## Yeniden kullanım zinciri', '## Kaynak ve lisans']) {
    assert.ok(md.includes(heading), `${heading} eksik`);
  }
});
