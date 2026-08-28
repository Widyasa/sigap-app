import type { SupabaseClient } from '@supabase/supabase-js';
import { BUDGET_SECTORS, getBudgetSector, budgetSectorColor, type BudgetSectorId } from '@repo/shared';
import type { Database } from '../database.types';
import { fetchAllRows } from './paginate';

// ---------------------------------------------------------------------
// Budget summary per dinas (treemap)
// ---------------------------------------------------------------------

export interface BudgetSummaryByDinas {
  dinasId: string;
  dinasName: string;
  totalAllocated: number;
  totalRealized: number;
  itemCount: number;
}

interface BudgetSummaryRow {
  dinas_id: string | null;
  budget_allocated: number;
  budget_realized: number;
  dinas: { name: string } | null;
}

/**
 * Total anggaran dialokasikan/terealisasi per dinas untuk satu tahun
 * anggaran — dipakai treemap kriteria "Treemap renders budget allocated
 * per dinas". Agregasi dilakukan di klien atas hasil select sederhana
 * karena volume `budget_items` masih kecil; naikkan ke view/RPC bila
 * jumlah baris bertambah besar.
 */
export async function listBudgetSummaryByDinas(
  supabase: SupabaseClient<Database>,
  fiscalYear: number,
): Promise<BudgetSummaryByDinas[]> {
  // Dipaginasi: tanpa `range`, PostgREST memotong di `db-max-rows` (1000)
  // dan totalnya diam-diam salah untuk APBD sungguhan. Lihat paginate.ts.
  const rows = await fetchAllRows<BudgetSummaryRow>((from, to) =>
    supabase
      .from('budget_items')
      .select<string, BudgetSummaryRow>('dinas_id, budget_allocated, budget_realized, dinas(name)')
      .eq('fiscal_year', fiscalYear)
      .range(from, to),
  );
  const byDinas = new Map<string, BudgetSummaryByDinas>();
  for (const row of rows) {
    if (!row.dinas_id) continue;
    const existing = byDinas.get(row.dinas_id);
    if (existing) {
      existing.totalAllocated += row.budget_allocated;
      existing.totalRealized += row.budget_realized;
      existing.itemCount += 1;
    } else {
      byDinas.set(row.dinas_id, {
        dinasId: row.dinas_id,
        dinasName: row.dinas?.name ?? row.dinas_id,
        totalAllocated: row.budget_allocated,
        totalRealized: row.budget_realized,
        itemCount: 1,
      });
    }
  }

  return Array.from(byDinas.values()).sort((a, b) => b.totalAllocated - a.totalAllocated);
}

// ---------------------------------------------------------------------
// Budget summary per bidang (layar Anggaran — "Belanja per bidang")
// ---------------------------------------------------------------------

export interface BudgetSectorSummary {
  sectorId: string;
  label: string;
  color: { fg: string; bg: string };
  totalAllocated: number;
  totalRealized: number;
  itemCount: number;
  categories: string[];
}

interface BudgetSectorRow {
  dinas_id: string | null;
  budget_allocated: number;
  budget_realized: number;
  dinas: { categories: string[] } | null;
}

/**
 * Total anggaran dialokasikan/terealisasi per bidang untuk satu tahun
 * anggaran — dipakai kartu "Belanja per bidang" di layar Anggaran. Bidang
 * mengelompokkan beberapa dinas (lihat `getBudgetSector` di `@repo/shared`)
 * jadi agregasi dilakukan di klien atas hasil `listBudgetSummaryByDinas`-
 * style select, sama seperti agregasi per dinas di atas.
 */
