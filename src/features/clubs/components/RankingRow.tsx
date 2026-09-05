import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact, formatNumber, initials } from '@/core/utils/format';
import { clubBadgeFor, type Club } from '@/domain';

import { MEDAL_COLOR } from './meta';

/** Sıralama satırı: sıra, kulüp, XP; ilk üçe madalya. */
export function RankingRow({
  club,
  rank,
  highlight = false,
}: {
  club: Club;
  rank: number;
  highlight?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const medal = clubBadgeFor(rank);

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/clubs/[id]', params: { id: club.id } })}
      scaleTo={0.985}
      style={[
        styles.row,
        {
          backgroundColor: highlight ? colors.primarySoft : colors.surface,
          borderColor: highlight ? colors.primary : colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${club.name}, ${formatNumber(club.seasonXp, locale)} ${t('clubs.xp')}`}
    >
      <View style={styles.rank}>
        {medal ? (
          <Icon name="medal" size={24} color={MEDAL_COLOR[medal]} strokeWidth={2.2} />
        ) : (
          <Text variant="title" weight="extrabold" color="textMuted">
            {rank}
          </Text>
        )}
      </View>
      <View style={[styles.logo, { backgroundColor: colors.surfaceMuted }]}>
        <Text variant="caption" weight="extrabold" color="textMuted">
          {initials(club.university)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="title" numberOfLines={1}>
          {club.name}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {club.city} · {t('clubs.memberCount', { count: formatCompact(club.memberCount, locale) })}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="title" weight="extrabold" color="primary">
          {formatNumber(club.seasonXp, locale)}
        </Text>
        <Text variant="label" color="textSubtle">
          {t('clubs.xp')}
        </Text>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rank: { width: 28, alignItems: 'center' },
  logo: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
