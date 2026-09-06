import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import {
  HERITAGE_NEARBY_RADIUS_KM,
  type GeoPoint,
  type HeritageFilter,
  type HeritageTour,
  type ID,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useHeritageSites(filter: HeritageFilter) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.heritage.list(me.id, filter),
    queryFn: () => getDataProvider().heritage.list(me.id, filter),
    placeholderData: (prev) => prev,
  });
}

export function useHeritageSite(id: ID, origin: GeoPoint | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.heritage.detail(me.id, id),
    queryFn: () => getDataProvider().heritage.getById(me.id, id, origin),
    enabled: Boolean(id),
  });
}

export function useAudioGuide(siteId: ID) {
  return useQuery({
    queryKey: queryKeys.heritage.audio(siteId),
    queryFn: () => getDataProvider().heritage.audioGuide(siteId),
    enabled: Boolean(siteId),
  });
}

export function useToggleSaveSite() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: ID) => getDataProvider().heritage.toggleSave(me.id, siteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.heritage.all }),
  });
}

export function useMarkVisited() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: ID) => getDataProvider().heritage.markVisited(me.id, siteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.heritage.all });
      qc.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
}

export function useHeritageTours() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.heritage.tours(me.id),
    queryFn: () => getDataProvider().heritage.tours(me.id),
  });
}

export function useCreateTour() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<HeritageTour, 'id' | 'userId' | 'createdAt'>) =>
      getDataProvider().heritage.createTour(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.heritage.tours(me.id) }),
  });
}

export function useDeleteTour() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tourId: ID) => getDataProvider().heritage.deleteTour(me.id, tourId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.heritage.tours(me.id) }),
  });
}

export function useNearbyHeritage(origin: GeoPoint | null, radiusKm = HERITAGE_NEARBY_RADIUS_KM) {
  return useQuery({
    queryKey: [
      ...queryKeys.heritage.all,
      'nearby',
      origin ? `${origin.latitude.toFixed(2)},${origin.longitude.toFixed(2)}` : null,
      radiusKm,
    ],
    queryFn: () => getDataProvider().heritage.nearby(origin as GeoPoint, radiusKm),
    enabled: Boolean(origin),
  });
}

/* ------------------------------------------------------------------ */
/* Sesli okuma                                                         */
/* ------------------------------------------------------------------ */

interface SpeechSynth {
  speak: (u: unknown) => void;
  cancel: () => void;
}

type UtteranceCtor = new (text: string) => {
  lang: string;
  rate: number;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

/** Web'de window.speechSynthesis nesnesi; diğer platformlarda null. */
function getSynth(): { synth: SpeechSynth; Utterance: UtteranceCtor } | null {
  if (Platform.OS !== 'web' || typeof globalThis === 'undefined') return null;
  const g = globalThis as unknown as {
    speechSynthesis?: SpeechSynth;
    SpeechSynthesisUtterance?: UtteranceCtor;
  };
  if (!g.speechSynthesis || !g.SpeechSynthesisUtterance) return null;
  return { synth: g.speechSynthesis, Utterance: g.SpeechSynthesisUtterance };
}

export interface UseSpeechResult {
  /** Bu platformda sesli okuma var mı (web + speechSynthesis) */
  supported: boolean;
  speaking: boolean;
  /** Konuşulan metnin kimliği (durak id'si vb.) */
  currentKey: string | null;
  speak: (key: string, text: string, lang?: string) => void;
  stop: () => void;
}

/**
 * Metni sesli okur. Web'de tarayıcı speechSynthesis'i kullanır; yerelde no-op olup
 * `supported=false` döner (expo-speech eklenince burası değiştirilecek).
 */
export function useSpeech(): UseSpeechResult {
  const [supported] = useState(() => getSynth() !== null);
  const [speaking, setSpeaking] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    const s = getSynth();
    if (s) s.synth.cancel();
    keyRef.current = null;
    setSpeaking(false);
    setCurrentKey(null);
  }, []);

  const speak = useCallback((key: string, text: string, lang = 'tr-TR') => {
    const s = getSynth();
    if (!s) return;
    s.synth.cancel();
    const u = new s.Utterance(text);
    u.lang = lang;
    u.rate = 0.95;
    u.onend = () => {
      if (keyRef.current === key) {
        keyRef.current = null;
        setSpeaking(false);
        setCurrentKey(null);
      }
    };
    u.onerror = u.onend;
    keyRef.current = key;
    setSpeaking(true);
    setCurrentKey(key);
    s.synth.speak(u);
  }, []);

  useEffect(() => () => getSynth()?.synth.cancel(), []);

  return { supported, speaking, currentKey, speak, stop };
}
