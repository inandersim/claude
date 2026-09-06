import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import {
  Card,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import { activeConsultation, consultStatusMeta, type DoctorSpecialty } from '@/domain';
import { DisclaimerBanner } from '@/features/telemed/components/DisclaimerBanner';
import { DoctorCard } from '@/features/telemed/components/DoctorCard';
import { SpecialtyChips } from '@/features/telemed/components/SpecialtyChips';
import { useDoctors, useMyConsultations } from '@/features/telemed/hooks';

export default function TelemedScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const [specialty, setSpecialty] = useState<DoctorSpecialty | null>(null);
  const [onlineOnly, setOnlineOnly] = useState(false);

  const doctors = useDoctors(specialty, onlineOnly);
  const mine = useMyConsultations();
  const active = useMemo(() => activeConsultation(mine.data ?? []), [mine.data]);
  const onlineCount = (doctors.data ?? []).filter((d) => d.isOnline).length;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={t('telemed.title')}
        subtitle={t('telemed.subtitle')}
        showBack
        onBack={() => goBack(router, '/explore')}
        right={
          <IconButton
            icon="clock"
            onPress={() => router.push('/telemed/history')}
            accessibilityLabel={t('telemed.history')}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pad}>
          <DisclaimerBanner />
        </View>

        {active ? (
          <View style={styles.pad}>
            <Tappable
              onPress={() =>
                router.push({ pathname: '/telemed/consult/[id]', params: { id: active.id } })
              }
              accessibilityRole="button"
              accessibilityLabel={t('telemed.activeBannerAction')}
              style={[
                styles.activeBanner,
                { backgroundColor: colors.successSoft, borderColor: colors.success },
              ]}
            >
              <Icon name={consultStatusMeta(active.status).icon} size={20} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text variant="label" weight="bold" color={colors.success}>
                  {active.status === 'active'
                    ? t('telemed.activeBanner')
                    : t('telemed.waitingBanner')}
                </Text>
                <Text variant="caption" color="textMuted" numberOfLines={1}>
                  {active.complaint}
                </Text>
              </View>
              <Text variant="caption" weight="bold" color={colors.success}>
                {t('telemed.activeBannerAction')}
              </Text>
              <Icon name="chevron-right" size={16} color={colors.success} />
            </Tappable>
          </View>
        ) : null}

        <View style={styles.pad}>
          <Card
            onPress={() => router.push('/telemed/request')}
            padded
            style={{ backgroundColor: colors.primary, borderColor: colors.primary }}
            accessibilityLabel={t('telemed.consultNow')}
          >
            <View style={styles.ctaRow}>
              <View style={[styles.ctaIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                <Icon name="heart-pulse" size={28} color={colors.onPrimary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="h3" color={colors.onPrimary}>
                  {t('telemed.consultNow')}
                </Text>
                <Text variant="bodySm" color={colors.onPrimary}>
                  {t('telemed.consultNowSubtitle')}
                </Text>
              </View>
              <Icon name="arrow-right" size={22} color={colors.onPrimary} />
            </View>
          </Card>
        </View>

        <SectionHeader
          title={t('telemed.doctors')}
          subtitle={t('telemed.doctorsSubtitle', {
            online: onlineCount,
            total: doctors.data?.length ?? 0,
          })}
        />
        <SpecialtyChips value={specialty} onChange={setSpecialty} />
        <View style={[styles.pad, styles.switchRow]}>
          <Text variant="body" style={{ flex: 1 }}>
            {t('telemed.onlineOnly')}
          </Text>
          <Switch
            value={onlineOnly}
            onValueChange={setOnlineOnly}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={t('telemed.onlineOnly')}
          />
        </View>

        <View style={[styles.pad, styles.list]}>
          {doctors.isLoading ? (
            [0, 1, 2].map((i) => (
              <View key={i} style={[styles.skeleton, { borderColor: colors.border }]}>
                <Skeleton width={56} height={56} round />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="60%" height={16} />
                  <Skeleton width="90%" height={12} />
                  <Skeleton width="40%" height={12} />
                </View>
              </View>
            ))
          ) : doctors.isError ? (
            <ErrorState onRetry={() => doctors.refetch()} />
          ) : (doctors.data ?? []).length === 0 ? (
            <EmptyState
              icon="user"
              title={t('telemed.empty')}
              description={t('telemed.emptyDescription')}
              action={{
                label: t('telemed.allSpecialties'),
                onPress: () => {
                  setSpecialty(null);
                  setOnlineOnly(false);
                },
                variant: 'secondary',
              }}
            />
          ) : (
            (doctors.data ?? []).map((d) => (
              <DoctorCard
                key={d.id}
                doctor={d}
                onPress={() =>
                  router.push({ pathname: '/telemed/doctor/[id]', params: { id: d.id } })
                }
              />
            ))
          )}
        </View>

        <View style={styles.pad}>
          <Tappable
            onPress={() => router.push('/telemed/history')}
            accessibilityRole="button"
            style={[styles.historyLink, { borderColor: colors.border }]}
          >
            <Icon name="clock" size={18} color={colors.textMuted} />
            <Text variant="body" style={{ flex: 1 }}>
              {t('telemed.history')}
            </Text>
            <Text variant="caption" color="textMuted">
              {mine.data?.length ?? ''}
            </Text>
            <Icon name="chevron-right" size={16} color={colors.textSubtle} />
          </Tappable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  pad: { paddingHorizontal: spacing.lg },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ctaIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  list: { gap: spacing.md },
  skeleton: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
