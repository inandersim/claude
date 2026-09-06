import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Screen,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPE_META,
  buildChatItems,
  canManageGroup,
  formatDistance,
  type ChatItem,
  type GroupMessageWithSender,
  type Route,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { usePopularRoutes } from '@/features/explore/hooks';
import { Composer, type AttachmentKind } from '@/features/groups/components/Composer';
import { DayDivider } from '@/features/groups/components/DayDivider';
import { GroupHeader } from '@/features/groups/components/GroupHeader';
import { MessageBubble } from '@/features/groups/components/MessageBubble';
import { PinnedBar } from '@/features/groups/components/PinnedBar';
import { PollComposer } from '@/features/groups/components/PollComposer';
import {
  postingState,
  useGroup,
  useGroupMessages,
  useJoinGroup,
  useMarkRead,
  usePin,
  useSendGroupMessage,
  useVote,
} from '@/features/groups/hooks';

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const me = useCurrentUser();
  const [now] = useState(() => Date.now());

  const group = useGroup(id);
  const messages = useGroupMessages(id);
  const routes = usePopularRoutes();
  const send = useSendGroupMessage(id);
  const vote = useVote(id);
  const pin = usePin(id);
  const join = useJoinGroup();
  const location = useLocation();
  useMarkRead(id, Boolean(group.data?.membership) && (messages.data?.length ?? 0) > 0);

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<GroupMessageWithSender | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const listRef = useRef<FlatList<ChatItem<GroupMessageWithSender>>>(null);

  const items = useMemo(() => buildChatItems(messages.data ?? []), [messages.data]);
  const routeMap = useMemo(() => {
    const map = new Map<string, Route>();
    for (const r of routes.data ?? []) map.set(r.id, r);
    return map;
  }, [routes.data]);
  const pinnedMessage = useMemo(
    () => messages.data?.find((m) => m.id === group.data?.pinnedMessageId) ?? null,
    [messages.data, group.data?.pinnedMessageId],
  );

  const notFound = !group.isLoading && !group.isError && !group.data;
  const state = postingState(group.data);
  const manager = canManageGroup(group.data?.membership ?? null);
  const disabledLabel =
    state === 'readOnly'
      ? t('groups.channelReadOnly')
      : state === 'notMember'
        ? t('groups.notMember')
        : null;

  const onError = (e: unknown) =>
    toast(e instanceof Error ? e.message : t('common.error'), 'error');

  const sendText = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const reply = replyTo?.id ?? null;
    setReplyTo(null);
    send.mutate({ type: 'text', text, replyToId: reply }, { onError });
  };

  const onAttach = async (kind: AttachmentKind) => {
    if (kind === 'poll') return setPollOpen(true);
    if (kind === 'route') return setRouteOpen(true);
    if (kind === 'location') {
      send.mutate(
        {
          type: 'location',
          text: draft.trim() || t('groups.composer.locationSent'),
          coords: location.coords,
        },
        { onError },
      );
      setDraft('');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    send.mutate({ type: 'image', text: draft.trim(), imageUri: result.assets[0].uri }, { onError });
    setDraft('');
  };

  const onPin = (message: GroupMessageWithSender) => {
    const unpin = group.data?.pinnedMessageId === message.id;
    pin.mutate(unpin ? null : message.id, {
      onSuccess: () => toast(unpin ? t('groups.unpinDone') : t('groups.pinDone'), 'success'),
      onError,
    });
  };

  const scrollToPinned = () => {
    const index = items.findIndex(
      (i) => i.kind === 'message' && i.message.id === pinnedMessage?.id,
    );
    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  };

  const renderItem = ({ item }: { item: ChatItem<GroupMessageWithSender> }) => {
    if (item.kind === 'day') return <DayDivider date={item.date} now={now} />;
    const m = item.message;
    return (
      <MessageBubble
        message={m}
        mine={m.senderId === me.id}
        grouped={item.grouped}
        route={m.routeId ? (routeMap.get(m.routeId) ?? null) : null}
        pinned={group.data?.pinnedMessageId === m.id}
        canPin={manager}
        onReply={state === 'canPost' ? setReplyTo : undefined}
        onPin={manager ? onPin : undefined}
        onVote={
          group.data?.membership
            ? (messageId, optionIds) => vote.mutate({ messageId, optionIds }, { onError })
            : undefined
        }
      />
    );
  };

  return (
    <Screen edges={['top']}>
      <GroupHeader
        group={group.data}
        onBack={() => goBack(router, '/')}
        onInfo={() => router.push({ pathname: '/groups/info/[id]', params: { id } })}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top}
      >
        {pinnedMessage ? (
          <PinnedBar
            message={pinnedMessage}
            onPress={scrollToPinned}
            onUnpin={manager ? () => pin.mutate(null, { onError }) : undefined}
          />
        ) : null}

        {messages.isLoading || group.isLoading ? (
          <View style={styles.skeletons}>
            <Skeleton width="60%" height={44} style={{ borderRadius: radius.lg }} />
            <Skeleton
              width="70%"
              height={44}
              style={{ borderRadius: radius.lg, alignSelf: 'flex-end' }}
            />
            <Skeleton width="50%" height={44} style={{ borderRadius: radius.lg }} />
          </View>
        ) : notFound ? (
          /* Geçersiz kimlik: hata değil, "bulunamadı" gösterilir. */
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="users"
              title={t('notFound.title')}
              description={t('notFound.description')}
              action={{
                label: t('groups.title'),
                onPress: () => router.replace('/groups'),
                icon: 'arrow-left',
              }}
            />
          </View>
        ) : messages.isError || group.isError ? (
          <ErrorState onRetry={() => messages.refetch()} />
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            inverted
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollToIndexFailed={() => undefined}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon="message-circle"
                  title={t('groups.emptyChat')}
                  description={t('groups.emptyChatDescription')}
                  compact
                />
              </View>
            }
          />
        )}

        {state === 'notMember' && group.data ? (
          <View
            style={[
              styles.joinBar,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
              {group.data.privacy === 'private'
                ? t('groups.inviteRequired')
                : t('groups.notMember')}
            </Text>
            <Button
              label={t('groups.join')}
              size="sm"
              loading={join.isPending}
              onPress={() =>
                join.mutate(id, {
                  onSuccess: () => toast(t('groups.joined'), 'success'),
                  onError,
                })
              }
            />
          </View>
        ) : null}

        {notFound ? null : (
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={sendText}
            onAttach={(kind) => {
              onAttach(kind).catch(onError);
            }}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            sending={send.isPending}
            disabledLabel={disabledLabel}
            bottomInset={insets.bottom}
          />
        )}
      </KeyboardAvoidingView>

      <PollComposer
        visible={pollOpen}
        onClose={() => setPollOpen(false)}
        onSubmit={(poll) => {
          setPollOpen(false);
          send.mutate({ type: 'poll', text: '', poll }, { onError });
        }}
      />

      <Modal
        visible={routeOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRouteOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setRouteOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
        >
          <View style={styles.sheetHead}>
            <Text variant="h3" style={{ flex: 1 }}>
              {t('groups.composer.chooseRoute')}
            </Text>
            <IconButton
              icon="x"
              variant="ghost"
              onPress={() => setRouteOpen(false)}
              accessibilityLabel={t('common.close')}
            />
          </View>
          {(routes.data ?? []).length === 0 ? (
            <Text variant="bodySm" color="textMuted" style={{ paddingHorizontal: spacing.lg }}>
              {t('groups.composer.noRoutes')}
            </Text>
          ) : (
            (routes.data ?? []).map((r) => {
              const meta = ADVENTURE_TYPE_META[r.adventureType];
              return (
                <Tappable
                  key={r.id}
                  onPress={() => {
                    setRouteOpen(false);
                    send.mutate({ type: 'route', text: draft.trim(), routeId: r.id }, { onError });
                    setDraft('');
                  }}
                  haptic="selection"
                  style={[styles.routeRow, { borderBottomColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={r.name}
                >
                  <View style={[styles.routeIcon, { backgroundColor: colors.primarySoft }]}>
                    <Icon name={meta.icon} size={18} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="title" numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      {formatDistance(r.distanceKm, locale)} · {t(`difficulty.${r.difficulty}`)} ·{' '}
                      {r.locationName}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={colors.textSubtle} />
                </Tappable>
              );
            })
          )}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.md, flexGrow: 1 },
  emptyWrap: { transform: [{ scaleY: -1 }], paddingVertical: spacing.xxl },
  skeletons: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'flex-end' },
  joinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  routeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
