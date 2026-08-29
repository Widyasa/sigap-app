/**
 * Mengambil SELURUH baris sebuah query PostgREST, bukan hanya halaman
 * pertama.
 *
 * PostgREST memaksa `db-max-rows` (bawaan Supabase: 1000) pada setiap
 * `select()` tanpa `range`. Beberapa agregasi di paket ini menjumlahkan
 * hasil select di sisi klien — mis. total anggaran per dinas dan per bidang.
 * Begitu satu tahun anggaran melewati 1.000 item, jumlahnya diam-diam
 * terpotong: layar transparansi anggaran publik menampilkan sebagian dari
 * pagu sebenarnya, tanpa galat apa pun. Hal yang sama terjadi pada "beban
 * per kategori" setelah satu kelurahan melewati 1.000 aduan.
 *
 * Helper ini mengambil halaman berukuran `pageSize` sampai habis. Agregasi
 * di database (RPC) tetap lebih baik untuk volume besar, tapi ini menutup
 * kesalahan diam-diamnya tanpa mengubah bentuk kontrak query.
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  maxPages = 50,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
  return all;
}
