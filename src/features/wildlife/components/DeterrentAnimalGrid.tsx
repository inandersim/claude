import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Icon, Tappable, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { DeterrentAnimal } from '@/domain';
import { DETERRENT_ANIMALS, animalEmoji } from '@/domain';

const ANIMAL_ICONS: Record<DeterrentAnimal, IconName> = {
  bear: 'paw-print',
  wolf: 'footprints',
  boar: 'bone',
  dog: 'paw-print',
  snake: 'activity',
  jackal: 'moon',
  monkey: 'trees',
  elephant: 'mountain',
  big_cat: 'eye',
};

export interface DeterrentAnimalGridProps {
  value: DeterrentAnimal | null;
  onChange: (animal: DeterrentAnimal) => void;
}

/** 9 hayvan, büyük emoji + ikon; seçili olan vurgulu. */
export function DeterrentAnimalGrid({ value, onChange }: DeterrentAnimalGridProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 5 : 3;
  const gap = spacing.sm;
  const cell = (Math.min(width, 640) - spacing.lg * 2 - gap * (columns - 1)) / columns;

  return (
    <View style={[styles.grid, { gap }]} accessibilityRole="radiogroup">
      {DETERRENT_ANIMALS.map((animal) => {
        const selected = animal === value;
        return (
          <Tappable
            key={animal}
            onPress={() => onChange(animal)}
            style={[
              styles.cell,
              {
                width: cell,
                backgroundColor: selected ? colors.danger : colors.surface,
                borderColor: selected ? colors.danger : colors.border,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={t(`wildlife.animal.${animal}`)}
          >
            <Text style={styles.emoji}>{animalEmoji(animal)}</Text>
            <View style={styles.label}>
              <Icon
                name={ANIMAL_ICONS[animal]}
                size={12}
                color={selected ? '#FFFFFF' : colors.textMuted}
              />
              <Text
                variant="caption"
                weight="bold"
                color={selected ? '#FFFFFF' : colors.text}
                numberOfLines={1}
              >
                {t(`wildlife.animal.${animal}`)}
              </Text>
            </View>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  emoji: { fontSize: 38 },
  label: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, maxWidth: '100%' },
});
