import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AdventureImage,
  Avatar,
  EmptyState,
  Icon,
  IconButton,
  Screen,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import { ADVENTURE_TYPE_META } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useMarkStorySeen, useStoryGroups } from '@/features/stories/hooks';

const DURATION_MS = 6000;

export default function StoryViewerScreen() {
  const { authorId } = useLocalSearchParams<{ authorId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const groups = useStoryGroups();
  const markSeen = useMarkStorySeen();

  const list = groups.data ?? [];
  // Bilinmeyen kimlikte başka birinin anını göstermeyelim: -1 korunur.
  const groupIndex = list.findIndex((g) => g.author.id === authorId);
  const group = groupIndex >= 0 ? list[groupIndex] : undefined;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const story = group?.stories[index];
  const progress = useSharedValue(0);

  const goNext = () => {
    if (!group) return goBack(router);
    if (index < group.stories.length - 1) return setIndex((i) => i + 1);
    const nextGroup = list[groupIndex + 1];
    if (nextGroup) {
      setIndex(0);
      router.setParams({ authorId: nextGroup.author.id });
    } else goBack(router);
  };
  const goPrev = () => {
    if (index > 0) return setIndex((i) => i - 1);
    const prevGroup = list[groupIndex - 1];
    if (prevGroup) {
      setIndex(prevGroup.stories.length - 1);
      router.setParams({ authorId: prevGroup.author.id });
    }
  };

  useEffect(() => {
    if (!story) return;
    if (story.authorId !== me.id) markSeen.mutate(story.id);
    progress.set(0);
    progress.set(withTiming(1, { duration: DURATION_MS, easing: Easing.linear }));
    const timer = setTimeout(goNext, DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  const meta = useMemo(() => (story ? ADVENTURE_TYPE_META[story.adventureType] : null), [story]);

  if (groups.isLoading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!group || !story) {
    return (
      <Screen edges={['top']} contentStyle={styles.center}>
        <EmptyState
          icon="camera"
          title={t('notFound.title')}
          description={t('notFound.description')}
          action={{ label: t('common.back'), onPress: () => goBack(router), icon: 'arrow-left' }}
        />
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <AdventureImage
        uri={story.mediaUrl}
        adventureType={story.adventureType}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        overlay
      />
      {/* Dokunma alanları */}
      <Pressable
        style={[styles.tapZone, { left: 0, width: width * 0.3 }]}
        onPress={goPrev}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        accessibilityLabel={t('social.storyPrev')}
      />
      <Pressable
        style={[styles.tapZone, { right: 0, width: width * 0.7 }]}
        onPress={goNext}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        accessibilityLabel={t('social.storyNext')}
      />

      <View style={[styles.top, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.bars}>
          {group.stories.map((s, i) => (
            <View key={s.id} style={styles.barTrack}>
              {i < index ? (
                <View style={[styles.barFill, { width: '100%' }]} />
              ) : i === index ? (
                <Animated.View style={[styles.barFill, barStyle]} />
              ) : null}
            </View>
          ))}
        </View>
        <View style={styles.head}>
          <Avatar
            uri={group.author.avatarUrl}
            name={group.author.displayName}
            size={36}
            verified={group.author.isVerified}
          />
          <View style={{ flex: 1 }}>
            <Text variant="title" color="#FFFFFF">
              {group.author.displayName}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.75)">
              {formatRelative(story.createdAt, new Date(), locale)} · {story.locationName}
            </Text>
          </View>
          {paused ? <Icon name="clock" size={16} color="#FFFFFF" /> : null}
          <IconButton
            icon="x"
            variant="blur"
            size={36}
            iconSize={18}
            onPress={() => goBack(router)}
            accessibilityLabel={t('common.close')}
          />
        </View>
      </View>

      <View
        style={[styles.bottom, { bottom: insets.bottom + spacing.lg }]}
        pointerEvents="box-none"
      >
        {meta ? (
          <View style={[styles.typePill, { backgroundColor: meta.color }]}>
            <Icon name={meta.icon} size={12} color="#06120B" strokeWidth={2.6} />
            <Text variant="label" weight="extrabold" color="#06120B">
              {t(meta.labelKey).toLocaleUpperCase(locale)}
              {story.altitudeM !== null ? ` · ${story.altitudeM} m` : ''}
            </Text>
          </View>
        ) : null}
        {story.caption ? (
          <Text variant="h3" color="#FFFFFF">
            {story.caption}
          </Text>
        ) : null}
        <View style={styles.footRow}>
          <Icon name="eye" size={14} color="rgba(255,255,255,0.75)" />
          <Text variant="caption" color="rgba(255,255,255,0.75)">
            {story.viewsCount} {t('stories.views')}
          </Text>
          <View style={{ flex: 1 }} />
          {story.authorId !== me.id ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/chat/[id]', params: { id: story.authorId, matchId: '' } })
              }
              style={styles.reply}
              accessibilityRole="button"
            >
              <Icon name="message-circle" size={16} color="#FFFFFF" />
              <Text variant="bodySm" weight="bold" color="#FFFFFF">
                {t('stories.reply')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tapZone: { position: 'absolute', top: 0, bottom: 0 },
  top: { position: 'absolute', left: spacing.md, right: spacing.md, gap: spacing.sm },
  bars: { flexDirection: 'row', gap: 4 },
  barTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#FFFFFF' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bottom: { position: 'absolute', left: spacing.lg, right: spacing.lg, gap: spacing.sm },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
  },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.55)',
  },
});
