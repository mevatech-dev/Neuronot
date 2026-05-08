import { colors } from '../tokens';

export type SemanticColors = {
  surface: {
    primary: string;
    elevated: string;
    raised: string;
    overlay: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  border: {
    subtle: string;
    strong: string;
    focus: string;
  };
  accent: {
    default: string;
    muted: string;
    onAccent: string;
  };
  danger: {
    default: string;
    muted: string;
  };
  success: {
    default: string;
    muted: string;
  };
  warning: {
    default: string;
    muted: string;
  };
};

/**
 * Dark theme — Gentle Evening Mist.
 *
 * Companion to the Sunflower Meadow Glow light theme: deep midnight
 * purple-blue surfaces (PRD §19 — soft dark, never pure black). The
 * mascot's bloom yellow-green stays the accent so the brand survives
 * the day/night switch; teal carries focus rings, goldenrod warnings.
 */
export const darkSemanticColors: SemanticColors = {
  surface: {
    primary: colors.midnight[900],   // deep midnight — soft, never pure black
    elevated: colors.midnight[850],
    raised: colors.midnight[800],
    overlay: 'rgba(26,14,46,0.82)',
  },
  text: {
    primary: colors.midnight[100],   // lavender-tinted off-white
    secondary: colors.midnight[200],
    muted: colors.midnight[300],
    inverse: colors.midnight[900],
  },
  border: {
    subtle: colors.midnight[800],
    strong: colors.midnight[700],
    focus: colors.teal[500],
  },
  accent: {
    default: colors.bloom[400],      // mascot tone — brand cohesion across modes
    muted: colors.bloom[300],
    onAccent: colors.midnight[900],
  },
  danger: {
    default: colors.red[500],
    muted: colors.red[400],
  },
  success: {
    default: colors.bloom[400],
    muted: colors.bloom[300],
  },
  warning: {
    default: colors.sunflower[400],
    muted: colors.sunflower[300],
  },
};
