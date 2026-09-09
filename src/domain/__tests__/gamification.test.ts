import {
  EMPTY_STATS,
  buildLeaderboard,
  challengeDaysLeft,
  challengeProgressPct,
  completeChallenge,
  evaluateBadges,
  flagEmoji,
  isChallengeActive,
  levelFor,
  passportSummary,
  pickQuiz,
  scoreQuiz,
  spinRoulette,
  streakDays,
  xpFor,
  xpThreshold,
} from '../gamification';
import type {
  Challenge,
  ChallengeProgress,
  LibraryPlace,
  PassportStamp,
  QuizQuestion,
  User,
  XpEvent,
} from '../types';

const NOW = new Date('2026-09-05T12:00:00.000Z');
const DAY = 86_400_000;
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY).toISOString();

const user = (id: string, o: Partial<User> = {}): User => ({
  id,
  username: id,
  displayName: id,
  avatarUrl: null,
  coverUrl: null,
  bio: '',
  locationName: 'Kadıköy, İstanbul',
  coords: { latitude: 41, longitude: 29 },
  isVerified: false,
  totalDistanceKm: 0,
  totalAdventures: 0,
  followersCount: 0,
  followingCount: 0,
  trustScore: 50,
  favoriteTypes: ['hiking'],
  joinedAt: '2025-01-01T00:00:00.000Z',
  plan: 'free',
  emergencyContacts: [],
  ...o,
});

const event = (userId: string, createdAt: string, amount = 10): XpEvent => ({
  id: `${userId}-${createdAt}`,
  userId,
  source: 'post',
  amount,
  note: '',
  createdAt,
});

describe('levelFor', () => {
  it('eşikler üçgensel artar ve seviye monoton yükselir', () => {
    expect(xpThreshold(1)).toBe(0);
    expect(xpThreshold(2)).toBe(100);
    expect(xpThreshold(3)).toBe(300);
    expect(xpThreshold(5)).toBe(1000);
    let prev = 0;
    for (let xp = 0; xp <= 20_000; xp += 137) {
      const info = levelFor(xp);
      expect(info.level).toBeGreaterThanOrEqual(prev);
      expect(info.progress).toBeGreaterThanOrEqual(0);
      expect(info.progress).toBeLessThanOrEqual(1);
      expect(info.nextLevelXp).toBeGreaterThan(xp);
      prev = info.level;
    }
  });

  it('unvan ve ilerleme doğru hesaplanır', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: 'fun.level.rookie', progress: 0 });
    expect(levelFor(150)).toMatchObject({ level: 2, nextLevelXp: 300, progress: 0.25 });
    expect(levelFor(300).level).toBe(3);
    expect(levelFor(300).title).toBe('fun.level.explorer');
    expect(levelFor(-5).xp).toBe(0);
  });
});

describe('xpFor', () => {
  it('puan tablosu ve bonuslar', () => {
    expect(xpFor('post')).toBe(10);
    expect(xpFor('hazard_report')).toBe(40);
    expect(xpFor('quiz', { correct: 3, total: 5 })).toBe(15);
    expect(xpFor('quiz', { correct: 5, total: 5 })).toBe(50);
    expect(xpFor('streak', { days: 6 })).toBe(12);
    expect(xpFor('challenge', { rewardXp: 300 })).toBe(300);
    expect(xpFor('challenge')).toBe(100);
  });
});

describe('streakDays', () => {
  it('bugün dahil ardışık günleri sayar', () => {
    const events = [0, 1, 2, 3, 4, 7].map((d) => event('u', daysAgo(d)));
    expect(streakDays(events, NOW)).toBe(5);
  });

  it('bugün olay yoksa dünden sayar; iki gün boşlukta sıfırlanır', () => {
    expect(
      streakDays(
        [1, 2, 3].map((d) => event('u', daysAgo(d))),
        NOW,
      ),
    ).toBe(3);
    expect(
      streakDays(
        [2, 3].map((d) => event('u', daysAgo(d))),
        NOW,
      ),
    ).toBe(0);
    expect(streakDays([], NOW)).toBe(0);
  });
});

