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

import type { TvRepository } from '../../repositories';
import { requireUser, type RemoteContext } from '../context';
import { num, toNewsItem, toTvChannel, toTvProgram, toTvSchedule } from '../mappers';
import { maybeRow, oneRow, rows } from '../postgrest';

/** Kullanıcı yüklemelerinin düştüğü varsayılan kanal (kod ile aranır). */
const COMMUNITY_CHANNEL_NAME = 'Topluluk';

/** tv modülü uzak repository fabrikası. */
export function createTvRepository(ctx: RemoteContext): TvRepository {
  const { db } = ctx;

  const channelsById = async (ids: readonly ID[]): Promise<Map<ID, TvChannel>> => {
    if (!ids.length) return new Map();
    const data = await rows(
      db.from('tv_channels').select('*').in('id', Array.from(new Set(ids))),
      'kanallar okunamadı',
    );
    return new Map(data.map((row) => [String(row.id), toTvChannel(row)]));
  };

  const decorateMany = async (
    programs: TvProgram[],
    meId: ID,
  ): Promise<TvProgramWithChannel[]> => {
    if (!programs.length) return [];
    const ids = programs.map((p) => p.id);
    const [channels, progressRows, laterRows, likeRows] = await Promise.all([
      channelsById(programs.map((p) => p.channelId)),
      rows(
        db.from('watch_progress').select('*').eq('user_id', meId).in('program_id', ids),
        'izleme ilerlemesi okunamadı',
      ),
      rows(
        db.from('watch_later').select('program_id').eq('user_id', meId).in('program_id', ids),
        'sonra izle okunamadı',
      ),
      rows(
        db.from('program_likes').select('program_id').eq('user_id', meId).in('program_id', ids),
        'beğeniler okunamadı',
      ),
    ]);
    const progress = new Map(
      progressRows.map((row) => [
        String(row.program_id),
        progressRatio(num(row.position_sec), num(row.duration_sec)),
      ]),
    );
    const later = new Set(laterRows.map((row) => String(row.program_id)));
    const liked = new Set(likeRows.map((row) => String(row.program_id)));
    return programs.map((program) => {
      const channel = channels.get(program.channelId);
      if (!channel) throw new Error(`Kanal bulunamadı: ${program.channelId}`);
      return {
        ...program,
        channel,
        progress: progress.get(program.id) ?? 0,
        watchLater: later.has(program.id),
        likedByMe: liked.has(program.id),
      };
    });
  };

  const findProgram = async (id: ID): Promise<TvProgram> => {
    const row = await maybeRow(db.from('tv_programs').select('*').eq('id', id), 'program okunamadı');
    if (!row) throw new Error(`Program bulunamadı: ${id}`);
    return toTvProgram(row);
  };

  const oneProgram = async (id: ID, meId: ID): Promise<TvProgramWithChannel> => {
    const [result] = await decorateMany([await findProgram(id)], meId);
    if (!result) throw new Error(`Program bulunamadı: ${id}`);
    return result;
  };

  const byNewest = (a: TvProgram, b: TvProgram) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();

  return {
    async channels() {
      const data = await rows(db.from('tv_channels').select('*'), 'kanallar okunamadı');
      return data
        .map(toTvChannel)
        .sort(
          (a, b) => Number(b.isOfficial) - Number(a.isOfficial) || b.followerCount - a.followerCount,
        );
    },

    async programs(meId, filter) {
      const data = await rows(db.from('tv_programs').select('*'), 'programlar okunamadı');
      const sorted = data.map(toTvProgram).sort(byNewest);
      return await decorateMany(filterPrograms(sorted, filter), meId);
    },

    async program(meId, id) {
      const row = await maybeRow(db.from('tv_programs').select('*').eq('id', id), 'program okunamadı');
      if (!row) return null;
      const [result] = await decorateMany([toTvProgram(row)], meId);
      return result ?? null;
    },

    async schedule(from, to) {
      const data = await rows(
        db.from('tv_schedule').select('*').gt('ends_at', from).lt('starts_at', to),
        'yayın akışı okunamadı',
      );
      const schedule = data.map(toTvSchedule);
      const channels = await channelsById(schedule.map((s) => s.channelId));
      return schedule
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
        .flatMap((s) => {
          const channel = channels.get(s.channelId);
          return channel ? [{ ...s, channel }] : [];
        });
    },

    async news(category = null, countryCode = null) {
      let query = db.from('news_items').select('*');
      if (category) query = query.eq('category', category);
      if (countryCode) query = query.eq('country_code', countryCode);
      const data = await rows(query, 'haberler okunamadı');
      return sortNews(data.map(toNewsItem), Date.now());
    },

    async newsItem(id) {
      const row = await maybeRow(db.from('news_items').select('*').eq('id', id), 'haber okunamadı');
      return row ? toNewsItem(row) : null;
    },

    async saveProgress(meId, programId, positionSec, durationSec) {
      await requireUser(db, meId);
      const program = await findProgram(programId);
      const safeDuration = durationSec > 0 ? durationSec : 0;
      const safePosition = Math.max(0, Math.min(positionSec, safeDuration || positionSec));
      const existing = await maybeRow(
        db
          .from('watch_progress')
          .select('user_id')
          .eq('user_id', meId)
          .eq('program_id', programId),
        'ilerleme okunamadı',
      );
      await rows(
        db.from('watch_progress').upsert(
          {
            user_id: meId,
            program_id: programId,
            position_sec: safePosition,
            duration_sec: safeDuration,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,program_id' },
        ),
        'ilerleme kaydedilemedi',
      );
      if (!existing) {
        await rows(
          db
            .from('tv_programs')
            .update({ views_count: program.viewsCount + 1 })
            .eq('id', programId),
          'izlenme sayacı güncellenemedi',
        );
      }
    },

    async continueWatching(meId) {
      const data = await rows(
        db
          .from('watch_progress')
          .select('*')
          .eq('user_id', meId)
          .order('updated_at', { ascending: false }),
        'izleme ilerlemesi okunamadı',
      );
      const ids = data
        .filter((row) => isWatchInProgress(progressRatio(num(row.position_sec), num(row.duration_sec))))
        .map((row) => String(row.program_id));
      if (!ids.length) return [];
      const programRows = await rows(
        db.from('tv_programs').select('*').in('id', ids),
        'programlar okunamadı',
      );
      const byId = new Map(programRows.map((row) => [String(row.id), toTvProgram(row)]));
      const ordered = ids.map((id) => byId.get(id)).filter((p): p is TvProgram => Boolean(p));
      return await decorateMany(ordered, meId);
    },

    async toggleWatchLater(meId, programId) {
      await requireUser(db, meId);
      await findProgram(programId);
      const existing = await maybeRow(
        db.from('watch_later').select('program_id').eq('user_id', meId).eq('program_id', programId),
        'sonra izle okunamadı',
      );
      if (existing) {
        await rows(
          db.from('watch_later').delete().eq('user_id', meId).eq('program_id', programId),
          'sonra izle kaldırılamadı',
        );
        return false;
      }
      await rows(
        db.from('watch_later').insert({ user_id: meId, program_id: programId }),
        'sonra izle eklenemedi',
      );
      return true;
    },

    async toggleLike(meId, programId) {
      await requireUser(db, meId);
      await findProgram(programId);
      const existing = await maybeRow(
        db.from('program_likes').select('program_id').eq('user_id', meId).eq('program_id', programId),
        'beğeni okunamadı',
      );
      // `program_likes_count` tetikleyicisi sayacı günceller.
      if (existing) {
        await rows(
          db.from('program_likes').delete().eq('user_id', meId).eq('program_id', programId),
          'beğeni kaldırılamadı',
        );
      } else {
        await rows(
          db.from('program_likes').insert({ user_id: meId, program_id: programId }),
          'beğenilemedi',
        );
      }
      return await oneProgram(programId, meId);
    },

    async followChannel(meId, channelId) {
      await requireUser(db, meId);
      const channel = await maybeRow(
        db.from('tv_channels').select('id').eq('id', channelId),
        'kanal okunamadı',
      );
      if (!channel) throw new Error(`Kanal bulunamadı: ${channelId}`);
      const existing = await maybeRow(
        db.from('channel_follows').select('channel_id').eq('user_id', meId).eq('channel_id', channelId),
        'takip okunamadı',
      );
      // `channel_follows_count` tetikleyicisi sayacı günceller.
      if (existing) {
        await rows(
          db.from('channel_follows').delete().eq('user_id', meId).eq('channel_id', channelId),
          'takipten çıkılamadı',
        );
        return false;
      }
      await rows(
        db.from('channel_follows').insert({ user_id: meId, channel_id: channelId }),
        'kanal takip edilemedi',
      );
      return true;
    },

    async submitProgram(meId, input) {
      await requireUser(db, meId);
      const validation = validateSubmission(input);
      if (!validation.ok) {
        const first = Object.keys(validation.errors)[0];
        throw new Error(`Geçersiz program alanı: ${first}`);
      }
      const requested = await maybeRow(
        db.from('tv_channels').select('id').eq('id', input.channelId),
        'kanal okunamadı',
      );
      let channelId = requested ? String(requested.id) : null;
      if (!channelId) {
        const fallback = await maybeRow(
          db.from('tv_channels').select('id').eq('name', COMMUNITY_CHANNEL_NAME),
          'kanal okunamadı',
        );
        channelId = fallback ? String(fallback.id) : null;
      }
      if (!channelId) throw new Error('Kanal bulunamadı.');
      const created = await oneRow(
        db
          .from('tv_programs')
          .insert({
            channel_id: channelId,
            submitted_by: meId,
            title: input.title.trim(),
            kind: input.kind,
            description: input.description.trim(),
            thumbnail_url: input.thumbnailUrl,
            video_url: input.videoUrl.trim(),
            duration_min: Math.round(input.durationMin),
            adventure_types: input.adventureTypes,
            destination_id: input.destinationId,
            country_code: input.countryCode,
            series_title: input.seriesTitle,
            episode: input.episode,
            languages: input.languages,
            subtitles: input.subtitles,
            kids_friendly: input.kidsFriendly,
            credits_note: input.creditsNote,
            is_approved: false,
          })
          .select('*'),
        'program yüklenemedi',
      );
      return await oneProgram(String(created.id), meId);
    },
  };
}
