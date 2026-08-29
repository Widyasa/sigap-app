import { Text, TextProps, TextStyle } from 'react-native';
import { ColorTokens } from '@repo/shared';
import { useTheme } from './useTheme';

export type TextVariant = 'display' | 'h1' | 'h2' | 'body' | 'caption' | 'micro';

interface ThemedTextProps extends TextProps {
  variant?: TextVariant;
  color?: 'primary' | 'secondary' | 'muted' | 'danger' | 'warning';
  align?: TextStyle['textAlign'];
}

/**
 * `danger` DULU dipetakan ke `civicAmber` (#F59E0B), yang berarti SETIAP
 * pesan galat di aplikasi warga digambar dengan kuning — termasuk "Izin
 * lokasi diperlukan agar SOS bisa ditandai" di layar darurat — pada rasio
 * kontras 2,15:1 di atas latar putih, jauh di bawah ambang WCAG AA.
 * DESIGN.md juga tegas: amber khusus gamifikasi/poin, merah untuk keadaan
 * galat dan darurat. Token `danger` (#DC2626, 4,83:1) sudah ada sejak awal.
 */
const colorKey: Record<NonNullable<ThemedTextProps['color']>, keyof ColorTokens> = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  muted: 'textMuted',
  danger: 'danger',
  warning: 'civicAmber',
};

export function ThemedText({
  variant = 'body',
  color = 'primary',
  align,
  style,
  ...rest
}: ThemedTextProps) {
  const { colors, typography } = useTheme();
  const variantStyle = typography[variant];
  const textColor = colors[colorKey[color]];

  return (
    <Text
      style={[
        {
          color: textColor,
          fontSize: variantStyle.fontSize,
          lineHeight: variantStyle.lineHeight,
          fontWeight: variantStyle.fontWeight,
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    />
  );
}
