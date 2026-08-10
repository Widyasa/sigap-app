import { useEffect, useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { otpCodeSchema } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { Input } from './_components/Input';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';

export default function VerifyScreen() {
  const { email, devCode } = useLocalSearchParams<{ email: string; devCode?: string }>();
  const [code, setCode] = useState(devCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { verifyOtp } = useAuth();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();

  useEffect(() => {
    if (devCode) {
      setCode(devCode);
    }
  }, [devCode]);

  // Try to auto-fill a 6-digit code from clipboard when the screen mounts.
  useEffect(() => {
    if (code) return;
    Clipboard.getStringAsync()
      .then((text) => {
        const digits = text?.replace(/\D/g, '').slice(0, 6);
        if (digits?.length === 6) {
          setCode(digits);
        }
      })
      .catch(() => {
        // ignore clipboard errors
      });
  }, [code]);

  const handleChangeEmail = () => {
    router.replace('/login');
  };

  const handleOpenEmail = async () => {
    try {
      await Linking.openURL('mailto:');
    } catch {
      // ignore
    }
  };

  const handleVerify = async () => {
    setError(null);
    const parsed = otpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Kode tidak valid');
      return;
    }
    setLoading(true);
    const result = await verifyOtp(email, parsed.data);
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? 'Gagal memverifikasi kode');
      return;
    }
    router.replace(result.needsOnboarding ? '/onboarding' : '/home');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <ThemedText variant="h1">Masukkan Kode OTP</ThemedText>
            <ThemedText variant="body" color="secondary">
              Kode 6 digit telah dikirim ke {email}. Kode berlaku 10 menit.
            </ThemedText>
          </View>

          <Input
            label="Kode OTP"
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
            error={error ?? undefined}
            containerStyle={{ marginBottom: spacing(4) }}
          />

          <Button
            text="Verifikasi"
            loading={loading}
            onPress={handleVerify}
            containerStyle={{ marginBottom: spacing(3) }}
          />

          <Button
            text="Buka Aplikasi Email"
            variant="secondary"
            onPress={handleOpenEmail}
            containerStyle={{ marginBottom: spacing(3) }}
          />

          <Pressable
            onPress={handleChangeEmail}
            accessibilityRole="button"
            style={styles.link}
          >
            <ThemedText
              variant="body"
              color="primary"
              style={{ textAlign: 'center', fontSize: typography.body.fontSize }}
            >
              Ganti alamat email
            </ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    gap: 12,
    marginBottom: 32,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
});
