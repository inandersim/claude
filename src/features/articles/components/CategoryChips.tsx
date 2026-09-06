import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { ARTICLE_CATEGORIES, topicMeta, type ArticleCategory } from '@/domain';

interface Props {
  value: ArticleCategory | null;
  onChange: (value: ArticleCategory | null) => void;
  /** "Tümü" seçeneğini gizle (form kullanımı) */
  withAll?: boolean;
  /** Yatay kaydırma yerine sarmalanan düzen */
  wrap?: boolean;
}

/** Kategori chip'leri: yatay şerit ya da sarmalanan seçim listesi. */
export function CategoryChips({ value, onChange, withAll = true, wrap = false }: Props) {
  const { t } = useT();
  const chips = (
    <>
      {withAll ? (
        <Chip
          label={t('articles.all')}
          icon="layers"
          size="sm"
          selected={value === null}
          onPress={() => onChange(null)}
        />
      ) : null}
      {ARTICLE_CATEGORIES.map((c) => (
        <Chip
          key={c}
          label={t(topicMeta[c].labelKey)}
          icon={topicMeta[c].icon}
          color={topicMeta[c].color}
          size="sm"
          selected={value === c}
          onPress={() => onChange(value === c && withAll ? null : c)}
        />
      ))}
    </>
  );
  if (wrap) {
    return (
      <ScrollView horizontal={false} contentContainerStyle={styles.wrap} scrollEnabled={false}>
        {chips}
      </ScrollView>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing.lg },
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