describe('evaluateBadges', () => {
  it('koşulu sağlanan ama kazanılmamış rozetleri döner', () => {
    const fresh = evaluateBadges(
      { ...EMPTY_STATS, posts: 1, routes: 10, countries: 3, streakDays: 7 },
      ['b_first_post'],
    );
    expect(fresh).toEqual(
      expect.arrayContaining(['b_ten_routes', 'b_three_countries', 'b_streak_7']),
    );
    expect(fresh).not.toContain('b_first_post');
    expect(fresh).not.toContain('b_ascent_1000');
  });

  it('boş istatistikte hiçbir rozet vermez', () => {
    expect(evaluateBadges(EMPTY_STATS, [])).toEqual([]);
  });

  it('eşik koşulları: 1000 m tırmanış, 5 dalış, tam puan, seviye 15', () => {
    expect(evaluateBadges({ ...EMPTY_STATS, maxAscentM: 999 }, [])).not.toContain('b_ascent_1000');
    expect(evaluateBadges({ ...EMPTY_STATS, maxAscentM: 1000 }, [])).toContain('b_ascent_1000');
    expect(evaluateBadges({ ...EMPTY_STATS, dives: 5 }, [])).toContain('b_five_dives');
    expect(evaluateBadges({ ...EMPTY_STATS, perfectQuizzes: 1 }, [])).toContain('b_quiz_perfect');
    expect(evaluateBadges({ ...EMPTY_STATS, level: 15 }, [])).toContain('b_level_15');
  });
});

describe('görevler', () => {
  const challenge: Challenge = {
    id: 'c',
    title: '',
    description: '',
    period: 'weekly',
    adventureType: null,
    target: 1500,
    unit: 'm',
    rewardXp: 200,
    badgeId: null,
    startsAt: daysAgo(2),
    endsAt: new Date(NOW.getTime() + 5 * DAY).toISOString(),
  };
  const progress: ChallengeProgress = {
    challengeId: 'c',
    userId: 'u',
    value: 600,
    completedAt: null,
    joinedAt: daysAgo(1),
  };

  it('aktiflik, yüzde ve kalan gün', () => {
    expect(isChallengeActive(challenge, NOW)).toBe(true);
    expect(isChallengeActive(challenge, new Date(NOW.getTime() + 6 * DAY))).toBe(false);
    expect(challengeProgressPct(progress, challenge)).toBe(40);
    expect(challengeProgressPct(null, challenge)).toBe(0);
    expect(challengeProgressPct({ value: 9999 }, challenge)).toBe(100);
    expect(challengeDaysLeft(challenge, NOW)).toBe(5);
  });

  it('completeChallenge hedefe ulaşınca damgalar, tamamlanmışa dokunmaz', () => {
    const partial = completeChallenge(progress, challenge, NOW, 400);
    expect(partial.value).toBe(1000);
    expect(partial.completedAt).toBeNull();
    const done = completeChallenge(partial, challenge, NOW, 800);
    expect(done.value).toBe(1500);
    expect(done.completedAt).toBe(NOW.toISOString());
    expect(completeChallenge(done, challenge, new Date(), 50)).toBe(done);
  });
});

