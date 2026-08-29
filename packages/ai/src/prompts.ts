/**
 * Template prompt AI (PRD v2.0 Bagian 7.4).
 * Cermin `supabase/functions/_shared/prompts.ts` — murni penyusun string,
 * tidak memanggil klien AI mana pun.
 */
import type { BudgetItem, DinasSummary, DraftResponseInput } from './types';

/** Prompt klasifikasi aduan (classify-report). */
export function buildClassificationPrompt(
  description: string,
  dinasList: DinasSummary[],
): string {
  const katalog = dinasList
    .map((d) => `- ${d.id} (${d.name}) menangani: ${d.categories.join(', ')}`)
    .join('\n');

  return `Anda adalah petugas triase aduan masyarakat di pemerintah daerah Indonesia.

Katalog dinas dan kategori yang tersedia:
${katalog}

Aturan tingkat urgensi:
- P0: ada ancaman nyawa, kebakaran, banjir aktif, bangunan roboh, wabah,
      atau kabel listrik putus.
- P1: berpotensi mencederai orang atau mengganggu layanan penting dalam waktu dekat.
- P2: mengganggu kenyamanan tetapi tidak membahayakan.

Aduan warga:
"""
${description}
"""

Jawab HANYA dengan objek JSON, tanpa penjelasan tambahan, dengan bentuk persis:
{
  "title": "judul ringkas maksimal 12 kata",
  "category": "salah satu kategori dari katalog di atas",
  "assignedDinas": "salah satu id dinas dari katalog di atas",
  "urgency": "P0 atau P1 atau P2",
  "summary": "ringkasan satu sampai dua kalimat untuk petugas",
  "confidence": 0.0 sampai 1.0
}

Jika aduan tidak jelas atau tidak cocok dengan kategori mana pun, gunakan
assignedDinas "lainnya", category "lainnya", dan confidence di bawah 0.5.`;
}

/** Prompt draf jawaban dinas (draft-response). */
export function buildDraftResponsePrompt(input: DraftResponseInput): string {
  return `Anda menulis jawaban resmi ${input.dinasName} kepada warga pelapor.

Aduan: ${input.title}
Isi: ${input.description}
Status saat ini: ${input.status}
Catatan penanganan: ${input.timelineNotes.join(' | ') || 'belum ada'}

Tulis jawaban dalam bahasa Indonesia yang sopan tetapi tidak birokratis.
Aturan:
- Maksimal 4 kalimat.
- Sebut tindakan konkret yang sudah atau akan dilakukan.
- Jangan berjanji tanggal yang tidak ada di catatan penanganan.
- Jangan memakai kata: disposisi, dimaksud, adapun, sehubungan dengan.

Jawab HANYA dengan objek JSON: { "draft": "isi jawaban" }`;
}

/** Prompt RAG anggaran (ask-budget). */
export function buildBudgetAnswerPrompt(
  question: string,
  items: BudgetItem[],
): string {
  const konteks = items
    .map(
      (b, i) =>
        `[${i + 1}] ${b.program_name}${b.activity_name ? ' — ' + b.activity_name : ''}
     Dinas: ${b.dinas_id} | Lokasi: ${b.kelurahan ?? 'seluruh wilayah'}
     Pagu: Rp ${b.budget_allocated.toLocaleString('id-ID')}
     Realisasi: Rp ${b.budget_realized.toLocaleString('id-ID')} (${b.progress_percent}%)`,
    )
    .join('\n\n');

  return `Anda menjawab pertanyaan warga tentang APBD berdasarkan data resmi berikut.

DATA ANGGARAN:
${konteks}

PERTANYAAN WARGA: ${question}

Aturan menjawab:
- Jawab HANYA berdasarkan data di atas. Jangan mengarang angka.
- Bila data tidak memuat jawabannya, katakan terus terang bahwa datanya
  tidak tersedia dan sarankan warga menghubungi dinas terkait.
- Sebutkan angka rupiah lengkap dengan pemisah ribuan.
- Rujuk sumber dengan nomor dalam kurung siku, contoh: [1].
- Maksimal 5 kalimat.

Jawab HANYA dengan objek JSON:
{ "answer": "jawaban Anda", "sourceIndexes": [1, 2] }`;
}
