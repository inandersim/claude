import React from 'react';

import { Badge } from '@/components/ui';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { urgencyMeta, type ConsultUrgency } from '@/domain';

/** Aciliyet rozeti (renk + ikon `urgencyMeta`'dan). */
export function UrgencyBadge({
  urgency,
  soft = true,
}: {
  urgency: ConsultUrgency;
  soft?: boolean;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const meta = urgencyMeta(urgency);
  return <Badge label={t(meta.labelKey)} color={colors[meta.color]} icon={meta.icon} soft={soft} />;
}
