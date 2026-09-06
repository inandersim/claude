import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Icon, Tappable, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import type { NotificationType, NotificationWithSender } from '@/domain';

const typeMeta: Record<NotificationType, { icon: IconName; color: string }> = {
  match_request: { icon: 'heart-handshake', color: '#FFB547' },
  match_accepted: { icon: 'circle-check', color: '#5EE39B' },
  match_rejected: { icon: 'circle-x', color: '#FF6B6B' },
  message: { icon: 'message-circle', color: '#6CB4FF' },
  like: { icon: 'heart', color: '#FF6B6B' },
  comment: { icon: 'message-circle', color: '#CE93D8' },
  follow: { icon: 'user-plus', color: '#5EE39B' },
  booking_request: { icon: 'graduation-cap', color: '#FFB547' },
  booking_confirmed: { icon: 'calendar-check', color: '#5EE39B' },
  booking_declined: { icon: 'circle-x', color: '#FF6B6B' },
  hazard_alert: { icon: 'triangle-alert', color: '#FF6B6B' },
  hazard_confirmed: { icon: 'shield-check', color: '#5EE39B' },
  stream_live: { icon: 'radio', color: '#FF6B6B' },
  sos_alert: { icon: 'siren', color: '#FF6B6B' },
  stay_request: { icon: 'building-2', color: '#FFB547' },
  stay_confirmed: { icon: 'calendar-check', color: '#5EE39B' },
  story_posted: { icon: 'sparkles', color: '#CE93D8' },
  reaction: { icon: 'heart', color: '#FF6B9D' },
  mention: { icon: 'at-sign', color: '#6CB4FF' },
  repost: { icon: 'repeat', color: '#5EE39B' },
  group_invite: { icon: 'users', color: '#FFD54F' },
  group_message: { icon: 'message-square', color: '#6CB4FF' },
  trip_overdue: { icon: 'timer', color: '#FF6B6B' },
  course_enrolled: { icon: 'graduation-cap', color: '#5EE39B' },
  certificate_issued: { icon: 'award', color: '#FFB547' },
};

export function NotificationItem({
  notification,
  onPress,
}: {
  notification: NotificationWithSender;
  onPress: (n: NotificationWithSender) => void;
}) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const meta = typeMeta[notification.type];

  return (
    <Tappable
      onPress={() => onPress(notification)}
      scaleTo={0.985}
      haptic="selection"
      style={[
        styles.row,
        { backgroundColor: notification.isRead ? 'transparent' : colors.primarySoft },
      ]}
      accessibilityRole="button"
    >
      <View>
        <Avatar
          uri={notification.sender.avatarUrl}
          name={notification.sender.displayName}
          size={46}
        />
        <View
          style={[
            styles.typeBadge,
            { backgroundColor: meta.color, borderColor: colors.background },
          ]}
        >
          <Icon
            name={meta.icon}
            size={11}
            color="#06120B"
            strokeWidth={2.8}
            fill={notification.type === 'like' ? '#06120B' : 'none'}
          />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodySm">
          <Text variant="bodySm" weight="bold">
            {notification.sender.displayName}
          </Text>{' '}
          {t(`notificationTypes.${notification.type}`)}
        </Text>
        {notification.message ? (
          <Text variant="caption" color="textMuted" numberOfLines={1} style={{ marginTop: 2 }}>
            {notification.message}
          </Text>
        ) : null}
        <Text variant="caption" color="textSubtle" style={{ marginTop: 2 }}>
          {formatRelative(notification.createdAt, new Date(), locale)}
        </Text>
      </View>
      {!notification.isRead ? (
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      ) : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginHorizontal: spacing.sm,
  },
  typeBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
