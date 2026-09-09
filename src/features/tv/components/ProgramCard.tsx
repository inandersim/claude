import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { formatRelative } from '@/core/utils/time';
import {
  formatDurationLabel,
  programKindMeta,
  remainingLabel,
  type TvProgramWithChannel,
} from '@/domain';

interface Props {
  program: TvProgramWithChannel;
  /** Yatay listelerde sabit genişlik */
  width?: number;
  /** Küçük düzen: kalan süre etiketi, tek satır başlık */
  compact?: boolean;
  showChannel?: boolean;
}

/**
 * Program kartı: 16:9 küçük resim, süre rozeti, ilerleme çubuğu, kanal adı,
 * tür ve çocuk dostu rozetleri. Tümü tek bir dokunma hedefidir.
 */
export function ProgramCard({ program, width, compact = false, showChannel = true }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const kind = programKindMeta[program.kind];
  const adventureType = program.adventureTypes[0] ?? 'hiking';
  const hasProgress = program.progress > 0;

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/tv/watch/[id]', params: { id: program.id } })}
      scaleTo={0.975}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        width ? { width } : styles.full,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${program.title}, ${program.channel.name}`}
    >
      <AdventureImage uri={program.thumbnailUrl} adventureType={adventureType} style={styles.thumb} kucuk>
        <View style={styles.topRow}>
          <View style={[styles.pill, { backgroundColor: kind.color }]}>
            <Icon name={kind.icon} size={11} color="#FFFFFF" strokeWidth={2.6} />
            <Text variant="label" weight="extrabold" color="#FFFFFF">
              {t(kind.labelKey).toLocaleUpperCase(locale)}
            </Text>
          </View>
          {program.kidsFriendly ? (
            <View style={[styles.pill, styles.kids]} accessibilityLabel={t('tv.kidsFriendly')}>
              <Icon name="sparkle" size={11} color="#06120B" strokeWidth={2.6} />
            </View>
          ) : null}
        </View>
        <View style={[styles.playWrap, { pointerEvents: 'none' }]}>
          <View style={styles.play}>
            <Icon name="play" size={16} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        </View>
        <View style={styles.bottomRow}>
          {program.episode != null ? (
            <View style={styles.dark}>
              <Text variant="label" weight="extrabold" color="#FFFFFF">
                {t('tv.episode', { n: program.episode })}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.dark}>
            <Text variant="label" weight="extrabold" color="#FFFFFF">
              {hasProgress && compact
                ? t('tv.remaining', {
                    time: remainingLabel(program.durationMin, program.progress, locale),
                  })
                : formatDurationLabel(program.durationMin, locale)}
            </Text>
          </View>
        </View>
        {hasProgress ? (
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
      <View style={styles.body}>
        <Text variant={compact ? 'bodySm' : 'title'} weight="bold" numberOfLines={compact ? 1 : 2}>
          {program.title}
        </Text>
        <View style={styles.metaRow}>
          {showChannel ? (
            <>
              <View style={[styles.dot, { backgroundColor: program.channel.color }]} />
              <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.channel}>
                {program.channel.name}
              </Text>
            </>
          ) : null}
          <Text variant="caption" color="textSubtle" numberOfLines={1}>
            {t('tv.views', { count: formatCompact(program.viewsCount, locale) })} ·{' '}
            {formatRelative(program.publishedAt, new Date(), locale)}
          </Text>
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  full: { width: '100%' },
  thumb: { width: '100%', aspectRatio: 16 / 9 },
  topRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
  },
  kids: { backgroundColor: '#FDE68A', paddingHorizontal: 6 },
  playWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(8,14,12,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  bottomRow: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dark: {
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: { height: 3 },
  body: { padding: spacing.md, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  channel: { flexShrink: 1 },
});
