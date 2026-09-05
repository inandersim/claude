import React from 'react';

import { Badge } from '@/components/ui';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import type { StudentVerification } from '@/domain';

/** Doğrulanmış öğrenci rozeti; kayıt yoksa ya da doğrulanmamışsa render etmez. */
export function StudentBadge({
  verification,
}: {
  verification: StudentVerification | null | undefined;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  if (!verification?.verifiedAt) return null;
  return (
    <Badge
      label={`${t('clubs.verify.badge')} · ${verification.university}`}
      color={colors.info}
      icon="graduation-cap"
    />
  );
}
