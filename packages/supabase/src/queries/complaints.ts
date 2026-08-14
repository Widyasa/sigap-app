import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateComplaintInput, ComplaintStatus, Urgency } from '@repo/shared';
import type { Database } from '../database.types';

const COMPLAINT_PHOTOS_BUCKET = 'complaint-photos';

type ComplaintPhotoBody = ArrayBuffer | Blob;

/**
 * Uploads a single complaint photo under the `{user_id}/` folder required by
 * the storage RLS policy ("warga unggah ke foldernya sendiri"). Uploading
 * under any other user's folder is rejected by that policy with a 403.
 */
export async function uploadComplaintPhoto(
  supabase: SupabaseClient<Database>,
  userId: string,
  body: ComplaintPhotoBody,
  contentType: string,
): Promise<string> {
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const suffix = Math.random().toString(36).slice(2, 10);
  const path = `${userId}/${Date.now()}-${suffix}.${ext}`;

  const { error } = await supabase.storage
    .from(COMPLAINT_PHOTOS_BUCKET)
    .upload(path, body, { contentType });
  if (error) throw error;

  const { data } = supabase.storage.from(COMPLAINT_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export interface ComplaintAuthorProfile {
  kelurahan: string | null;
  kecamatan: string | null;
}

/**
 * Inserts a complaint row directly via PostgREST — no Edge Function is
 * involved, so submission succeeds even when Edge Functions are offline.
 * The row starts as `pending_classification` (table default); AI enrichment
 * happens later out-of-band and only updates the row, it never re-creates it,
 * so citizen input always survives an AI or network failure.
 */
export async function createComplaint(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CreateComplaintInput,
  profile: ComplaintAuthorProfile,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('complaints')
    .insert({
      user_id: userId,
      description: input.description,
      location_lat: input.locationLat,
      location_lng: input.locationLng,
      location_address: input.locationAddress ?? null,
      image_urls: input.imageUrls,
      kelurahan: profile.kelurahan,
      kecamatan: profile.kecamatan,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Warga mendukung aduan orang lain (bukan miliknya sendiri secara khusus —
 * RLS `upvotes_insert_own` hanya memastikan baris upvote tercatat atas nama
 * pemanggil). Trigger database menaikkan `complaints.upvote_count` otomatis.
 */
export async function upvoteComplaint(
  supabase: SupabaseClient<Database>,
  complaintId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('complaint_upvotes')
    .insert({ complaint_id: complaintId, user_id: userId });
  if (error) throw error;
}

export interface FeedComplaint {
  id: string;
  title: string | null;
  description: string;
  category: string | null;
  assignedDinas: string | null;
  urgency: Urgency | null;
  status: ComplaintStatus;
  locationLat: number;
  locationLng: number;
  kelurahan: string | null;
  kecamatan: string | null;
  imageUrls: string[];
  upvoteCount: number;
  slaDueAt: string | null;
  createdAt: string;
}

const FEED_COLUMNS =
  'id, title, description, category, assigned_dinas, urgency, status, ' +
  'location_lat, location_lng, kelurahan, kecamatan, image_urls, ' +
  'upvote_count, sla_due_at, created_at';

interface FeedComplaintRow {
  id: string;
  title: string | null;
  description: string;
  category: string | null;
  assigned_dinas: string | null;
  urgency: string | null;
  status: string;
  location_lat: number;
  location_lng: number;
  kelurahan: string | null;
  kecamatan: string | null;
  image_urls: string[];
  upvote_count: number;
  sla_due_at: string | null;
  created_at: string;
}

function rowToFeedComplaint(row: FeedComplaintRow): FeedComplaint {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    assignedDinas: row.assigned_dinas,
    urgency: row.urgency as FeedComplaint['urgency'],
    status: row.status as ComplaintStatus,
    locationLat: row.location_lat,
    locationLng: row.location_lng,
    kelurahan: row.kelurahan,
    kecamatan: row.kecamatan,
    imageUrls: row.image_urls,
    upvoteCount: row.upvote_count,
    slaDueAt: row.sla_due_at,
    createdAt: row.created_at,
  };
}

/**
 * Feed publik aduan terbaru (RLS `complaints_read` mengizinkan semua baca).
 * Tidak difilter kelurahan — "browses the public feed" berlaku kota-wide;
 * penyaringan lokasi bisa ditambah di UI nanti tanpa mengubah kontrak ini.
 */
export async function listFeedComplaints(
  supabase: SupabaseClient<Database>,
  limit = 100,
): Promise<FeedComplaint[]> {
  const { data, error } = await supabase
    .from('complaints')
    .select<string, FeedComplaintRow>(FEED_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToFeedComplaint);
}

export interface ComplaintDetail extends FeedComplaint {
  locationAddress: string | null;
  aiSummary: string | null;
  rejectionReason: string | null;
  dinasName: string | null;
  userId: string;
  authorName: string | null;
}

interface ComplaintDetailRow extends FeedComplaintRow {
  location_address: string | null;
  ai_summary: string | null;
  rejection_reason: string | null;
  user_id: string;
  dinas: { name: string } | null;
  profiles: { full_name: string } | null;
}

/** Detail satu aduan, termasuk nama dinas dan penulis hasil join (untuk layar detail). */
export async function getComplaint(
  supabase: SupabaseClient<Database>,
  complaintId: string,
): Promise<ComplaintDetail> {
  const { data, error } = await supabase
    .from('complaints')
    .select<string, ComplaintDetailRow>(
      `${FEED_COLUMNS}, location_address, ai_summary, rejection_reason, user_id, dinas:assigned_dinas ( name ), profiles:user_id ( full_name )`,
    )
    .eq('id', complaintId)
    .single();
  if (error) throw error;
  return {
    ...rowToFeedComplaint(data),
    locationAddress: data.location_address,
    aiSummary: data.ai_summary,
    rejectionReason: data.rejection_reason,
    dinasName: data.dinas?.name ?? null,
    userId: data.user_id,
    authorName: data.profiles?.full_name ?? null,
  };
}

export interface TimelineEntry {
  id: number;
  eventType: string;
  note: string | null;
  photoUrls: string[];
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
}

interface TimelineRow {
  id: number;
  event_type: string;
  note: string | null;
  photo_urls: string[];
  created_at: string;
  actor_id: string | null;
  actor: { full_name: string } | null;
}

/** Riwayat progres aduan, urut lama -> baru (kronologis untuk tampilan timeline). */
export async function listComplaintTimeline(
  supabase: SupabaseClient<Database>,
  complaintId: string,
): Promise<TimelineEntry[]> {
  const { data, error } = await supabase
    .from('complaint_timeline')
    .select<string, TimelineRow>(
      'id, event_type, note, photo_urls, created_at, actor_id, actor:actor_id ( full_name )',
    )
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    note: row.note,
    photoUrls: row.photo_urls,
    createdAt: row.created_at,
    actorId: row.actor_id,
    actorName: row.actor?.full_name ?? null,
  }));
}

/** Kumpulan complaint_id yang sudah didukung pengguna — untuk state tombol Dukung di UI. */
export async function listMyUpvotedComplaintIds(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('complaint_upvotes')
    .select('complaint_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.complaint_id));
}

/** true jika error PostgREST adalah pelanggaran primary key (dukung ganda, kode 23505). */
export function isDuplicateUpvoteError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const { code } = error;
  return code === '23505';
}

// ---------------------------------------------------------------------
// Complaints (staff-facing: verifier koreksi klasifikasi, dinas tindak
// lanjut) — issue #14 "Admin dashboard foundation and role-based views".
// ---------------------------------------------------------------------

export interface VerifierComplaint {
  id: string;
  title: string | null;
  description: string;
  category: string | null;
  assignedDinas: string | null;
  assignedDinasName: string | null;
  urgency: Urgency | null;
  status: ComplaintStatus;
  kelurahan: string | null;
  kecamatan: string | null;
  imageUrls: string[];
  aiSummary: string | null;
  upvoteCount: number;
  createdAt: string;
  /** Pelapor asli — verifier/dinas perlu tahu siapa yang mengajukan. */
  userId: string;
}

/** Bentuk sama dengan VerifierComplaint; dipisah sebagai alias supaya layar
 * dinas dan verifier tidak diam-diam terikat pada tipe yang sama jika salah
 * satunya berubah nanti. */
export type DinasComplaint = VerifierComplaint;

interface StaffComplaintRow {
  id: string;
  title: string | null;
  description: string;
  category: string | null;
  assigned_dinas: string | null;
  urgency: string | null;
  status: string;
  kelurahan: string | null;
  kecamatan: string | null;
  image_urls: string[];
  ai_summary: string | null;
  upvote_count: number;
  created_at: string;
  user_id: string;
  dinas: { name: string } | null;
}

const STAFF_COMPLAINT_COLUMNS =
  'id, title, description, category, assigned_dinas, urgency, status, kelurahan, kecamatan, ' +
  'image_urls, ai_summary, upvote_count, created_at, user_id, dinas:assigned_dinas ( name )';

function rowToStaffComplaint(row: StaffComplaintRow): VerifierComplaint {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    assignedDinas: row.assigned_dinas,
    assignedDinasName: row.dinas?.name ?? null,
    urgency: row.urgency as Urgency | null,
    status: row.status as ComplaintStatus,
    kelurahan: row.kelurahan,
    kecamatan: row.kecamatan,
    imageUrls: row.image_urls,
    aiSummary: row.ai_summary,
    upvoteCount: row.upvote_count,
    createdAt: row.created_at,
    userId: row.user_id,
  };
}

