# Admin Dashboard

Dashboard Next.js untuk petugas: verifikator, staf dinas, kepala dinas, operator darurat, dan admin. Digunakan untuk mengelola aduan, aspirasi, layanan, anggaran, dan pengumuman.

## Language

**Verifikator**: Petugas kecamatan yang menyaring aduan masuk, memperbaiki klasifikasi AI, dan menolak aduan palsu.
_Avoid_: moderator.

**Dinas**: Satuan kerja pemerintah daerah yang menangani aduan sesuai kewenangannya.
_Avoid_: agency, department.

**Operator Piket**: Petugas yang memantau dan menanggapi panggilan darurat SOS.
_Avoid_: dispatcher.

**Antrean**: Daftar aduan yang masuk ke dinas atau verifikator, terurut prioritas dan SLA.
_Avoid_: queue.

**Mata Anggaran**: Alokasi dana APBD yang dapat ditautkan ke aspirasi yang lolos Musrenbang.
_Avoid_: budget item (kode), anggaran (terlalu umum).

**Musrenbang**: Forum perencanaan pembangunan tahunan yang menentukan prioritas aspirasi.
_Avoid_: musyawarah (terlalu umum).

**Rekap SLA**: Ringkasan kinerja penyelesaian aduan dinas terhadap batas waktu yang ditentukan.
_Avoid_: laporan SLA.
