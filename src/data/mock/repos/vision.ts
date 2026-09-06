import { getRemoteVisionClient, type RemoteVisionClient } from '@/data/ai/remoteVision';
import { getFirstAidGuides } from '@/data/content/firstAid';
import type { VisionRepository } from '@/data/repositories';
import type { VisionAdvice, VisionHistoryItem } from '@/domain';
import { localVisionAdvice, VISION_HISTORY_LIMIT } from '@/domain';
import { generateId } from '@/core/utils/format';

import type { MockContext } from '../context';

export interface VisionRepositoryOptions {
  /** Test ve yapılandırma için: null → her zaman yerel tavsiye. Varsayılan: ortam değişkeninden. */
  remote?: RemoteVisionClient | null;
}

/** vision modülü mock repository fabrikası. */
export function createVisionRepository(
  ctx: MockContext,
  options: VisionRepositoryOptions = {},
): VisionRepository {
  const remote = options.remote === undefined ? getRemoteVisionClient() : options.remote;

  return {
    async analyze(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const now = new Date();

      let advice: VisionAdvice | null = null;
      if (remote && input.imageBase64) {
        try {
          advice = await remote.analyze(input, now);
        } catch {
          advice = null; // ağ / boyut / gateway hatası → yerel kontrol listesine düş
        }
      }
      if (!advice)
        advice = localVisionAdvice(
          input,
          {
            hazards: t.hazards,
            emergencyCenters: t.emergencyCenters,
            firstAidSlugs: getFirstAidGuides(input.locale).map((g) => g.slug),
            altitudeM: input.altitudeM,
          },
          now,
        );

      const item: VisionHistoryItem & { userId: string } = {
        ...advice,
        id: generateId('vis'),
        userId: meId,
        thumbnailUri: input.imageUri,
        question: input.question.trim(),
      };
      t.visionHistory.unshift(item);
      // Kullanıcı başına en fazla N kayıt; en eskiler düşer
      const mine = t.visionHistory.filter((h) => h.userId === meId);
      if (mine.length > VISION_HISTORY_LIMIT) {
        const drop = new Set(mine.slice(VISION_HISTORY_LIMIT).map((h) => h.id));
        for (let i = t.visionHistory.length - 1; i >= 0; i -= 1)
          if (drop.has(t.visionHistory[i]?.id ?? '')) t.visionHistory.splice(i, 1);
      }
      ctx.db.markDirty();

      const { userId: _userId, ...result } = item;
      return result;
    },

    async history(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.visionHistory
        .filter((h) => h.userId === meId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ userId: _userId, ...rest }) => rest);
    },

    async clearHistory(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      for (let i = t.visionHistory.length - 1; i >= 0; i -= 1)
        if (t.visionHistory[i]?.userId === meId) t.visionHistory.splice(i, 1);
      ctx.db.markDirty();
    },
  };
}
