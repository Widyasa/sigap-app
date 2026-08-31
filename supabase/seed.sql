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

INSERT INTO profiles (id, full_name, role, dinas_id, kelurahan, kecamatan, rw) VALUES
  ('66666666-6666-6666-6666-666666666666', 'Agus Setiawan',  'citizen', NULL, 'Dago',        'Coblong',       'RW 01'),
  ('77777777-7777-7777-7777-777777777777', 'Rina Marlina',   'citizen', NULL, 'Sukagalih',   'Sukajadi',      'RW 03'),
  ('88888888-8888-8888-8888-888888888888', 'Hendra Gunawan', 'citizen', NULL, 'Citarum',     'Bandung Wetan', 'RW 02'),
  ('99999999-9999-9999-9999-999999999999', 'Siti Nurhaliza', 'citizen', NULL, 'Turangga',    'Lengkong',      'RW 05'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bayu Prasetyo',  'citizen', NULL, 'Pasirkaliki', 'Cicendo',       'RW 04')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Warga tambahan di Kelurahan Dago dengan RW berbeda-beda (issue leaderboard
-- warga) — dibutuhkan agar chip filter RW di /leaderboard punya lebih dari
-- satu pilihan yang berarti untuk kelurahan yang sama (lihat query contoh
-- `SELECT * FROM citizen_leaderboard WHERE kelurahan = 'Dago'`).
-- ---------------------------------------------------------------------
INSERT INTO users (id, email, email_verified_at) VALUES
  ('eeeeeeee-0001-0001-0001-000000000001', 'warga.dago2@sigap.test', NOW()),
  ('eeeeeeee-0001-0001-0001-000000000002', 'warga.dago3@sigap.test', NOW()),
  ('eeeeeeee-0001-0001-0001-000000000003', 'warga.dago4@sigap.test', NOW()),
  ('eeeeeeee-0001-0001-0001-000000000004', 'warga.dago5@sigap.test', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, full_name, role, dinas_id, kelurahan, kecamatan, rw) VALUES
  ('eeeeeeee-0001-0001-0001-000000000001', 'Dedi Kurniawan',   'citizen', NULL, 'Dago', 'Coblong', 'RW 02'),
  ('eeeeeeee-0001-0001-0001-000000000002', 'Yuli Astuti',      'citizen', NULL, 'Dago', 'Coblong', 'RW 03'),
  ('eeeeeeee-0001-0001-0001-000000000003', 'Fajar Ramadhan',   'citizen', NULL, 'Dago', 'Coblong', 'RW 01'),
  ('eeeeeeee-0001-0001-0001-000000000004', 'Nurul Hidayah',    'citizen', NULL, 'Dago', 'Coblong', 'RW 06')
ON CONFLICT (id) DO NOTHING;

-- Poin sintetis untuk warga Dago tambahan di atas, disebar ke jendela waktu
-- berbeda (baru/30 hari/lampau) agar filter "Minggu ini"/"Bulan ini"/
-- "Semua waktu" di /leaderboard menghasilkan urutan yang berbeda-beda.
INSERT INTO point_ledger (user_id, points, reason, created_at) VALUES
  ('66666666-6666-6666-6666-666666666666', 40, 'report_created', NOW() - INTERVAL '2 days'),
  ('66666666-6666-6666-6666-666666666666', 60, 'report_resolved', NOW() - INTERVAL '45 days'),
  ('eeeeeeee-0001-0001-0001-000000000001', 120, 'report_resolved', NOW() - INTERVAL '3 days'),
  ('eeeeeeee-0001-0001-0001-000000000001', 30, 'upvote_given', NOW() - INTERVAL '20 days'),
  ('eeeeeeee-0001-0001-0001-000000000002', 25, 'report_verified', NOW() - INTERVAL '10 days'),
  ('eeeeeeee-0001-0001-0001-000000000002', 80, 'aspiration_musrenbang', NOW() - INTERVAL '40 days'),
  ('eeeeeeee-0001-0001-0001-000000000003', 10, 'report_created', NOW() - INTERVAL '1 days'),
  ('eeeeeeee-0001-0001-0001-000000000004', 95, 'report_resolved', NOW() - INTERVAL '60 days');

