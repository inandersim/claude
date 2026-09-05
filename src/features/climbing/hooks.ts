import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import {
  GRADE_SYSTEMS,
  type ClimbingFilter,
  type GeoPoint,
  type GradeSystem,
  type ID,
  type LogAscentInput,
  type SubmitRouteInput,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

/* ------------------------------------------------------------------ */
/* Derece sistemi tercihi                                              */
/* ------------------------------------------------------------------ */

const GRADE_SYSTEM_KEY = 'zirve.climbing.gradeSystem';

interface GradeSystemState {
  system: GradeSystem;
  hydrated: boolean;
  setGradeSystem: (system: GradeSystem) => void;
  hydrate: () => Promise<void>;
}

/** Kullanıcının tercih ettiği derece sistemi; AsyncStorage'da kalıcı. */
export const useGradeSystemStore = create<GradeSystemState>((set, get) => ({
  system: 'french',
  hydrated: false,
  setGradeSystem: (system) => {
    set({ system });
    AsyncStorage.setItem(GRADE_SYSTEM_KEY, system).catch(() => undefined);
  },
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const stored = await AsyncStorage.getItem(GRADE_SYSTEM_KEY);
      if (stored && (GRADE_SYSTEMS as readonly string[]).includes(stored)) {
        set({ system: stored as GradeSystem, hydrated: true });
        return;
      }
    } catch {
      // yoksay: varsayılan sistemle devam
    }
    set({ hydrated: true });
  },
}));

// Uygulama açılışında bir kez yükle
useGradeSystemStore
  .getState()
  .hydrate()
  .catch(() => undefined);

/** `{ system, setGradeSystem }` — tercih edilen derece sistemi. */
export function useGradeSystem() {
  const system = useGradeSystemStore((s) => s.system);
  const setGradeSystem = useGradeSystemStore((s) => s.setGradeSystem);
  return { system, setGradeSystem };
}

/* ------------------------------------------------------------------ */
/* Sorgular                                                            */
/* ------------------------------------------------------------------ */

export function useCrags(filter: ClimbingFilter) {
  return useQuery({
    queryKey: queryKeys.climbing.crags(filter),
    queryFn: () => getDataProvider().climbing.crags(filter),
    placeholderData: (prev) => prev,
  });
}

export function useCrag(id: ID, origin: GeoPoint | null) {
  return useQuery({
    queryKey: queryKeys.climbing.crag(id),
    queryFn: () => getDataProvider().climbing.crag(id, origin),
    enabled: Boolean(id),
  });
}

export function useSectors(cragId: ID) {
  return useQuery({
    queryKey: queryKeys.climbing.sectors(cragId),
    queryFn: () => getDataProvider().climbing.sectors(cragId),
    enabled: Boolean(cragId),
  });
}

export function useClimbingRoutes(cragId: ID, sectorId: ID | null = null) {
  return useQuery({
    queryKey: queryKeys.climbing.routes(cragId, sectorId),
    queryFn: () => getDataProvider().climbing.routes(cragId, sectorId),
    enabled: Boolean(cragId),
    placeholderData: (prev) => prev,
  });
}

export function useClimbingRoute(id: ID) {
  return useQuery({
    queryKey: queryKeys.climbing.route(id),
    queryFn: () => getDataProvider().climbing.route(id),
    enabled: Boolean(id),
  });
}

export function useAscents(routeId: ID) {
  return useQuery({
    queryKey: queryKeys.climbing.ascents(routeId),
    queryFn: () => getDataProvider().climbing.ascents(routeId),
    enabled: Boolean(routeId),
  });
}

export function useMyAscents() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.climbing.myAscents(me.id),
    queryFn: () => getDataProvider().climbing.myAscents(me.id),
  });
}

/* ------------------------------------------------------------------ */
/* Mutasyonlar                                                         */
/* ------------------------------------------------------------------ */

export function useLogAscent() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LogAscentInput) => getDataProvider().climbing.logAscent(me.id, input),
    onSuccess: (_ascent, input) => {
      qc.invalidateQueries({ queryKey: queryKeys.climbing.ascents(input.routeId) });
      qc.invalidateQueries({ queryKey: queryKeys.climbing.route(input.routeId) });
      qc.invalidateQueries({ queryKey: queryKeys.climbing.myAscents(me.id) });
    },
  });
}

export function useSubmitRoute() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitRouteInput) => getDataProvider().climbing.submitRoute(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.climbing.all }),
  });
}

export function useConfirmRoute() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeId: ID) => getDataProvider().climbing.confirmRoute(me.id, routeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.climbing.all }),
  });
}
