import type { IconName } from '@/components/ui';
import type { RouteDifficulty, RouteProfile, Surface } from '@/domain';

/** Profil ikonları (yalnızca kayıtlı IconName değerleri) */
export const PROFILE_ICON: Record<RouteProfile, IconName> = {
  hike: 'footprints',
  trail_run: 'activity',
  mtb: 'bike',
  gravel: 'route',
  ski_tour: 'mountain-snow',
};

/** Harita üzerinde yüzey renkleri (tema bağımsız, doygun) */
export const SURFACE_COLOR: Record<Surface, string> = {
  trail: '#8DBB7B',
  gravel: '#C9A86A',
  paved: '#8C9AA6',
  rock: '#B07A5C',
  scree: '#A38A7A',
  snow: '#9FD1F0',
};

/** Zorluk rozet renkleri */
export const DIFFICULTY_COLOR: Record<RouteDifficulty, string> = {
  easy: '#5EE39B',
  moderate: '#A3E635',
  hard: '#FFB547',
  expert: '#FF6B6B',
};

/** MB → okunabilir boyut */
export function formatMb(sizeMb: number, locale = 'tr'): string {
  if (sizeMb >= 1000) {
    const gb = (sizeMb / 1024).toFixed(1);
    return `${locale === 'tr' ? gb.replace('.', ',') : gb} GB`;
  }
  return `${Math.round(sizeMb)} MB`;
}
