import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import {
  spinRoulette,
  type AdventureType,
  type GeoPoint,
  type ID,
  type LeaderboardScope,
  type RouletteSuggestion,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useFunSummary() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.fun.summary(me.id),
    queryFn: () => getDataProvider().fun.summary(me.id),
  });
}

export function useBadges() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.fun.badges(me.id),
    queryFn: () => getDataProvider().fun.badges(me.id),
  });
}

export function useChallenges() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.fun.challenges(me.id),
    queryFn: () => getDataProvider().fun.challenges(me.id),
  });
}

export function useJoinChallenge() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: ID) => getDataProvider().fun.joinChallenge(me.id, challengeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fun.challenges(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.fun.summary(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.fun.badges(me.id) });
    },
  });
}

export function useLeaderboard(scope: LeaderboardScope) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.fun.leaderboard(me.id, scope),
    queryFn: () => getDataProvider().fun.leaderboard(me.id, scope),
    placeholderData: (prev) => prev,
  });
}

export function useQuiz(count = 5) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.fun.quiz(me.id),
    queryFn: () => getDataProvider().fun.quiz(me.id, count),
    staleTime: 60 * 60 * 1000,
  });
}

export function useSubmitQuiz() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answers: { questionId: ID; answerIndex: number }[]) =>
      getDataProvider().fun.submitQuiz(me.id, answers),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fun.summary(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.fun.xp(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.fun.badges(me.id) });
      qc.invalidateQueries({ queryKey: queryKeys.fun.leaderboard(me.id, 'global') });
    },
  });
}

export function useStamps() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.fun.stamps(me.id),
    queryFn: () => getDataProvider().fun.stamps(me.id),
  });
}

export interface SpinInput {
  origin: GeoPoint | null;
  /** Boşsa kullanıcının favori türleri (repo tarafında) kullanılır */
  preferences: AdventureType[];
  seed: number;
}

/**
 * Rulet çevirme. Tercih seçilmediyse repo (favori türler) çalışır;
 * seçildiyse kütüphane yerleri çekilip domain fonksiyonuyla tercihli seçim yapılır.
 */
export function useRoulette() {
  const me = useCurrentUser();
  return useMutation({
    mutationFn: async ({ origin, preferences, seed }: SpinInput): Promise<RouletteSuggestion> => {
      const provider = getDataProvider();
      if (preferences.length === 0) return provider.fun.roulette(me.id, origin);
      const places = await provider.library.search({});
      const suggestion = spinRoulette(places, origin, preferences, seed);
      if (!suggestion) throw new Error('Öneri bulunamadı');
      return suggestion;
    },
  });
}

export function useXpHistory() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.fun.xp(me.id),
    queryFn: () => getDataProvider().fun.xpHistory(me.id),
  });
}
