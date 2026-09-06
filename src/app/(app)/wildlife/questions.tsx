import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { QuestionCard } from '@/features/wildlife/components/QuestionCard';
import {
  useOnlineHelpers,
  useWildlifeQuestions,
  type QuestionsFilter,
} from '@/features/wildlife/hooks';

type Tab = 'open' | 'urgent' | 'resolved' | 'mine';

const FILTERS: Record<Tab, QuestionsFilter> = {
  open: { status: 'open' },
  urgent: { urgentOnly: true },
  resolved: { status: 'resolved' },
  mine: { mineOnly: true },
};

/** Topluluk soruları: Açık / Acil / Çözülen / Benim sekmeleri. */
export default function WildlifeQuestionsScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('open');
  const [now] = useState(() => new Date());
  const questions = useWildlifeQuestions(FILTERS[tab]);
  const urgent = useWildlifeQuestions(FILTERS.urgent);
  const online = useOnlineHelpers();
  const list = questions.data ?? [];
  const urgentCount = (urgent.data ?? []).filter((q) => q.status !== 'resolved').length;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('wildlife.questions.title')}
        subtitle={t('wildlife.onlineHelpers', { count: online.data?.count ?? 0 })}
        showBack
        right={
          <Button
            label={t('wildlife.questions.ask')}
            icon="plus"
            size="sm"
            onPress={() => router.push('/wildlife/ask')}
          />
        }
      />
      <View style={styles.content}>
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          segments={[
            { value: 'open', label: t('wildlife.questions.tabs.open') },
            {
              value: 'urgent',
              label: t('wildlife.questions.tabs.urgent'),
              badge: urgentCount || undefined,
            },
            { value: 'resolved', label: t('wildlife.questions.tabs.resolved') },
            { value: 'mine', label: t('wildlife.questions.tabs.mine') },
          ]}
        />

        {online.data?.experts.length ? (
          <View style={styles.experts}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
              {online.data.experts.map((u) => u.displayName).join(', ')}
            </Text>
          </View>
        ) : null}

        {questions.isError ? (
          <ErrorState onRetry={() => void questions.refetch()} />
        ) : questions.isLoading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={132} style={styles.skeleton} />
            ))}
          </View>
        ) : list.length === 0 ? (
          <EmptyState
            icon="message-circle"
            title={t('wildlife.questions.empty')}
            description={t('wildlife.questions.emptyHint')}
            action={{
              label: t('wildlife.questions.ask'),
              icon: 'plus',
              onPress: () => router.push('/wildlife/ask'),
            }}
            compact
          />
        ) : (
          <View style={styles.list}>
            {list.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                now={now}
                onPress={() =>
                  router.push({ pathname: '/wildlife/question/[id]', params: { id: q.id } })
                }
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  flex: { flex: 1 },
  experts: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  list: { gap: spacing.sm },
  skeleton: { borderRadius: radius.lg },
});
