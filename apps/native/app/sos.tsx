import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reverseGeocode } from './_lib/reverseGeocode';
import { View, StyleSheet, Animated, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  AudioModule,
} from 'expo-audio';
import {
  EMERGENCY_TYPES,
  SOS_HOLD_DURATION_MS,
  SOS_AUDIO_DURATION_MS,
  type EmergencyStatus,
} from '@repo/shared';
import {
  createEmergencyAlert,
  uploadEmergencyAudio,
  getMyActiveEmergencyAlert,
  type EmergencyAlertSummary,
} from '@repo/supabase';
import type { Database } from '@repo/supabase';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { EmergencyStatusBadge } from './_components/Badge';
import { EMERGENCY_TYPE_LABELS } from './_components/labels';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';

type Step = 'hold' | 'pickType' | 'sending' | 'status';

type EmergencyAlertRow = Database['public']['Tables']['emergency_alerts']['Row'];

interface Coordinates {
  lat: number;
  lng: number;
}

const STATUS_MESSAGE: Record<EmergencyStatus, string> = {
  active: 'SOS terkirim. Operator sedang meninjau laporan Anda.',
  responding: 'Bantuan sedang menuju lokasi Anda.',
  resolved: 'Penanganan selesai. Semoga Anda tetap aman.',
  false_alarm: 'Laporan ini ditandai sebagai alarm palsu.',
};

