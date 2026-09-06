import { palettes, radius, spacing, typography, type Palette } from '@/core/theme/tokens';

/**
 * Panel teması, mobil uygulamanın tasarım token'larını yeniden kullanır.
 * `palettes.light` / `palettes.dark` doğrudan `src/core/theme/tokens.ts`'ten gelir,
 * böylece marka renkleri tek kaynaktan yönetilir.
 */
export type AdminTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'zirtan.admin.theme';

/** Panelde ek olarak gereken, mobilde karşılığı olmayan yüzeyler. */
const extras: Record<AdminTheme, Record<string, string>> = {
  light: {
    'sidebar-bg': '#14261D',
    'sidebar-text': '#E7EFE6',
    'sidebar-muted': '#9DB4A5',
    'sidebar-active': 'rgba(111, 213, 154, 0.18)',
    'chart-grid': 'rgba(27, 42, 34, 0.10)',
    'row-hover': 'rgba(47, 125, 79, 0.06)',
  },
  dark: {
    'sidebar-bg': '#0B1712',
    'sidebar-text': '#E7EFE6',
    'sidebar-muted': '#7E9788',
    'sidebar-active': 'rgba(111, 213, 154, 0.22)',
    'chart-grid': 'rgba(255, 255, 255, 0.10)',
    'row-hover': 'rgba(111, 213, 154, 0.08)',
  },
};

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

export function themeVars(theme: AdminTheme): Record<string, string> {
  const palette: Palette = palettes[theme];
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(palette)) {
    vars[`--c-${kebab(key)}`] = value;
  }
  for (const [key, value] of Object.entries(extras[theme])) {
    vars[`--c-${key}`] = value;
  }
  for (const [key, value] of Object.entries(spacing)) {
    vars[`--s-${key}`] = `${value}px`;
  }
  for (const [key, value] of Object.entries(radius)) {
    vars[`--r-${key}`] = `${value}px`;
  }
  for (const [key, value] of Object.entries(typography)) {
    vars[`--t-${key}-size`] = `${value.fontSize}px`;
    vars[`--t-${key}-line`] = `${value.lineHeight}px`;
  }
  return vars;
}

export function applyTheme(theme: AdminTheme): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(themeVars(theme))) {
    root.style.setProperty(key, value);
  }
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

/** Grafiklerde kullanılan seri renkleri (doğa paleti). */
export const chartColors = ['#2F7D4F', '#E8722A', '#3A8DDE', '#D98A0B', '#8E6BD0', '#0FA3A3'];
