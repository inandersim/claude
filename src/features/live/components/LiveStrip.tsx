import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Icon, Tappable, Text } from '@/components/ui';
import { currentLocale, useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { useStreams } from '@/features/live/hooks';

/** Ana sayfa üstünde "hikâye" tarzı canlı yayıncı şeridi. */
export function LiveStrip() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const streams = useStreams();
  const live = streams.data?.filter((s) => s.status === 'live') ?? [];
  if (live.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Tappable
        onPress={() => router.push('/live/start')}
        haptic="selection"
        scaleTo={0.92}
        style={styles.item}
        accessibilityRole="button"
        accessibilityLabel={t('live.goLive')}
      >
        <View
          style={[
            styles.addRing,
            { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted },
          ]}
        >
          <Icon name="video" size={20} color={colors.text} strokeWidth={2.2} />
        </View>
        <Text variant="label" color="textMuted" numberOfLines={1}>
          {t('live.goLive')}
        </Text>
      </Tappable>
      {live.map((s) => (
        <Tappable
          key={s.id}
          onPress={() => router.push({ pathname: '/live/[id]', params: { id: s.id } })}
          haptic="selection"
          scaleTo={0.92}
          style={styles.item}
          accessibilityRole="button"
          accessibilityLabel={s.title}
        >
          <View style={[styles.ring, { borderColor: '#E5484D' }]}>
            <Avatar uri={s.host.avatarUrl} name={s.host.displayName} size={52} />
          </View>
          <View style={styles.liveTag}>
            <Text
              variant="label"
              weight="extrabold"
              color="#FFFFFF"
              style={{ fontSize: 9, lineHeight: 11 }}
            >
              {t('live.liveNow').toLocaleUpperCase(currentLocale())}
            </Text>
          </View>
          <Text variant="label" color="text" numberOfLines={1}>
            {s.host.displayName.split(' ')[0]}
          </Text>
        </Tappable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingVertical: spacing.xs },
  item: { alignItems: 'center', gap: 4, width: 64 },
  ring: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTag: {
    position: 'absolute',
    top: 48,
    paddingHorizontal: 5,
    height: 14,
    borderRadius: radius.full,
    backgroundColor: '#E5484D',
    justifyContent: 'center',
  },
});