export default function SosScreen() {
  const { user } = useAuth();
  const { colors, spacing, mode } = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<Step>('hold');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [alert, setAlert] = useState<EmergencyAlertSummary | null>(null);

  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Kalau warga sudah punya SOS aktif (mis. kembali ke layar ini setelah
  // kirim), langsung tampilkan status alih-alih tombol tahan lagi.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await getMyActiveEmergencyAlert(supabase, user.id);
        if (!cancelled && existing) {
          setAlert(existing);
          setStep('status');
        }
      } catch (e) {
        console.error('getMyActiveEmergencyAlert error', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Lokasi diminta sedari awal (bukan menunggu warga memilih jenis darurat)
  // agar pengiriman SOS secepat mungkin — sama pola dengan lapor.tsx.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        if (!cancelled) setLocationError('Izin lokasi diperlukan agar SOS bisa ditandai.');
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (cancelled) return;
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setAccuracy(position.coords.accuracy);
        const resolved = await reverseGeocode(position.coords.latitude, position.coords.longitude);
        if (!cancelled && resolved) {
          setAddress(resolved);
        }
      } catch {
        if (!cancelled) setLocationError('Gagal mendapatkan lokasi. Coba lagi.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime: baris emergency_alerts berubah (operator menanggapi/menutup)
  // tanpa reload manual (issue #12, kriteria "Operator status changes appear
  // in realtime") — pola identik dengan aduan/[id].tsx (issue #8).
  useEffect(() => {
    if (step !== 'status' || !alert?.id) return;
    const channel = supabase
      .channel(`emergency-${alert.id}`)
      .on<EmergencyAlertRow>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'emergency_alerts', filter: `id=eq.${alert.id}` },
        (payload) => {
          const row = payload.new;
          setAlert((prev) =>
            prev
              ? {
                  ...prev,
                  status: row.status as EmergencyStatus,
                  respondedBy: row.responded_by,
                  respondedAt: row.responded_at,
                  resolvedAt: row.resolved_at,
                }
              : prev,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [step, alert?.id]);

  const startHold = useCallback(() => {
    holdAnimation.current?.stop();
    const anim = Animated.timing(holdProgress, {
      toValue: 1,
      duration: SOS_HOLD_DURATION_MS,
      useNativeDriver: false,
    });
    holdAnimation.current = anim;
    anim.start(({ finished }) => {
      if (finished) setStep('pickType');
    });
  }, [holdProgress]);

  const cancelHold = useCallback(() => {
    holdAnimation.current?.stop();
    const anim = Animated.timing(holdProgress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    });
    holdAnimation.current = anim;
    anim.start();
  }, [holdProgress]);

  // Merekam ~10 detik audio konteks (kriteria "10s audio"). Bersifat
  // best-effort SEPENUHNYA — izin ditolak, mikrofon tak tersedia, atau
  // kegagalan apa pun di sini TIDAK boleh memblokir pengiriman SOS, hanya
  // membuat audio_url tetap null (lihat catatan issue #12).
  const recordAudioBestEffort = useCallback(async (): Promise<string | null> => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return null;

      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      const { promise: delayPromise, resolve: resolveDelay } = Promise.withResolvers<void>();
      setTimeout(resolveDelay, SOS_AUDIO_DURATION_MS);
      await delayPromise;
      await recorder.stop();

      const uri = recorder.uri;
      if (!uri) return null;

      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      if (!user) return null;
      return await uploadEmergencyAudio(supabase, user.id, arrayBuffer, 'audio/m4a');
    } catch (e) {
      console.error('recordAudioBestEffort error (melanjutkan tanpa audio)', e);
      return null;
    }
  }, [recorder, user]);

  const handlePickType = useCallback(
    async (emergencyType: (typeof EMERGENCY_TYPES)[number]['id']) => {
      if (!user) {
        setSendError('Sesi tidak ditemukan. Masuk kembali.');
        return;
      }
      if (!coords) {
        setSendError(locationError ?? 'Lokasi belum siap. Coba lagi sebentar.');
        return;
      }

      setSendError(null);
      setStep('sending');
      setStatusNote('Merekam konteks audio (10 detik)…');

      const audioUrl = await recordAudioBestEffort();
      setStatusNote(null);

      try {
        // Lokasi + jenis darurat SUDAH cukup untuk mengirim SOS — insert
        // langsung lewat PostgREST, TIDAK ada panggilan fungsi edge/AI apa
        // pun (kriteria "SOS sends successfully without calling any AI
        // function"), identik pola dengan createComplaint/createServiceRequest.
        const { id } = await createEmergencyAlert(supabase, user.id, {
          emergencyType,
          locationLat: coords.lat,
          locationLng: coords.lng,
          locationAddress: address ?? undefined,
          audioUrl: audioUrl ?? undefined,
        });

        setAlert({
          id,
          userId: user.id,
          emergencyType,
          locationLat: coords.lat,
          locationLng: coords.lng,
          locationAddress: address ?? null,
          audioUrl: audioUrl ?? null,
          note: null,
          status: 'active',
          respondedBy: null,
          respondedAt: null,
          resolvedAt: null,
          createdAt: new Date().toISOString(),
        });
        setStep('status');
      } catch (e) {
        console.error('createEmergencyAlert error', e);
        setSendError('Gagal mengirim SOS. Periksa koneksi internet dan coba lagi.');
        setStep('pickType');
      }
    },
    [user, coords, address, locationError, recordAudioBestEffort],
  );

  const progressHeight = useMemo(
    () => holdProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
    [holdProgress],
  );

  if (step === 'status' && alert) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText variant="h1" style={{ marginBottom: spacing(3) }}>
            Status SOS
          </ThemedText>
          <EmergencyStatusBadge status={alert.status} style={{ marginBottom: spacing(4) }} />
          <ThemedText variant="h2" style={{ marginBottom: spacing(2) }}>
            {STATUS_MESSAGE[alert.status]}
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ marginBottom: spacing(1) }}>
            Jenis: {EMERGENCY_TYPE_LABELS[alert.emergencyType] ?? alert.emergencyType}
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ marginBottom: spacing(4) }}>
            Lokasi: {alert.locationAddress ?? `${alert.locationLat.toFixed(5)}, ${alert.locationLng.toFixed(5)}`}
          </ThemedText>
          <Button text="Kembali ke Beranda" variant="secondary" onPress={() => router.replace('/home')} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'sending') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centeredContent}>
          <ThemedText variant="h1" align="center" style={{ marginBottom: spacing(2) }}>
            Mengirim SOS…
          </ThemedText>
          {statusNote ? (
            <ThemedText variant="body" color="secondary" align="center">
              {statusNote}
            </ThemedText>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'pickType') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText variant="h1" style={{ marginBottom: spacing(2) }}>
            Jenis Darurat
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={{ marginBottom: spacing(4) }}>
            Pilih jenis darurat agar operator bisa segera merespons.
          </ThemedText>
          {sendError ? (
            <ThemedText variant="caption" color="danger" style={{ marginBottom: spacing(3) }}>
              {sendError}
            </ThemedText>
          ) : null}
          <View style={styles.typeGrid}>
            {EMERGENCY_TYPES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => handlePickType(t.id)}
                style={({ pressed }) => [
                  styles.typeCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t.label}
              >
                <ThemedText variant="h1" style={{ marginBottom: spacing(1) }}>
                  {t.icon}
                </ThemedText>
                <ThemedText variant="caption">{t.label}</ThemedText>
              </Pressable>
            ))}
          </View>
          <Button
            text="Batal"
            variant="ghost"
            onPress={() => setStep('hold')}
            containerStyle={{ marginTop: spacing(4) }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.centeredContent}>
        <ThemedText variant="h1" align="center" style={{ marginBottom: spacing(2) }}>
          Tekan &amp; Tahan untuk SOS
        </ThemedText>
        <ThemedText variant="body" color="secondary" align="center" style={{ marginBottom: spacing(6) }}>
          Tahan tombol merah selama {Math.round(SOS_HOLD_DURATION_MS / 1000)} detik untuk mengirim
          sinyal darurat berisi lokasi Anda ke operator.
        </ThemedText>

        {locationError ? (
          <ThemedText variant="caption" color="danger" align="center" style={{ marginBottom: spacing(3) }}>
            {locationError}
          </ThemedText>
        ) : null}

        <Pressable
          onPressIn={startHold}
          onPressOut={cancelHold}
          disabled={!!locationError}
          accessibilityRole="button"
          accessibilityLabel="Tombol SOS, tekan dan tahan untuk mengirim"
          style={[styles.sosButton, { borderColor: colors.danger, opacity: locationError ? 0.5 : 1 }]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.sosFill, { backgroundColor: colors.dangerSurface, height: progressHeight }]}
          />
          <ThemedText variant="h1" style={styles.sosLabel}>
            SOS
          </ThemedText>
        </Pressable>

        <ThemedText variant="micro" color="muted" align="center" style={{ marginTop: spacing(6) }}>
          {Platform.OS === 'web'
            ? 'Di web, mikrofon akan diminta lewat izin browser.'
            : 'Lokasi dan 10 detik audio konteks akan dikirim bersama laporan.'}
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const SOS_BUTTON_SIZE = 220;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
  },
  centeredContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosButton: {
    width: SOS_BUTTON_SIZE,
    height: SOS_BUTTON_SIZE,
    borderRadius: SOS_BUTTON_SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sosFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.35,
  },
  sosLabel: {
    fontWeight: '800',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
