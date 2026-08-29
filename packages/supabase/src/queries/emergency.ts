import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateEmergencyAlertInput, EmergencyStatus } from '@repo/shared';
import type { Database } from '../database.types';

const EMERGENCY_AUDIO_BUCKET = 'emergency-audio';

type EmergencyAudioBody = ArrayBuffer | Blob;

/**
 * Mengunggah rekaman audio konteks SOS ke bucket privat `emergency-audio` di
 * bawah folder `{user_id}/`, sesuai kebijakan storage "warga unggah ke
 * foldernya sendiri" (sama pola dengan `uploadServiceDocument`). Mengembalikan
 * PATH (bukan URL publik) untuk disimpan di `emergency_alerts.audio_url` dan
 * ditukar jadi signed URL saat diputar operator (`getEmergencyAlertSignedAudioUrl`).
 */
export async function uploadEmergencyAudio(
  supabase: SupabaseClient<Database>,
  userId: string,
  body: EmergencyAudioBody,
  contentType: string,
): Promise<string> {
  const ext = contentType === 'audio/mpeg' ? 'mp3' : contentType === 'audio/mp4' ? 'mp4' : 'm4a';
  const suffix = Math.random().toString(36).slice(2, 10);
  const path = `${userId}/${Date.now()}-${suffix}.${ext}`;

  const { error } = await supabase.storage
    .from(EMERGENCY_AUDIO_BUCKET)
    .upload(path, body, { contentType });
  if (error) throw error;

  return path;
}

/**
 * Menukar path di `emergency-audio` menjadi signed URL sementara untuk
 * diputar operator. Bekerja karena migrasi
 * `20260811000003_emergency_audio_operator_read.sql` memberi operator
 * kebijakan SELECT storage — sebelum itu hanya pemilik yang bisa membaca.
 */
