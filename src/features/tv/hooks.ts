import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { TvRepository } from '@/data/repositories';
import {
  tvDayKey,
  type ID,
  type NewsCategory,
  type TvFilter,
  type TvProgramWithChannel,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useTvChannels() {
  return useQuery({
    queryKey: queryKeys.tv.channels,
    queryFn: () => getDataProvider().tv.channels(),
  });
}

export function useTvPrograms(filter: TvFilter) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.tv.programs(me.id, filter),
    queryFn: () => getDataProvider().tv.programs(me.id, filter),
    placeholderData: (prev) => prev,
  });
}

export function useTvProgram(id: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.tv.program(me.id, id),
    queryFn: () => getDataProvider().tv.program(me.id, id),
    enabled: Boolean(id),
  });
}

/** Verilen günün (YYYY-MM-DD, yerel) yayın akışı. */
export function useTvSchedule(day: string) {
  return useQuery({
    queryKey: queryKeys.tv.schedule(day),
    queryFn: () => {
      const [y, m, d] = day.split('-').map(Number);
      const from = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      return getDataProvider().tv.schedule(from.toISOString(), to.toISOString());
    },
    refetchInterval: 60_000,
  });
}

/** Bugünün anahtarı — render içinde Date.now() çağırmamak için hook. */
export function useTodayKey(offsetDays = 0): string {
  const [key] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return tvDayKey(d);
  });
  return key;
}

export function useNews(category: NewsCategory | null = null, countryCode: string | null = null) {
  return useQuery({
    queryKey: queryKeys.tv.news(category, countryCode),
    queryFn: () => getDataProvider().tv.news(category, countryCode),
    refetchInterval: 120_000,
  });
}

export function useNewsItem(id: ID) {
  return useQuery({
    queryKey: [...queryKeys.tv.all, 'newsItem', id] as const,
    queryFn: () => getDataProvider().tv.newsItem(id),
    enabled: Boolean(id),
  });
}

const PROGRESS_THROTTLE_MS = 5_000;

/**
 * İzleme ilerlemesini en fazla 5 sn'de bir kaydeder; `flush` son konumu hemen yazar.
 * Kayıt sonrası "izlemeye devam et" ve program sorguları tazelenir.
 */
export function useSaveProgress(programId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const lastSavedAt = useRef(0);
  const pending = useRef<{ positionSec: number; durationSec: number } | null>(null);

  const persist = useCallback(
    async (positionSec: number, durationSec: number) => {
      lastSavedAt.current = Date.now();
      pending.current = null;
      await getDataProvider().tv.saveProgress(me.id, programId, positionSec, durationSec);
      qc.invalidateQueries({ queryKey: queryKeys.tv.continueWatching(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.tv.program(me.id, programId) });
    },
    [me.id, programId, qc],
  );

  const save = useCallback(
    (positionSec: number, durationSec: number) => {
      if (!Number.isFinite(positionSec) || !Number.isFinite(durationSec) || durationSec <= 0)
        return;
      pending.current = { positionSec, durationSec };
      if (Date.now() - lastSavedAt.current < PROGRESS_THROTTLE_MS) return;
      persist(positionSec, durationSec).catch(() => undefined);
    },
    [persist],
  );

  const flush = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    persist(p.positionSec, p.durationSec).catch(() => undefined);
  }, [persist]);

  // Ekran kapanırken bekleyen konumu yaz.
  useEffect(() => flush, [flush]);

  return { save, flush };
}

export function useContinueWatching() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.tv.continueWatching(me.id),
    queryFn: () => getDataProvider().tv.continueWatching(me.id),
  });
}

export function useToggleWatchLater() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (programId: ID) => getDataProvider().tv.toggleWatchLater(me.id, programId),
    onMutate: async (programId) => {
      const key = queryKeys.tv.program(me.id, programId);
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<TvProgramWithChannel | null>(key, (p) =>
        p ? { ...p, watchLater: !p.watchLater } : p,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tv.all }),
  });
}

export function useToggleProgramLike() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (programId: ID) => getDataProvider().tv.toggleLike(me.id, programId),
    onMutate: async (programId) => {
      const key = queryKeys.tv.program(me.id, programId);
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<TvProgramWithChannel | null>(key, (p) =>
        p
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              likesCount: Math.max(0, p.likesCount + (p.likedByMe ? -1 : 1)),
            }
          : p,
      );
    },
    onSuccess: (program) => {
      qc.setQueryData(queryKeys.tv.program(me.id, program.id), program);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.tv.all }),
  });
}

export function useFollowChannel() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: ID) => getDataProvider().tv.followChannel(me.id, channelId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tv.channels }),
  });
}

export type SubmitProgramInput = Parameters<TvRepository['submitProgram']>[1];

export function useSubmitProgram() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitProgramInput) => getDataProvider().tv.submitProgram(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tv.all }),
  });
}

/** Şu an `live` durumundaki topluluk yayınları. */
export function useLiveNow() {
  return useQuery({
    queryKey: queryKeys.live.list,
    queryFn: () => getDataProvider().live.list(),
    refetchInterval: 20_000,
    select: (streams) => streams.filter((s) => s.status === 'live'),
  });
}
