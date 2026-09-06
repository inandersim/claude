import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isoWeek, normalizeRows, summarize, summaryToMarkdown } from '../src/metrics.js';
import { parseCsv, toNumber } from '../src/util/csv.js';
import { packagePath, readText } from '../src/util/fs.js';

test('parseCsv: tırnak, noktalı virgül, CRLF', () => {
  const rows = parseCsv('a;b;c\r\n1;"x;y";"he said ""hi"""\r\n2;;3\r\n');
  assert.deepEqual(rows, [
    { a: '1', b: 'x;y', c: 'he said "hi"' },
    { a: '2', b: '', c: '3' },
  ]);
  assert.deepEqual(parseCsv(''), []);
});

test('toNumber: yerel biçimler', () => {
  assert.equal(toNumber('1.234'), 1234);
  assert.equal(toNumber('1,234'), 1234);
  assert.equal(toNumber('12,5'), 12.5);
  assert.equal(toNumber('3.5%'), 3.5);
  assert.equal(toNumber(''), 0);
  assert.equal(toNumber('abc'), 0);
});

test('örnek insights.csv özetlenir', () => {
  const rows = normalizeRows(parseCsv(readText(packagePath('content', 'example-insights.csv'))));
  assert.equal(rows.length, 8);
  const s = summarize(rows);
  assert.equal(s.period.from, '2026-09-08');
  assert.equal(s.period.to, '2026-09-14');
  assert.equal(s.period.days, 7);
  assert.equal(s.total.reach, 10850);
  assert.equal(s.byChannel[0]?.key, 'tiktok');
  assert.equal(s.byChannel.find((c) => c.key === 'instagram')?.posts, 3);
  // reddit gönderisi erişim < 100 → sıralamaya girmez
  assert.ok(!s.topPosts.some((p) => p.channel === 'reddit'));
  assert.equal(s.topPosts[0]?.postId, 'ig-carousel-5-hata');
  const md = summaryToMarkdown(s);
  assert.ok(md.includes('| tiktok |'));
  assert.ok(md.includes('En iyi gönderiler'));
});

test('isoWeek', () => {
  assert.equal(isoWeek('2026-09-07'), '2026-W37');
  assert.equal(isoWeek('2026-01-01'), '2026-W01');
  assert.equal(isoWeek(''), 'unknown');
});
