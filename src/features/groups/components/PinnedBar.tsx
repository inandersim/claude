import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, IconButton, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { previewText, type GroupMessageWithSender } from '@/domain';

/** Sohbetin üstünde sabitlenmiş mesaj şeridi; yönetici kaldırabilir. */
export function PinnedBar({
  message,
  onPress,
  onUnpin,
}: {
  message: GroupMessageWithSender;
  onPress?: () => void;
  onUnpin?: () => void;
}) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  return (
    <View
      style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
    >
      <Tappable
        onPress={onPress}
        haptic="selection"
        scaleTo={0.995}
        style={styles.body}
        accessibilityRole="button"
        accessibilityLabel={`${t('groups.pinned')}: ${previewText(message, locale)}`}
      >
        <View style={[styles.accent, { backgroundColor: colors.primary }]} />
        <Icon name="bookmark" size={16} color={colors.primary} strokeWidth={2.4} />
        <View style={{ flex: 1 }}>
          <Text variant="label" weight="bold" color={colors.primary}>
            {t('groups.pinned')} · {message.sender.displayName}
          </Text>
          <Text variant="bodySm" numberOfLines={1}>
            {previewText(message, locale)}
          </Text>
        </View>
      </Tappable>
      {onUnpin ? (
        <IconButton
          icon="x"
          size={32}
          iconSize={16}
          variant="ghost"
          onPress={onUnpin}
          accessibilityLabel={t('groups.unpin')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.lg,
  },
  accent: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
});
