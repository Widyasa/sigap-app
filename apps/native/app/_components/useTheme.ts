import { colors, ThemeMode, ColorTokens, typography, spacing } from '@repo/shared';

export function useTheme() {
  const mode: ThemeMode = 'light';
  return {
    mode,
    colors: colors[mode],
    typography,
    spacing,
  };
}

export type { ColorTokens, ThemeMode };
