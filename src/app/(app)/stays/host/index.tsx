import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Skeleton,
  SkeletonGroup,
  Tappable,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  BUSINESS_TYPE_META,
  formatPriceTry,
  hostTrustScore,
  type BusinessWithOwner,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { TrustScoreRing } from '@/features/inventory/components';
import { useHostProfile, useStayReviews } from '@/features/inventory/hooks';
import { useBusinesses } from '@/features/stays/hooks';

/** Host paneli: kullanıcının işletmeleri (yoksa demo olarak tüm konaklama işletmeleri). */
export default function HostPanelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const businesses = useBusinesses({ staysOnly: true });

  const all = businesses.data ?? [];
  const mine = all.filter((b) => b.ownerId === me.id);
  const demo = mine.length === 0;
  const list = demo ? all : mine;

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('inventory.host.title')}
        subtitle={t('inventory.host.subtitle')}
        showBack
        onBack={() => goBack(router, '/profile')}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {businesses.isError ? (
          <ErrorState onRetry={() => businesses.refetch()} />
        ) : businesses.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={96} style={{ borderRadius: radius.xl }} />
            <Skeleton height={96} style={{ borderRadius: radius.xl }} />
            <Skeleton height={96} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : list.length === 0 ? (
          <EmptyState
            icon="building-2"
            title={t('inventory.host.empty')}
            description={t('inventory.host.emptyDescription')}
            action={{
              label: t('inventory.host.register'),
              icon: 'plus',
              onPress: () => router.push('/stays/register'),
            }}
          />
        ) : (
          <>
            {demo ? (
              <View style={[styles.demoHint, { backgroundColor: colors.warningSoft }]}>
                <Icon name="info" size={14} color={colors.warning} />
                <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                  {t('inventory.host.demoHint')}
                </Text>
              </View>
            ) : null}
            {list.map((b) => (
              <HostBusinessRow key={b.id} business={b} demo={demo} />
            ))}
            <Tappable
              onPress={() => router.push('/stays/register')}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={t('inventory.host.register')}
              style={[styles.register, { borderColor: colors.border }]}
            >
              <Icon name="plus" size={16} color={colors.primary} strokeWidth={2.6} />
              <Text variant="bodySm" weight="bold" color="primary">
                {t('inventory.host.register')}
              </Text>
            </Tappable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function HostBusinessRow({ business, demo }: { business: BusinessWithOwner; demo: boolean }) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const host = useHostProfile(business.id);
  const reviews = useStayReviews(business.id);
  const meta = BUSINESS_TYPE_META[business.type];
  const score = host.data ? hostTrustScore(host.data, reviews.data ?? []) : null;

  return (
    <Tappable
      onPress={() =>
        router.push({ pathname: '/stays/host/[businessId]', params: { businessId: business.id } })
      }
      haptic="selection"
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={business.name}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {score !== null ? (
        <TrustScoreRing score={score} size={56} showLabel={false} />
      ) : (
        <Skeleton width={56} height={56} round />
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.titleRow}>
          <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
            {business.name}
          </Text>
          {demo ? <Badge label={t('inventory.host.demo')} color={colors.warning} /> : null}
        </View>
        <View style={styles.metaRow}>
          <Badge label={t(meta.labelKey)} color={colors.textMuted} icon={meta.icon} />
          <Text variant="caption" color="textSubtle" numberOfLines={1} style={{ flexShrink: 1 }}>
            {business.locationName}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Icon name="wallet" size={12} color={colors.primary} />
          <Text variant="caption" color="textMuted">
            {t('inventory.host.pendingPayout')}:{' '}
          </Text>
          <Text variant="caption" weight="bold" color="primary">
            {host.data ? formatPriceTry(host.data.pendingPayoutTry, locale, false) : '…'}
          </Text>
        </View>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textSubtle} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  demoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  register: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
