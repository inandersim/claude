import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const me = CURRENT_USER_ID;

describe('TV provider', () => {
  it('kanallar, programlar ve zenginleştirme', async () => {
    const p = make();
    const channels = await p.tv.channels();
    expect(channels.length).toBe(6);
    expect(channels[0]?.isOfficial).toBe(true);

    const programs = await p.tv.programs(me, {});
    expect(programs.length).toBe(24);
    const kackar = programs.find((x) => x.id === 'p_kackar_1')!;
    expect(kackar.channel.name).toBe('Zirtan Belgesel');
    expect(kackar.progress).toBeCloseTo(0.4, 2);
    expect(kackar.watchLater).toBe(false);
    expect(kackar.likedByMe).toBe(false);

    const tutorials = await p.tv.programs(me, { kind: 'tutorial' });
    expect(tutorials.every((x) => x.kind === 'tutorial')).toBe(true);
    expect(await p.tv.program(me, 'yok')).toBeNull();
  });

  it('haberler aktif önce ve şiddet sıralı; kategori filtresi', async () => {
    const p = make();
    const all = await p.tv.news();
    expect(all.length).toBe(14);
    expect(all[0]?.severity).toBe('critical');
    const expiredIdx = all.findIndex((n) => n.id === 'n_medyuz');
    const lastActiveInfoIdx = all.findIndex((n) => n.id === 'n_buzul_bilim');
    expect(expiredIdx).toBeGreaterThan(lastActiveInfoIdx);

    const weather = await p.tv.news('weather');
    expect(weather.every((n) => n.category === 'weather')).toBe(true);
    expect((await p.tv.newsItem('n_kackar_kar'))?.sourceName).toBe('MGM');
  });

  it('saveProgress / continueWatching: %5–%95 aralığı, %95 üstü tamamlandı', async () => {
    const p = make();
    const before = await p.tv.continueWatching(me);
    expect(before.map((x) => x.id)).toEqual(['p_kackar_1', 'p_himalaya']);

    await p.tv.saveProgress(me, 'p_cig', 60, 3120); // %2 → listeye girmez
    expect((await p.tv.continueWatching(me)).map((x) => x.id)).not.toContain('p_cig');

    await p.tv.saveProgress(me, 'p_cig', 1500, 3120); // %48
    const mid = await p.tv.continueWatching(me);
    expect(mid[0]?.id).toBe('p_cig');
    expect((await p.tv.program(me, 'p_cig'))?.progress).toBeCloseTo(1500 / 3120, 3);

    await p.tv.saveProgress(me, 'p_cig', 3100, 3120); // %99 → tamamlandı
    expect((await p.tv.continueWatching(me)).map((x) => x.id)).not.toContain('p_cig');
    await expect(p.tv.saveProgress(me, 'yok', 1, 10)).rejects.toThrow();
  });

  it('toggleWatchLater ve toggleLike', async () => {
    const p = make();
    expect(await p.tv.toggleWatchLater(me, 'p_himalaya')).toBe(true);
    expect((await p.tv.program(me, 'p_himalaya'))?.watchLater).toBe(true);
    expect(await p.tv.toggleWatchLater(me, 'p_himalaya')).toBe(false);

    const base = (await p.tv.program(me, 'p_himalaya'))!.likesCount;
    const liked = await p.tv.toggleLike(me, 'p_himalaya');
    expect(liked.likedByMe).toBe(true);
    expect(liked.likesCount).toBe(base + 1);
    const unliked = await p.tv.toggleLike(me, 'p_himalaya');
    expect(unliked.likedByMe).toBe(false);
    expect(unliked.likesCount).toBe(base);
  });

  it('followChannel takipçi sayısını günceller', async () => {
    const p = make();
    const before = (await p.tv.channels()).find((c) => c.id === 'ch_doga')!.followerCount;
    expect(await p.tv.followChannel(me, 'ch_doga')).toBe(true);
    expect((await p.tv.channels()).find((c) => c.id === 'ch_doga')!.followerCount).toBe(before + 1);
    expect(await p.tv.followChannel(me, 'ch_doga')).toBe(false);
    await expect(p.tv.followChannel(me, 'yok')).rejects.toThrow();
  });

  it('submitProgram doğrular ve Topluluk kanalına ekler', async () => {
    const p = make();
    const input = {
      channelId: 'olmayan',
      title: 'Ayder gün doğumu',
      kind: 'short' as const,
      description: 'Drone',
      thumbnailUrl: null,
      videoUrl: 'https://example.com/v.mp4',
      durationMin: 3,
      adventureTypes: ['hiking' as const],
      destinationId: null,
      countryCode: 'TR',
      seriesTitle: null,
      episode: null,
      languages: ['tr'],
      subtitles: [],
      kidsFriendly: true,
      creditsNote: 'CC BY',
    };
    const created = await p.tv.submitProgram(me, input);
    expect(created.channel.id).toBe('ch_topluluk');
    expect(created.viewsCount).toBe(0);
    expect(created.progress).toBe(0);
    expect((await p.tv.programs(me, { channelId: 'ch_topluluk' }))[0]?.id).toBe(created.id);

    await expect(p.tv.submitProgram(me, { ...input, videoUrl: 'notaurl' })).rejects.toThrow();
    await expect(p.tv.submitProgram(me, { ...input, durationMin: 0 })).rejects.toThrow();
  });

  it('schedule aralığa göre filtreler ve kanal ekler', async () => {
    const p = make();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 2);
    const list = await p.tv.schedule(from.toISOString(), to.toISOString());
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(list.every((s) => Boolean(s.channel))).toBe(true);
    const live = list.find((s) => s.streamId === 's1');
    expect(live?.channel.kind).toBe('live');
  });
});
