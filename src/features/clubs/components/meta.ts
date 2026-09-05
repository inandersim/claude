import type { IconName } from '@/components/ui';
import type { ClubEventKind, ClubMedal } from '@/domain';

/** Etkinlik türü → ikon. */
export const EVENT_KIND_ICON: Record<ClubEventKind, IconName> = {
  trip: 'map-pinned',
  training: 'graduation-cap',
  social: 'party-popper',
  competition: 'trophy',
  talk: 'mic',
};

/** Madalya → renk. */
export const MEDAL_COLOR: Record<ClubMedal, string> = {
  gold: '#F5B301',
  silver: '#A8B3BD',
  bronze: '#C9803A',
};