/**
 * Antrean aduan untuk verifier: masih menunggu klasifikasi AI atau sudah
 * diklasifikasi tapi belum diverifikasi manusia. RLS `complaints_read`
 * mengizinkan semua baca; filter status di sini murni kenyamanan tampilan
 * (kriteria "Verifier sees aduan queue").
 */
export async function listComplaintsForVerifier(
  supabase: SupabaseClient<Database>,
  opts?: { limit?: number },
): Promise<VerifierComplaint[]> {
  let query = supabase
    .from('complaints')
    .select<string, StaffComplaintRow>(STAFF_COMPLAINT_COLUMNS)
    .in('status', ['pending_classification', 'pending'])
    .order('created_at', { ascending: false });
  if (opts?.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToStaffComplaint);
}

/**
 * Aduan yang sudah lolos verifikasi dan ditugaskan ke satu dinas (kriteria
 * "Dinas staff sees only aduan assigned to their dinas"). RLS
 * `complaints_dinas_update` sudah membatasi TULIS ke `assigned_dinas =
 * current_dinas_id()`, tapi `complaints_read` mengizinkan BACA semua baris —
 * parameter `dinasId` di sini adalah pertahanan berlapis di sisi klien agar
 * dinas tidak pernah melihat antrean dinas lain, bukan otorisasi sebenarnya.
 */
