import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from './_components/ThemedText';
import { useAuth } from './_components/AuthProvider';
import { Button } from './_components/Button';
import { useTheme } from './_components/useTheme';
import { urgencyColor } from '@repo/shared';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const { colors, spacing, mode } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <ThemedText variant="h1">Selamat datang, {user?.fullName ?? 'Warga'}</ThemedText>
        <ThemedText variant="body" color="secondary">
          Kelurahan {user?.kelurahan ?? '-'}, Kecamatan {user?.kecamatan ?? '-'}
        </ThemedText>
        <Button
          text="SOS Darurat"
          onPress={() => router.push('/sos')}
          style={{ backgroundColor: urgencyColor('P0', mode).fg }}
          containerStyle={{ marginTop: spacing(6) }}
        />
        <Button
          text="Buat Aduan"
          onPress={() => router.push('/lapor')}
          containerStyle={{ marginTop: spacing(2) }}
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
          text="Anggaran"
          variant="secondary"
          onPress={() => router.push('/anggaran')}
          containerStyle={{ marginTop: spacing(2) }}
        />
        <Button
          text="Layanan"
          variant="secondary"
          onPress={() => router.push('/layanan')}
          containerStyle={{ marginTop: spacing(2) }}
        />
        <Button
          text="Info & Komunitas"
          variant="secondary"
          onPress={() => router.push('/info')}
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
