import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ABUSE_RULES, CODE_ALPHABET, codeSpace, readK, REWARDS, SHARE_COPY, SHARE_MOMENTS, simulate } from './referral.mjs';
import { checkCompliance, CONTENT_LANGS } from './lib/brand.mjs';

test('kod uzayı okunur alfabeyle hesaplanır', () => {
  assert.ok(!CODE_ALPHABET.includes('O'));
  assert.ok(!CODE_ALPHABET.includes('0'));
  assert.ok(!CODE_ALPHABET.includes('I'));
  assert.ok(!CODE_ALPHABET.includes('1'));
  const s = codeSpace(6, 1_000_000);
  assert.equal(s.space, CODE_ALPHABET.length ** 6);
  assert.ok(s.retryRate > 0 && s.retryRate < 0.01, `retry oranı ${s.retryRate}`);
  assert.ok(codeSpace(8, 1_000_000).retryRate < s.retryRate, 'uzun kod daha az yeniden üretim ister');
});

test('K faktörü formülü ve simülasyon tutarlı', () => {
  const sim = simulate({ users: 1000, inviteRate: 0.3, invitesPerInviter: 3, acceptRate: 0.35, qualifyRate: 0.6, weeklyOrganic: 250, weeks: 12, churn: 0.08 });
  assert.ok(Math.abs(sim.k - 0.3 * 3 * 0.35 * 0.6) < 1e-9);
  assert.equal(sim.rows.length, 12);
  assert.ok(sim.rows[11].cumulative > sim.rows[0].cumulative, 'kümülatif artmalı');
  for (const r of sim.rows) {
    assert.ok(r.qualified <= r.accepted && r.accepted <= r.invitesSent, 'huni daralmalı');
    assert.equal(r.newUsers, r.qualified + r.organic);
    assert.ok(r.referralShare >= 0 && r.referralShare <= 1);
  }
});

test('daha iyi parametreler daha yüksek K verir', () => {
  const low = simulate({ inviteRate: 0.1, acceptRate: 0.2 });
  const high = simulate({ inviteRate: 0.5, acceptRate: 0.5 });
  assert.ok(high.k > low.k);
  assert.ok(high.rows[11].cumulative > low.rows[11].cumulative);
});

test('K okuması eşikleri ayırır', () => {
  assert.match(readK(0.1), /zayıf/u);
  assert.match(readK(0.3), /destekleyici/u);
  assert.match(readK(0.5), /hedefte/u);
  assert.match(readK(1.2), /kendi kendine/u);
});

test('ödül tablosu gerçek kullanım şartına bağlı', () => {
  assert.ok(REWARDS.length >= 5);
  const qualifying = REWARDS.find((r) => /ilk maceraya|nitelikli/u.test(r.trigger));
  assert.ok(qualifying, 'nitelik şartı olan ödül yok');
  assert.ok(REWARDS.every((r) => r.note.length > 10));
  assert.ok(ABUSE_RULES.length >= 5);
  assert.ok(ABUSE_RULES.some((r) => /cihaz/u.test(r)));
  assert.ok(ABUSE_RULES.some((r) => /IP/u.test(r)));
});

test('paylaşım metinleri dört dilde ve değişkenli', () => {
  for (const lang of CONTENT_LANGS) {
    const copy = SHARE_COPY[lang];
    assert.ok(copy, `${lang} yok`);
    assert.ok(copy.sheet.includes('{code}'), `${lang}: kod değişkeni`);
    assert.ok(copy.card.includes('{code}') && copy.card.includes('{name}'));
    assert.ok(copy.milestone.includes('{count}') && copy.milestone.includes('{left}'));
    for (const text of Object.values(copy)) assert.deepEqual(checkCompliance(text), [], `${lang}: ${text}`);
  }
});

test('paylaşım anları ürün yüzeyine bağlı', () => {
  assert.ok(SHARE_MOMENTS.length >= 5);
  for (const m of SHARE_MOMENTS) {
    assert.ok(m.surface.length > 8, `${m.moment}: yüzey tanımı eksik`);
    assert.ok(m.why.length > 10);
  }
});
