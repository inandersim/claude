import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import {
  effectiveSystem,
  formatGrade,
  type AscentWithUser,
  type ClimbingRoute,
  type GradeSystem,
} from '@/domain';

import { ASCENT_STYLE_META } from '../meta';
import { GradeBadge } from './GradeBadge';

export interface AscentRowProps {
  ascent: AscentWithUser;
  /** Logbook görünümünde rota ve kaya bilgisi gösterilir */
  route?: ClimbingRoute;
  cragName?: string;
  preferredSystem?: GradeSystem;
  /** Kullanıcı satırı yerine rota satırı gibi davranır (logbook) */
  onPress?: () => void;
}

/** Çıkış kaydı satırı: kullanıcı (veya rota), stil, tarih, hissedilen derece ve not. */
export function AscentRow({ ascent, route, cragName, preferredSystem, onPress }: AscentRowProps) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const style = ASCENT_STYLE_META[ascent.style];
  const isSend =
    ascent.style === 'onsight' || ascent.style === 'flash' || ascent.style === 'redpoint';
  const tint = isSend ? colors.success : ascent.style === 'attempt' ? colors.warning : colors.info;
  const displaySystem = route
    ? preferredSystem
      ? effectiveSystem(route.gradeSystem, preferredSystem)
      : route.gradeSystem
    : 'french';

  const handlePress =
    onPress ?? (() => router.push({ pathname: '/user/[id]', params: { id: ascent.userId } }));

  return (
    <Tappable
      onPress={handlePress}
      haptic="selection"
      scaleTo={0.99}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${route ? route.name : ascent.user.displayName}, ${t(style.labelKey)}, ${formatDate(ascent.date, locale)}`}
    >
      {route ? (
        <GradeBadge grade={formatGrade(route, displaySystem)} system={displaySystem} size="sm" />
      ) : (
        <Avatar
          uri={ascent.user.avatarUrl}
          name={ascent.user.displayName}
          size={38}
          verified={ascent.user.isVerified}
        />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
            {route ? route.name : ascent.user.displayName}
          </Text>
          <View style={[styles.stylePill, { backgroundColor: `${tint}22` }]}>
            <Icon name={style.icon} size={11} color={tint} strokeWidth={2.6} />
            <Text variant="label" weight="extrabold" color={tint}>
              {t(style.labelKey)}
            </Text>
          </View>
        </View>
        <Text variant="caption" color="textSubtle" numberOfLines={1}>
          {cragName ? `${cragName} · ` : ''}
          {formatDate(ascent.date, locale, 'd MMM yyyy')}
          {ascent.feltGrade ? ` · ${t('climbing.feltGrade', { grade: ascent.feltGrade })}` : ''}
        </Text>
        {ascent.note ? (
          <Text variant="bodySm" color="textMuted" numberOfLines={2}>
            {ascent.note}
          </Text>
        ) : null}
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stylePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: radius.full,
  },
});
