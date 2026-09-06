import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type {
  GeoPoint,
  HuntProgress,
  ID,
  KidAgeBand,
  KidPlaceFilter,
  TvProgramWithChannel,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

/* ------------------------------------------------------------------ */
/* Yerler                                                               */
/* ------------------------------------------------------------------ */

export function useKidPlaces(filter: KidPlaceFilter) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.kids.places(me.id, filter),
    queryFn: () => getDataProvider().kids.places(me.id, filter),
    placeholderData: (prev) => prev,
  });
}

export function useKidPlace(id: ID, origin: GeoPoint | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.kids.place(me.id, id),
    queryFn: () => getDataProvider().kids.place(me.id, id, origin),
    enabled: Boolean(id),
  });
}

export function useToggleSaveKidPlace() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (placeId: ID) => getDataProvider().kids.toggleSave(me.id, placeId),
    onSuccess: (_saved, placeId) => {
      qc.invalidateQueries({ queryKey: queryKeys.kids.place(me.id, placeId) });
      qc.invalidateQueries({ queryKey: ['kids', 'places'] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Çocuk profilleri                                                     */
/* ------------------------------------------------------------------ */

export function useChildren() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.kids.children(me.id),
    queryFn: () => getDataProvider().kids.children(me.id),
  });
}

export function useAddChild() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; ageBand: KidAgeBand; avatar: string }) =>
      getDataProvider().kids.addChild(me.id, input.name, input.ageBand, input.avatar),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.kids.children(me.id) }),
  });
}

export function useRemoveChild() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (childId: ID) => getDataProvider().kids.removeChild(me.id, childId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.kids.children(me.id) });
      qc.invalidateQueries({ queryKey: ['kids', 'hunt', me.id] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Doğa avı                                                             */
/* ------------------------------------------------------------------ */

export function useHuntTasks(ageBand: KidAgeBand | null) {
  return useQuery({
    queryKey: queryKeys.kids.tasks(ageBand),
    queryFn: () => getDataProvider().kids.huntTasks(ageBand),
    placeholderData: (prev) => prev,
  });
}

export function useHuntProgress(childName: string | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.kids.hunt(me.id, childName ?? ''),
    queryFn: () => getDataProvider().kids.huntProgress(me.id, childName ?? ''),
    enabled: Boolean(childName),
  });
}

/** Görev tamamlama; iyimser güncelleme ile kart anında işaretlenir. */
export function useCompleteTask(childName: string) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const key = queryKeys.kids.hunt(me.id, childName);
  return useMutation({
    mutationFn: (input: { taskId: ID; points: number }) =>
      getDataProvider().kids.completeTask(me.id, childName, input.taskId),
    onMutate: async ({ taskId, points }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<HuntProgress>(key);
      if (previous && !previous.completedTaskIds.includes(taskId)) {
        qc.setQueryData<HuntProgress>(key, {
          ...previous,
          completedTaskIds: [...previous.completedTaskIds, taskId],
          points: previous.points + points,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
    },
    onSuccess: (progress) => {
      qc.setQueryData(key, progress);
      qc.invalidateQueries({ queryKey: queryKeys.fun.all });
    },
  });
}

export function useResetHunt(childName: string) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const key = queryKeys.kids.hunt(me.id, childName);
  return useMutation({
    mutationFn: () => getDataProvider().kids.resetHunt(me.id, childName),
    onSuccess: (progress) => qc.setQueryData(key, progress),
  });
}

/* ------------------------------------------------------------------ */
/* Kontrol listesi                                                      */
/* ------------------------------------------------------------------ */

export function useFamilyChecklist(ageBand: KidAgeBand | null) {
  return useQuery({
    queryKey: queryKeys.kids.checklist(ageBand),
    queryFn: () => getDataProvider().kids.checklist(ageBand),
    placeholderData: (prev) => prev,
  });
}

const CHECKLIST_KEY = 'zirtan.kids.checklist';

interface ChecklistState {
  checked: Record<string, boolean>;
  hydrated: boolean;
  toggle: (key: string) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
}

/** İşaretli kontrol listesi maddeleri; cihazda kalıcı (AsyncStorage). */
export const useChecklistStore = create<ChecklistState>((set, get) => ({
  checked: {},
  hydrated: false,
  toggle: (key) => {
    const next = { ...get().checked, [key]: !get().checked[key] };
    set({ checked: next });
    AsyncStorage.setItem(CHECKLIST_KEY, JSON.stringify(next)).catch(() => undefined);
  },
  clear: () => {
    set({ checked: {} });
    AsyncStorage.removeItem(CHECKLIST_KEY).catch(() => undefined);
  },
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(CHECKLIST_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          set({ checked: parsed as Record<string, boolean>, hydrated: true });
          return;
        }
      }
    } catch {
      // yoksay: boş liste ile devam
    }
    set({ hydrated: true });
  },
}));

useChecklistStore
  .getState()
  .hydrate()
  .catch(() => undefined);

/* ------------------------------------------------------------------ */
/* Çocuk dostu videolar                                                 */
/* ------------------------------------------------------------------ */

/**
 * TV modülünden çocuk dostu programlar. TV repository'si hazır değilse
 * (ya da tablo boşsa) sessizce boş liste döner; ekran bölümü gizler.
 */
export function useKidsPrograms() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: ['kids', 'programs', me.id] as const,
    queryFn: async (): Promise<TvProgramWithChannel[]> => {
      try {
        const list = await getDataProvider().tv.programs(me.id, { kidsOnly: true });
        return list.filter((p) => p.kidsFriendly).slice(0, 8);
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });
}
