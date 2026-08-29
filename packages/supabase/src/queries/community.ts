import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateAnnouncementInput } from '@repo/shared';
import type { Database } from '../database.types';

// ---------------------------------------------------------------------
// Announcements (citizen-facing)
// ---------------------------------------------------------------------

export type AnnouncementCategoryId =
  | 'darurat' | 'infrastruktur' | 'kesehatan' | 'layanan' | 'kegiatan' | 'umum';

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
  category: AnnouncementCategoryId | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  /** Nama penulis (`profiles.full_name`) — null bila tak ikut di-join. */
  authorName: string | null;
  /** Sudah dibaca oleh pengguna yang meminta — selalu false bila `userId` tak diberikan. */
  isRead: boolean;
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
  category: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
}

interface AnnouncementJoinRow extends AnnouncementRow {
  author: { full_name: string } | null;
  announcement_reads: { user_id: string }[] | null;
}

const ANNOUNCEMENT_COLUMNS =
  'id, title, body, dinas_id, kelurahan, image_url, is_pinned, published_at, ' +
  'expires_at, created_by, category, attachment_url, attachment_name';

const ANNOUNCEMENT_JOIN_COLUMNS =
  `${ANNOUNCEMENT_COLUMNS}, author:profiles!created_by(full_name), announcement_reads(user_id)`;

function rowToAnnouncement(row: AnnouncementRow, authorName: string | null = null, isRead = false): Announcement {
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
    category: row.category as AnnouncementCategoryId | null,
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    authorName,
    isRead,
  };
}

function rowToJoinedAnnouncement(row: AnnouncementJoinRow, userId?: string): Announcement {
  const isRead = !!userId && (row.announcement_reads ?? []).length > 0;
  return rowToAnnouncement(row, row.author?.full_name ?? null, isRead);
}

/**
 * Pengumuman aktif untuk warga: berlaku umum (`kelurahan IS NULL`) ATAU
 * ditujukan ke kelurahan pengguna, sudah terbit, dan belum kedaluwarsa.
 * Pin dulu, lalu terbaru dulu (kriteria "Announcements can target all
 * users or a specific kelurahan"). `userId` opsional — jika diberikan,
 * `isRead` dihitung dari `announcement_reads` milik pengguna tsb (RLS
 * `announcement_reads_own` sudah membatasi baris yang bisa di-join ke
 * milik pengguna yang meminta).
 */
