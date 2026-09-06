import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { Lesson } from '@/domain';

interface Props {
  lesson: Lesson;
}

/** Okuma dersi: başlık, tahmini süre ve paragraflar (boş satırla ayrılır). */
export function ReadingView({ lesson }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const paragraphs = lesson.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <View style={styles.root}>
      <View style={[styles.meta, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name="book-open" size={14} color={colors.primary} />
        <Text variant="caption" weight="bold" color="textMuted">
          {t('courses.readingTime', { min: lesson.durationMin })}
        </Text>
      </View>
      <Text variant="h2">{lesson.title}</Text>
      {paragraphs.map((p, i) => {
        // "1. ..." ya da "- ..." ile başlayan satırlar liste öğesi gibi girintilenir.
        const lines = p.split('\n');
        return (
          <View key={i} style={{ gap: spacing.xs }}>
            {lines.map((line, j) => {
              const isItem = /^(\d+[.)]|[-•])\s/.test(line);
              return (
                <Text
                  key={j}
                  variant="body"
                  style={[styles.paragraph, isItem && styles.item]}
                  color={isItem ? 'text' : 'text'}
                >
                  {line}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  meta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    height: 28,
    borderRadius: radius.full,
  },
  paragraph: { lineHeight: 24 },
  item: { paddingLeft: spacing.md },
});
