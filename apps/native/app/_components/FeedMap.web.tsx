import 'leaflet/dist/leaflet.css';
import { View, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { urgencyColor } from '@repo/shared';
import type { FeedComplaint } from '@repo/supabase';
import { useTheme } from './useTheme';

const BANDUNG_FALLBACK: [number, number] = [-6.9175, 107.6191];

interface FeedMapProps {
  complaints: FeedComplaint[];
  onMarkerPress: (id: string) => void;
  userLocation?: { lat: number; lng: number } | null;
}

/**
 * Peta feed untuk web via react-leaflet + tile OpenStreetMap gratis (sejalan
 * dengan "tidak ada API key peta berbayar", lihat PRD 6.9 / Further Notes).
 * Lingkaran berwarna (bukan pin default Leaflet) supaya tidak butuh aset
 * ikon eksternal dan warnanya konsisten dengan `theme.ts`.
 */
export function FeedMap({ complaints, onMarkerPress, userLocation }: FeedMapProps) {
  const { mode, colors } = useTheme();
  const first = complaints[0];
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : first
      ? [first.locationLat, first.locationLng]
      : BANDUNG_FALLBACK;

  return (
    <View style={styles.container}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {complaints.map((c) => (
          <CircleMarker
            key={c.id}
            center={[c.locationLat, c.locationLng]}
            radius={10}
            pathOptions={{
              color: c.urgency ? urgencyColor(c.urgency, mode).fg : colors.textMuted,
              fillColor: c.urgency ? urgencyColor(c.urgency, mode).fg : colors.textMuted,
              fillOpacity: 0.8,
            }}
            eventHandlers={{ click: () => onMarkerPress(c.id) }}
          >
            <Popup>{c.title ?? c.description}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
