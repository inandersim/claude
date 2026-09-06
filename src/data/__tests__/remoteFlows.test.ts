import { createPgHarness, isPostgresAvailable, type PgHarness } from './contract/pgHarness';
import { createUserRepository } from '@/data/remote/repos/core';
import { createGroupRepository } from '@/data/remote/repos/groups';
import { createInventoryRepository } from '@/data/remote/repos/inventory';
import { createClimbingRepository } from '@/data/remote/repos/climbing';
import { createFunRepository } from '@/data/remote/repos/fun';
import { createSocialRepository } from '@/data/remote/repos/social';

let h: PgHarness;
let ok = false;

beforeAll(async () => {
  ok = await isPostgresAvailable();
  if (ok) h = await createPgHarness(`flows_${process.pid}`);
}, 60_000);
afterAll(async () => {
  if (h) await h.close();
});

async function twoUsers() {
  const users = createUserRepository(h.ctx);
  const list = await users.search('a');
  return [list[0]!, list[1]!] as const;
}

test('grup oluştur + mesaj', async () => {
  if (!ok) return;
  const [me, other] = await twoUsers();
  h.signIn(me.id);
  const groups = createGroupRepository(h.ctx);
  const g = await groups.create(me.id, {
    name: 'Test Grubu',
    kind: 'group',
    privacy: 'public',
    description: 'test',
    adventureTypes: ['hiking'],
    city: 'İstanbul',
  });
  expect(g.membership).toBe('owner');
  expect(g.memberCount).toBe(1);
  h.signIn(other.id);
  const joined = await groups.join(other.id, g.id);
  expect(joined.membership).toBe('member');
  expect(joined.memberCount).toBe(2);
  const msg = await groups.send(other.id, g.id, { type: 'text', text: 'merhaba @' + me.username });
  expect(msg.sender.id).toBe(other.id);
  const page = await groups.messages(me.id, g.id);
  expect(page.map((m) => m.type)).toContain('text');
  const poll = await groups.send(other.id, g.id, {
    type: 'poll',
    text: '',
    poll: { question: 'Nereye?', options: ['A', 'B'], multi: false },
  });
  const voted = await groups.vote(me.id, g.id, poll.id, ['o1']);
  expect(voted.poll!.options[0]!.votes).toBe(1);
}, 30_000);

test('rezervasyon + çakışma + iptal', async () => {
  if (!ok) return;
  const [me, other] = await twoUsers();
  const inv = createInventoryRepository(h.ctx);
  const biz = await h.pool.query(
    'select id, owner_id from businesses where price_from_try is not null limit 1',
  );
  const businessId = String(biz.rows[0].id);
  const ownerId = String(biz.rows[0].owner_id);
  h.signIn(ownerId);
  const unit = await inv.upsertUnit(ownerId, {
    businessId,
    name: 'Tek Oda',
    kind: 'room',
    capacity: 2,
    quantity: 1,
    basePriceTry: 1000,
    weekendMultiplier: 1,
    seasons: [],
    amenities: [],
  });
  const input = {
    businessId,
    unitId: unit.id,
    checkIn: '2031-05-01',
    checkOut: '2031-05-04',
    guests: 1,
  };
  h.signIn(me.id);
  const q = await inv.quote(input);
  expect(q.nights).toBe(3);
  expect(q.available).toBe(true);
  const booking = await inv.book(me.id, input);
  expect(booking.status).toBe('confirmed');
  expect(booking.payment?.status).toBe('escrow');
  // çakışma: aynı tarihlerde ikinci rezervasyon reddedilir
  h.signIn(other.id);
  await expect(inv.book(other.id, input)).rejects.toThrow(/müsaitlik yok/);
  // iptal
  h.signIn(me.id);
  const cancelled = await inv.cancel(me.id, booking.id);
  expect(cancelled.status).toBe('cancelled');
  // iptalden sonra tarihler serbest
  h.signIn(other.id);
  const second = await inv.book(other.id, input);
  expect(second.status).toBe('confirmed');
}, 30_000);

test('tırmanış onayı', async () => {
  if (!ok) return;
  const [me, other] = await twoUsers();
  const climb = createClimbingRepository(h.ctx);
  const crags = await climb.crags({});
  const crag = crags[0]!;
  const sectors = await climb.sectors(crag.id);
  h.signIn(me.id);
  const route = await climb.submitRoute(me.id, {
    cragId: crag.id,
    sectorId: sectors[0]!.id,
    name: 'Deneme Rotası',
    type: 'sport',
    grade: '6a',
    gradeSystem: 'french',
    lengthM: 25,
    pitches: 1,
    description: 'test',
  });
  expect(route.verification).toBe('unverified');
  await expect(climb.confirmRoute(me.id, route.id)).rejects.toThrow(/onaylayamazsın/);
  h.signIn(other.id);
  const confirmed = await climb.confirmRoute(other.id, route.id);
  expect(confirmed.confirmations).toBe(1);
  const detail = await climb.route(route.id, other.id);
  expect(detail?.confirmedByMe).toBe(true);
  // çıkış kaydı XP verir
  const before = await h.pool.query(
    'select coalesce(sum(amount),0)::int n from xp_events where user_id=$1',
    [other.id],
  );
  await climb.logAscent(other.id, { routeId: route.id, style: 'redpoint', note: 'iyi' });
  const after = await h.pool.query(
    'select coalesce(sum(amount),0)::int n from xp_events where user_id=$1',
    [other.id],
  );
  expect(after.rows[0].n - before.rows[0].n).toBe(30);
}, 30_000);

test('XP kazanımı — günün yarışması', async () => {
  if (!ok) return;
  const [me] = await twoUsers();
  h.signIn(me.id);
  const fun = createFunRepository(h.ctx);
  await h.pool.query('delete from quiz_attempts where user_id=$1', [me.id]);
  const questions = await fun.quiz(me.id);
  expect(questions.length).toBe(5);
  const before = (await fun.xpHistory(me.id)).length;
  const result = await fun.submitQuiz(
    me.id,
    questions.map((q) => ({ questionId: q.id, answerIndex: q.answerIndex })),
  );
  expect(result.correct).toBe(5);
  expect(result.xpEarned).toBeGreaterThan(0);
  const after = await fun.xpHistory(me.id);
  expect(after.length).toBe(before + 1);
  expect(after[0]!.source).toBe('quiz');
  const again = await fun.submitQuiz(
    me.id,
    questions.map((q) => ({ questionId: q.id, answerIndex: q.answerIndex })),
  );
  expect(again.xpEarned).toBe(0);
}, 30_000);

test('sosyal: tepki + kaydet + yeniden paylaşım', async () => {
  if (!ok) return;
  const [me, other] = await twoUsers();
  h.signIn(me.id);
  const social = createSocialRepository(h.ctx);
  const post = await social.createStatus(me.id, {
    caption: 'merhaba #zirtan',
    imageUris: [],
    locationName: 'İstanbul',
  });
  expect(post.hashtags).toContain('zirtan');
  h.signIn(other.id);
  const reacted = await social.react(other.id, post.id, 'fire');
  expect(reacted.myReaction).toBe('fire');
  expect(reacted.likesCount).toBe(1);
  const saved = await social.toggleSave(other.id, post.id);
  expect(saved.savedByMe).toBe(true);
  const rp = await social.repost(other.id, post.id, 'süper');
  expect(rp.repostOf?.id).toBe(post.id);
  const tagged = await social.byHashtag(other.id, 'zirtan');
  expect(tagged.some((p) => p.id === post.id)).toBe(true);
}, 30_000);
