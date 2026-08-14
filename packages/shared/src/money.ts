// Rupiah disimpan sebagai BIGINT (satuan rupiah penuh, bukan sen) di seluruh
// skema (lihat budget_items.budget_allocated/budget_realized). Formatter ini
// satu-satunya tempat yang boleh menerjemahkannya ke tampilan "Rp 1.500.000.000".

export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

/**
 * Format ringkas ala "Rp 4,82 M" / "Rp 320 jt" untuk kartu ringkasan
 * (mis. layar Anggaran) di mana angka penuh terlalu panjang. Nilai di
 * bawah 1 juta jatuh balik ke `formatRupiah` penuh.
 */
export function formatCompactRupiah(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) {
    const value = (amount / 1_000_000_000).toFixed(2).replace('.', ',').replace(/,?0+$/, '');
    return `Rp ${value} M`;
  }
  if (abs >= 1_000_000) {
    const value = Math.round(amount / 1_000_000);
    return `Rp ${value.toLocaleString('id-ID')} jt`;
  }
  return formatRupiah(amount);
}
