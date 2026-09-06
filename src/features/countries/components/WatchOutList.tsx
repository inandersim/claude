import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/core/theme';

interface Props {
  items: string[];
}

/** Uyarı renkli "dikkat" kartları. İlk cümle başlık gibi kalın gösterilir. */
export function WatchOutList({ items }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.list}>
      {items.map((item, index) => {
        const split = item.indexOf(':');
        const head = split > 0 && split < 60 ? item.slice(0, split) : null;
        const body = head ? item.slice(split + 1).trim() : item;
        return (
          <View
            key={`${index}-${item.slice(0, 12)}`}
            style={[
              styles.card,
              { backgroundColor: colors.warningSoft, borderColor: colors.warning },
            ]}
          >
            <Icon name="triangle-alert" size={18} color={colors.warning} strokeWidth={2.4} />
            <View style={styles.body}>
              {head ? (
                <Text variant="body" weight="bold">
                  {head}
                </Text>
              ) : null}
              <Text variant="bodySm" color={head ? 'textMuted' : 'text'}>
                {body}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  body: { flex: 1, gap: spacing.xxs },
});
