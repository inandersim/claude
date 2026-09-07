import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/core/theme';
import { contrastRatio, okunurRenk } from '@/domain/contrast';

import { Icon, type IconName } from './Icon';
import { Tappable } from './Tappable';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Seçili durumda kullanılacak renk (varsayılan: primary) */
  color?: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  color,
  size = 'md',
  style,
}: ChipProps) {
  const { colors } = useTheme();
  const activeColor = color ?? colors.primary;

  // Seçili çipte metin rengin **üzerine** biner. Eskiden tema koyu mu diye
  // bakılıyordu; ama renk temadan gelmiyor, `kidAgeBandMeta` gibi sabit bir
  // paletten geliyor. Açık temada beyaz metin `#FFB547` üzerinde 1.76:1
  // veriyordu — tarayıcıda ölçüldü. Doğru seçim tahminle değil ölçüyle.
  const secilenOn =
    contrastRatio('#06120B', activeColor) >= contrastRatio('#FFFFFF', activeColor)
      ? '#06120B'
      : '#FFFFFF';

  // Seçili olmayan çipte ikon ham palet renginde çiziliyordu; açık zeminde
  // okunmuyordu. Zemine göre eşiği tutturana kadar koyulaşır, ton korunur.
  const bosIkon = okunurRenk(activeColor, colors.surfaceMuted);

  const fg = selected ? secilenOn : colors.textMuted;
  const height = size === 'sm' ? 30 : 36;

  const content = (
    <View
      style={[styles.row, { height, paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg }]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={size === 'sm' ? 14 : 16}
          color={selected ? fg : bosIkon}
          strokeWidth={2.4}
        />
      ) : null}
      <Text variant={size === 'sm' ? 'caption' : 'bodySm'} weight="bold" color={fg}>
        {label}
      </Text>
    </View>
  );

  const containerStyle = [
    styles.base,
    {
      backgroundColor: selected ? activeColor : colors.surfaceMuted,
      borderColor: selected ? activeColor : colors.border,
    },
    style,
  ];

  if (!onPress) return <View style={containerStyle}>{content}</View>;

  return (
    <Tappable
      onPress={onPress}
      haptic="selection"
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={containerStyle}
    >
      {content}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
});
