import { useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import { View, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from './useTheme';

const PREVIEW_HEIGHT = 160;
const ZOOM = 16;
const PIN_SIZE = 26;

export interface Coordinates {
  lat: number;
  lng: number;
}

interface StaticMapPreviewProps {
  coords: Coordinates;
  markerColor?: string;
}

/**
 * Pratinjau peta non-draggable untuk layar detail aduan, web via
 * react-leaflet + tile OpenStreetMap gratis (sejalan dengan
 * `MapPreview.web.tsx`/`FeedMap.web.tsx` — tidak ada API key peta
 * berbayar). Interaksi (drag/scroll-zoom/kontrol) dimatikan karena ini
 * hanya pratinjau, bukan peta yang bisa dijelajahi.
 */
export function StaticMapPreview({ coords, markerColor }: StaticMapPreviewProps) {
  const { colors, spacing } = useTheme();
  const color = markerColor ?? colors.primary;

  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: 'sigap-map-pin',
        html: `<div style="width:${PIN_SIZE}px;height:${PIN_SIZE}px;border-radius:50%;background:${color};border:3px solid ${colors.surface};box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: [PIN_SIZE, PIN_SIZE],
        iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
      }),
    [color, colors.surface],
  );

  return (
    <View style={[styles.preview, { height: PREVIEW_HEIGHT, borderRadius: spacing(4) }]}>
      <MapContainer
        center={[coords.lat, coords.lng]}
        zoom={ZOOM}
        style={{ height: '100%', width: '100%' }}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[coords.lat, coords.lng]} icon={pinIcon} />
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    width: '100%',
    overflow: 'hidden',
  },
});
