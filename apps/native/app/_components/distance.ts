import { DINAS_LIST } from '@repo/shared';

/**
 * Jarak lurus (haversine) antara dua koordinat, dipakai untuk menampilkan
 * "320 m" dsb. di kartu aduan feed berdasarkan lokasi perangkat saat ini.
 */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Format jarak meter jadi label ringkas ("320 m" / "1.2 km"). */
export function formatDistance(meters: number | null): string {
  if (meters === null || Number.isNaN(meters)) return '— m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Nama dinas berbahasa Indonesia dari id (mis. 'pupr' -> 'Dinas Pekerjaan Umum & Penataan Ruang'). */
export function getDinasName(id: string | null): string {
  return DINAS_LIST.find((d) => d.id === id)?.name ?? id ?? 'Belum ditugaskan';
}
