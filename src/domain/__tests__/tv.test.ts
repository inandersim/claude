import {
  filterPrograms,
  formatDurationLabel,
  groupBySeries,
  isNewsActive,
  isWatchInProgress,
  nextEpisode,
  nowPlaying,
  progressPct,
  progressRatio,
  recommendPrograms,
  scheduleForDay,
  sortNews,
  tickerText,
  tvDayKey,
  validateSubmission,
  type NewsItem,
  type TvProgram,
  type TvSchedule,
} from '@/domain';

const program = (id: string, over: Partial<TvProgram> = {}): TvProgram => ({
  id,
  channelId: 'ch_belgesel',
  title: id,
  kind: 'documentary',
  description: '',
  thumbnailUrl: null,
  videoUrl: 'https://example.com/v.mp4',
  durationMin: 30,
  adventureTypes: ['hiking'],
  destinationId: null,
  countryCode: 'TR',
  seriesTitle: null,
  episode: null,
  publishedAt: '2026-09-01T00:00:00.000Z',
  viewsCount: 100,
  likesCount: 10,
  languages: ['tr'],
  subtitles: [],
  kidsFriendly: false,
  creditsNote: '',
  ...over,
});

const news = (id: string, over: Partial<NewsItem> = {}): NewsItem => ({
  id,
  category: 'weather',
  title: id,
  summary: '',
  body: '',
  region: 'Rize',
  countryCode: 'TR',
  coords: null,
  sourceName: 'MGM',
  sourceUrl: null,
  severity: 'info',
  publishedAt: '2026-09-05T00:00:00.000Z',
  expiresAt: null,
  ...over,
});