describe('buildLeaderboard', () => {
  const users = [
    user('me'),
    user('friend', { locationName: 'Beşiktaş, İstanbul' }),
    user('antalya', { locationName: 'Kaş, Antalya', coords: { latitude: 36.2, longitude: 29.6 } }),
    user('clubmate', { locationName: 'Niğde', coords: { latitude: 37.9, longitude: 34.7 } }),
  ];
  const xp = { me: 40, friend: 120, antalya: 300, clubmate: 10 };
  const meta = {
    follows: [{ followerId: 'me', followingId: 'friend', createdAt: daysAgo(1) }],
    clubMembers: [
      { clubId: 'k', userId: 'me', role: 'member' as const, joinedAt: daysAgo(1) },
      { clubId: 'k', userId: 'clubmate', role: 'member' as const, joinedAt: daysAgo(1) },
    ],
  };

  it('global: XP azalan sıralı, isMe işaretli', () => {
    const rows = buildLeaderboard(users, xp, 'me', 'global', meta);
    expect(rows.map((r) => r.user.id)).toEqual(['antalya', 'friend', 'me', 'clubmate']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(rows.find((r) => r.isMe)?.rank).toBe(3);
  });

  it('friends / city / club kapsamları', () => {
    expect(buildLeaderboard(users, xp, 'me', 'friends', meta).map((r) => r.user.id)).toEqual([
      'friend',
      'me',
    ]);
    expect(buildLeaderboard(users, xp, 'me', 'city', meta).map((r) => r.user.id)).toEqual([
      'friend',
      'me',
    ]);
    expect(buildLeaderboard(users, xp, 'me', 'club', meta).map((r) => r.user.id)).toEqual([
      'me',
      'clubmate',
    ]);
  });

  it('XP kaydı olmayan kullanıcı da 0 ile listelenir', () => {
    const rows = buildLeaderboard(users, { friend: 5 }, 'me', 'friends', meta);
    expect(rows.find((r) => r.isMe)).toMatchObject({ xp: 0, rank: 2 });
  });
});

describe('quiz', () => {
  const questions: QuizQuestion[] = Array.from({ length: 12 }, (_, i) => ({
    id: `q${i}`,
    question: `S${i}`,
    options: ['a', 'b', 'c', 'd'],
    answerIndex: i % 4,
    explanation: '',
    adventureType: null,
  }));

  it('pickQuiz aynı tohumla aynı seti, farklı tohumla farklı sırayı verir', () => {
    const a = pickQuiz(questions, 5, 20_700);
    const b = pickQuiz(questions, 5, 20_700);
    const c = pickQuiz(questions, 5, 20_701);
    expect(a).toHaveLength(5);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(new Set(a.map((q) => q.id)).size).toBe(5);
    expect(a.map((q) => q.id)).not.toEqual(c.map((q) => q.id));
  });

  it('scoreQuiz doğru sayar, tam puanda bonus verir, en uzun seriyi bulur', () => {
    const set = questions.slice(0, 5);
    const perfect = scoreQuiz(
      set,
      set.map((q) => ({ questionId: q.id, answerIndex: q.answerIndex })),
    );
    expect(perfect).toEqual({ correct: 5, total: 5, xpEarned: 50, streak: 5 });

    const partial = scoreQuiz(set, [
      { questionId: 'q0', answerIndex: 0 },
      { questionId: 'q1', answerIndex: 1 },
      { questionId: 'q2', answerIndex: 0 },
      { questionId: 'q3', answerIndex: 3 },
    ]);
    expect(partial).toEqual({ correct: 3, total: 5, xpEarned: 15, streak: 2 });
    expect(scoreQuiz(set, []).xpEarned).toBe(0);
  });
});

describe('spinRoulette', () => {
  const place = (id: string, o: Partial<LibraryPlace>): LibraryPlace => ({
    id,
    source: 'curated',
    kind: 'peak',
    name: id,
    names: {},
    adventureTypes: ['hiking'],
    lat: 41,
    lng: 29,
    elevationM: null,
    description: null,
    website: null,
    phone: null,
    openingHours: null,
    countryCode: 'TR',
    tags: {},
    wikidataId: null,
    image: null,
    license: '',
    attribution: '',
    updatedAt: daysAgo(1),
    ...o,
  });
  const places = [
    place('near-hike', { lat: 41.2, lng: 29.1 }),
    place('far-dive', { adventureTypes: ['diving'], lat: 36.2, lng: 29.6 }),
    place('alps', {
      adventureTypes: ['climbing'],
      lat: 45.9,
      lng: 6.9,
      countryCode: 'FR',
      elevationM: 3842,
    }),
  ];
  const origin = { latitude: 41, longitude: 29 };

  it('aynı tohumla aynı sonucu verir', () => {
    const a = spinRoulette(places, origin, ['diving'], 42);
    const b = spinRoulette(places, origin, ['diving'], 42);
    expect(a).toEqual(b);
    expect(a?.placeId).toBeTruthy();
  });

  it('tercih ağırlığı seçimi yönlendirir ve neden anahtarı üretir', () => {
    const hits = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      const s = spinRoulette(places, origin, ['diving'], seed);
      if (s) hits.add(s.placeId ?? '');
    }
    expect(hits.has('far-dive')).toBe(true);
    const s = spinRoulette([places[1]!], origin, ['diving'], 1);
    expect(s).toMatchObject({ adventureType: 'diving', reason: 'fun.reason.preference' });
    const near = spinRoulette([places[0]!], origin, [], 1);
    expect(near?.reason).toBe('fun.reason.nearby');
    expect(near?.distanceKm).toBeLessThan(30);
    const abroad = spinRoulette([places[2]!], null, [], 1);
    expect(abroad?.reason).toBe('fun.reason.altitude');
    expect(abroad?.distanceKm).toBeNull();
  });

  it('yer yoksa null', () => {
    expect(spinRoulette([], origin, [], 1)).toBeNull();
  });
});

