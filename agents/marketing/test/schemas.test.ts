import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ANALYSIS_SCHEMA,
  PLAN_SCHEMA,
  POSTS_FILE_SCHEMA,
  REPLIES_SCHEMA,
  assertValid,
  validate,
  type Plan,
  type PostsFile,
} from '../src/schemas.js';
import { packagePath, readJson } from '../src/util/fs.js';

const examplePosts = (): PostsFile =>
  readJson<PostsFile>(packagePath('content', 'example-posts.json'));

test('example-posts.json şemaya uyar', () => {
  const errors = validate(POSTS_FILE_SCHEMA, examplePosts());
  assert.deepEqual(errors, []);
});

test('zorunlu alan, enum, desen ve fazla alan hataları yakalanır', () => {
  const file = examplePosts();
  const bad = structuredClone(file) as unknown as Record<string, unknown>;
  const posts = bad.posts as Record<string, unknown>[];
  const first = posts[0] as Record<string, unknown>;
  delete first.cta;
  first.channel = 'myspace';
  first.bestTime = '25:99';
  first.extra = 1;
  first.hashtags = ['nohash'];
  const errors = validate(POSTS_FILE_SCHEMA, bad);
  const messages = errors.map((e) => `${e.path} ${e.message}`);
  assert.ok(messages.some((m) => m.includes('$.posts[0].cta') && m.includes('zorunlu')));
  assert.ok(messages.some((m) => m.includes('$.posts[0].channel') && m.includes('enum')));
  assert.ok(messages.some((m) => m.includes('$.posts[0].bestTime') && m.includes('desen')));
  assert.ok(messages.some((m) => m.includes('$.posts[0].extra') && m.includes('tanımsız')));
  assert.ok(messages.some((m) => m.includes('$.posts[0].hashtags[0]')));
});

test('tür, sayı sınırı ve dizi uzunluğu denetlenir', () => {
  assert.equal(validate({ type: 'integer' }, 1.5).length, 1);
  assert.equal(validate({ type: 'integer' }, 2).length, 0);
  assert.equal(validate({ type: 'number', minimum: 0 }, -1).length, 1);
  assert.equal(
    validate({ type: 'array', maxItems: 1, items: { type: 'string' } }, ['a', 'b']).length,
    1,
  );
  assert.equal(validate({ type: 'array', items: { type: 'string' } }, ['a', 1]).length, 1);
  assert.equal(validate({ type: 'string', maxLength: 2 }, 'abc').length, 1);
});

test('plan şeması: geçerli ve geçersiz örnek', () => {
  const plan: Plan = {
    title: 'Test',
    startDate: '2026-09-07',
    weeks: [
      {
        week: 1,
        startDate: '2026-09-07',
        theme: 'Temel',
        goal: 'Profilleri kur',
        focusChannels: ['instagram'],
        items: [
          {
            date: '2026-09-08',
            channel: 'instagram',
            format: 'reel',
            lang: 'tr',
            audience: 'general',
            theme: 'Kaçkar 1. gün',
            objective: 'awareness',
            kpi: { metric: 'reach', target: 1500 },
            notes: '',
          },
        ],
      },
    ],
  };
  assert.deepEqual(validate(PLAN_SCHEMA, plan), []);
  assert.doesNotThrow(() => assertValid<Plan>(PLAN_SCHEMA, plan, 'plan'));
  const broken = { ...plan, weeks: [{ ...plan.weeks[0], items: [] }] };
  assert.throws(() => assertValid(PLAN_SCHEMA, broken, 'plan'), /en az 1 öğe/);
});

test('yanıt ve analiz şemaları kendi içinde tutarlı (required ⊆ properties)', () => {
  for (const schema of [REPLIES_SCHEMA, ANALYSIS_SCHEMA, PLAN_SCHEMA, POSTS_FILE_SCHEMA]) {
    const walk = (s: typeof schema, path: string): void => {
      if (s.properties) {
        for (const key of s.required ?? [])
          assert.ok(key in s.properties, `${path}.${key} required ama properties'te yok`);
        for (const [k, v] of Object.entries(s.properties)) walk(v, `${path}.${k}`);
      }
      if (s.items) walk(s.items, `${path}[]`);
    };
    walk(schema, '$');
  }
});