export async function listBudgetSummaryBySector(
  supabase: SupabaseClient<Database>,
  fiscalYear: number,
): Promise<BudgetSectorSummary[]> {
  const rows = await fetchAllRows<BudgetSectorRow>((from, to) =>
    supabase
      .from('budget_items')
      .select<string, BudgetSectorRow>('dinas_id, budget_allocated, budget_realized, dinas!inner(categories)')
      .eq('fiscal_year', fiscalYear)
      .range(from, to),
  );
  const bySector = new Map<
    BudgetSectorId,
    { totalAllocated: number; totalRealized: number; itemCount: number; categories: Set<string> }
  >();
  for (const row of rows) {
    if (!row.dinas_id) continue;
    const sectorId = getBudgetSector(row.dinas_id);
    if (!sectorId) continue;
    const existing = bySector.get(sectorId);
    const categories = row.dinas?.categories ?? [];
    if (existing) {
      existing.totalAllocated += row.budget_allocated;
      existing.totalRealized += row.budget_realized;
      existing.itemCount += 1;
      for (const c of categories) existing.categories.add(c);
    } else {
      bySector.set(sectorId, {
        totalAllocated: row.budget_allocated,
        totalRealized: row.budget_realized,
        itemCount: 1,
        categories: new Set(categories),
      });
    }
  }

  return BUDGET_SECTORS.filter((sector) => bySector.has(sector.id)).map((sector) => {
    const agg = bySector.get(sector.id)!;
    return {
      sectorId: sector.id,
      label: sector.label,
      color: budgetSectorColor(sector.id, 'light'),
      totalAllocated: agg.totalAllocated,
      totalRealized: agg.totalRealized,
      itemCount: agg.itemCount,
      categories: Array.from(agg.categories),
    };
  });
}

// ---------------------------------------------------------------------
// Anggaran terkait usulan warga (layar Anggaran — "Dari usulan warga")
// ---------------------------------------------------------------------

export interface AspirationBudgetSummary {
  totalAllocated: number;
  activityCount: number;
}

interface AspirationBudgetRow {
  linked_budget_item_id: string | null;
  budget_item: { id: string; budget_allocated: number; fiscal_year: number } | null;
}

/**
 * Total anggaran & jumlah kegiatan yang berasal dari usulan warga yang
 * sudah dianggarkan (`aspirations.linked_budget_item_id`) untuk satu tahun
 * anggaran — dipakai kartu "Dari usulan warga". Dihitung per item anggaran
 * unik supaya beberapa usulan yang tertaut ke item yang sama tidak
 * dobel-hitung.
 */
export async function getAspirationBudgetSummary(
  supabase: SupabaseClient<Database>,
  fiscalYear: number,
): Promise<AspirationBudgetSummary> {
  const rows = await fetchAllRows<AspirationBudgetRow>((from, to) =>
    supabase
      .from('aspirations')
      .select<string, AspirationBudgetRow>(
        'linked_budget_item_id, budget_item:linked_budget_item_id ( id, budget_allocated, fiscal_year )',
      )
      .not('linked_budget_item_id', 'is', null)
      .range(from, to),
  );
  const seenItemIds = new Set<string>();
  let totalAllocated = 0;
  for (const row of rows) {
    const item = row.budget_item;
    if (!item || item.fiscal_year !== fiscalYear || seenItemIds.has(item.id)) continue;
    seenItemIds.add(item.id);
    totalAllocated += item.budget_allocated;
  }

  return { totalAllocated, activityCount: seenItemIds.size };
}

// ---------------------------------------------------------------------
// Budget items list (drill-down per dinas)
// ---------------------------------------------------------------------

export interface BudgetItemListEntry {
  id: string;
  programName: string;
  activityName: string | null;
  budgetAllocated: number;
  budgetRealized: number;
  progressPercent: number;
}

interface BudgetItemListRow {
  id: string;
  program_name: string;
  activity_name: string | null;
  budget_allocated: number;
  budget_realized: number;
  progress_percent: number;
}

const BUDGET_ITEM_LIST_COLUMNS =
  'id, program_name, activity_name, budget_allocated, budget_realized, progress_percent';

