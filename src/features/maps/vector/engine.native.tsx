import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import type { GeoPoint } from '@/domain';

import type { MapEngineProps, MapRegion } from './types';

export interface MapEngineState {
  status: 'loading' | 'ready' | 'unavailable';
  Component: React.ComponentType<MapEngineProps> | null;
}

export const MAP_ENGINE_NAME = 'maplibre-react-native';

const MARKER_LAYER = 'zirtan-ov-markers';

interface MapLibreModule {
  Map: React.ComponentType<Record<string, unknown>>;
  Camera: React.ComponentType<Record<string, unknown>>;
}

/**
 * MapLibre yerel modülü yalnızca **geliştirme derlemesinde** vardır (Expo Go'da yok).
 * Bu yüzden modül tembel ve hata yakalayarak yüklenir; yoksa MapView SVG'ye düşer.
 */
let cached: MapLibreModule | null | undefined;
export function loadMapLibre(): MapLibreModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@maplibre/maplibre-react-native') as Partial<MapLibreModule>;
    cached = mod?.Map && mod?.Camera ? (mod as MapLibreModule) : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Test/geliştirme için önbelleği sıfırlar. */
export function resetMapLibreCache() {
  cached = undefined;
}

function NativeMap(props: MapEngineProps) {
  const {
    style,
    center,
    zoom = 12,
    bounds,
    interactive = true,
    onPress,
    onRegionChange,
    onMarkerPress,
    onError,
    accessibilityLabel,
    testID,
  } = props;

  const lib = loadMapLibre();

  const camera = useMemo(() => {
    if (bounds) {
      return {
        bounds: { ne: [bounds[2], bounds[3]], sw: [bounds[0], bounds[1]] },
        padding: 36,
        duration: 400,
      };
    }
    if (center) {
      return { center: [center.longitude, center.latitude], zoom, duration: 400 };
    }
    return { zoom };
  }, [bounds, center, zoom]);

  if (!lib) {
    onError('engine-unavailable');
    return null;
  }
  const { Map, Camera } = lib;

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={style}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={false}
      attributionEnabled
      logoEnabled={false}
      onPress={(event: {
        nativeEvent?: {
          lngLat?: [number, number];
          features?: { properties?: Record<string, unknown> }[];
        };
      }) => {
        const native = event?.nativeEvent;
        const feature = native?.features?.find(
          (f) => typeof f?.properties?.id === 'string' && f?.properties?.layer === MARKER_LAYER,
        );
        const id = feature?.properties?.id;
        if (typeof id === 'string' && onMarkerPress) {
          onMarkerPress(id);
          return;
        }
        const lngLat = native?.lngLat;
        if (lngLat && onPress) {
          const point: GeoPoint = { longitude: lngLat[0], latitude: lngLat[1] };
          onPress(point);
        }
      }}
      onRegionDidChange={(event: {
        nativeEvent?: {
          center?: [number, number];
          zoom?: number;
          bounds?: { ne: [number, number]; sw: [number, number] };
        };
      }) => {
        const native = event?.nativeEvent;
        if (!native?.center || !onRegionChange) return;
        const region: MapRegion = {
          center: { longitude: native.center[0], latitude: native.center[1] },
          zoom: native.zoom ?? zoom,
          bounds: native.bounds
            ? [native.bounds.sw[0], native.bounds.sw[1], native.bounds.ne[0], native.bounds.ne[1]]
            : null,
        };
        onRegionChange(region);
      }}
    >
      <Camera {...camera} />
    </Map>
  );
}

export function useMapEngine(): MapEngineState {
  const lib = loadMapLibre();
  return lib
    ? { status: 'ready', Component: NativeMap }
    : { status: 'unavailable', Component: null };
}
