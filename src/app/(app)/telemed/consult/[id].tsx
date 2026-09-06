import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
  Button,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { confirmDialog } from '@/core/utils/confirm';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';
import {
  canSend,
  detectCountry,
  isConsultOpen,
  localTriage,
  type ConsultMessage,
  type User,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { ConsultBubble } from '@/features/telemed/components/ConsultBubble';
import { ConsultHeader } from '@/features/telemed/components/ConsultHeader';
import { ConsultSummaryCard } from '@/features/telemed/components/ConsultSummaryCard';
import { DisclaimerBanner } from '@/features/telemed/components/DisclaimerBanner';
import { TriageCard } from '@/features/telemed/components/TriageCard';
import {
  useCancelConsult,
  useConsultation,
  useEndConsult,
  useSendConsultMessage,
} from '@/features/telemed/hooks';

type Row = ConsultMessage & { sender: User };

export default function ConsultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const me = useCurrentUser();

  const consult = useConsultation(id);
  const send = useSendConsultMessage(id);
  const end = useEndConsult(id);
  const cancel = useCancelConsult(id);
  const [draft, setDraft] = useState('');

  const data = consult.data ?? null;
  const open = data ? isConsultOpen(data.status) : false;
  const allowed = data ? canSend(data, me.id) : false;
  const rows = useMemo<Row[]>(() => (data ? [...data.messages].reverse() : []), [data]);
  // Kayıtlı adımlar istek dilinde; kartı kullanıcının diliyle yeniden üretiyoruz.
  const triage = useMemo(
    () => (data ? localTriage(data.complaint, locale, null) : null),
    [data, locale],
  );
  const countryCode = data?.coords ? detectCountry(data.coords) : null;

  const submit = () => {
    const content = draft.trim();
    if (!content || !allowed) return;
    setDraft('');
    send.mutate({ content }, { onError: () => toast(t('telemed.consult.sendError'), 'error') });
  };

  const onEnd = () =>
    confirmDialog(
      t('telemed.consult.end'),
      t('telemed.consult.endConfirm'),
      t('common.done'),
      t('common.cancel'),
      () =>
        end.mutate(null, {
          onSuccess: () => toast(t('telemed.consult.ended'), 'success'),
          onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
        }),
    );

  const onCancel = () =>
    confirmDialog(
      t('telemed.consult.cancel'),
      t('telemed.consult.cancelConfirm'),
      t('telemed.consult.cancel'),
      t('common.back'),
      () =>
        cancel.mutate(undefined, {
          onSuccess: () => toast(t('telemed.consult.cancelled'), 'info'),
          onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
        }),
    );

  if (consult.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header
          showBack
          onBack={() => goBack(router, '/explore')}
          title={t('telemed.consult.title')}
        />
        <View style={styles.skeletons}>
          <Skeleton height={120} />
          <Skeleton width="60%" height={44} style={{ borderRadius: radius.lg }} />
          <Skeleton
            width="70%"
            height={44}
            style={{ borderRadius: radius.lg, alignSelf: 'flex-end' }}
          />
        </View>
      </Screen>
    );
  }
  if (consult.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header
          showBack
          onBack={() => goBack(router, '/explore')}
          title={t('telemed.consult.title')}
        />
        <ErrorState onRetry={() => consult.refetch()} />
      </Screen>
    );
  }
  if (!data || !triage) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header
          showBack
          onBack={() => goBack(router, '/explore')}
          title={t('telemed.consult.title')}
        />
        <EmptyState icon="message-circle" title={t('telemed.consult.notFound')} />
      </Screen>
    );
  }

  const listHeader = (
    <View style={styles.listHead}>
      {open ? (
        <View style={styles.actions}>
          {data.status === 'active' ? (
            <Button
              label={t('telemed.consult.end')}
              icon="circle-check"
              variant="secondary"
              size="sm"
              loading={end.isPending}
              onPress={onEnd}
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            label={t('telemed.consult.cancel')}
            icon="x"
            variant="danger"
            size="sm"
            loading={cancel.isPending}
            onPress={onCancel}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
      {data.status === 'requested' ? (
        <View style={[styles.waiting, { backgroundColor: colors.warningSoft }]}>
          <Text variant="label" weight="bold" color={colors.warning}>
            {t('telemed.consult.waiting')}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('telemed.consult.waitingHint', { min: data.doctor?.responseMin ?? 5 })}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const listFooter = (
    <View style={styles.listFoot}>
      {open ? null : <ConsultSummaryCard consultation={data} />}
      <TriageCard
        triage={triage}
        countryCode={countryCode}
        collapsible
        initiallyCollapsed={data.status === 'completed'}
      />
      <DisclaimerBanner compact />
    </View>
  );

  return (
    <Screen edges={['top']}>
      <ConsultHeader consultation={data} onBack={() => goBack(router, '/explore')} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top}
      >
        <FlatList
          data={rows}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConsultBubble message={item} mine={item.senderId === me.id} />}
          // inverted: "header" en altta, "footer" en üstte görünür
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {open ? (
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
                placeholder={t('telemed.consult.composer')}
                placeholderTextColor={colors.textSubtle}
                style={[styles.input, { color: colors.text, fontFamily: fontFamily.medium }]}
                multiline
                maxLength={1000}
                editable={allowed}
                accessibilityLabel={t('telemed.consult.composer')}
              />
            </View>
            <IconButton
              icon="send"
              onPress={submit}
              disabled={!draft.trim() || !allowed}
              color={colors.onPrimary}
              style={{ backgroundColor: colors.primary }}
              accessibilityLabel={t('telemed.consult.send')}
            />
          </View>
        ) : (
          <View
            style={[
              styles.closed,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('telemed.consult.closed')}
            </Text>
            <Button
              label={t('telemed.consult.newConsult')}
              icon="plus"
              size="sm"
              onPress={() => router.replace('/telemed/request')}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeletons: { flex: 1, padding: spacing.lg, gap: spacing.md },
  list: { paddingVertical: spacing.md },
  listHead: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.sm },
  listFoot: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  waiting: { padding: spacing.md, borderRadius: radius.lg, gap: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
