import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Input,
  Screen,
  SectionHeader,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { Collection, FeedPost, ID } from '@/domain';
import { PostGrid } from '@/features/profile/components/PostGrid';
import { BottomSheet } from '@/features/social/components/BottomSheet';
import { CollectionCard } from '@/features/social/components/CollectionCard';
import { useCollections, useCreateCollection, useSavedPosts } from '@/features/social/hooks';

export default function SavedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ collection?: string }>();
  const { t } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const [collectionId, setCollectionId] = useState<ID | null>(params.collection ?? null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const collections = useCollections();
  const saved = useSavedPosts(collectionId);
  const createCollection = useCreateCollection();
  const cardWidth = Math.min(180, width * 0.44);
  const active = collections.data?.find((c) => c.id === collectionId) ?? null;

  const create = () => {
    if (!name.trim()) return toast(t('social.collectionNameRequired'), 'error');
    createCollection.mutate(name, {
      onSuccess: (c: Collection) => {
        setName('');
        setCreating(false);
        setCollectionId(c.id);
        toast(t('social.collectionCreated'), 'success');
      },
      onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
    });
  };

  return (
    <Screen scroll edges={['top']} contentStyle={styles.content}>
      <Header
        title={t('social.savedTab')}
        subtitle={active ? active.name : t('social.allSaved')}
        showBack
        right={
          <IconButton
            icon="plus"
            onPress={() => setCreating(true)}
            accessibilityLabel={t('social.newCollection')}
          />
        }
      />

      {/* Koleksiyonlar */}
      <View style={styles.section}>
        <SectionHeader title={t('social.collections')} />
        {collections.isError ? (
          <ErrorState onRetry={() => collections.refetch()} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hRow}
          >
            <Tappable
              onPress={() => setCollectionId(null)}
              scaleTo={0.96}
              style={[
                styles.allCard,
                {
                  width: cardWidth,
                  backgroundColor: colors.surface,
                  borderColor: collectionId === null ? colors.primary : colors.border,
                  borderWidth: collectionId === null ? 1.5 : StyleSheet.hairlineWidth,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('social.allSaved')}
              accessibilityState={{ selected: collectionId === null }}
            >
              <View style={[styles.allIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="bookmark" size={24} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text variant="title" numberOfLines={1}>
                {t('social.allSaved')}
              </Text>
            </Tappable>
            {collections.isLoading
              ? [0, 1].map((i) => (
                  <Skeleton
                    key={i}
                    width={cardWidth}
                    height={150}
                    style={{ borderRadius: radius.lg }}
                  />
                ))
              : (collections.data ?? []).map((c) => (
                  <CollectionCard
                    key={c.id}
                    collection={c}
                    width={cardWidth}
                    selected={collectionId === c.id}
                    onPress={(col) => setCollectionId((prev) => (prev === col.id ? null : col.id))}
                  />
                ))}
          </ScrollView>
        )}
        {!collections.isLoading && (collections.data?.length ?? 0) === 0 ? (
          <EmptyState
            compact
            icon="layers"
            title={t('social.noCollections')}
            description={t('social.noCollectionsDescription')}
            action={{
              label: t('social.newCollection'),
              onPress: () => setCreating(true),
              icon: 'plus',
              variant: 'secondary',
            }}
          />
        ) : null}
      </View>

      {/* Kayıtlı gönderiler */}
      <View style={styles.section}>
        <SectionHeader
          title={active ? active.name : t('social.allSaved')}
          subtitle={saved.data ? t('social.itemsCount', { count: saved.data.length }) : undefined}
        />
        {active ? (
          <View style={styles.filterRow}>
            <Chip label={t('social.allSaved')} onPress={() => setCollectionId(null)} size="sm" />
          </View>
        ) : null}
        {saved.isLoading ? (
          <View style={styles.skeletonGrid}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width="31%" height={110} style={{ borderRadius: radius.md }} />
            ))}
          </View>
        ) : saved.isError ? (
          <ErrorState onRetry={() => saved.refetch()} />
        ) : saved.data && saved.data.length > 0 ? (
          <PostGrid posts={saved.data as FeedPost[]} />
        ) : (
          <EmptyState
            icon="bookmark"
            title={t('social.noSaved')}
            description={t('social.noSavedDescription')}
            action={{
              label: t('social.discover'),
              onPress: () => router.push('/social'),
              icon: 'users',
            }}
          />
        )}
      </View>

      <BottomSheet
        visible={creating}
        onClose={() => setCreating(false)}
        title={t('social.newCollection')}
      >
        <Input
          label={t('social.collectionName')}
          icon="layers"
          value={name}
          onChangeText={setName}
          placeholder={t('social.collectionNamePlaceholder')}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={create}
        />
        <Button
          label={t('common.save')}
          icon="check"
          fullWidth
          loading={createCollection.isPending}
          onPress={create}
        />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.huge, gap: spacing.xl },
  section: { gap: spacing.sm },
  hRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
  allCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  allIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
  },
});
