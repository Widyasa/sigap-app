import { Platform } from 'react-native';
import * as Location from 'expo-location';

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  city_district?: string;
  city?: string;
  town?: string;
  municipality?: string;
  county?: string;
  state?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
}

/**
 * Reverse-geocode via Nominatim (OpenStreetMap) — dipakai di web karena
 * `Location.reverseGeocodeAsync` dari expo-location tidak berfungsi di Expo
 * web (keterbatasan platform, bukan bug kita). Tanpa API key berbayar.
 */
async function reverseGeocodeWeb(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SIGAP-App/1.0',
        Accept: 'application/json',
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as NominatimResponse;
    const addr = data.address;
    if (!addr) return null;

    const street = addr.road ?? addr.pedestrian;
    const district = addr.suburb ?? addr.neighbourhood ?? addr.city_district ?? addr.village;
    const city = addr.city ?? addr.town ?? addr.municipality ?? addr.county;
    const state = addr.state;

    const parts = [street, district, city, state].filter((p): p is string => Boolean(p && p.trim()));
    if (parts.length === 0) return data.display_name ?? null;
    return parts.join(', ');
  } catch {
    return null;
  }
}

/**
 * Reverse-geocode via `expo-location` — dipakai di native (iOS/Android),
 * memakai geocoder bawaan OS.
 */
async function reverseGeocodeNative(lat: number, lng: number): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!place) return null;
    const parts = [place.street, place.district, place.city, place.subregion, place.region].filter(
      (p): p is string => Boolean(p && p.trim()),
    );
    
    const uniqueParts = new Set(parts);
    return uniqueParts.size > 0 ? Array.from(uniqueParts).join(', ') : null;
  } catch {
    return null;
  }
}

/**
 * Reverse-geocode koordinat jadi alamat yang bisa dibaca manusia, lintas
 * platform: native pakai geocoder OS via expo-location, web pakai Nominatim
 * (OpenStreetMap) karena expo-location tidak resolve alamat di web.
 * Selalu best-effort — mengembalikan `null` (bukan melempar) kalau gagal
 * atau tidak ada hasil, supaya caller bisa tampilkan placeholder netral.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (Platform.OS === 'web') {
    return reverseGeocodeWeb(lat, lng);
  }
  return reverseGeocodeNative(lat, lng);
}
