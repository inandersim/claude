import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { haptics } from '@/core/hooks/useHaptics';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { formatDate, formatDuration } from '@/core/utils/time';
import { ADVENTURE_TYPE_META, STREAM_STATUS_META, type StreamMessageWithAuthor } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { StreamPlayer } from '@/features/live/components/StreamPlayer';
import {
  useEndStream,
  useJoinStream,
  useLikeStream,
  useSendStreamMessage,
  useStream,
  useStreamMessages,
} from '@/features/live/hooks';

export default function LiveStreamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();

  const stream = useStream(id);
  const messages = useStreamMessages(id);
  const send = useSendStreamMessage(id);
  const like = useLikeStream(id);
  const end = useEndStream();
  const [draft, setDraft] = useState('');
  const [muted, setMuted] = useState(false);
  const listRef = useRef<FlatList<StreamMessageWithAuthor>>(null);

  const data = stream.data;
  const isHost = data?.hostId === me.id;
  useJoinStream(id, data?.status === 'live' && !isHost);

  useEffect(() => {
    if (messages.data?.length)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages.data?.length]);

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    send.mutate(content);
  };

  const onLike = () => {
    haptics.medium();
    like.mutate();
  };

  const onEnd = () => {
    end.mutate(id, {
      onSuccess: () => {
        toast(t('live.endedToast'), 'info');
        router.back();
      },
      onError: () => toast(t('common.error'), 'error'),
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {stream.isError ? (
        <View style={{ paddingTop: insets.top }}>
          <ErrorState onRetry={() => stream.refetch()} />
        </View>
      ) : stream.isLoading ? (
        <View style={{ paddingTop: insets.top, gap: spacing.md }}>
          <Skeleton height={220} style={{ borderRadius: 0 }} />
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            <Skeleton width="70%" height={22} />
            <Skeleton height={14} />
          </View>
        </View>
      ) : data ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.playerWrap}>
            <StreamPlayer stream={data} muted={muted} />
            <View style={[styles.playerTop, { top: insets.top + spacing.sm }]}>
              <IconButton
                icon="chevron-left"
                variant="blur"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/live'))}
                accessibilityLabel={t('common.back')}
              />
              <View style={styles.playerTopRight}>
                {data.status === 'live' ? (
                  <View style={styles.viewers}>
                    <Icon name="eye" size={12} color="#FFFFFF" strokeWidth={2.4} />
                    <Text variant="label" weight="extrabold" color="#FFFFFF">
                      {formatCompact(data.viewerCount, locale)} {t('live.watching')}
                    </Text>
                  </View>
                ) : null}
                <IconButton
                  icon={muted ? 'mic-off' : 'mic'}
                  variant="blur"
                  size={36}
                  iconSize={16}
                  onPress={() => setMuted((m) => !m)}
                  accessibilityLabel={muted ? t('live.unmute') : t('live.mute')}
                />
              </View>
            </View>
          </View>

          {/* Yayın bilgisi */}
          <View style={[styles.info, { borderBottomColor: colors.border }]}>
            <Tappable
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: data.hostId } })}
              haptic="selection"
              style={styles.hostRow}
              accessibilityRole="button"
            >
              <Avatar
                uri={data.host.avatarUrl}
                name={data.host.displayName}
                size={40}
                verified={data.host.isVerified}
              />
              <View style={{ flex: 1 }}>
                <Text variant="title" numberOfLines={2}>
                  {data.title}
                </Text>
                <Text variant="caption" color="textMuted" numberOfLines={1}>
                  {data.host.displayName} · {data.locationName}
                </Text>
              </View>
            </Tappable>
            <View style={styles.chips}>
              <Badge
                label={t(STREAM_STATUS_META[data.status].labelKey)}
                color={STREAM_STATUS_META[data.status].color}
              />
              <Badge
                label={t(ADVENTURE_TYPE_META[data.adventureType].labelKey)}
                color={ADVENTURE_TYPE_META[data.adventureType].color}
                icon={ADVENTURE_TYPE_META[data.adventureType].icon}
              />
              {data.altitudeM !== null ? (
                <Badge label={`${data.altitudeM} m`} color="#6CB4FF" icon="mountain-snow" />
              ) : null}
              {data.status === 'ended' && data.startedAt && data.endedAt ? (
                <Badge
                  label={formatDuration(
                    Math.round(
                      (new Date(data.endedAt).getTime() - new Date(data.startedAt).getTime()) /
                        60_000,
                    ),
                    locale,
                  )}
                  color="#9AAEA3"
                  icon="timer"
                />
              ) : null}
              {data.status === 'scheduled' && data.scheduledAt ? (
                <Badge
                  label={formatDate(data.scheduledAt, locale, 'd MMM HH:mm')}
                  color="#6CB4FF"
                  icon="calendar"
                />
              ) : null}
            </View>
            {data.description ? (
              <Text variant="bodySm" color="textMuted" numberOfLines={3}>
                {data.description}
              </Text>
            ) : null}
            <View style={styles.actionsRow}>
              <Tappable
                onPress={onLike}
                haptic="none"
                scaleTo={0.9}
                style={[styles.likeBtn, { backgroundColor: colors.dangerSoft }]}
                accessibilityRole="button"
                accessibilityLabel={t('live.likes')}
              >
                <Icon name="heart" size={18} color={colors.danger} fill={colors.danger} />
                <Text variant="bodySm" weight="bold" color="danger">
                  {formatCompact(data.likesCount, locale)}
                </Text>
              </Tappable>
              <View style={{ flex: 1 }} />
              {isHost && data.status === 'live' ? (
                <Button
                  label={t('live.endStream')}
                  variant="danger"
                  icon="square"
                  size="sm"
                  onPress={onEnd}
                  loading={end.isPending}
                />
              ) : data.status === 'scheduled' ? (
                <Button
                  label={t('live.remind')}
                  variant="secondary"
                  icon="bell-ring"
                  size="sm"
                  onPress={() => toast(t('live.reminded'), 'success')}
                />
              ) : null}
            </View>
          </View>

          {/* Sohbet */}
          {messages.isLoading ? (
            <View style={{ padding: spacing.lg, gap: spacing.sm }}>
              <Skeleton height={36} />
              <Skeleton height={36} width="80%" />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages.data ?? []}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <Animated.View entering={FadeInUp.duration(180)} style={styles.msg}>
                  <Avatar uri={item.author.avatarUrl} name={item.author.displayName} size={26} />
                  <Text variant="bodySm" style={{ flex: 1 }}>
                    <Text
                      variant="bodySm"
                      weight="bold"
                      color={item.authorId === data.hostId ? 'danger' : 'primary'}
                    >
                      {item.author.displayName}
                    </Text>{' '}
                    {item.content}
                  </Text>
                </Animated.View>
              )}
              contentContainerStyle={styles.msgList}
              ListEmptyComponent={
                <EmptyState compact icon="message-circle" title={t('chat.empty')} />
              }
              showsVerticalScrollIndicator={false}
            />
          )}

          <View
            style={[
              styles.composer,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('live.chatPlaceholder')}
                placeholderTextColor={colors.textSubtle}
                style={[styles.input, { color: colors.text, fontFamily: fontFamily.medium }]}
                maxLength={300}
                onSubmitEditing={submit}
                returnKeyType="send"
                accessibilityLabel={t('live.chatPlaceholder')}
              />
            </View>
            <IconButton
              icon="send"
              onPress={submit}
              disabled={!draft.trim()}
              color={colors.onPrimary}
              style={{ backgroundColor: colors.primary }}
              accessibilityLabel={t('common.send')}
            />
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={{ paddingTop: insets.top }}>
          <EmptyState
            icon="video-off"
            title={t('notFound.title')}
            description={t('notFound.description')}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  playerWrap: { width: '100%' },
  playerTop: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerTopRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  viewers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
  },
  info: { padding: spacing.lg, gap: spacing.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radius.full,
  },
  msgList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  msg: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 42,
    justifyContent: 'center',
  },
  input: { fontSize: 15 },
});
