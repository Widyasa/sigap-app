import { useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import { View, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from './useTheme';
import { ThemedText } from './ThemedText';
import type { Coordinates } from './MapPreview';

const PREVIEW_HEIGHT = 180;
const ZOOM = 17;
const PIN_SIZE = 30;

interface MapPreviewProps {
  coords: Coordinates;
  onCoordsChange: (coords: Coordinates) => void;
}

/**
 * Pratinjau peta untuk web via react-leaflet + tile OpenStreetMap gratis
 * (sejalan dengan `FeedMap.web.tsx` — tidak ada API key peta berbayar).
 * Marker dibuat lewat `L.divIcon` (bukan ikon PNG bawaan Leaflet) supaya
 * tidak butuh aset eksternal dan warnanya konsisten dengan `colors.primary`.
 * `MapContainer` diberi `key` yang hanya berubah saat lokasi bergeser
 * signifikan, sehingga drag pin (yang mengalir lewat `onCoordsChange` →
 * `coords` di parent) hanya menggeser marker, bukan me-remount peta.
 */
export function MapPreview({ coords, onCoordsChange }: MapPreviewProps) {
  const { colors, spacing } = useTheme();
  const mapKey = `${coords.lat.toFixed(4)}_${coords.lng.toFixed(4)}`;

  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: 'sigap-map-pin',
        html: `<div style="width:${PIN_SIZE}px;height:${PIN_SIZE}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${colors.primary};border:2px solid ${colors.surface};box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: [PIN_SIZE, PIN_SIZE],
        iconAnchor: [PIN_SIZE / 2, PIN_SIZE],
      }),
    [colors.primary, colors.surface],
  );

  return (
    <View style={[styles.preview, { height: PREVIEW_HEIGHT, borderRadius: spacing(4) }]}>
      <MapContainer
        key={mapKey}
        center={[coords.lat, coords.lng]}
        zoom={ZOOM}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={[coords.lat, coords.lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onCoordsChange({ lat, lng });
            },
          }}
        />
      </MapContainer>

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
    zIndex: 0,
  },
  captionPill: {
    position: 'absolute',
    zIndex: 1000,
  },
});
