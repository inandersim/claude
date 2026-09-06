import React from 'react';

import { Badge, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { useTheme, type Palette } from '@/core/theme';
import type { DangerLevel } from '@/domain';
import { dangerMeta } from '@/domain';

const DANGER_ICONS: Record<DangerLevel, IconName> = {
  harmless: 'circle-check',
  caution: 'circle-alert',
  dangerous: 'triangle-alert',
  deadly: 'shield-alert',
};

/** Tehlike düzeyinin tema rengi. */
export function dangerColor(level: DangerLevel, colors: Palette): string {
  return colors[dangerMeta(level).colorKey];
}

export interface DangerBadgeProps {
  level: DangerLevel;
  solid?: boolean;
}

/** Zararsız → yeşil, dikkat → mavi, tehlikeli → sarı, ölümcül → kırmızı rozet. */
export function DangerBadge({ level, solid = false }: DangerBadgeProps) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <Badge
      label={t(dangerMeta(level).labelKey)}
      color={dangerColor(level, colors)}
      icon={DANGER_ICONS[level]}
      soft={!solid}
    />
  );
}
