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
 * Soft dark theme — default per PRD §19.
 *
 * Surface uses gray.950 as the deepest layer, never pure black.
 * Text contrasts at high but soft level — never pure white.
 */
export const darkSemanticColors: SemanticColors = {
  surface: {
    primary: colors.gray[950],
    elevated: colors.gray[900],
    raised: colors.gray[800],
    overlay: 'rgba(15,17,21,0.78)',
  },
  text: {
    primary: '#E6E8EC',
    secondary: colors.gray[300],
    muted: colors.gray[400],
    inverse: colors.gray[950],
  },
  border: {
    subtle: colors.gray[800],
    strong: colors.gray[700],
    focus: colors.blue[500],
  },
  accent: {
    default: colors.blue[500],
    muted: colors.blue[400],
    onAccent: colors.white,
  },
  danger: {
    default: colors.red[500],
    muted: colors.red[400],
  },
  success: {
    default: colors.green[500],
    muted: colors.green[400],
  },
  warning: {
    default: colors.amber[500],
    muted: colors.amber[400],
  },
};
