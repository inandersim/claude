import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const ist = { latitude: 41.0, longitude: 29.0 };

describe('Fun', () => {
  it('özet: seviye, seri, rozet ve damga sayıları', async () => {
    const p = make();
    const s = await p.fun.summary(CURRENT_USER_ID);
    expect(s.level.level).toBeGreaterThanOrEqual(2);
    expect(s.streakDays).toBeGreaterThanOrEqual(5);
    expect(s.badgesEarned).toBe(6);
    expect(s.badgesTotal).toBe(20);
    expect(s.stamps).toBe(9);
    expect(s.activeChallenges).toBe(2);
    expect(s.weeklyRank).not.toBeNull();
  });

  it('rozetler kilitli/kazanılmış durumla döner', async () => {
    const p = make();
    const badges = await p.fun.badges(CURRENT_USER_ID);
    expect(badges).toHaveLength(20);
    expect(badges.filter((b) => b.earnedAt).map((b) => b.id)).toContain('b_first_post');
    expect(badges.find((b) => b.id === 'b_level_15')?.earnedAt).toBeNull();
  });

  it('görevler aktif, katılımcı sayısı ve katılım', async () => {
    const p = make();
    const list = await p.fun.challenges(CURRENT_USER_ID);
    expect(list.length).toBe(6);
    const hazard = list.find((c) => c.id === 'c_week_hazard')!;
    expect(hazard.progress).toBeNull();
    expect(hazard.participants).toBe(1);
    const joined = await p.fun.joinChallenge(CURRENT_USER_ID, 'c_week_hazard');
    expect(joined.progress?.value).toBe(0);
    expect(joined.participants).toBe(2);
    // ikinci katılım idempotent
    const again = await p.fun.joinChallenge(CURRENT_USER_ID, 'c_week_hazard');
    expect(again.participants).toBe(2);
    await expect(p.fun.joinChallenge(CURRENT_USER_ID, 'yok')).rejects.toThrow();
  });

  it('liderlik tablosu kapsamları ve isMe', async () => {
    const p = make();
    const global = await p.fun.leaderboard(CURRENT_USER_ID, 'global');
    expect(global.length).toBeGreaterThan(5);
    expect(global.some((r) => r.isMe)).toBe(true);
    expect(global[0]!.xp).toBeGreaterThanOrEqual(global[1]!.xp);
    const friends = await p.fun.leaderboard(CURRENT_USER_ID, 'friends');
    expect(friends.map((r) => r.user.id).sort()).toEqual(
      ['u_me', 'u_elif', 'u_can', 'u_zeynep', 'u_kerem'].sort(),
    );
    const city = await p.fun.leaderboard(CURRENT_USER_ID, 'city');
    expect(city.every((r) => r.user.locationName.includes('İstanbul'))).toBe(true);
    const club = await p.fun.leaderboard(CURRENT_USER_ID, 'club');
    expect(club.some((r) => r.isMe)).toBe(true);
  });

  it('günün yarışması: 5 soru, deterministik; günde bir kez XP', async () => {
    const p = make();
    const a = await p.fun.quiz(CURRENT_USER_ID);
    const b = await p.fun.quiz(CURRENT_USER_ID);
    expect(a).toHaveLength(5);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));

    const before = await p.fun.xpHistory(CURRENT_USER_ID);
    const answers = a.map((q) => ({ questionId: q.id, answerIndex: q.answerIndex }));
    const first = await p.fun.submitQuiz(CURRENT_USER_ID, answers);
    expect(first).toMatchObject({ correct: 5, total: 5, xpEarned: 50 });
    const after = await p.fun.xpHistory(CURRENT_USER_ID);
    expect(after.length).toBe(before.length + 1);
    expect(after[0]).toMatchObject({ source: 'quiz', amount: 50 });

    const second = await p.fun.submitQuiz(CURRENT_USER_ID, answers);
    expect(second.xpEarned).toBe(0);
    expect((await p.fun.xpHistory(CURRENT_USER_ID)).length).toBe(after.length);
  });

  it('damgalar tarihe göre azalan, rulet öneri üretir', async () => {
    const p = make();
    const stamps = await p.fun.stamps(CURRENT_USER_ID);
    expect(stamps).toHaveLength(9);
    expect(stamps[0]!.stampedAt >= stamps[1]!.stampedAt).toBe(true);
    const s = await p.fun.roulette(CURRENT_USER_ID, ist);
    expect(s.placeId).toBeTruthy();
    expect(s.reason.startsWith('fun.reason.')).toBe(true);
    expect(s.distanceKm).not.toBeNull();
  });
});
