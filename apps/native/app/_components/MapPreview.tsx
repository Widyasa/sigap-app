import { Platform, View, StyleSheet } from 'react-native';
import type * as ReactNativeMaps from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { useTheme } from './useTheme';
import { ThemedText } from './ThemedText';

const PREVIEW_HEIGHT = 180;
const REGION_DELTA = 0.002;

export interface Coordinates {
  lat: number;
  lng: number;
}

interface MapPreviewProps {
  coords: Coordinates;
  onCoordsChange: (coords: Coordinates) => void;
}

/**
 * Pratinjau peta untuk native (iOS/Android) via react-native-maps.
 *
 * `react-native-maps` di-require lewat `require()` di dalam komponen, bukan
 * `import` statis di puncak berkas — pola yang sama dengan `FeedMap.tsx`
 * (lihat komentar di sana): expo-router memindai seluruh isi
 * `app/_components/**` untuk membangun manifest rute lewat context module,
 * dan itu mengevaluasi berkas ini walau target bundle-nya web. `MapPreview.web.tsx`
 * (berkas bertetangga) yang benar-benar dipakai saat platform web; guard
 * `Platform.OS` di bawah ini hanya jaring pengaman.
 */
export function MapPreview({ coords, onCoordsChange }: MapPreviewProps) {
  const { colors, spacing } = useTheme();

  // Kunci region dibulatkan ke ~11m sehingga geseran pin kecil (yang lewat
  // `onCoordsChange` memperbarui `coords` di parent dengan presisi penuh)
  // tidak memaksa MapView remount tiap frame — hanya saat lokasi berubah
  // signifikan (mis. deteksi GPS ulang).
  const regionKey = `${coords.lat.toFixed(4)}_${coords.lng.toFixed(4)}`;

  if (Platform.OS === 'web') return null;

  const { default: MapView, Marker } = require('react-native-maps') as typeof ReactNativeMaps;

  const initialRegion: Region = {
    latitude: coords.lat,
    longitude: coords.lng,
    latitudeDelta: REGION_DELTA,
    longitudeDelta: REGION_DELTA,
  };

  return (
    <View style={[styles.preview, { height: PREVIEW_HEIGHT, borderRadius: spacing(4) }]}>
      <MapView key={regionKey} style={styles.map} initialRegion={initialRegion}>
        <Marker
          coordinate={{ latitude: coords.lat, longitude: coords.lng }}
          draggable
          pinColor={colors.primary}
          onDragEnd={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            onCoordsChange({ lat: latitude, lng: longitude });
          }}
        />
      </MapView>

      <View
        style={[
          styles.captionPill,
          {
            backgroundColor: colors.surface,
            borderRadius: spacing(3),
            paddingHorizontal: spacing(2),
            paddingVertical: spacing(1),
            bottom: spacing(2),
            left: spacing(2),
          },
        ]}
      >
        <ThemedText variant="micro" color="secondary">
          peta · geser pin untuk koreksi
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  captionPill: {
    position: 'absolute',
  },
});