/** Daftar program/kegiatan satu dinas untuk satu tahun anggaran — layar drill-down. */
export async function listBudgetItemsByDinas(
  supabase: SupabaseClient<Database>,
  dinasId: string,
  fiscalYear: number,
): Promise<BudgetItemListEntry[]> {
  const { data, error } = await supabase
    .from('budget_items')
    .select<string, BudgetItemListRow>(BUDGET_ITEM_LIST_COLUMNS)
    .eq('dinas_id', dinasId)
    .eq('fiscal_year', fiscalYear)
    .order('budget_allocated', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as BudgetItemListRow[]).map((row) => ({
    id: row.id,
    programName: row.program_name,
    activityName: row.activity_name,
    budgetAllocated: row.budget_allocated,
    budgetRealized: row.budget_realized,
    progressPercent: row.progress_percent,
  }));
}

// ---------------------------------------------------------------------
// Budget item detail
// ---------------------------------------------------------------------

export interface BudgetItemDetail {
  id: string;
  fiscalYear: number;
  dinasId: string | null;
  programName: string;
  activityName: string | null;
  budgetAllocated: number;
  budgetRealized: number;
  progressPercent: number;
  contractor: string | null;
  locationLat: number | null;
  locationLng: number | null;
  locationAddress: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  photoUrls: string[];
}

interface BudgetItemDetailRow {
  id: string;
  fiscal_year: number;
  dinas_id: string | null;
  program_name: string;
  activity_name: string | null;
  budget_allocated: number;
  budget_realized: number;
  progress_percent: number;
  contractor: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  photo_urls: string[];
}

const BUDGET_ITEM_DETAIL_COLUMNS =
  'id, fiscal_year, dinas_id, program_name, activity_name, budget_allocated, ' +
  'budget_realized, progress_percent, contractor, location_lat, location_lng, ' +
  'location_address, kelurahan, kecamatan, photo_urls';

