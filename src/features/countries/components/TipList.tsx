import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { radius, spacing, useTheme } from '@/core/theme';

interface Props {
  items: string[];
  icon?: IconName;
  color?: string;
  /** Sıra numarası göster (vize adımları için) */
  numbered?: boolean;
}

/** İkonlu ya da numaralı madde listesi. */
export function TipList({ items, icon = 'lightbulb', color, numbered = false }: Props) {
  const { colors } = useTheme();
  const tint = color ?? colors.primary;
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={`${index}-${item.slice(0, 12)}`} style={styles.row}>
          {numbered ? (
            <View style={[styles.number, { backgroundColor: tint }]}>
              <Text variant="label" weight="extrabold" color="onPrimary">
                {index + 1}
              </Text>
            </View>
          ) : (
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
              <Icon name={icon} size={14} color={tint} strokeWidth={2.4} />
            </View>
          )}
          <Text variant="body" style={styles.text}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  number: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  text: { flex: 1 },
});
