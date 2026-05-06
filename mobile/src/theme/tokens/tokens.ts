/**
 * Primitive design tokens — palette, scales, primitives.
 *
 * No RN-specific API here. When /web is added, these tokens migrate to a
 * shared package (mobile + web) without modification.
 *
 * Components NEVER consume primitives directly. They consume semantic
 * tokens from light.ts / dark.ts. See ARCHITECTURE.md §12.
 */

export const colors = {
  gray: {
    50: '#F7F8FA',
    100: '#EEF0F4',
    200: '#D9DDE4',
    300: '#B6BDC9',
    400: '#8C95A4',
    500: '#646D7C',
    600: '#4A5260',
    700: '#353B47',
    800: '#22272F',
    900: '#161A20',
    950: '#0F1115',
  },
  blue: {
    400: '#5C8DFF',
    500: '#3F73F2',
    600: '#2A5BD7',
  },
  green: {
    400: '#5DD3A8',
    500: '#3CB58A',
  },
  amber: {
    400: '#F4C36B',
    500: '#E0A53A',
  },
  red: {
    400: '#F07A7A',
    500: '#E15454',
  },
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/**
 * Nunito Sans is loaded at app start via expo-font (`@expo-google-fonts/nunito-sans`).
 * The app must wait for these to be ready before un-hiding the splash screen.
 */
export const fontFamily = {
  regular: 'NunitoSans_400Regular',
  medium: 'NunitoSans_500Medium',
  semibold: 'NunitoSans_600SemiBold',
  bold: 'NunitoSans_700Bold',
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.45,
  relaxed: 1.65,
} as const;

export type Colors = typeof colors;
export type Space = typeof space;
export type Radius = typeof radius;
export type FontSize = typeof fontSize;
export type FontWeight = typeof fontWeight;
export type FontFamily = typeof fontFamily;
