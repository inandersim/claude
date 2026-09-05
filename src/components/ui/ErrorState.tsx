import React from 'react';

import { useT } from '@/core/i18n';

import { EmptyState } from './EmptyState';

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useT();
  return (
    <EmptyState
      icon="wifi-off"
      title={t('common.error')}
      description={message ?? t('common.errorDescription')}
      action={
        onRetry
          ? { label: t('common.retry'), onPress: onRetry, icon: 'refresh-cw', variant: 'secondary' }
          : undefined
      }
    />
  );
}
