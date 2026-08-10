import { useColorScheme as useSystemColorScheme } from 'react-native';
import { colors, ThemeMode, ColorTokens, typography, spacing } from '@repo/shared';

export function useTheme() {
  const mode: ThemeMode = useSystemColorScheme() === 'dark' ? 'dark' : 'light';
  return {
    mode,
    colors: colors[mode],
    typography,
    spacing,
  };
}

export type { ColorTokens, ThemeMode };
