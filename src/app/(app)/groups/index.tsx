import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { GROUP_KINDS, type GroupKind } from '@/domain';
import { SearchBar } from '@/features/explore/components/SearchBar';
import { GroupRow } from '@/features/groups/components/GroupRow';
import { useGroups, useJoinGroup } from '@/features/groups/hooks';

type Tab = 'chats' | 'discover';

export default function GroupsScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('chats');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<GroupKind | null>(null);

  const groups = useGroups({ query, kind, mineOnly: tab === 'chats' });
  const join = useJoinGroup();

  const totalUnread = useMemo(
    () => (groups.data ?? []).reduce((sum, g) => sum + (g.membership ? g.unreadCount : 0), 0),
    [groups.data],
  );
  const visible = useMemo(
    () =>
      tab === 'chats'
        ? (groups.data ?? [])
        : (groups.data ?? []).filter((g) => g.membership === null),
    [groups.data, tab],
  );

  const onJoin = (groupId: string, isChannel: boolean) =>
    join.mutate(groupId, {
      onSuccess: () => {
        toast(isChannel ? t('groups.joinedChannel') : t('groups.joined'), 'success');
        router.push({ pathname: '/groups/[id]', params: { id: groupId } });
      },
      onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
    });

  const segments: { value: Tab; label: string; badge?: number }[] = [
    { value: 'chats', label: t('groups.tabs.chats'), badge: totalUnread || undefined },
    { value: 'discover', label: t('groups.tabs.discover') },
  ];

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={t('groups.title')}
        subtitle={t('groups.subtitle')}
        showBack
        right={
          <IconButton
            icon="plus"
            onPress={() => router.push('/groups/create')}
            accessibilityLabel={t('groups.newGroup')}
          />
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.controls}>
          <SegmentedControl segments={segments} value={tab} onChange={setTab} />
          <SearchBar value={query} onChange={setQuery} placeholder={t('groups.search')} />
          <View style={styles.chips}>
            <Chip
              label={t('common.all')}
              selected={kind === null}
              onPress={() => setKind(null)}
              size="sm"
            />
            {GROUP_KINDS.map((k) => (
              <Chip
                key={k}
                label={t(`groups.kind.${k}`)}
                icon={k === 'channel' ? 'radio' : 'users'}
                selected={kind === k}
                onPress={() => setKind(kind === k ? null : k)}
                size="sm"
              />
            ))}
          </View>
          <View style={styles.actions}>
            <Button
              label={t('groups.newGroup')}
              icon="plus"
              size="sm"
              onPress={() => router.push('/groups/create')}
              style={{ flex: 1 }}
            />
            <Button
              label={t('groups.joinByCode')}
              icon="key-round"
              size="sm"
              variant="secondary"
              onPress={() => router.push('/groups/join')}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {tab === 'discover' ? (
          <View style={styles.discoverHead}>
            <Text variant="h3">{t('groups.discover')}</Text>
            <Text variant="caption" color="textMuted">
              {t('groups.discoverSubtitle')}
            </Text>
          </View>
        ) : null}

        {groups.isLoading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.skeletonRow}>
                <Skeleton width={52} height={52} round />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="60%" height={16} />
                  <Skeleton width="90%" height={12} />
                </View>
              </View>
            ))}
          </View>
        ) : groups.isError ? (
          <ErrorState onRetry={() => groups.refetch()} />
        ) : visible.length === 0 ? (
          tab === 'chats' ? (
            <EmptyState
              icon="users"
              title={t('groups.empty')}
              description={t('groups.emptyDescription')}
              action={{
                label: t('groups.discover'),
                icon: 'compass',
                onPress: () => setTab('discover'),
              }}
            />
          ) : (
            <EmptyState
              icon="search"
              title={t('groups.emptyDiscover')}
              description={t('groups.emptyDiscoverDescription')}
              action={{
                label: t('groups.newGroup'),
                icon: 'plus',
                onPress: () => router.push('/groups/create'),
              }}
            />
          )
        ) : (
          <View style={{ backgroundColor: colors.background }}>
            {visible.map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                showJoin={tab === 'discover'}
                onJoin={tab === 'discover' ? () => onJoin(g.id, g.kind === 'channel') : undefined}
                onPress={() => router.push({ pathname: '/groups/[id]', params: { id: g.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.huge },
  controls: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  discoverHead: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  skeletons: { padding: spacing.lg, gap: spacing.lg },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