export async function listComplaintsForDinas(
  supabase: SupabaseClient<Database>,
  dinasId: string,
): Promise<DinasComplaint[]> {
  const { data, error } = await supabase
    .from('complaints')
    .select<string, StaffComplaintRow>(STAFF_COMPLAINT_COLUMNS)
    .eq('assigned_dinas', dinasId)
    .in('status', ['verified', 'in_progress'])
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToStaffComplaint);
}

/**
 * Aduan aktif lintas dinas — dipakai admin tanpa `dinasId` sendiri di layar
 * `/dinas` (lihat catatan di halaman itu untuk alasan admin butuh tampilan
 * gabungan, bukan per-dinas).
 */
export async function listActiveComplaintsAllDinas(
  supabase: SupabaseClient<Database>,
): Promise<DinasComplaint[]> {
  const { data, error } = await supabase
    .from('complaints')
    .select<string, StaffComplaintRow>(STAFF_COMPLAINT_COLUMNS)
    .in('status', ['verified', 'in_progress'])
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToStaffComplaint);
}

/** Peta transisi status yang boleh dilakukan verifier/admin saat mengoreksi
 * klasifikasi AI. Fungsi murni (tanpa I/O) supaya bisa diuji tanpa DB.
 * Setiap status juga memetakan ke DIRINYA SENDIRI supaya UI bisa menyimpan
 * koreksi field (judul/kategori/dinas/urgensi) tanpa memaksa lompat status —
 * itu bukan "transisi tak sah", hanya belum siap diverifikasi/ditolak. */
const CLASSIFICATION_TRANSITIONS: Partial<Record<ComplaintStatus, ComplaintStatus[]>> = {
  pending_classification: ['pending_classification', 'pending', 'rejected'],
  pending: ['pending', 'verified', 'rejected'],
};

/** true jika `from` -> `to` adalah transisi klasifikasi yang sah (kriteria
 * "Verifier ... can correct AI classification"). Diuji lewat unit test murni
 * di complaints.test.ts karena tidak menyentuh Supabase sama sekali. */
