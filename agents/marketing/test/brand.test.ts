import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AUDIENCES,
  HASHTAGS,
  PRODUCT_FACTS,
  brandBrief,
  checkBrandCompliance,
} from '../src/brand.js';

test('yasak ifadeler üç dilde yakalanır', () => {
  assert.equal(checkBrandCompliance('Zirtan ile asla kaybolmazsın!').length, 1);
  assert.equal(checkBrandCompliance('With Zirtan you never get lost.').length, 1);
  assert.equal(checkBrandCompliance('С Zirtan ты никогда не потеряешься').length, 1);
  assert.equal(checkBrandCompliance('SOS düğmesi kurtarma garantisi verir').length, 1);
  assert.ok(checkBrandCompliance('AllTrails çöp, Zirtan indir')[0]?.reason.includes('karalama'));
});

test('temiz metin geçer', () => {
  const issues = checkBrandCompliance(
    'Topluluk tehlike haritasına bak, canlı konumu bir arkadaşınla paylaş. Acil durumda 112.',
  );
  assert.deepEqual(issues, []);
});

test('marka özeti deterministik ve ürün gerçeklerini içerir', () => {
  const a = brandBrief();
  const b = brandBrief();
  assert.equal(a, b);
  for (const fact of PRODUCT_FACTS) assert.ok(a.includes(fact));
  for (const audience of AUDIENCES) assert.ok(a.includes(audience.label));
  assert.ok(a.includes('Yasak ifadeler'));
});

test('hashtag setleri # ile başlar ve boşluk içermez', () => {
  for (const lang of ['tr', 'en', 'ru'] as const) {
    const set = HASHTAGS[lang];
    for (const tag of [...set.core, ...set.niche, ...set.local]) assert.match(tag, /^#\S+$/u);
  }
});
