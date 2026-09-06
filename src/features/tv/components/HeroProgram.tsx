import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDurationLabel, programKindMeta, type TvProgramWithChannel } from '@/domain';

interface Props {
  program: TvProgramWithChannel;
  /** Üst etiket (örn. "Sana önerilen") */
  eyebrow?: string;
}

/** Büyük kapak + oynat düğmesi; tümü tek bir dokunma hedefi. */
export function HeroProgram({ program, eyebrow }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const kind = programKindMeta[program.kind];
  const adventureType = program.adventureTypes[0] ?? 'hiking';

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/tv/watch/[id]', params: { id: program.id } })}
      scaleTo={0.985}
      style={styles.root}
      accessibilityRole="button"
      accessibilityLabel={`${t('tv.play')}: ${program.title}`}
    >
      <AdventureImage
        uri={program.thumbnailUrl}
        adventureType={adventureType}
        style={styles.cover}
        overlay
      >
        <View style={styles.top}>
          {eyebrow ? (
            <View style={[styles.pill, { backgroundColor: colors.primary }]}>
              <Icon name="sparkles" size={12} color={colors.onPrimary} strokeWidth={2.6} />
              <Text variant="label" weight="extrabold" color={colors.onPrimary}>
                {eyebrow.toLocaleUpperCase('tr-TR')}
              </Text>
            </View>
          ) : null}
          <View style={[styles.pill, { backgroundColor: 'rgba(8,14,12,0.6)' }]}>
            <Icon name={kind.icon} size={12} color="#FFFFFF" strokeWidth={2.6} />
            <Text variant="label" weight="extrabold" color="#FFFFFF">
              {t(kind.labelKey).toLocaleUpperCase('tr-TR')}
            </Text>
          </View>
        </View>
        <View style={styles.bottom}>
          <Text variant="caption" weight="bold" color="rgba(255,255,255,0.8)">
            {program.channel.name} · {formatDurationLabel(program.durationMin, locale)}
            {program.episode != null ? ` · ${t('tv.episode', { n: program.episode })}` : ''}
          </Text>
          <Text variant="h2" color="#FFFFFF" numberOfLines={2}>
            {program.title}
          </Text>
          <Text variant="bodySm" color="rgba(255,255,255,0.85)" numberOfLines={2}>
            {program.description}
          </Text>
          <View style={styles.playRow}>
            <View style={[styles.playBtn, { backgroundColor: colors.primary }]}>
              <Icon name="play" size={16} color={colors.onPrimary} fill={colors.onPrimary} />
              <Text variant="bodySm" weight="extrabold" color={colors.onPrimary}>
                {program.progress > 0 ? t('tv.resume') : t('tv.play')}
              </Text>
            </View>
            {program.kidsFriendly ? (
              <View style={[styles.pill, styles.kids]}>
                <Icon name="sparkle" size={12} color="#06120B" strokeWidth={2.6} />
                <Text variant="label" weight="extrabold" color="#06120B">
                  {t('tv.kidsFriendly')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {program.progress > 0 ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.round(program.progress * 100)}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        ) : null}
      </AdventureImage>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.xxl, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 4 / 3, maxHeight: 420 },
  top: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
  },
  kids: { backgroundColor: '#FDE68A' },
  bottom: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    gap: spacing.xs,
  },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    height: 40,
    borderRadius: radius.full,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: { height: 4 },
});
