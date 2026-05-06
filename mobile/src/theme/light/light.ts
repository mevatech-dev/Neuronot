import { colors } from '../tokens';
import type { SemanticColors } from '../dark';

export const lightSemanticColors: SemanticColors = {
  surface: {
    primary: colors.gray[50],
    elevated: colors.white,
    raised: colors.white,
    overlay: 'rgba(247,248,250,0.8)',
  },
  text: {
    primary: colors.gray[900],
    secondary: colors.gray[700],
    muted: colors.gray[500],
    inverse: colors.white,
  },
  border: {
    subtle: colors.gray[200],
    strong: colors.gray[300],
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
