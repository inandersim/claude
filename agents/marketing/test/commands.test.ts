import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dedupeIds, flagCompliance } from '../src/commands/generate.js';
import { fixWeek } from '../src/commands/plan.js';
import { REQUIRED_ENV, runPost } from '../src/commands/post.js';
import { parseMentions, renderReplies } from '../src/commands/reply.js';
import { postFileName, renderPost, renderWeekIndex } from '../src/render.js';
import type { PlanWeek, Post, PostsFile } from '../src/schemas.js';
import { addDays, nextMonday, packagePath, readJson, weekDir } from '../src/util/fs.js';

const file = readJson<PostsFile>(packagePath('content', 'example-posts.json'));

test('tarih yardımcıları', () => {
  assert.equal(addDays('2026-09-07', 6), '2026-09-13');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(nextMonday('2026-09-06'), '2026-09-07'); // Pazar → Pazartesi
  assert.equal(nextMonday('2026-09-07'), '2026-09-07'); // Pazartesi aynı gün
  assert.equal(nextMonday('2026-09-09'), '2026-09-14'); // Çarşamba → sonraki Pazartesi
  assert.equal(weekDir(3), 'week-03');
});

test('fixWeek: hafta başlangıcı ve aralık dışı tarihler düzeltilir', () => {
  const week: PlanWeek = {
    week: 2,
    startDate: '2000-01-01',
    theme: 't',
    goal: 'g',
    focusChannels: [],
    items: [
      {
        date: '2026-09-16',
        channel: 'vk',
        format: 'text',
        lang: 'ru',
        audience: 'ru-speakers',
        theme: 'x',
        objective: 'awareness',
        kpi: { metric: 'reach', target: 1 },
        notes: '',
      },
      {
        date: '2026-10-01',
        channel: 'vk',
        format: 'text',
        lang: 'ru',
        audience: 'ru-speakers',
        theme: 'y',
        objective: 'awareness',
        kpi: { metric: 'reach', target: 1 },
        notes: '',
      },
    ],
  };
  const fixed = fixWeek(week, '2026-09-07');
  assert.equal(fixed.startDate, '2026-09-14');
  assert.equal(fixed.items[0]?.date, '2026-09-16');
  assert.equal(fixed.items[1]?.date, '2026-09-14');
});

test('dedupeIds ve flagCompliance', () => {
  const p = file.posts[0] as Post;
  const out = dedupeIds([p, { ...p }, { ...p }]);
  assert.deepEqual(
    out.map((x) => x.id),
    [p.id, `${p.id}-2`, `${p.id}-3`],
  );
  const clean = flagCompliance(p);
  assert.equal(clean.notes, p.notes);
  const flagged = flagCompliance({ ...p, body: 'Zirve ile asla kaybolmazsın' });
  assert.ok(flagged.notes.startsWith('[marka-uyarı]'));
});

test('renderPost / renderWeekIndex / postFileName', () => {
  const p = file.posts[0] as Post;
  const md = renderPost(p);
  assert.ok(md.startsWith(`# ${p.title}`));
  assert.ok(md.includes('## Senaryo (sahne sahne)'));
  assert.ok(md.includes('| 1 | 1.5s |'));
  assert.ok(md.includes('## Yayın metni'));
  assert.equal(postFileName(p), '2026-09-08-instagram-ig-reel-kackar-gun1.md');
  const index = renderWeekIndex(file);
  assert.ok(index.includes('# Hafta 1'));
  for (const post of file.posts) assert.ok(index.includes(postFileName(post)));
});

test('parseMentions toleranslı; renderReplies yükseltmeyi işaretler', () => {
  const mentions = parseMentions(readJson(packagePath('content', 'example-mentions.json')));
  assert.equal(mentions.length, 6);
  assert.equal(mentions[2]?.kind, 'dm');
  assert.equal(mentions[3]?.lang, 'ru');
  const loose = parseMentions({
    mentions: [{ text: 'merhaba', channel: 'myspace', type: 'weird' }],
  });
  assert.equal(loose[0]?.id, 'm1');
  assert.equal(loose[0]?.channel, 'instagram');
  assert.equal(loose[0]?.kind, 'comment');
  assert.throws(() => parseMentions([{ id: 'x' }]), /text eksik/);
  const md = renderReplies(mentions, {
    replies: [
      {
        id: 'c4',
        language: 'tr',
        intent: 'safety',
        reply: 'Hemen 112’yi ara.',
        escalate: true,
        escalateReason: 'acil',
        followUp: 'insan kontrolü',
      },
    ],
  });
  assert.ok(md.includes('**YÜKSELT**'));
  assert.ok(md.includes('Takip işi: insan kontrolü'));
});

test('runPost dry-run: fetch çağrılmaz, marka ihlali atlanır, yer tutucu env', async () => {
  let fetchCalls = 0;
  const fetchImpl = (async () => {
    fetchCalls += 1;
    throw new Error('dry-run’da fetch çağrılmamalı');
  }) as unknown as typeof fetch;
  const lines: string[] = [];
  const results = await runPost({
    channel: 'telegram',
    file: packagePath('content', 'example-posts.json'),
    dryRun: true,
    ids: undefined,
    force: false,
    env: {},
    fetchImpl,
    log: (l) => lines.push(l),
  });
  assert.equal(fetchCalls, 0);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.ok, true);
  assert.ok(lines.some((l) => l.includes('TELEGRAM_BOT_TOKEN tanımsız')));
  assert.deepEqual(REQUIRED_ENV.telegram, ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHANNEL']);
  await assert.rejects(
    runPost({
      channel: 'tiktok',
      file: packagePath('content', 'example-posts.json'),
      dryRun: true,
      ids: undefined,
      force: false,
      env: {},
      fetchImpl,
      log: () => {},
    }),
    /elle yükle/,
  );
});
