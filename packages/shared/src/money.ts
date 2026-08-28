// Rupiah disimpan sebagai BIGINT (satuan rupiah penuh, bukan sen) di seluruh
// skema (lihat budget_items.budget_allocated/budget_realized). Formatter ini
// satu-satunya tempat yang boleh menerjemahkannya ke tampilan "Rp 1.500.000.000".

export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

/** "1,50" -> "1,5"; "2,00" -> "2". Hanya membuang nol di belakang koma. */
function trimDecimalZeros(value: string): string {
  return value.includes(',') ? value.replace(/,?0+$/, '') : value;
}

/**
 * Format ringkas ala "Rp 4,82 M" / "Rp 320 jt" untuk kartu ringkasan
 * (mis. layar Anggaran) di mana angka penuh terlalu panjang. Nilai di
 * bawah 1 juta jatuh balik ke `formatRupiah` penuh.
 *
 * Pembulatan dilakukan SEBELUM memilih satuan: tanpa itu, 999.999.999
 * dibulatkan menjadi 1.000 juta dan tampil sebagai "Rp 1.000 jt" alih-alih
 * naik satu satuan menjadi "Rp 1 M".
 */
export function formatCompactRupiah(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  // Triliun: APBD kota/kabupaten sudah rutin menembus angka ini, dan tanpa
  // satuan sendiri nilainya tampil sebagai "Rp 1000 M".
  if (abs >= 1_000_000_000_000) {
    const value = trimDecimalZeros((abs / 1_000_000_000_000).toFixed(2).replace('.', ','));
    return `Rp ${sign}${value} T`;
  }
  if (abs >= 1_000_000_000) {
    const value = trimDecimalZeros((abs / 1_000_000_000).toFixed(2).replace('.', ','));
    // 999.999.999.999 membulat ke "1.000" milyar — naikkan ke triliun.
    if (value === '1.000' || value === '1000') return `Rp ${sign}1 T`;
    return `Rp ${sign}${value} M`;
  }
  if (abs >= 1_000_000) {
    const value = Math.round(abs / 1_000_000);
    if (value >= 1_000) return `Rp ${sign}${trimDecimalZeros((value / 1_000).toFixed(2).replace('.', ','))} M`;
    return `Rp ${sign}${value.toLocaleString('id-ID')} jt`;
  }
  return formatRupiah(amount);
}
