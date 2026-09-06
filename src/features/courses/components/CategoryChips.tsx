import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { CATEGORY_META, COURSE_CATEGORIES, type CourseCategory } from '@/domain';

interface Props {
  value: CourseCategory | null;
  onChange: (value: CourseCategory | null) => void;
}

/** Yatay kaydırılabilir kategori chip'leri; "Tümü" + 12 kategori. */
export function CategoryChips({ value, onChange }: Props) {
  const { t } = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      <Chip
        label={t('courses.all')}
        icon="layers"
        size="sm"
        selected={value === null}
        onPress={() => onChange(null)}
      />
      {COURSE_CATEGORIES.map((c) => (
        <Chip
          key={c}
          label={t(CATEGORY_META[c].labelKey)}
          icon={CATEGORY_META[c].icon}
          color={CATEGORY_META[c].color}
          size="sm"
          selected={value === c}
          onPress={() => onChange(value === c ? null : c)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing.lg },
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 },
});
