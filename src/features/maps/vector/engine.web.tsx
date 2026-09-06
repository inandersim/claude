import {
  Map as MapLibreMap,
  addProtocol,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { GeoPoint } from '@/domain';

import type { MapEngineProps, MapRegion } from './types';

import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapEngineState {
  status: 'loading' | 'ready' | 'unavailable';
  Component: React.ComponentType<MapEngineProps> | null;
}

export const MAP_ENGINE_NAME = 'maplibre-gl';

const MARKER_LAYER = 'zirtan-ov-markers';

let protocolRegistered = false;

/** `pmtiles://` protokolünü bir kez kaydeder — karolar HTTP Range ile okunur. */
function registerPmtilesProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  addProtocol('pmtiles', protocol.tile);
  protocolRegistered = true;
}

/** WebGL yoksa (eski tarayıcı, kapalı donanım hızlandırma) harita kurulamaz. */
export function webglAvailable(): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ??
        canvas.getContext('webgl') ??
        canvas.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }
}

const toGeoPoint = (lngLat: { lng: number; lat: number }): GeoPoint => ({
  latitude: lngLat.lat,
  longitude: lngLat.lng,
});

function regionOf(map: MapLibreMap): MapRegion {
  const b = map.getBounds();
  return {
    center: toGeoPoint(map.getCenter()),
    zoom: map.getZoom(),
    bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
  };
}

function WebMap(props: MapEngineProps) {
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const lastCamera = useRef('');

  // Olay geri çağrıları her renderda değişebilir; haritayı yeniden kurmamak için ref'te tutulur.
  // Bu efekt bilinçli olarak kurulum efektinden önce tanımlanır: bağlanma sırasında
  // önce güncel geri çağrılar yazılır, sonra harita kurulur.
  const handlers = useRef({ onPress, onRegionChange, onMarkerPress, onError });
  useEffect(() => {
    handlers.current = { onPress, onRegionChange, onMarkerPress, onError };
  }, [onPress, onRegionChange, onMarkerPress, onError]);

  // Kurulum ilk stil ile bir kez; sonraki değişiklikler setStyle ile uygulanır.
  const initialStyle = useRef(style);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    registerPmtilesProtocol();
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: initialStyle.current as unknown as StyleSpecification,
        center: center ? [center.longitude, center.latitude] : [0, 0],
        zoom,
        interactive,
        attributionControl: { compact: true },
      });
    } catch {
      handlers.current.onError('engine-unavailable');
      return;
    }
    mapRef.current = map;

    // Geliştirme derlemesinde harita örneğini dışarı açar: uçtan uca testler
    // (tools/ux-audit) haritanın gerçekten çizildiğini buradan doğrular.
    if (__DEV__ && typeof window !== 'undefined') {
      const win = window as unknown as { __ZIRTAN_MAPS__?: MapLibreMap[] };
      win.__ZIRTAN_MAPS__ = [...(win.__ZIRTAN_MAPS__ ?? []), map];
    }

    // Kendi dinleyicimiz MapLibre'nin varsayılan console.error'unu devre dışı bırakır.
    // Eksik karo (kaynak hatası) beklenen bir durumdur; yalnızca stil hatası düşüş sebebidir.
    map.on('error', (event) => {
      if (__DEV__ && typeof window !== 'undefined') {
        // Geliştirmede hatalar yutulmasın: uçtan uca testler buradan okur.
        const win = window as unknown as { __ZIRTAN_MAP_ERRORS__?: string[] };
        win.__ZIRTAN_MAP_ERRORS__ = [
          ...(win.__ZIRTAN_MAP_ERRORS__ ?? []),
          String(event?.error?.message ?? event),
        ];
      }
      const sourceId = (event as unknown as { sourceId?: string }).sourceId;
      if (sourceId) return;
      const message = event?.error?.message ?? '';
      if (/style|glyph|sprite|layer/i.test(message)) handlers.current.onError('style-error');
    });

    map.on('click', (event: MapMouseEvent) => {
      const hit = map.getLayer(MARKER_LAYER)
        ? map.queryRenderedFeatures(event.point, { layers: [MARKER_LAYER] })[0]
        : undefined;
      const id = hit?.properties?.id;
      if (typeof id === 'string' && handlers.current.onMarkerPress) {
        handlers.current.onMarkerPress(id);
        return;
      }
      handlers.current.onPress?.(toGeoPoint(event.lngLat));
    });

    map.on('moveend', () => handlers.current.onRegionChange?.(regionOf(map)));

    return () => {
      if (__DEV__ && typeof window !== 'undefined') {
        const win = window as unknown as { __ZIRTAN_MAPS__?: MapLibreMap[] };
        win.__ZIRTAN_MAPS__ = (win.__ZIRTAN_MAPS__ ?? []).filter((m) => m !== map);
      }
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stil: tema varyantı, karo kaynağı, rota/iz/işaret katmanları. `diff` en az güncellemeyi yapar.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setStyle(style as unknown as StyleSpecification, { diff: true });
    } catch {
      handlers.current.onError('style-error');
    }
  }, [style]);

  // Kamera: yalnızca gerçekten değiştiğinde hareket eder (kullanıcı kaydırmasını bozmamak için).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const key = JSON.stringify({ center, zoom, bounds });
    if (key === lastCamera.current) return;
    lastCamera.current = key;
    if (bounds) {
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        { padding: 40, duration: 400, maxZoom: 15 },
      );
    } else if (center) {
      map.easeTo({ center: [center.longitude, center.latitude], zoom, duration: 400 });
    }
  }, [center, zoom, bounds]);

  const setContainer = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
  }, []);

  return (
    <div
      ref={setContainer}
      data-testid={testID}
      aria-label={accessibilityLabel}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
}

export function useMapEngine(): MapEngineState {
  const [available] = useState(webglAvailable);
  return available
    ? { status: 'ready', Component: WebMap }
    : { status: 'unavailable', Component: null };
}
