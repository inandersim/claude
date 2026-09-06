import type { IconName } from '@/components/ui';
import type { Palette } from '@/core/theme';
import type { LawTone, VisaType } from '@/domain';

/** Vize türü → ikon ve tema renk anahtarı. */
export const VISA_META: Record<VisaType, { icon: IconName; color: keyof Palette }> = {
  visa_free: { icon: 'circle-check', color: 'success' },
  e_visa: { icon: 'globe', color: 'info' },
  on_arrival: { icon: 'stamp', color: 'primary' },
  embassy: { icon: 'landmark', color: 'warning' },
  banned: { icon: 'ban', color: 'danger' },
};

/** Yasa sinyali → renk anahtarı. */
export const LAW_TONE_COLOR: Record<LawTone, keyof Palette> = {
  allowed: 'success',
  restricted: 'warning',
  banned: 'danger',
};
