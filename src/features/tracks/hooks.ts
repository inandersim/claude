import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { haptics } from '@/core/hooks/useHaptics';
import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type {
  GeoPoint,
  ID,
  NavigationProgress,
  NavigationStep,
  PoiKind,
  SaveTrackInput,
  TrackFilter,
  TrackPoi,
  TrackPoint,
  TrackSource,
} from '@/domain';
import {
  cumulativeM,
  pointAtDistance,
  progressAlong,
  trackStats,
  type TrackStats,
  voiceLine,
} from '@/domain/tracks';
import { useCurrentUser } from '@/features/auth/session.store';

import {
  arkaPlaniBaslat,
  arkaPlaniDurdur,
} from './recorder-background';
import { mergePoints } from './recorder-buffer';
import { createFileBuffer } from './recorder-store';

/* ------------------------------------------------------------------ */
/* Sorgular                                                            */
/* ------------------------------------------------------------------ */

export function useTracks(filter: TrackFilter) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.tracks.list(me.id, filter),
    queryFn: () => getDataProvider().tracks.list(me.id, filter),
    placeholderData: (prev) => prev,
  });
}

export function useTrack(id: ID | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.tracks.detail(me.id, id ?? ''),
    queryFn: () => getDataProvider().tracks.getById(me.id, id!),
    enabled: Boolean(id),
  });
}

export function useSaveTrack() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveTrackInput) => getDataProvider().tracks.save(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tracks.all }),
  });
}

export function useImportGpx() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { gpx: string; source: TrackSource; name?: string | null }) =>
      getDataProvider().tracks.importGpx(me.id, input.gpx, input.source, input.name ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tracks.all }),
  });
}

export function usePublishTrack() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackId: ID) => getDataProvider().tracks.publish(me.id, trackId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tracks.all }),
  });
}

export function useRemoveTrack() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trackId: ID) => getDataProvider().tracks.remove(me.id, trackId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tracks.all }),
  });
}

export function useCommunityTrails(origin: GeoPoint | null, radiusKm: number | null = null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: [...queryKeys.tracks.community(me.id, origin), radiusKm],
    queryFn: () => getDataProvider().tracks.communityTrails(me.id, origin, radiusKm),
    placeholderData: (prev) => prev,
  });
}

export function useCommunityTrail(id: ID | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.tracks.communityDetail(me.id, id ?? ''),
    queryFn: () => getDataProvider().tracks.communityTrail(me.id, id!),
    enabled: Boolean(id),
  });
}

export function useVerifyTrail() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trailId: ID) => getDataProvider().tracks.verifyTrail(me.id, trailId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tracks.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function usePoisNear(origin: GeoPoint, radiusKm: number, kind: PoiKind | null = null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: [...queryKeys.tracks.pois(origin, radiusKm), kind],
    queryFn: () => getDataProvider().tracks.poisNear(me.id, origin, radiusKm, kind),
    placeholderData: (prev) => prev,
  });
}

export type AddPoiInput = Omit<TrackPoi, 'id' | 'userId' | 'confirmations' | 'createdAt'>;

export function useAddPoi() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddPoiInput) => getDataProvider().tracks.addPoi(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tracks.all }),
  });
}

export function useConfirmPoi() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (poiId: ID) => getDataProvider().tracks.confirmPoi(me.id, poiId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tracks.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useSuggestedPois(origin: GeoPoint | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: [...queryKeys.tracks.suggested(me.id), origin ? 'o' : null],
    queryFn: () => getDataProvider().tracks.suggestedPoisFromMedia(me.id, origin),
  });
}

export function useNavigation(id: ID | null, kind: 'track' | 'community') {
  return useQuery({
    queryKey: queryKeys.tracks.navigation(id ?? '', kind),
    queryFn: () => getDataProvider().tracks.navigation(id!, kind),
    enabled: Boolean(id),
  });
}

/* ------------------------------------------------------------------ */
/* Kayıt (konum izleme)                                                */
/* ------------------------------------------------------------------ */

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped';

export type RecorderPoi = SaveTrackInput['pois'][number];

