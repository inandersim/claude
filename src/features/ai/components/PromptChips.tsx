import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui';
import { spacing } from '@/core/theme';

export interface PromptChipsProps {
  prompts: string[];
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

/** Yatay kaydırılan hızlı komut çipleri. */
export function PromptChips({ prompts, onPick, disabled = false }: PromptChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {prompts.map((prompt) => (
        <Chip
          key={prompt}
          label={prompt}
          icon="sparkle"
          onPress={disabled ? undefined : () => onPick(prompt)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
});
