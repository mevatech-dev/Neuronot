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

  // ── Brand palette ────────────────────────────────────────────────────
  // Sunflower Meadow Glow (light theme primaries)
  // Soft pastel cream → honey → sage. Calm, low cognitive load.
  sunflower: {
    50: '#FEFCF6',   // warm off-white surface
    100: '#FAF6EB',  // pale cream
    200: '#F0E5C5',  // soft honey
    300: '#E5C778',  // honey
    400: '#D4A82A',  // mustard / goldenrod
    500: '#B59340',  // deep mustard
  },
  // Meadow greens (mid accents, success states)
  meadow: {
    100: '#E3F0DB',  // mint mist
    200: '#C8E6C9',  // soft sage
    300: '#9BC79B',  // medium sage
    400: '#6B8E3C',  // olive meadow
    500: '#4A6B2A',  // deep olive
  },
  // Emerald Green Fields (action / link / dark theme surfaces)
  forest: {
    400: '#3F7A4F',
    500: '#2C5F3F',  // forest green — primary action on light
    600: '#1F4A30',
    700: '#15321F',
    800: '#0F2F1F',  // deep forest
    900: '#0E1611',  // mossy black — dark theme surface base
    950: '#080F0B',  // deepest, used sparingly
  },
  // Mascot yellow-green (focus rings, dark theme accent default)
  bloom: {
    300: '#D4E89A',
    400: '#A8C26A',  // mascot tone — vibrant against dark surfaces
    500: '#8AA84A',
  },
  // Electric lime (light theme — surfaces + primary action)
  // Surface tones (50/75) are barely-tinted yellow-green off-whites;
  // accent (400) is the vivid CTA. Pairs with forest[800] text on accent.
  lime: {
    50: '#FAFFEB',   // warm yellow-green off-white — primary surface
    75: '#F4FBD4',   // pale chartreuse — raised surface
    100: '#F2FFCC',  // palest lime tint — muted bg
    200: '#E0FF99',  // soft lime — borders / muted accents
    300: '#D6FF66',  // bright tint
    400: '#CCFF33',  // primary — electric lime (button)
    500: '#B8E62E',  // pressed / hover
    600: '#9CC424',  // deepest lime
  },
  // Gentle Evening Mist (dark theme surfaces)
  // Deep midnight purple-blue → soft lavender. Calm, contemplative.
  midnight: {
    100: '#E8E4F2',  // lavender-tinted off-white
    200: '#C7BFDA',
    300: '#8C82A6',
    700: '#3A2E5C',
    800: '#2C1F5A',  // raised surface
    850: '#221547',  // elevated surface
    900: '#1A0E2E',  // base surface — soft, never pure black
    950: '#120822',  // deepest, sparingly
  },
  // Teal anchor (focus rings on dark, info accents)
  teal: {
    400: '#4DA697',
    500: '#3D8B7A',
    600: '#2D7062',
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
