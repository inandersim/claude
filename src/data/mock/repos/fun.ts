import { generateId } from '@/core/utils/format';
import type { FunRepository } from '@/data/repositories';
import {
  buildLeaderboard,
  challengeDaysLeft,
  isoDayKey,
  evaluateBadges,
  isChallengeActive,
  levelFor,
  pickQuiz,
  quizSeedFor,
  scoreQuiz,
  spinRoulette,
  streakDays,
  totalXp,
  xpSince,
  type BadgeWithStatus,
  type ChallengeWithProgress,
  type FunSummary,
  type GamificationStats,
  type GeoPoint,
  type ID,
  type LeaderboardScope,
  type QuizQuestion,
  type QuizResult,
  type RouletteSuggestion,
  type XpEvent,
} from '@/domain';

import type { MockContext } from '../context';
import type { Tables } from '../database';

const WEEK_MS = 7 * 86_400_000;
const QUIZ_SIZE = 5;

/** Kullanıcının rozet koşulları için istatistiklerini tablolar üzerinden türetir. */
function statsFor(t: Tables, meId: ID, now: number): GamificationStats {
  const myEvents = t.xpEvents.filter((e) => e.userId === meId);
  const myPosts = t.posts.filter((p) => p.authorId === meId);
  const routeIds = new Set(myPosts.map((p) => p.routeId).filter((id): id is ID => id !== null));
  const routes = t.routes.filter((r) => routeIds.has(r.id));
  const stamps = t.passportStamps.filter((s) => s.userId === meId);
  const myClubEvents = new Set(t.eventRsvps.filter((r) => r.userId === meId).map((r) => r.eventId));
  const weekXp = xpSince(t.xpEvents, now - WEEK_MS);
  const weeklyTop = Object.entries(weekXp).sort((a, b) => b[1] - a[1])[0];
  const hourOf = (iso: string) => new Date(iso).getHours();
  const monthOf = (iso: string) => new Date(iso).getMonth();
  const level = levelFor(totalXp(myEvents));

  return {
    posts: myPosts.length,
    routes: routeIds.size,
    maxAscentM: routes.reduce((m, r) => Math.max(m, r.elevationGainM), 0),
    nightCamps: myPosts.filter((p) => p.durationMin >= 12 * 60).length,
    dives: myPosts.filter((p) => p.adventureType === 'diving').length,
    countries: new Set(stamps.map((s) => s.countryCode)).size,
    streakDays: streakDays(myEvents, now),
    hazardReportsConfirmed: t.hazards.filter((h) => h.reporterId === meId && h.confirmations >= 3)
      .length,
    perfectQuizzes: t.quizAttempts.filter((a) => a.userId === meId && a.correct >= QUIZ_SIZE)
      .length,
    clubEvents: myClubEvents.size,
    totalDistanceKm: myPosts.reduce((s, p) => s + p.distanceKm, 0),
    earlyStarts: myPosts.filter((p) => hourOf(p.createdAt) < 6).length,
    nightActivities: myPosts.filter((p) => hourOf(p.createdAt) >= 21).length,
    winterAdventures: myPosts.filter((p) => [11, 0, 1].includes(monthOf(p.createdAt))).length,
    flights: myPosts.filter((p) => p.adventureType === 'paragliding').length,
    summits: stamps.filter((s) => (s.elevationM ?? 0) >= 2500).length,
    challengesCompleted: t.challengeProgress.filter((c) => c.userId === meId && c.completedAt)
      .length,
    weeklyWins: weeklyTop && weeklyTop[0] === meId ? 1 : 0,
    level: level.level,
    xp: level.xp,
  };
}

