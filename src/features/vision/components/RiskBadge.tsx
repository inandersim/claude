import React from 'react';

import { Badge, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { useTheme, type Palette } from '@/core/theme';
import type { RiskLevel } from '@/domain';

/** Risk seviyesinin tema rengi. */
export function riskColor(risk: RiskLevel, colors: Palette): string {
  switch (risk) {
    case 'low':
      return colors.success;
    case 'moderate':
      return colors.info;
    case 'high':
      return colors.warning;
    case 'extreme':
      return colors.danger;
  }
}

const RISK_ICONS: Record<RiskLevel, IconName> = {
  low: 'circle-check',
  moderate: 'circle-alert',
  high: 'triangle-alert',
  extreme: 'shield-alert',
};

export interface RiskBadgeProps {
  risk: RiskLevel;
  /** Dolu (koyu arka plan) versiyon */
  solid?: boolean;
}

/** Renkli risk rozeti: düşük → yeşil, orta → mavi, yüksek → sarı, çok yüksek → kırmızı. */
export function RiskBadge({ risk, solid = false }: RiskBadgeProps) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <Badge
      label={`${t('vision.risk.title')}: ${t(`vision.risk.${risk}`)}`}
      color={riskColor(risk, colors)}
      icon={RISK_ICONS[risk]}
      soft={!solid}
    />
  );
}
