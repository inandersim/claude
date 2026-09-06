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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  EmptyState,
  Header,
  IconButton,
  Screen,
  Skeleton,
  Tappable,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';
import type { Message } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { MessageBubble } from '@/features/chat/components/MessageBubble';
import { useSendMessage, useThread } from '@/features/chat/hooks';
import { useUser } from '@/features/profile/hooks';

export default function ChatScreen() {
  const { id, matchId } = useLocalSearchParams<{ id: string; matchId?: string }>();
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const other = useUser(id);
  const thread = useThread(id);
  const send = useSendMessage(id, matchId || null);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  // Geçersiz kimlik: sohbet kabuğu yerine "bulunamadı" gösterilir.
  const notFound = !other.isLoading && !other.isError && !other.data;

  useEffect(() => {
    if (thread.data?.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [thread.data?.length]);

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    send.mutate(content);
  };

  return (
    <Screen edges={['top']}>
      <Header
        showBack
        title={other.data?.displayName ?? t('chat.title')}
        subtitle={other.data ? `@${other.data.username}` : undefined}
        right={
          other.data ? (
            <Tappable
              onPress={() => router.push({ pathname: '/user/[id]', params: { id } })}
              haptic="selection"
              accessibilityRole="button"
            >
              <Avatar
                uri={other.data.avatarUrl}
                name={other.data.displayName}
                size={36}
                verified={other.data.isVerified}
              />
            </Tappable>
          ) : null
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top}
      >
        {notFound ? (
          <EmptyState
            icon="user"
            title={t('notFound.title')}
            description={t('notFound.description')}
            action={{
              label: t('common.back'),
              onPress: () => goBack(router),
              icon: 'arrow-left',
            }}
          />
        ) : thread.isLoading ? (
          <View style={styles.skeletons}>
            <Skeleton width="60%" height={44} style={{ borderRadius: radius.lg }} />
            <Skeleton
              width="70%"
              height={44}
              style={{ borderRadius: radius.lg, alignSelf: 'flex-end' }}
            />
            <Skeleton width="50%" height={44} style={{ borderRadius: radius.lg }} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={thread.data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} mine={item.senderId === me.id} />
            )}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                icon="message-circle"
                title={t('chat.empty')}
                description={t('chat.emptyDescription')}
              />
            }
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}
        {notFound ? null : (
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
              placeholder={t('chat.placeholder')}
              placeholderTextColor={colors.textSubtle}
              style={[styles.input, { color: colors.text, fontFamily: fontFamily.medium }]}
              multiline
              maxLength={1000}
              accessibilityLabel={t('chat.placeholder')}
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
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.md, flexGrow: 1, justifyContent: 'flex-end' },
  skeletons: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 42,
    maxHeight: 120,
    justifyContent: 'center',
  },
  input: { fontSize: 15, paddingVertical: spacing.sm + 2 },
});
