import type { IconName } from '@/components/ui';
import type { NavManeuver, PoiKind, TrackSource } from '@/domain';

/** POI türü → ikon */
export const POI_ICON: Record<PoiKind, IconName> = {
  campsite: 'tent',
  water: 'droplets',
  viewpoint: 'eye',
  shelter: 'house',
  danger: 'triangle-alert',
  junction: 'waypoints',
  summit: 'mountain-snow',
  parking: 'square',
  food: 'flame',
  trailhead: 'flag',
  other: 'map-pin',
};

/** POI türü → renk (temadan bağımsız, rozet/ikon için) */
export const POI_COLOR: Record<PoiKind, string> = {
  campsite: '#F2A541',
  water: '#4FC3F7',
  viewpoint: '#B388FF',
  shelter: '#8D6E63',
  danger: '#FF5252',
  junction: '#90A4AE',
  summit: '#E0E0E0',
  parking: '#78909C',
  food: '#FF8A5B',
  trailhead: '#5EE39B',
  other: '#9E9E9E',
};

/** Parça kaynağı → ikon + renk */
export const SOURCE_META: Record<TrackSource, { icon: IconName; color: string }> = {
  recorded: { icon: 'locate-fixed', color: '#5EE39B' },
  gpx: { icon: 'file-down', color: '#90A4AE' },
  strava: { icon: 'activity', color: '#FC4C02' },
  komoot: { icon: 'route', color: '#6AA127' },
  alltrails: { icon: 'trees', color: '#428A13' },
  wikiloc: { icon: 'map', color: '#4BAF4F' },
  garmin: { icon: 'watch', color: '#007CC3' },
  media: { icon: 'camera', color: '#B388FF' },
};

/** Manevra → ikon (+ döndürme açısı) */
export const MANEUVER_ICON: Record<NavManeuver, { icon: IconName; rotate: number }> = {
  start: { icon: 'flag', rotate: 0 },
  continue: { icon: 'arrow-up', rotate: 0 },
  slight_left: { icon: 'arrow-up', rotate: -35 },
  left: { icon: 'arrow-up', rotate: -90 },
  sharp_left: { icon: 'arrow-up', rotate: -135 },
  slight_right: { icon: 'arrow-up', rotate: 35 },
  right: { icon: 'arrow-up', rotate: 90 },
  sharp_right: { icon: 'arrow-up', rotate: 135 },
  uturn: { icon: 'arrow-up', rotate: 180 },
  waypoint: { icon: 'map-pin', rotate: 0 },
  arrive: { icon: 'flag-triangle-right', rotate: 0 },
};

/** Süreyi ss:dd:ss biçimine çevirir */
export function formatClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
