import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Icon, ProgressRing, Text } from '@/components/ui';
import { useT, type TranslationKey } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatNumber } from '@/core/utils/format';
import type { LevelInfo } from '@/domain';

import { StreakFlame } from './StreakFlame';

export interface LevelCardProps {
  level: LevelInfo;
  streakDays: number;
}

/** Seviye halkası, unvan ve sonraki seviyeye kalan XP. */
export function LevelCard({ level, streakDays }: LevelCardProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const title = t(level.title as TranslationKey);
  const pct = Math.round(level.progress * 100);
  const remaining = Math.max(0, level.nextLevelXp - level.xp);

  return (
    <Card
      elevated
      style={styles.card}
      accessibilityLabel={t('fun.a11y.levelRing', { level: level.level, title, pct })}
    >
      <ProgressRing value={pct} size={92} strokeWidth={8} color={colors.primary}>
        <View style={styles.ringInner}>
          <Text variant="label" color="textMuted">
            {t('fun.level.label').toLocaleUpperCase('tr-TR')}
          </Text>
          <Text variant="h1">{level.level}</Text>
        </View>
      </ProgressRing>
      <View style={styles.body}>
        <Text variant="h3" numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.xpRow}>
          <Icon name="zap" size={14} color={colors.accent} strokeWidth={2.4} />
          <Text variant="title" weight="extrabold" color="accent">
            {t('fun.xpValue', { xp: formatNumber(level.xp, locale) })}
          </Text>
        </View>
        <Text variant="caption" color="textMuted">
          {t('fun.level.toNext', { xp: formatNumber(remaining, locale) })}
        </Text>
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View
            style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.primary }]}
            accessibilityElementsHidden
          />
        </View>
      </View>
      <StreakFlame days={streakDays} size="sm" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ringInner: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: spacing.xxs },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  track: { height: 6, borderRadius: radius.full, overflow: 'hidden', marginTop: spacing.xs },
  fill: { height: '100%', borderRadius: radius.full },
});
