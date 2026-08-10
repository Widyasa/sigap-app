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

INSERT INTO profiles (id, full_name, role, dinas_id, kelurahan, kecamatan) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Sri Wahyuni',  'citizen',            NULL,   'Sukamaju', 'Cibeunying'),
  ('22222222-2222-2222-2222-222222222222', 'Wulan Sari',   'verifier',           NULL,   'Sukamaju', 'Cibeunying'),
  ('33333333-3333-3333-3333-333333333333', 'Deni Kurnia',  'dinas_staff',        'pupr', 'Sukamaju', 'Cibeunying'),
  ('44444444-4444-4444-4444-444444444444', 'Operator Piket','emergency_operator', NULL,  'Sukamaju', 'Cibeunying'),
  ('55555555-5555-5555-5555-555555555555', 'Admin SIGAP',  'admin',              NULL,   'Sukamaju', 'Cibeunying')
ON CONFLICT (id) DO NOTHING;
