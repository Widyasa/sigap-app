import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { QrCodeView } from './_components/QrCodeView';
import { ThemedText } from './_components/ThemedText';
import { useAuth } from './_components/AuthProvider';
import { useTheme } from './_components/useTheme';
import { statusColor } from '@repo/shared';

export default function KartuWargaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, spacing, mode } = useTheme();

  const [showNIK, setShowNIK] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [token, setToken] = useState('DGO-4894-9126');
  const [seconds, setSeconds] = useState(60);

  const generateToken = useCallback(() => {
    const random = Math.floor(1000 + Math.random() * 9000);
    const random2 = Math.floor(1000 + Math.random() * 9000);
    setToken(`DGO-${random}-${random2}`);
    setSeconds(60);
  }, []);

  useEffect(() => {
    if (seconds > 0) {
      const timer = setInterval(() => setSeconds((s) => s - 1), 1000);
      return () => clearInterval(timer);
    } else {
      generateToken();
    }
  }, [seconds, generateToken]);

  const toggleToast = () => {
    setShowToast(!showToast);
    if (!showToast) {
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const maskedNIK = '3273 •••• •••• 0072';
  const realNIK = '3273 0114 0689 0072';


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.subheader, { backgroundColor: colors.primary, paddingHorizontal: spacing(4), paddingTop: spacing(2) }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Kembali" hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.surface} />
        </Pressable>
        <ThemedText variant="h2" style={{ color: colors.surface }}>Kartu Warga</ThemedText>
        <Pressable
          hitSlop={8} onPress={toggleToast} style={[styles.iconButton, { backgroundColor: colors.primaryPressed }]} accessibilityRole="button" accessibilityLabel="Info">
          <ThemedText style={{ color: colors.surface }}>?</ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>
        {/* Main Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: spacing(3), shadowColor: colors.textPrimary }]}>
          {/* Card Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing(3), gap: spacing(2) }}>
            <View style={{ backgroundColor: colors.accent, padding: spacing(2), borderRadius: spacing(2) }}>
              <ThemedText style={{ color: colors.surface, fontWeight: '700' }}>SG</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="caption" style={{ fontWeight: '600' }}>Pemerintah Kota Bandung</ThemedText>
              <ThemedText variant="micro" color="secondary">Kelurahan {user?.kelurahan || 'Dago'} · Kecamatan {user?.kecamatan || 'Coblong'}</ThemedText>
            </View>
            <View style={{ backgroundColor: statusColor('resolved', mode).bg, paddingHorizontal: spacing(2), paddingVertical: spacing(1), borderRadius: spacing(1) }}>
              <ThemedText variant="micro" style={{ color: statusColor('resolved', mode).fg }}>• TERVERIFIKASI</ThemedText>
            </View>
          </View>
          
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Identity */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing(3), gap: spacing(3) }}>
            <View style={{ backgroundColor: colors.primarySurface, padding: spacing(4), borderRadius: spacing(2) }}>
              <ThemedText variant="h2" style={{ color: colors.primary }}>BS</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="h2">{user?.fullName || 'Budi Santosa'}</ThemedText>
              <ThemedText variant="micro" color="secondary">Warga sejak Maret 2026</ThemedText>
            </View>
          </View>

          {/* NIK Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(3) }}>
            <View>
              <ThemedText variant="micro" color="secondary">NIK</ThemedText>
              <ThemedText variant="body" style={{ fontWeight: '600' }}>{showNIK ? realNIK : maskedNIK}</ThemedText>
            </View>
            <Pressable onPress={() => setShowNIK(!showNIK)} style={{ backgroundColor: colors.primarySurface, paddingHorizontal: spacing(3), paddingVertical: spacing(1), borderRadius: spacing(2) }}>
              <ThemedText variant="micro" style={{ color: colors.primary }}>{showNIK ? 'Sembunyikan' : 'Tampilkan'}</ThemedText>
            </Pressable>
          </View>

          {/* Details */}
          <View style={{ gap: spacing(1), marginBottom: spacing(3) }}>
            <ThemedText variant="micro" color="secondary">RT / RW</ThemedText>
            <ThemedText variant="body">003 / {user?.rw || '004'}</ThemedText>
            <ThemedText variant="micro" color="secondary" style={{ marginTop: spacing(1) }}>Tanggal lahir</ThemedText>
            <ThemedText variant="body">14 Juni 1989</ThemedText>
            <ThemedText variant="micro" color="secondary" style={{ marginTop: spacing(1) }}>Alamat</ThemedText>
            <ThemedText variant="body">Jl. Ir. H. Juanda No. 108, Dago, Coblong, Kota Bandung</ThemedText>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { borderStyle: 'dashed', borderColor: colors.border, borderWidth: 1 }]} />

          {/* QR Section */}
          {/* ASUMSI: Menggunakan react-native-qrcode-svg atas permintaan pengguna untuk dukungan QR code di mobile. */}
          <View style={{ alignItems: 'center', marginTop: spacing(3), gap: spacing(2) }}>
            <QrCodeView 
              value={token} 
              size={190} 
              color={colors.textPrimary} 
              backgroundColor={colors.surface} 
            />
            <ThemedText variant="h2">{token}</ThemedText>
            <ThemedText variant="caption" style={{ color: colors.civicAmber }}>• Berlaku {seconds} detik lagi</ThemedText>
            <Pressable onPress={generateToken} style={{ backgroundColor: colors.background, padding: spacing(2), borderRadius: spacing(2) }}>
              <ThemedText variant="caption">Perbarui kode</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Info Card */}
        <View style={{ backgroundColor: colors.primary, padding: spacing(3), borderRadius: spacing(2) }}>
            <ThemedText style={{ color: colors.surface }}>• Tunjukkan layar ini ke petugas. Naikkan kecerahan bila kode sulit terbaca. Jangan bagikan tangkapan layar; kode kedaluwarsa dalam satu menit.</ThemedText>
        </View>

        {/* Riwayat */}
        <ThemedText variant="h2">RIWAYAT PEMINDAIAN</ThemedText>
        <View style={{ gap: spacing(2) }}>
            {[
                { loc: 'Kecamatan Coblong · Loket 2', time: '2 hari lalu', desc: 'Konfirmasi identitas untuk SKU' },
                { loc: 'Kelurahan Dago', time: '12 Agu', desc: 'Pengambilan surat domisili' },
                { loc: 'Puskesmas Coblong', time: '5 Agu', desc: 'Pendaftaran layanan' }
            ].map((item, i) => (
                <View key={i} style={{ backgroundColor: colors.surface, padding: spacing(3), borderRadius: spacing(2), gap: spacing(1) }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <ThemedText variant="body" style={{ fontWeight: '600' }}>{item.loc}</ThemedText>
                        <ThemedText variant="caption" color="secondary">{item.time}</ThemedText>
                    </View>
                    <ThemedText variant="micro" color="secondary">{item.desc}</ThemedText>
                </View>
            ))}
        </View>

      </ScrollView>

      {/* Toast */}
      {showToast && (
        <View style={{ position: 'absolute', bottom: spacing(4), left: spacing(4), right: spacing(4), backgroundColor: colors.textPrimary, padding: spacing(3), borderRadius: spacing(2) }}>
            <ThemedText style={{ color: colors.surface }}>Petugas memindai kode ini dari aplikasi verifikasi kecamatan.</ThemedText>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subheader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  card: { padding: 15, elevation: 3, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  divider: { height: 1, marginVertical: 10 },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
});
