import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDurationLabel, isWatchCompleted, type TvProgramWithChannel } from '@/domain';

interface Props {
  episodes: TvProgramWithChannel[];
  /** Şu an izlenen bölüm */
  currentId?: string | null;
}

/** Dizi bölümleri listesi; izlenen bölüm vurgulanır, tamamlananlar tik alır. */
export function SeriesList({ episodes, currentId = null }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();

  return (
    <View style={styles.list}>
      {episodes.map((ep) => {
        const current = ep.id === currentId;
        const done = isWatchCompleted(ep.progress);
        return (
          <Tappable
            key={ep.id}
            onPress={() =>
              current
                ? undefined
                : router.replace({ pathname: '/tv/watch/[id]', params: { id: ep.id } })
            }
            scaleTo={0.985}
            style={[
              styles.row,
              {
                backgroundColor: current ? colors.primarySoft : colors.surface,
                borderColor: current ? colors.primary : colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: current }}
            accessibilityLabel={`${t('tv.episode', { n: ep.episode ?? 0 })}: ${ep.title}`}
          >
            <View
              style={[
                styles.num,
                { backgroundColor: current ? colors.primary : colors.surfaceMuted },
              ]}
            >
              {done ? (
                <Icon name="check" size={16} color={current ? colors.onPrimary : colors.success} />
              ) : current ? (
                <Icon name="play" size={14} color={colors.onPrimary} fill={colors.onPrimary} />
              ) : (
                <Text variant="bodySm" weight="extrabold" color="textMuted">
                  {ep.episode ?? '–'}
                </Text>
              )}
            </View>
            <View style={styles.body}>
              <Text variant="bodySm" weight={current ? 'extrabold' : 'semibold'} numberOfLines={2}>
                {ep.title}
              </Text>
              <Text variant="caption" color="textSubtle">
                {t('tv.episode', { n: ep.episode ?? 0 })} ·{' '}
                {formatDurationLabel(ep.durationMin, locale)}
              </Text>
              {ep.progress > 0 && !done ? (
                <View style={[styles.track, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.round(ep.progress * 100)}%`,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  num: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  fill: { height: 3 },
});
