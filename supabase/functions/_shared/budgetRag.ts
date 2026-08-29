/**
 * Logika murni untuk RAG anggaran (ask-budget): menyusun prompt dari item
 * anggaran yang cocok dan mem-validasi keluaran model. Tidak ada panggilan
 * jaringan di berkas ini — mudah diuji (lihat budgetRag.test.ts).
 *
 * Jaminan anti-fabrikasi (kriteria "RAG answers cite imported data only and
 * do not fabricate numbers"): prompt hanya berisi angka persis dari
 * `budget_items` yang benar-benar cocok, dan `parseBudgetRagResponse` menolak
 * setiap `citedItemIds` yang bukan bagian dari `validItemIds` alih-alih
 * meloloskannya diam-diam.
 */

export interface BudgetRagItem {
  id: string;
  programName: string;
  activityName: string | null;
  dinasId: string;
  budgetAllocated: number;
  budgetRealized: number;
  kelurahan: string | null;
  progressPercent: number;
}

/** Menyusun prompt RAG: daftar item anggaran verbatim + instruksi anti-fabrikasi. */
export function buildBudgetRagPrompt(question: string, items: BudgetRagItem[]): string {
  const daftar = items
    .map(
      (it) =>
        `- id: ${it.id}\n` +
        `  program: ${it.programName}\n` +
        `  kegiatan: ${it.activityName ?? '-'}\n` +
        `  dinas: ${it.dinasId}\n` +
        `  kelurahan: ${it.kelurahan ?? '-'}\n` +
        `  anggaran_dialokasikan: ${it.budgetAllocated}\n` +
        `  anggaran_terealisasi: ${it.budgetRealized}\n` +
        `  progres: ${it.progressPercent}%`,
    )
    .join('\n');

  return `Anda adalah asisten transparansi anggaran daerah untuk warga Indonesia.

Berikut data mata anggaran yang relevan dengan pertanyaan warga (SATU-SATUNYA sumber
data yang boleh Anda pakai):
${daftar}

Pertanyaan warga:
"""
${question}
"""

Aturan WAJIB:
1. Jawab HANYA berdasarkan data di atas. Jangan mengarang, memperkirakan, atau
   membulatkan angka apa pun — tulis persis seperti pada data (contoh:
   "anggaran_dialokasikan" ditulis persis, bukan dibulatkan ke "sekitar").
2. Jika pertanyaan tidak bisa dijawab dari data di atas, katakan dengan jujur
   bahwa Anda tidak memiliki informasinya — jangan menjawab dengan tebakan.
3. Sertakan HANYA id item anggaran yang benar-benar Anda gunakan untuk
   menjawab di "citedItemIds"; jangan menyertakan id yang tidak relevan atau
   tidak ada dalam daftar di atas.

Jawab HANYA dengan objek JSON, tanpa penjelasan tambahan, dengan bentuk persis:
{
  "answer": "jawaban dalam Bahasa Indonesia, jelas dan ringkas",
  "citedItemIds": ["id item anggaran yang dipakai untuk menjawab, boleh kosong"]
}`;
}

export interface BudgetRagResult {
  answer: string;
  citedItemIds: string[];
}

/**
 * Mem-parsing dan memvalidasi keluaran mentah model. Melempar Error yang
 * jelas bila bentuknya tidak sesuai kontrak. `citedItemIds` yang tidak ada di
 * `validItemIds` DIBUANG (bukan menggagalkan seluruh respons) karena itu
 * adalah tanda model berhalusinasi id — membiarkannya lolos akan menjadi
 * fabrikasi kutipan, jadi lebih aman menyaringnya daripada mempercayainya.
 */
export function parseBudgetRagResponse(raw: string, validItemIds: string[]): BudgetRagResult {
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

  const answer = typeof p.answer === 'string' ? p.answer.trim() : '';
  if (!answer) throw new Error('Field "answer" kosong atau bukan string');

  const rawCitedIds = Array.isArray(p.citedItemIds) ? p.citedItemIds : [];
  const validSet = new Set(validItemIds);
  const citedItemIds = rawCitedIds.filter(
    (id): id is string => typeof id === 'string' && validSet.has(id),
  );

  return { answer, citedItemIds };
}
