import React from 'react';

import { Badge } from '@/components/ui';
import { currentLocale, useT } from '@/core/i18n';
import { HAZARD_SEVERITY_META, type HazardSeverity } from '@/domain';

export function SeverityBadge({
  severity,
  soft = true,
}: {
  severity: HazardSeverity;
  soft?: boolean;
}) {
  const { t } = useT();
  const meta = HAZARD_SEVERITY_META[severity];
  return (
    <Badge
      label={t(meta.labelKey).toLocaleUpperCase(currentLocale())}
      color={meta.color}
      icon={severity === 'critical' ? 'siren' : 'triangle-alert'}
      soft={soft}
    />
  );
}
