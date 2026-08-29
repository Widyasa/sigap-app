# Shared Design & Schemas

Package untuk token desain, skema validasi, konstanta domain, dan tipe yang dipakai seluruh aplikasi. Tempat tunggal untuk warna, tipografi, spacing, daftar dinas/kategori, skema Zod, dan tipe lintas context.

## Language

**Token Warna**: Pasangan nilai warna untuk mode terang dan gelap; semua warna di aplikasi harus berasal dari token ini.
_Avoid_: hex literal langsung, warna hard-coded.

**Urgensi**: Tingkat kepentingan aduan — P0 Darurat, P1 Penting, P2 Normal.
_Avoid_: prioritas (lebih luas).

**Status Aduan**: Tahapan hidup aduan, misalnya `pending_classification`, `verified`, `in_progress`, `resolved`.
_Avoid_: tahap (terlalu umum).

**SLA**: Batas waktu penanganan aduan sesuai urgensi dan dinas.
_Avoid_: deadline (kurang tepat).

**Poin**: Satuan gamifikasi yang dicatat sebagai ledger; tidak boleh dijumlahkan langsung di tabel profil.
_Avoid_: skor, total poin.

**Ledger Poin**: Tabel `point_ledger` yang mencatat setiap perubahan poin agar dapat diaudit dan dibatalkan.
_Avoid_: saldo poin.