describe('filterPrograms', () => {
  const list = [
    program('a', { title: 'Kaçkar Baharı', kind: 'series', seriesTitle: 'Kaçkar', episode: 1 }),
    program('b', { title: 'Kaş Sualtı', adventureTypes: ['diving'], kidsFriendly: true }),
    program('c', { title: 'Düğümler', kind: 'tutorial', channelId: 'ch_akademi' }),
  ];

  it('boş filtre hepsini döner', () => {
    expect(filterPrograms(list, {}).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('tür, kanal, macera türü ve çocuk filtreleri', () => {
    expect(filterPrograms(list, { kind: 'tutorial' }).map((p) => p.id)).toEqual(['c']);
    expect(filterPrograms(list, { channelId: 'ch_akademi' }).map((p) => p.id)).toEqual(['c']);
    expect(filterPrograms(list, { adventureType: 'diving' }).map((p) => p.id)).toEqual(['b']);
    expect(filterPrograms(list, { kidsOnly: true }).map((p) => p.id)).toEqual(['b']);
  });

  it('arama başlık ve dizi adında, Türkçe küçük harf duyarsız', () => {
    expect(filterPrograms(list, { query: 'KAÇKAR' }).map((p) => p.id)).toEqual(['a']);
    expect(filterPrograms(list, { query: 'sualtı' }).map((p) => p.id)).toEqual(['b']);
    expect(filterPrograms(list, { query: 'yok' })).toEqual([]);
  });
});

describe('groupBySeries / nextEpisode', () => {
  const s1 = program('s1', { seriesTitle: 'Kaçkar', episode: 1 });
  const s3 = program('s3', { seriesTitle: 'Kaçkar', episode: 3 });
  const s2 = program('s2', { seriesTitle: 'Kaçkar', episode: 2 });
  const solo = program('solo');
  const all = [s3, solo, s1, s2];

  it('bölümleri numaraya göre sıralar, tekilleri dışarıda bırakır', () => {
    const groups = groupBySeries(all);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.episodes.map((e) => e.id)).toEqual(['s1', 's2', 's3']);
  });

  it('sonraki bölümü bulur; son bölüm ve tekil programda null', () => {
    expect(nextEpisode(s1, all)?.id).toBe('s2');
    expect(nextEpisode(s2, all)?.id).toBe('s3');
    expect(nextEpisode(s3, all)).toBeNull();
    expect(nextEpisode(solo, all)).toBeNull();
  });
});

describe('scheduleForDay / nowPlaying', () => {
  const day = new Date(2026, 8, 6, 0, 0, 0); // yerel 6 Eylül
  const at = (h: number, m = 0) => new Date(2026, 8, 6, h, m).toISOString();
  const slot = (id: string, startsAt: string, endsAt: string): TvSchedule => ({
    id,
    channelId: 'ch',
    programId: null,
    streamId: null,
    title: id,
    startsAt,
    endsAt,
  });
  const schedule = [
    slot('late', at(21), at(22)),
    slot('early', at(8), at(9)),
    slot('other', new Date(2026, 8, 7, 8).toISOString(), new Date(2026, 8, 7, 9).toISOString()),
  ];

  it('güne düşenleri başlangıca göre sıralar', () => {
    expect(scheduleForDay(schedule, tvDayKey(day)).map((s) => s.id)).toEqual(['early', 'late']);
  });

  it('nowPlaying yarı açık aralık kullanır', () => {
    expect(nowPlaying(schedule, new Date(2026, 8, 6, 8, 30)).map((s) => s.id)).toEqual(['early']);
    expect(nowPlaying(schedule, new Date(2026, 8, 6, 9, 0))).toEqual([]);
    expect(nowPlaying(schedule, new Date(2026, 8, 6, 21, 0)).map((s) => s.id)).toEqual(['late']);
  });
});

describe('progress', () => {
  it('oran ve yüzde sınırlanır', () => {
    expect(progressRatio(30, 60)).toBe(0.5);
    expect(progressRatio(90, 60)).toBe(1);
    expect(progressRatio(-5, 60)).toBe(0);
    expect(progressRatio(10, 0)).toBe(0);
    expect(progressPct(1, 3)).toBe(33);
  });

  it('izlemeye devam aralığı %5–%95', () => {
    expect(isWatchInProgress(0.04)).toBe(false);
    expect(isWatchInProgress(0.5)).toBe(true);
    expect(isWatchInProgress(0.95)).toBe(false);
  });

  it('süre etiketi', () => {
    expect(formatDurationLabel(45, 'tr')).toBe('45 dk');
    expect(formatDurationLabel(60, 'tr')).toBe('1 sa');
    expect(formatDurationLabel(72, 'en')).toBe('1 h 12 m');
  });
});

describe('news', () => {
  const now = new Date('2026-09-06T12:00:00.000Z').getTime();

  it('isNewsActive: yayınlanmış ve süresi dolmamış', () => {
    expect(isNewsActive(news('a'), now)).toBe(true);
    expect(isNewsActive(news('b', { expiresAt: '2026-09-06T11:00:00.000Z' }), now)).toBe(false);
    expect(isNewsActive(news('c', { expiresAt: '2026-09-07T00:00:00.000Z' }), now)).toBe(true);
    expect(isNewsActive(news('d', { publishedAt: '2026-09-08T00:00:00.000Z' }), now)).toBe(false);
  });

  it('sortNews: aktif önce, şiddet, sonra tarih', () => {
    const list = [
      news('info_old', { publishedAt: '2026-09-01T00:00:00.000Z' }),
      news('expired_critical', { severity: 'critical', expiresAt: '2026-09-05T00:00:00.000Z' }),
      news('warning', { severity: 'warning' }),
      news('critical', { severity: 'critical' }),
      news('info_new', { publishedAt: '2026-09-06T00:00:00.000Z' }),
    ];
    expect(sortNews(list, now).map((n) => n.id)).toEqual([
      'critical',
      'warning',
      'info_new',
      'info_old',
      'expired_critical',
    ]);
  });

  it('tickerText: kritik haberler SON DAKİKA önekli, süresi dolanlar yok', () => {
    const text = tickerText(
      [
        news('Kar uyarısı', { severity: 'critical' }),
        news('Festival'),
        news('Eski', { expiresAt: '2026-09-01T00:00:00.000Z' }),
      ],
      'tr',
      now,
    );
    expect(text).toBe('SON DAKİKA: Kar uyarısı  •  Festival');
    expect(tickerText([news('x', { severity: 'critical' })], 'en', now)).toBe('BREAKING: x');
  });
});

describe('recommendPrograms', () => {
  const now = new Date('2026-09-06T00:00:00.000Z').getTime();
  const list = [
    program('hike_old', { publishedAt: '2026-03-01T00:00:00.000Z' }),
    program('dive_new', { adventureTypes: ['diving'], publishedAt: '2026-09-05T00:00:00.000Z' }),
    program('ski', {
      adventureTypes: ['skiing'],
      viewsCount: 100_000,
      publishedAt: '2026-08-20T00:00:00.000Z',
    }),
    program('hike_watched', { viewsCount: 1_000_000, publishedAt: '2026-02-01T00:00:00.000Z' }),
  ];

  it('favori türü öne alır ve izlenenleri sona atar', () => {
    const rec = recommendPrograms(list, ['hiking'], ['hike_watched'], 3, now);
    expect(rec[0]?.id).toBe('hike_old');
    expect(rec.map((p) => p.id)).not.toContain('hike_watched');
  });

  it('favori yoksa yenilik ve popülerlik belirler', () => {
    const rec = recommendPrograms(list, [], [], 2, now);
    expect(rec[0]?.id).toBe('dive_new');
  });
});

describe('validateSubmission', () => {
  const valid = { title: 'Gün doğumu', videoUrl: 'https://cdn.example.com/a.mp4', durationMin: 4 };

  it('geçerli girdi', () => {
    expect(validateSubmission(valid)).toEqual({ ok: true, errors: {} });
  });

  it('başlık, URL ve süre hataları', () => {
    const r = validateSubmission({ title: 'ab', videoUrl: 'ftp://x', durationMin: 0 });
    expect(r.ok).toBe(false);
    expect(r.errors.title).toBe('tv.submit.errors.title');
    expect(r.errors.videoUrl).toBe('tv.submit.errors.url');
    expect(r.errors.durationMin).toBe('tv.submit.errors.duration');
  });

  it('http de kabul edilir; NaN ve 24 saat üstü reddedilir', () => {
    expect(validateSubmission({ ...valid, videoUrl: 'http://a.b/c' }).ok).toBe(true);
    expect(validateSubmission({ ...valid, durationMin: Number.NaN }).ok).toBe(false);
    expect(validateSubmission({ ...valid, durationMin: 24 * 60 + 1 }).ok).toBe(false);
  });
});