export interface TrackRecorder {
  status: RecorderStatus;
  points: TrackPoint[];
  pois: RecorderPoi[];
  stats: TrackStats;
  /** Kayıt başladığından beri geçen süre (sn; duraklamalar hariç) */
  elapsedSec: number;
  current: TrackPoint | null;
  /** Web'de gerçek GPS yerine örnek parça oynatılıyor */
  isSimulated: boolean;
  error: 'permission' | 'unavailable' | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  addPoi: (kind: PoiKind, name: string, note: string) => boolean;
}

interface RecorderOptions {
  /** Web demosu için oynatılacak nokta dizisi (null → gerçek GPS) */
  simulate?: TrackPoint[] | null;
  /** Simülasyon adımı (ms) */
  simulateIntervalMs?: number;
  /**
   * Ekran kapalıyken görünen kalıcı bildirimin metni. Ekran `t('tracks.recorder.
   * backgroundTitle')` / `backgroundBody` geçirir. Verilmezse arka plan kaydı
   * **açılmaz**: kullanıcıya ne olduğunu anlatmayan bir konum servisi
   * başlatmaktansa ön planda kalmak doğru.
   */
  backgroundNotice?: { title: string; body: string } | null;
}

const EMPTY_STATS: TrackStats = {
  distanceKm: 0,
  ascentM: 0,
  descentM: 0,
  durationMin: 0,
  maxElevationM: null,
  minElevationM: null,
  avgSpeedKmh: null,
};

/**
 * GPS kayıt durum makinesi: `expo-location` `watchPositionAsync` (High, 5 m) ile nokta toplar.
 * Web'de (ya da `simulate` verildiğinde) seçilen örnek parça zaman damgaları "şimdi"ye
 * kaydırılarak oynatılır.
 */
