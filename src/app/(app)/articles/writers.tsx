import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, EmptyState, ErrorState, Header, Screen, Skeleton } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { layout, radius, spacing } from '@/core/theme';
import { canPublish } from '@/domain';
import { WriterCard } from '@/features/articles/components/WriterCard';
import { useMyWriterProfile, useToggleFollowWriter, useWriters } from '@/features/articles/hooks';
import { SearchBar } from '@/features/explore/components/SearchBar';

export default function WritersScreen() {
  const router = useRouter();
  const { t } = useT();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const writers = useWriters(query || null);
  const follow = useToggleFollowWriter();
  const profile = useMyWriterProfile();

  const onToggleFollow = (userId: string) =>
    follow.mutate(userId, {
      onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
    });

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('articles.writers')}
        subtitle={t('articles.writersSubtitle')}
        showBack
        onBack={() => goBack(router, '/explore')}
        right={
          !profile.isLoading && !canPublish(profile.data) ? (
            <Button
              label={t('articles.becomeWriter')}
              icon="pencil"
              size="sm"
              variant="secondary"
              onPress={() => router.push('/articles/apply')}
            />
          ) : undefined
        }
      />
      <View style={styles.content}>
        <SearchBar value={query} onChange={setQuery} placeholder={t('articles.searchWriters')} />
        {writers.isError ? (
          <ErrorState onRetry={() => writers.refetch()} />
        ) : writers.isLoading ? (
          [0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={96} style={{ borderRadius: radius.xl }} />
          ))
        ) : writers.data && writers.data.length > 0 ? (
          writers.data.map((w) => (
            <WriterCard
              key={w.userId}
              writer={w}
              onToggleFollow={onToggleFollow}
              followPending={follow.isPending && follow.variables === w.userId}
            />
          ))
        ) : (
          <EmptyState icon="users" title={t('articles.emptyWriters')} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
});
