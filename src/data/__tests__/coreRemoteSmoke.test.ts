import { createPgHarness, isPostgresAvailable, type PgHarness } from './contract/pgHarness';
import {
  createFeedRepository,
  createUserRepository,
  createHazardRepository,
} from '@/data/remote/repos/core';

let h: PgHarness;
let available = false;

beforeAll(async () => {
  available = await isPostgresAvailable();
  if (available) h = await createPgHarness(`smoke_${process.pid}`);
}, 60_000);

afterAll(async () => {
  if (h) await h.close();
});

test('akış listeleme + gönderi + beğeni', async () => {
  if (!available) return;
  const feed = createFeedRepository(h.ctx);
  const users = createUserRepository(h.ctx);
  const all = await users.search('a');
  const me = all[0]!;
  h.signIn(me.id);
  const list = await feed.list(me.id);
  expect(list.length).toBeGreaterThan(0);
  expect(list[0]!.author.username.length).toBeGreaterThan(0);

  const created = await feed.create(me.id, {
    caption: 'test gönderisi',
    imageUri: null,
    adventureType: 'hiking',
    difficulty: 'easy',
    trailCondition: 'good',
    altitudeM: 100,
    distanceKm: 5,
    temperatureC: 12,
    windKmh: 4,
    durationMin: 90,
    locationName: 'Test',
  });
  expect(created.caption).toBe('test gönderisi');
  expect(created.likesCount).toBe(0);

  const other = all.find((u) => u.id !== me.id)!;
  h.signIn(other.id);
  const liked = await feed.toggleLike(other.id, created.id);
  expect(liked).toEqual({ liked: true, likesCount: 1 });
  const unliked = await feed.toggleLike(other.id, created.id);
  expect(unliked).toEqual({ liked: false, likesCount: 0 });

  const comment = await feed.addComment(other.id, created.id, 'harika');
  expect(comment.author.id).toBe(other.id);
  expect((await feed.listComments(created.id)).length).toBe(1);
}, 30_000);

test('tehlike bildir + çöz yetkisi', async () => {
  if (!available) return;
  const users = createUserRepository(h.ctx);
  const hazards = createHazardRepository(h.ctx);
  const all = await users.search('a');
  const me = all[0]!;
  const other = all.find((u) => u.id !== me.id)!;
  h.signIn(me.id);
  const reported = await hazards.report(me.id, {
    type: 'rockfall',
    severity: 'high',
    title: 'Kaya düşmesi',
    description: 'Yol kapalı',
    locationName: 'Test geçidi',
    coords: { latitude: 40.5, longitude: 30.5 },
    radiusM: 300,
    expiresInHours: null,
  });
  expect(reported.reporter.id).toBe(me.id);
  expect(reported.confirmations).toBe(0);

  await expect(hazards.confirm(me.id, reported.id)).rejects.toThrow(/onaylayamazsın/);
  h.signIn(other.id);
  const confirmed = await hazards.confirm(other.id, reported.id);
  expect(confirmed.confirmations).toBe(1);
  await expect(hazards.resolve(other.id, reported.id)).rejects.toThrow(/bildiren kişi/);
  h.signIn(me.id);
  const resolved = await hazards.resolve(me.id, reported.id);
  expect(resolved.status).toBe('resolved');
  expect(resolved.resolvedAt).not.toBeNull();
}, 30_000);
