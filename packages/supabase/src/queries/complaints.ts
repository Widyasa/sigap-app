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
}

interface ComplaintDetailRow extends FeedComplaintRow {
  location_address: string | null;
  ai_summary: string | null;
  rejection_reason: string | null;
  user_id: string;
  dinas: { name: string } | null;
}

/** Detail satu aduan, termasuk nama dinas hasil join (untuk layar detail). */
export async function getComplaint(
  supabase: SupabaseClient<Database>,
  complaintId: string,
): Promise<ComplaintDetail> {
  const { data, error } = await supabase
    .from('complaints')
    .select<string, ComplaintDetailRow>(
      `${FEED_COLUMNS}, location_address, ai_summary, rejection_reason, user_id, dinas:assigned_dinas ( name )`,
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
