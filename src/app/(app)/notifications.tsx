import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, Header, Screen, Skeleton, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing } from '@/core/theme';
import { dateGroup, type DateGroup } from '@/core/utils/time';
import type { NotificationWithSender } from '@/domain';
import { NotificationItem } from '@/features/notifications/components/NotificationItem';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications/hooks';

const groupOrder: DateGroup[] = ['today', 'yesterday', 'earlier'];

export default function NotificationsScreen() {
  const { t } = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const sections = useMemo(() => {
    const buckets: Record<DateGroup, NotificationWithSender[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const n of notifications.data ?? []) buckets[dateGroup(n.createdAt)].push(n);
    return groupOrder
      .filter((g) => buckets[g].length > 0)
      .map((g) => ({ title: t(`notifications.${g}`), data: buckets[g] }));
  }, [notifications.data, t]);

  const unread = notifications.data?.filter((n) => !n.isRead).length ?? 0;

  const onPress = useCallback(
    (n: NotificationWithSender) => {
      if (!n.isRead) markRead.mutate(n.id);
      switch (n.type) {
        case 'match_request':
        case 'match_accepted':
        case 'match_rejected':
          if (n.matchId) router.push({ pathname: '/match/[id]', params: { id: n.matchId } });
          break;
        case 'message':
          router.push({
            pathname: '/chat/[id]',
            params: { id: n.senderId, matchId: n.matchId ?? '' },
          });
          break;
        case 'like':
        case 'comment':
          if (n.postId) router.push({ pathname: '/post/[id]', params: { id: n.postId } });
          break;
        case 'follow':
          router.push({ pathname: '/user/[id]', params: { id: n.senderId } });
          break;
        case 'booking_request':
        case 'booking_confirmed':
        case 'booking_declined':
          router.push('/bookings');
          break;
        case 'hazard_alert':
        case 'hazard_confirmed':
          if (n.targetId) router.push({ pathname: '/hazards/[id]', params: { id: n.targetId } });
          break;
        case 'stream_live':
          if (n.targetId) router.push({ pathname: '/live/[id]', params: { id: n.targetId } });
          break;
      }
    },
    [markRead, router],
  );

  return (
    <Screen edges={['top']}>
      <Header
        title={t('notifications.title')}
        subtitle={unread > 0 ? `${unread} ${t('notifications.unread')}` : undefined}
        showBack
        right={
          unread > 0 ? (
            <Tappable
              onPress={() => markAll.mutate()}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={t('notifications.markAllRead')}
            >
              <Text variant="caption" weight="bold" color="primary">
                {t('notifications.markAllRead')}
              </Text>
            </Tappable>
          ) : null
        }
      />

      {notifications.isError ? (
        <ErrorState onRetry={() => notifications.refetch()} />
      ) : notifications.isLoading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={70} style={{ borderRadius: radius.lg }} />
          ))}
        </View>
      ) : sections.length === 0 ? (
        <EmptyState
          icon="bell"
          title={t('notifications.empty')}
          description={t('notifications.emptyDescription')}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationItem notification={item} onPress={onPress} />}
          renderSectionHeader={({ section }) => (
            <Text variant="label" color="textSubtle" style={styles.sectionTitle}>
              {section.title.toLocaleUpperCase('tr-TR')}
            </Text>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + spacing.xl,
            gap: 2,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  skeletons: { paddingHorizontal: spacing.lg, gap: spacing.sm },
});
