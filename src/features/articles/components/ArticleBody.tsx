import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/core/theme';
import { parseArticleBody, type ArticleBlock } from '@/domain';

/**
 * Basit markdown gövdeyi bloklar halinde çizer: başlıklar, paragraflar,
 * madde listesi, alıntı (sol şeritli) ve görsel (expo-image, alt yazılı).
 */
export function ArticleBody({ body }: { body: string }) {
  const blocks = useMemo(() => parseArticleBody(body), [body]);
  return (
    <View style={styles.root}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} first={i === 0} />
      ))}
    </View>
  );
}

function Block({ block, first }: { block: ArticleBlock; first: boolean }) {
  const { colors } = useTheme();
  switch (block.type) {
    case 'h1':
      return (
        <Text
          variant="h2"
          accessibilityRole="header"
          style={[styles.h1, first && { marginTop: 0 }]}
        >
          {block.text}
        </Text>
      );
    case 'h2':
      return (
        <Text variant="h3" accessibilityRole="header" style={styles.h2}>
          {block.text}
        </Text>
      );
    case 'li':
      return (
        <View style={styles.li}>
          <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
          <Text variant="body" style={{ flex: 1 }}>
            {block.text}
          </Text>
        </View>
      );
    case 'quote':
      return (
        <View
          style={[
            styles.quote,
            { borderLeftColor: colors.accent, backgroundColor: colors.surfaceMuted },
          ]}
        >
          <Text variant="body" weight="medium" style={styles.quoteText}>
            {block.text}
          </Text>
        </View>
      );
    case 'img':
      return (
        <View style={styles.figure}>
          <Image
            source={{ uri: block.url }}
            style={[styles.image, { backgroundColor: colors.surfaceMuted }]}
            contentFit="cover"
            transition={200}
            accessibilityLabel={block.text}
          />
          {block.text ? (
            <Text variant="caption" color="textSubtle" align="center">
              {block.text}
            </Text>
          ) : null}
        </View>
      );
    default:
      return (
        <Text variant="body" style={styles.p}>
          {block.text}
        </Text>
      );
  }
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  h1: { marginTop: spacing.md },
  h2: { marginTop: spacing.xs },
  p: { fontSize: 16, lineHeight: 26 },
  li: { flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.xs, marginTop: -spacing.xs },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  quote: {
    borderLeftWidth: 3,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  quoteText: { fontStyle: 'italic', lineHeight: 24 },
  figure: { gap: spacing.xs },
  image: { width: '100%', aspectRatio: 3 / 2, borderRadius: radius.lg },
});
