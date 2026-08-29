// Parser CSV impor anggaran (dashboard admin, kriteria "Admin manages ...
// budget import"). Murni transformasi teks -> objek tanpa I/O, jadi tinggal
// di paket bersama supaya bisa diuji tanpa DB maupun DOM.

export interface BudgetCsvRow {
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

export interface ParseBudgetCsvResult {
  rows: BudgetCsvRow[];
  errors: string[];
}

export const BUDGET_CSV_COLUMNS = [
  'fiscal_year',
  'dinas_id',
  'program_name',
  'activity_name',
  'budget_allocated',
  'budget_realized',
  'location_address',
  'kelurahan',
  'kecamatan',
  'progress_percent',
  'contractor',
] as const;

const REQUIRED_COLUMNS = ['fiscal_year', 'program_name', 'budget_allocated'] as const;

/**
 * Angka wajib: kolom kosong BUKAN nol.
 *
 * `Number('')` mengembalikan `0`, bukan `NaN`, jadi pemeriksaan
 * `Number.isNaN(...)` saja meloloskan baris dengan `fiscal_year` atau
 * `budget_allocated` kosong dan menyimpannya sebagai tahun 0 / pagu Rp 0 —
 * data anggaran publik yang salah tanpa satu pun pesan galat.
 */
function parseRequiredNumber(raw: string | undefined): number | null {
  const value = (raw ?? '').trim();
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Angka opsional: kosong berarti `fallback`, isi yang tidak valid berarti galat. */
function parseOptionalNumber(raw: string | undefined, fallback: number): number | null {
  const value = (raw ?? '').trim();
  if (value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parser CSV minimal: header wajib memuat `fiscal_year`, `program_name`, dan
 * `budget_allocated` (urutan bebas), tanpa dukungan koma di dalam nilai
 * berkutip — cukup untuk impor manual admin, bukan pengganti alur ETL penuh.
 * Baris kosong dilewati; nilai kosong pada kolom opsional menjadi `null`.
 * Baris yang tidak valid dilaporkan lewat `errors` dan TIDAK ikut diimpor.
 */
export function parseBudgetCsv(text: string): ParseBudgetCsvResult {
  // BOM UTF-8 dari Excel akan menempel di nama kolom pertama dan membuat
  // header "fiscal_year" tidak pernah cocok.
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], errors: ['CSV kosong.'] };

  const header = lines[0]!.split(',').map((h) => h.trim());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return { rows: [], errors: [`Kolom wajib hilang di header: ${missing.join(', ')}`] };
  }

  const rows: BudgetCsvRow[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(',').map((c) => c.trim());
    const byCol = Object.fromEntries(header.map((h, idx) => [h, cells[idx] ?? '']));

    const programName = (byCol.program_name ?? '').trim();
    const fiscalYear = parseRequiredNumber(byCol.fiscal_year);
    const budgetAllocated = parseRequiredNumber(byCol.budget_allocated);
    const budgetRealized = parseOptionalNumber(byCol.budget_realized, 0);
    const progressPercent = parseOptionalNumber(byCol.progress_percent, 0);

    if (!programName || fiscalYear === null || budgetAllocated === null) {
      errors.push(`Baris ${i + 1}: fiscal_year/program_name/budget_allocated wajib diisi dan berupa angka.`);
      continue;
    }
    if (budgetRealized === null || progressPercent === null) {
      errors.push(`Baris ${i + 1}: budget_realized/progress_percent harus berupa angka.`);
      continue;
    }
    if (budgetAllocated < 0 || budgetRealized < 0) {
      errors.push(`Baris ${i + 1}: nilai anggaran tidak boleh negatif.`);
      continue;
    }
    if (progressPercent < 0 || progressPercent > 100) {
      errors.push(`Baris ${i + 1}: progress_percent harus antara 0 dan 100.`);
      continue;
    }

    rows.push({
      fiscalYear,
      dinasId: byCol.dinas_id || null,
      programName,
      activityName: byCol.activity_name || null,
      budgetAllocated,
      budgetRealized,
      locationAddress: byCol.location_address || null,
      kelurahan: byCol.kelurahan || null,
      kecamatan: byCol.kecamatan || null,
      progressPercent,
      contractor: byCol.contractor || null,
    });
  }
  return { rows, errors };
}
