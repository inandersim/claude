import assert from 'node:assert/strict';
import { test } from 'node:test';

import { boolFlag, listFlag, numberFlag, parseArgs } from './lib/args.mjs';
import { addDays, humanDate, isoDate, minutesOf, monthRanges, nextMonday, parseDate } from './lib/dates.mjs';
import { parseCsv, toCsv } from './lib/fsx.mjs';
import { charCount, hashtagSet, hash32, lines, mdTable, num, pct, pick, pickMany, slugify, truncate } from './lib/text.mjs';
import { BRAND, checkCompliance, CONTENT_LANGS, CTAS, feature, HASHTAGS, localTags, STORE_LOCALES, utmLink } from './lib/brand.mjs';

test('parseArgs: --k v, --k=v, bayrak ve --no-bayrak', () => {
  const { flags, positionals } = parseArgs(['publish', '--input', 'a.json', '--limit=5', '--live', '--no-json']);
  assert.equal(positionals[0], 'publish');
  assert.equal(flags.input, 'a.json');
  assert.equal(flags.limit, '5');
  assert.equal(flags.live, true);
  assert.equal(flags.json, false);
});

test('listFlag / numberFlag / boolFlag varsayılanları', () => {
  assert.deepEqual(listFlag('tr, en ,ru', ['x']), ['tr', 'en', 'ru']);
  assert.deepEqual(listFlag(undefined, ['tr']), ['tr']);
  assert.deepEqual(listFlag('all', ['a', 'b']), ['a', 'b']);
  assert.equal(numberFlag('7', 1), 7);
  assert.equal(numberFlag('sıfırdeğil', 3), 3);
  assert.equal(boolFlag(undefined, false), false);
  assert.equal(boolFlag('false'), false);
  assert.equal(boolFlag(true), true);
});

test('tarih yardımcıları UTC ve deterministik', () => {
  assert.equal(isoDate(nextMonday(new Date('2026-09-06T22:00:00Z'))), '2026-09-07');
  assert.equal(isoDate(nextMonday(new Date('2026-09-07T00:00:00Z'))), '2026-09-07');
  assert.equal(isoDate(addDays(parseDate('2026-10-05'), 7)), '2026-10-12');
  assert.equal(monthRanges([3, 4, 5, 9, 10]), 'Mart–Mayıs, Eylül–Ekim');
  assert.equal(monthRanges([10, 11, 3, 4], 'en'), 'March–April, October–November');
  assert.equal(humanDate('2026-10-05', 'ru'), '5 октября 2026 г.');
  assert.equal(minutesOf('09:30'), 570);
  assert.throws(() => parseDate('05.10.2026'), /YYYY-MM-DD/u);
});

test('metin: slug, kısaltma, deterministik seçim', () => {
  assert.equal(slugify('Kaçkar Dağları — Yukarı Kavron'), 'kackar-daglari-yukari-kavron');
  assert.equal(truncate('bir iki üç dört', 9), 'bir iki…');
  assert.equal(pick('a', ['x', 'y', 'z']), pick('a', ['x', 'y', 'z']));
  assert.deepEqual(pickMany('seed', [1, 2, 3, 4, 5], 3), pickMany('seed', [1, 2, 3, 4, 5], 3));
  assert.equal(new Set(pickMany('seed', [1, 2, 3, 4, 5], 4)).size, 4);
  assert.notEqual(hash32('a'), hash32('b'));
});

test('metin: hashtag seti tekilleştirir ve sınırlar', () => {
  assert.deepEqual(hashtagSet(['#kamp', 'kamp', '#KAMP', 'doğa'], 5), ['#kamp', '#doğa']);
  assert.equal(hashtagSet(['#a', '#b', '#c'], 2).length, 2);
});

test('metin: sayı ve yüzde biçimi (negatif dâhil)', () => {
  assert.equal(num(12345), '12.345');
  assert.equal(pct(0.0345), '%3,5');
  assert.equal(pct(-0.334), '-%33,4');
  assert.equal(pct(0.5, 'en'), '50.0%');
  assert.equal(charCount('şğü'), 3);
});

test('lines: boş satır korunur, üçlü boşluk teke iner', () => {
  assert.equal(lines('a', '', '', '', 'b'), 'a\n\nb');
  assert.equal(lines('a', null, undefined, 'b'), 'a\nb');
  assert.match(mdTable(['x'], [['y']]), /\| x \|\n\| --- \|\n\| y \|/u);
});

test('CSV: tırnak ve gömülü ayraç', () => {
  const csv = toCsv(['a', 'b'], [['1', 'iki, üç'], ['2', 'dört "beş"']]);
  const rows = parseCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].b, 'iki, üç');
  assert.equal(rows[1].b, 'dört "beş"');
});

test('marka: UTM şeması docs/GROWTH.md ile aynı', () => {
  const url = new URL(utmLink({ source: 'instagram', campaign: 'launch', content: 'ig-01', path: 'rehber/likya-yolu' }));
  assert.equal(url.origin + url.pathname, 'https://zirtan.app/rehber/likya-yolu');
  assert.equal(url.searchParams.get('utm_source'), 'instagram');
  assert.equal(url.searchParams.get('utm_medium'), 'organic');
  assert.equal(url.searchParams.get('utm_campaign'), 'launch');
  assert.equal(url.searchParams.get('utm_content'), 'ig-01');
});

test('marka: yasak ifadeler dört dilde yakalanır', () => {
  assert.equal(checkCompliance('Zirtan ile asla kaybolmazsın').length, 1);
  assert.equal(checkCompliance('you will never get lost').length, 1);
  assert.equal(checkCompliance('гарантия спасения включена').length, 1);
  assert.equal(checkCompliance('Rettung garantiert!').length, 1);
  assert.equal(checkCompliance('Rotanı planla, tehlike haritasına bak.').length, 0);
});

test('marka: dil kümeleri ve özellik sözlüğü tam', () => {
  assert.deepEqual(CONTENT_LANGS, ['tr', 'en', 'de', 'ru']);
  assert.equal(STORE_LOCALES.length, 23);
  assert.equal(new Set(STORE_LOCALES).size, 23);
  for (const lang of CONTENT_LANGS) {
    assert.ok(CTAS[lang].length >= 3, `${lang} CTA havuzu`);
    assert.ok(HASHTAGS[lang].core.includes('#zirtanapp'));
    assert.ok(feature('zmatch', lang).length > 10);
  }
  assert.ok(localTags('NP', 'en').some((t) => t.includes('nepal')));
  assert.ok(localTags('XX', 'tr').length > 0, 'bilinmeyen ülke genel havuza düşer');
  assert.equal(BRAND.name, 'Zirtan');
});

test('marka: CTA metinleri yasak ifade içermez', () => {
  for (const lang of CONTENT_LANGS) {
    for (const cta of CTAS[lang]) assert.equal(checkCompliance(cta).length, 0, `${lang}: ${cta}`);
  }
});
