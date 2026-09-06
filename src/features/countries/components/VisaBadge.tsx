import React from 'react';

import { Badge } from '@/components/ui';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { visaLabel, type VisaInfo } from '@/domain';
import { VISA_META } from '@/features/countries/meta';

interface Props {
  visa: Pick<VisaInfo, 'type'>;
  soft?: boolean;
}

/** Vize türü rozeti — renk ve ikon türe göre. */
export function VisaBadge({ visa, soft = true }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = VISA_META[visa.type];
  return (
    <Badge
      label={t(visaLabel(visa, locale))}
      icon={meta.icon}
      color={colors[meta.color]}
      soft={soft}
    />
  );
}
