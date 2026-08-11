import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateAnnouncementInput } from '@repo/shared';
import type { Database } from '../database.types';

// ---------------------------------------------------------------------
// Announcements (citizen-facing)
// ---------------------------------------------------------------------

export interface Announcement {
  id: string;
  title: string;
  body: string;
  dinasId: string | null;
  /** null berarti berlaku untuk seluruh warga (lihat announcements.kelurahan). */
  kelurahan: string | null;
  imageUrl: string | null;
  isPinned: boolean;
  publishedAt: string;
  expiresAt: string | null;
  createdBy: string | null;
}

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  dinas_id: string | null;
  kelurahan: string | null;
  image_url: string | null;
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
  created_by: string | null;
}

const ANNOUNCEMENT_COLUMNS =
  'id, title, body, dinas_id, kelurahan, image_url, is_pinned, published_at, expires_at, created_by';

function rowToAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    dinasId: row.dinas_id,
    kelurahan: row.kelurahan,
    imageUrl: row.image_url,
    isPinned: row.is_pinned,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
  };
}

/**
 * Pengumuman aktif untuk warga: berlaku umum (`kelurahan IS NULL`) ATAU
 * ditujukan ke kelurahan pengguna, sudah terbit, dan belum kedaluwarsa.
 * Pin dulu, lalu terbaru dulu (kriteria "Announcements can target all
 * users or a specific kelurahan").
 */
export async function listAnnouncements(
  supabase: SupabaseClient<Database>,
  kelurahan: string | null,
): Promise<Announcement[]> {
  let query = supabase
    .from('announcements')
    .select<string, AnnouncementRow>(ANNOUNCEMENT_COLUMNS)
    .lte('published_at', new Date().toISOString())
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false });

  query = kelurahan
    ? query.or(`kelurahan.is.null,kelurahan.eq.${kelurahan}`)
    : query.is('kelurahan', null);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToAnnouncement);
}

// ---------------------------------------------------------------------
// Announcements (admin-facing)
// ---------------------------------------------------------------------

/** Seluruh pengumuman, tanpa filter tanggal/kelurahan — untuk dashboard admin. */
export async function listAnnouncementsForAdmin(
  supabase: SupabaseClient<Database>,
): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select<string, AnnouncementRow>(ANNOUNCEMENT_COLUMNS)
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToAnnouncement);
}

/**
 * Admin/dinas_head membuat pengumuman baru. RLS `announcements_staff_write`
 * menolak role lain. `kelurahan` kosong/undefined -> NULL (berlaku untuk
 * seluruh warga), sesuai `createAnnouncementSchema`.
 */
export async function createAnnouncement(
  supabase: SupabaseClient<Database>,
  input: CreateAnnouncementInput,
  createdBy: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: input.title,
      body: input.body,
      kelurahan: input.kelurahan ?? null,
      dinas_id: input.dinasId ?? null,
      image_url: input.imageUrl ?? null,
      is_pinned: input.isPinned,
      expires_at: input.expiresAt ?? null,
      created_by: createdBy,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function updateAnnouncement(
  supabase: SupabaseClient<Database>,
  id: string,
  input: CreateAnnouncementInput,
): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .update({
      title: input.title,
      body: input.body,
      kelurahan: input.kelurahan ?? null,
      dinas_id: input.dinasId ?? null,
      image_url: input.imageUrl ?? null,
      is_pinned: input.isPinned,
      expires_at: input.expiresAt ?? null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAnnouncement(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Leaderboard kelurahan
// ---------------------------------------------------------------------

export interface KelurahanLeaderboardEntry {
  kelurahan: string;
  kecamatan: string | null;
  citizenCount: number;
  reportCount: number;
  resolvedCount: number;
  totalPoints: number;
}

interface KelurahanLeaderboardRow {
  kelurahan: string | null;
  kecamatan: string | null;
  citizen_count: number | null;
  report_count: number | null;
  resolved_count: number | null;
  total_points: number | null;
}

function rowToLeaderboardEntry(row: KelurahanLeaderboardRow): KelurahanLeaderboardEntry {
  return {
    kelurahan: row.kelurahan ?? '',
    kecamatan: row.kecamatan,
    citizenCount: row.citizen_count ?? 0,
    reportCount: row.report_count ?? 0,
    resolvedCount: row.resolved_count ?? 0,
    totalPoints: row.total_points ?? 0,
  };
}

/**
 * Peringkat kelurahan berdasarkan total poin warganya. Membaca langsung dari
 * materialized view `kelurahan_leaderboard` (kriteria "< 1s for 50
 * kelurahan" — lihat supabase/perf-test-leaderboard.sql), bukan agregasi
 * on-the-fly.
 */
export async function listLeaderboard(
  supabase: SupabaseClient<Database>,
): Promise<KelurahanLeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('kelurahan_leaderboard')
    .select<string, KelurahanLeaderboardRow>('*')
    .order('total_points', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToLeaderboardEntry);
}

/**
 * Memicu `REFRESH MATERIALIZED VIEW CONCURRENTLY kelurahan_leaderboard`.
 * Idempotent dan tanpa efek samping ke data pengguna lain, jadi gerbang
 * "siapa boleh menekan" cukup di level UI (tombol admin), bukan RLS (lihat
 * GRANT EXECUTE di 20260811000005_points.sql).
 */
export async function refreshLeaderboard(supabase: SupabaseClient<Database>): Promise<void> {
  const { error } = await supabase.rpc('refresh_leaderboard');
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Poin warga (ledger)
// ---------------------------------------------------------------------

export interface PointLedgerEntry {
  id: number;
  userId: string;
  points: number;
  reason: string;
  refTable: string | null;
  refId: string | null;
  createdAt: string;
}

interface PointLedgerRow {
  id: number;
  user_id: string;
  points: number;
  reason: string;
  ref_table: string | null;
  ref_id: string | null;
  created_at: string;
}

const POINT_LEDGER_COLUMNS = 'id, user_id, points, reason, ref_table, ref_id, created_at';

function rowToPointLedgerEntry(row: PointLedgerRow): PointLedgerEntry {
  return {
    id: row.id,
    userId: row.user_id,
    points: row.points,
    reason: row.reason,
    refTable: row.ref_table,
    refId: row.ref_id,
    createdAt: row.created_at,
  };
}

/** Riwayat poin milik pengguna, terbaru dulu — untuk layar "Poin Saya". */
export async function getMyPointLedger(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PointLedgerEntry[]> {
  const { data, error } = await supabase
    .from('point_ledger')
    .select<string, PointLedgerRow>(POINT_LEDGER_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToPointLedgerEntry);
}

/** Total poin pengguna lewat RPC `user_total_points` (SUM dihitung di database). */
export async function getUserTotalPoints(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('user_total_points', { target_user: userId });
  if (error) throw error;
  return data ?? 0;
}
