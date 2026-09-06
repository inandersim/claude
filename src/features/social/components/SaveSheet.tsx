import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Icon, Input, Tappable, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { Collection, FeedPost, ID } from '@/domain';

import { BottomSheet } from './BottomSheet';
import { useCollections, useCreateCollection, useToggleSave } from '../hooks';

interface Props {
  post: FeedPost | null;
  onClose: () => void;
}

/** Koleksiyon seçerek kaydetme alt sayfası (yer imine uzun basınca). */
export function SaveSheet({ post, onClose }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const collections = useCollections();
  const createCollection = useCreateCollection();
  const toggleSave = useToggleSave();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const save = (collectionId: ID | null) => {
    if (!post) return;
    toggleSave.mutate(
      { postId: post.id, collectionId },
      {
        onSuccess: (p) => {
          toast(p.savedByMe ? t('social.savedToast') : t('social.unsavedToast'), 'success');
          onClose();
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  const create = () => {
    if (!name.trim()) return;
    createCollection.mutate(name, {
      onSuccess: (c) => {
        setName('');
        setCreating(false);
        toast(t('social.collectionCreated'), 'success');
        save(c.id);
      },
      onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
    });
  };

  return (
    <BottomSheet
      visible={Boolean(post)}
      onClose={onClose}
      title={t('social.selectCollection')}
      subtitle={post?.savedByMe ? t('social.saved') : undefined}
    >
      <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
        <View style={styles.list}>
          <Row
            icon="bookmark"
            label={t('social.withoutCollection')}
            onPress={() => save(null)}
            colors={colors}
          />
          {(collections.data ?? []).map((c: Collection) => (
            <Row
              key={c.id}
              icon="layers"
              label={c.name}
              meta={t('social.itemsCount', { count: c.count })}
              onPress={() => save(c.id)}
              colors={colors}
            />
          ))}
        </View>
      </ScrollView>
      {creating ? (
        <View style={styles.create}>
          <Input
            label={t('social.collectionName')}
            icon="plus"
            value={name}
            onChangeText={setName}
            placeholder={t('social.collectionNamePlaceholder')}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={create}
          />
          <Button
            label={t('social.newCollection')}
            fullWidth
            loading={createCollection.isPending}
            onPress={create}
          />
        </View>
      ) : (
        <Button
          label={t('social.newCollection')}
          variant="secondary"
          icon="plus"
          fullWidth
          onPress={() => setCreating(true)}
        />
      )}
    </BottomSheet>
  );
}

function Row({
  icon,
  label,
  meta,
  onPress,
  colors,
}: {
  icon: 'bookmark' | 'layers';
  label: string;
  meta?: string;
  onPress: () => void;
  colors: { surfaceMuted: string; border: string; primary: string; textSubtle: string };
}) {
  return (
    <Tappable
      onPress={onPress}
      haptic="selection"
      scaleTo={0.985}
      style={[styles.row, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={18} color={colors.primary} strokeWidth={2.2} />
      <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {meta ? (
        <Text variant="caption" color="textMuted">
          {meta}
        </Text>
      ) : null}
      <Icon name="chevron-right" size={16} color={colors.textSubtle} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  create: { gap: spacing.sm },
});
