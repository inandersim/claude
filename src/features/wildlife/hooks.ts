import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type {
  DeterrentAnimal,
  DeterrentEvent,
  DeterrentProfile,
  DeterrentSound,
  GeoPoint,
  ID,
  Species,
  SpeciesFilter,
  SpeciesIdentification,
  WildlifeAnswer,
  WildlifeQuestion,
  WildlifeQuestionWithDetails,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

/* ------------------------------------------------------------------ */
/* Türler                                                               */
/* ------------------------------------------------------------------ */

export function useSpecies(filter: SpeciesFilter) {
  return useQuery<Species[]>({
    queryKey: queryKeys.wildlife.species(filter),
    queryFn: () => getDataProvider().wildlife.species(filter),
    placeholderData: (prev) => prev,
  });
}

export function useSpeciesDetail(id: ID | null | undefined) {
  return useQuery<Species | null>({
    queryKey: queryKeys.wildlife.speciesDetail(id ?? ''),
    queryFn: () => getDataProvider().wildlife.speciesById(id ?? ''),
    enabled: Boolean(id),
  });
}

export interface IdentifyInput {
  imageUri: string | null;
  imageBase64: string | null;
  description: string;
  coords: GeoPoint | null;
  locale: string;
}

/** Fotoğraf/açıklama ile tanımlama; başarıda geçmişi tazeler. */
export function useIdentifySpecies() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation<SpeciesIdentification, Error, IdentifyInput>({
    mutationFn: (input) => getDataProvider().wildlife.identify(me.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wildlife.identifications(me.id) });
    },
  });
}

export function useIdentifications() {
  const me = useCurrentUser();
  return useQuery<SpeciesIdentification[]>({
    queryKey: queryKeys.wildlife.identifications(me.id),
    queryFn: () => getDataProvider().wildlife.identifications(me.id),
  });
}

/* ------------------------------------------------------------------ */
/* Sorular                                                              */
/* ------------------------------------------------------------------ */

export interface QuestionsFilter {
  status?: WildlifeQuestion['status'] | null;
  urgentOnly?: boolean;
  mineOnly?: boolean;
}

export function useWildlifeQuestions(filter: QuestionsFilter = {}) {
  const me = useCurrentUser();
  return useQuery<WildlifeQuestionWithDetails[]>({
    queryKey: queryKeys.wildlife.questions(me.id, filter),
    queryFn: () => getDataProvider().wildlife.questions(me.id, filter),
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  });
}

/** Soru detayı: canlı yanıtlar için 5 sn'de bir yenilenir. */
export function useWildlifeQuestion(id: ID) {
  const me = useCurrentUser();
  return useQuery<WildlifeQuestionWithDetails | null>({
    queryKey: queryKeys.wildlife.question(me.id, id),
    queryFn: () => getDataProvider().wildlife.question(me.id, id),
    refetchInterval: 5_000,
  });
}

export type AskInput = Parameters<ReturnType<typeof getDataProvider>['wildlife']['ask']>[1];

export function useAskWildlife() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation<WildlifeQuestionWithDetails, Error, AskInput>({
    mutationFn: (input) => getDataProvider().wildlife.ask(me.id, input),
    onSuccess: (q) => {
      qc.setQueryData(queryKeys.wildlife.question(me.id, q.id), q);
      qc.invalidateQueries({ queryKey: ['wildlife', 'questions'] });
    },
  });
}

