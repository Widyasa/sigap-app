// Rupiah disimpan sebagai BIGINT (satuan rupiah penuh, bukan sen) di seluruh
// skema (lihat budget_items.budget_allocated/budget_realized). Formatter ini
// satu-satunya tempat yang boleh menerjemahkannya ke tampilan "Rp 1.500.000.000".

export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}
