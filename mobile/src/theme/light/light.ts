import { colors } from '../tokens';
import type { SemanticColors } from '../dark';

/**
 * Light theme — Lime Garden.
 *
 * Yellow-green tinted surfaces harmonize with the electric lime CTA and
 * the mascot's bloom palette. Forest greens carry text for contrast.
 */
export const lightSemanticColors: SemanticColors = {
  surface: {
    primary: colors.lime[50],        // warm yellow-green off-white
    elevated: colors.white,
    raised: colors.lime[75],         // pale chartreuse
    overlay: 'rgba(250,255,235,0.85)',
  },
  text: {
    primary: colors.forest[800],     // deep forest — high contrast brand
    secondary: colors.forest[600],
    muted: colors.meadow[400],       // dusty olive
    inverse: colors.lime[50],
  },
  border: {
    subtle: colors.lime[100],        // pale lime
    strong: colors.lime[200],        // soft lime
    focus: colors.lime[400],         // electric lime focus ring
  },
  accent: {
    default: colors.lime[400],       // primary action — electric lime #CCFF33
    muted: colors.lime[200],
    onAccent: colors.forest[800],    // deep forest text on lime — high contrast
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
