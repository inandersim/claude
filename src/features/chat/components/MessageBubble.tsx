import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatTime } from '@/core/utils/time';
import type { Message } from '@/domain';

export function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, mine ? styles.mineRow : styles.theirsRow]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.surfaceMuted, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text variant="body" color={mine ? colors.onPrimary : colors.text}>
          {message.content}
        </Text>
        <View style={styles.meta}>
          <Text variant="label" color={mine ? 'rgba(6,18,11,0.6)' : colors.textSubtle}>
            {formatTime(message.createdAt)}
          </Text>
          {mine ? (
            <Icon
              name={message.readAt ? 'check-check' : 'check'}
              size={12}
              color="rgba(6,18,11,0.6)"
              strokeWidth={2.6}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginVertical: 3 },
  mineRow: { justifyContent: 'flex-end' },
  theirsRow: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    gap: 2,
  },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
});
