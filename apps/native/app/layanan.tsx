import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SERVICE_CATALOG } from '@repo/shared';
import { listMyServiceRequests, type ServiceRequestSummary } from '@repo/supabase';
import { ThemedText } from './_components/ThemedText';
import { ServiceStatusBadge } from './_components/Badge';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';

export default function LayananScreen() {
  const { user } = useAuth();
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [requests, setRequests] = useState<ServiceRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const list = await listMyServiceRequests(supabase, user.id);
      setRequests(list);
    } catch (e) {
      console.error('listMyServiceRequests error', e);
      setError('Gagal memuat permohonan. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing(4) }}>
        <ThemedText variant="h1">Layanan Administrasi</ThemedText>
        <ThemedText variant="body" color="secondary" style={{ marginTop: spacing(1) }}>
          Pilih jenis surat yang ingin diajukan.
        </ThemedText>

        <View style={{ gap: spacing(2), marginTop: spacing(4) }}>
          {SERVICE_CATALOG.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => router.push(`/layanan/new?serviceType=${entry.id}`)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  padding: spacing(3),
                  borderRadius: spacing(3),
                  gap: spacing(1),
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <ThemedText variant="h2">{entry.name}</ThemedText>
              <ThemedText variant="caption" color="secondary">
                {entry.description}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText variant="h1" style={{ marginTop: spacing(6) }}>
          Permohonan Saya
        </ThemedText>

        <View style={{ marginTop: spacing(3) }}>
          {error ? (
            <ThemedText color="secondary">{error}</ThemedText>
          ) : loading ? (
            <ThemedText color="secondary">Memuat permohonan…</ThemedText>
          ) : requests.length === 0 ? (
            <ThemedText color="secondary">Belum ada permohonan layanan.</ThemedText>
          ) : (
            <View style={{ gap: spacing(2) }}>
              {requests.map((item) => {
                const catalogEntry = SERVICE_CATALOG.find((c) => c.id === item.serviceType);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/layanan/${item.id}`)}
                    style={({ pressed }) => [
                      styles.card,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        padding: spacing(3),
                        borderRadius: spacing(3),
                        gap: spacing(1),
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <ThemedText variant="h2">{catalogEntry?.name ?? item.serviceType}</ThemedText>
                    <ServiceStatusBadge status={item.status} />
                    <ThemedText variant="caption" color="secondary">
                      Diajukan {new Date(item.createdAt).toLocaleDateString('id-ID')}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
  },
});
