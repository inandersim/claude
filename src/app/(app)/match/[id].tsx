import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { currentLocale, useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDate, formatRelative } from '@/core/utils/time';
import { ADVENTURE_TYPE_META, MATCH_STATUS_META, otherPartyId } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useMatch, useRespondMatch } from '@/features/zmatch/hooks';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const match = useMatch(id);
  const respond = useRespondMatch();

  const data = match.data;
  const incoming = data?.receiverId === me.id;
  const other = data ? (incoming ? data.requester : data.receiver) : null;

  const onRespond = (accept: boolean) => {
    respond.mutate(
      { matchId: id, accept },
      {
        onSuccess: () =>
          toast(
            accept ? t('zmatch.acceptedToast') : t('zmatch.rejectedToast'),
            accept ? 'success' : 'info',
          ),
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={t('zmatch.matchDetail')} showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {match.isError ? (
          <ErrorState onRetry={() => match.refetch()} />
        ) : match.isLoading ? (
          <Skeleton height={320} style={{ borderRadius: radius.xl }} />
        ) : data && other ? (
          <>
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Tappable
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: other.id } })}
                haptic="selection"
                style={styles.userRow}
                accessibilityRole="button"
              >
                <Avatar
                  uri={other.avatarUrl}
                  name={other.displayName}
                  size={64}
                  verified={other.isVerified}
                  ring
                />
                <View style={{ flex: 1 }}>
                  <Text variant="h2">{other.displayName}</Text>
                  <Text variant="bodySm" color="textMuted">
                    @{other.username} · {other.locationName}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.textSubtle} />
              </Tappable>

              <View style={styles.statusRow}>
                <Badge
                  label={t(MATCH_STATUS_META[data.status].labelKey)}
                  color={MATCH_STATUS_META[data.status].color}
                  icon={
                    data.status === 'accepted'
                      ? 'circle-check'
                      : data.status === 'rejected'
                        ? 'circle-x'
                        : 'hourglass'
                  }
                />
                <Text variant="caption" color="textSubtle">
                  {incoming ? t('zmatch.incoming') : t('zmatch.outgoing')} ·{' '}
                  {formatRelative(data.createdAt, new Date(), locale)}
                </Text>
              </View>

              {data.message ? (
                <View
                  style={[
                    styles.quote,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderLeftColor: ADVENTURE_TYPE_META[data.adventureType].color,
                    },
                  ]}
                >
                  <Text variant="body">“{data.message}”</Text>
                </View>
              ) : null}

              <View style={styles.details}>
                <Detail
                  icon={ADVENTURE_TYPE_META[data.adventureType].icon}
                  label={t('post.adventureType')}
                  value={t(ADVENTURE_TYPE_META[data.adventureType].labelKey)}
                  color={ADVENTURE_TYPE_META[data.adventureType].color}
                />
                {data.locationName ? (
                  <Detail icon="map-pin" label={t('post.location')} value={data.locationName} />
                ) : null}
                {data.plannedDate ? (
                  <Detail
                    icon="calendar"
                    label={t('zmatch.plannedDate')}
                    value={formatDate(data.plannedDate, locale)}
                  />
                ) : null}
              </View>
            </View>

            {incoming && data.status === 'pending' ? (
              <View style={styles.actions}>
                <Button
                  label={t('zmatch.reject')}
                  variant="secondary"
                  icon="x"
                  style={{ flex: 1 }}
                  onPress={() => onRespond(false)}
                  disabled={respond.isPending}
                />
                <Button
                  label={t('zmatch.accept')}
                  icon="check"
                  style={{ flex: 1.4 }}
                  onPress={() => onRespond(true)}
                  loading={respond.isPending}
                />
              </View>
            ) : null}

            {data.status === 'accepted' ? (
              <Button
                label={t('zmatch.message')}
                icon="message-circle"
                fullWidth
                size="lg"
                onPress={() =>
                  router.push({
                    pathname: '/chat/[id]',
                    params: { id: otherPartyId(data, me.id), matchId: data.id },
                  })
                }
              />
            ) : null}
          </>
        ) : (
          <EmptyState
            icon="compass"
            title={t('notFound.title')}
            description={t('notFound.description')}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function Detail({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.detail, { borderColor: colors.border }]}>
      <Icon name={icon} size={16} color={color ?? colors.textSubtle} strokeWidth={2.4} />
      <View style={{ flex: 1 }}>
        <Text variant="label" color="textSubtle">
          {label.toLocaleUpperCase(currentLocale())}
        </Text>
        <Text variant="title" color={color}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quote: { padding: spacing.md, borderRadius: radius.md, borderLeftWidth: 3 },
  details: { gap: spacing.sm },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
