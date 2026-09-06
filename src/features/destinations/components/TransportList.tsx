import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDuration } from '@/core/utils/time';
import { formatPriceTry, type DestinationTransport } from '@/domain';

import { TRANSPORT_ICON } from './meta';

interface Props {
  transports: DestinationTransport[];
}

/** Ulaşım adımları: mod ikonu, nereden → nereye, süre ve ₺ tahmini. */
export function TransportList({ transports }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  return (
    <View style={styles.root}>
      {transports.map((tr, i) => (
        <View
          key={`${tr.mode}-${i}`}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Icon
              name={TRANSPORT_ICON[tr.mode]}
              size={18}
              color={colors.primary}
              strokeWidth={2.2}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" color="textSubtle">
              {t(`destinations.transport.${tr.mode}`)} · {formatDuration(tr.durationMin, locale)}
            </Text>
            <Text variant="title" numberOfLines={2}>
              {tr.from} → {tr.to}
            </Text>
            {tr.note ? (
              <Text variant="caption" color="textMuted">
                {tr.note}
              </Text>
            ) : null}
          </View>
          <View style={styles.cost}>
            <Text variant="title" color={tr.costTry === null ? 'textSubtle' : 'text'}>
              {tr.costTry === null
                ? t('destinations.transport.costUnknown')
                : formatPriceTry(tr.costTry, locale, false)}
            </Text>
            {tr.costTry !== null ? (
              <Text variant="caption" color="textSubtle">
                {t('destinations.transport.perPerson')}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cost: { alignItems: 'flex-end', maxWidth: 110 },
});
