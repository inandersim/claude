import React, { useMemo } from 'react';
import { Platform } from 'react-native';

import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import type { GeoPoint, TrackPoi, TrackPoint } from '@/domain';
import { distanceKm } from '@/domain/geo';
import { MapView } from '@/features/maps/components/MapView';
import { useMapPacks } from '@/features/maps/hooks';
import { getPackManager } from '@/features/maps/pack-manager';
import { resolveSource, useTileServerPacks } from '@/features/maps/vector/source';
import type { MapMarker } from '@/features/maps/vector/types';

import { POI_COLOR } from './meta';
import { TrackMap } from './TrackMap';

interface Props {
  points: TrackPoint[];
  pois?: TrackPoi[];
  /** Mevcut konum (navigasyon / kayıt) */
  position?: GeoPoint | null;
  /** Ek vurgulu nokta (ör. sonraki adım) */
  highlight?: GeoPoint | null;
  /** Konuma kadar katedilmiş bölümü soluk çizer (navigasyon) */
  showProgress?: boolean;
  onPoiPress?: (poi: TrackPoi) => void;
  height?: number;
  name?: string;
  strokeColor?: string;
  offRoute?: boolean;
}


/** Web'de kalıcı dosya sistemi yok; paket kaynağı yalnızca yerel platformlarda geçerli. */
const packInstalled = (packId: string) =>
  Platform.OS !== 'web' && getPackManager().isInstalled(packId);

const toGeo = (p: TrackPoint): GeoPoint => ({ latitude: p.latitude, longitude: p.longitude });

/** Konuma en yakın parça noktasının sırası — katedilen bölümü bulmak için. */
function nearestIndex(points: GeoPoint[], position: GeoPoint): number {
  let best = 0;
  let bestKm = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    if (!p) continue;
    const km = distanceKm(p, position);
    if (km < bestKm) {
      bestKm = km;
      best = i;
    }
  }
  return best;
}

/**
 * Parça/rota için gerçek vektör harita; karo paketi yoksa mevcut SVG görünümüne düşer.
 * Kullanıcı konumu, sonraki adım vurgusu ve rotadan sapma rengi harita üstünde çizilir.
 */
export function TrackMapView({
  points,
  pois = [],
  position = null,
  highlight = null,
  showProgress = false,
  onPoiPress,
  height = 280,
  name,
  strokeColor,
  offRoute = false,
}: Props) {
  const { colors } = useTheme();
  const { t } = useT();
  const packs = useMapPacks();
  const server = useTileServerPacks();

  const center = useMemo<GeoPoint | null>(() => {
    const anchor = position ?? (points[0] ? toGeo(points[0]) : null);
    return anchor;
  }, [position, points]);

  const resolved = useMemo(
    () =>
      resolveSource({
        center,
        localPacks: packs.data ?? [],
        serverPacks: server.data ?? [],
        isInstalled: packInstalled,
      }),
    [center, packs.data, server.data],
  );

  const track = useMemo(() => points.map(toGeo), [points]);
  const done = useMemo(() => {
    if (!showProgress || !position || track.length < 2) return [];
    const index = nearestIndex(track, position);
    return track.slice(0, index + 1);
  }, [showProgress, position, track]);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    const first = points[0];
    const last = points[points.length - 1];
    if (first) list.push({ id: 'start', coords: toGeo(first), color: colors.success, label: 'A', kind: 'start' });
    if (last && points.length > 1)
      list.push({ id: 'end', coords: toGeo(last), color: colors.danger, label: 'B', kind: 'end' });
    for (const poi of pois) {
      list.push({ id: poi.id, coords: poi.coords, color: POI_COLOR[poi.kind], label: poi.name, kind: 'poi' });
    }
    if (highlight)
      list.push({ id: 'next-step', coords: highlight, color: colors.accent, kind: 'step' });
    return list;
  }, [points, pois, highlight, colors]);

  const bounds = useMemo<[number, number, number, number] | null>(() => {
    // Navigasyonda kamera kullanıcıyı takip eder; duran haritada tüm parça sığdırılır.
    if (position || track.length < 2) return null;
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const p of track) {
      minLon = Math.min(minLon, p.longitude);
      maxLon = Math.max(maxLon, p.longitude);
      minLat = Math.min(minLat, p.latitude);
      maxLat = Math.max(maxLat, p.latitude);
    }
    return [minLon, minLat, maxLon, maxLat];
  }, [position, track]);

  return (
    <MapView
      height={height}
      source={resolved.source}
      availableLayers={resolved.availableLayers}
      center={center}
      zoom={position ? 14 : 12}
      bounds={bounds}
      track={track}
      routeDone={done}
      markers={markers}
      userLocation={position}
      offRoute={offRoute}
      sourceLabel={t(`maps.mapSource.${resolved.kind}`)}
      accessibilityLabel={t('tracks.mapOf', { name: name ?? '' })}
      testID="track-map"
      onMarkerPress={
        onPoiPress
          ? (id) => {
              const poi = pois.find((p) => p.id === id);
              if (poi) onPoiPress(poi);
            }
          : undefined
      }
      fallback={
        <TrackMap
          points={points}
          pois={pois}
          position={position}
          highlight={highlight}
          onPoiPress={onPoiPress}
          height={height}
          name={name}
          strokeColor={strokeColor}
          offRoute={offRoute}
        />
      }
    />
  );
}
