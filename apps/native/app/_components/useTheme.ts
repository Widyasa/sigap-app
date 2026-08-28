import { useColorScheme } from 'react-native';
import { colors, ThemeMode, ColorTokens, typography, spacing } from '@repo/shared';

/**
 * PRD 5 mewajibkan setiap komponen membaca mode gelap/terang lewat
 * `useColorScheme()`, dan DESIGN.md mengirimkan palet gelap lengkap — tapi
 * berkas ini mematoknya ke `'light'`, sehingga seluruh blok `colors.dark`
 * di theme.ts adalah kode mati.
 */
export function useTheme() {
  const scheme = useColorScheme();
  const mode: ThemeMode = scheme === 'dark' ? 'dark' : 'light';
  return {
    mode,
    colors: colors[mode],
    typography,
    spacing,
  };
}

export type { ColorTokens, ThemeMode };