export function useAnswerWildlife(questionId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation<WildlifeQuestionWithDetails, Error, { body: string; speciesId?: ID | null }>({
    mutationFn: ({ body, speciesId }) =>
      getDataProvider().wildlife.answer(me.id, questionId, body, speciesId ?? null),
    onSuccess: (q) => {
      qc.setQueryData(queryKeys.wildlife.question(me.id, questionId), q);
      qc.invalidateQueries({ queryKey: ['wildlife', 'questions'] });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useUpvoteAnswer(questionId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation<WildlifeAnswer, Error, ID>({
    mutationFn: (answerId) => getDataProvider().wildlife.upvote(me.id, answerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wildlife.question(me.id, questionId) });
    },
  });
}

export function useAcceptAnswer(questionId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation<WildlifeQuestionWithDetails, Error, ID>({
    mutationFn: (answerId) => getDataProvider().wildlife.accept(me.id, questionId, answerId),
    onSuccess: (q) => {
      qc.setQueryData(queryKeys.wildlife.question(me.id, questionId), q);
      qc.invalidateQueries({ queryKey: ['wildlife', 'questions'] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Kaçırma                                                              */
/* ------------------------------------------------------------------ */

export function useDeterrents() {
  return useQuery<DeterrentProfile[]>({
    queryKey: queryKeys.wildlife.deterrents,
    queryFn: () => getDataProvider().wildlife.deterrents(),
    staleTime: Infinity,
  });
}

export function useLogDeterrent() {
  const me = useCurrentUser();
  return useMutation<
    DeterrentEvent,
    Error,
    { animal: DeterrentAnimal; sound: DeterrentSound; coords: GeoPoint | null; durationS: number }
  >({
    mutationFn: ({ animal, sound, coords, durationS }) =>
      getDataProvider().wildlife.logDeterrent(me.id, animal, sound, coords, durationS),
  });
}

export function useOnlineHelpers() {
  return useQuery({
    queryKey: queryKeys.wildlife.online,
    queryFn: () => getDataProvider().wildlife.onlineHelpers(),
    refetchInterval: 60_000,
  });
}

/* ------------------------------------------------------------------ */
/* Ses çalıcı (expo-audio + titreşim + fener)                            */
/* ------------------------------------------------------------------ */

const IS_WEB = Platform.OS === 'web';

/** Metro `.wav` varlıkları; `npm run sounds` ile üretilir. */
const SOUND_SOURCES: Record<DeterrentSound, number> = {
  air_horn: require('../../../assets/sounds/air_horn.wav'),
  siren: require('../../../assets/sounds/siren.wav'),
  whistle: require('../../../assets/sounds/whistle.wav'),
  shout: require('../../../assets/sounds/shout.wav'),
  clap: require('../../../assets/sounds/clap.wav'),
  metal_clang: require('../../../assets/sounds/metal_clang.wav'),
  ultrasonic: require('../../../assets/sounds/ultrasonic.wav'),
  stomp: require('../../../assets/sounds/stomp.wav'),
};

const HAPTIC_INTERVAL_MS = 450;
const TORCH_INTERVAL_MS = 350;

export interface DeterrentPlayerOptions {
  vibrate?: boolean;
  flash?: boolean;
}

export interface DeterrentPlayerState {
  playing: boolean;
  sound: DeterrentSound | null;
  /** `CameraView enableTorch` prop'una bağlanır (web'de daima false) */
  torch: boolean;
  /** Son hata (ses yüklenemedi vb.) */
  error: string | null;
  start: (sound: DeterrentSound, options?: DeterrentPlayerOptions) => Promise<void>;
  /** Çalmayı durdurur; geçen süreyi saniye olarak döner */
  stop: () => number;
}

/**
 * Seçilen sesi döngüde tam seste çalar; `expo-haptics` ile titreşim döngüsü ve
 * fener için `torch` bayrağı üretir (ekran görünmez bir `CameraView` ile `enableTorch` verir).
 * Web'de yalnızca ses.
 */
export function useDeterrentPlayer(): DeterrentPlayerState {
  const playerRef = useRef<AudioPlayer | null>(null);
  const hapticTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const torchTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState<DeterrentSound | null>(null);
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearTimers = useCallback(() => {
    if (hapticTimer.current) clearInterval(hapticTimer.current);
    if (torchTimer.current) clearInterval(torchTimer.current);
    hapticTimer.current = null;
    torchTimer.current = null;
    setTorch(false);
  }, []);

  const releasePlayer = useCallback(() => {
    const p = playerRef.current;
    playerRef.current = null;
    if (!p) return;
    try {
      p.pause();
      p.remove();
    } catch {
      // Zaten serbest bırakılmış olabilir
    }
  }, []);

  const stop = useCallback((): number => {
    const elapsed = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
    startedAt.current = null;
    clearTimers();
    releasePlayer();
    setPlaying(false);
    setSound(null);
    return elapsed;
  }, [clearTimers, releasePlayer]);

  const start = useCallback(
    async (next: DeterrentSound, options: DeterrentPlayerOptions = {}) => {
      clearTimers();
      releasePlayer();
      setError(null);
      try {
        if (!IS_WEB) await setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
        const player = createAudioPlayer(SOUND_SOURCES[next]);
        player.loop = true;
        player.volume = 1;
        player.play();
        playerRef.current = player;
        startedAt.current = startedAt.current ?? Date.now();
        setPlaying(true);
        setSound(next);
      } catch {
        setError('play');
        setPlaying(false);
        return;
      }
      if (IS_WEB) return;
      if (options.vibrate !== false) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
        hapticTimer.current = setInterval(() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
        }, HAPTIC_INTERVAL_MS);
      }
      if (options.flash) {
        setTorch(true);
        torchTimer.current = setInterval(() => setTorch((v) => !v), TORCH_INTERVAL_MS);
      }
    },
    [clearTimers, releasePlayer],
  );

  // Ekrandan çıkınca her şeyi kapat
  useEffect(
    () => () => {
      clearTimers();
      releasePlayer();
    },
    [clearTimers, releasePlayer],
  );

  return { playing, sound, torch: IS_WEB ? false : torch, error, start, stop };
}
