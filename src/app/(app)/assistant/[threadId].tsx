import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';
import type { AiAction, AiMessage } from '@/domain';
import { ChatBubble } from '@/features/ai/components/ChatBubble';
import { TripPlanCard } from '@/features/ai/components/TripPlanCard';
import { TypingDots } from '@/features/ai/components/TypingDots';
import { useAiThread, useDeleteThread, usePlanTrip, useSendAiMessage } from '@/features/ai/hooks';

/** `threadId === 'new'` → `initial` parametresi ilk mesaj olarak gönderilir, sonra gerçek id'ye geçilir. */
export default function AssistantThreadScreen() {
  const { threadId, initial } = useLocalSearchParams<{ threadId: string; initial?: string }>();
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const isNew = threadId === 'new';
  const realId = isNew ? null : threadId;
  const thread = useAiThread(realId);
  const send = useSendAiMessage(realId);
  const plan = usePlanTrip();
  const remove = useDeleteThread();
  const [draft, setDraft] = useState('');
  const [planVisible, setPlanVisible] = useState(false);
  const startedRef = useRef(false);

  // Yeni sohbet: ilk mesajı bir kez gönder, yanıt gelince gerçek sohbete geç.
  useEffect(() => {
    if (!isNew || !initial || startedRef.current) return;
    startedRef.current = true;
    send.mutate(initial, {
      onSuccess: (reply) =>
        router.replace({ pathname: '/assistant/[threadId]', params: { threadId: reply.threadId } }),
      onError: () => toast(t('ai.sendError'), 'error'),
    });
  }, [isNew, initial, send, router, toast, t]);

  const messages = thread.data?.messages;
  // inverted FlatList için ters sıra; ilk eleman en yeni mesaj
  const data = useMemo(() => (messages ? [...messages].reverse() : []), [messages]);
  const count = data.length;
  const lastUserMessage = data.find((m) => m.role === 'user')?.content ?? null;

  const submit = () => {
    const content = draft.trim();
    if (!content || !realId) return;
    setDraft('');
    send.mutate(content, { onError: () => toast(t('ai.sendError'), 'error') });
  };

  const onAction = (action: AiAction) => {
    router.push(action.href as Href);
  };

  const onPlan = () => {
    const prompt = lastUserMessage ?? thread.data?.title ?? '';
    if (!prompt) return;
    setPlanVisible(true);
    plan.mutate(prompt, { onError: () => toast(t('ai.planError'), 'error') });
  };

  const onDelete = () => {
    if (!realId) return;
    Alert.alert(t('ai.deleteThread'), t('ai.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ai.deleteThread'),
        style: 'destructive',
        onPress: () =>
          remove.mutate(realId, {
            onSuccess: () => {
              toast(t('ai.deleted'), 'success');
              goBack(router, '/');
            },
            onError: () => toast(t('common.error'), 'error'),
          }),
      },
    ]);
  };

  const title = thread.data?.title || t('ai.assistant');
  const notFound = !isNew && !thread.isLoading && !thread.isError && thread.data === null;
  const busy = send.isPending;

  // inverted listede "header" en altta görünür: yazıyor animasyonu ve plan kartı burada.
  const footer = (
    <View>
      {busy ? <TypingDots label={t('ai.thinking')} /> : null}
      {planVisible && plan.isPending ? (
        <View style={styles.planLoading}>
          <Skeleton height={140} style={{ borderRadius: radius.lg }} />
          <Text variant="caption" color="textMuted" align="center">
            {t('ai.planning')}
          </Text>
        </View>
      ) : null}
      {planVisible && plan.data ? (
        <TripPlanCard
          plan={plan.data}
          onClose={() => setPlanVisible(false)}
          onOpenPlanner={() => router.push('/maps/planner')}
        />
      ) : null}
    </View>
  );

  return (
    <Screen edges={['top']}>
      <Header
        showBack
        title={title}
        subtitle={count > 0 ? t('ai.messagesCount', { count }) : undefined}
        onBack={() => goBack(router, '/')}
        right={
          realId ? (
            <View style={styles.headerActions}>
              <IconButton
                icon="route"
                variant="ghost"
                onPress={onPlan}
                disabled={plan.isPending || count === 0}
                accessibilityLabel={t('ai.planTrip')}
              />
              <IconButton
                icon="trash"
                variant="ghost"
                color={colors.danger}
                onPress={onDelete}
                accessibilityLabel={t('ai.deleteThread')}
              />
            </View>
          ) : null
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={insets.top}
      >
        {thread.isLoading ? (
          <View style={styles.skeletons}>
            <Skeleton width="60%" height={44} style={{ borderRadius: radius.lg }} />
            <Skeleton
              width="70%"
              height={44}
              style={{ borderRadius: radius.lg, alignSelf: 'flex-end' }}
            />
            <Skeleton width="50%" height={44} style={{ borderRadius: radius.lg }} />
          </View>
        ) : thread.isError ? (
          <ErrorState onRetry={() => thread.refetch()} />
        ) : notFound ? (
          <EmptyState
            icon="message-circle"
            title={t('ai.threadNotFound')}
            description={t('ai.threadNotFoundBody')}
            action={{ label: t('ai.newChat'), onPress: () => goBack(router, '/') }}
          />
        ) : (
          <FlatList<AiMessage>
            data={data}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatBubble message={item} onAction={onAction} />}
            ListHeaderComponent={footer}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
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
          <Text variant="label" color="textSubtle" style={styles.disclaimer}>
            {t('ai.disclaimer')}
          </Text>
          <View style={styles.composerRow}>
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('ai.placeholder')}
                placeholderTextColor={colors.textSubtle}
                style={[styles.input, { color: colors.text, fontFamily: fontFamily.medium }]}
                multiline
                maxLength={1000}
                editable={!isNew}
                accessibilityLabel={t('ai.placeholder')}
              />
            </View>
            <IconButton
              icon="send"
              onPress={submit}
              disabled={!draft.trim() || busy || isNew}
              color={colors.onPrimary}
              style={{ backgroundColor: colors.primary }}
              accessibilityLabel={t('ai.send')}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingVertical: spacing.md, flexGrow: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  skeletons: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'flex-end' },
  planLoading: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginVertical: spacing.sm },
  composer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  disclaimer: { paddingHorizontal: spacing.xs },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
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
