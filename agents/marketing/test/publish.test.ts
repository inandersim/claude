import assert from 'node:assert/strict';
import { test } from 'node:test';

import { channel as facebook } from '../src/channels/facebook.js';
import { channel as instagram } from '../src/channels/instagram.js';
import { channel as telegram } from '../src/channels/telegram.js';
import type { PublishContext } from '../src/channels/types.js';
import { redact } from '../src/channels/types.js';
import { channel as vk } from '../src/channels/vk.js';
import type { Post, PostsFile } from '../src/schemas.js';
import { packagePath, readJson } from '../src/util/fs.js';

const posts = readJson<PostsFile>(packagePath('content', 'example-posts.json')).posts;
const byChannel = (id: Post['channel']): Post => posts.find((p) => p.channel === id) as Post;

interface Recorded {
  url: string;
  method: string;
  fields: Record<string, string>;
}

/** Sahte fetch: çağrıları kaydeder, sıradaki yanıtı döner. */
function mockFetch(responses: unknown[]): { fetchImpl: typeof fetch; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const fields: Record<string, string> = {};
    const body = init?.body;
    if (body instanceof URLSearchParams) for (const [k, v] of body) fields[k] = v;
    else if (body instanceof FormData)
      for (const [k, v] of body) fields[k] = typeof v === 'string' ? v : `file:${v.name}`;
    else if (typeof body === 'string')
      Object.assign(fields, JSON.parse(body) as Record<string, string>);
    calls.push({ url, method: init?.method ?? 'GET', fields });
    const next = responses.shift() ?? {};
    return new Response(JSON.stringify(next), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function ctx(env: Record<string, string>, fetchImpl: typeof fetch, dryRun = false): PublishContext {
  return { env, fetchImpl, dryRun, log: () => {} };
}

const META_ENV = { META_ACCESS_TOKEN: 'tok-secret', IG_USER_ID: '1789', FB_PAGE_ID: '42' };

test('instagram görsel: media → media_publish, token form alanında', async () => {
  const post: Post = {
    ...byChannel('instagram'),
    format: 'single_image',
    media: [{ type: 'image', url: 'https://cdn/x.jpg', path: '', alt: '' }],
  };
  const { fetchImpl, calls } = mockFetch([{ id: 'c1' }, { id: 'p1' }]);
  const result = await instagram.publisher!.publish(
    post,
    instagram.format(post),
    ctx(META_ENV, fetchImpl),
  );
  assert.equal(result.ok, true, result.error ?? '');
  assert.deepEqual(result.remoteIds, ['p1']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, 'https://graph.facebook.com/v21.0/1789/media');
  assert.equal(calls[0]?.fields.image_url, 'https://cdn/x.jpg');
  assert.equal(calls[0]?.fields.access_token, 'tok-secret');
  assert.ok(calls[0]?.fields.caption?.includes('#zirveapp'));
  assert.equal(calls[1]?.url, 'https://graph.facebook.com/v21.0/1789/media_publish');
  assert.equal(calls[1]?.fields.creation_id, 'c1');
});

test('instagram karusel: çocuk konteynerler + CAROUSEL + publish', async () => {
  const post: Post = {
    ...byChannel('instagram'),
    format: 'carousel',
    media: [
      { type: 'image', url: 'https://cdn/1.jpg', path: '', alt: '' },
      { type: 'image', url: 'https://cdn/2.jpg', path: '', alt: '' },
    ],
  };
  const { fetchImpl, calls } = mockFetch([{ id: 'a' }, { id: 'b' }, { id: 'car' }, { id: 'pub' }]);
  const result = await instagram.publisher!.publish(
    post,
    instagram.format(post),
    ctx(META_ENV, fetchImpl),
  );
  assert.equal(result.ok, true, result.error ?? '');
  assert.equal(calls.length, 4);
  assert.equal(calls[0]?.fields.is_carousel_item, 'true');
  assert.equal(calls[2]?.fields.media_type, 'CAROUSEL');
  assert.equal(calls[2]?.fields.children, 'a,b');
  assert.equal(calls[3]?.fields.creation_id, 'car');
});

test('instagram: dry-run hiç istek atmaz; medya URL yoksa hata', async () => {
  const post = byChannel('instagram');
  const { fetchImpl, calls } = mockFetch([]);
  const dry = await instagram.publisher!.publish(
    post,
    instagram.format(post),
    ctx(META_ENV, fetchImpl, true),
  );
  assert.equal(dry.ok, true);
  assert.equal(calls.length, 0);
  assert.ok(dry.requests.length >= 2);
  const noUrl = { ...post, media: [{ type: 'image' as const, url: '', path: 'x.jpg', alt: '' }] };
  const res = await instagram.publisher!.publish(
    noUrl,
    instagram.format(noUrl),
    ctx(META_ENV, fetchImpl),
  );
  assert.equal(res.ok, false);
  assert.match(res.error ?? '', /URL/);
  const noEnv = await instagram.publisher!.publish(
    post,
    instagram.format(post),
    ctx({}, fetchImpl),
  );
  assert.match(noEnv.error ?? '', /META_ACCESS_TOKEN/);
});

test('facebook: fotoğraf → /photos (url); metin → /feed (link)', async () => {
  const photo = byChannel('facebook');
  const { fetchImpl, calls } = mockFetch([{ id: 'ph', post_id: '42_1' }, { id: '42_2' }]);
  const r1 = await facebook.publisher!.publish(
    photo,
    facebook.format(photo),
    ctx(META_ENV, fetchImpl),
  );
  assert.equal(r1.ok, true, r1.error ?? '');
  assert.deepEqual(r1.remoteIds, ['42_1']);
  assert.equal(calls[0]?.url, 'https://graph.facebook.com/v21.0/42/photos');
  assert.equal(calls[0]?.fields.url, 'https://cdn.example.com/zirve/likya-1.jpg');
  assert.ok(calls[0]?.fields.message?.includes('https://zirve.app/r/likya'));

  const text = { ...photo, media: [] };
  const r2 = await facebook.publisher!.publish(
    text,
    facebook.format(text),
    ctx(META_ENV, fetchImpl),
  );
  assert.equal(r2.ok, true);
  assert.equal(calls[1]?.url, 'https://graph.facebook.com/v21.0/42/feed');
  assert.ok(calls[1]?.fields.link?.startsWith('https://zirve.app/r/likya'));
});

test('vk: getWallUploadServer → upload → saveWallPhoto → wall.post; hata nesnesi yakalanır', async () => {
  const post: Post = {
    ...byChannel('vk'),
    media: [{ type: 'image', url: 'https://cdn/likya.jpg', path: '', alt: '' }],
  };
  const env = { VK_ACCESS_TOKEN: 'vk-secret', VK_GROUP_ID: '123' };
  const calls: Recorded[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const fields: Record<string, string> = {};
    if (init?.body instanceof URLSearchParams) for (const [k, v] of init.body) fields[k] = v;
    if (init?.body instanceof FormData)
      for (const [k, v] of init.body) fields[k] = typeof v === 'string' ? v : `file:${v.name}`;
    calls.push({ url, method: init?.method ?? 'GET', fields });
    if (url.includes('cdn/likya.jpg')) return new Response(new Blob(['img']), { status: 200 });
    if (url.includes('getWallUploadServer'))
      return Response.json({ response: { upload_url: 'https://upload.vk/u' } });
    if (url === 'https://upload.vk/u') return Response.json({ server: 7, photo: '[]', hash: 'h' });
    if (url.includes('saveWallPhoto'))
      return Response.json({ response: [{ owner_id: -123, id: 555 }] });
    if (url.includes('wall.post')) return Response.json({ response: { post_id: 9 } });
    return Response.json({});
  }) as typeof fetch;
  const result = await vk.publisher!.publish(post, vk.format(post), ctx(env, fetchImpl));
  assert.equal(result.ok, true, result.error ?? '');
  assert.deepEqual(result.remoteIds, ['wall-123_9']);
  const urls = calls.map((c) => c.url);
  assert.ok(urls[0]?.includes('photos.getWallUploadServer'));
  assert.ok(urls.includes('https://upload.vk/u'));
  const upload = calls.find((c) => c.url === 'https://upload.vk/u');
  assert.equal(upload?.fields.photo, 'file:likya.jpg');
  const wall = calls.find((c) => c.url.includes('wall.post'));
  assert.equal(wall?.fields.owner_id, '-123');
  assert.equal(wall?.fields.from_group, '1');
  assert.equal(wall?.fields.attachments, 'photo-123_555');
  assert.equal(wall?.fields.v, '5.199');
  assert.equal(wall?.fields.access_token, 'vk-secret');

  const failing = mockFetch([{ error: { error_code: 5, error_msg: 'User authorization failed' } }]);
  const text = { ...post, media: [] };
  const bad = await vk.publisher!.publish(text, vk.format(text), ctx(env, failing.fetchImpl));
  assert.equal(bad.ok, false);
  assert.match(bad.error ?? '', /hata 5/);
});

test('telegram: metin → sendMessage JSON; fotoğraf → sendPhoto; uzun açıklama iki mesaj', async () => {
  const env = { TELEGRAM_BOT_TOKEN: '111:AAA', TELEGRAM_CHANNEL: '@zirveapp' };
  const text = byChannel('telegram');
  const { fetchImpl, calls } = mockFetch([{ ok: true, result: { message_id: 5 } }]);
  const r1 = await telegram.publisher!.publish(text, telegram.format(text), ctx(env, fetchImpl));
  assert.equal(r1.ok, true, r1.error ?? '');
  assert.equal(calls[0]?.url, 'https://api.telegram.org/bot111:AAA/sendMessage');
  assert.equal(calls[0]?.fields.chat_id, '@zirveapp');
  assert.ok(calls[0]?.fields.text?.includes('#aladağlar'));

  const photo: Post = {
    ...text,
    media: [{ type: 'image', url: 'https://cdn/a.jpg', path: '', alt: '' }],
  };
  const m2 = mockFetch([{ ok: true, result: { message_id: 6 } }]);
  await telegram.publisher!.publish(photo, telegram.format(photo), ctx(env, m2.fetchImpl));
  assert.equal(m2.calls.length, 1);
  assert.ok(m2.calls[0]?.url.endsWith('/sendPhoto'));
  assert.equal(m2.calls[0]?.fields.photo, 'https://cdn/a.jpg');
  assert.ok(m2.calls[0]?.fields.caption);

  const long: Post = { ...photo, body: 'uzun '.repeat(300) };
  const m3 = mockFetch([
    { ok: true, result: { message_id: 7 } },
    { ok: true, result: { message_id: 8 } },
  ]);
  const r3 = await telegram.publisher!.publish(long, telegram.format(long), ctx(env, m3.fetchImpl));
  assert.equal(r3.ok, true);
  assert.equal(m3.calls.length, 2);
  assert.equal(m3.calls[0]?.fields.caption, undefined);
  assert.ok(m3.calls[1]?.url.endsWith('/sendMessage'));

  const err = mockFetch([{ ok: false, description: 'Bad Request: chat not found' }]);
  const r4 = await telegram.publisher!.publish(
    text,
    telegram.format(text),
    ctx(env, err.fetchImpl),
  );
  assert.equal(r4.ok, false);
  assert.match(r4.error ?? '', /chat not found/);
});

test('redact token maskeler', () => {
  assert.equal(redact('https://x/?access_token=abcdef123456'), 'https://x/?access_token=abcd…');
  assert.equal(
    redact('https://api.telegram.org/bot111:AAAbbb/sendMessage'),
    'https://api.telegram.org/bot111:…/sendMessage',
  );
});
