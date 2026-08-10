import { Platform, View, StyleSheet } from 'react-native';
import type * as ReactNativeMaps from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { urgencyColor } from '@repo/shared';
import type { FeedComplaint } from '@repo/supabase';
import { useTheme } from './useTheme';

const BANDUNG_FALLBACK: Region = {
  latitude: -6.9175,
  longitude: 107.6191,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

interface FeedMapProps {
  complaints: FeedComplaint[];
  onMarkerPress: (id: string) => void;
}

/**
 * Peta feed untuk native (iOS/Android) via react-native-maps.
 *
 * `react-native-maps` di-require lewat `require()` di dalam komponen, bukan
 * `import` statis di puncak berkas. expo-router memindai seluruh isi
 * `app/_components/**` untuk membangun manifest rute lewat context module,
 * dan itu mengevaluasi berkas ini walau target bundle-nya web — `import`
 * statis akan langsung meledak di sana karena react-native-maps tidak
 * punya dukungan web. `FeedMap.web.tsx` (berkas bertetangga) yang benar-benar
 * dipakai saat platform web; guard `Platform.OS` di bawah ini hanya jaring
 * pengaman.
 */
export function FeedMap({ complaints, onMarkerPress }: FeedMapProps) {
  const { mode } = useTheme();
  if (Platform.OS === 'web') return null;

  const { default: MapView, Marker } = require('react-native-maps') as typeof ReactNativeMaps;

  const first = complaints[0];
  const initialRegion: Region = first
    ? { latitude: first.locationLat, longitude: first.locationLng, latitudeDelta: 0.1, longitudeDelta: 0.1 }
    : BANDUNG_FALLBACK;

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        {complaints.map((c) => (
          <Marker
            key={c.id}
            coordinate={{ latitude: c.locationLat, longitude: c.locationLng }}
            pinColor={c.urgency ? urgencyColor(c.urgency, mode).fg : undefined}
            title={c.title ?? c.description}
            onPress={() => onMarkerPress(c.id)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
