import type { ComponentType } from 'react';

import type { MapEngineProps } from './types';

export interface MapEngineState {
  status: 'loading' | 'ready' | 'unavailable';
  Component: ComponentType<MapEngineProps> | null;
}

/**
 * Varsayılan (platform dosyası olmayan) motor: yok.
 * Metro web'de `engine.web.tsx`, iOS/Android'de `engine.native.tsx` dosyasını seçer;
 * bu dosya yalnızca Node/test ortamında yüklenir ve MapView'ı SVG'ye düşürür.
 */
export function useMapEngine(): MapEngineState {
  return { status: 'unavailable', Component: null };
}

export const MAP_ENGINE_NAME = 'none';
