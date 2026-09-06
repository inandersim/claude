/**
 * Zirtan tasarım sistemi — temel tasarım token'ları.
 * Renkler, tipografi, boşluk ve köşe yarıçapı burada tek kaynaktan yönetilir.
 */

/**
 * Renk şemaları:
 * - light: doğa tonları (kum, orman yeşili, gökyüzü, gün batımı) — varsayılan gündüz görünümü
 * - dark: sıcak, derin orman gecesi (simsiyah değil)
 * - sun: dış mekân/güneş altı modu — maksimum kontrast, doygun vurgular
 */
export type ColorScheme = 'light' | 'dark' | 'sun';

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
  light: {
    background: '#F6F3EA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#EEF2E6',
    border: '#E3E6D8',
    borderStrong: '#C9CFBD',
    text: '#1B2A22',
    textMuted: '#5C6B60',
    textSubtle: '#8A978C',
    textInverse: '#FFFFFF',
    primary: '#2F7D4F',
    primaryStrong: '#24653F',
    primarySoft: 'rgba(47, 125, 79, 0.12)',
    onPrimary: '#FFFFFF',
    accent: '#E8722A',
    accentSoft: 'rgba(232, 114, 42, 0.14)',
    onAccent: '#FFFFFF',
    danger: '#D8443C',
    dangerSoft: 'rgba(216, 68, 60, 0.12)',
    success: '#2F7D4F',
    successSoft: 'rgba(47, 125, 79, 0.12)',
    warning: '#D98A0B',
    warningSoft: 'rgba(217, 138, 11, 0.14)',
    info: '#3A8DDE',
    infoSoft: 'rgba(58, 141, 222, 0.12)',
    overlay: 'rgba(20, 30, 24, 0.55)',
    skeleton: '#E9ECE0',
    skeletonHighlight: '#F4F6EE',
    tabBar: 'rgba(255, 255, 255, 0.94)',
    tabBarBorder: 'rgba(27, 42, 34, 0.08)',
  },
  dark: {
    background: '#10201B',
    surface: '#172A24',
    surfaceElevated: '#1D342C',
    surfaceMuted: '#213A31',
    border: '#2A443A',
    borderStrong: '#3B5A4D',
    text: '#F1F4EC',
    textMuted: '#A6B8AC',
    textSubtle: '#748A7C',
    textInverse: '#10201B',
    primary: '#6FD59A',
    primaryStrong: '#4CC27F',
    primarySoft: 'rgba(111, 213, 154, 0.16)',
    onPrimary: '#0B1A13',
    accent: '#F5A05A',
    accentSoft: 'rgba(245, 160, 90, 0.18)',
    onAccent: '#1A0E02',
    danger: '#FF7A70',
    dangerSoft: 'rgba(255, 122, 112, 0.16)',
    success: '#6FD59A',
    successSoft: 'rgba(111, 213, 154, 0.16)',
    warning: '#F5C15A',
    warningSoft: 'rgba(245, 193, 90, 0.16)',
    info: '#7CBCFF',
    infoSoft: 'rgba(124, 188, 255, 0.16)',
    overlay: 'rgba(6, 14, 10, 0.72)',
    skeleton: '#1D342C',
    skeletonHighlight: '#284537',
    tabBar: 'rgba(23, 42, 36, 0.94)',
    tabBarBorder: 'rgba(255,255,255,0.06)',
  },
  sun: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#F0F0EA',
    border: '#8A8F86',
    borderStrong: '#2B2F2C',
    text: '#000000',
    textMuted: '#2B2F2C',
    textSubtle: '#4A4F4B',
    textInverse: '#FFFFFF',
    primary: '#0F6B36',
    primaryStrong: '#084F27',
    primarySoft: 'rgba(15, 107, 54, 0.16)',
    onPrimary: '#FFFFFF',
    accent: '#C24E00',
    accentSoft: 'rgba(194, 78, 0, 0.16)',
    onAccent: '#FFFFFF',
    danger: '#B80000',
    dangerSoft: 'rgba(184, 0, 0, 0.14)',
    success: '#0F6B36',
    successSoft: 'rgba(15, 107, 54, 0.16)',
    warning: '#9A5B00',
    warningSoft: 'rgba(154, 91, 0, 0.16)',
    info: '#0B4FA8',
    infoSoft: 'rgba(11, 79, 168, 0.14)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    skeleton: '#E6E6E0',
    skeletonHighlight: '#F4F4EF',
    tabBar: 'rgba(255, 255, 255, 0.98)',
    tabBarBorder: 'rgba(0, 0, 0, 0.25)',
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

/**
 * Gölgeler `boxShadow` ile tanımlanır: React Native 0.76+ (Yeni Mimari) ve
 * react-native-web bunu ortak olarak destekler; eski `shadow*` prop'ları
 * kullanımdan kalkmıştır.
 */
export const shadows = {
  card: { boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.12)' },
  floating: { boxShadow: '0px 12px 24px rgba(0, 0, 0, 0.22)' },
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
