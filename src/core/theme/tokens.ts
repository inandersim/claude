/**
 * Zirve tasarım sistemi — temel tasarım token'ları.
 * Renkler, tipografi, boşluk ve köşe yarıçapı burada tek kaynaktan yönetilir.
 */

export type ColorScheme = 'light' | 'dark';

export interface Palette {
  /** Uygulama arka planı */
  background: string;
  /** Kart / yüzey arka planı */
  surface: string;
  /** Yükseltilmiş yüzey (bottom sheet, popover) */
  surfaceElevated: string;
  /** İnce vurgu yüzeyi (chip, input arka planı) */
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  skeleton: string;
  skeletonHighlight: string;
  tabBar: string;
  tabBarBorder: string;
}

export const palettes: Record<ColorScheme, Palette> = {
  dark: {
    background: '#0B1210',
    surface: '#121C18',
    surfaceElevated: '#18251F',
    surfaceMuted: '#1B2822',
    border: '#22312A',
    borderStrong: '#33473D',
    text: '#F2F7F4',
    textMuted: '#9AAEA3',
    textSubtle: '#66796F',
    textInverse: '#0B1210',
    primary: '#5EE39B',
    primaryStrong: '#2FCF7A',
    primarySoft: 'rgba(94, 227, 155, 0.14)',
    onPrimary: '#06120B',
    accent: '#FFB547',
    accentSoft: 'rgba(255, 181, 71, 0.16)',
    onAccent: '#1A1000',
    danger: '#FF6B6B',
    dangerSoft: 'rgba(255, 107, 107, 0.16)',
    success: '#5EE39B',
    successSoft: 'rgba(94, 227, 155, 0.14)',
    warning: '#FFB547',
    warningSoft: 'rgba(255, 181, 71, 0.16)',
    info: '#6CB4FF',
    infoSoft: 'rgba(108, 180, 255, 0.16)',
    overlay: 'rgba(4, 8, 6, 0.72)',
    skeleton: '#18251F',
    skeletonHighlight: '#22332A',
    tabBar: 'rgba(18, 28, 24, 0.92)',
    tabBarBorder: 'rgba(255,255,255,0.06)',
  },
  light: {
    background: '#F4F8F5',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#EDF3EF',
    border: '#E1EAE4',
    borderStrong: '#C9D6CE',
    text: '#0F1A15',
    textMuted: '#5B6B62',
    textSubtle: '#8C9A92',
    textInverse: '#FFFFFF',
    primary: '#16A35A',
    primaryStrong: '#0E8A4A',
    primarySoft: 'rgba(22, 163, 90, 0.12)',
    onPrimary: '#FFFFFF',
    accent: '#E9930C',
    accentSoft: 'rgba(233, 147, 12, 0.14)',
    onAccent: '#FFFFFF',
    danger: '#E5484D',
    dangerSoft: 'rgba(229, 72, 77, 0.12)',
    success: '#16A35A',
    successSoft: 'rgba(22, 163, 90, 0.12)',
    warning: '#E9930C',
    warningSoft: 'rgba(233, 147, 12, 0.14)',
    info: '#2E86F5',
    infoSoft: 'rgba(46, 134, 245, 0.12)',
    overlay: 'rgba(8, 16, 12, 0.55)',
    skeleton: '#E6EDE8',
    skeletonHighlight: '#F3F7F4',
    tabBar: 'rgba(255, 255, 255, 0.92)',
    tabBarBorder: 'rgba(15, 26, 21, 0.06)',
  },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  full: 999,
} as const;

export const fontFamily = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export type FontWeight = keyof typeof fontFamily;

export type TextVariant =
  'display' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodySm' | 'caption' | 'label';

export const typography: Record<
  TextVariant,
  { fontSize: number; lineHeight: number; weight: FontWeight; letterSpacing?: number }
> = {
  display: { fontSize: 36, lineHeight: 42, weight: 'extrabold', letterSpacing: -0.8 },
  h1: { fontSize: 28, lineHeight: 34, weight: 'extrabold', letterSpacing: -0.5 },
  h2: { fontSize: 22, lineHeight: 28, weight: 'bold', letterSpacing: -0.3 },
  h3: { fontSize: 18, lineHeight: 24, weight: 'bold', letterSpacing: -0.2 },
  title: { fontSize: 16, lineHeight: 22, weight: 'semibold' },
  body: { fontSize: 15, lineHeight: 22, weight: 'regular' },
  bodySm: { fontSize: 13, lineHeight: 18, weight: 'regular' },
  caption: { fontSize: 12, lineHeight: 16, weight: 'medium' },
  label: { fontSize: 11, lineHeight: 14, weight: 'semibold', letterSpacing: 0.4 },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
} as const;

export const layout = {
  /** Sekme çubuğunun kapladığı alan; listelerde alt boşluk için kullanılır */
  tabBarHeight: 72,
  screenPadding: spacing.lg,
  maxContentWidth: 640,
} as const;

export const durations = {
  fast: 140,
  normal: 220,
  slow: 360,
} as const;
