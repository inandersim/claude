import React from 'react';

import { Badge, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { writerBadge, type WriterBadgeKind, type WriterProfile } from '@/domain';

const ICONS: Record<WriterBadgeKind, IconName> = {
  verified: 'badge-check',
  pending: 'hourglass',
  top: 'star',
  writer: 'pencil',
};

/** Yazar rozeti: onaylı / bekliyor / popüler / yazar. */
export function WriterBadge({
  writer,
  soft = true,
}: {
  writer: Pick<WriterProfile, 'approvedAt' | 'isVerified' | 'followerCount'>;
  soft?: boolean;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const kind = writerBadge(writer);
  const color =
    kind === 'verified'
      ? colors.success
      : kind === 'pending'
        ? colors.warning
        : kind === 'top'
          ? colors.accent
          : colors.info;
  return <Badge label={t(`articles.badge.${kind}`)} color={color} icon={ICONS[kind]} soft={soft} />;
}
