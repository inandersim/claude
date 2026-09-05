import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatNumber } from '@/core/utils/format';
import type { LeaderboardEntry } from '@/domain';

const MEDALS = ['#F2C14E', '#B8C2CC', '#C98A4B'] as const;

export interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  /** Alta sabitlenmiş "benim sıram" görünümü */
  pinned?: boolean;
}

export function LeaderboardRow({ entry, pinned = false }: LeaderboardRowProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const medal = entry.rank <= 3 ? MEDALS[entry.rank - 1] : null;
  const highlight = entry.isMe;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: highlight ? colors.primarySoft : colors.surface,
          borderColor: highlight ? colors.primary : colors.border,
        },
        pinned && styles.pinned,
      ]}
      accessibilityLabel={`${t('fun.leaderboard.rank', { rank: entry.rank })} ${entry.user.displayName}, ${t('fun.xpValue', { xp: entry.xp })}`}
    >
      <View style={styles.rank}>
        {medal ? (
          <Icon name="medal" size={22} color={medal} strokeWidth={2.4} />
        ) : (
          <Text variant="title" weight="extrabold" color="textMuted">
            {entry.rank}
          </Text>
        )}
      </View>
      <Avatar uri={entry.user.avatarUrl} name={entry.user.displayName} size={40} ring={highlight} />
      <View style={{ flex: 1 }}>
        <Text variant="title" weight={highlight ? 'extrabold' : 'semibold'} numberOfLines={1}>
          {entry.user.displayName}
          {highlight ? ` · ${t('fun.leaderboard.you')}` : ''}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          @{entry.user.username} · {entry.user.locationName}
        </Text>
      </View>
      <View style={styles.xp}>
        <Icon name="zap" size={14} color={colors.accent} strokeWidth={2.4} />
        <Text variant="title" weight="extrabold">
          {formatNumber(entry.xp, locale)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pinned: { borderWidth: 1.5 },
  rank: { width: 28, alignItems: 'center' },
  xp: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
