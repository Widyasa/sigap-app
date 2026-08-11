INSERT INTO dinas (id, name, categories, sla_hours_p0, sla_hours_p1, sla_hours_p2) VALUES
  ('pupr',     'Dinas Pekerjaan Umum & Penataan Ruang',
   ARRAY['jalan_rusak','jembatan','drainase','trotoar'],           24, 72, 168),
  ('dlh',      'Dinas Lingkungan Hidup',
   ARRAY['sampah','pencemaran','pohon_tumbang','taman_kota'],      12, 48, 168),
  ('dishub',   'Dinas Perhubungan',
   ARRAY['lampu_lalu_lintas','rambu','parkir_liar','angkutan_umum'],12, 48, 168),
  ('dinkes',   'Dinas Kesehatan',
   ARRAY['fasilitas_kesehatan','wabah_penyakit','sanitasi'],        6, 24, 120),
  ('disdik',   'Dinas Pendidikan',
   ARRAY['fasilitas_sekolah','layanan_pendidikan'],                24, 72, 168),
  ('satpolpp', 'Satuan Polisi Pamong Praja',
   ARRAY['ketertiban_umum','pkl_liar','reklame_liar'],              6, 24, 120),
  ('pdam',     'Perusahaan Daerah Air Minum',
   ARRAY['air_bersih','pipa_bocor'],                               12, 48, 168),
  ('lainnya',  'Belum Terklasifikasi',
   ARRAY['lainnya'],                                               24, 72, 168)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Pengguna demo. Hanya untuk lingkungan lokal.
-- Karena SIGAP tidak memakai Supabase Auth, seed dapat membuat pengguna
-- secara langsung — tidak perlu memanggil API auth apa pun.
-- ---------------------------------------------------------------------
INSERT INTO users (id, email, email_verified_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'warga@sigap.test',    NOW()),
  ('22222222-2222-2222-2222-222222222222', 'verifier@sigap.test', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'pupr@sigap.test',     NOW()),
  ('44444444-4444-4444-4444-444444444444', 'operator@sigap.test', NOW()),
  ('55555555-5555-5555-5555-555555555555', 'admin@sigap.test',    NOW())
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------
-- Dummy warga lintas kelurahan/kecamatan (data nyata wilayah Kota Bandung).
-- Tidak ada tabel katalog kelurahan/kecamatan terpisah — onboarding.tsx
-- menyimpannya sebagai teks bebas di profiles, jadi data ini hanya untuk
-- variasi uji coba (leaderboard, deteksi duplikat lintas wilayah, dll).
-- ---------------------------------------------------------------------
INSERT INTO users (id, email, email_verified_at) VALUES
  ('66666666-6666-6666-6666-666666666666', 'warga.dago@sigap.test',     NOW()),
  ('77777777-7777-7777-7777-777777777777', 'warga.sukagalih@sigap.test', NOW()),
  ('88888888-8888-8888-8888-888888888888', 'warga.citarum@sigap.test',  NOW()),
  ('99999999-9999-9999-9999-999999999999', 'warga.turangga@sigap.test', NOW()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'warga.pasirkaliki@sigap.test', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, full_name, role, dinas_id, kelurahan, kecamatan) VALUES
  ('66666666-6666-6666-6666-666666666666', 'Agus Setiawan',  'citizen', NULL, 'Dago',        'Coblong'),
  ('77777777-7777-7777-7777-777777777777', 'Rina Marlina',   'citizen', NULL, 'Sukagalih',   'Sukajadi'),
  ('88888888-8888-8888-8888-888888888888', 'Hendra Gunawan', 'citizen', NULL, 'Citarum',     'Bandung Wetan'),
  ('99999999-9999-9999-9999-999999999999', 'Siti Nurhaliza', 'citizen', NULL, 'Turangga',    'Lengkong'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bayu Prasetyo',  'citizen', NULL, 'Pasirkaliki', 'Cicendo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, full_name, role, dinas_id, kelurahan, kecamatan) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Sri Wahyuni',  'citizen',            NULL,   'Sukamaju', 'Cibeunying'),
  ('22222222-2222-2222-2222-222222222222', 'Wulan Sari',   'verifier',           NULL,   'Sukamaju', 'Cibeunying'),
  ('33333333-3333-3333-3333-333333333333', 'Deni Kurnia',  'dinas_staff',        'pupr', 'Sukamaju', 'Cibeunying'),
  ('44444444-4444-4444-4444-444444444444', 'Operator Piket','emergency_operator', NULL,  'Sukamaju', 'Cibeunying'),
  ('55555555-5555-5555-5555-555555555555', 'Admin SIGAP',  'admin',              NULL,   'Sukamaju', 'Cibeunying')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Item anggaran contoh (M3 Anggaran) — dibutuhkan agar dropdown "tautkan