-- Poin tambahan untuk warga lintas kelurahan agar filter waktu leaderboard
-- (minggu/bulan/semua waktu) menampilkan data aspiration_musrenbang yang bervariasi.
INSERT INTO point_ledger (user_id, points, reason, created_at) VALUES
  ('eeeeeeee-0001-0001-0001-000000000001', 35, 'aspiration_musrenbang', NOW() - INTERVAL '2 days'),
  ('77777777-7777-7777-7777-777777777777', 50, 'aspiration_musrenbang', NOW() - INTERVAL '15 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 45, 'aspiration_musrenbang', NOW() - INTERVAL '25 days'),
  ('88888888-8888-8888-8888-888888888888', 70, 'aspiration_musrenbang', NOW() - INTERVAL '40 days'),
  ('99999999-9999-9999-9999-999999999999', 60, 'aspiration_musrenbang', NOW() - INTERVAL '55 days');

INSERT INTO profiles (id, full_name, role, dinas_id, kelurahan, kecamatan, rw) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Sri Wahyuni',  'citizen',            NULL,   'Sukamaju', 'Cibeunying', 'RW 01'),
  ('22222222-2222-2222-2222-222222222222', 'Wulan Sari',   'verifier',           NULL,   'Sukamaju', 'Cibeunying', 'RW 01'),
  ('33333333-3333-3333-3333-333333333333', 'Deni Kurnia',  'dinas_staff',        'pupr', 'Sukamaju', 'Cibeunying', 'RW 01'),
  ('44444444-4444-4444-4444-444444444444', 'Operator Piket','emergency_operator', NULL,  'Sukamaju', 'Cibeunying', 'RW 01'),
  ('55555555-5555-5555-5555-555555555555', 'Admin SIGAP',  'admin',              NULL,   'Sukamaju', 'Cibeunying', 'RW 01')
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
  id, title, body, dinas_id, kelurahan, is_pinned, created_by, category
) VALUES
  ('cccccccc-0001-0001-0001-000000000001',
   'Jadwal Vaksinasi Massal Kota Bandung',
   'Dinas Kesehatan membuka layanan vaksinasi gratis di seluruh puskesmas mulai Senin depan.',
   'dinkes', NULL, TRUE, '55555555-5555-5555-5555-555555555555', 'kesehatan'),
  ('cccccccc-0001-0001-0001-000000000002',
   'Perbaikan Drainase Jalan Merdeka Dimulai',
   'Warga Kelurahan Sukamaju dimohon berhati-hati, pengerjaan drainase berlangsung dua minggu ke depan.',
   'pupr', 'Sukamaju', FALSE, '55555555-5555-5555-5555-555555555555', 'infrastruktur');

