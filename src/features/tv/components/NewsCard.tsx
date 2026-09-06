import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Card, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import { isNewsActive, newsCategoryMeta, newsSeverityMeta, type NewsItem } from '@/domain';

interface Props {
  item: NewsItem;
  /** Aktiflik hesaplaması için zaman damgası (render içinde Date.now() kullanılmaz) */
  now: number;
}

/** Haber kartı: kategori/şiddet rozetleri, başlık, özet, bölge · kaynak · zaman. */
export function NewsCard({ item, now }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const category = newsCategoryMeta[item.category];
  const severity = newsSeverityMeta[item.severity];
  const active = isNewsActive(item, now);

  return (
    <Card
      onPress={() => router.push({ pathname: '/tv/news/[id]', params: { id: item.id } })}
      style={[styles.card, !active && styles.expired]}
      accessibilityLabel={item.title}
    >
      <View style={styles.badges}>
        <Badge label={t(category.labelKey)} color={category.color} icon={category.icon} />
        {item.severity !== 'info' ? (
          <Badge label={t(severity.labelKey)} color={severity.color} icon={severity.icon} />
        ) : null}
        {!active ? <Badge label={t('tv.news.expired')} color={colors.textSubtle} /> : null}
      </View>
      <Text variant="title" weight="bold" numberOfLines={2}>
        {item.title}
      </Text>
      <Text variant="bodySm" color="textMuted" numberOfLines={2}>
        {item.summary}
      </Text>
      <View style={styles.meta}>
        <Icon name="map-pin" size={12} color={colors.textSubtle} />
        <Text variant="caption" color="textSubtle" numberOfLines={1} style={styles.metaText}>
          {item.region} · {item.sourceName} ·{' '}
          {formatRelative(item.publishedAt, new Date(now), locale)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  expired: { opacity: 0.6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { flex: 1 },
});
