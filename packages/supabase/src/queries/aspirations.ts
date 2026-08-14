import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateAspirationInput, CreateVotingPeriodInput, AspirationStatus } from '@repo/shared';
import type { Database } from '../database.types';

// ---------------------------------------------------------------------
// Voting periods
// ---------------------------------------------------------------------

export interface VotingPeriod {
  id: string;
  name: string;
  fiscalYear: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

interface VotingPeriodRow {
  id: string;
  name: string;
  fiscal_year: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

function rowToVotingPeriod(row: VotingPeriodRow): VotingPeriod {
  return {
    id: row.id,
    name: row.name,
    fiscalYear: row.fiscal_year,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
  };
}

const VOTING_PERIOD_COLUMNS = 'id, name, fiscal_year, starts_at, ends_at, is_active';

/**
 * Periode voting aktif saat ini. `voting_periods` tidak dipetakan per
 * kelurahan (lihat skema) — parameter `kelurahan` disiapkan untuk API yang
 * simetris dengan `listAspirations`, bukan filter kolom yang belum ada.
 * Jika ada beberapa periode aktif yang tumpang-tindih, ambil yang paling
 * baru dimulai.
 */
export async function getActiveVotingPeriod(
  supabase: SupabaseClient<Database>,
  _kelurahan?: string,
): Promise<VotingPeriod | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('voting_periods')
    .select<string, VotingPeriodRow>(VOTING_PERIOD_COLUMNS)
    .eq('is_active', true)
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToVotingPeriod(data) : null;
}

/** Seluruh periode voting, terbaru dulu — untuk dashboard admin. */
export async function listVotingPeriods(
  supabase: SupabaseClient<Database>,
): Promise<VotingPeriod[]> {
  const { data, error } = await supabase
    .from('voting_periods')
    .select<string, VotingPeriodRow>(VOTING_PERIOD_COLUMNS)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToVotingPeriod);
}

/** Admin membuka periode voting baru. RLS `periods_admin` menolak non-admin. */
export async function createVotingPeriod(
  supabase: SupabaseClient<Database>,
  input: CreateVotingPeriodInput,
): Promise<VotingPeriod> {
  const { data, error } = await supabase
    .from('voting_periods')
    .insert({
      name: input.name,
      fiscal_year: input.fiscalYear,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
    })
    .select<string, VotingPeriodRow>(VOTING_PERIOD_COLUMNS)
    .single();
  if (error) throw error;
  return rowToVotingPeriod(data);
}

