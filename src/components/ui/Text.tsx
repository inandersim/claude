import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import {
  fontFamily,
  typography,
  useTheme,
  type FontWeight,
  type Palette,
  type TextVariant,
} from '@/core/theme';

export type TextColor = keyof Pick<
  Palette,
  | 'text'
  | 'textMuted'
  | 'textSubtle'
  | 'textInverse'
  | 'primary'
  | 'accent'
  | 'danger'
  | 'success'
  | 'info'
  | 'onPrimary'
  | 'onAccent'
>;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor | (string & {});
  weight?: FontWeight;
  align?: TextStyle['textAlign'];
}

const paletteKeys = new Set([
  'text',
  'textMuted',
  'textSubtle',
  'textInverse',
  'primary',
  'accent',
  'danger',
  'success',
  'info',
  'onPrimary',
  'onAccent',
]);

export function Text({
  variant = 'body',
  color = 'text',
  weight,
  align,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  const spec = typography[variant];
  const resolvedColor = paletteKeys.has(color) ? colors[color as TextColor] : color;

  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: fontFamily[weight ?? spec.weight],
          fontSize: spec.fontSize,
          lineHeight: spec.lineHeight,
          letterSpacing: spec.letterSpacing,
          color: resolvedColor,
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
