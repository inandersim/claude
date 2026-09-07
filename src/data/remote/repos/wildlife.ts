import { getRemoteSpeciesClient, type RemoteSpeciesClient } from '@/data/ai/remoteSpecies';
import {
  DETERRENT_PROFILES,
  IDENTIFICATION_HISTORY_LIMIT,
  deterrentProfile,
  filterSpecies,
  localIdentify,
  onlineHelperEstimate,
  type DeterrentAnimal,
  type ID,
  type Species,
  type SpeciesIdentification,
  type User,
  type WildlifeQuestion,
  type WildlifeQuestionWithDetails,
} from '@/domain';

import type { WildlifeRepository } from '../../repositories';
import { fetchUsers, medyaAdresi, notify, pickUser, requireUser, type RemoteContext } from '../context';
import {
  fromGeoPoint,
  toDeterrentEvent,
  toSpecies,
  toSpeciesIdentification,
  toWildlifeAnswer,
  toWildlifeQuestion,
} from '../mappers';
import { maybeRow, oneRow, rows } from '../postgrest';

export interface WildlifeRepositoryOptions {
  /** Test ve yapılandırma için: null → her zaman yerel tanımlama. */
  remote?: RemoteSpeciesClient | null;
}

/** wildlife modülü uzak repository fabrikası. */
export function createWildlifeRepository(
  ctx: RemoteContext,
  options: WildlifeRepositoryOptions = {},
): WildlifeRepository {
  const { db } = ctx;
  const remote = options.remote === undefined ? getRemoteSpeciesClient() : options.remote;

  const allSpecies = async (): Promise<Species[]> => {
    const data = await rows(db.from('species').select('*'), 'türler okunamadı');
    return data.map(toSpecies);
  };

  /** Soru listesinde uzman sayılan kullanıcılar: eğitmen kaydı olanlar. */
  const expertIds = async (): Promise<Set<ID>> => {
    const data = await rows(db.from('instructors').select('user_id'), 'eğitmenler okunamadı');
    return new Set(data.map((row) => String(row.user_id)));
  };

  const withDetails = async (
    questions: WildlifeQuestion[],
    meId: ID,
    now: number,
  ): Promise<WildlifeQuestionWithDetails[]> => {
    if (!questions.length) return [];
    const ids = questions.map((q) => q.id);
    const answerRows = await rows(
      db.from('wildlife_answers').select('*').in('question_id', ids),
      'cevaplar okunamadı',
    );
    const answers = answerRows.map(toWildlifeAnswer);
    const upvoteRows = answers.length
      ? await rows(
          db
            .from('answer_upvotes')
            .select('answer_id')
            .eq('user_id', meId)
            .in('answer_id', answers.map((a) => a.id)),
          'oylar okunamadı',
        )
      : [];
    const upvoted = new Set(upvoteRows.map((row) => String(row.answer_id)));
    const speciesIds = [
      ...questions.map((q) => q.speciesGuessId),
      ...answers.map((a) => a.speciesId),
    ].filter((id): id is ID => Boolean(id));
    const speciesRows = speciesIds.length
      ? await rows(db.from('species').select('*').in('id', speciesIds), 'türler okunamadı')
      : [];
    const species = new Map(speciesRows.map((row) => [String(row.id), toSpecies(row)]));
    const users = await fetchUsers(db, [
      ...questions.map((q) => q.authorId),
      ...answers.map((a) => a.authorId),
    ]);
    const helpers = onlineHelperEstimate(now);

    return questions.map((q) => {
      const author = pickUser(users, q.authorId);
      const mine = answers
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
        answers: mine,
        onlineHelpers: helpers,
      };
    });
  };

  const requireQuestion = async (id: ID): Promise<WildlifeQuestion> => {
    const row = await maybeRow(
      db.from('wildlife_questions').select('*').eq('id', id),
      'soru okunamadı',
    );
    if (!row) throw new Error('Soru bulunamadı');
    return toWildlifeQuestion(row);
  };

  const oneQuestion = async (id: ID, meId: ID): Promise<WildlifeQuestionWithDetails> => {
    const [result] = await withDetails([await requireQuestion(id)], meId, Date.now());
    if (!result) throw new Error('Soru bulunamadı');
    return result;
  };

  return {
    async species(filter) {
      return filterSpecies(await allSpecies(), filter);
    },

    async speciesById(id) {
      const row = await maybeRow(db.from('species').select('*').eq('id', id), 'tür okunamadı');
      return row ? toSpecies(row) : null;
    },

    async identify(meId, input) {
      await requireUser(db, meId);
      const species = await allSpecies();

      let result: Pick<SpeciesIdentification, 'candidates' | 'advice' | 'source'> | null = null;
      if (remote && (input.imageBase64 || input.description.trim())) {
        try {
          result = await remote.identify(input, species);
        } catch {
          result = null; // ağ / boyut / gateway hatası → yerel tahmine düş
        }
      }
      if (!result) result = localIdentify(input.description, input.coords, species);

      const created = await oneRow(
        db
          .from('species_identifications')
          .insert({
            user_id: meId,
            image_uri: await medyaAdresi(ctx, 'species-photos', meId, input.imageUri),
            candidates: result.candidates,
            advice: result.advice,
            source: result.source,
            coords: fromGeoPoint(input.coords),
          })
          .select('*'),
        'tanımlama kaydedilemedi',
      );
      // Kullanıcı başına en fazla N kayıt; en eskiler düşer.
      const mine = await rows(
        db
          .from('species_identifications')
          .select('id')
          .eq('user_id', meId)
          .order('created_at', { ascending: false }),
        'tanımlamalar okunamadı',
      );
      const drop = mine.slice(IDENTIFICATION_HISTORY_LIMIT).map((row) => String(row.id));
      if (drop.length) {
        await rows(
          db.from('species_identifications').delete().in('id', drop),
          'eski tanımlamalar silinemedi',
        );
      }
      return toSpeciesIdentification(created);
    },

    async identifications(meId) {
      const data = await rows(
        db
          .from('species_identifications')
          .select('*')
          .eq('user_id', meId)
          .order('created_at', { ascending: false }),
        'tanımlamalar okunamadı',
      );
      return data.map(toSpeciesIdentification);
    },

    async questions(meId, filter = {}) {
      let query = db.from('wildlife_questions').select('*');
      if (filter.status) query = query.eq('status', filter.status);
      if (filter.urgentOnly) query = query.is('urgent', true);
      if (filter.mineOnly) query = query.eq('author_id', meId);
      const data = await rows(query, 'sorular okunamadı');
      const questions = data.map(toWildlifeQuestion).sort((a, b) => {
        const aHot = a.urgent && a.status !== 'resolved' ? 1 : 0;
        const bHot = b.urgent && b.status !== 'resolved' ? 1 : 0;
        return bHot - aHot || b.createdAt.localeCompare(a.createdAt);
      });
      return await withDetails(questions, meId, Date.now());
    },

    async question(meId, id) {
      const row = await maybeRow(
        db.from('wildlife_questions').select('*').eq('id', id),
        'soru okunamadı',
      );
      if (!row) return null;
      const [result] = await withDetails([toWildlifeQuestion(row)], meId, Date.now());
      return result ?? null;
    },

    async ask(meId, input) {
      await requireUser(db, meId);
      const title = input.title.trim();
      if (!title) throw new Error('Başlık gerekli');
      if (input.speciesGuessId) {
        const exists = await maybeRow(
          db.from('species').select('id').eq('id', input.speciesGuessId),
          'tür okunamadı',
        );
        if (!exists) throw new Error('Tür bulunamadı');
      }
      const created = await oneRow(
        db
          .from('wildlife_questions')
          .insert({
            author_id: meId,
            title: title.slice(0, 120),
            body: input.body.trim().slice(0, 2000),
            image_url: input.imageUrl,
            coords: fromGeoPoint(input.coords),
            location_name: input.locationName.trim().slice(0, 80),
            species_guess_id: input.speciesGuessId,
            status: 'open',
            urgent: Boolean(input.urgent),
          })
          .select('*'),
        'soru sorulamadı',
      );
      return await oneQuestion(String(created.id), meId);
    },

    async answer(meId, questionId, body, speciesId = null) {
      await requireUser(db, meId);
      const question = await requireQuestion(questionId);
      const text = body.trim();
      if (!text) throw new Error('Cevap boş olamaz');
      if (speciesId) {
        const exists = await maybeRow(
          db.from('species').select('id').eq('id', speciesId),
          'tür okunamadı',
        );
        if (!exists) throw new Error('Tür bulunamadı');
      }
      const experts = await expertIds();
      // `wildlife_answers_count` tetikleyicisi sayacı günceller.
      await rows(
        db.from('wildlife_answers').insert({
          question_id: questionId,
          author_id: meId,
          body: text.slice(0, 2000),
          species_id: speciesId,
          is_expert: experts.has(meId),
        }),
        'cevap yazılamadı',
      );
      if (question.status === 'open') {
        await rows(
          db.from('wildlife_questions').update({ status: 'answered' }).eq('id', questionId),
          'soru durumu güncellenemedi',
        );
      }
      if (question.authorId !== meId) {
        await notify(db, {
          type: 'comment',
          senderId: meId,
          receiverId: question.authorId,
          message: text.slice(0, 120),
          postId: null,
          matchId: null,
          targetId: question.id,
        });
      }
      return await oneQuestion(questionId, meId);
    },

    async upvote(meId, answerId) {
      await requireUser(db, meId);
      const row = await maybeRow(
        db.from('wildlife_answers').select('*').eq('id', answerId),
        'cevap okunamadı',
      );
      if (!row) throw new Error('Cevap bulunamadı');
      const existing = await maybeRow(
        db.from('answer_upvotes').select('answer_id').eq('user_id', meId).eq('answer_id', answerId),
        'oy okunamadı',
      );
      // `answer_upvotes_count` tetikleyicisi sayacı günceller.
      if (!existing) {
        await rows(
          db.from('answer_upvotes').insert({ user_id: meId, answer_id: answerId }),
          'oy verilemedi',
        );
      }
      const fresh = await oneRow(
        db.from('wildlife_answers').select('*').eq('id', answerId),
        'cevap okunamadı',
      );
      return toWildlifeAnswer(fresh);
    },

    async accept(meId, questionId, answerId) {
      const question = await requireQuestion(questionId);
      if (question.authorId !== meId) throw new Error('Yalnızca soru sahibi cevabı kabul edebilir');
      const answer = await maybeRow(
        db
          .from('wildlife_answers')
          .select('id')
          .eq('id', answerId)
          .eq('question_id', questionId),
        'cevap okunamadı',
      );
      if (!answer) throw new Error('Cevap bulunamadı');
      await rows(
        db
          .from('wildlife_questions')
          .update({ accepted_answer_id: answerId, status: 'resolved' })
          .eq('id', questionId),
        'cevap kabul edilemedi',
      );
      return await oneQuestion(questionId, meId);
    },

    async deterrents() {
      // Kaçırma profilleri şemada da vardır; kaynak doğruluğu için domain sabiti kullanılır.
      return DETERRENT_PROFILES;
    },

    async deterrent(animal: DeterrentAnimal) {
      return deterrentProfile(animal);
    },

    async logDeterrent(meId, animal, sound, coords, durationS) {
      await requireUser(db, meId);
      const created = await oneRow(
        db
          .from('deterrent_events')
          .insert({
            user_id: meId,
            animal,
            sound,
            coords: fromGeoPoint(coords),
            duration_s: Math.max(0, Math.round(durationS)),
          })
          .select('*'),
        'kaçırma kaydı yazılamadı',
      );
      return toDeterrentEvent(created);
    },

    async onlineHelpers() {
      const ids = Array.from(await expertIds()).slice(0, 3);
      const users = await fetchUsers(db, ids);
      const experts = ids
        .map((id) => users.get(id))
        .filter((u): u is User => Boolean(u));
      return { count: onlineHelperEstimate(Date.now()), experts };
    },
  };
}
