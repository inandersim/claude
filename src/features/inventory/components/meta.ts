import type { IconName } from '@/components/ui';
import type { CancellationPolicy, HostVerificationLevel, PaymentStatus, UnitKind } from '@/domain';

/** Birim türü ikonları (yalnızca mevcut IconName değerleri) */
export const UNIT_KIND_ICON: Record<UnitKind, IconName> = {
  room: 'house',
  tent_pitch: 'tent',
  bungalow: 'trees',
  dorm_bed: 'moon',
  rv_spot: 'route',
};

/** Ödeme durumu renkleri */
export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  pending: '#9AAEA3',
  authorized: '#6CB4FF',
  escrow: '#FFB547',
  released: '#5EE39B',
  refunded: '#C39BFF',
  failed: '#FF6B6B',
};

export const PAYMENT_STATUS_ICON: Record<PaymentStatus, IconName> = {
  pending: 'hourglass',
  authorized: 'credit-card',
  escrow: 'lock',
  released: 'circle-check',
  refunded: 'refresh-cw',
  failed: 'circle-x',
};

/** İptal politikası renk/ikon */
export const POLICY_META: Record<CancellationPolicy, { color: string; icon: IconName }> = {
  flexible: { color: '#5EE39B', icon: 'heart-handshake' },
  moderate: { color: '#FFB547', icon: 'shield' },
  strict: { color: '#FF6B6B', icon: 'lock' },
};

export const VERIFICATION_ICON: Record<HostVerificationLevel, IconName> = {
  none: 'circle-alert',
  id: 'user-check',
  address: 'map-pinned',
  premium: 'badge-check',
};

/** Rezervasyon durumu renkleri */
export const STAY_STATUS_COLOR = {
  pending: '#FFB547',
  confirmed: '#6CB4FF',
  cancelled: '#FF6B6B',
  completed: '#5EE39B',
} as const;