export function useTrackRecorder(options: RecorderOptions = {}): TrackRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [pois, setPois] = useState<RecorderPoi[]>([]);
  const [error, setError] = useState<TrackRecorder['error']>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<RecorderStatus>('idle');
  const simIndex = useRef(0);
  const simOffset = useRef(0);

  const isSimulated = Platform.OS === 'web' || Boolean(options.simulate);
  const simulate = options.simulate ?? null;
  const simulateIntervalMs = options.simulateIntervalMs ?? 400;
  const backgroundNotice = options.backgroundNotice ?? null;

  /**
   * Arka plan görevi ayrı bir JS bağlamında çalıştığı için noktaları React
   * durumuna değil diske yazar. Uygulama öne döndüğünde biriken noktalar
   * buradan alınıp mevcut dizilime katılır.
   */
  const tamponuBosalt = useCallback(() => {
    if (isSimulated) return;
    try {
      const bekleyen = createFileBuffer().readAll();
      if (!bekleyen.length) return;
      setPoints((prev) => mergePoints(prev, bekleyen));
    } catch {
      // Tampon okunamadı: ön planda toplanan noktalar duruyor, kayıt sürüyor.
    }
  }, [isSimulated]);

  // Öne dönüşte devir: ekran kapalıyken toplananlar bu anda katılır.
  useEffect(() => {
    if (isSimulated) return;
    const abone = AppState.addEventListener('change', (durum) => {
      if (durum === 'active') tamponuBosalt();
    });
    return () => abone.remove();
  }, [isSimulated, tamponuBosalt]);

  const setStatusBoth = (next: RecorderStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const clearTimers = () => {
    if (simTimer.current) {
      clearInterval(simTimer.current);
      simTimer.current = null;
    }
    if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
    subscription.current?.remove();
    subscription.current = null;
  };

  useEffect(() => clearTimers, []);

  const pushPoint = (p: TrackPoint) => {
    if (statusRef.current !== 'recording') return;
    setPoints((prev) => [...prev, p]);
  };

  const startTick = () => {
    if (tick.current) return;
    tick.current = setInterval(() => {
      if (statusRef.current === 'recording') setElapsedSec((s) => s + 1);
    }, 1000);
    const t = tick.current as { unref?: () => void };
    t.unref?.();
  };

  const startSimulation = (source: TrackPoint[]) => {
    if (simTimer.current) return;
    if (simOffset.current === 0) simOffset.current = Date.now() - (source[0]?.t ?? Date.now());
    simTimer.current = setInterval(() => {
      if (statusRef.current !== 'recording') return;
      const src = source[simIndex.current];
      if (!src) {
        if (simTimer.current) clearInterval(simTimer.current);
        simTimer.current = null;
        return;
      }
      simIndex.current += 1;
      pushPoint({ ...src, t: Date.now() });
    }, simulateIntervalMs);
    const t = simTimer.current as { unref?: () => void };
    t.unref?.();
  };

  const start = useCallback(async () => {
    setError(null);
    if (isSimulated) {
      if (!simulate || simulate.length === 0) {
        setError('unavailable');
        return;
      }
      setStatusBoth('recording');
      startTick();
      startSimulation(simulate);
      return;
    }
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setError('permission');
        return;
      }
      // Önceki kaydın artıkları yeni ize karışmasın.
      try {
        createFileBuffer().clear();
      } catch {
        /* tampon yoksa sorun değil */
      }
      setStatusBoth('recording');
      startTick();
      subscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
        (pos) => {
          pushPoint({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            elevationM: pos.coords.altitude ?? null,
            t: pos.timestamp,
          });
        },
      );

      // Ekran kapanınca `watchPositionAsync` susar; kalıcı bildirimli ön plan
      // servisi kaydı sürdürür. İzin verilmezse ya da servis açılmazsa kayıt
      // bugünkü ön plan davranışıyla devam eder — hata sayılmaz.
      if (backgroundNotice) {
        // İzin kararı platforma göre değişiyor ve `recorder-background` içinde
        // veriliyor; burada yalnızca sonucu umursamıyoruz.
        try {
          await arkaPlaniBaslat({
            baslik: backgroundNotice.title,
            govde: backgroundNotice.body,
          });
        } catch {
          /* arka plan yok: ön planda sürüyor */
        }
      }
    } catch {
      setError('unavailable');
      setStatusBoth('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSimulated, simulate, simulateIntervalMs, backgroundNotice]);

  const pause = useCallback(() => {
    if (statusRef.current === 'recording') setStatusBoth('paused');
  }, []);

  const resume = useCallback(() => {
    if (statusRef.current === 'paused') setStatusBoth('recording');
  }, []);

  const stop = useCallback(() => {
    if (statusRef.current === 'idle') return;
    setStatusBoth('stopped');
    clearTimers();
    // Sıra önemli: önce servis durur, sonra tampon okunur — aksi hâlde
    // okuma ile durdurma arasında gelen nokta kaybolur.
    void arkaPlaniDurdur().then(tamponuBosalt);
  }, [tamponuBosalt]);

  const reset = useCallback(() => {
    clearTimers();
    void arkaPlaniDurdur();
    try {
      createFileBuffer().clear();
    } catch {
      /* tampon yoksa sorun değil */
    }
    simIndex.current = 0;
    simOffset.current = 0;
    setPoints([]);
    setPois([]);
    setElapsedSec(0);
    setError(null);
    setStatusBoth('idle');
  }, []);

  const addPoi = useCallback(
    (kind: PoiKind, name: string, note: string) => {
      const current = points[points.length - 1];
      if (!current) return false;
      setPois((prev) => [
        ...prev,
        {
          kind,
          coords: { latitude: current.latitude, longitude: current.longitude },
          elevationM: current.elevationM,
          name,
          note,
          photoUrl: null,
          source: 'user',
          mediaId: null,
        },
      ]);
      return true;
    },
    [points],
  );

  const stats = points.length > 1 ? trackStats(points) : EMPTY_STATS;

  return {
    status,
    points,
    pois,
    stats,
    elapsedSec,
    current: points[points.length - 1] ?? null,
    isSimulated,
    error,
    start,
    pause,
    resume,
    stop,
    reset,
    addPoi,
  };
}

/* ------------------------------------------------------------------ */
/* Navigatör                                                           */
/* ------------------------------------------------------------------ */

export interface Navigator {
  position: GeoPoint | null;
  progress: NavigationProgress | null;
  currentStep: NavigationStep | null;
  nextStep: NavigationStep | null;
  /** Son sesli yönerge metni (TTS yerine ekranda gösterilir) */
  voice: string | null;
  isSimulated: boolean;
  hasArrived: boolean;
  /** Web demosu: konumu rota boyunca `meters` ilerletir */
  advanceDemo: (meters?: number) => void;
  /** Rotanın toplam uzunluğu (m) */
  totalM: number;
}

interface NavigatorOptions {
  locale?: string;
  voiceEnabled?: boolean;
  /** Konum izleme yerine simülasyon (web'de her zaman) */
  simulate?: boolean;
}

/**
 * Konumu izler, `progressAlong` ile ilerlemeyi hesaplar; adım değişince haptik + sesli yönerge
 * metni üretir. Web'de konum, `advanceDemo` ile rota boyunca ilerletilir.
 */
export function useNavigator(
  steps: NavigationStep[],
  points: TrackPoint[],
  options: NavigatorOptions = {},
): Navigator {
  const locale = options.locale ?? 'tr';
  const voiceEnabled = options.voiceEnabled !== false;
  const isSimulated = options.simulate ?? Platform.OS === 'web';
  const [nav, setNav] = useState<{
    position: GeoPoint | null;
    progress: NavigationProgress | null;
    voice: string | null;
  }>({ position: null, progress: null, voice: null });
  const stepRef = useRef(0);
  const lastVoiced = useRef(-1);
  const demoAlong = useRef(0);
  const totalM = points.length > 1 ? (cumulativeM(points)[points.length - 1] ?? 0) : 0;

  /** Yeni konum: ilerlemeyi hesaplar, adım değiştiyse haptik + sesli yönerge üretir. */
  const handlePosition = useCallback(
    (pos: GeoPoint) => {
      if (points.length < 2 || steps.length === 0) {
        setNav((n) => ({ ...n, position: pos }));
        return;
      }
      const progress = progressAlong(points, steps, pos, stepRef.current);
      stepRef.current = progress.stepIndex;
      let voice: string | null = null;
      if (progress.stepIndex !== lastVoiced.current) {
        lastVoiced.current = progress.stepIndex;
        const step = steps[progress.stepIndex];
        if (step) {
          haptics.medium();
          if (voiceEnabled) voice = voiceLine(step, step.distanceM, locale);
        }
      }
      setNav((n) => ({ position: pos, progress, voice: voice ?? n.voice }));
    },
    [points, steps, locale, voiceEnabled],
  );

  // Gerçek konum izleme (yerel platformlar); web'de advanceDemo konumu ilerletir
  useEffect(() => {
    if (isSimulated || points.length < 2) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
          (p) => handlePosition({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        );
      } catch {
        // konum yok → ekranda "konum bekleniyor"
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [isSimulated, points, handlePosition]);

  const advanceDemo = useCallback(
    (meters = 120) => {
      if (points.length < 2) return;
      demoAlong.current = Math.min(totalM, demoAlong.current + meters);
      const p = pointAtDistance(points, demoAlong.current);
      if (p) handlePosition({ latitude: p.latitude, longitude: p.longitude });
    },
    [points, totalM, handlePosition],
  );

  // Simülasyonda başlangıç konumu rota başıdır (henüz ilerlenmediyse)
  const first = points[0] ?? null;
  const position =
    nav.position ??
    (isSimulated && first ? { latitude: first.latitude, longitude: first.longitude } : null);
  const progress =
    nav.progress ??
    (position && points.length > 1 && steps.length > 0
      ? progressAlong(points, steps, position, 0)
      : null);

  const currentStep = steps[progress?.stepIndex ?? 0] ?? null;
  const nextStep = steps[(progress?.stepIndex ?? 0) + 1] ?? null;
  const hasArrived = Boolean(progress && progress.remainingM <= 25 && !progress.isOffRoute);

  return {
    position,
    progress,
    currentStep,
    nextStep,
    voice: nav.voice,
    isSimulated,
    hasArrived,
    advanceDemo,
    totalM,
  };
}
