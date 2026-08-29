/**
 * Cermin `packages/ai/src/prompts.ts` — murni penyusun string, tidak
 * memanggil klien AI mana pun. Edge Function tidak dapat mengimpor paket
 * npm workspace, jadi berkas ini disalin manual; jaga keduanya identik.
 */
import type { DinasRow } from './classification.ts';

/** Prompt klasifikasi aduan (classify-report). */
export function buildClassificationPrompt(
  description: string,
  dinasList: DinasRow[],
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
