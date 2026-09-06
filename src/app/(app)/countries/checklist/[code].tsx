import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  checklistProgress,
  COUNTRY_FLAG,
  sourceHost,
  tripDateFromPreset,
  visaSteps,
  type TripDatePreset,
} from '@/domain';
import { DocumentChecklist } from '@/features/countries/components/DocumentChecklist';
import { TipList } from '@/features/countries/components/TipList';
import { TripCountdown } from '@/features/countries/components/TripCountdown';
import {
  useCountry,
  useCountryChecklist,
  useSetTripDate,
  useToggleDocument,
} from '@/features/countries/hooks';

export default function CountryChecklistScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const countryCode = code.toUpperCase();
  const [now] = useState(() => new Date());

  const country = useCountry(countryCode);
  const checklist = useCountryChecklist(countryCode);
  const toggle = useToggleDocument(countryCode);
  const setTripDate = useSetTripDate(countryCode);

  const guide = country.data ?? null;
  const list = checklist.data ?? null;
  const isLoading = country.isLoading || checklist.isLoading;
  const isError = country.isError || checklist.isError;

  const onPreset = (preset: TripDatePreset) =>
    setTripDate.mutate(tripDateFromPreset(preset, now), {
      onSuccess: () => toast(t('countries.checklist.saved'), 'success'),
      onError: (e) => toast(e.message, 'error'),
    });

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={t('countries.checklist.title')}
        subtitle={guide ? `${COUNTRY_FLAG(guide.countryCode)} ${guide.name}` : undefined}
        showBack
        onBack={() =>
          router.canGoBack()
            ? router.back()
            : router.replace({ pathname: '/countries/[code]', params: { code: countryCode } })
        }
      />
      {isError ? (
        <ErrorState
          onRetry={() => {
            country.refetch();
            checklist.refetch();
          }}
        />
      ) : isLoading ? (
        <View style={styles.content}>
          <SkeletonGroup>
            <Skeleton height={180} style={{ borderRadius: radius.xl }} />
            <Skeleton height={64} style={{ borderRadius: radius.lg }} />
            <Skeleton height={64} style={{ borderRadius: radius.lg }} />
            <Skeleton height={64} style={{ borderRadius: radius.lg }} />
          </SkeletonGroup>
        </View>
      ) : !guide || !list ? (
        <EmptyState icon="globe" title={t('countries.errors.notFound')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TripCountdown
            guide={guide}
            checklist={list}
            now={now}
            onPreset={onPreset}
            onClear={() => setTripDate.mutate(null)}
            pending={setTripDate.isPending}
          />

          <SectionHeader
            title={t('countries.sections.documents')}
            subtitle={t('countries.checklist.subtitle', { country: guide.name })}
          />
          {checklistProgress(guide, list).requiredComplete ? (
            <View style={[styles.banner, { backgroundColor: colors.successSoft }]}>
              <Icon name="circle-check" size={18} color={colors.success} strokeWidth={2.4} />
              <Text variant="body" weight="semibold" style={{ flex: 1 }}>
                {t('countries.checklist.allDone')}
              </Text>
            </View>
          ) : null}
          <DocumentChecklist
            documents={guide.documents}
            done={list.done}
            onToggle={(key) => toggle.mutate(key, { onError: (e) => toast(e.message, 'error') })}
          />

          <SectionHeader title={t('countries.sections.visaSteps')} />
          <TipList items={visaSteps(guide).map((key) => t(key))} numbered />

          <View style={[styles.banner, { backgroundColor: colors.infoSoft }]}>
            <Icon name="shield-check" size={18} color={colors.info} strokeWidth={2.4} />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <Text variant="title">{t('countries.sections.insurance')}</Text>
              <Text variant="bodySm" color="textMuted">
                {t('countries.checklist.insuranceReminder')}
              </Text>
            </View>
          </View>

          <SectionHeader
            title={t('countries.sections.sources')}
            subtitle={t('countries.checklist.sourcesHint')}
          />
          <View style={styles.sources}>
            {guide.sources.map((url) => (
              <Tappable
                key={url}
                onPress={() => Linking.openURL(url).catch(() => undefined)}
                haptic="selection"
                accessibilityRole="link"
                accessibilityLabel={sourceHost(url)}
                style={[styles.source, { backgroundColor: colors.surfaceMuted }]}
              >
                <Icon name="external-link" size={14} color={colors.primary} />
                <Text variant="caption" weight="bold" style={{ flex: 1 }} numberOfLines={1}>
                  {sourceHost(url)}
                </Text>
                <Icon name="chevron-right" size={14} color={colors.textSubtle} />
              </Tappable>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  sources: { gap: spacing.sm },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
