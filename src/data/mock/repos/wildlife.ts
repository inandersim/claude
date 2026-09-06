import { generateId } from '@/core/utils/format';
import { getRemoteSpeciesClient, type RemoteSpeciesClient } from '@/data/ai/remoteSpecies';
import type { WildlifeRepository } from '@/data/repositories';
import type {
  DeterrentAnimal,
  Species,
  SpeciesIdentification,
  User,
  WildlifeAnswer,
  WildlifeQuestion,
  WildlifeQuestionWithDetails,
} from '@/domain';
import {
  DETERRENT_PROFILES,
  IDENTIFICATION_HISTORY_LIMIT,
  deterrentProfile,
  filterSpecies,
  localIdentify,
  onlineHelperEstimate,
} from '@/domain';

import type { MockContext } from '../context';

export interface WildlifeRepositoryOptions {
  /** Test ve yapılandırma için: null → her zaman yerel tanımlama. Varsayılan: ortam değişkeninden. */
  remote?: RemoteSpeciesClient | null;
}

/** Soru listesinde uzman sayılan kullanıcılar: eğitmen kaydı olanlar. */
function expertIds(t: { instructors: { userId: string }[] }): Set<string> {
  return new Set(t.instructors.map((i) => i.userId));
}

/** wildlife modülü mock repository fabrikası. */
export function createWildlifeRepository(
  ctx: MockContext,
  options: WildlifeRepositoryOptions = {},
): WildlifeRepository {
  const remote = options.remote === undefined ? getRemoteSpeciesClient() : options.remote;

  const speciesMap = (list: Species[]) => new Map(list.map((s) => [s.id, s]));

  function withDetails(
    t: Awaited<ReturnType<MockContext['db']['load']>>,
    q: WildlifeQuestion,
    meId: string,
    now: number,
  ): WildlifeQuestionWithDetails {
    const species = speciesMap(t.species);
    const users = new Map<string, User>(t.users.map((u) => [u.id, u]));
    const author = ctx.requireUser(t.users, q.authorId);
    const upvoted = new Set(
      t.answerUpvotes.filter((u) => u.userId === meId).map((u) => u.answerId),
    );
    const answers = t.wildlifeAnswers
      .filter((a) => a.questionId === q.id)
      .map((a) => ({
        ...a,
        author: users.get(a.authorId) ?? author,
        species: a.speciesId ? (species.get(a.speciesId) ?? null) : null,
        upvotedByMe: upvoted.has(a.id),
      }))
      .sort((a, b) => {
        if (a.id === q.acceptedAnswerId) return -1;
        if (b.id === q.acceptedAnswerId) return 1;
        return b.upvotes - a.upvotes || a.createdAt.localeCompare(b.createdAt);
      });
    return {
      ...q,
      author,
      speciesGuess: q.speciesGuessId ? (species.get(q.speciesGuessId) ?? null) : null,
      answers,
      onlineHelpers: onlineHelperEstimate(now),
    };
  }

  function requireQuestion(t: { wildlifeQuestions: WildlifeQuestion[] }, id: string) {
    const q = t.wildlifeQuestions.find((x) => x.id === id);
    if (!q) throw new Error('Soru bulunamadı');
    return q;
  }

  return {
    async species(filter) {
      await ctx.wait();
      const t = await ctx.db.load();
      return filterSpecies(t.species, filter);
    },

    async speciesById(id) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.species.find((s) => s.id === id) ?? null;
    },

    async identify(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);

      let result: Pick<SpeciesIdentification, 'candidates' | 'advice' | 'source'> | null = null;
      if (remote && (input.imageBase64 || input.description.trim())) {
        try {
          result = await remote.identify(input, t.species);
        } catch {
          result = null; // ağ / boyut / gateway hatası → yerel tahmine düş
        }
      }
      if (!result) result = localIdentify(input.description, input.coords, t.species);

      const item: SpeciesIdentification = {
        id: generateId('ident'),
        userId: meId,
        imageUri: input.imageUri,
        candidates: result.candidates,
        advice: result.advice,
        source: result.source,
        coords: input.coords,
        createdAt: new Date().toISOString(),
      };
      t.identifications.unshift(item);
      const mine = t.identifications.filter((h) => h.userId === meId);
      if (mine.length > IDENTIFICATION_HISTORY_LIMIT) {
        const drop = new Set(mine.slice(IDENTIFICATION_HISTORY_LIMIT).map((h) => h.id));
        for (let i = t.identifications.length - 1; i >= 0; i -= 1)
          if (drop.has(t.identifications[i]?.id ?? '')) t.identifications.splice(i, 1);
      }
      ctx.db.markDirty();
      return item;
    },

    async identifications(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.identifications
        .filter((h) => h.userId === meId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async questions(meId, filter = {}) {
      await ctx.wait();
      const t = await ctx.db.load();
      const now = Date.now();
      return t.wildlifeQuestions
        .filter((q) => {
          if (filter.status && q.status !== filter.status) return false;
          if (filter.urgentOnly && !q.urgent) return false;
          if (filter.mineOnly && q.authorId !== meId) return false;
          return true;
        })
        .sort((a, b) => {
          const aHot = a.urgent && a.status !== 'resolved' ? 1 : 0;
          const bHot = b.urgent && b.status !== 'resolved' ? 1 : 0;
          return bHot - aHot || b.createdAt.localeCompare(a.createdAt);
        })
        .map((q) => withDetails(t, q, meId, now));
    },

    async question(meId, id) {
      await ctx.wait();
      const t = await ctx.db.load();
      const q = t.wildlifeQuestions.find((x) => x.id === id);
      return q ? withDetails(t, q, meId, Date.now()) : null;
    },

    async ask(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const title = input.title.trim();
      if (!title) throw new Error('Başlık gerekli');
      if (input.speciesGuessId && !t.species.some((s) => s.id === input.speciesGuessId))
        throw new Error('Tür bulunamadı');
      const q: WildlifeQuestion = {
        id: generateId('wq'),
        authorId: meId,
        title: title.slice(0, 120),
        body: input.body.trim().slice(0, 2000),
        imageUrl: input.imageUrl,
        coords: input.coords,
        locationName: input.locationName.trim().slice(0, 80),
        speciesGuessId: input.speciesGuessId,
        // Acil sorular da yalnızca kayıt olur; tehlike bildirimi gönderilmez
        status: 'open',
        urgent: Boolean(input.urgent),
        answersCount: 0,
        acceptedAnswerId: null,
        createdAt: new Date().toISOString(),
      };
      t.wildlifeQuestions.unshift(q);
      ctx.db.markDirty();
      return withDetails(t, q, meId, Date.now());
    },

    async answer(meId, questionId, body, speciesId = null) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const q = requireQuestion(t, questionId);
      const text = body.trim();
      if (!text) throw new Error('Cevap boş olamaz');
      if (speciesId && !t.species.some((s) => s.id === speciesId))
        throw new Error('Tür bulunamadı');
      const a: WildlifeAnswer = {
        id: generateId('wa'),
        questionId,
        authorId: meId,
        body: text.slice(0, 2000),
        speciesId,
        upvotes: 0,
        isExpert: expertIds(t).has(meId),
        createdAt: new Date().toISOString(),
      };
      t.wildlifeAnswers.push(a);
      q.answersCount += 1;
      if (q.status === 'open') q.status = 'answered';
      ctx.db.markDirty();
      if (q.authorId !== meId)
        await ctx.pushNotification({
          type: 'comment',
          senderId: meId,
          receiverId: q.authorId,
          message: text.slice(0, 120),
          postId: null,
          matchId: null,
          targetId: q.id,
        });
      return withDetails(t, q, meId, Date.now());
    },

    async upvote(meId, answerId) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const a = t.wildlifeAnswers.find((x) => x.id === answerId);
      if (!a) throw new Error('Cevap bulunamadı');
      const already = t.answerUpvotes.some((u) => u.userId === meId && u.answerId === answerId);
      if (!already) {
        t.answerUpvotes.push({ userId: meId, answerId });
        a.upvotes += 1;
        ctx.db.markDirty();
      }
      return a;
    },

    async accept(meId, questionId, answerId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const q = requireQuestion(t, questionId);
      if (q.authorId !== meId) throw new Error('Yalnızca soru sahibi cevabı kabul edebilir');
      const a = t.wildlifeAnswers.find((x) => x.id === answerId && x.questionId === questionId);
      if (!a) throw new Error('Cevap bulunamadı');
      q.acceptedAnswerId = answerId;
      q.status = 'resolved';
      ctx.db.markDirty();
      return withDetails(t, q, meId, Date.now());
    },

    async deterrents() {
      await ctx.wait();
      return DETERRENT_PROFILES;
    },

    async deterrent(animal: DeterrentAnimal) {
      await ctx.wait();
      return deterrentProfile(animal);
    },

    async logDeterrent(meId, animal, sound, coords, durationS) {
      await ctx.wait();
      const t = await ctx.db.load();
      ctx.requireUser(t.users, meId);
      const event = {
        id: generateId('det'),
        userId: meId,
        animal,
        sound,
        coords,
        durationS: Math.max(0, Math.round(durationS)),
        createdAt: new Date().toISOString(),
      };
      t.deterrentEvents.unshift(event);
      ctx.db.markDirty();
      return event;
    },

    async onlineHelpers() {
      await ctx.wait();
      const t = await ctx.db.load();
      const ids = [...expertIds(t)].slice(0, 3);
      const experts = ids
        .map((id) => t.users.find((u) => u.id === id))
        .filter((u): u is User => Boolean(u));
      return { count: onlineHelperEstimate(Date.now()), experts };
    },
  };
}