export async function listAnnouncements(
  supabase: SupabaseClient<Database>,
  kelurahan: string | null,
  userId?: string,
): Promise<Announcement[]> {
  let query = supabase
    .from('announcements')
    .select<string, AnnouncementJoinRow>(ANNOUNCEMENT_JOIN_COLUMNS)
    .lte('published_at', new Date().toISOString())
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false });

  query = kelurahan
    ? query.or(`kelurahan.is.null,kelurahan.eq.${kelurahan}`)
    : query.is('kelurahan', null);

  if (userId) {
    query = query.eq('announcement_reads.user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => rowToJoinedAnnouncement(row, userId));
}

/** Detail satu pengumuman, dengan nama penulis dan status baca `userId` (opsional). */
export async function getAnnouncement(
  supabase: SupabaseClient<Database>,
  id: string,
  userId?: string,
): Promise<Announcement> {
  let query = supabase
    .from('announcements')
    .select<string, AnnouncementJoinRow>(ANNOUNCEMENT_JOIN_COLUMNS)
    .eq('id', id);
  if (userId) {
    query = query.eq('announcement_reads.user_id', userId);
  }
  const { data, error } = await query.single();
  if (error) throw error;
  return rowToJoinedAnnouncement(data, userId);
}

/** Menandai satu pengumuman sudah dibaca oleh `userId` (idempotent). */
export async function markAnnouncementAsRead(
  supabase: SupabaseClient<Database>,
  userId: string,
  announcementId: string,
): Promise<void> {
  const { error } = await supabase
    .from('announcement_reads')
    .upsert({ user_id: userId, announcement_id: announcementId }, { onConflict: 'user_id,announcement_id', ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * Menandai seluruh pengumuman aktif dalam cakupan (umum + kelurahan warga)
 * sudah dibaca sekaligus — untuk tombol "Tandai dibaca". `ignoreDuplicates`
 * membuat baris yang sudah dibaca tidak tersentuh (aman dipanggil berkali-kali).
 */
export async function markAllAnnouncementsAsRead(
  supabase: SupabaseClient<Database>,
  userId: string,
  kelurahan: string | null,
): Promise<void> {
  let idQuery = supabase
    .from('announcements')
    .select<string, Pick<AnnouncementRow, 'id'>>('id')
    .lte('published_at', new Date().toISOString())
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  idQuery = kelurahan
    ? idQuery.or(`kelurahan.is.null,kelurahan.eq.${kelurahan}`)
    : idQuery.is('kelurahan', null);

  const { data: ids, error: idError } = await idQuery;
  if (idError) throw idError;
  if (!ids || ids.length === 0) return;

  const { error } = await supabase
    .from('announcement_reads')
    .upsert(
      ids.map((a) => ({ user_id: userId, announcement_id: a.id })),
      { onConflict: 'user_id,announcement_id', ignoreDuplicates: true },
    );
  if (error) throw error;
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
  return (data ?? []).map((row) => rowToAnnouncement(row));
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
      category: input.category ?? null,
      attachment_url: input.attachmentUrl ?? null,
      attachment_name: input.attachmentName ?? null,
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
      category: input.category ?? null,
      attachment_url: input.attachmentUrl ?? null,
      attachment_name: input.attachmentName ?? null,
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
// Leaderboard warga (peringkat citizen dalam satu kelurahan/RW)
// ---------------------------------------------------------------------

export interface CitizenLeaderboardEntry {
  userId: string;
  fullName: string | null;
  kelurahan: string;
  kecamatan: string | null;
  rw: string | null;
  totalPoints: number;
  weekPoints: number;
  monthPoints: number;
  contributionCount: number;
}

export type LeaderboardTimeFilter = 'week' | 'month' | 'all';

interface CitizenLeaderboardRow {
  user_id: string | null;
  full_name: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  rw: string | null;
  total_points: number | null;
  week_points: number | null;
  month_points: number | null;
  contribution_count: number | null;
}

function rowToCitizenLeaderboardEntry(row: CitizenLeaderboardRow): CitizenLeaderboardEntry {
  return {
    userId: row.user_id ?? '',
    fullName: row.full_name,
    kelurahan: row.kelurahan ?? '',
    kecamatan: row.kecamatan,
    rw: row.rw,
    totalPoints: row.total_points ?? 0,
    weekPoints: row.week_points ?? 0,
    monthPoints: row.month_points ?? 0,
    contributionCount: row.contribution_count ?? 0,
  };
}

const TIME_FILTER_COLUMN: Record<LeaderboardTimeFilter, 'week_points' | 'month_points' | 'total_points'> = {
  week: 'week_points',
  month: 'month_points',
  all: 'total_points',
};

/**
 * Peringkat warga di dalam satu kelurahan (opsional difilter per RW),
 * diurutkan sesuai jendela waktu yang dipilih. Membaca dari view
 * `citizen_leaderboard` (bukan materialized -- lihat komentar di
 * migration 20260815000001_citizen_leaderboard.sql).
 */
export async function listCitizenLeaderboard(
  supabase: SupabaseClient<Database>,
  kelurahan: string,
  rw: string | null,
  timeFilter: LeaderboardTimeFilter,
): Promise<CitizenLeaderboardEntry[]> {
  let query = supabase
    .from('citizen_leaderboard')
    .select<string, CitizenLeaderboardRow>('*')
    .eq('kelurahan', kelurahan);
  if (rw) {
    query = query.eq('rw', rw);
  }
  const { data, error } = await query.order(TIME_FILTER_COLUMN[timeFilter], { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToCitizenLeaderboardEntry);
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

export interface ProfileStats {
  totalPoints: number;
  kelurahanRank: number;
  complaintCount: number;
  aspirationCount: number;
  upvoteCount: number;
  joinedAt: string | null;
}

/** Ringkasan profil warga (poin, peringkat, jumlah kontribusi) lewat RPC `get_profile_stats`. */
export async function getProfileStats(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProfileStats> {
  const { data, error } = await supabase
    .rpc('get_profile_stats', { target_user: userId })
    .single();
  if (error) throw error;
  return {
    totalPoints: data?.total_points ?? 0,
    kelurahanRank: data?.kelurahan_rank ?? 0,
    complaintCount: data?.complaint_count ?? 0,
    aspirationCount: data?.aspiration_count ?? 0,
    upvoteCount: data?.upvote_count ?? 0,
    joinedAt: data?.joined_at ?? null,
  };
}
