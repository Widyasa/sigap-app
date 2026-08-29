/**
 * Cermin bentuk tipe di `packages/ai/src/types.ts` (bagian klasifikasi
 * aduan), plus logika murni untuk memvalidasi keluaran model dan menghitung
 * tenggat SLA. Tidak ada panggilan jaringan di berkas ini — mudah diuji.
 */

export type Urgency = 'P0' | 'P1' | 'P2';

const URGENCIES: readonly Urgency[] = ['P0', 'P1', 'P2'];

export interface DinasRow {
  id: string;
  name: string;
  categories: string[];
  slaHoursP0: number;
  slaHoursP1: number;
  slaHoursP2: number;
}

export interface Classification {
  title: string;
  category: string;
  assignedDinas: string;
  urgency: Urgency;
  summary: string;
  confidence: number;
}

/**
 * Mengurai dan memvalidasi respons mentah model terhadap katalog dinas.
 * Melempar Error yang jelas bila bentuknya tidak sesuai kontrak — pemanggil
 * (classify-report) menangkapnya dan membiarkan aduan tetap
 * `pending_classification` alih-alih menyimpan data yang tidak valid.
 */
export function parseClassification(raw: string, dinasList: DinasRow[]): Classification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Respons model bukan JSON yang valid');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Respons model bukan objek JSON');
  }

  const p = parsed as Record<string, unknown>;

  const title = typeof p.title === 'string' ? p.title.trim() : '';
  if (!title) throw new Error('Field "title" kosong atau bukan string');

  const summary = typeof p.summary === 'string' ? p.summary.trim() : '';
  if (!summary) throw new Error('Field "summary" kosong atau bukan string');

  const assignedDinas = typeof p.assignedDinas === 'string' ? p.assignedDinas : '';
  const dinas = dinasList.find((d) => d.id === assignedDinas);
  if (!dinas) throw new Error(`Dinas "${assignedDinas}" tidak ada di katalog`);

  const category = typeof p.category === 'string' ? p.category : '';
  if (!dinas.categories.includes(category)) {
    throw new Error(`Kategori "${category}" tidak ditangani oleh dinas "${assignedDinas}"`);
  }

  const urgency = URGENCIES.includes(p.urgency as Urgency) ? (p.urgency as Urgency) : null;
  if (!urgency) throw new Error(`Urgensi "${String(p.urgency)}" tidak valid`);

  const rawConfidence = typeof p.confidence === 'number' ? p.confidence : NaN;
  if (Number.isNaN(rawConfidence)) throw new Error('Field "confidence" bukan angka');
  const confidence = Math.min(1, Math.max(0, rawConfidence));

  return { title, category, assignedDinas, urgency, summary, confidence };
}

/** Tenggat SLA = waktu klasifikasi + jam SLA dinas untuk urgensi terpilih. */
export function computeSlaDueAt(dinas: DinasRow, urgency: Urgency, from: Date = new Date()): Date {
  const hours = urgency === 'P0' ? dinas.slaHoursP0 : urgency === 'P1' ? dinas.slaHoursP1 : dinas.slaHoursP2;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}
