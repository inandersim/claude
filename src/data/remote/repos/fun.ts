import {
  buildLeaderboard,
  challengeDaysLeft,
  evaluateBadges,
  isChallengeActive,
  isoDayKey,
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
  type ClubMember,
  type FunSummary,
  type GamificationStats,
  type GeoPoint,
  type ID,
  type LeaderboardScope,
  type QuizQuestion,
  type QuizResult,
  type XpEvent,
} from '@/domain';

import type { FunRepository } from '../../repositories';
import { PROFILE_SELECT, requireUser, type RemoteContext } from '../context';
import {
  iso,
  num,
  toBadge,
  toChallenge,
  toChallengeProgress,
  toLibraryPlace,
  toPassportStamp,
  toQuizQuestion,
  toUser,
  toXpEvent,
} from '../mappers';
import { maybeRow, rows } from '../postgrest';

const WEEK_MS = 7 * 86_400_000;
const QUIZ_SIZE = 5;

/** fun modülü uzak repository fabrikası. */
export function createFunRepository(ctx: RemoteContext): FunRepository {
  const { db } = ctx;

  const myXpEvents = async (meId: ID): Promise<XpEvent[]> => {
    const data = await rows(
      db
        .from('xp_events')
        .select('*')
        .eq('user_id', meId)
        .order('created_at', { ascending: false }),
      'XP olayları okunamadı',
    );
    return data.map(toXpEvent);
  };

  const weeklyXp = async (): Promise<XpEvent[]> => {
    const since = new Date(Date.now() - WEEK_MS).toISOString();
    const data = await rows(
      db.from('xp_events').select('*').gte('created_at', since),
      'haftalık XP okunamadı',
    );
    return data.map(toXpEvent);
  };

  /** Rozet koşulları için kullanıcı istatistikleri (mock ile aynı alanlar). */
  const statsFor = async (meId: ID, now: number): Promise<GamificationStats> => {
    const [events, postRows, stampRows, rsvpRows, hazardRows, quizRows, challengeRows] =
      await Promise.all([
        myXpEvents(meId),
        rows(db.from('posts').select('*').eq('author_id', meId), 'gönderiler okunamadı'),
        rows(db.from('passport_stamps').select('*').eq('user_id', meId), 'pasaport okunamadı'),
        rows(db.from('event_rsvps').select('event_id').eq('user_id', meId), 'katılımlar okunamadı'),
        rows(
          db
            .from('hazards')
            .select('confirmations')
            .eq('reporter_id', meId)
            .gte('confirmations', 3),
          'tehlikeler okunamadı',
        ),
        rows(
          db.from('quiz_attempts').select('correct').eq('user_id', meId).gte('correct', QUIZ_SIZE),
          'quiz denemeleri okunamadı',
        ),
        rows(
          db
            .from('challenge_progress')
            .select('completed_at')
            .eq('user_id', meId)
            .not('completed_at', 'is', null),
          'görev ilerlemesi okunamadı',
        ),
      ]);

    const routeIds = Array.from(
      new Set(postRows.map((row) => row.route_id).filter((id): id is string => Boolean(id))),
    );
    const routeRows = routeIds.length
      ? await rows(
          db.from('routes').select('elevation_gain_m').in('id', routeIds),
          'rotalar okunamadı',
        )
      : [];
    const stamps = stampRows.map(toPassportStamp);
    const weekly = xpSince(await weeklyXp(), now - WEEK_MS);
    const weeklyTop = Object.entries(weekly).sort((a, b) => b[1] - a[1])[0];
    const hourOf = (iso: unknown) => new Date(String(iso)).getHours();
    const monthOf = (iso: unknown) => new Date(String(iso)).getMonth();
    const level = levelFor(totalXp(events));

    return {
      posts: postRows.length,
      routes: routeIds.length,
      maxAscentM: routeRows.reduce((m, row) => Math.max(m, num(row.elevation_gain_m)), 0),
      nightCamps: postRows.filter((row) => num(row.duration_min) >= 12 * 60).length,
      dives: postRows.filter((row) => row.adventure_type === 'diving').length,
      countries: new Set(stamps.map((s) => s.countryCode)).size,
      streakDays: streakDays(events, now),
      hazardReportsConfirmed: hazardRows.length,
      perfectQuizzes: quizRows.length,
      clubEvents: new Set(rsvpRows.map((row) => String(row.event_id))).size,
      totalDistanceKm: postRows.reduce((sum, row) => sum + num(row.distance_km), 0),
      earlyStarts: postRows.filter((row) => hourOf(row.created_at) < 6).length,
      nightActivities: postRows.filter((row) => hourOf(row.created_at) >= 21).length,
      winterAdventures: postRows.filter((row) => [11, 0, 1].includes(monthOf(row.created_at)))
        .length,
      flights: postRows.filter((row) => row.adventure_type === 'paragliding').length,
      summits: stamps.filter((s) => (s.elevationM ?? 0) >= 2500).length,
      challengesCompleted: challengeRows.length,
      weeklyWins: weeklyTop && weeklyTop[0] === meId ? 1 : 0,
      level: level.level,
      xp: level.xp,
    };
  };

  /** Yeni rozetleri değerlendirir ve kazanılanları yazar. */
  const awardBadges = async (meId: ID, now: number): Promise<ID[]> => {
    const [earnedRows, badgeRows] = await Promise.all([
      rows(db.from('earned_badges').select('badge_id').eq('user_id', meId), 'rozetler okunamadı'),
      rows(db.from('badges').select('id, code').limit(500), 'rozet listesi okunamadı'),
    ]);
    const known = new Set(badgeRows.map((row) => String(row.id)));
    const earned = earnedRows.map((row) => String(row.badge_id));
    const fresh = evaluateBadges(await statsFor(meId, now), earned).filter((id) => known.has(id));
    if (fresh.length) {
      await rows(
        db.from('earned_badges').upsert(
          fresh.map((badgeId) => ({ badge_id: badgeId, user_id: meId })),
          { onConflict: 'badge_id,user_id', ignoreDuplicates: true },
        ),
        'rozetler yazılamadı',
      );
    }
    return fresh;
  };

  const challengesWithProgress = async (meId: ID): Promise<ChallengeWithProgress[]> => {
    const [challengeRows, progressRows] = await Promise.all([
      rows(db.from('challenges').select('*'), 'görevler okunamadı'),
      rows(db.from('challenge_progress').select('*'), 'görev ilerlemesi okunamadı'),
    ]);
    const progress = progressRows.map(toChallengeProgress);
    return challengeRows.map(toChallenge).map((c) => {
      const forChallenge = progress.filter((p) => p.challengeId === c.id);
      return {
        ...c,
        progress: forChallenge.find((p) => p.userId === meId) ?? null,
        participants: forChallenge.length,
      };
    });
  };

  const todaysQuiz = async (now: number, count = QUIZ_SIZE): Promise<QuizQuestion[]> => {
    const data = await rows(db.from('quiz_questions').select('*'), 'sorular okunamadı');
    return pickQuiz(data.map(toQuizQuestion), count, quizSeedFor(now));
  };

  return {
    async summary(meId): Promise<FunSummary> {
      await requireUser(db, meId);
      const now = Date.now();
      const [mine, badgeRows, stampRows, challenges] = await Promise.all([
        myXpEvents(meId),
        rows(db.from('badges').select('id'), 'rozetler okunamadı'),
        rows(db.from('passport_stamps').select('id').eq('user_id', meId), 'pasaport okunamadı'),
        challengesWithProgress(meId),
      ]);
      const earned = await rows(
        db.from('earned_badges').select('badge_id').eq('user_id', meId),
        'kazanılan rozetler okunamadı',
      );
      const leaderboard = await this.leaderboard(meId, 'global');
      const me = leaderboard.find((row) => row.isMe);
      return {
        level: levelFor(totalXp(mine)),
        streakDays: streakDays(mine, now),
        badgesEarned: earned.length,
        badgesTotal: badgeRows.length,
        activeChallenges: challenges.filter(
          (c) => isChallengeActive(c, now) && c.progress !== null && !c.progress.completedAt,
        ).length,
        stamps: stampRows.length,
        weeklyRank: me && me.xp > 0 ? me.rank : null,
      };
    },

    async badges(meId): Promise<BadgeWithStatus[]> {
      const [badgeRows, earnedRows] = await Promise.all([
        rows(db.from('badges').select('*'), 'rozetler okunamadı'),
        rows(db.from('earned_badges').select('*').eq('user_id', meId), 'kazanılanlar okunamadı'),
      ]);
      const earned = new Map(
        earnedRows.map((row) => [String(row.badge_id), String(row.earned_at ?? '')]),
      );
      return badgeRows.map(toBadge).map((b) => ({
        ...b,
        earnedAt: earned.get(b.id) ? new Date(earned.get(b.id) as string).toISOString() : null,
      }));
    },

    async challenges(meId): Promise<ChallengeWithProgress[]> {
      const now = Date.now();
      return (await challengesWithProgress(meId))
        .filter((c) => isChallengeActive(c, now))
        .sort((a, b) => challengeDaysLeft(a, now) - challengeDaysLeft(b, now));
    },

    async joinChallenge(meId, challengeId): Promise<ChallengeWithProgress> {
      await requireUser(db, meId);
      const row = await maybeRow(
        db.from('challenges').select('*').eq('id', challengeId),
        'görev okunamadı',
      );
      if (!row) throw new Error('Görev bulunamadı');
      const challenge = toChallenge(row);
      const now = Date.now();
      if (!isChallengeActive(challenge, now)) throw new Error('Görev aktif değil');
      const existing = await maybeRow(
        db
          .from('challenge_progress')
          .select('challenge_id')
          .eq('challenge_id', challengeId)
          .eq('user_id', meId),
        'ilerleme okunamadı',
      );
      if (!existing) {
        await rows(
          db.from('challenge_progress').insert({
            challenge_id: challengeId,
            user_id: meId,
            value: 0,
            completed_at: null,
          }),
          'göreve katılınamadı',
        );
        await awardBadges(meId, now);
      }
      const all = await challengesWithProgress(meId);
      const result = all.find((c) => c.id === challengeId);
      if (!result) throw new Error('Görev bulunamadı');
      return result;
    },

    async leaderboard(meId, scope: LeaderboardScope) {
      const [profileRows, followRows, clubRows, events] = await Promise.all([
        rows(
          db.from('profiles').select(PROFILE_SELECT).is('is_suspended', false),
          'profiller okunamadı',
        ),
        rows(db.from('follows').select('*'), 'takipler okunamadı'),
        rows(db.from('club_members').select('*'), 'kulüp üyeleri okunamadı'),
        weeklyXp(),
      ]);
      return buildLeaderboard(
        profileRows.map(toUser),
        xpSince(events, Date.now() - WEEK_MS),
        meId,
        scope,
        {
          follows: followRows.map((row) => ({
            followerId: String(row.follower_id),
            followingId: String(row.following_id),
            createdAt: iso(row.created_at),
          })),
          clubMembers: clubRows.map((row) => ({
            clubId: String(row.club_id),
            userId: String(row.user_id),
            role: String(row.role ?? 'member') as ClubMember['role'],
            joinedAt: iso(row.joined_at),
          })),
        },
      );
    },

    async quiz(meId, count = QUIZ_SIZE): Promise<QuizQuestion[]> {
      await requireUser(db, meId);
      return await todaysQuiz(Date.now(), count);
    },

    async submitQuiz(meId, answers): Promise<QuizResult> {
      await requireUser(db, meId);
      const now = Date.now();
      const questions = await todaysQuiz(now);
      const result = scoreQuiz(questions, answers);
      const today = isoDayKey(now);
      const attempted = await maybeRow(
        db.from('quiz_attempts').select('user_id').eq('user_id', meId).eq('attempt_date', today),
        'quiz denemesi okunamadı',
      );
      if (attempted) {
        // Günde tek deneme puan verir; sonrakiler yalnızca pratik.
        return { ...result, xpEarned: 0 };
      }
      // `award_quiz_xp` tetikleyicisi xp_events kaydını ve xp_earned alanını doldurur.
      await rows(
        db.from('quiz_attempts').insert({
          user_id: meId,
          attempt_date: today,
          correct: result.correct,
          total: result.total,
        }),
        'quiz kaydedilemedi',
      );
      await awardBadges(meId, now);
      return result;
    },

    async stamps(meId) {
      const data = await rows(
        db
          .from('passport_stamps')
          .select('*')
          .eq('user_id', meId)
          .order('stamped_at', { ascending: false }),
        'pasaport okunamadı',
      );
      return data.map(toPassportStamp);
    },

    async roulette(meId, origin: GeoPoint | null) {
      const me = await requireUser(db, meId);
      const data = await rows(db.from('places').select('*'), 'kütüphane okunamadı');
      const suggestion = spinRoulette(
        data.map(toLibraryPlace),
        origin ?? me.coords,
        me.favoriteTypes,
        Date.now(),
      );
      if (!suggestion) throw new Error('Öneri bulunamadı');
      return suggestion;
    },

    async xpHistory(meId) {
      return await myXpEvents(meId);
    },
  };
}
