import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDescription, buildListing, COMPETITORS, LIMITS, OPPORTUNITY_KEYWORDS } from './aso.mjs';
import { STORE_COPY } from './content/store-copy.mjs';
import { BRAND, checkCompliance, LOCALE_META, STORE_LOCALES } from './lib/brand.mjs';
import { charCount } from './lib/text.mjs';

test('23 dilin tamamı için mağaza metni var', () => {
  assert.equal(STORE_LOCALES.length, 23);
  for (const locale of STORE_LOCALES) {
    assert.ok(STORE_COPY[locale], `${locale}: metin yok`);
    assert.ok(LOCALE_META[locale], `${locale}: yerel bilgi yok`);
  }
});

test('tüm diller mağaza karakter sınırlarını geçmiyor', () => {
  const problems = [];
  for (const locale of STORE_LOCALES) {
    const l = buildListing(locale);
    if (l.warnings.length > 0) problems.push(`${locale}: ${l.warnings.join(', ')}`);
  }
  assert.deepEqual(problems, [], problems.join(' | '));
});

test('alan uzunlukları tek tek doğrulanır', () => {
  for (const locale of STORE_LOCALES) {
    const c = STORE_COPY[locale];
    assert.ok(charCount(c.title) <= LIMITS.title, `${locale} title`);
    assert.ok(charCount(c.subtitle) <= LIMITS.subtitle, `${locale} subtitle`);
    assert.ok(charCount(c.short) <= LIMITS.short, `${locale} short`);
    assert.ok(charCount(c.keywords) <= LIMITS.keywords, `${locale} keywords`);
    assert.ok(charCount(c.promo) <= LIMITS.promo, `${locale} promo`);
    assert.equal(c.screens.length, 6, `${locale} ekran sayısı`);
    for (const s of c.screens) assert.ok(charCount(s) <= LIMITS.screen, `${locale} ekran metni: ${s}`);
    assert.ok(c.features.length >= 6, `${locale} özellik sayısı`);
    assert.ok(charCount(buildDescription(c)) <= LIMITS.description, `${locale} açıklama`);
  }
});

test('marka adı çevrilmez ve anahtar kelime alanı boşluk yakmaz', () => {
  for (const locale of STORE_LOCALES) {
    const c = STORE_COPY[locale];
    assert.ok(c.title.includes(BRAND.name), `${locale}: başlıkta Zirtan yok`);
    assert.ok(!c.keywords.includes(', '), `${locale}: anahtar kelimede virgülden sonra boşluk var`);
    assert.ok(c.keywords.split(',').length >= 8, `${locale}: anahtar kelime sayısı az`);
  }
});

test('mağaza metinleri yasak ifade içermez', () => {
  for (const locale of STORE_LOCALES) {
    const listing = buildListing(locale);
    const all = [listing.ios.title, listing.ios.subtitle, listing.ios.promo, listing.ios.description, listing.play.shortDescription].join('\n');
    assert.deepEqual(checkCompliance(all), [], `${locale}: yasak ifade`);
  }
});

test('güvenlik uyarısı her dilde açıklamada geçiyor', () => {
  for (const locale of STORE_LOCALES) {
    const c = STORE_COPY[locale];
    assert.ok(c.safety.length > 40, `${locale}: güvenlik notu kısa`);
    assert.ok(buildDescription(c).includes(c.safety), `${locale}: güvenlik notu açıklamada yok`);
  }
});

test('listeleme paketi iOS ve Play alanlarını ayırır', () => {
  const l = buildListing('de');
  assert.equal(l.ios.locale, 'de-DE');
  assert.equal(l.play.locale, 'de-DE');
  assert.equal(l.tier, 1);
  assert.ok(l.play.shortDescription.length > 20);
  assert.ok(l.ios.description.includes(BRAND.site));
  assert.throws(() => buildListing('xx'), /Mağaza metni yok/u);
});

test('rakip analizi beş uygulamayı ve fırsat kelimelerini kapsar', () => {
  const names = COMPETITORS.map((c) => c.name);
  for (const n of ['AllTrails', 'Komoot', 'Wikiloc', 'Gaia GPS', 'iOverlander']) assert.ok(names.includes(n), `${n} eksik`);
  for (const c of COMPETITORS) {
    assert.ok(c.strongKeywords.length >= 4);
    assert.ok(c.gap.length > 15 && c.weakness.length > 20);
  }
  const markets = new Set(OPPORTUNITY_KEYWORDS.map((k) => k.market));
  for (const m of ['TR', 'EN', 'DE', 'RU', 'NE']) assert.ok(markets.has(m), `${m} pazarı için fırsat kelimesi yok`);
});
