import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/core/theme';

interface Props {
  text: string;
}

interface GuideBlock {
  heading: string | null;
  paragraphs: string[];
}

/** Kısa, noktalama ile bitmeyen tek satırlık paragraf → başlık. */
function isHeading(paragraph: string): boolean {
  if (paragraph.includes('\n')) return false;
  const trimmed = paragraph.trim();
  if (trimmed.length === 0 || trimmed.length > 48) return false;
  return !/[.!?:;,]$/.test(trimmed);
}

/**
 * Düz metin rehberi (boş satırla ayrılmış paragraflar; kısa satırlar başlık) bloklara ayırır.
 */
export function parseGuide(text: string): GuideBlock[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const blocks: GuideBlock[] = [];
  let current: GuideBlock | null = null;
  for (const p of paragraphs) {
    if (isHeading(p)) {
      current = { heading: p, paragraphs: [] };
      blocks.push(current);
      continue;
    }
    if (!current) {
      current = { heading: null, paragraphs: [] };
      blocks.push(current);
    }
    current.paragraphs.push(p);
  }
  return blocks;
}

/** Rehber metnini başlık/paragraf kartları olarak gösterir. */
export function GuideSection({ text }: Props) {
  const { colors } = useTheme();
  const blocks = parseGuide(text);
  return (
    <View style={styles.root}>
      {blocks.map((b, i) => (
        <View
          key={`${b.heading ?? 'intro'}-${i}`}
          style={[styles.block, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {b.heading ? (
            <View style={styles.headRow}>
              <View style={[styles.bar, { backgroundColor: colors.primary }]} />
              <Text variant="h3">{b.heading}</Text>
            </View>
          ) : null}
          {b.paragraphs.map((p, j) => (
            <Text key={j} variant="body" color="textMuted">
              {p}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  block: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bar: { width: 4, height: 18, borderRadius: 2 },
});
