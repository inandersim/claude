import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { formatRelative } from '@/core/utils/time';
import { previewText, type GroupWithMembership } from '@/domain';

/**
 * Sohbet listesi satırı: avatar/baş harf, ad, kanal ikonu, son mesaj önizlemesi,
 * saat, okunmamış rozeti ve sessiz ikonu.
 */
export function GroupRow({
  group,
  muted = false,
  onPress,
  showJoin,
  onJoin,
}: {
  group: GroupWithMembership;
  muted?: boolean;
  onPress: () => void;
  /** Keşfet modunda üye sayısı + Katıl */
  showJoin?: boolean;
  onJoin?: () => void;
}) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const isChannel = group.kind === 'channel';
  const preview = previewText(group.lastMessage, locale);
  const unread = group.unreadCount;
  const countLabel = isChannel
    ? t('groups.subscriberCount', { count: formatCompact(group.memberCount, locale) })
    : t('groups.memberCount', { count: formatCompact(group.memberCount, locale) });

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border }]}>
      <Tappable
        onPress={onPress}
        haptic="selection"
        scaleTo={0.985}
        style={styles.row}
        accessibilityRole="button"
        accessibilityLabel={`${group.name}${unread ? `, ${t('groups.unread', { count: unread })}` : ''}`}
      >
        <View>
          <Avatar uri={group.avatarUrl} name={group.name} size={52} />
          {isChannel ? (
            <View
              style={[
                styles.kindBadge,
                { backgroundColor: colors.primary, borderColor: colors.background },
              ]}
            >
              <Icon name="radio" size={10} color={colors.onPrimary} strokeWidth={2.6} />
            </View>
          ) : group.privacy === 'private' ? (
            <View
              style={[
                styles.kindBadge,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.background },
              ]}
            >
              <Icon name="lock" size={10} color={colors.textMuted} strokeWidth={2.6} />
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
              {group.name}
            </Text>
            {muted ? <Icon name="moon" size={14} color={colors.textSubtle} /> : null}
            {group.lastMessageAt ? (
              <Text variant="caption" color={unread ? colors.primary : colors.textSubtle}>
                {formatRelative(group.lastMessageAt, new Date(), locale)}
              </Text>
            ) : null}
          </View>
          <View style={styles.previewRow}>
            <Text
              variant="bodySm"
              color={unread ? colors.text : colors.textMuted}
              weight={unread ? 'semibold' : 'regular'}
              numberOfLines={showJoin ? 1 : 2}
              style={{ flex: 1 }}
            >
              {showJoin ? countLabel : preview || group.description}
            </Text>
            {unread > 0 ? (
              <View
                style={[
                  styles.unread,
                  { backgroundColor: muted ? colors.textSubtle : colors.primary },
                ]}
              >
                <Text variant="label" weight="extrabold" color={colors.onPrimary}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Tappable>
      {showJoin && onJoin ? (
        <Tappable
          onPress={onJoin}
          haptic="light"
          style={[styles.join, { backgroundColor: colors.primarySoft }]}
          accessibilityRole="button"
          accessibilityLabel={`${t('groups.join')}: ${group.name}`}
        >
          <Text variant="caption" weight="bold" color={colors.primary}>
            {t('groups.join')}
          </Text>
        </Tappable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingRight: spacing.lg,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
  },
  kindBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  join: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
});
