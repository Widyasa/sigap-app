import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { reverseGeocode } from './_lib/reverseGeocode';
import { createComplaintSchema, statusColor, DINAS_LIST } from '@repo/shared';
import { createComplaint, uploadComplaintPhoto, upvoteComplaint } from '@repo/supabase';
import { ThemedText } from './_components/ThemedText';
import { BottomNav } from './_components/BottomNav';
import { Button } from './_components/Button';
import { MapPreview } from './_components/MapPreview';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { supabase } from './_components/supabase';
import { classifyComplaint } from './_components/api';

interface PickedPhoto {
  uri: string;
  contentType: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

const MAX_PHOTOS = 5;
const MIN_DESCRIPTION_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 2000;
const PHOTO_SIZE = 96;

export default function LaporScreen() {
  const { user, getAccessToken } = useAuth();
  const router = useRouter();
  const { colors, spacing, mode } = useTheme();

  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ref, bukan state — dibaca secara sinkron di awal handleSubmit sehingga
  // tekan ganda yang terjadi sebelum re-render tetap diblokir.
  const submittingRef = useRef(false);

  const resolveAddress = useCallback(async (lat: number, lng: number) => {
    const resolved = await reverseGeocode(lat, lng);
    if (resolved) setAddress(resolved);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        if (!cancelled) {
          setLocationError('Izin lokasi diperlukan agar aduan bisa ditandai.');
          setLocating(false);
        }
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (cancelled) return;
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setAccuracy(position.coords.accuracy);
        await resolveAddress(position.coords.latitude, position.coords.longitude);
      } catch {
        if (!cancelled) setLocationError('Gagal mendapatkan lokasi. Coba lagi.');
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveAddress]);

  const handleCoordsChange = useCallback(
    (next: Coordinates) => {
      setCoords(next);
      resolveAddress(next.lat, next.lng);
    },
    [resolveAddress],
  );

  const handleTakePhoto = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin kamera diperlukan', 'Aktifkan izin kamera untuk memotret aduan.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotos((prev) => [...prev, { uri: asset.uri, contentType: asset.mimeType ?? 'image/jpeg' }]);
  }, [photos.length]);

  const handleRemovePhoto = useCallback((index: number) => {
    Alert.alert('Hapus foto', 'Hapus foto ini dari laporan?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => setPhotos((prev) => prev.filter((_, i) => i !== index)),
      },
    ]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    setError(null);

    if (photos.length < 1) {
      setError('Minimal 1 foto wajib dilampirkan.');
      return;
    }
    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      setError(`Ceritakan minimal ${MIN_DESCRIPTION_LENGTH} karakter.`);
      return;
    }
    if (!coords) {
      setError(locationError ?? 'Lokasi belum siap. Coba lagi sebentar.');
      return;
    }
    if (!user) {
      setError('Sesi tidak ditemukan. Masuk kembali.');
      return;
    }

    const preUploadFields = createComplaintSchema
      .omit({ imageUrls: true })
      .safeParse({
        description,
        locationLat: coords.lat,
        locationLng: coords.lng,
        locationAddress: address ?? undefined,
      });
    if (!preUploadFields.success) {
      setError(preUploadFields.error.issues[0]?.message ?? 'Data aduan tidak valid.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      // Foto disimpan dulu di storage sebelum baris aduan dibuat, agar
      // `image_urls` selalu berisi URL yang benar-benar ada.
      const imageUrls = await Promise.all(
        photos.map(async (photo) => {
          const response = await fetch(photo.uri);
          const arrayBuffer = await response.arrayBuffer();
          return uploadComplaintPhoto(supabase, user.id, arrayBuffer, photo.contentType);
        }),
      );

      const input = createComplaintSchema.parse({
        ...preUploadFields.data,
        imageUrls,
      });

      const { id: complaintId } = await createComplaint(supabase, user.id, input, {
        kelurahan: user.kelurahan,
        kecamatan: user.kecamatan,
      });

      // Klasifikasi AI bersifat best-effort: aduan sudah tersimpan di atas,
      // jadi kegagalan di sini tidak menghapus atau membatalkan apa pun —
      // baris tetap `pending_classification` dan bisa diklasifikasi ulang nanti.
      let duplicateOffer: { id: string; title: string; distanceMeters: number } | null = null;
      let successMessage = 'Terima kasih, laporan Anda sudah kami terima.';
      try {
        const token = await getAccessToken();
        if (token) {
          const result = await classifyComplaint(complaintId, token);
          if (result.ok && result.classification) {
            const dinas = DINAS_LIST.find((d) => d.id === result.classification!.assignedDinas);
            successMessage = `Aduan diteruskan ke ${dinas?.name ?? result.classification.assignedDinas}.`;
          }
          if (result.ok && result.duplicates && result.duplicates.length > 0) {
            const top = result.duplicates[0];
            duplicateOffer = { id: top.id, title: top.title, distanceMeters: top.distanceMeters };
          }
        }
      } catch (classifyErr) {
        console.error('classifyComplaint error', classifyErr);
      }

      if (duplicateOffer) {
        const offer = duplicateOffer;
        Alert.alert(
          'Aduan serupa ditemukan',
          `Ada laporan "${offer.title}" yang mirip sekitar ${Math.round(offer.distanceMeters)} m dari lokasi Anda. Dukung laporan itu?`,
          [
            { text: 'Tidak, aduan saya tetap terpisah', style: 'cancel', onPress: () => router.replace('/home') },
            {
              text: 'Dukung',
              onPress: async () => {
                try {
                  await upvoteComplaint(supabase, offer.id, user.id);
                } catch (upvoteErr) {
                  console.error('upvoteComplaint error', upvoteErr);
                }
                router.replace('/home');
              },
            },
          ],
        );
      } else {
        Alert.alert('Aduan terkirim', successMessage);
        router.replace('/home');
      }
    } catch (e) {
      console.error('createComplaint error', e);
      setError('Gagal mengirim aduan. Periksa koneksi internet dan coba lagi.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [photos, coords, address, description, user, locationError, router, getAccessToken]);

  const canSubmit = photos.length >= 1 && description.trim().length >= MIN_DESCRIPTION_LENGTH && !!coords;
  const locationDotColor = statusColor('resolved', mode).fg;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { padding: spacing(4), paddingBottom: spacing(24), gap: spacing(4) }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.headerRow, { justifyContent: 'flex-end' }]}>
          </View>

          <ThemedText variant="display">Lapor</ThemedText>

          <View
            style={[
              styles.formCard,
              { backgroundColor: colors.surface, borderRadius: spacing(5), padding: spacing(4), gap: spacing(4) },
            ]}
          >
            <View style={{ gap: spacing(1) }}>
              <ThemedText variant="h1">Ada masalah apa?</ThemedText>
              <ThemedText variant="body" color="secondary">
                Foto dulu, sisanya kami bantu isi.
              </ThemedText>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(3) }}>
              <Pressable
                onPress={handleTakePhoto}
                disabled={photos.length >= MAX_PHOTOS}
                style={[
                  styles.cameraItem,
                  {
                    borderColor: colors.accent,
                    borderRadius: spacing(3),
                    opacity: photos.length >= MAX_PHOTOS ? 0.5 : 1,
                  },
                ]}
              >
                <Ionicons name="camera-outline" size={22} color={colors.accent} />
                <ThemedText variant="caption" style={{ color: colors.accent }}>
                  Kamera
                </ThemedText>
                <ThemedText variant="micro" color="muted">
                  {photos.length}/{MAX_PHOTOS} foto
                </ThemedText>
              </Pressable>

              {photos.map((item, index) => (
                <Pressable
                  key={item.uri}
                  onPress={() => handleRemovePhoto(index)}
                  style={[styles.photoItem, { borderRadius: spacing(3) }]}
                >
                  <Image source={{ uri: item.uri }} style={styles.photoImage} />
                  <View
                    style={[
                      styles.uploadedBadge,
                      { backgroundColor: colors.accent, borderRadius: spacing(3), paddingHorizontal: spacing(1) },
                    ]}
                  >
                    <ThemedText variant="micro" style={{ color: colors.surface }}>
                      terunggah
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <View style={{ gap: spacing(2) }}>
              <ThemedText variant="h2">Ceritakan singkat saja</ThemedText>
              <TextInput
                value={description}
                onChangeText={(text) => setDescription(text.slice(0, MAX_DESCRIPTION_LENGTH))}
                placeholder="Contoh: Jalan berlubang besar di depan pasar, sudah dua minggu, motor sering jatuh."
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: spacing(3),
                    color: colors.textPrimary,
                    padding: spacing(3),
                  },
                ]}
              />
              <View style={styles.counterRow}>
                <ThemedText variant="caption" color="muted">
                  Minimal {MIN_DESCRIPTION_LENGTH} karakter
                </ThemedText>
                <ThemedText variant="caption" color="muted">
                  {description.length}/{MAX_DESCRIPTION_LENGTH}
                </ThemedText>
              </View>
            </View>

            {coords ? (
              <MapPreview coords={coords} onCoordsChange={handleCoordsChange} />
            ) : (
              <View
                style={[
                  styles.mapPlaceholder,
                  { backgroundColor: colors.background, borderRadius: spacing(4) },
                ]}
              >
                <ThemedText variant="caption" color="muted">
                  Mendeteksi lokasi…
                </ThemedText>
              </View>
            )}

            <View
              style={[
                styles.locationCard,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: spacing(3), padding: spacing(3), gap: spacing(1) },
              ]}
            >
              <View style={styles.locationRow}>
                <View style={[styles.locationDot, { backgroundColor: locationDotColor }]} />
                <ThemedText variant="body" style={{ flex: 1 }}>
                  {locating
                    ? 'Mendeteksi lokasi Anda…'
                    : locationError
                      ? locationError
                      : (address ?? 'Lokasi terdeteksi')}
                </ThemedText>
              </View>
              {coords ? (
                <ThemedText variant="caption" color="secondary">
                  {coords.lat.toFixed(5).replace('.', ',')} · {coords.lng.toFixed(5).replace('.', ',')}
                  {accuracy != null ? ` · akurasi ${Math.round(accuracy)} m` : ''}
                </ThemedText>
              ) : null}
            </View>

            {error ? (
              <ThemedText variant="caption" color="danger">
                {error}
              </ThemedText>
            ) : null}

            <View>
              <Button text="Kirim Laporan" loading={submitting} disabled={!canSubmit} onPress={handleSubmit} />
              <ThemedText variant="caption" color="muted" style={{ marginTop: spacing(2), textAlign: 'center' }}>
                Perlu 1 foto, 20 karakter, dan lokasi.
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNav />
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
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  formCard: {
    width: '100%',
  },
  cameraItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  uploadedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingVertical: 2,
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    fontSize: 15,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  locationCard: {
    borderWidth: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mapPlaceholder: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
