import React from 'react';

import { Badge } from '@/components/ui';
import { useT } from '@/core/i18n';
import { ADVENTURE_TYPE_META, type AdventureType } from '@/domain';

export function AdventureTypeBadge({ type }: { type: AdventureType }) {
  const { t } = useT();
  const meta = ADVENTURE_TYPE_META[type];
  return <Badge label={t(meta.labelKey)} color={meta.color} icon={meta.icon} />;
}
