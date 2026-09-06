import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { REACTION_META, reactionSummary, type ReactionType } from '@/domain';

interface Props {
  counts: Partial<Record<ReactionType, number>> | undefined;
  /** Sayım tablosu boşsa toplam olarak kullanılır (eski gönderiler) */
  fallbackTotal?: number;
  size?: number;
}

/** Üst üste binen küçük tepki ikonları + toplam sayı. */
export function ReactionSummary({ counts, fallbackTotal = 0, size = 18 }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const summary = reactionSummary(counts);
  const total = Math.max(summary.total, fallbackTotal);
  const top: ReactionType[] = summary.top.length > 0 ? summary.top : total > 0 ? ['like'] : [];
  if (total === 0) return null;

  return (
    <View style={styles.row} accessibilityLabel={t('social.reactionsCount', { count: total })}>
      <View style={[styles.stack, { width: size + (top.length - 1) * (size * 0.65) }]}>
        {top.map((type, index) => {
          const meta = REACTION_META[type];
          return (
            <View
              key={type}
              style={[
                styles.bubble,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: meta.color,
                  borderColor: colors.surface,
                  left: index * (size * 0.65),
                  zIndex: top.length - index,
                },
              ]}
            >
              <Icon name={meta.icon} size={size * 0.58} color="#FFFFFF" strokeWidth={2.6} />
            </View>
          );
        })}
      </View>
      <Text variant="caption" weight="bold" color="textMuted">
        {formatCompact(total, locale)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stack: { height: 18, justifyContent: 'center' },
  bubble: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
