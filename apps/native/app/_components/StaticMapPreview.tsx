import { Platform, View, StyleSheet } from 'react-native';
import type * as ReactNativeMaps from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { useTheme } from './useTheme';

const PREVIEW_HEIGHT = 160;
const REGION_DELTA = 0.004;

export interface Coordinates {
  lat: number;
  lng: number;
}

interface StaticMapPreviewProps {
  coords: Coordinates;
  markerColor?: string;
}

/**
 * Pratinjau peta non-draggable untuk layar detail aduan, native
 * (iOS/Android) via react-native-maps.
 *
 * Sama seperti `MapPreview.tsx`/`FeedMap.tsx`: `react-native-maps`
 * di-require lewat `require()` di dalam komponen, bukan `import` statis,
 * supaya expo-router tidak meledak saat memindai `app/_components/**` di
 * bundle web — `StaticMapPreview.web.tsx` (berkas bertetangga) yang benar-
 * benar dipakai di platform web; guard `Platform.OS` di bawah ini hanya
 * jaring pengaman.
 */
export function StaticMapPreview({ coords, markerColor }: StaticMapPreviewProps) {
  const { colors, spacing } = useTheme();

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
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        pointerEvents="none"
      >
        <Marker
          coordinate={{ latitude: coords.lat, longitude: coords.lng }}
          pinColor={markerColor ?? colors.primary}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: '100%',
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
