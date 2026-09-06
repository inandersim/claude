import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compose, dedupeHashtags, truncate } from '../src/channels/format.js';
import {
  CHANNELS,
  channelBrief,
  formatPost,
  getChannel,
  parseChannelList,
} from '../src/channels/index.js';
import { CHANNEL_IDS, type Post, type PostsFile } from '../src/schemas.js';
import { packagePath, readJson } from '../src/util/fs.js';

const posts = readJson<PostsFile>(packagePath('content', 'example-posts.json')).posts;
const ig = posts.find((p) => p.channel === 'instagram') as Post;

function withChannel(post: Post, channel: Post['channel'], patch: Partial<Post> = {}): Post {
  return { ...post, channel, ...patch };
}

test('her kanal için spec ve format var', () => {
  for (const id of CHANNEL_IDS) {
    const ch = CHANNELS[id];
    assert.equal(ch.spec.id, id);
    assert.ok(ch.spec.formats.length > 0);
    assert.ok(ch.spec.bestTimes.tr.length > 0);
    const out = ch.format(withChannel(ig, id));
    assert.ok(out.text.length > 0);
  }
  assert.deepEqual(CHANNEL_IDS.filter((id) => CHANNELS[id].publisher).sort(), [
    'facebook',
    'instagram',
    'telegram',
    'vk',
  ]);
});

test('instagram: hashtag sınırı, bio bağlantı notu, ilk satır uyarısı', () => {
  const many = Array.from({ length: 20 }, (_, i) => `#tag${i}`);
  const out = formatPost(withChannel(ig, 'instagram', { hashtags: many }));
  assert.equal(out.hashtags.length, 12);
  assert.ok(out.text.includes('Bağlantı bio’da.'));
  assert.ok(!out.text.includes('https://'));
  assert.ok(out.warnings.some((w) => w.includes('bio')));
  const longHook = formatPost(withChannel(ig, 'instagram', { body: 'x'.repeat(200) }));
  assert.ok(longHook.warnings.some((w) => w.includes('ilk satır')));
});

test('reddit: hashtag yok, bağlantı metinde, başlıkta CTA uyarısı', () => {
  const out = formatPost(withChannel(ig, 'reddit', { title: 'Zirtan indir!' }));
  assert.equal(out.hashtags.length, 0);
  assert.ok(!out.text.includes('#'));
  assert.ok(out.text.includes('https://zirtan.app'));
  assert.ok(out.warnings.some((w) => w.includes('ban riski')));
});

test('telegram: uzun açıklama uyarısı; vk: Rusça önerisi', () => {
  const tg = formatPost(
    withChannel(ig, 'telegram', {
      body: 'a'.repeat(1100),
      media: [{ type: 'image', url: 'https://x/y.jpg', path: '', alt: '' }],
    }),
  );
  assert.ok(tg.warnings.some((w) => w.includes('1024')));
  const vk = formatPost(withChannel(ig, 'vk'));
  assert.ok(vk.warnings.some((w) => w.includes('Rusça')));
  const vkRu = formatPost(withChannel(ig, 'vk', { lang: 'ru' }));
  assert.ok(!vkRu.warnings.some((w) => w.includes('Rusça')));
});

test('compose: platform sınırı aşılınca gövde kısaltılır, CTA ve hashtag korunur', () => {
  const spec = { ...CHANNELS.tiktok.spec, maxChars: 300, recommendedChars: 100 };
  const out = compose({ ...ig, body: 'kelime '.repeat(100), hashtags: ['#a', '#b'] }, spec);
  assert.ok(out.text.length <= 300, `uzunluk ${out.text.length}`);
  assert.ok(out.text.includes('#a #b'));
  assert.ok(out.text.includes(ig.cta));
  assert.ok(out.warnings.some((w) => w.includes('kısaltıldı')));
});

test('yardımcılar: dedupeHashtags, truncate', () => {
  assert.deepEqual(dedupeHashtags(['#Zirtan', 'zirtan', '#doğa', '  ', '#doğa '], 10), [
    '#Zirtan',
    '#doğa',
  ]);
  assert.deepEqual(dedupeHashtags(['#a', '#b', '#c'], 2), ['#a', '#b']);
  assert.equal(truncate('kısa', 10), 'kısa');
  const t = truncate('bu çok uzun bir cümle ve kesilmeli', 20);
  assert.ok(t.length <= 20 && t.endsWith('…'));
});

test('kanal listesi ayrıştırma ve brief', () => {
  assert.deepEqual(parseChannelList('instagram, VK'), ['instagram', 'vk']);
  assert.deepEqual(parseChannelList(undefined), [...CHANNEL_IDS]);
  assert.throws(() => parseChannelList('myspace'), /Bilinmeyen kanal/);
  assert.equal(getChannel('telegram').spec.label.startsWith('Telegram'), true);
  const brief = channelBrief(['instagram', 'reddit'], 'en');
  assert.ok(brief.includes('## Instagram (instagram)'));
  assert.ok(brief.includes('## Reddit (reddit)'));
  assert.ok(!brief.includes('## VK'));
});
