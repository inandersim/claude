import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatNumber } from '@/core/utils/format';
import {
  ADVENTURE_TYPE_META,
  challengeDaysLeft,
  challengeProgressPct,
  type ChallengeWithProgress,
  type ID,
} from '@/domain';

export interface ChallengeCardProps {
  challenge: ChallengeWithProgress;
  now: number;
  onJoin: (id: ID) => void;
  joining?: boolean;
}

/** Görev kartı: ilerleme çubuğu, kalan gün, ödül ve katıl butonu. Dış sarmalayıcı View (iç içe buton yok). */
export function ChallengeCard({ challenge, now, onJoin, joining = false }: ChallengeCardProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const pct = challengeProgressPct(challenge.progress, challenge);
  const daysLeft = challengeDaysLeft(challenge, now);
  const joined = challenge.progress !== null;
  const done = Boolean(challenge.progress?.completedAt);
  const meta = challenge.adventureType ? ADVENTURE_TYPE_META[challenge.adventureType] : null;
  const tint = done ? colors.success : (meta?.color ?? colors.primary);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: done ? colors.success : colors.border },
      ]}
    >
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
          <Icon name={done ? 'circle-check' : (meta?.icon ?? 'target')} size={20} color={tint} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" weight="bold" numberOfLines={1}>
            {challenge.title}
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={2}>
            {challenge.description}
          </Text>
        </View>
        <Badge label={t(`fun.period.${challenge.period}`)} color={colors.info} />
      </View>

      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tint }]} />
      </View>
      <View style={styles.metaRow}>
        <Text variant="caption" color="textMuted">
          {t('fun.challenges.progress', {
            value: formatNumber(challenge.progress?.value ?? 0, locale),
            target: formatNumber(challenge.target, locale),
            unit: t(`fun.unit.${challenge.unit}`),
          })}
        </Text>
        <Text variant="caption" weight="bold" color={tint}>
          {pct}%
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.stat}>
          <Icon name="hourglass" size={14} color={colors.textMuted} />
          <Text variant="caption" color="textMuted">
            {daysLeft <= 0 ? t('fun.lastDay') : t('fun.daysLeft', { count: daysLeft })}
          </Text>
        </View>
        <View style={styles.stat}>
          <Icon name="users" size={14} color={colors.textMuted} />
          <Text variant="caption" color="textMuted">
            {t('fun.challenges.participants', { count: challenge.participants })}
          </Text>
        </View>
        <View style={styles.stat}>
          <Icon name="zap" size={14} color={colors.accent} strokeWidth={2.4} />
          <Text variant="caption" weight="extrabold" color="accent">
            {t('fun.reward', { xp: challenge.rewardXp })}
          </Text>
        </View>
        {challenge.badgeId ? (
          <Icon name="award" size={14} color={colors.warning} strokeWidth={2.4} />
        ) : null}
        <View style={{ flex: 1 }} />
        {done ? (
          <Badge label={t('fun.completed')} color={colors.success} icon="check" />
        ) : joined ? (
          <Badge label={t('fun.joined')} color={colors.primary} icon="check" />
        ) : (
          <Button
            label={t('fun.join')}
            size="sm"
            onPress={() => onJoin(challenge.id)}
            loading={joining}
            accessibilityLabel={`${t('fun.join')}: ${challenge.title}`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -spacing.xs },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
