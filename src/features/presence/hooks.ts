import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { GeoPoint, StartShareInput } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useVisibleShares(origin: GeoPoint | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.presence.list(me.id),
    queryFn: () => getDataProvider().presence.list(me.id, origin),
    refetchInterval: 10_000,
  });
}

export function useMyShare() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.presence.mine(me.id),
    queryFn: () => getDataProvider().presence.mine(me.id),
    refetchInterval: 15_000,
  });
}

export function useStartShare() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StartShareInput) => getDataProvider().presence.start(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presence.all }),
  });
}

export function useStopShare() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getDataProvider().presence.stop(me.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presence.all }),
  });
}

/**
 * Paylaşım aktifken cihaz konumunu izler ve sunucuya (mock) iletir.
 * Gerçek uygulamada arka plan konum görevi (expo-task-manager) ile değiştirilir.
 */
export function useLocationPublisher(active: boolean) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const subscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        subscription.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 15_000, distanceInterval: 25 },
          (pos) => {
            getDataProvider()
              .presence.update(
                me.id,
                { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
                {
                  altitudeM: pos.coords.altitude ?? null,
                  speedKmh: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
                },
              )
              .then(() => qc.invalidateQueries({ queryKey: queryKeys.presence.mine(me.id) }));
          },
        );
      } catch {
        // izin yok ya da web — sessizce geç
      }
    })();
    return () => {
      cancelled = true;
      subscription.current?.remove();
      subscription.current = null;
    };
  }, [active, me.id, qc]);
}
