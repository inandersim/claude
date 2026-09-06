import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import {
  consultDurationMin,
  consultStatusMeta,
  doctorDisplayName,
  type ConsultationWithDetails,
} from '@/domain';

import { UrgencyBadge } from './UrgencyBadge';

interface Props {
  consultation: ConsultationWithDetails;
  /** Liste satırı olarak (geçmiş ekranı) */
  onPress?: () => void;
  compact?: boolean;
}

/** Tamamlanmış / iptal edilmiş danışma özeti: doktor, süre, talimat özeti, rehber bağlantısı. */
export function ConsultSummaryCard({ consultation, onPress, compact = false }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const meta = consultStatusMeta(consultation.status);
  const doctor = consultation.doctor;
  const [now] = useState(() => new Date());
  const minutes = consultDurationMin(consultation, now);

  return (
    <Card onPress={onPress} padded>
      <View style={styles.head}>
        <Icon name={meta.icon} size={18} color={colors[meta.color]} />
        <Text variant="label" weight="bold" color={colors[meta.color]} style={{ flex: 1 }}>
          {t(meta.labelKey)}
        </Text>
        <UrgencyBadge urgency={consultation.urgency} />
      </View>
      <Text variant="title" numberOfLines={compact ? 2 : undefined}>
        {consultation.complaint}
      </Text>
      <Text variant="caption" color="textMuted">
        {doctor
          ? doctorDisplayName(doctor, doctor.user.displayName)
          : t('telemed.consult.unassigned')}
        {' · '}
        {formatDate(consultation.createdAt, locale)}
        {consultation.acceptedAt ? ` · ${t('telemed.consult.duration', { min: minutes })}` : ''}
      </Text>
      {compact ? null : (
        <View style={[styles.summary, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="label" color="textMuted">
            {t('telemed.consult.summary')}
          </Text>
          <Text variant="bodySm">{consultation.summary ?? t('telemed.consult.summaryEmpty')}</Text>
        </View>
      )}
      {!compact && !onPress && consultation.firstAidSlug ? (
        <Button
          label={t('telemed.consult.guide')}
          icon="book-open"
          variant="secondary"
          size="sm"
          onPress={() =>
            router.push({
              pathname: '/first-aid/[slug]',
              params: { slug: consultation.firstAidSlug as string },
            })
          }
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  summary: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    gap: 4,
  },
});