export async function getEmergencyAlertSignedAudioUrl(
  supabase: SupabaseClient<Database>,
  path: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(EMERGENCY_AUDIO_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export interface EmergencyAlertSummary {
  id: string;
  userId: string;
  emergencyType: CreateEmergencyAlertInput['emergencyType'];
  locationLat: number;
  locationLng: number;
  locationAddress: string | null;
  audioUrl: string | null;
  note: string | null;
  status: EmergencyStatus;
  respondedBy: string | null;
  respondedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface EmergencyAlertRow {
  id: string;
  user_id: string;
  emergency_type: string;
  location_lat: number;
  location_lng: number;
  location_address: string | null;
  audio_url: string | null;
  note: string | null;
  status: string;
  responded_by: string | null;
  responded_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

const EMERGENCY_ALERT_COLUMNS =
  'id, user_id, emergency_type, location_lat, location_lng, location_address, ' +
  'audio_url, note, status, responded_by, responded_at, resolved_at, created_at';

function rowToEmergencyAlert(row: EmergencyAlertRow): EmergencyAlertSummary {
  return {
    id: row.id,
    userId: row.user_id,
    emergencyType: row.emergency_type as CreateEmergencyAlertInput['emergencyType'],
    locationLat: row.location_lat,
    locationLng: row.location_lng,
    locationAddress: row.location_address,
    audioUrl: row.audio_url,
    note: row.note,
    status: row.status as EmergencyStatus,
    respondedBy: row.responded_by,
    respondedAt: row.responded_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

/**
 * Mengirim SOS langsung lewat PostgREST — TIDAK memanggil fungsi edge atau
 * AI apa pun (kriteria "SOS sends successfully without calling any AI
 * function"), sama pola dengan `createComplaint`/`createServiceRequest`.
 * `status` default `'active'` sesuai kolom tabel; audio bersifat opsional
 * karena perekamannya boleh gagal tanpa memblokir pengiriman darurat.
 */
export async function createEmergencyAlert(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CreateEmergencyAlertInput,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('emergency_alerts')
    .insert({
      user_id: userId,
      emergency_type: input.emergencyType,
      location_lat: input.locationLat,
      location_lng: input.locationLng,
      location_address: input.locationAddress ?? null,
      note: input.note ?? null,
      audio_url: input.audioUrl ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

/** Alert SOS aktif/responding milik warga sendiri — layar status setelah kirim. */
export async function getMyActiveEmergencyAlert(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<EmergencyAlertSummary | null> {
  const { data, error } = await supabase
    .from('emergency_alerts')
    .select<string, EmergencyAlertRow>(EMERGENCY_ALERT_COLUMNS)
    .eq('user_id', userId)
    .in('status', ['active', 'responding'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEmergencyAlert(data) : null;
}

/** Detail satu alert SOS — RLS `emergency_read` membatasi ke pemilik/operator. */
export async function getEmergencyAlert(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<EmergencyAlertSummary> {
  const { data, error } = await supabase
    .from('emergency_alerts')
    .select<string, EmergencyAlertRow>(EMERGENCY_ALERT_COLUMNS)
    .eq('id', id)
    .single();
  if (error) throw error;
  return rowToEmergencyAlert(data);
}

// ---------------------------------------------------------------------
// Operator-facing (antrean darurat)
// ---------------------------------------------------------------------

/**
 * Antrean darurat aktif untuk operator, diurut lama -> baru (yang paling
 * lama menunggu paling atas). RLS `emergency_read` sudah mengizinkan role
 * `emergency_operator`/`admin` membaca SELURUH baris, jadi filter status di
 * sini murni kenyamanan tampilan.
 */
export async function listActiveEmergencyAlerts(
  supabase: SupabaseClient<Database>,
): Promise<EmergencyAlertSummary[]> {
  const { data, error } = await supabase
    .from('emergency_alerts')
    .select<string, EmergencyAlertRow>(EMERGENCY_ALERT_COLUMNS)
    .in('status', ['active', 'responding'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToEmergencyAlert);
}

/** Operator menandai dirinya sedang menanggapi sebuah SOS. */
/**
 * Operator mengambil alih satu SOS.
 *
 * `.eq('status', 'active')` penting: tanpa itu UPDATE-nya tak bersyarat,
 * sehingga dua operator yang sama-sama melihat SOS berstatus `active` dan
 * sama-sama mengeklik "Tanggapi" akan saling menimpa `responded_by` —
 * yang kedua menang, dan yang pertama tetap yakin dialah yang menangani.
 * Baris yang terpengaruh nol berarti operator lain sudah lebih dulu.
 */
export async function respondToEmergencyAlert(
  supabase: SupabaseClient<Database>,
  id: string,
  operatorId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('emergency_alerts')
    .update({
      status: 'responding',
      responded_by: operatorId,
      responded_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'active')
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('SOS ini sudah ditanggapi operator lain.');
  }
}

/** Operator menutup SOS setelah penanganan selesai. */
export async function resolveEmergencyAlert(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('emergency_alerts')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Operator menandai SOS sebagai alarm palsu (kriteria "False alarm can be marked"). */
export async function markFalseAlarm(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('emergency_alerts')
    .update({ status: 'false_alarm', resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Warga membatalkan SOS-nya sendiri selagi masih 'active' (jendela "salah tekan"). */
export async function cancelEmergencyAlert(
  supabase: SupabaseClient<Database>,
  alertId: string,
): Promise<void> {
  const { error } = await supabase.rpc('cancel_own_emergency_alert', { p_alert_id: alertId });
  if (error) throw error;
}

/**
 * Melampirkan rekaman audio ke SOS yang SUDAH terkirim.
 *
 * Audio bersifat best-effort dan direkam ~10 detik, jadi ia tidak boleh
 * menahan INSERT alert (lihat migrasi 20260816000001). Layar SOS mengirim
 * alert lebih dulu lalu memanggil fungsi ini begitu rekaman siap; kegagalan
 * di sini tidak berpengaruh pada SOS yang sudah masuk ke antrean operator.
 */
export async function attachEmergencyAudio(
  supabase: SupabaseClient<Database>,
  alertId: string,
  audioUrl: string,
): Promise<void> {
  const { error } = await supabase.rpc('attach_own_emergency_audio', {
    p_alert_id: alertId,
    p_audio_url: audioUrl,
  });
  if (error) throw error;
}

/** Warga mengirim lokasi terbaru selama SOS-nya masih active/responding. */
export async function updateOwnEmergencyLocation(
  supabase: SupabaseClient<Database>,
  alertId: string,
  lat: number,
  lng: number,
  address?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('update_own_emergency_location', {
    p_alert_id: alertId,
    p_lat: lat,
    p_lng: lng,
    p_address: address ?? undefined,
  });
  if (error) throw error;
}

/** Kontak operator piket aktif (untuk kartu "Kontak piket" di layar status SOS) — best-effort, ambil satu profil dengan role emergency_operator. */
export async function findActiveOperatorContact(
  supabase: SupabaseClient<Database>,
): Promise<{ fullName: string; phone: string | null } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('role', 'emergency_operator')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { fullName: data.full_name, phone: data.phone } : null;
}
