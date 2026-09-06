import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  Tappable,
  Text,
  type IconName,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatPriceTry } from '@/domain';
import { bestMonthsLabel, COUNTRY_FLAG, sourceHost, type CountryGuide } from '@/domain';
import { InfoGrid } from '@/features/countries/components/InfoGrid';
import { LawBadgeRow } from '@/features/countries/components/LawBadgeRow';
import { TipList } from '@/features/countries/components/TipList';
import { VisaBadge } from '@/features/countries/components/VisaBadge';
import { WatchOutList } from '@/features/countries/components/WatchOutList';
import { useCountry } from '@/features/countries/hooks';

type Tab = 'visa' | 'etiquette' | 'safety' | 'laws' | 'health';
const TABS: Tab[] = ['visa', 'etiquette', 'safety', 'laws', 'health'];

export default function CountryDetailScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const country = useCountry(code.toUpperCase());
  const [tab, setTab] = useState<Tab>('visa');

  const guide = country.data ?? null;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={guide ? `${COUNTRY_FLAG(guide.countryCode)} ${guide.name}` : t('countries.title')}
        subtitle={guide?.region}
        showBack
        onBack={() => goBack(router, '/explore')}
      />
      {country.isError ? (
        <ErrorState onRetry={() => country.refetch()} />
      ) : country.isLoading ? (
        <View style={styles.content}>
          <SkeletonGroup>
            <Skeleton height={140} style={{ borderRadius: radius.xl }} />
            <Skeleton height={44} style={{ borderRadius: radius.full }} />
            <Skeleton height={260} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        </View>
      ) : !guide ? (
        <EmptyState icon="globe" title={t('countries.errors.notFound')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <InfoGrid guide={guide} />
          <SegmentedControl
            segments={TABS.map((value) => ({ value, label: t(`countries.tabs.${value}`) }))}
            value={tab}
            onChange={setTab}
          />

          {tab === 'visa' ? (
            <VisaTab
              guide={guide}
              onChecklist={() =>
                router.push({
                  pathname: '/countries/checklist/[code]',
                  params: { code: guide.countryCode },
                })
              }
            />
          ) : null}
          {tab === 'etiquette' ? <EtiquetteTab guide={guide} /> : null}
          {tab === 'safety' ? (
            <SafetyTab
              guide={guide}
              onRescue={() => router.push('/first-aid/country')}
              onSatellite={() => router.push('/satellite')}
            />
          ) : null}
          {tab === 'laws' ? <LawsTab guide={guide} /> : null}
          {tab === 'health' ? (
            <HealthTab guide={guide} bestMonths={bestMonthsLabel(guide.bestMonths, locale)} />
          ) : null}

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Button
              label={t('countries.askAi')}
              icon="sparkles"
              variant="secondary"
              fullWidth
              onPress={() =>
                router.push({
                  pathname: '/assistant/[threadId]',
                  params: {
                    threadId: 'new',
                    initial: t('countries.askAiPrompt', { country: guide.name }),
                  },
                })
              }
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Sekmeler                                                            */
/* ------------------------------------------------------------------ */

function Paragraph({ title, text, icon }: { title: string; text: string; icon: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.block, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.blockHeader}>
        <Icon name={icon} size={16} color={colors.primary} strokeWidth={2.4} />
        <Text variant="title">{title}</Text>
      </View>
      <Text variant="body" color="textMuted">
        {text}
      </Text>
    </View>
  );
}

function VisaTab({ guide, onChecklist }: { guide: CountryGuide; onChecklist: () => void }) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const { visa } = guide;
  return (
    <View style={styles.tab}>
      <View style={[styles.block, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.blockHeader}>
          <VisaBadge visa={visa} />
          <Text variant="caption" color="textMuted">
            {t('countries.visaFor')}
          </Text>
        </View>
        <View style={styles.factRow}>
          <Fact
            label={t('countries.maxStay')}
            value={visa.maxStayDays ? t('countries.maxStayDays', { days: visa.maxStayDays }) : '—'}
          />
          <Fact
            label={t('countries.cost')}
            value={
              visa.costTry === null
                ? '—'
                : visa.costTry === 0
                  ? t('countries.free')
                  : formatPriceTry(visa.costTry, locale, false)
            }
          />
          <Fact
            label={t('countries.processing')}
            value={
              visa.processingDays === null
                ? '—'
                : visa.processingDays === 0
                  ? t('countries.sameDay')
                  : t('countries.processingDays', { days: visa.processingDays })
            }
          />
        </View>
        <Text variant="bodySm" color="textMuted">
          {visa.note}
        </Text>
        {visa.url ? (
          <Tappable
            onPress={() => Linking.openURL(visa.url ?? '').catch(() => undefined)}
            haptic="selection"
            accessibilityRole="link"
            accessibilityLabel={t('countries.officialLink')}
            style={[styles.link, { backgroundColor: colors.surfaceMuted }]}
          >
            <Icon name="external-link" size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="caption" weight="bold">
                {t('countries.officialLink')}
              </Text>
              <Text variant="caption" color="textSubtle" numberOfLines={1}>
                {sourceHost(visa.url)}
              </Text>
            </View>
            <Icon name="chevron-right" size={14} color={colors.textSubtle} />
          </Tappable>
        ) : null}
      </View>

      <SectionHeader
        title={t('countries.sections.documents')}
        subtitle={t('countries.countLabel', { count: guide.documents.length })}
      />
      <TipList items={guide.documents.map((d) => d.label)} icon="list-checks" />
      <Button
        label={t('countries.openChecklist')}
        icon="list-checks"
        fullWidth
        onPress={onChecklist}
      />
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="label" color="textSubtle">
        {label}
      </Text>
      <Text variant="body" weight="bold">
        {value}
      </Text>
    </View>
  );
}

function EtiquetteTab({ guide }: { guide: CountryGuide }) {
  const { t } = useT();
  return (
    <View style={styles.tab}>
      <SectionHeader title={t('countries.sections.etiquette')} />
      <TipList items={guide.etiquette} icon="handshake" />
      <Paragraph title={t('countries.sections.dressCode')} text={guide.dressCode} icon="shirt" />
      <Paragraph
        title={t('countries.sections.religion')}
        text={guide.religionNotes}
        icon="landmark"
      />
      <Paragraph
        title={t('countries.sections.photography')}
        text={guide.photographyRules}
        icon="camera"
      />
      <Paragraph title={t('countries.sections.tipping')} text={guide.tipping} icon="wallet" />
      <Paragraph title={t('countries.sections.bargaining')} text={guide.bargaining} icon="tag" />
      <SectionHeader title={t('countries.sections.dailyTips')} />
      <TipList items={guide.dailyTips} icon="lightbulb" />
    </View>
  );
}

function SafetyTab({
  guide,
  onRescue,
  onSatellite,
}: {
  guide: CountryGuide;
  onRescue: () => void;
  onSatellite: () => void;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <View style={styles.tab}>
      <View style={styles.linkRow}>
        <Tappable
          onPress={onRescue}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel={t('countries.rescueLink')}
          style={[styles.link, { backgroundColor: colors.dangerSoft }]}
        >
          <Icon name="siren" size={18} color={colors.danger} strokeWidth={2.4} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" weight="bold">
              {t('countries.rescueLink')}
            </Text>
            <Text variant="caption" color="textSubtle">
              {t('countries.rescueLinkHint')}
            </Text>
          </View>
          <Icon name="chevron-right" size={14} color={colors.textSubtle} />
        </Tappable>
        <Tappable
          onPress={onSatellite}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel={t('countries.satelliteLink')}
          style={[styles.link, { backgroundColor: colors.surfaceMuted }]}
        >
          <Icon name="satellite" size={18} color={colors.primary} strokeWidth={2.4} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" weight="bold">
              {t('countries.satelliteLink')}
            </Text>
            <Text variant="caption" color="textSubtle">
              {t('countries.satelliteLinkHint')}
            </Text>
          </View>
          <Icon name="chevron-right" size={14} color={colors.textSubtle} />
        </Tappable>
      </View>
      <SectionHeader title={t('countries.sections.watchOut')} />
      <WatchOutList items={guide.watchOut} />
      <Paragraph title={t('countries.sections.women')} text={guide.womenTravelers} icon="users" />
    </View>
  );
}

function LawsTab({ guide }: { guide: CountryGuide }) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <View style={styles.tab}>
      <LawBadgeRow guide={guide} />
      <SectionHeader title={t('countries.sections.laws')} />
      <TipList items={guide.laws} icon="shield" color={colors.warning} />
      <Paragraph title={t('countries.sections.drone')} text={guide.droneRules} icon="radar" />
      <Paragraph
        title={t('countries.sections.alcohol')}
        text={guide.alcoholRules}
        icon="droplets"
      />
      <Paragraph title={t('countries.sections.money')} text={guide.money} icon="banknote" />
      <Paragraph
        title={t('countries.sections.connectivity')}
        text={guide.connectivity}
        icon="wifi"
      />
    </View>
  );
}

function HealthTab({ guide, bestMonths }: { guide: CountryGuide; bestMonths: string }) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <View style={styles.tab}>
      <SectionHeader title={t('countries.sections.health')} />
      <TipList items={guide.health} icon="heart-pulse" color={colors.danger} />
      <SectionHeader title={t('countries.sections.vaccines')} />
      <TipList items={guide.vaccines} icon="pill" color={colors.info} />
      <Paragraph title={t('countries.sections.bestMonths')} text={bestMonths} icon="sun" />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPadding,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  tab: { gap: spacing.md },
  block: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fact: { minWidth: 96, gap: spacing.xxs },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  linkRow: { gap: spacing.sm },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.lg },
});
