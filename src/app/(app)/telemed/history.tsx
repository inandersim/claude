import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, Header, Screen, Skeleton } from '@/components/ui';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import { ConsultSummaryCard } from '@/features/telemed/components/ConsultSummaryCard';
import { useMyConsultations } from '@/features/telemed/hooks';

export default function TelemedHistoryScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const mine = useMyConsultations();

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        showBack
        onBack={() => goBack(router, '/explore')}
        title={t('telemed.history')}
        subtitle={t('telemed.historySubtitle')}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {mine.isLoading ? (
          [0, 1, 2].map((i) => (
            <View key={i} style={[styles.skeleton, { borderColor: colors.border }]}>
              <Skeleton width="40%" height={14} />
              <Skeleton width="90%" height={18} />
              <Skeleton width="60%" height={12} />
            </View>
          ))
        ) : mine.isError ? (
          <ErrorState onRetry={() => mine.refetch()} />
        ) : (mine.data ?? []).length === 0 ? (
          <EmptyState
            icon="message-circle"
            title={t('telemed.historyEmpty')}
            description={t('telemed.historyEmptyDescription')}
            action={{
              label: t('telemed.consultNow'),
              onPress: () => router.push('/telemed/request'),
              icon: 'heart-pulse',
            }}
          />
        ) : (
          (mine.data ?? []).map((c) => (
            <ConsultSummaryCard
              key={c.id}
              consultation={c}
              compact
              onPress={() =>
                router.push({ pathname: '/telemed/consult/[id]', params: { id: c.id } })
              }
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  skeleton: { padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg },
});