/** fun modülü mock repository fabrikası. */
export function createFunRepository(ctx: MockContext): FunRepository {
  const { db, wait, requireUser } = ctx;

  /** Yeni rozetleri değerlendirir, kazanılanları tabloya yazar; kimliklerini döner. */
  const awardBadges = (t: Tables, meId: ID, now: number): ID[] => {
    const earned = t.earnedBadges.filter((b) => b.userId === meId).map((b) => b.badgeId);
    const known = new Set(t.badges.map((b) => b.id));
    const fresh = evaluateBadges(statsFor(t, meId, now), earned).filter((id) => known.has(id));
    for (const badgeId of fresh) {
      t.earnedBadges.push({ badgeId, userId: meId, earnedAt: new Date(now).toISOString() });
    }
    // Not: NOTIFICATION_TYPES içinde rozet türü yok ve bildirim kendi kendine gönderilmez;
    // ekran yeni rozetleri toast ile gösterir.
    if (fresh.length > 0) db.markDirty();
    return fresh;
  };

  const withProgress = (t: Tables, meId: ID) => (c: Tables['challenges'][number]) => {
    const rows = t.challengeProgress.filter((p) => p.challengeId === c.id);
    return {
      ...c,
      progress: rows.find((p) => p.userId === meId) ?? null,
      participants: rows.length,
    } satisfies ChallengeWithProgress;
  };

  const todaysQuiz = (t: Tables, now: number): QuizQuestion[] =>
    pickQuiz(t.quizQuestions, QUIZ_SIZE, quizSeedFor(now));

  return {
    async summary(meId): Promise<FunSummary> {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const now = Date.now();
      const mine = t.xpEvents.filter((e) => e.userId === meId);
      const weekly = buildLeaderboard(t.users, xpSince(t.xpEvents, now - WEEK_MS), meId, 'global', {
        follows: t.follows,
        clubMembers: t.clubMembers,
      });
      const me = weekly.find((row) => row.isMe);
      return {
        level: levelFor(totalXp(mine)),
        streakDays: streakDays(mine, now),
        badgesEarned: t.earnedBadges.filter((b) => b.userId === meId).length,
        badgesTotal: t.badges.length,
        activeChallenges: t.challenges.filter(
          (c) =>
            isChallengeActive(c, now) &&
            t.challengeProgress.some(
              (p) => p.challengeId === c.id && p.userId === meId && !p.completedAt,
            ),
        ).length,
        stamps: t.passportStamps.filter((s) => s.userId === meId).length,
        weeklyRank: me && me.xp > 0 ? me.rank : null,
      };
    },

    async badges(meId): Promise<BadgeWithStatus[]> {
      await wait();
      const t = await db.load();
      const earned = new Map(
        t.earnedBadges.filter((b) => b.userId === meId).map((b) => [b.badgeId, b.earnedAt]),
      );
      return t.badges.map((b) => ({ ...b, earnedAt: earned.get(b.id) ?? null }));
    },

    async challenges(meId): Promise<ChallengeWithProgress[]> {
      await wait();
      const t = await db.load();
      const now = Date.now();
      return t.challenges
        .filter((c) => isChallengeActive(c, now))
        .map(withProgress(t, meId))
        .sort((a, b) => challengeDaysLeft(a, now) - challengeDaysLeft(b, now));
    },

    async joinChallenge(meId, challengeId): Promise<ChallengeWithProgress> {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const challenge = t.challenges.find((c) => c.id === challengeId);
      if (!challenge) throw new Error('Görev bulunamadı');
      const now = Date.now();
      if (!isChallengeActive(challenge, now)) throw new Error('Görev aktif değil');
      const existing = t.challengeProgress.find(
        (p) => p.challengeId === challengeId && p.userId === meId,
      );
      if (!existing) {
        t.challengeProgress.push({
          challengeId,
          userId: meId,
          value: 0,
          completedAt: null,
          joinedAt: new Date(now).toISOString(),
        });
        db.markDirty();
        awardBadges(t, meId, now);
      }
      return withProgress(t, meId)(challenge);
    },

    async leaderboard(meId, scope: LeaderboardScope) {
      await wait();
      const t = await db.load();
      return buildLeaderboard(t.users, xpSince(t.xpEvents, Date.now() - WEEK_MS), meId, scope, {
        follows: t.follows,
        clubMembers: t.clubMembers,
      });
    },

    async quiz(meId, count = QUIZ_SIZE): Promise<QuizQuestion[]> {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      return pickQuiz(t.quizQuestions, count, quizSeedFor(Date.now()));
    },

    async submitQuiz(meId, answers): Promise<QuizResult> {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const now = Date.now();
      const questions = todaysQuiz(t, now);
      const result = scoreQuiz(questions, answers);
      const today = isoDayKey(now);
      const attemptedToday = t.quizAttempts.some((a) => a.userId === meId && a.date === today);

      if (attemptedToday) {
        // Günde tek deneme puan verir; sonrakiler yalnızca pratik.
        return { ...result, xpEarned: 0 };
      }

      t.quizAttempts.push({ userId: meId, date: today, correct: result.correct });
      if (result.xpEarned > 0) {
        const event: XpEvent = {
          id: generateId('xp'),
          userId: meId,
          source: 'quiz',
          amount: result.xpEarned,
          note: `Günün yarışması: ${result.correct}/${result.total}`,
          createdAt: new Date(now).toISOString(),
        };
        t.xpEvents.unshift(event);
      }
      db.markDirty();
      awardBadges(t, meId, now);
      return result;
    },

    async stamps(meId) {
      await wait();
      const t = await db.load();
      return t.passportStamps
        .filter((s) => s.userId === meId)
        .sort((a, b) => b.stampedAt.localeCompare(a.stampedAt));
    },

    async roulette(meId, origin: GeoPoint | null): Promise<RouletteSuggestion> {
      await wait();
      const t = await db.load();
      const me = requireUser(t.users, meId);
      const suggestion = spinRoulette(t.library, origin ?? me.coords, me.favoriteTypes, Date.now());
      if (!suggestion) throw new Error('Öneri bulunamadı');
      return suggestion;
    },

    async xpHistory(meId) {
      await wait();
      const t = await db.load();
      return t.xpEvents
        .filter((e) => e.userId === meId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
}