/** Admin membuka/menutup periode voting (kriteria "open/close voting periods"). */
export async function setVotingPeriodActive(
  supabase: SupabaseClient<Database>,
  periodId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('voting_periods')
    .update({ is_active: isActive })
    .eq('id', periodId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Aspirations (citizen-facing)
// ---------------------------------------------------------------------

export interface AspirationSummary {
  id: string;
  title: string;
  description: string;
  category: string | null;
  status: AspirationStatus;
  kelurahan: string;
  kecamatan: string;
  estimatedBeneficiaries: number | null;
  estimatedCost: number | null;
  voteCount: number;
  musrenbangRank: number | null;
  linkedBudgetItemId: string | null;
  votingPeriodId: string | null;
  userId: string;
  createdAt: string;
}

interface AspirationRow {
  id: string;
  title: string;
  description: string;
  category: string | null;
  status: string;
  kelurahan: string;
  kecamatan: string;
  estimated_beneficiaries: number | null;
  estimated_cost: number | null;
  vote_count: number;
  musrenbang_rank: number | null;
  linked_budget_item_id: string | null;
  voting_period_id: string | null;
  user_id: string;
  created_at: string;
}

const ASPIRATION_COLUMNS =
  'id, title, description, category, status, kelurahan, kecamatan, ' +
  'estimated_beneficiaries, estimated_cost, vote_count, musrenbang_rank, ' +
  'linked_budget_item_id, voting_period_id, user_id, created_at';

function rowToAspiration(row: AspirationRow): AspirationSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status as AspirationStatus,
    kelurahan: row.kelurahan,
    kecamatan: row.kecamatan,
    estimatedBeneficiaries: row.estimated_beneficiaries,
    estimatedCost: row.estimated_cost,
    voteCount: row.vote_count,
    musrenbangRank: row.musrenbang_rank,
    linkedBudgetItemId: row.linked_budget_item_id,
    votingPeriodId: row.voting_period_id,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

/**
 * Semua aspirasi (segala status) di kelurahan pengguna, diurutkan suara
 * terbanyak dulu — dipakai layar Aspirasi native untuk tab "Kelurahan saya".
 */
export async function listAspirations(
  supabase: SupabaseClient<Database>,
  kelurahan: string,
): Promise<AspirationSummary[]> {
  const { data, error } = await supabase
    .from('aspirations')
    .select<string, AspirationRow>(ASPIRATION_COLUMNS)
    .eq('kelurahan', kelurahan)
    .order('vote_count', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToAspiration);
}

/**
 * Semua aspirasi (segala status) di kecamatan pengguna, diurutkan suara
 * terbanyak dulu — dipakai layar Aspirasi native untuk tab "Musrenbang".
 */
export async function listAspirationsByKecamatan(
  supabase: SupabaseClient<Database>,
  kecamatan: string,
): Promise<AspirationSummary[]> {
  const { data, error } = await supabase
    .from('aspirations')
    .select<string, AspirationRow>(ASPIRATION_COLUMNS)
    .eq('kecamatan', kecamatan)
    .order('vote_count', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToAspiration);
}

export interface AspirationAuthorProfile {
  kelurahan: string | null;
  kecamatan: string | null;
}

/**
 * Warga mengusulkan aspirasi baru. Aspirasi mewarisi kelurahan/kecamatan
 * profil pemanggil (bukan input bebas) agar pemilahan wilayah tetap
 * konsisten dengan RLS. Dikaitkan ke periode voting aktif jika ada, supaya
 * `votes_insert_own` bisa menegakkan batas waktu voting sejak awal.
 */
export async function createAspiration(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: CreateAspirationInput,
  profile: AspirationAuthorProfile,
): Promise<{ id: string }> {
  if (!profile.kelurahan || !profile.kecamatan) {
    throw new Error('Profil belum memiliki kelurahan/kecamatan.');
  }
  const activePeriod = await getActiveVotingPeriod(supabase);
  const { data, error } = await supabase
    .from('aspirations')
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description,
      category: input.category ?? null,
      estimated_beneficiaries: input.estimatedBeneficiaries ?? null,
      estimated_cost: input.estimatedCost ?? null,
      location_lat: input.locationLat ?? null,
      location_lng: input.locationLng ?? null,
      kelurahan: profile.kelurahan,
      kecamatan: profile.kecamatan,
      voting_period_id: activePeriod?.id ?? null,
      image_urls: input.imageUrls ?? [],
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Warga memilih aspirasi di kelurahannya sendiri. RLS `votes_insert_own`
 * adalah otoritas sebenarnya (kelurahan cocok + status voting + periode
 * aktif) — kegagalan di sini dilaporkan sebagai pesan yang jelas, bukan
 * error PostgREST mentah.
 */
export async function voteAspiration(
  supabase: SupabaseClient<Database>,
  aspirationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('aspiration_votes')
    .insert({ aspiration_id: aspirationId, user_id: userId });
  if (error) throw error;
}

export async function unvoteAspiration(
  supabase: SupabaseClient<Database>,
  aspirationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('aspiration_votes')
    .delete()
    .eq('aspiration_id', aspirationId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** true jika error PostgREST adalah pelanggaran RLS/kebijakan (kode 42501) — dukung pesan Indonesia yang jelas di UI. */
export function isVoteDeniedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const { code } = error as { code: unknown };
  return code === '42501' || code === 'PGRST301';
}

/** true jika error PostgREST adalah pelanggaran primary key (memilih dua kali, kode 23505). */
export function isDuplicateVoteError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const { code } = error;
  return code === '23505';
}

/** Kumpulan aspiration_id yang sudah dipilih pengguna — untuk state tombol Pilih di UI. */
export async function listMyVotedAspirationIds(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('aspiration_votes')
    .select('aspiration_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.aspiration_id));
}

// ---------------------------------------------------------------------
// Budget items (jejak dampak / impact trace)
// ---------------------------------------------------------------------

export interface BudgetItemInfo {
  id: string;
  programName: string;
  fiscalYear: number;
  progressPercent: number;
  budgetAllocated: number;
  budgetRealized: number;
  locationAddress: string | null;
  contractor: string | null;
  photoUrls: string[];
}

interface BudgetItemRow {
  id: string;
  program_name: string;
  fiscal_year: number;
  progress_percent: number;
  budget_allocated: number;
  budget_realized: number;
  location_address: string | null;
  contractor: string | null;
  photo_urls: string[];
}

const BUDGET_ITEM_COLUMNS =
  'id, program_name, fiscal_year, progress_percent, budget_allocated, ' +
  'budget_realized, location_address, contractor, photo_urls';

function rowToBudgetItem(row: BudgetItemRow): BudgetItemInfo {
  return {
    id: row.id,
    programName: row.program_name,
    fiscalYear: row.fiscal_year,
    progressPercent: row.progress_percent,
    budgetAllocated: row.budget_allocated,
    budgetRealized: row.budget_realized,
    locationAddress: row.location_address,
    contractor: row.contractor,
    photoUrls: row.photo_urls,
  };
}

export interface AspirationDetail extends AspirationSummary {
  budgetItem: BudgetItemInfo | null;
}

/**
 * Detail satu aspirasi, termasuk item anggaran tertaut (jika ada) untuk
 * jejak dampak Musrenbang -> realisasi anggaran (issue #9 kriteria "impact
 * trace visible from aspiration to budget item realization").
 */
export async function getAspirationDetail(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<AspirationDetail> {
  const { data, error } = await supabase
    .from('aspirations')
    .select<string, AspirationRow & { budget_item: BudgetItemRow | null }>(
      `${ASPIRATION_COLUMNS}, budget_item:linked_budget_item_id ( ${BUDGET_ITEM_COLUMNS} )`,
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  return {
    ...rowToAspiration(data),
    budgetItem: data.budget_item ? rowToBudgetItem(data.budget_item) : null,
  };
}

export interface BudgetItemOption {
  id: string;
  programName: string;
  fiscalYear: number;
}

/** Daftar item anggaran untuk dropdown penautan di dashboard admin. */
export async function listBudgetItemsForLinking(
  supabase: SupabaseClient<Database>,
): Promise<BudgetItemOption[]> {
  const { data, error } = await supabase
    .from('budget_items')
    .select('id, program_name, fiscal_year')
    .order('fiscal_year', { ascending: false })
    .order('program_name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    programName: row.program_name,
    fiscalYear: row.fiscal_year,
  }));
}

// ---------------------------------------------------------------------
// Aspirations (admin-facing review)
// ---------------------------------------------------------------------

/**
 * Aspirasi yang sedang direview admin: sudah lolos voting (`voting`) atau
 * sedang dibahas di Musrenbang, diurutkan suara terbanyak dulu supaya
 * prioritas warga terlihat langsung.
 */
export async function listAspirationsForReview(
  supabase: SupabaseClient<Database>,
): Promise<AspirationSummary[]> {
  const { data, error } = await supabase
    .from('aspirations')
    .select<string, AspirationRow>(ASPIRATION_COLUMNS)
    .in('status', ['voting', 'musrenbang'])
    .order('vote_count', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToAspiration);
}

export interface UpdateAspirationStatusInput {
  status: AspirationStatus;
  musrenbangRank?: number | null;
  linkedBudgetItemId?: string | null;
}

/**
 * Admin memajukan status aspirasi di sepanjang alur voting -> musrenbang ->
 * approved -> budgeted (dan opsional realized/rejected), sekaligus
 * menautkan item anggaran nyata saat tersedia. RLS `aspirations_admin_update`
 * adalah otoritas sebenarnya.
 */
export async function updateAspirationStatus(
  supabase: SupabaseClient<Database>,
  aspirationId: string,
  input: UpdateAspirationStatusInput,
): Promise<void> {
  const update: Database['public']['Tables']['aspirations']['Update'] = {
    status: input.status,
  };
  if (input.musrenbangRank !== undefined) update.musrenbang_rank = input.musrenbangRank;
  if (input.linkedBudgetItemId !== undefined) update.linked_budget_item_id = input.linkedBudgetItemId;

  const { error } = await supabase
    .from('aspirations')
    .update(update)
    .eq('id', aspirationId);
  if (error) throw error;
}
