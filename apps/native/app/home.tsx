import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <ThemedText variant="h1">Selamat datang, {user?.fullName ?? 'Warga'}</ThemedText>
        <ThemedText variant="body" color="secondary">
          Kelurahan {user?.kelurahan ?? '-'}, Kecamatan {user?.kecamatan ?? '-'}
        </ThemedText>
        <Button
          text="Buat Aduan"
          onPress={() => router.push('/lapor')}
          containerStyle={{ marginTop: spacing(6) }}
        />
        <Button
          text="Lihat Feed Aduan"
          variant="secondary"
          onPress={() => router.push('/feed')}
          containerStyle={{ marginTop: spacing(2) }}
        />
        <Button
          text="Aspirasi Warga"
          variant="secondary"
          onPress={() => router.push('/aspirasi')}
          containerStyle={{ marginTop: spacing(2) }}
        />
        <Button
          text="Keluar"
          variant="secondary"
          onPress={() => signOut()}
          containerStyle={{ marginTop: spacing(2) }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
});
