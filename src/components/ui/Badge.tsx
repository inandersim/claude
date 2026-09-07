import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/core/theme';
import { contrastRatio, okunurRenk } from '@/domain/contrast';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface BadgeProps {
  label: string;
  color: string;
  icon?: IconName;
  /** Koyu arka plan üzerinde yumuşak versiyon */
  soft?: boolean;
  style?: StyleProp<ViewStyle>;
}

function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function Badge({ label, color, icon, soft = true, style }: BadgeProps) {
  const { colors } = useTheme();

  // Rozet renkleri `ADVENTURE_TYPE_META` gibi tek bir sabit paletten gelir ve
  // o palet koyu tema için seçilmiş. Yumuşak modda ham renk **metin** olarak
  // kullanılıyordu: açık temanın krem zemininde kontrast 1.4–2.4 arasına
  // düşüyor, yani etiket okunmuyordu (tarayıcıda ölçüldü). Renk burada
  // zemine göre eşiği tutturana kadar koyulaştırılır; ton korunur.
  //
  // Yumuşak zemin, rengin %16'sının yüzeye karışmış hâli. Parlaklığı çok az
  // kaydırdığı için yüzeyin kendisine göre ölçmek yeterli ve temkinli.
  const yumusakOn = okunurRenk(color, colors.surface);

  // Dolu modda metin rengin **üzerine** biner: siyah mı beyaz mı okunur,
  // sabit değil, ölçüyle seçilir — koyu bir rozet renginde siyah kaybolur.
  const doluOn = contrastRatio('#06120B', color) >= contrastRatio('#FFFFFF', color)
    ? '#06120B'
    : '#FFFFFF';
  const on = soft ? yumusakOn : doluOn;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: soft ? withAlpha(color, 0.16) : color,
          borderColor: withAlpha(color, soft ? 0.3 : 0),
        },
        style,
      ]}
    >
      {icon ? (
        <Icon name={icon} size={12} color={on} strokeWidth={2.6} />
      ) : null}
      <Text variant="label" weight="extrabold" color={on}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