-- ---------------------------------------------------------------------
-- Data aspirasi & periode voting untuk demo.
-- ---------------------------------------------------------------------
INSERT INTO voting_periods (id, name, fiscal_year, starts_at, ends_at, is_active) VALUES
  ('dddddddd-0000-0000-0000-000000000000', 'Musrenbang 2027', 2027, NOW() - INTERVAL '1 DAY', NOW() + INTERVAL '14 DAYS', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO aspirations (
  id, user_id, title, description, kelurahan, kecamatan,
  vote_count, status, estimated_beneficiaries, estimated_cost,
  location_lat, location_lng, voting_period_id, created_at, linked_budget_item_id
) VALUES
  ('aaaaaaaa-0001-0001-0001-000000000001', '66666666-6666-6666-6666-666666666666', 'Trotoar sekolah SDN Dago 3', 'Perbaikan trotoar di depan SDN Dago 3 agar aman untuk siswa.', 'Dago', 'Coblong', 210, 'budgeted', 480, 500000000, -6.885, 107.615, NULL, '2026-01-01 00:00:00+07', 'bbbbbbbb-0001-0001-0001-000000000002'),
  ('aaaaaaaa-0001-0001-0001-000000000002', '66666666-6666-6666-6666-666666666666', 'Perbaikan drainase Gang Nangka RW 04', 'Normalisasi saluran air di Gang Nangka sering tersumbat saat hujan.', 'Dago', 'Coblong', 185, 'voting', 320, 150000000, -6.886, 107.616, 'dddddddd-0000-0000-0000-000000000000', NOW(), 'bbbbbbbb-0001-0001-0001-000000000001'),
  ('aaaaaaaa-0001-0001-0001-000000000003', '66666666-6666-6666-6666-666666666666', 'Taman bermain anak lapangan RW 07', 'Pembangunan taman bermain untuk anak-anak di RW 07.', 'Dago', 'Coblong', 150, 'musrenbang', 210, 320000000, -6.887, 107.617, NULL, NOW(), 'bbbbbbbb-0001-0001-0001-000000000005'),
  ('aaaaaaaa-0001-0001-0001-000000000004', '66666666-6666-6666-6666-666666666666', 'Normalisasi saluran Cikapayang', 'Normalisasi saluran air besar di area Cikapayang untuk mencegah banjir.', 'Cipaganti', 'Coblong', 187, 'musrenbang', 1200, 1400000000, -6.890, 107.610, NULL, NOW(), 'bbbbbbbb-0001-0001-0001-000000000001'),
  ('aaaaaaaa-0001-0001-0001-000000000005', '66666666-6666-6666-6666-666666666666', 'Penerangan jalan gang sempit', 'Pemasangan lampu LED di gang-gang sempit wilayah Lebakgede.', 'Lebakgede', 'Coblong', 120, 'realized', 100, 50000000, -6.889, 107.612, NULL, '2026-06-01 00:00:00+07', 'bbbbbbbb-0001-0001-0001-000000000006'),
  ('aaaaaaaa-0001-0001-0001-000000000006', '66666666-6666-6666-6666-666666666666', 'Perbaikan tembok penahan tanah', 'Memperkuat tembok penahan tanah di pinggir jalan RW 02.', 'Dago', 'Coblong', 110, 'approved', 50, 200000000, -6.888, 107.618, NULL, NOW(), NULL),
  ('aaaaaaaa-0001-0001-0001-000000000007', '66666666-6666-6666-6666-666666666666', 'Pembersihan sungai area RW 10', 'Kerja bakti pembersihan sungai rutin.', 'Dago', 'Coblong', 95, 'voting', 80, 30000000, -6.884, 107.614, 'dddddddd-0000-0000-0000-000000000000', NOW(), NULL),
  ('aaaaaaaa-0001-0001-0001-000000000008', '66666666-6666-6666-6666-666666666666', 'Perbaikan jalan setapak utama', 'Pengerasan jalan setapak utama di RW 05.', 'Dago', 'Coblong', 80, 'realized', 150, 100000000, -6.883, 107.613, NULL, '2026-07-01 00:00:00+07', NULL)
ON CONFLICT (id) DO NOTHING;
-- ---------------------------------------------------------------------
-- Tambahan data untuk demo native app di Kelurahan Dago, Kec. Coblong
-- ---------------------------------------------------------------------

-- 1. budget_items
INSERT INTO budget_items (
  id, fiscal_year, dinas_id, program_name, activity_name,
  budget_allocated, budget_realized, location_address, kelurahan, kecamatan,
  progress_percent, contractor
) VALUES
  ('dago-budget-001', 2026, 'pupr', 'Perbaikan Drainase Dago Atas', 'Normalisasi saluran air Jl. Ir. H. Djuanda', 500000000, 200000000, 'Jl. Ir. H. Djuanda', 'Dago', 'Coblong', 40, 'CV Dago Mandiri'),
  ('dago-budget-002', 2026, 'dlh', 'Penataan Taman Dago', 'Pengecatan dan penanaman pohon', 200000000, 200000000, 'Taman Dago', 'Dago', 'Coblong', 100, 'CV Hijau Lestari')
ON CONFLICT (id) DO NOTHING;

-- 2. complaints
INSERT INTO complaints (
  id, user_id, title, description, category, assigned_dinas, urgency,
  location_lat, location_lng, location_address, kelurahan, kecamatan, status
) VALUES
  ('dago-complaint-001', '66666666-6666-6666-6666-666666666666', 'Jalan Rusak di Dago', 'Ada lubang besar di tengah jalan.', 'jalan_rusak', 'pupr', 'P1', -6.885, 107.615, 'Jl. Ir. H. Djuanda', 'Dago', 'Coblong', 'pending'),
  ('dago-complaint-002', '66666666-6666-6666-6666-666666666666', 'Sampah Menumpuk', 'Sampah tidak diangkut sudah 3 hari.', 'sampah', 'dlh', 'P0', -6.886, 107.616, 'Jl. Dago Pojok', 'Dago', 'Coblong', 'in_progress')
ON CONFLICT (id) DO NOTHING;

-- Aduan demo di Kelurahan Dalung, Kec. Kuta Utara — penerangan jalan.
INSERT INTO complaints (
  id, user_id, title, description, category, assigned_dinas, urgency,
  location_lat, location_lng, location_address, kelurahan, kecamatan, status
) VALUES
  ('cccccccc-0003-0003-0003-000000000003', '66666666-6666-6666-6666-666666666666', 'Jalan Cempaka Gelap di Malam Hari', 'Penerangan jalan di Jalan Cempaka sangat minim sehingga rawan kecelakaan dan tindak kejahatan.', 'penerangan_jalan', 'dishub', 'P1', -8.704, 115.175, 'Jl. Cempaka', 'Dalung', 'Kuta Utara', 'pending')
ON CONFLICT (id) DO NOTHING;

-- 3. announcements
INSERT INTO announcements (
  id, title, body, dinas_id, kelurahan, is_pinned, created_by, category
) VALUES
  ('dago-announcement-001', 'Kerja Bakti Dago', 'Kerja bakti warga Dago akan diadakan hari Minggu.', 'lainnya', 'Dago', TRUE, '55555555-5555-5555-5555-555555555555', 'kegiatan'),
  ('dago-announcement-002', 'Perbaikan Lampu Jalan', 'Pemasangan lampu baru di sepanjang Dago.', 'dishub', 'Dago', FALSE, '55555555-5555-5555-5555-555555555555', 'infrastruktur')
ON CONFLICT (id) DO NOTHING;

-- 4. aspirations (menambah data)
INSERT INTO aspirations (
  id, user_id, title, description, kelurahan, kecamatan,
  vote_count, status, estimated_beneficiaries, estimated_cost,
  location_lat, location_lng, voting_period_id, created_at
) VALUES
  ('dago-aspiration-001', '66666666-6666-6666-6666-666666666666', 'Perbaikan Lapangan Olahraga Dago', 'Renovasi lapangan basket agar layak pakai.', 'Dago', 'Coblong', 50, 'voting', 100, 100000000, -6.885, 107.615, 'dddddddd-0000-0000-0000-000000000000', NOW()),
  ('dago-aspiration-002', '66666666-6666-6666-6666-666666666666', 'Pembangunan Pos Keamanan', 'Pembangunan pos keamanan di RW 01 Dago.', 'Dago', 'Coblong', 30, 'voting', 200, 50000000, -6.886, 107.616, 'dddddddd-0000-0000-0000-000000000000', NOW())
ON CONFLICT (id) DO NOTHING;

-- Tambahan aspirasi lintas kelurahan/kecamatan dengan status bervariasi.
INSERT INTO aspirations (
  id, user_id, title, description, kelurahan, kecamatan,
  vote_count, status, estimated_beneficiaries, estimated_cost,
  location_lat, location_lng, voting_period_id, created_at, linked_budget_item_id
) VALUES
  ('ffffffff-0001-0001-0001-000000000001', '77777777-7777-7777-7777-777777777777', 'Penerangan Jalan Sukagalih', 'Pemasangan lampu penerangan di jalur utama Sukagalih agar aman di malam hari.', 'Sukagalih', 'Sukajadi', 95, 'voting', 450, 75000000, -6.895, 107.595, 'dddddddd-0000-0000-0000-000000000000', NOW(), NULL),
  ('ffffffff-0002-0002-0002-000000000002', '88888888-8888-8888-8888-888888888888', 'Renovasi Taman Citarum', 'Perbaikan taman dan area bermain anak di Kelurahan Citarum.', 'Citarum', 'Bandung Wetan', 72, 'musrenbang', 300, 120000000, -6.902, 107.620, NULL, NOW() - INTERVAL '20 days', NULL),
  ('ffffffff-0003-0003-0003-000000000003', '99999999-9999-9999-9999-999999999999', 'Pembangunan Posyandu Turangga', 'Pembangunan posyandu baru untuk pelayanan kesehatan ibu dan anak.', 'Turangga', 'Lengkong', 130, 'budgeted', 800, 250000000, -6.931, 107.620, NULL, '2026-05-01 00:00:00+07', 'bbbbbbbb-0001-0001-0001-000000000008'),
    ('ffffffff-0004-0004-0004-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pembuatan Trotoar Pasirkaliki', 'Pembangunan trotoar pedestrian di sepanjang jalan utama Pasirkaliki.', 'Pasirkaliki', 'Cicendo', 210, 'realized', 1500, 450000000, -6.905, 107.590, NULL, '2026-06-15 00:00:00+07', 'bbbbbbbb-0001-0001-0001-000000000002')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Demo warga Kelurahan Dalung, Kec. Kuta Utara (aspirasi, aduan, leaderboard)
-- ---------------------------------------------------------------------

-- 1. pengguna & profil
INSERT INTO users (id, email, email_verified_at) VALUES
  ('dddddddd-0001-0001-0001-000000000001', 'warga.dalung1@sigap.test', NOW()),
  ('dddddddd-0002-0002-0002-000000000002', 'warga.dalung2@sigap.test', NOW()),
  ('dddddddd-0003-0003-0003-000000000003', 'warga.dalung3@sigap.test', NOW()),
  ('dddddddd-0004-0004-0004-000000000004', 'warga.dalung4@sigap.test', NOW()),
  ('dddddddd-0005-0005-0005-000000000005', 'petugas.dalung@sigap.test', NOW()),
  ('dddddddd-0006-0006-0006-000000000006', 'kepala.dalung@sigap.test', NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, full_name, role, dinas_id, kelurahan, kecamatan, rw) VALUES
  ('dddddddd-0001-0001-0001-000000000001', 'Ketut Suardana',  'citizen',     NULL,    'Dalung', 'Kuta Utara', 'RW 01'),
  ('dddddddd-0002-0002-0002-000000000002', 'Made Wirata',     'citizen',     NULL,    'Dalung', 'Kuta Utara', 'RW 02'),
  ('dddddddd-0003-0003-0003-000000000003', 'Nyoman Suartini', 'citizen',     NULL,    'Dalung', 'Kuta Utara', 'RW 03'),
  ('dddddddd-0004-0004-0004-000000000004', 'Komang Wijaya',   'citizen',     NULL,    'Dalung', 'Kuta Utara', 'RW 04'),
  ('dddddddd-0005-0005-0005-000000000005', 'I Wayan Susila',  'dinas_staff', 'pupr',  'Dalung', 'Kuta Utara', 'RW 01'),
  ('dddddddd-0006-0006-0006-000000000006', 'I Gusti Ngurah Rai', 'dinas_head', 'dishub', 'Dalung', 'Kuta Utara', 'RW 02')
ON CONFLICT (id) DO NOTHING;

-- 2. point_ledger (leaderboard: minggu/bulan/semua waktu)
INSERT INTO point_ledger (id, user_id, points, reason, created_at) VALUES
  (100001, 'dddddddd-0001-0001-0001-000000000001', 20,  'report_created',        NOW() - INTERVAL '2 days'),
  (100002, 'dddddddd-0001-0001-0001-000000000001', 50,  'report_resolved',       NOW() - INTERVAL '18 days'),
  (100003, 'dddddddd-0002-0002-0002-000000000002', 15,  'report_verified',       NOW() - INTERVAL '5 days'),
  (100004, 'dddddddd-0002-0002-0002-000000000002', 35,  'aspiration_musrenbang', NOW() - INTERVAL '25 days'),
  (100005, 'dddddddd-0003-0003-0003-000000000003', 10,  'upvote_given',          NOW() - INTERVAL '1 day'),
  (100006, 'dddddddd-0003-0003-0003-000000000003', 25,  'report_created',        NOW() - INTERVAL '45 days'),
  (100007, 'dddddddd-0004-0004-0004-000000000004', 40,  'aspiration_musrenbang', NOW() - INTERVAL '3 days'),
  (100008, '66666666-6666-6666-6666-666666666666', 30,  'aspiration_musrenbang', NOW() - INTERVAL '20 days'),
  (100009, '77777777-7777-7777-7777-777777777777', 55,  'report_resolved',       NOW() - INTERVAL '7 days'),
  (100010, 'eeeeeeee-0001-0001-0001-000000000001', 20,  'upvote_given',          NOW() - INTERVAL '60 days')
ON CONFLICT (id) DO NOTHING;

-- 3. aduan tambahan di Dalung
INSERT INTO complaints (
  id, user_id, title, description, category, assigned_dinas, urgency,
  location_lat, location_lng, location_address, kelurahan, kecamatan, status
) VALUES
  ('dddddddd-0001-0001-0001-000000000101', 'dddddddd-0001-0001-0001-000000000001', 'Lampu Jalan Padang Galak Mati', 'Lampu penerangan jalan di Jalan Padang Galak padam sejak seminggu, rawan kecelakaan di malam hari.', 'penerangan_jalan', 'dishub', 'P1', -8.7035, 115.1745, 'Jl. Padang Galak', 'Dalung', 'Kuta Utara', 'verified'),
  ('dddddddd-0001-0001-0001-000000000102', 'dddddddd-0002-0002-0002-000000000002', 'Sampah Menumpuk di Pasar Dalung', 'Tumpukan sampah di sekitar Pasar Dalung tidak diangkut selama tiga hari, menimbulkan bau dan lalat.', 'sampah', 'dlh', 'P0', -8.7045, 115.1755, 'Pasar Dalung', 'Dalung', 'Kuta Utara', 'pending'),
  ('dddddddd-0001-0001-0001-000000000103', 'dddddddd-0003-0003-0003-000000000003', 'Jalan Raya Dalung Berlubang', 'Jalan Raya Dalung memiliki banyak lubang di sepanjang 200 meter, membahayakan pengendara.', 'jalan_rusak', 'pupr', 'P1', -8.7040, 115.1760, 'Jl. Raya Dalung', 'Dalung', 'Kuta Utara', 'in_progress'),
  ('dddddddd-0001-0001-0001-000000000104', 'dddddddd-0004-0004-0004-000000000004', 'Drainase Tersumbat Jl. Pluit', 'Saluran drainase di Jalan Pluit tersumbat sampah sehingga air meluap saat hujan deras.', 'drainase', 'pupr', 'P0', -8.7050, 115.1750, 'Jl. Pluit', 'Dalung', 'Kuta Utara', 'pending')
ON CONFLICT (id) DO NOTHING;

-- 4. aspirasi Dalung (voting untuk tab Kelurahan, musrenbang untuk tab Musrenbang)
INSERT INTO aspirations (
  id, user_id, title, description, kelurahan, kecamatan,
  vote_count, status, estimated_beneficiaries, estimated_cost,
  location_lat, location_lng, voting_period_id, created_at
) VALUES
  ('dddddddd-0002-0002-0002-000000000201', 'dddddddd-0001-0001-0001-000000000001', 'Trotoar Aman SDN Dalung', 'Pembangunan trotoar dan rambu penyeberangan di depan SDN Dalung agar siswa aman berjalan kaki.', 'Dalung', 'Kuta Utara', 45, 'voting', 300, 120000000, -8.7035, 115.1760, 'dddddddd-0000-0000-0000-000000000000', NOW() - INTERVAL '2 days'),
  ('dddddddd-0002-0002-0002-000000000202', 'dddddddd-0002-0002-0002-000000000002', 'Penerangan Jalan Utama Dalung', 'Pemasangan lampu penerangan di sepanjang jalan utama Dalung agar lebih aman pada malam hari.', 'Dalung', 'Kuta Utara', 78, 'voting', 500, 80000000, -8.7045, 115.1745, 'dddddddd-0000-0000-0000-000000000000', NOW() - INTERVAL '4 days'),
  ('dddddddd-0002-0002-0002-000000000203', 'dddddddd-0003-0003-0003-000000000003', 'Revitalisasi Taman Desa Adat Dalung', 'Perbaikan taman dan area bermain anak di Desa Adat Dalung untuk ruang publik yang lebih nyaman.', 'Dalung', 'Kuta Utara', 12, 'musrenbang', 200, 95000000, -8.7050, 115.1755, NULL, NOW() - INTERVAL '20 days'),
  ('dddddddd-0002-0002-0002-000000000204', 'dddddddd-0004-0004-0004-000000000004', 'Pembangunan Drainase Jl. Tukad Balian', 'Pembangunan drainase baru di Jalan Tukad Balian untuk mengatasi genangan saat musim hujan.', 'Dalung', 'Kuta Utara', 8, 'musrenbang', 150, 65000000, -8.7040, 115.1765, NULL, NOW() - INTERVAL '35 days')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------
-- Akun petugas tambahan (diminta untuk demo/login dashboard).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_email   CITEXT := 'widyarusmananda15@gmail.com';
  v_name    TEXT   := 'Widyasa Rusmananda';
  v_user_id UUID;
BEGIN
  -- Pastikan baris users ada untuk email target.
  SELECT id INTO v_user_id FROM users WHERE email = v_email;

  IF NOT FOUND THEN
    v_user_id := gen_random_uuid();
    INSERT INTO users (id, email, email_verified_at)
    VALUES (v_user_id, v_email, NOW());
  END IF;

  -- Pastikan profilnya memiliki peran petugas (admin = akses penuh dashboard).
  INSERT INTO profiles (id, full_name, role)
  VALUES (v_user_id, v_name, 'admin')
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        full_name = EXCLUDED.full_name;
END $$;

-- ---------------------------------------------------------------------
-- Akun warga demo untuk uji login onboarding (profil belum lengkap).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_email   CITEXT := 'strider.jaxston@forliion.com';
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE email = v_email;

  IF NOT FOUND THEN
    v_user_id := 'b0000000-0000-0000-0000-000000000001';
    INSERT INTO users (id, email, email_verified_at)
    VALUES (v_user_id, v_email, NOW());
  END IF;

  INSERT INTO profiles (id, full_name, role)
  VALUES (v_user_id, 'Warga', 'citizen')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ---------------------------------------------------------------------
-- Akun warga demo untuk uji login onboarding (profil belum lengkap).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_email   CITEXT := 'iperkins95800@radiant-flow.org';
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE email = v_email;

  IF NOT FOUND THEN
    v_user_id := 'b0000000-0000-0000-0000-000000000002';
    INSERT INTO users (id, email, email_verified_at)
    VALUES (v_user_id, v_email, NOW());
  END IF;

  INSERT INTO profiles (id, full_name, role)
  VALUES (v_user_id, 'Warga', 'citizen')
  ON CONFLICT (id) DO NOTHING;
END $$;
