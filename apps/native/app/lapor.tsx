import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { createComplaintSchema, DINAS_LIST } from '@repo/shared';
import { createComplaint, uploadComplaintPhoto, upvoteComplaint } from '@repo/supabase';
import { ThemedText } from './_components/ThemedText';
import { Button } from './_components/Button';
import { Input } from './_components/Input';
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

export default function LaporScreen() {
  const { user, getAccessToken } = useAuth();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ref, bukan state — dibaca secara sinkron di awal handleSubmit sehingga
  // tekan ganda yang terjadi sebelum re-render tetap diblokir.
  const submittingRef = useRef(false);

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
        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        try {
          const [place] = await Location.reverseGeocodeAsync({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          if (!cancelled && place) {
            setAddress([place.street, place.subregion, place.region].filter(Boolean).join(', '));
          }
        } catch {
          // Reverse geocode bersifat best-effort; koordinat saja sudah cukup.
        }
      } catch {
        if (!cancelled) setLocationError('Gagal mendapatkan lokasi. Coba lagi.');
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin kamera diperlukan', 'Aktifkan izin kamera untuk memotret aduan.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, contentType: asset.mimeType ?? 'image/jpeg' });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    setError(null);

    if (!photo) {
      setError('Foto wajib dilampirkan.');
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
      const response = await fetch(photo.uri);
      const arrayBuffer = await response.arrayBuffer();
      const imageUrl = await uploadComplaintPhoto(
        supabase,
        user.id,
        arrayBuffer,
        photo.contentType,
      );

      const input = createComplaintSchema.parse({
        ...preUploadFields.data,
        imageUrls: [imageUrl],
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
  }, [photo, coords, address, description, user, locationError, router, getAccessToken]);

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
            <ThemedText variant="h1">Buat Aduan</ThemedText>
            <ThemedText variant="body" color="secondary">
              Potret masalahnya, ceritakan dalam satu kalimat, lalu kirim. Tidak
              perlu memilih kategori atau dinas.
            </ThemedText>
          </View>

          {photo ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <Button
                text="Ambil Ulang"
                variant="ghost"
                onPress={handleTakePhoto}
                containerStyle={{ marginTop: spacing(2) }}
              />
            </View>
          ) : (
            <Button
              text="Ambil Foto"
              variant="secondary"
              onPress={handleTakePhoto}
              containerStyle={{ marginBottom: spacing(4) }}
            />
          )}

          <Input
            label="Ceritakan masalahnya"
            placeholder="Contoh: Ada lubang besar di Jalan Merdeka dekat pasar."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={{ minHeight: 96, textAlignVertical: 'top' }}
            error={error ?? undefined}
            containerStyle={{ marginTop: spacing(4), marginBottom: spacing(4) }}
          />

          <ThemedText variant="caption" color="secondary" style={{ marginBottom: spacing(4) }}>
            {locating
              ? 'Mendeteksi lokasi Anda…'
              : coords
                ? `Lokasi: ${address ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}`
                : (locationError ?? 'Lokasi tidak tersedia.')}
          </ThemedText>

          <Button
            text="Kirim Aduan"
            loading={submitting}
            disabled={locating}
            onPress={handleSubmit}
          />
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
    padding: 24,
  },
  header: {
    gap: 12,
    marginBottom: 24,
  },
  photoWrap: {
    marginBottom: 16,
  },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
});
