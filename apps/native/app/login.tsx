import { useEffect, useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { emailSchema } from '@repo/shared';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { Input } from './_components/Input';
import { Logo } from './_components/Logo';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const { requestOtp, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/home');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setInterval(() => {
      setRetryAfter((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  const handleSubmit = async () => {
    setError(null);
    setRetryAfter(0);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Email tidak valid');
      return;
    }
    setLoading(true);
    const result = await requestOtp(parsed.data);
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? 'Gagal mengirim kode');
      if (result.retryAfterSeconds && result.retryAfterSeconds > 0) {
        setRetryAfter(result.retryAfterSeconds);
      }
      return;
    }
    router.push({
      pathname: '/verify',
      params: { email: parsed.data, devCode: result.devCode ?? '' },
    });
  };

  if (isLoading) {
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
            <ThemedText variant="h1" color="primary" style={styles.brand}>
              SIGAP
            </ThemedText>

            <Logo size={80} style={styles.logo} />

            <ThemedText variant="display" style={styles.title}>
              Masuk ke SIGAP
            </ThemedText>
            <ThemedText variant="body" color="secondary" style={styles.subtitle}>
              Kami kirim kode enam digit ke email Anda.{'\n'}
              Tidak perlu kata sandi.
            </ThemedText>

            <Input
              label="Alamat email"
              placeholder="nama@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              error={error ?? undefined}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
              accessibilityLabel="Alamat email"
              accessibilityHint="Masukkan alamat email yang terdaftar"
              containerStyle={{ marginBottom: spacing(4), width: '100%' }}
            />

            <Button
              text={
                retryAfter > 0
                  ? `Kirim ulang dalam ${retryAfter} detik`
                  : 'Kirim Kode'
              }
              loading={loading}
              disabled={retryAfter > 0}
              onPress={handleSubmit}
              accessibilityLabel="Kirim kode verifikasi ke email"
              containerStyle={{ width: '100%' }}
            />
          </View>

          <ThemedText
            variant="caption"
            color="muted"
            style={styles.footer}
            align="center"
          >
            Dengan masuk, Anda menyetujui pemakaian data laporan sesuai kebijakan
            Pemda.
          </ThemedText>
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
    justifyContent: 'space-between',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'flex-start',
    marginTop: 24,
  },
  brand: {
    marginBottom: 24,
  },
  logo: {
    marginBottom: 32,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 32,
  },
  footer: {
    marginBottom: 24,
  },
});
