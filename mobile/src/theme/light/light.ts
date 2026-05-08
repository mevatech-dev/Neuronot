import { colors } from '../tokens';
import type { SemanticColors } from '../dark';

/**
 * Light theme — Sunflower Meadow Glow + Emerald Fields accents.
 *
 * Calm, low cognitive load (PRD §17/§19). Warm cream surfaces pair with
 * the yellow-green mascot; deep forest greens carry actions and links.
 */
export const lightSemanticColors: SemanticColors = {
  surface: {
    primary: colors.sunflower[50],   // warm off-white
    elevated: colors.white,
    raised: colors.sunflower[100],   // pale cream
    overlay: 'rgba(254,252,246,0.85)',
  },
  text: {
    primary: colors.forest[800],     // deep forest — high contrast brand
    secondary: colors.forest[600],
    muted: colors.meadow[400],       // dusty olive
    inverse: colors.sunflower[50],
  },
  border: {
    subtle: colors.sunflower[200],   // honey haze
    strong: colors.sunflower[300],
    focus: colors.bloom[400],        // mascot tone
  },
  accent: {
    default: colors.forest[500],     // primary action — forest green
    muted: colors.meadow[400],
    onAccent: colors.sunflower[50],
  },
  danger: {
    default: colors.red[500],
    muted: colors.red[400],
  },
  success: {
    default: colors.meadow[400],
    muted: colors.meadow[300],
  },
  warning: {
    default: colors.sunflower[400],  // goldenrod
    muted: colors.sunflower[300],
  },
};