describe('passportSummary / flagEmoji', () => {
  const stamp = (id: string, o: Partial<PassportStamp>): PassportStamp => ({
    id,
    userId: 'me',
    placeName: id,
    countryCode: 'TR',
    adventureType: 'hiking',
    elevationM: null,
    stampedAt: daysAgo(10),
    ...o,
  });

  it('ülke sayısı, en yüksek irtifa ve tür dağılımı', () => {
    const s = passportSummary([
      stamp('a', { elevationM: 3937 }),
      stamp('b', { countryCode: 'NP', elevationM: 5364, stampedAt: daysAgo(1) }),
      stamp('c', { countryCode: 'FR', adventureType: 'climbing' }),
      stamp('d', { adventureType: 'diving' }),
    ]);
    expect(s.total).toBe(4);
    expect(s.countries).toBe(3);
    expect(s.highestM).toBe(5364);
    expect(s.highestName).toBe('b');
    expect(s.byType).toEqual({ hiking: 2, climbing: 1, diving: 1 });
    expect(s.latestAt).toBe(daysAgo(1));
    expect(passportSummary([]).highestM).toBeNull();
  });

  it('bayrak emojisi', () => {
    expect(flagEmoji('TR')).toBe('🇹🇷');
    expect(flagEmoji('np')).toBe('🇳🇵');
    expect(flagEmoji('XYZ')).toBe('🏳️');
  });
});

describe('seri sayımı günün saatinden bağımsız', () => {
  /**
   * `seed.fun.ts` içindeki seri olayları ham saatle (6, 26, 30, 52, 74…)
   * yerleştirilmişti. `streakDays` gün sınırını UTC'ye göre hesapladığı için
   * bu olayların kaç ayrı güne düştüğü **testin çalıştığı saate** bağlıydı:
   * bazı saatlerde 5, bazılarında 4 gün. Test takvime göre geçip kalıyordu.
   *
   * Bu paket kuralı sabitliyor: tam gün katları her saatte aynı seriyi verir.
   */
  const olay = (saatOnce: number, now: number): XpEvent => ({
    id: `x${saatOnce}`,
    userId: 'u1',
    source: 'post',
    amount: 10,
    note: '',
    createdAt: new Date(now - saatOnce * 3_600_000).toISOString(),
  });

  it('tam gün katları her saat diliminde aynı seriyi verir', () => {
    // Günün 24 saatinin tamamı denenir; hiçbirinde sonuç değişmemeli.
    for (let saat = 0; saat < 24; saat++) {
      const now = Date.UTC(2026, 8, 9, saat, 30, 0);
      const olaylar = [0, 1, 2, 3, 4].map((g) => olay(g * 24, now));
      expect(streakDays(olaylar, now)).toBe(5);
    }
  });

  it('ham saat kullanmak neden kırılgandı — gösterim', () => {
    // Eski tohumun saatleri. Sonuç saate göre değişiyor: testin kırılganlığı
    // buradan geliyordu.
    const saatler = [6, 26, 30, 52, 74];
    const sonuclar = new Set<number>();
    for (let saat = 0; saat < 24; saat++) {
      const now = Date.UTC(2026, 8, 9, saat, 30, 0);
      sonuclar.add(streakDays(saatler.map((h) => olay(h, now)), now));
    }
    expect(sonuclar.size).toBeGreaterThan(1);
  });
});
