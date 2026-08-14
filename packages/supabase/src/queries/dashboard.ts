import type { SupabaseClient } from '@supabase/supabase-js';
import { getComplaintCategoryGroup, type ComplaintCategoryGroupId } from '@repo/shared';
import type { Database } from '../database.types';

// Ringkasan (dashboard staf, PRD 8.3) — KPI, kepatuhan SLA harian, dan
// antrean "perlu keputusan" gabungan aspirasi/layanan. `getRingkasanStats`
// dan `getSlaComplianceDaily` TIDAK menerima cakupan dari klien — RPC-nya
// SECURITY DEFINER dan menentukan cakupan sendiri dari `profiles` milik
// pemanggil (`auth.uid()`), sama seperti `current_dinas_id()` di
// 20260810000006_rls.sql. `RingkasanScope` di bawah hanya dipakai oleh
// `getComplaintCategoryBreakdown`/`listComplaintsForRingkasan`, yang bukan
// RPC — keduanya `.select()` biasa atas data yang sudah kota-wide visible
// ke staf lewat RLS `complaints_read`, jadi cakupan klien di situ bukan
// batas otorisasi, hanya kenyamanan tampilan. Lihat catatan lengkap di
// migrasi 20260815000003_dashboard_ringkasan.sql.

export interface RingkasanScope {
  kelurahan?: string;
  dinasId?: string;
}

export interface RingkasanStats {
  todayCount: number;
  pendingResponseCount: number;
  pendingNearSlaCount: number;
  resolvedWeekCount: number;
  resolvedLastWeekCount: number;
  avgResponseHours: number;
}

/** Ringkasan KPI Ringkasan (kartu "Aduan baru hari ini", dst) lewat RPC `get_ringkasan_stats`
 * — RPC menentukan cakupannya sendiri dari profil pemanggil, tidak ada parameter cakupan. */
export async function getRingkasanStats(supabase: SupabaseClient<Database>): Promise<RingkasanStats> {
  const { data, error } = await supabase.rpc('get_ringkasan_stats').single();
  if (error) throw error;
  return {
    todayCount: data?.today_count ?? 0,
    pendingResponseCount: data?.pending_response_count ?? 0,
    pendingNearSlaCount: data?.pending_near_sla_count ?? 0,
    resolvedWeekCount: data?.resolved_week_count ?? 0,
    resolvedLastWeekCount: data?.resolved_last_week_count ?? 0,
    avgResponseHours: data?.avg_response_hours ?? 0,
  };
}

export interface SlaComplianceDay {
  day: string;
  compliancePercent: number | null;
}

/** Kepatuhan SLA per hari, 7 hari terakhir (default) lewat RPC `get_sla_compliance_daily`
 * — sama seperti `getRingkasanStats`, cakupan berasal dari profil pemanggil di database. */
export async function getSlaComplianceDaily(
  supabase: SupabaseClient<Database>,
  days = 7,
): Promise<SlaComplianceDay[]> {
  const { data, error } = await supabase.rpc('get_sla_compliance_daily', { p_days: days });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    day: row.day,
    compliancePercent: row.compliance_percent,
  }));
}

export interface PendingDecision {
  source: 'aspirasi' | 'layanan';
  refId: string;
  title: string;
  subtitle: string;
  createdAt: string;
}

/** Antrean "perlu keputusan" (aspirasi musrenbang + layanan verifying) lewat RPC `get_pending_decisions`. */
export async function getPendingDecisions(
  supabase: SupabaseClient<Database>,
  kelurahan: string,
): Promise<PendingDecision[]> {
  const { data, error } = await supabase.rpc('get_pending_decisions', { p_kelurahan: kelurahan });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    source: row.source as PendingDecision['source'],
    refId: row.ref_id,
    title: row.title,
    subtitle: row.subtitle,
    createdAt: row.created_at,
  }));
}

export interface ComplaintCategoryBreakdown {
  groupId: ComplaintCategoryGroupId;
  label: string;
  count: number;
}

const CATEGORY_GROUP_LABELS: Record<ComplaintCategoryGroupId, string> = {
  jalan: 'Jalan',
  sampah: 'Sampah',
  air: 'Air',
  penerangan: 'Penerangan',
  keamanan: 'Keamanan',
};

/**
 * Beban aduan per grup kategori tampilan (panel "Beban per kategori",
 * Ringkasan) — agregasi dilakukan di klien lewat `getComplaintCategoryGroup`
 * (bukan RPC ke-4), pola sama dengan `listBudgetSummaryBySector`: volume
 * baris kecil, tidak butuh agregasi di database.
 */
export async function getComplaintCategoryBreakdown(
  supabase: SupabaseClient<Database>,
  scope: RingkasanScope,
): Promise<ComplaintCategoryBreakdown[]> {
  let query = supabase.from('complaints').select<string, { category: string | null }>('category');
  if (scope.dinasId) {
    query = query.eq('assigned_dinas', scope.dinasId);
  } else if (scope.kelurahan) {
    query = query.eq('kelurahan', scope.kelurahan);
  }
  const { data, error } = await query;
  if (error) throw error;

  const counts = new Map<ComplaintCategoryGroupId, number>();
  for (const row of data ?? []) {
    if (!row.category) continue;
    const groupId = getComplaintCategoryGroup(row.category);
    if (!groupId) continue;
    counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([groupId, count]) => ({ groupId, label: CATEGORY_GROUP_LABELS[groupId], count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------
// Tabel "Aduan masuk" (Ringkasan) — beda dengan `listComplaintsForVerifier`
// (yang sengaja membatasi ke status pra-verifikasi untuk antrean verifier):
// tabel ini menampilkan SELURUH status sesuai lima chip filter PRD 8.3
// (Baru/Diproses/Diteruskan/Selesai/Ditolak), jadi query terpisah alih-alih
// menambah mode baru ke fungsi yang sudah punya kontrak sendiri.
// ---------------------------------------------------------------------

export interface RingkasanComplaintRow {
  id: string;
  title: string | null;
  category: string | null;
  status: string;
  reporterName: string | null;
  address: string | null;
  assignedDinasName: string | null;
  slaDueAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface RawRingkasanComplaintRow {
  id: string;
  title: string | null;
  category: string | null;
  status: string;
  location_address: string | null;
  sla_due_at: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter: { full_name: string } | null;
  dinas: { name: string } | null;
}

const RINGKASAN_COMPLAINT_COLUMNS =
  'id, title, category, status, location_address, sla_due_at, created_at, resolved_at, ' +
  'reporter:profiles!user_id ( full_name ), dinas:assigned_dinas ( name )';

/** Aduan masuk (semua status) untuk tabel utama Ringkasan, discope di klien (lihat catatan berkas ini). */
export async function listComplaintsForRingkasan(
  supabase: SupabaseClient<Database>,
  scope: RingkasanScope,
  limit = 50,
): Promise<RingkasanComplaintRow[]> {
  let query = supabase
    .from('complaints')
    .select<string, RawRingkasanComplaintRow>(RINGKASAN_COMPLAINT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (scope.dinasId) {
    query = query.eq('assigned_dinas', scope.dinasId);
  } else if (scope.kelurahan) {
    query = query.eq('kelurahan', scope.kelurahan);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status,
    reporterName: row.reporter?.full_name ?? null,
    address: row.location_address,
    assignedDinasName: row.dinas?.name ?? null,
    slaDueAt: row.sla_due_at,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }));
}
