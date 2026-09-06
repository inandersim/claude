import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatPriceTry, type DestinationPermit } from '@/domain';

interface Props {
  permits: DestinationPermit[];
}

/** İzinler: ad, ücret (₺), nereden alınır, not. Boşsa "izin gerekmiyor". */
export function PermitList({ permits }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();

  if (permits.length === 0) {
    return (
      <View
        style={[styles.empty, { backgroundColor: colors.successSoft, borderColor: colors.success }]}
      >
        <Icon name="circle-check" size={18} color={colors.success} />
        <Text variant="bodySm" color="success" weight="semibold">
          {t('destinations.permits.empty')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {permits.map((p, i) => (
        <View
          key={`${p.name}-${i}`}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.head}>
            <Icon name="ticket" size={18} color={colors.accent} strokeWidth={2.2} />
            <Text variant="title" style={{ flex: 1 }} numberOfLines={2}>
              {p.name}
            </Text>
            <Text variant="title" color={p.costTry === null ? 'textSubtle' : 'accent'}>
              {p.costTry === null
                ? t('destinations.transport.costUnknown')
                : p.costTry === 0
                  ? t('destinations.permits.free')
                  : formatPriceTry(p.costTry, locale, false)}
            </Text>
          </View>
          <View style={styles.meta}>
            <Icon name="map-pin" size={13} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('destinations.permits.where')}: {p.where}
            </Text>
          </View>
          {p.note ? (
            <Text variant="caption" color="textMuted">
              {p.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
