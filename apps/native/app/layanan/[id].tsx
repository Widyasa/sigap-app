import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Image, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { SERVICE_CATALOG, type ServiceStatus } from '@repo/shared';
import { getServiceRequest, getServiceRequestSignedUrl, type ServiceRequestSummary } from '@repo/supabase';
import { ThemedText } from '../_components/ThemedText';
import { Button } from '../_components/Button';
import { ServiceStatusBadge } from '../_components/Badge';
import { SERVICE_STATUS_LABELS } from '../_components/labels';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';

const STEP_ORDER: ServiceStatus[] = ['submitted', 'verifying', 'signing', 'ready', 'collected'];

export default function LayananDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const [request, setRequest] = useState<ServiceRequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [docPreviews, setDocPreviews] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await getServiceRequest(supabase, id);
      setRequest(data);
    } catch (e) {
      console.error('getServiceRequest error', e);
      setError('Gagal memuat permohonan. Periksa koneksi internet dan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!request) return;
    const catalogEntry = SERVICE_CATALOG.find((entry) => entry.id === request.serviceType);
    if (!catalogEntry) return;
    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        catalogEntry.requirements.map(async (req) => {
          const path = request.formData[req.key];
          if (typeof path !== 'string' || !path) return null;
          try {
            const url = await getServiceRequestSignedUrl(supabase, path, 300);
            return [req.key, url] as const;
          } catch (e) {
            console.error('getServiceRequestSignedUrl error', e);
            return null;
          }
        }),
      );
      if (cancelled) return;
      setDocPreviews(Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null)));
    })();

    return () => {
      cancelled = true;
    };
  }, [request]);

  const handleDownload = useCallback(async () => {
    if (!request?.outputPdfUrl) return;
    setDownloading(true);
    try {
      const signedUrl = await getServiceRequestSignedUrl(supabase, request.outputPdfUrl, 300);
      await Linking.openURL(signedUrl);
    } catch (e) {
      console.error('download pdf error', e);
      Alert.alert('Gagal', 'Tidak bisa membuka berkas PDF. Coba lagi.');
    } finally {
      setDownloading(false);
    }
  }, [request]);

  const catalogEntry = request
    ? SERVICE_CATALOG.find((entry) => entry.id === request.serviceType)
    : undefined;
  const currentIndex = request ? STEP_ORDER.indexOf(request.status) : -1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* `_layout.tsx` menyetel `headerShown: false` untuk seluruh Stack,
          jadi setiap layar harus menyediakan tombol kembalinya sendiri.
          Layar ini tidak punya satu pun — tidak ada chevron, tidak ada
          BottomNav — sehingga di iOS hanya gestur geser tepi yang bisa
          keluar, dan di Expo Web tidak ada jalan keluar sama sekali. */}
      <View style={[styles.topBar, { paddingHorizontal: spacing(4), paddingTop: spacing(2) }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <ThemedText variant="h2">Detail Permohonan</ThemedText>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing(4) }}>
        {error ? (
          <View style={{ gap: spacing(2) }}>
            <ThemedText color="secondary">{error}</ThemedText>
            <Button text="Coba Lagi" variant="secondary" onPress={load} />
          </View>
        ) : loading || !request ? (
          <ThemedText color="secondary">Memuat permohonan…</ThemedText>
        ) : (
          <>
            <ThemedText variant="h1">{catalogEntry?.name ?? request.serviceType}</ThemedText>
            <ServiceStatusBadge status={request.status} style={{ marginTop: spacing(2) }} />
            <ThemedText variant="caption" color="secondary" style={{ marginTop: spacing(2) }}>
              Diajukan {new Date(request.createdAt).toLocaleDateString('id-ID')}
            </ThemedText>

            <View style={{ gap: spacing(3), marginTop: spacing(6) }}>
              {STEP_ORDER.map((step, index) => {
                const isActive = request.status !== 'rejected' && index <= currentIndex;
                return (
                  <View key={step} style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepDot,
                        { backgroundColor: isActive ? colors.primary : colors.border },
                      ]}
                    />
                    <ThemedText
                      variant="body"
                      color={isActive ? 'primary' : 'muted'}
                      style={isActive ? styles.stepLabelActive : undefined}
                    >
                      {SERVICE_STATUS_LABELS[step]}
                    </ThemedText>
                  </View>
                );
              })}
              {request.status === 'rejected' ? (
                <View style={styles.stepRow}>
                  <View style={[styles.stepDot, { backgroundColor: colors.civicAmber }]} />
                  <ThemedText
                    variant="body"
                    style={[styles.stepLabelActive, { color: colors.civicAmber }]}
                  >
                    {SERVICE_STATUS_LABELS.rejected}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {catalogEntry && catalogEntry.requirements.length > 0 ? (
              <View style={{ marginTop: spacing(6) }}>
                <ThemedText variant="h2">Berkas terlampir</ThemedText>
                <View style={{ gap: spacing(3), marginTop: spacing(3) }}>
                  {catalogEntry.requirements.map((req) => {
                    const previewUrl = docPreviews[req.key];
                    return (
                      <View
                        key={req.key}
                        style={[
                          styles.docCard,
                          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: spacing(3) },
                        ]}
                      >
                        {previewUrl ? (
                          <Image source={{ uri: previewUrl }} style={styles.docThumb} />
                        ) : (
                          <View style={[styles.docThumb, styles.docThumbPlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]} />
                        )}
                        <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
                          {req.label}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {request.status === 'rejected' && request.rejectionReason ? (
              <ThemedText variant="caption" color="danger" style={{ marginTop: spacing(3) }}>
                Alasan penolakan: {request.rejectionReason}
              </ThemedText>
            ) : null}

            {request.status === 'ready' && request.outputPdfUrl ? (
              <Button
                text="Unduh PDF"
                loading={downloading}
                onPress={handleDownload}
                containerStyle={{ marginTop: spacing(6) }}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  container: {
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepLabelActive: {
    fontWeight: '700',
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    padding: 12,
  },
  docThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  docThumbPlaceholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
