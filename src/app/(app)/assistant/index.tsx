import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
  Card,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { queryKeys } from '@/core/query/keys';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import { isRemoteAiConfigured } from '@/data/ai/remoteAi';
import { suggestPrompts, type AiThread } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { PromptChips } from '@/features/ai/components/PromptChips';
import { useAiContext, useAiThreads, useDeleteThread } from '@/features/ai/hooks';

export default function AssistantScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const me = useCurrentUser();
  const qc = useQueryClient();
  const ctx = useAiContext();
  const threads = useAiThreads();
  const remove = useDeleteThread();
  const [draft, setDraft] = useState('');
  const [remote] = useState(() => isRemoteAiConfigured());
  const prompts = suggestPrompts(ctx, locale);

  const startChat = (content: string) => {
    const text = content.trim();
    if (!text) return;
    setDraft('');
    // Önceki yarım kalmış "yeni sohbet" önbelleğini temizle
    qc.removeQueries({ queryKey: queryKeys.ai.thread(me.id, null), exact: true });
    router.push({ pathname: '/assistant/[threadId]', params: { threadId: 'new', initial: text } });
  };

  const confirmDelete = (thread: AiThread) => {
    Alert.alert(t('ai.deleteThread'), t('ai.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('ai.deleteThread'),
        style: 'destructive',
        onPress: () =>
          remove.mutate(thread.id, {
            onSuccess: () => toast(t('ai.deleted'), 'success'),
            onError: () => toast(t('common.error'), 'error'),
          }),
      },
    ]);
  };

  const header = (
    <View style={styles.headerBlock}>
      <Card elevated style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
          <Icon name="sparkles" size={22} color={colors.onPrimary} strokeWidth={2.2} />
        </View>
        <View style={styles.heroText}>
          <Text variant="h3">{t('ai.welcomeTitle')}</Text>
          <Text variant="bodySm" color="textMuted">
            {t('ai.welcomeBody')}
          </Text>
        </View>
      </Card>
      <View style={styles.mode}>
        <Icon name={remote ? 'cloud' : 'wifi-off'} size={12} color={colors.textSubtle} />
        <Text variant="label" color="textSubtle">
          {remote ? t('ai.onlineMode') : t('ai.offlineMode')}
        </Text>
      </View>
      <SectionHeader title={t('ai.quickTitle')} />
      <PromptChips prompts={prompts} onPick={startChat} />
      <SectionHeader title={t('ai.history')} />
    </View>
  );

  return (
    <Screen edges={['top']}>
      <Header title={t('ai.title')} subtitle={t('ai.subtitle')} showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={insets.top}
      >
        {threads.isError ? (
          <ErrorState onRetry={() => threads.refetch()} />
        ) : (
          <FlatList
            data={threads.data ?? []}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={header}
            renderItem={({ item }) => (
              <View style={styles.threadRow}>
                <Card
                  onPress={() =>
                    router.push({
                      pathname: '/assistant/[threadId]',
                      params: { threadId: item.id },
                    })
                  }
                  style={styles.threadCard}
                >
                  <View style={styles.threadBody}>
                    <Icon name="message-square" size={18} color={colors.primary} />
                    <View style={styles.threadText}>
                      <Text variant="title" numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text variant="caption" color="textMuted">
                        {formatRelative(item.updatedAt, new Date(), locale)}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.textSubtle} />
                  </View>
                </Card>
                <IconButton
                  icon="trash"
                  variant="ghost"
                  size={40}
                  color={colors.danger}
                  onPress={() => confirmDelete(item)}
                  accessibilityLabel={t('ai.deleteThread')}
                />
              </View>
            )}
            ListEmptyComponent={
              threads.isLoading ? (
                <View style={styles.skeletons}>
                  <Skeleton height={64} style={{ borderRadius: radius.lg }} />
                  <Skeleton height={64} style={{ borderRadius: radius.lg }} />
                </View>
              ) : (
                <EmptyState
                  icon="bot"
                  title={t('ai.historyEmpty')}
                  description={t('ai.historyEmptyBody')}
                  compact
                />
              )
            }
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
              accessibilityLabel={t('ai.placeholder')}
              onSubmitEditing={() => startChat(draft)}
              blurOnSubmit
            />
          </View>
          <IconButton
            icon="send"
            onPress={() => startChat(draft)}
            disabled={!draft.trim()}
            color={colors.onPrimary}
            style={{ backgroundColor: colors.primary }}
            accessibilityLabel={t('ai.send')}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: spacing.lg, flexGrow: 1 },
  headerBlock: { gap: spacing.sm, paddingTop: spacing.sm },
  hero: {
    marginHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 2 },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  threadCard: { flex: 1 },
  threadBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  threadText: { flex: 1, gap: 2 },
  skeletons: { paddingHorizontal: spacing.lg, gap: spacing.sm },
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
