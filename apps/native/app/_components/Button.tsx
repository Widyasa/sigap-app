import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  text: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  /** Kalimat khusus saat memuat (mis. "Mengirim laporan Anda…"). */
  loadingText?: string;
  containerStyle?: ViewStyle;
  style?: ViewStyle;
}

export function Button({
  text,
  variant = 'primary',
  loading = false,
  loadingText,
  disabled,
  containerStyle,
  style,
  ...rest
}: ButtonProps) {
  const { colors, spacing } = useTheme();

  const isDisabled = disabled || loading;

  const labelRowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
  };

  const base: ViewStyle = {
    minHeight: 48,
    minWidth: 48,
    borderRadius: spacing(3),
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(5),
    alignItems: 'center',
    justifyContent: 'center',
  };

  const variants: Record<NonNullable<ButtonProps['variant']>, ViewStyle> = {
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  const disabledVariants: Record<NonNullable<ButtonProps['variant']>, ViewStyle> = {
    primary: {
      backgroundColor: colors.textMuted,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  const pressedVariants: Record<NonNullable<ButtonProps['variant']>, ViewStyle> = {
    primary: { backgroundColor: colors.primaryPressed },
    secondary: { backgroundColor: colors.primarySurface },
    ghost: { backgroundColor: colors.primarySurface },
  };

  const textColors: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: colors.surface,
    secondary: colors.primary,
    ghost: colors.primary,
  };

  const disabledTextColors: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: colors.surface,
    secondary: colors.textMuted,
    ghost: colors.textMuted,
  };

  const textStyle: TextStyle = {
    color: isDisabled ? disabledTextColors[variant] : textColors[variant],
    opacity: loading ? 0.6 : 1,
  };

  return (
    <Pressable
      style={({ pressed }) => [
        base,
        disabled && !loading ? disabledVariants[variant] : variants[variant],
        pressed && !isDisabled && pressedVariants[variant],
        containerStyle,
        style,
      ]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      {...rest}
    >
      {/* DESIGN.md mensyaratkan spinner pada keadaan memuat. Label aksinya
          juga dipertahankan alih-alih ditimpa "Memuat…": mengganti teks
          tombol membuang satu-satunya petunjuk aksi apa yang sedang berjalan
          (`loadingText` menyediakan kalimat per-aksi bila diberikan). */}
      <View style={labelRowStyle}>
        {loading ? <ActivityIndicator size="small" color={textStyle?.color as string | undefined} /> : null}
        <ThemedText variant="h2" style={textStyle}>
          {loading ? loadingText ?? text : text}
        </ThemedText>
      </View>
    </Pressable>
  );
}