/** Detail lengkap satu item anggaran (lokasi, kontraktor, progres, realisasi) — kriteria "Budget detail". */
export async function getBudgetItemDetail(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<BudgetItemDetail> {
  const { data, error } = await supabase
    .from('budget_items')
    .select<string, BudgetItemDetailRow>(BUDGET_ITEM_DETAIL_COLUMNS)
    .eq('id', id)
    .single();
  if (error) throw error;

  const row = data;
  return {
    id: row.id,
    fiscalYear: row.fiscal_year,
    dinasId: row.dinas_id,
    programName: row.program_name,
    activityName: row.activity_name,
    budgetAllocated: row.budget_allocated,
    budgetRealized: row.budget_realized,
    progressPercent: row.progress_percent,
    contractor: row.contractor,
    locationLat: row.location_lat,
    locationLng: row.location_lng,
    locationAddress: row.location_address,
    kelurahan: row.kelurahan,
    kecamatan: row.kecamatan,
    photoUrls: row.photo_urls,
  };
}

// ---------------------------------------------------------------------
// Embedding backfill (admin dashboard "Indeks ulang anggaran")
// ---------------------------------------------------------------------

export interface BudgetIndexStatus {
  id: string;
  programName: string;
  activityName: string | null;
  locationAddress: string | null;
  dinasId: string | null;
  isIndexed: boolean;
}

interface BudgetIndexRow {
  id: string;
  program_name: string;
  activity_name: string | null;
  location_address: string | null;
  dinas_id: string | null;
  embedding: string | null;
}

/** Semua item anggaran dengan status embedding — dipakai kolom "indexed / not indexed" di admin. */
export async function listBudgetIndexStatus(
  supabase: SupabaseClient<Database>,
  fiscalYear: number,
): Promise<BudgetIndexStatus[]> {
  const { data, error } = await supabase
    .from('budget_items')
    .select<string, BudgetIndexRow>(
      'id, program_name, activity_name, location_address, dinas_id, embedding',
    )
    .eq('fiscal_year', fiscalYear)
    .order('program_name', { ascending: true });
  if (error) throw error;

  return ((data ?? []) as unknown as BudgetIndexRow[]).map((row) => ({
    id: row.id,
    programName: row.program_name,
    activityName: row.activity_name,
    locationAddress: row.location_address,
    dinasId: row.dinas_id,
    isIndexed: row.embedding !== null,
  }));
}

/** Teks deskriptif dipakai `embed-text` untuk sebuah item anggaran — gabungan
 * program, kegiatan, dan lokasi agar pencarian semantik (RAG) menangkap
 * konteks lengkap, bukan hanya nama program. */
export function budgetItemEmbeddingText(item: {
  programName: string;
  activityName: string | null;
  locationAddress: string | null;
}): string {
  return [item.programName, item.activityName, item.locationAddress]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ');
}

// ---------------------------------------------------------------------
// Tanya AI (RAG)
// ---------------------------------------------------------------------

export interface AskBudgetCitedItem {
  id: string;
  programName: string;
  dinasId: string;
}

export interface AskBudgetResponse {
  ok: boolean;
  answer?: string;
  citedItems?: AskBudgetCitedItem[];
  reason?: string;
}

/**
 * Bertanya ke fungsi edge `ask-budget` (RAG anggaran). Butuh `supabaseUrl`
 * eksplisit karena paket ini dipakai lintas aplikasi (web dan native) yang
 * masing-masing membaca URL proyek dari variabel lingkungannya sendiri —
 * mirror bentuk fetch/header `classifyComplaint` di `apps/native`.
 */
export async function askBudget(
  supabaseUrl: string,
  accessToken: string,
  question: string,
): Promise<AskBudgetResponse> {
  const response = await fetch(`${supabaseUrl}/functions/v1/ask-budget`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) {
    try {
      const errorBody = await response.json();
      return errorBody as AskBudgetResponse;
    } catch {
      return { ok: false, reason: 'ai_unavailable' };
    }
  }
  return response.json() as Promise<AskBudgetResponse>;
}

export interface EmbedBudgetItemResponse {
  ok: boolean;
  dimensions?: number;
  reason?: string;
}

/**
 * Memicu fungsi edge `embed-text` untuk satu item anggaran — dipakai tombol
 * admin "Indeks ulang anggaran" untuk mengisi `embedding` item yang masih
 * NULL, prasyarat agar `search_budget_items`/`ask-budget` bisa menemukannya.
 */
export async function embedBudgetItemText(
  supabaseUrl: string,
  accessToken: string,
  id: string,
  text: string,
): Promise<EmbedBudgetItemResponse> {
  const response = await fetch(`${supabaseUrl}/functions/v1/embed-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text, target: 'budget', id }),
  });
  return response.json() as Promise<EmbedBudgetItemResponse>;
}

// ---------------------------------------------------------------------
// Budget import (admin dashboard "budget import" — issue #14 kriteria
// "Admin manages ... budget import"). Minimal berbentuk insert baris
// terstruktur (form manual satu-per-satu ATAU beberapa baris hasil parse
// CSV di UI) alih-alih wizard upload penuh; parsing CSV dilakukan di
// halaman admin karena murni transformasi teks -> objek tanpa I/O.
// ---------------------------------------------------------------------

export interface BudgetItemImportRow {
  fiscalYear: number;
  dinasId: string | null;
  programName: string;
  activityName: string | null;
  budgetAllocated: number;
  budgetRealized: number;
  locationAddress: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  progressPercent: number;
  contractor: string | null;
}

/**
 * Admin menambah item anggaran baru secara batch. RLS `budget_admin_write`
 * adalah otoritas penulisan sebenarnya (FOR ALL, hanya admin) — fungsi ini
 * hanya membangun payload INSERT yang konsisten dari baris CSV/form.
 */
export async function importBudgetItems(
  supabase: SupabaseClient<Database>,
  rows: BudgetItemImportRow[],
): Promise<{ inserted: number }> {
  const payload: Database['public']['Tables']['budget_items']['Insert'][] = rows.map((row) => ({
    fiscal_year: row.fiscalYear,
    dinas_id: row.dinasId,
    program_name: row.programName,
    activity_name: row.activityName,
    budget_allocated: row.budgetAllocated,
    budget_realized: row.budgetRealized,
    location_address: row.locationAddress,
    kelurahan: row.kelurahan,
    kecamatan: row.kecamatan,
    progress_percent: row.progressPercent,
    contractor: row.contractor,
  }));
  const { error } = await supabase.from('budget_items').insert(payload);
  if (error) throw error;
  return { inserted: payload.length };
}
