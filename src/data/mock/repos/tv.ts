import { generateId } from '@/core/utils/format';
import type { TvRepository } from '@/data/repositories';
import {
  filterPrograms,
  isWatchInProgress,
  progressRatio,
  sortNews,
  validateSubmission,
  type ID,
  type TvChannel,
  type TvProgram,
  type TvProgramWithChannel,
} from '@/domain';

import type { MockContext } from '../context';
import type { Tables } from '../database';

const COMMUNITY_CHANNEL_ID = 'ch_topluluk';

/**
 * tv modülü mock repository fabrikası.
 *
 * - Programlar kanal, ilerleme, sonra-izle ve beğeni bilgisiyle zenginleştirilir.
 * - Haberler: aktif olanlar önce, şiddet sırasına göre (kritik > uyarı > bilgi).
 * - İlerleme %95 üstünde tamamlandı sayılır; "izlemeye devam et" %5–%95 aralığıdır.
 * - Gönderilen programlar doğrulanır ve varsayılan olarak Topluluk kanalına eklenir.
 */
export function createTvRepository(ctx: MockContext): TvRepository {
  const { db, wait, requireUser } = ctx;

  const findChannel = (t: Tables, id: ID): TvChannel => {
    const channel = t.tvChannels.find((c) => c.id === id);
    if (!channel) throw new Error(`Kanal bulunamadı: ${id}`);
    return channel;
  };

  const findProgram = (t: Tables, id: ID): TvProgram => {
    const program = t.tvPrograms.find((p) => p.id === id);
    if (!program) throw new Error(`Program bulunamadı: ${id}`);
    return program;
  };

  const decorate = (t: Tables, program: TvProgram, meId: ID): TvProgramWithChannel => {
    const wp = t.watchProgress.find((w) => w.userId === meId && w.programId === program.id);
    return {
      ...program,
      channel: findChannel(t, program.channelId),
      progress: wp ? progressRatio(wp.positionSec, wp.durationSec) : 0,
      watchLater: t.watchLater.some((w) => w.userId === meId && w.programId === program.id),
      likedByMe: t.programLikes.some((l) => l.userId === meId && l.programId === program.id),
    };
  };

  const byNewest = (a: TvProgram, b: TvProgram) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();

  return {
    async channels() {
      await wait();
      const t = await db.load();
      return [...t.tvChannels].sort(
        (a, b) => Number(b.isOfficial) - Number(a.isOfficial) || b.followerCount - a.followerCount,
      );
    },

    async programs(meId, filter) {
      await wait();
      const t = await db.load();
      const sorted = [...t.tvPrograms].sort(byNewest);
      return filterPrograms(sorted, filter).map((p) => decorate(t, p, meId));
    },

    async program(meId, id) {
      await wait();
      const t = await db.load();
      const program = t.tvPrograms.find((p) => p.id === id);
      return program ? decorate(t, program, meId) : null;
    },

    async schedule(from, to) {
      await wait();
      const t = await db.load();
      const fromTs = new Date(from).getTime();
      const toTs = new Date(to).getTime();
      return t.tvSchedule
        .filter((s) => {
          const start = new Date(s.startsAt).getTime();
          const end = new Date(s.endsAt).getTime();
          return end > fromTs && start < toTs;
        })
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .map((s) => ({ ...s, channel: findChannel(t, s.channelId) }));
    },

    async news(category = null, countryCode = null) {
      await wait();
      const t = await db.load();
      const list = t.news.filter(
        (n) =>
          (!category || n.category === category) && (!countryCode || n.countryCode === countryCode),
      );
      return sortNews(list, Date.now());
    },

    async newsItem(id) {
      await wait();
      const t = await db.load();
      return t.news.find((n) => n.id === id) ?? null;
    },

    async saveProgress(meId, programId, positionSec, durationSec) {
      const t = await db.load();
      requireUser(t.users, meId);
      findProgram(t, programId);
      const safeDuration = durationSec > 0 ? durationSec : 0;
      const safePosition = Math.max(0, Math.min(positionSec, safeDuration || positionSec));
      const existing = t.watchProgress.find((w) => w.userId === meId && w.programId === programId);
      const updatedAt = new Date().toISOString();
      if (existing) {
        existing.positionSec = safePosition;
        existing.durationSec = safeDuration;
        existing.updatedAt = updatedAt;
      } else {
        t.watchProgress.push({
          userId: meId,
          programId,
          positionSec: safePosition,
          durationSec: safeDuration,
          updatedAt,
        });
        const program = findProgram(t, programId);
        program.viewsCount += 1;
      }
      db.markDirty();
    },

    async continueWatching(meId) {
      await wait();
      const t = await db.load();
      return t.watchProgress
        .filter(
          (w) =>
            w.userId === meId && isWatchInProgress(progressRatio(w.positionSec, w.durationSec)),
        )
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((w) => t.tvPrograms.find((p) => p.id === w.programId))
        .filter((p): p is TvProgram => Boolean(p))
        .map((p) => decorate(t, p, meId));
    },

    async toggleWatchLater(meId, programId) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      findProgram(t, programId);
      const idx = t.watchLater.findIndex((w) => w.userId === meId && w.programId === programId);
      const added = idx === -1;
      if (added) t.watchLater.push({ userId: meId, programId });
      else t.watchLater.splice(idx, 1);
      db.markDirty();
      return added;
    },

    async toggleLike(meId, programId) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const program = findProgram(t, programId);
      const idx = t.programLikes.findIndex((l) => l.userId === meId && l.programId === programId);
      if (idx === -1) {
        t.programLikes.push({ userId: meId, programId });
        program.likesCount += 1;
      } else {
        t.programLikes.splice(idx, 1);
        program.likesCount = Math.max(0, program.likesCount - 1);
      }
      db.markDirty();
      return decorate(t, program, meId);
    },

    async followChannel(meId, channelId) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const channel = findChannel(t, channelId);
      const idx = t.channelFollows.findIndex((f) => f.userId === meId && f.channelId === channelId);
      const following = idx === -1;
      if (following) {
        t.channelFollows.push({ userId: meId, channelId });
        channel.followerCount += 1;
      } else {
        t.channelFollows.splice(idx, 1);
        channel.followerCount = Math.max(0, channel.followerCount - 1);
      }
      db.markDirty();
      return following;
    },

    async submitProgram(meId, input) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const validation = validateSubmission(input);
      if (!validation.ok) {
        const first = Object.keys(validation.errors)[0];
        throw new Error(`Geçersiz program alanı: ${first}`);
      }
      const channelId = t.tvChannels.some((c) => c.id === input.channelId)
        ? input.channelId
        : COMMUNITY_CHANNEL_ID;
      findChannel(t, channelId);
      const program: TvProgram = {
        ...input,
        id: generateId('prog'),
        channelId,
        title: input.title.trim(),
        videoUrl: input.videoUrl.trim(),
        description: input.description.trim(),
        durationMin: Math.round(input.durationMin),
        publishedAt: new Date().toISOString(),
        viewsCount: 0,
        likesCount: 0,
      };
      t.tvPrograms.push(program);
      db.markDirty();
      return decorate(t, program, meId);
    },
  };
}
