// Pengelompokan riwayat poin (issue #13, kriteria "Point ledger entries can
// be audited and reversed for false reports"). `report_false` (-35) TIDAK
// pernah mengubah/menghapus baris `report_created` (+10) asal — ia hanya
// menambah baris baru dengan `refTable`/`refId` yang sama (lihat
// supabase/migrations/20260811000005_points.sql). Fungsi murni ini
// mengelompokkan baris-baris tersebut supaya UI bisa menampilkan penghargaan
// asli berdampingan dengan pembatalannya, alih-alih daftar angka datar yang
// tidak jelas maknanya.

export interface PointLedgerEntryLike {
  id: number | string;
  points: number;
  reason: string;
  refTable: string | null;
  refId: string | null;
  createdAt: string;
}

export interface PointLedgerGroup<T extends PointLedgerEntryLike> {
  /** `refTable:refId`, atau `entry:<id>` untuk baris tanpa referensi (mis. upvote). */
  key: string;
  entries: T[];
  /** Jumlah poin gabungan seluruh baris di grup ini — nilai bersih setelah pembatalan. */
  netPoints: number;
  /** true jika grup berisi lebih dari satu baris (mis. report_created + report_false). */
  hasReversal: boolean;
}

/**
 * Mengelompokkan entri berdasarkan (refTable, refId), terbaru dulu di dalam
 * grup dan grup diurutkan berdasarkan entri terbarunya. Entri tanpa
 * referensi (refId null, mis. upvote_given) masing-masing jadi grup sendiri.
 */
export function groupPointLedgerByRef<T extends PointLedgerEntryLike>(
  entries: T[],
): PointLedgerGroup<T>[] {
  const byKey = new Map<string, T[]>();

  for (const entry of entries) {
    const key = entry.refTable && entry.refId
      ? `${entry.refTable}:${entry.refId}`
      : `entry:${entry.id}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(entry);
    else byKey.set(key, [entry]);
  }

  const groups: PointLedgerGroup<T>[] = Array.from(byKey.entries()).map(([key, groupEntries]) => {
    const sorted = [...groupEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return {
      key,
      entries: sorted,
      netPoints: sorted.reduce((sum, e) => sum + e.points, 0),
      // `sorted.length > 1` salah: `report_created`, `report_verified`, dan
      // `report_resolved` semuanya memakai refTable/refId yang sama, jadi
      // aduan yang berjalan normal pun ditandai "ada pembatalan". Pembatalan
      // yang sesungguhnya adalah baris BERNILAI NEGATIF (mis. report_false).
      hasReversal: sorted.some((e) => e.points < 0),
    };
  });

  groups.sort(
    (a, b) => new Date(b.entries[0]!.createdAt).getTime() - new Date(a.entries[0]!.createdAt).getTime(),
  );
  return groups;
}
