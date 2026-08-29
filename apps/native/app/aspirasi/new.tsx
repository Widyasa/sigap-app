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
import { reverseGeocode } from '../_lib/reverseGeocode';
import { createAspirationSchema } from '@repo/shared';
import { createAspiration, getActiveVotingPeriod } from '@repo/supabase';
import { ThemedText } from '../_components/ThemedText';
import { Button } from '../_components/Button';
import { MapPreview, type Coordinates } from '../_components/MapPreview';
import { useAuth } from '../_components/AuthProvider';
import { useTheme } from '../_components/useTheme';
import { supabase } from '../_components/supabase';

const CATEGORIES = [
  'Drainase',
  'Jalan & trotoar',
  'Penerangan',
  'Fasilitas anak',
  'Kesehatan',
  'Persampahan',
];

const BENEFICIARY_OPTIONS: { label: string; value: number }[] = [
  { label: 'Di bawah 100 warga', value: 50 },
  { label: '100–500 warga', value: 300 },
  { label: '500–1.000 warga', value: 750 },
  { label: 'Lebih dari 1.000', value: 1500 },
];

const DEFAULT_COORDS: Coordinates = { lat: -6.886, lng: 107.616 };
const MIN_TITLE_LENGTH = 10;
const MIN_DESCRIPTION_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 1000;
const TOTAL_STEPS = 3;

interface PickedPhoto {
  uri: string;
}

function formatVotingPeriodLabel(endsAt: string, name: string): string {
  const end = new Date(endsAt);
  const day = end.toLocaleDateString('id-ID', { day: 'numeric' });
  const month = end.toLocaleDateString('id-ID', { month: 'short' });
  return `${name} · tutup ${day} ${month}`;
}

