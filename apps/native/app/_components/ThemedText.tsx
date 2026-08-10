import { Text, TextProps, TextStyle } from 'react-native';
import { ColorTokens } from '@repo/shared';
import { useTheme } from './useTheme';

export type TextVariant = 'display' | 'h1' | 'h2' | 'body' | 'caption' | 'micro';

interface ThemedTextProps extends TextProps {
  variant?: TextVariant;
  color?: 'primary' | 'secondary' | 'muted' | 'danger';
  align?: TextStyle['textAlign'];
}

const colorKey: Record<NonNullable<ThemedTextProps['color']>, keyof ColorTokens> = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  muted: 'textMuted',
  danger: 'civicAmber',
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