-- item anggaran" di dashboard admin (/aspirasi) punya data untuk diuji,
-- dan agar jejak dampak aspirasi -> realisasi anggaran (issue #9) bisa
-- didemokan tanpa harus mengisi form anggaran manual dulu.
-- ---------------------------------------------------------------------
INSERT INTO budget_items (
  id, fiscal_year, dinas_id, program_name, activity_name,
  budget_allocated, budget_realized, location_address, kelurahan, kecamatan,
  progress_percent, contractor
) VALUES
  ('bbbbbbbb-0001-0001-0001-000000000001', 2026, 'pupr',
   'Perbaikan Drainase Jalan Merdeka', 'Normalisasi saluran air',
   1500000000, 900000000, 'Jl. Merdeka, Kel. Sukamaju', 'Sukamaju', 'Cibeunying',
   60, 'CV Bangun Jaya'),
  ('bbbbbbbb-0001-0001-0001-000000000002', 2026, 'pupr',
   'Pembangunan Trotoar Kelurahan Sukamaju', 'Pelebaran trotoar dan penerangan jalan',
   800000000, 0, 'Jl. Sukamaju Raya', 'Sukamaju', 'Cibeunying',
   0, NULL),
  ('bbbbbbbb-0001-0001-0001-000000000003', 2026, 'pupr',
   'Pembangunan Jembatan Penghubung Cibeunying-Coblong', 'Konstruksi jembatan beton bertulang',
   12500000000, 9375000000, 'Jl. Cihampelas, Kel. Cipaganti', 'Cipaganti', 'Coblong',
   75, 'PT Konstruksi Beton Indah'),
  ('bbbbbbbb-0001-0001-0001-000000000004', 2026, 'dlh',
   'Pengelolaan Sampah Terpadu Kecamatan Coblong', 'Pengadaan TPS 3R dan armada pengangkut',
   2300000000, 1800000000, 'Jl. Ir. H. Djuanda, Kel. Dago', 'Dago', 'Coblong',
   78, 'CV Hijau Lestari'),
  ('bbbbbbbb-0001-0001-0001-000000000005', 2026, 'dlh',
   'Penataan Taman Kota Tegalega', 'Revitalisasi taman dan ruang terbuka hijau',
   4500000000, 4500000000, 'Taman Tegalega, Kel. Ciateul', 'Ciateul', 'Regol',
   100, 'PT Taman Asri'),
  ('bbbbbbbb-0001-0001-0001-000000000006', 2026, 'dishub',
   'Pemasangan Lampu Lalu Lintas Simpang Pasteur', 'Instalasi APILL dan CCTV lalu lintas',
   1200000000, 600000000, 'Jl. Dr. Djunjunan, Kel. Pasteur', 'Pasteur', 'Cicendo',
   50, 'CV Sinyal Utama'),
  ('bbbbbbbb-0001-0001-0001-000000000007', 2026, 'dishub',
   'Pengadaan Rambu Lalu Lintas Kota Bandung', 'Pemasangan rambu di titik rawan kecelakaan',
   950000000, 950000000, 'Jl. Soekarno Hatta, Kel. Sukapura', 'Sukapura', 'Kiaracondong',
   100, 'CV Rambu Nusantara'),
  ('bbbbbbbb-0001-0001-0001-000000000008', 2026, 'dinkes',
   'Renovasi Puskesmas Ciumbuleuit', 'Perluasan ruang rawat inap dan IGD',
   6800000000, 3400000000, 'Jl. Ciumbuleuit, Kel. Ciumbuleuit', 'Ciumbuleuit', 'Cidadap',
   50, 'PT Karya Medika'),
  ('bbbbbbbb-0001-0001-0001-000000000009', 2026, 'dinkes',
   'Program Sanitasi Berbasis Masyarakat Antapani', 'Pembangunan MCK komunal',
   1750000000, 1050000000, 'Kel. Antapani Kidul', 'Antapani Kidul', 'Antapani',
   60, 'CV Sehat Sentosa'),
  ('bbbbbbbb-0001-0001-0001-000000000010', 2026, 'disdik',
   'Rehabilitasi Gedung SDN Sukaluyu', 'Perbaikan atap dan ruang kelas',
   3200000000, 2880000000, 'Jl. Sukaluyu, Kel. Sukaluyu', 'Sukaluyu', 'Cibeunying Kaler',
   90, 'PT Bangun Cendekia'),
  ('bbbbbbbb-0001-0001-0001-000000000011', 2026, 'disdik',
   'Bantuan Operasional Sekolah Tambahan Kecamatan Batununggal', 'Penyaluran dana BOS tambahan',
   5000000000, 5000000000, 'Kecamatan Batununggal', NULL, 'Batununggal',
   100, NULL),
  ('bbbbbbbb-0001-0001-0001-000000000012', 2026, 'satpolpp',
   'Penertiban PKL Kawasan Alun-Alun', 'Relokasi pedagang ke sentra PKL',
   650000000, 400000000, 'Alun-alun Bandung, Kel. Balonggede', 'Balonggede', 'Regol',
   65, 'CV Tertib Kota'),
  ('bbbbbbbb-0001-0001-0001-000000000013', 2026, 'pdam',
   'Perbaikan Pipa Distribusi Air Bersih Antapani', 'Penggantian pipa distribusi bocor',
   2100000000, 1050000000, 'Jl. Terusan Jakarta, Kel. Antapani Wetan', 'Antapani Wetan', 'Antapani',
   50, 'PT Tirta Wening'),
  ('bbbbbbbb-0001-0001-0001-000000000014', 2026, 'pdam',
   'Pembangunan Sumur Bor Kecamatan Gedebage', 'Sumur bor baru untuk suplai air bersih',
   3900000000, 0, 'Kecamatan Gedebage', NULL, 'Gedebage',
   5, 'CV Sumber Air Jaya'),
  ('bbbbbbbb-0001-0001-0001-000000000015', 2026, 'lainnya',
   'Dana Cadangan Kontingensi Bencana', 'Cadangan tanggap darurat lintas dinas',
   500000000, 120000000, 'Balai Kota Bandung', NULL, NULL,
   24, NULL)
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------
-- Pengumuman contoh (M6 Info & Komunitas, issue #13) — satu untuk seluruh
-- warga (kelurahan NULL) dan satu untuk kelurahan tertentu, agar targeting
-- "semua warga vs kelurahan tertentu" bisa langsung didemokan tanpa perlu
-- mengisi form admin dulu.
-- ---------------------------------------------------------------------
INSERT INTO announcements (
  id, title, body, dinas_id, kelurahan, is_pinned, created_by
) VALUES
  ('cccccccc-0001-0001-0001-000000000001',
   'Jadwal Vaksinasi Massal Kota Bandung',
   'Dinas Kesehatan membuka layanan vaksinasi gratis di seluruh puskesmas mulai Senin depan.',
   'dinkes', NULL, TRUE, '55555555-5555-5555-5555-555555555555'),
  ('cccccccc-0001-0001-0001-000000000002',
   'Perbaikan Drainase Jalan Merdeka Dimulai',
   'Warga Kelurahan Sukamaju dimohon berhati-hati, pengerjaan drainase berlangsung dua minggu ke depan.',
   'pupr', 'Sukamaju', FALSE, '55555555-5555-5555-5555-555555555555')
ON CONFLICT (id) DO NOTHING;