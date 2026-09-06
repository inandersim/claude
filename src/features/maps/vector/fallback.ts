import type { MapFallbackReason } from './types';

export interface FallbackInput {
  /** Çizilecek bir karo/GeoJSON kaynağı var mı? */
  hasSource: boolean;
  /** Stil belgesi hatasız çözüldü mü? */
  hasStyle: boolean;
  engineStatus: 'loading' | 'ready' | 'unavailable';
  hasEngineComponent: boolean;
  /** Motorun çalışma anında bildirdiği hata */
  failure: MapFallbackReason | null;
}

/**
 * Vektör harita yerine SVG görünümüne düşülmeli mi, düşülmeliyse neden?
 *
 * Sıra önemlidir: kaynak yoksa motoru hiç kurmaya çalışmayız; stil çözülemiyorsa
 * motorun hata vermesini beklemeyiz. `null` dönerse vektör harita çizilir.
 */
export function fallbackReason(input: FallbackInput): MapFallbackReason | null {
  if (!input.hasSource) return 'no-source';
  if (!input.hasStyle) return 'style-error';
  if (input.engineStatus === 'unavailable' || !input.hasEngineComponent)
    return 'engine-unavailable';
  return input.failure;
}
