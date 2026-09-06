import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { spacing } from '@/core/theme';
import type { TvProgramWithChannel } from '@/domain';

import { ProgramCard } from './ProgramCard';

interface Props {
  programs: TvProgramWithChannel[];
  cardWidth?: number;
}

/** "İzlemeye devam et" yatay şeridi: kalan süre etiketli kompakt kartlar. */
export function ContinueRow({ programs, cardWidth = 232 }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {programs.map((p) => (
        <ProgramCard key={p.id} program={p} width={cardWidth} compact />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing.lg },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