export default function NewAspirationScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors, spacing } = useTheme();

  const [step, setStep] = useState(1);

  // Step 1
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  // Step 2
  const [coords, setCoords] = useState<Coordinates>(DEFAULT_COORDS);
  const [address, setAddress] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [beneficiariesOption, setBeneficiariesOption] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ref, bukan state — dibaca secara sinkron di awal handleSubmit sehingga
  // tekan ganda yang terjadi sebelum re-render tetap diblokir.
  const submittingRef = useRef(false);

  const kelurahan = user?.kelurahan ?? 'Dago';
  const kecamatan = user?.kecamatan ?? 'Coblong';
  const locationAddress = address ?? (locating ? 'Mendeteksi lokasi…' : `Kel. ${kelurahan}`);
  const beneficiaryValue = BENEFICIARY_OPTIONS.find((o) => o.label === beneficiariesOption)?.value;

  const step1Valid =
    title.trim().length >= MIN_TITLE_LENGTH &&
    category !== '' &&
    description.trim().length >= MIN_DESCRIPTION_LENGTH;
  const step2Valid = beneficiariesOption !== '';

  const goBack = useCallback(() => {
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  }, [step, router]);

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
          setLocationError('Izin lokasi diperlukan agar lokasi usulan akurat.');
          setLocating(false);
        }
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        await resolveAddress(position.coords.latitude, position.coords.longitude);
      } catch {
        if (!cancelled) setLocationError('Gagal mendapatkan lokasi. Geser pin pada peta secara manual.');
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

  const handlePickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin galeri diperlukan', 'Aktifkan izin galeri untuk melampirkan foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    setPhoto({ uri: result.assets[0].uri });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    setError(null);

    if (!user) {
      setError('Sesi tidak ditemukan. Masuk kembali.');
      return;
    }
    if (!user.kelurahan || !user.kecamatan) {
      setError('Lengkapi kelurahan dan kecamatan pada profil Anda sebelum mengusulkan aspirasi.');
      return;
    }

    const parsed = createAspirationSchema.safeParse({
      title,
      description,
      category,
      estimatedBeneficiaries: beneficiaryValue,
      locationLat: coords.lat,
      locationLng: coords.lng,
      imageUrls: photo ? [photo.uri] : [],
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Periksa kembali isian Anda.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await createAspiration(supabase, user.id, parsed.data, {
        kelurahan: user.kelurahan,
        kecamatan: user.kecamatan,
      });
      Alert.alert('Aspirasi terkirim', 'Terima kasih, usulan Anda sudah kami terima.');
      router.replace('/aspirasi');
    } catch (e) {
      console.error('createAspiration error', e);
      setError('Gagal mengirim aspirasi. Periksa koneksi internet dan coba lagi.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [user, title, description, category, beneficiaryValue, coords, photo, router]);

  const [votingPeriodLabel, setVotingPeriodLabel] = useState('Musrenbang 2027 · tutup 24 Agu');
  const loadVotingPeriod = useCallback(async () => {
    try {
      const period = await getActiveVotingPeriod(supabase);
      if (period) {
        setVotingPeriodLabel(formatVotingPeriodLabel(period.endsAt, period.name));
      }
    } catch (e) {
      console.error('getActiveVotingPeriod error', e);
    }
  }, []);

  const goToStep3 = useCallback(() => {
    setStep(3);
    loadVotingPeriod();
  }, [loadVotingPeriod]);

  const subheaderTitle = 'Usulkan pembangunan';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { paddingHorizontal: spacing(4), paddingVertical: spacing(2) }]}>
          <Pressable
            onPress={() => router.push('/aspirasi')}
            accessibilityRole="button"
            accessibilityLabel="Kembali ke Aspirasi"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <ThemedText variant="h2">Aspirasi</ThemedText>
        </View>

        {/* Subheader */}
        <View style={[styles.subheader, { paddingHorizontal: spacing(4), gap: spacing(3) }]}>
          <View style={styles.subheaderRow}>
            <Pressable
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="Langkah sebelumnya"
              style={[styles.iconTile, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: spacing(2) }]}
            >
              <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <ThemedText variant="h1">{subheaderTitle}</ThemedText>
              <ThemedText variant="caption" color="secondary">
                Langkah {step} dari {TOTAL_STEPS}
              </ThemedText>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressSegment,
                  {
                    borderRadius: spacing(1),
                    backgroundColor: index < step ? colors.primary : colors.border,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { padding: spacing(4), gap: spacing(4) }]}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 ? (
            <View style={{ gap: spacing(5) }}>
              <View style={{ gap: spacing(1) }}>
                <ThemedText variant="h1">Apa yang perlu dibangun?</ThemedText>
                <ThemedText variant="body" color="secondary">
                  Satu usulan satu kebutuhan. Usulan yang jelas lebih mudah dinilai warga lain.
                </ThemedText>
              </View>

              <View style={{ gap: spacing(2) }}>
                <ThemedText variant="h2">Judul usulan</ThemedText>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Contoh: Perbaikan drainase Gang Nangka RW 04"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: spacing(3),
                      color: colors.textPrimary,
                      paddingHorizontal: spacing(3),
                    },
                  ]}
                />
                <ThemedText
                  variant="caption"
                  color={title.trim().length >= MIN_TITLE_LENGTH ? 'secondary' : 'muted'}
                >
                  {title.trim().length >= MIN_TITLE_LENGTH
                    ? 'Judul sudah cukup jelas'
                    : 'Minimal 10 karakter'}
                </ThemedText>
              </View>

              <View style={{ gap: spacing(2) }}>
                <ThemedText variant="h2">Kategori</ThemedText>
                <View style={styles.pillWrap}>
                  {CATEGORIES.map((option) => {
                    const selected = category === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setCategory(option)}
                        style={[
                          styles.pill,
                          {
                            borderRadius: spacing(5),
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primary : colors.surface,
                            paddingHorizontal: spacing(3),
                            paddingVertical: spacing(2),
                          },
                        ]}
                      >
                        <ThemedText
                          variant="caption"
                          style={{ color: selected ? colors.surface : colors.textPrimary, fontWeight: '600' }}
                        >
                          {option}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: spacing(2) }}>
                <ThemedText variant="h2">Alasan dan manfaatnya</ThemedText>
                <TextInput
                  value={description}
                  onChangeText={(text) => setDescription(text.slice(0, MAX_DESCRIPTION_LENGTH))}
                  placeholder="Jelaskan masalahnya sekarang dan apa yang berubah bila usulan ini dibangun."
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
                  <ThemedText
                    variant="caption"
                    color={description.trim().length >= MIN_DESCRIPTION_LENGTH ? 'secondary' : 'muted'}
                  >
                    {description.trim().length >= MIN_DESCRIPTION_LENGTH
                      ? 'Alasan sudah memadai'
                      : 'Minimal 20 karakter'}
                  </ThemedText>
                  <ThemedText variant="caption" color="muted">
                    {description.length}/{MAX_DESCRIPTION_LENGTH}
                  </ThemedText>
                </View>
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={{ gap: spacing(5) }}>
              <View style={{ gap: spacing(1) }}>
                <ThemedText variant="h1">Di mana dan untuk siapa?</ThemedText>
                <ThemedText variant="body" color="secondary">
                  Lokasi menentukan kelurahan pemilik usulan. Perkiraan penerima manfaat dipakai saat
                  pembahasan Musrenbang.
                </ThemedText>
              </View>

              <View style={{ gap: spacing(2) }}>
                <MapPreview coords={coords} onCoordsChange={handleCoordsChange} />
                <View
                  style={[
                    styles.locationCard,
                    { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: spacing(3), padding: spacing(3), gap: spacing(1) },
                  ]}
                >
                  <ThemedText variant="body" style={{ fontWeight: '700' }}>
                    {locationAddress}
                  </ThemedText>
                  <ThemedText variant="caption" color="secondary">
                    Kec. {kecamatan} · usulan masuk ke voting Kel. {kelurahan}
                  </ThemedText>
                  {locationError ? (
                    <ThemedText variant="caption" color="muted">
                      {locationError}
                    </ThemedText>
                  ) : null}
                </View>
              </View>

              <View style={{ gap: spacing(2) }}>
                <ThemedText variant="h2">Perkiraan penerima manfaat</ThemedText>
                <View style={styles.pillWrap}>
                  {BENEFICIARY_OPTIONS.map((option) => {
                    const selected = beneficiariesOption === option.label;
                    return (
                      <Pressable
                        key={option.label}
                        onPress={() => setBeneficiariesOption(option.label)}
                        style={[
                          styles.pill,
                          {
                            borderRadius: spacing(5),
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primary : colors.surface,
                            paddingHorizontal: spacing(3),
                            paddingVertical: spacing(2),
                          },
                        ]}
                      >
                        <ThemedText
                          variant="caption"
                          style={{ color: selected ? colors.surface : colors.textPrimary, fontWeight: '600' }}
                        >
                          {option.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: spacing(2) }}>
                <ThemedText variant="h2">Foto pendukung (opsional)</ThemedText>
                {photo ? (
                  <View style={[styles.photoItem, { borderRadius: spacing(3) }]}>
                    <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                    <Pressable
                      onPress={() => setPhoto(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Hapus foto"
                      style={[styles.removePhotoButton, { backgroundColor: colors.textPrimary }]}
                    >
                      <Ionicons name="close" size={14} color={colors.surface} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={handlePickPhoto}
                    style={[
                      styles.addPhotoButton,
                      { borderColor: colors.accent, borderRadius: spacing(3) },
                    ]}
                  >
                    <Ionicons name="add" size={20} color={colors.accent} />
                    <ThemedText variant="caption" style={{ color: colors.accent }}>
                      Tambah
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={{ gap: spacing(5) }}>
              <View style={{ gap: spacing(1) }}>
                <ThemedText variant="h1">Periksa sebelum dikirim</ThemedText>
                <ThemedText variant="body" color="secondary">
                  Setelah dikirim, usulan masuk ke daftar voting kelurahan dan tidak bisa diubah.
                </ThemedText>
              </View>

              <View
                style={[
                  styles.summaryBox,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: spacing(4), padding: spacing(4), gap: spacing(3) },
                ]}
              >
                <View
                  style={[
                    styles.pill,
                    {
                      alignSelf: 'flex-start',
                      borderRadius: spacing(5),
                      borderColor: colors.primary,
                      backgroundColor: colors.primarySurface,
                      paddingHorizontal: spacing(3),
                      paddingVertical: spacing(1),
                    },
                  ]}
                >
                  <ThemedText variant="micro" style={{ color: colors.primary, fontWeight: '700' }}>
                    {category}
                  </ThemedText>
                </View>

                <View style={{ gap: spacing(1) }}>
                  <ThemedText variant="h2">{title}</ThemedText>
                  <ThemedText variant="body" color="secondary">
                    {description}
                  </ThemedText>
                </View>

                <View style={{ gap: spacing(2) }}>
                  <SummaryRow label="Lokasi" value={locationAddress} />
                  <SummaryRow label="Penerima manfaat" value={beneficiariesOption} />
                  <SummaryRow label="Foto pendukung" value={photo ? 'Ada (1 foto)' : 'Tidak ada'} />
                  <SummaryRow label="Periode voting" value={votingPeriodLabel} />
                </View>
              </View>

              <View
                style={[
                  styles.infoCallout,
                  { backgroundColor: colors.primarySurface, borderRadius: spacing(3), padding: spacing(3), gap: spacing(2) },
                ]}
              >
                <View style={[styles.infoDot, { backgroundColor: colors.primary }]} />
                <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
                  Nama depan dan kelurahan Anda tampil sebagai pengusul. Usulan dengan suara terbanyak
                  dibawa ke Musrenbang kecamatan.
                </ThemedText>
              </View>

              {error ? (
                <ThemedText variant="caption" color="danger">
                  {error}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {/* Bottom actions */}
        <View style={[styles.bottomBar, { padding: spacing(4), gap: spacing(3), borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {step === 1 ? (
            <Button text="Lanjut" disabled={!step1Valid} onPress={() => setStep(2)} />
          ) : null}
          {step === 2 ? (
            <View style={styles.bottomRow}>
              <Button
                text="Kembali"
                variant="secondary"
                onPress={() => setStep(1)}
                containerStyle={{ flex: 1 }}
              />
              <Button
                text="Periksa usulan"
                disabled={!step2Valid}
                onPress={goToStep3}
                containerStyle={{ flex: 1 }}
              />
            </View>
          ) : null}
          {step === 3 ? (
            <View style={styles.bottomRow}>
              <Button
                text="Kembali"
                variant="secondary"
                onPress={() => setStep(2)}
                containerStyle={{ flex: 1 }}
              />
              <Button
                text="Kirim usulan"
                loading={submitting}
                onPress={handleSubmit}
                containerStyle={{ flex: 1 }}
              />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.summaryRow, { gap: spacing(2) }]}>
      <ThemedText variant="caption" color="muted" style={{ width: 140 }}>
        {label}
      </ThemedText>
      <ThemedText variant="caption" color="secondary" style={{ flex: 1 }}>
        {value}
      </ThemedText>
    </View>
  );
}

const PHOTO_SIZE = 96;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subheader: {
    paddingBottom: 4,
  },
  subheaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
  },
  scroll: {
    flexGrow: 1,
  },
  input: {
    height: 48,
    borderWidth: 1,
    fontSize: 15,
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
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderWidth: 1,
  },
  locationCard: {
    borderWidth: 1,
  },
  addPhotoButton: {
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
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBox: {
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
  },
  infoCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  bottomBar: {
    borderTopWidth: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
