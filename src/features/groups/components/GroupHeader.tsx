import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Icon, IconButton, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import type { GroupWithMembership } from '@/domain';

/** Sohbet başlığı: geri, avatar, ad, üye sayısı/kanal; dokununca bilgi ekranı. */
export function GroupHeader({
  group,
  onBack,
  onInfo,
  muted,
}: {
  group: GroupWithMembership | null | undefined;
  onBack: () => void;
  onInfo: () => void;
  muted?: boolean;
}) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const isChannel = group?.kind === 'channel';
  const subtitle = group
    ? isChannel
      ? `${t('groups.kind.channel')} · ${t('groups.subscriberCount', { count: formatCompact(group.memberCount, locale) })}`
      : t('groups.memberCount', { count: formatCompact(group.memberCount, locale) })
    : '';

  return (
    <View
      style={[styles.bar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}
    >
      <IconButton
        icon="arrow-left"
        variant="ghost"
        size={40}
        onPress={onBack}
        accessibilityLabel={t('common.back')}
      />
      <Tappable
        onPress={onInfo}
        haptic="selection"
        scaleTo={0.99}
        style={styles.body}
        disabled={!group}
        accessibilityRole="button"
        accessibilityLabel={group ? `${group.name}. ${t('groups.seeInfo')}` : t('common.loading')}
      >
        {group ? <Avatar uri={group.avatarUrl} name={group.name} size={38} /> : null}
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            {isChannel ? (
              <Icon name="radio" size={14} color={colors.primary} strokeWidth={2.4} />
            ) : null}
            {group?.privacy === 'private' ? (
              <Icon name="lock" size={13} color={colors.textSubtle} strokeWidth={2.4} />
            ) : null}
            <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
              {group?.name ?? t('common.loading')}
            </Text>
            {muted ? <Icon name="moon" size={13} color={colors.textSubtle} /> : null}
          </View>
          {subtitle ? (
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Tappable>
      <IconButton
        icon="info"
        variant="ghost"
        size={40}
        onPress={onInfo}
        disabled={!group}
        accessibilityLabel={t('groups.seeInfo')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
