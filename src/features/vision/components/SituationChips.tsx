import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { VISION_SITUATIONS, type VisionSituation } from '@/domain';

/** Her durumun ikonu (mevcut ikon kayıtlarından). */
export const SITUATION_ICONS: Record<VisionSituation, IconName> = {
  terrain: 'mountain',
  weather: 'cloud-sun',
  gear: 'backpack',
  injury: 'heart-pulse',
  wildlife: 'paw-print',
  plant: 'tree-pine',
  map: 'map',
  water: 'droplets',
  camp: 'tent',
  other: 'sparkles',
};

export interface SituationChipsProps {
  value: VisionSituation;
  onChange: (situation: VisionSituation) => void;
  disabled?: boolean;
  /** Kamera üstünde koyu zemin için açık renk */
  color?: string;
  size?: 'sm' | 'md';
}

/** Yatay kaydırılan 10 durum çipi. */
export function SituationChips({
  value,
  onChange,
  disabled = false,
  color,
  size = 'sm',
}: SituationChipsProps) {
  const { t } = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel={t('vision.situationTitle')}
    >
      {VISION_SITUATIONS.map((situation) => (
        <Chip
          key={situation}
          label={t(`vision.situation.${situation}`)}
          icon={SITUATION_ICONS[situation]}
          selected={situation === value}
          color={color}
          size={size}
          onPress={disabled ? undefined : () => onChange(situation)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
});
