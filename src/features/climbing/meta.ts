import type { IconName } from '@/components/ui';
import type { TranslationKey } from '@/core/i18n';
import type { AscentStyle, ClimbType, GradeSystem, VerificationStatus } from '@/domain';

/** Tırmanış türü görsel meta verisi (ikon, renk, i18n anahtarı). */
export const CLIMB_TYPE_META: Record<
  ClimbType,
  { labelKey: TranslationKey; icon: IconName; color: string }
> = {
  sport: { labelKey: 'climbing.type.sport', icon: 'zap', color: '#FF8A5B' },
  trad: { labelKey: 'climbing.type.trad', icon: 'anchor', color: '#C08B4A' },
  boulder: { labelKey: 'climbing.type.boulder', icon: 'hexagon', color: '#8B7CF6' },
  multipitch: { labelKey: 'climbing.type.multipitch', icon: 'layers', color: '#3BA3FF' },
  ice: { labelKey: 'climbing.type.ice', icon: 'snowflake', color: '#5FD4E8' },
  alpine: { labelKey: 'climbing.type.alpine', icon: 'mountain-snow', color: '#9AAEA3' },
};

export const ASCENT_STYLE_META: Record<AscentStyle, { labelKey: TranslationKey; icon: IconName }> =
  {
    onsight: { labelKey: 'climbing.style.onsight', icon: 'eye' },
    flash: { labelKey: 'climbing.style.flash', icon: 'zap' },
    redpoint: { labelKey: 'climbing.style.redpoint', icon: 'target' },
    toprope: { labelKey: 'climbing.style.toprope', icon: 'anchor' },
    attempt: { labelKey: 'climbing.style.attempt', icon: 'repeat' },
  };

export const VERIFICATION_META: Record<
  VerificationStatus,
  { labelKey: TranslationKey; descriptionKey: TranslationKey; icon: IconName; color: string }
> = {
  unverified: {
    labelKey: 'climbing.verification.unverified',
    descriptionKey: 'climbing.verification.unverifiedDescription',
    icon: 'circle-alert',
    color: '#E9930C',
  },
  community: {
    labelKey: 'climbing.verification.community',
    descriptionKey: 'climbing.verification.communityDescription',
    icon: 'users',
    color: '#2E86F5',
  },
  verified: {
    labelKey: 'climbing.verification.verified',
    descriptionKey: 'climbing.verification.verifiedDescription',
    icon: 'badge-check',
    color: '#16A35A',
  },
};

export const GRADE_SYSTEM_LABEL_KEY: Record<GradeSystem, TranslationKey> = {
  french: 'climbing.gradeSystem.french',
  yds: 'climbing.gradeSystem.yds',
  uiaa: 'climbing.gradeSystem.uiaa',
  font: 'climbing.gradeSystem.font',
  v_scale: 'climbing.gradeSystem.v_scale',
};
