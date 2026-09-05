import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { useCurrentUser } from '@/features/auth/session.store';
import { useStreams } from '@/features/live/hooks';
import { useStoryGroups } from '@/features/stories/hooks';

/** Ana sayfa üst şeridi: An ekle · canlı yayıncılar · anlar (görülmemişler önce). */
export function StoriesStrip() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const streams = useStreams();
  const groups = useStoryGroups();
  const live = streams.data?.filter((s) => s.status === 'live') ?? [];
  const list = groups.data ?? [];
  const mine = list.find((g) => g.author.id === me.id);
  const others = list.filter((g) => g.author.id !== me.id);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Tappable
        onPress={() =>
          mine
            ? router.push({ pathname: '/stories/[authorId]', params: { authorId: me.id } })
            : router.push('/stories/create')
        }
        haptic="selection"
        scaleTo={0.92}
        style={styles.item}
        accessibilityRole="button"
        accessibilityLabel={t('stories.add')}
      >
        <View
          style={[
            styles.ring,
            {
              borderColor: mine ? colors.primary : colors.borderStrong,
              borderStyle: mine ? 'solid' : 'dashed',
            },
          ]}
        >
          <Avatar uri={me.avatarUrl} name={me.displayName} size={52} />
        </View>
        <View
          style={[styles.plus, { backgroundColor: colors.primary, borderColor: colors.background }]}
        >
          <Icon name="plus" size={12} color={colors.onPrimary} strokeWidth={3} />
        </View>
        <Text variant="label" color="textMuted" numberOfLines={1}>
          {mine ? t('stories.yours') : t('stories.add')}
        </Text>
      </Tappable>

      {live.map((s) => (
        <Tappable
          key={`live-${s.id}`}
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
              {s.source === 'drone'
                ? t('drone.badge')
                : t('live.liveNow').toLocaleUpperCase('tr-TR')}
            </Text>
          </View>
          <Text variant="label" numberOfLines={1}>
            {s.host.displayName.split(' ')[0]}
          </Text>
        </Tappable>
      ))}

      {others.map((g) => (
        <Tappable
          key={g.author.id}
          onPress={() =>
            router.push({ pathname: '/stories/[authorId]', params: { authorId: g.author.id } })
          }
          haptic="selection"
          scaleTo={0.92}
          style={styles.item}
          accessibilityRole="button"
          accessibilityLabel={g.author.displayName}
        >
          <View
            style={[
              styles.ring,
              {
                borderColor: g.allSeen ? colors.borderStrong : colors.primary,
                borderWidth: g.allSeen ? 1.5 : 2.5,
              },
            ]}
          >
            <Avatar uri={g.author.avatarUrl} name={g.author.displayName} size={52} />
          </View>
          <Text variant="label" color={g.allSeen ? 'textMuted' : 'text'} numberOfLines={1}>
            {g.author.displayName.split(' ')[0]}
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
  plus: {
    position: 'absolute',
    top: 42,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
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
