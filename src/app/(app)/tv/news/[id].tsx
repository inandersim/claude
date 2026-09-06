import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDate, formatRelative } from '@/core/utils/time';
import { isNewsActive, newsCategoryMeta, newsSeverityMeta } from '@/domain';
import { NewsCard } from '@/features/tv/components/NewsCard';
import { useNews, useNewsItem } from '@/features/tv/hooks';

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const [now] = useState(() => Date.now());
  const item = useNewsItem(id);
  const all = useNews();

  const data = item.data;
  const category = data ? newsCategoryMeta[data.category] : null;
  const severity = data ? newsSeverityMeta[data.severity] : null;
  const active = data ? isNewsActive(data, now) : false;
  const related = data
    ? (all.data ?? [])
        .filter(
          (n) => n.id !== data.id && (n.category === data.category || n.region === data.region),
        )
        .slice(0, 3)
    : [];

  const onShare = () => {
    if (!data) return;
    Share.share({
      message: `${t('tv.news.shareMessage', { title: data.title, source: data.sourceName })}${
        data.sourceUrl ? `\n${data.sourceUrl}` : ''
      }`,
    }).catch(() => undefined);
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('tv.news.detail')}
        showBack
        right={
          data ? (
            <Button
              label={t('tv.share')}
              icon="share-2"
              size="sm"
              variant="ghost"
              onPress={onShare}
            />
          ) : undefined
        }
      />
      <View style={styles.content}>
        {item.isError ? (
          <ErrorState onRetry={() => item.refetch()} />
        ) : item.isLoading ? (
          <>
            <Skeleton height={28} />
            <Skeleton height={120} style={{ borderRadius: radius.xl }} />
          </>
        ) : !data || !category || !severity ? (
          <EmptyState icon="radio" title={t('tv.newsNotFound')} />
        ) : (
          <>
            <View style={[styles.severityBar, { backgroundColor: severity.color }]}>
              <Icon name={severity.icon} size={16} color="#FFFFFF" strokeWidth={2.6} />
              <Text variant="label" weight="extrabold" color="#FFFFFF">
                {t(severity.labelKey).toLocaleUpperCase('tr-TR')} ·{' '}
                {(active ? t('tv.news.active') : t('tv.news.expired')).toLocaleUpperCase('tr-TR')}
              </Text>
            </View>
            <View style={styles.badges}>
              <Badge label={t(category.labelKey)} color={category.color} icon={category.icon} />
              {data.countryCode ? (
                <Badge label={data.countryCode} color={colors.textMuted} />
              ) : null}
            </View>
            <Text variant="h2">{data.title}</Text>
            <Text variant="body" weight="semibold" color="textMuted">
              {data.summary}
            </Text>

            <Card style={styles.metaCard}>
              <MetaRow icon="map-pin" label={t('tv.news.region')} value={data.region} />
              <MetaRow
                icon="clock"
                label={t('tv.news.published')}
                value={`${formatDate(data.publishedAt, locale, 'd MMM yyyy HH:mm')} · ${formatRelative(data.publishedAt, new Date(now), locale)}`}
              />
              {data.expiresAt ? (
                <MetaRow
                  icon="hourglass"
                  label={t('tv.news.expires')}
                  value={formatDate(data.expiresAt, locale, 'd MMM yyyy HH:mm')}
                />
              ) : null}
              <MetaRow icon="radio" label={t('tv.news.source')} value={data.sourceName} />
              {data.coords ? (
                <MetaRow
                  icon="locate"
                  label="GPS"
                  value={`${data.coords.latitude.toFixed(3)}, ${data.coords.longitude.toFixed(3)}`}
                />
              ) : null}
            </Card>

            <Text variant="body" style={styles.body}>
              {data.body}
            </Text>

            <View style={styles.actions}>
              {data.sourceUrl ? (
                <Button
                  label={t('tv.news.openSource')}
                  icon="external-link"
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    if (data.sourceUrl) Linking.openURL(data.sourceUrl).catch(() => undefined);
                  }}
                />
              ) : null}
              {data.category === 'weather' ? (
                <Button
                  label={t('tv.news.weather')}
                  icon="cloud-sun"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push('/weather')}
                />
              ) : null}
              {data.category === 'closure' ||
              data.category === 'rescue' ||
              data.category === 'weather' ? (
                <Button
                  label={t('tv.news.hazards')}
                  icon="triangle-alert"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push('/hazards')}
                />
              ) : null}
            </View>

            {related.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title={t('tv.news.related')} />
                {related.map((n) => (
                  <NewsCard key={n.id} item={n} now={now} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.metaRow}>
      <Icon name={icon} size={14} color={colors.textSubtle} />
      <Text variant="caption" color="textSubtle" style={styles.metaLabel}>
        {label}
      </Text>
      <Text variant="caption" weight="bold" style={styles.metaValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
  severityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  metaCard: { gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaLabel: { width: 84 },
  metaValue: { flex: 1 },
  body: { lineHeight: 24 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: spacing.sm, marginTop: spacing.sm },
});
