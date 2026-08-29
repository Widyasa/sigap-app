import { useEffect, useState, useCallback } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { otpCodeSchema } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { OtpInput } from './_components/OtpInput';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';

const RESEND_SECONDS = 60;

export default function VerifyScreen() {
  const { email, devCode } = useLocalSearchParams<{
    email: string;
    devCode?: string;
  }>();
  const [code, setCode] = useState(devCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const { verifyOtp, requestOtp, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/home');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (devCode) {
      setCode(devCode);
    }
  }, [devCode]);

  /**
   * Papan klip dibaca hanya saat warga MENEKAN tombolnya.
   *
   * Dulu ini `useEffect` yang berjalan otomatis saat layar terbuka. Di iOS 14+
   * pembacaan papan klip memunculkan spanduk sistem "SIGAP menempel dari
   * <aplikasi>", yang muncul persis setelah warga menyerahkan alamat
   * emailnya — terbaca seperti aplikasi yang mengintip papan klip mereka.
   */
  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const digits = text?.replace(/\D/g, '').slice(0, 6);
      if (digits?.length === 6) setCode(digits);
    } catch {
      // Abaikan galat papan klip; menempel manual tetap bisa.
    }
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

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

  const handleResend = async () => {
    setError(null);
    const result = await requestOtp(email);
    if (!result.ok) {
      setError(result.message ?? 'Gagal mengirim ulang kode');
      return;
    }
    setCountdown(RESEND_SECONDS);
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

  const isCodeComplete = code.length === 6;
  const resendLabel =
    countdown > 0
      ? `Kirim ulang kode dalam ${countdown} detik`
      : 'Kirim ulang kode';

  if (isLoading || (!isLoading && isAuthenticated)) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.surface }]}
      >
        <View style={styles.centered}>
          <ThemedText variant="body" color="secondary">
            Memuat sesi…
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { padding: spacing(6) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <ThemedText variant="h1" color="primary" style={styles.header}>
              Verifikasi
            </ThemedText>

            <Pressable
              onPress={handleChangeEmail}
              accessibilityRole="button"
              accessibilityLabel="Ganti alamat email"
              style={styles.changeEmail}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={colors.primary}
                style={{ marginTop: 1 }}
              />
              <ThemedText variant="body" color="primary">
                Ganti email
              </ThemedText>
            </Pressable>

            <ThemedText variant="display" style={styles.title}>
              Masukkan kode
            </ThemedText>
            <ThemedText variant="body" color="secondary" style={styles.subtitle}>
              Kode enam digit sudah dikirim ke{' '}
              <ThemedText
                variant="body"
                color="primary"
                style={styles.emailHighlight}
              >
                {email}
              </ThemedText>
            </ThemedText>

            <OtpInput
              value={code}
              onChange={setCode}
              error={error ?? undefined}
              disabled={loading}
              containerStyle={{ marginBottom: spacing(6) }}
            />

            <Button
              text="Masuk"
              loading={loading}
              disabled={!isCodeComplete}
              onPress={handleVerify}
              accessibilityLabel="Verifikasi dan masuk ke aplikasi"
              containerStyle={{ width: '100%', marginBottom: spacing(3) }}
            />

            <Button
              text={resendLabel}
              variant="secondary"
              disabled={countdown > 0}
              onPress={handleResend}
              accessibilityLabel={
                countdown > 0
                  ? `Kirim ulang kode tersisa ${countdown} detik`
                  : 'Kirim ulang kode verifikasi'
              }
              containerStyle={{ width: '100%', marginBottom: spacing(3) }}
            />

            <Button
              text="Tempel kode dari papan klip"
              variant="ghost"
              onPress={() => void pasteFromClipboard()}
              accessibilityLabel="Tempel kode OTP dari papan klip"
              containerStyle={{ width: '100%', marginBottom: spacing(3) }}
            />

            <Pressable
              onPress={handleOpenEmail}
              accessibilityRole="button"
              accessibilityLabel="Buka aplikasi email"
              hitSlop={8}
              style={styles.link}
            >
              <ThemedText variant="body" color="primary">
                Buka aplikasi email
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'flex-start',
    marginTop: 24,
  },
  header: {
    marginBottom: 16,
  },
  changeEmail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 24,
    minHeight: 44,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 32,
  },
  emailHighlight: {
    fontWeight: '700',
  },
  link: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
});
