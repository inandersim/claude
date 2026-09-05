import { getRemoteAiClient, type RemoteAiClient } from '@/data/ai/remoteAi';
import { getFirstAidGuides } from '@/data/content/firstAid';
import type { AiRepository } from '@/data/repositories';
import type { AiMessage, AiThread, LocalKnowledge, TripPlan } from '@/domain';
import { answerLocally, buildTripPlan, classifyIntent, summarizeThreadTitle } from '@/domain';
import { generateId } from '@/core/utils/format';

import type { MockContext } from '../context';
import type { Tables } from '../database';

export interface AiRepositoryOptions {
  /** Test ve yapılandırma için: null → her zaman yerel cevap. Varsayılan: ortam değişkeninden. */
  remote?: RemoteAiClient | null;
}

function buildKnowledge(t: Tables, locale: string): LocalKnowledge {
  return {
    places: t.library,
    hazards: t.hazards,
    emergencyCenters: t.emergencyCenters,
    firstAidSlugs: getFirstAidGuides(locale).map((g) => g.slug),
    crags: t.crags,
    businesses: t.businesses,
  };
}

function threadMessages(t: Tables, threadId: string): AiMessage[] {
  return t.aiMessages
    .filter((m) => m.threadId === threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** ai modülü mock repository fabrikası. */
export function createAiRepository(
  ctx: MockContext,
  options: AiRepositoryOptions = {},
): AiRepository {
  const remote = options.remote === undefined ? getRemoteAiClient() : options.remote;

  return {
    async threads(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.aiThreads
        .filter((th) => th.userId === meId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async thread(meId, threadId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const th = t.aiThreads.find((x) => x.id === threadId && x.userId === meId);
      if (!th) return null;
      return { ...th, messages: threadMessages(t, th.id) };
    },

    async send(meId, threadId, content, aiCtx) {
      const text = content.trim();
      if (!text) throw new Error('Boş mesaj gönderilemez.');
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);

      const now = new Date();
      let thread: AiThread | undefined = threadId
        ? t.aiThreads.find((x) => x.id === threadId && x.userId === meId)
        : undefined;
      if (threadId && !thread) throw new Error('Sohbet bulunamadı.');
      if (!thread) {
        thread = {
          id: generateId('ait'),
          userId: meId,
          title: summarizeThreadTitle(text),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        t.aiThreads.unshift(thread);
      }

      const userMessage: AiMessage = {
        id: generateId('aim'),
        threadId: thread.id,
        role: 'user',
        content: text,
        intent: classifyIntent(text, aiCtx.locale),
        actions: [],
        createdAt: now.toISOString(),
      };
      t.aiMessages.push(userMessage);

      let answer: {
        content: string;
        intent: AiMessage['intent'];
        actions: AiMessage['actions'];
      } | null = null;
      if (remote) {
        try {
          const history = threadMessages(t, thread.id).map((m) => ({
            role: m.role,
            content: m.content,
          }));
          const result = await remote.chat(history, aiCtx);
          if (result.content)
            answer = {
              content: result.content,
              intent: result.intent ?? userMessage.intent,
              actions: result.actions,
            };
        } catch {
          answer = null; // ağ hatası → yerel cevaba düş
        }
      }
      if (!answer) answer = answerLocally(text, aiCtx, buildKnowledge(t, aiCtx.locale));

      const reply: AiMessage = {
        id: generateId('aim'),
        threadId: thread.id,
        role: 'assistant',
        content: answer.content,
        intent: answer.intent,
        actions: answer.actions,
        // Kullanıcı mesajından sonra sıralansın diye 1 ms ileri
        createdAt: new Date(now.getTime() + 1).toISOString(),
      };
      t.aiMessages.push(reply);
      thread.updatedAt = reply.createdAt;
      ctx.db.markDirty();
      return reply;
    },

    async planTrip(meId, prompt, aiCtx): Promise<TripPlan> {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      if (remote) {
        try {
          return await remote.planTrip(prompt, aiCtx);
        } catch {
          // yerel plana düş
        }
      }
      return buildTripPlan(prompt, aiCtx, t.library, new Date());
    },

    async deleteThread(meId, threadId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const idx = t.aiThreads.findIndex((x) => x.id === threadId && x.userId === meId);
      if (idx === -1) throw new Error('Sohbet bulunamadı.');
      t.aiThreads.splice(idx, 1);
      for (let i = t.aiMessages.length - 1; i >= 0; i -= 1)
        if (t.aiMessages[i]?.threadId === threadId) t.aiMessages.splice(i, 1);
      ctx.db.markDirty();
    },
  };
}
