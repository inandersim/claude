import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_LOCATION, type GeoPoint } from '@/domain';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

interface UseLocationResult {
  coords: GeoPoint;
  status: LocationStatus;
  request: () => Promise<void>;
  /** Gerçek konum mu, varsayılan mı */
  isFallback: boolean;
}

/**
 * Kullanıcının konumunu ister; izin yoksa varsayılan konuma (İstanbul) düşer.
 * `fallback` parametresi, kullanıcının profilindeki konum gibi daha iyi bir varsayılan vermek için kullanılır.
 */
export function useLocation(fallback: GeoPoint = DEFAULT_LOCATION): UseLocationResult {
  const [coords, setCoords] = useState<GeoPoint>(fallback);
  const [status, setStatus] = useState<LocationStatus>('idle');

  const request = useCallback(async () => {
    setStatus('requesting');
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== 'granted') {
        setStatus('denied');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setStatus('granted');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then(async ({ status: permission }) => {
        if (cancelled) return;
        if (permission === 'granted') {
          const last = await Location.getLastKnownPositionAsync();
          if (!cancelled && last) {
            setCoords({ latitude: last.coords.latitude, longitude: last.coords.longitude });
          }
          setStatus('granted');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return { coords, status, request, isFallback: status !== 'granted' };
}
