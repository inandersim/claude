import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { Collection } from '@/domain';

interface Props {
  collection: Collection;
  selected?: boolean;
  onPress?: (collection: Collection) => void;
  width?: number;
}

/** Koleksiyon kartı: kapak, ad ve gönderi sayısı. */
export function CollectionCard({ collection, selected = false, onPress, width }: Props) {
  const { colors } = useTheme();
  const { t } = useT();

  return (
    <Tappable
      onPress={onPress ? () => onPress(collection) : undefined}
      haptic="selection"
      scaleTo={0.96}
      style={[
        styles.card,
        {
          width,
          backgroundColor: colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={collection.name}
      accessibilityState={{ selected }}
    >
      <AdventureImage uri={collection.coverUrl} adventureType="hiking" style={styles.cover} overlay kucuk>
        {!collection.coverUrl ? (
          <View style={styles.coverIcon}>
            <Icon name="bookmark" size={26} color="#FFFFFF" strokeWidth={1.8} />
          </View>
        ) : null}
        <View style={styles.count}>
          <Text variant="label" weight="extrabold" color="#FFFFFF">
            {t('social.itemsCount', { count: collection.count })}
          </Text>
        </View>
      </AdventureImage>
      <View style={styles.body}>
        <Text variant="title" numberOfLines={1}>
          {collection.name}
        </Text>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  cover: { aspectRatio: 4 / 3 },
  coverIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  count: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
});
