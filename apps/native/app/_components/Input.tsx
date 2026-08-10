import {
  TextInput,
  TextInputProps,
  View,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { ThemedText } from './ThemedText';
import { useTheme } from './useTheme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  containerStyle,
  style,
  ...rest
}: InputProps) {
  const { colors, spacing, typography } = useTheme();

  const inputStyle: TextStyle = {
    minHeight: 48,
    borderWidth: 1,
    borderColor: error ? colors.civicAmber : colors.border,
    borderRadius: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    color: colors.textPrimary,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    backgroundColor: colors.surface,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <ThemedText variant="caption" color="secondary" style={styles.label}>
        {label}
      </ThemedText>
      <TextInput
        style={[inputStyle, style]}
        placeholderTextColor={colors.textMuted}
        {...rest}
      />
      {error ? (
        <ThemedText variant="micro" color="danger" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  label: {
    marginBottom: 4,
  },
  error: {
    marginTop: 4,
  },
});
