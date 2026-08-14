import { Platform, View, Text, StyleSheet } from 'react-native';
import type * as ReactNativeMaps from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { urgencyColor } from '@repo/shared';
import type { Urgency } from '@repo/shared';
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
  userLocation?: { lat: number; lng: number } | null;
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
export function FeedMap({ complaints, onMarkerPress, userLocation }: FeedMapProps) {
  const { mode, colors, spacing } = useTheme();
  if (Platform.OS === 'web') return null;

  const { default: MapView, Marker } = require('react-native-maps') as typeof ReactNativeMaps;

  const first = complaints[0];
  const initialRegion: Region = userLocation
    ? { latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : first
      ? { latitude: first.locationLat, longitude: first.locationLng, latitudeDelta: 0.1, longitudeDelta: 0.1 }
      : BANDUNG_FALLBACK;

  const urgentLabels: Urgency[] = ['P0', 'P1'];

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        {complaints.map((c) => {
          const isUrgentLabel = c.urgency && urgentLabels.includes(c.urgency);
          const { fg, bg } = c.urgency ? urgencyColor(c.urgency, mode) : { fg: colors.textMuted, bg: colors.surface };
          return (
            <Marker
              key={c.id}
              coordinate={{ latitude: c.locationLat, longitude: c.locationLng }}
              pinColor={isUrgentLabel ? undefined : fg}
              title={c.title ?? c.description}
              onPress={() => onMarkerPress(c.id)}
            >
              {isUrgentLabel ? (
                <View
                  style={[
                    styles.marker,
                    { backgroundColor: fg, borderColor: bg, borderRadius: spacing(1.5), paddingHorizontal: spacing(2), paddingVertical: spacing(1) },
                  ]}
                >
                  <Text style={[styles.markerLabel, { color: colors.surface }]}>{c.urgency}</Text>
                </View>
              ) : undefined}
            </Marker>
          );
        })}
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
  marker: {
    borderWidth: 2,
  },
  markerLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
});