export function isValidClassificationTransition(
  from: ComplaintStatus,
  to: ComplaintStatus,
): boolean {
  return CLASSIFICATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface UpdateComplaintClassificationInput {
  currentStatus: ComplaintStatus;
  status: ComplaintStatus;
  title?: string | null;
  category?: string | null;
  assignedDinas?: string | null;
  urgency?: Urgency;
  rejectionReason?: string | null;
}

/**
 * Verifier/admin mengoreksi klasifikasi AI dan memajukan status
 * (pending_classification -> pending/rejected, pending -> verified/rejected).
 * RLS `complaints_verifier_update` adalah otoritas penulisan sebenarnya;
 * validasi transisi di sini mencegah UI mengirim lompatan status yang tak
 * masuk akal sebelum permintaan sampai ke database.
 */
export async function updateComplaintClassification(
  supabase: SupabaseClient<Database>,
  complaintId: string,
  input: UpdateComplaintClassificationInput,
): Promise<void> {
  if (!isValidClassificationTransition(input.currentStatus, input.status)) {
    throw new Error(`Transisi status tidak valid: ${input.currentStatus} -> ${input.status}`);
  }

  const update: Database['public']['Tables']['complaints']['Update'] = {
    status: input.status,
  };
  if (input.title !== undefined) update.title = input.title;
  if (input.category !== undefined) update.category = input.category;
  if (input.assignedDinas !== undefined) update.assigned_dinas = input.assignedDinas;
  if (input.urgency !== undefined) update.urgency = input.urgency;
  if (input.rejectionReason !== undefined) update.rejection_reason = input.rejectionReason;

  const { error } = await supabase.from('complaints').update(update).eq('id', complaintId);
  if (error) throw error;
}

export interface UpdateComplaintStatusInput {
  status: 'in_progress' | 'resolved';
  actorId: string;
  note?: string;
  photoUrls?: string[];
}

const DINAS_STATUS_EVENT: Record<UpdateComplaintStatusInput['status'], string> = {
  in_progress: 'progress',
  resolved: 'resolved',
};

/**
 * Dinas staff/head menindaklanjuti aduan (verified -> in_progress ->
 * resolved). RLS `complaints_dinas_update` (atau `complaints_verifier_update`
 * untuk admin) menegakkan siapa yang boleh menulis baris `complaints`.
 * Trigger `complaints_status_log` sudah mencatat perubahan status itu
 * sendiri ke `complaint_timeline` secara otomatis (tanpa catatan/foto);
 * insert kedua di sini menambahkan entri terpisah berisi catatan progres
 * dan foto lapangan dari petugas, yang tidak bisa ditangkap trigger generik.
 */
export async function updateComplaintStatus(
  supabase: SupabaseClient<Database>,
  complaintId: string,
  input: UpdateComplaintStatusInput,
): Promise<void> {
  const { error: updateError } = await supabase
    .from('complaints')
    .update({ status: input.status })
    .eq('id', complaintId);
  if (updateError) throw updateError;

  const { error: timelineError } = await supabase.from('complaint_timeline').insert({
    complaint_id: complaintId,
    actor_id: input.actorId,
    event_type: DINAS_STATUS_EVENT[input.status],
    note: input.note ?? null,
    photo_urls: input.photoUrls ?? [],
  });
  if (timelineError) throw timelineError;
}


export interface ComplaintSummary {
  in_progress: number;
  resolved: number;
  pending: number;
  latest: {
    id: string;
    title: string;
    time: string;
  } | null;
}

export async function getMyComplaintSummary(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ComplaintSummary> {
  const { data: counts, error: countError } = await supabase
    .from('complaints')
    .select('status', { count: 'exact' })
    .eq('user_id', userId);

  if (countError) throw countError;

  const summary = {
    in_progress: 0,
    resolved: 0,
    pending: 0,
    latest: null as { id: string; title: string; time: string } | null,
  };

  if (counts) {
    counts.forEach((row) => {
      if (row.status === 'in_progress') summary.in_progress++;
      else if (row.status === 'resolved') summary.resolved++;
      else if (
        row.status === 'pending' ||
        row.status === 'pending_classification' ||
        row.status === 'verified'
      )
        summary.pending++;
    });
  }

  const { data: latest, error: latestError } = await supabase
    .from('complaints')
    .select('id, title, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latest && !latestError) {
    summary.latest = {
      id: latest.id,
      title: latest.title ?? 'Aduan Tanpa Judul',
      time: new Date(latest.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
      }),
    };
  }

  return summary;
}
