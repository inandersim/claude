import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { COUNTRY_FLAG, languageName, regionLabel, regionOf, type CountryGuide } from '@/domain';

import { VisaBadge } from './VisaBadge';

interface Props {
  guide: CountryGuide;
  onPress: () => void;
  /** Kart üstünde küçük bağlam etiketi (bulunduğun ülke / kaydedilen destinasyon) */
  highlight?: { icon: IconName; label: string; color: string } | null;
  compact?: boolean;
}

/** Liste kartı: bayrak, ad, bölge, vize rozeti ve para/dil satırı. */
export function CountryCard({ guide, onPress, highlight = null, compact = false }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const region = regionOf(guide.countryCode);
  const languages = guide.languages
    .slice(0, 3)
    .map((l) => languageName(l, locale))
    .join(', ');

  return (
    <Card
      onPress={onPress}
      padded
      style={[styles.card, highlight ? { borderColor: highlight.color } : null]}
      accessibilityLabel={`${guide.name} · ${guide.region}`}
    >
      {highlight ? (
        <View style={styles.highlight}>
          <Icon name={highlight.icon} size={12} color={highlight.color} strokeWidth={2.6} />
          <Text variant="label" weight="extrabold" color={highlight.color}>
            {highlight.label}
          </Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={[styles.flag, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={styles.flagText}>{COUNTRY_FLAG(guide.countryCode)}</Text>
        </View>
        <View style={styles.body}>
          <Text variant="title" numberOfLines={1}>
            {guide.name}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {region ? t(regionLabel(region)) : guide.region} · {guide.countryCode}
          </Text>
        </View>
        <VisaBadge visa={guide.visa} />
      </View>
      {!compact ? (
        <View style={[styles.meta, { borderTopColor: colors.border }]}>
          <View style={styles.metaItem}>
            <Icon name="banknote" size={14} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {guide.currency}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Icon name="languages" size={14} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {languages}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Icon name="clock" size={14} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {guide.timezone}
            </Text>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flag: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagText: { fontSize: 26, lineHeight: 32 },
  body: { flex: 1, gap: spacing.xxs },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '60%' },
});
