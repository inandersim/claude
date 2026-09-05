import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { VerificationStatus } from '@/domain';

import { VERIFICATION_META } from '../meta';

export interface VerificationBadgeProps {
  status: VerificationStatus;
  /** Açıklamalı kart görünümü (rota/kaya detayında) */
  explained?: boolean;
  /** Topluluk onayı için ilerleme: mevcut / gereken */
  confirmations?: number;
  needed?: number;
}

/** unverified / community / verified rozeti; `explained` ile açıklama kartı. */
export function VerificationBadge({
  status,
  explained = false,
  confirmations,
  needed,
}: VerificationBadgeProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const meta = VERIFICATION_META[status];

  if (!explained) {
    return <Badge label={t(meta.labelKey)} color={meta.color} icon={meta.icon} />;
  }

  const showProgress = status === 'unverified' && confirmations !== undefined && needed;

  return (
    <View
      style={[styles.card, { backgroundColor: `${meta.color}14`, borderColor: `${meta.color}55` }]}
      accessibilityRole="summary"
      accessibilityLabel={`${t(meta.labelKey)}. ${t(meta.descriptionKey)}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: meta.color }]}>
        <Icon name={meta.icon} size={18} color="#FFFFFF" strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" color={meta.color}>
          {t(meta.labelKey)}
        </Text>
        <Text variant="bodySm" color="textMuted">
          {t(meta.descriptionKey)}
        </Text>
        {showProgress ? (
          <View style={styles.progressRow}>
            <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: meta.color,
                    width: `${Math.min(100, ((confirmations ?? 0) / needed) * 100)}%`,
                  },
                ]}
              />
            </View>
            <Text variant="caption" weight="bold" color={meta.color}>
              {t('climbing.confirmationsCount', { count: confirmations ?? 0, needed })}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
