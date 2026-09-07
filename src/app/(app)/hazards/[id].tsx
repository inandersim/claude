import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Avatar,
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
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDate, formatRelative } from '@/core/utils/time';
import { formatDistance, HAZARD_SEVERITY_META, HAZARD_TYPE_META } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { HazardRadar } from '@/features/hazards/components/HazardRadar';
import { SeverityBadge } from '@/features/hazards/components/SeverityBadge';
import { useConfirmHazard, useHazard, useResolveHazard } from '@/features/hazards/hooks';

export default function HazardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const hazard = useHazard(id, location.coords);
  const confirm = useConfirmHazard();
  const resolve = useResolveHazard();
  const data = hazard.data;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={t('hazards.title')} showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {hazard.isError ? (
          <ErrorState onRetry={() => hazard.refetch()} />
        ) : hazard.isLoading ? (
          <Skeleton height={320} style={{ borderRadius: radius.xl }} />
        ) : data ? (
          <>
            <View
              style={[
                styles.hero,
                {
                  backgroundColor: `${HAZARD_SEVERITY_META[data.severity].color}1A`,
                  borderColor: HAZARD_SEVERITY_META[data.severity].color,
                },
              ]}
            >
              <View
                style={[
                  styles.heroIcon,
                  { backgroundColor: HAZARD_SEVERITY_META[data.severity].color },
                ]}
              >
                <Icon
                  name={HAZARD_TYPE_META[data.type].icon}
                  size={26}
                  color="#06120B"
                  strokeWidth={2.2}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.badges}>
                  <SeverityBadge severity={data.severity} soft={false} />
                  <Text
                    variant="caption"
                    weight="bold"
                    color={HAZARD_SEVERITY_META[data.severity].color}
                  >
                    {t(HAZARD_TYPE_META[data.type].labelKey)}
                  </Text>
                  {data.status === 'resolved' ? (
                    <Text variant="caption" weight="bold" color="textSubtle">
                      · {t('hazards.resolved')}
                    </Text>
                  ) : null}
                </View>
                <Text variant="h2">{data.title}</Text>
              </View>
            </View>

            <Text variant="body">{data.description}</Text>

            <HazardRadar
              origin={location.coords}
              hazards={[data]}
              rangeKm={Math.max(5, Math.ceil((data.distanceKm ?? 5) * 1.4))}
              height={220}
            />

            <View
              style={[
                styles.facts,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Fact icon="map-pin" label={t('post.location')} value={data.locationName} />
              {data.distanceKm !== null ? (
                <Fact
                  icon="navigation"
                  label={t('home.distance')}
                  value={formatDistance(data.distanceKm, locale)}
                />
              ) : null}
              <Fact icon="ruler" label={t('hazards.radius')} value={`${data.radiusM} m`} />
              <Fact
                icon="clock"
                label={t('hazards.expires')}
                value={
                  data.expiresAt
                    ? formatDate(data.expiresAt, locale, 'd MMM HH:mm')
                    : t('hazards.noExpiry')
                }
              />
              <Fact
                icon="shield-check"
                label={t('hazards.confirmationsLabel')}
                value={`${data.confirmations}`}
                last
              />
            </View>

            <Tappable
              onPress={() =>
                router.push({ pathname: '/user/[id]', params: { id: data.reporterId } })
              }
              haptic="selection"
              style={[
                styles.reporter,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityRole="button"
            >
              <Avatar
                uri={data.reporter.avatarUrl}
                name={data.reporter.displayName}
                size={40}
                verified={data.reporter.isVerified}
              />
              <View style={{ flex: 1 }}>
                <Text variant="caption" color="textSubtle">
                  {t('hazards.reportedBy')}
                </Text>
                <Text variant="title">{data.reporter.displayName}</Text>
              </View>
              <Text variant="caption" color="textSubtle">
                {formatRelative(data.createdAt, new Date(), locale)}
              </Text>
            </Tappable>

            {data.status === 'active' ? (
              data.reporterId === me.id ? (
                <Button
                  label={t('hazards.markResolved')}
                  icon="circle-check"
                  variant="secondary"
                  fullWidth
                  size="lg"
                  loading={resolve.isPending}
                  onPress={() =>
                    resolve.mutate(id, {
                      onSuccess: () => toast(t('hazards.resolvedToast'), 'success'),
                    })
                  }
                />
              ) : (
                <Button
                  label={data.confirmedByMe ? t('hazards.confirmed') : t('hazards.confirm')}
                  icon={data.confirmedByMe ? 'check-check' : 'shield-check'}
                  variant={data.confirmedByMe ? 'secondary' : 'primary'}
                  disabled={data.confirmedByMe}
                  fullWidth
                  size="lg"
                  loading={confirm.isPending}
                  onPress={() =>
                    confirm.mutate(id, {
                      onSuccess: () => toast(t('hazards.confirmedToast'), 'success'),
                    })
                  }
                />
              )
            ) : null}
          </>
        ) : (
          <EmptyState
            icon="compass"
            title={t('notFound.contentTitle')}
            description={t('notFound.contentDescription')}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

function Fact({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.fact,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Icon name={icon} size={16} color={colors.textSubtle} />
      <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodySm" weight="bold" style={{ flexShrink: 1 }} align="right">
        {value}
      </Text>
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
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  facts: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  reporter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
