import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Manually load env variables from apps/native/.env.local
const envFile = fs.readFileSync('apps/native/.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.join('=').trim();
    }
});

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SIGAP_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing environment variables. Check apps/native/.env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const announcements = [
  {
    id: 'cccccccc-0001-0001-0001-000000000001',
    title: 'Jadwal Vaksinasi Massal Kota Bandung',
    body: 'Dinas Kesehatan membuka layanan vaksinasi gratis di seluruh puskesmas mulai Senin depan.',
    category: 'kesehatan',
    dinas_id: 'dinkes',
    kelurahan: null,
    is_pinned: true,
    created_by: '55555555-5555-5555-5555-555555555555',
    published_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cccccccc-0001-0001-0001-000000000002',
    title: 'Perbaikan Drainase Jalan Merdeka Dimulai',
    body: 'Warga Kelurahan Sukamaju dimohon berhati-hati, pengerjaan drainase berlangsung dua minggu ke depan.',
    category: 'infrastruktur',
    dinas_id: 'pupr',
    kelurahan: 'Sukamaju',
    is_pinned: false,
    created_by: '55555555-5555-5555-5555-555555555555',
    published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cccccccc-0001-0001-0001-000000000003',
    title: 'Perbaikan Pipa PDAM, air mati di RW 04–06 hari ini',
    body: 'Aliran air dimatikan sementara karena perbaikan pipa utama. Tangki air disiagakan di balai warga.',
    category: 'darurat',
    dinas_id: 'pdam',
    kelurahan: 'Dago',
    is_pinned: true,
    created_by: '55555555-5555-5555-5555-555555555555',
    published_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cccccccc-0001-0001-0001-000000000004',
    title: 'Pengaspalan Jalan Bukit Pakar Timur mulai 18 Agustus',
    body: 'Jalan Bukit Pakar Timur akan dilakukan pengaspalan ulang. Mohon gunakan jalur alternatif.',
    category: 'infrastruktur',
    dinas_id: 'pupr',
    kelurahan: 'Sukamaju',
    is_pinned: false,
    created_by: '55555555-5555-5555-5555-555555555555',
    published_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cccccccc-0001-0001-0001-000000000005',
    title: 'Pelayanan surat tutup lebih awal pada 17 Agustus',
    body: 'Sehubungan dengan hari kemerdekaan, pelayanan administrasi surat di kelurahan tutup pukul 12.00.',
    category: 'layanan',
    dinas_id: 'lainnya',
    kelurahan: null,
    is_pinned: false,
    created_by: '55555555-5555-5555-5555-555555555555',
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cccccccc-0001-0001-0001-000000000006',
    title: 'Kerja bakti bersama dan lomba warga 16 Agustus',
    body: 'Mari meriahkan hari kemerdekaan dengan kerja bakti lingkungan dan berbagai lomba warga.',
    category: 'kegiatan',
    dinas_id: 'lainnya',
    kelurahan: 'Dago',
    is_pinned: true,
    created_by: '55555555-5555-5555-5555-555555555555',
    published_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'cccccccc-0001-0001-0001-000000000007',
    title: 'Posyandu balita RW 03 digeser ke Sabtu 16 Agustus',
    body: 'Jadwal Posyandu RW 03 diubah ke hari Sabtu karena bertepatan dengan hari libur nasional.',
    category: 'kesehatan',
    dinas_id: 'dinkes',
    kelurahan: 'Sukamaju',
    is_pinned: false,
    created_by: '55555555-5555-5555-5555-555555555555',
    published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }
];

async function seed() {
  console.log('Starting seed...');
  for (const item of announcements) {
    const { data, error } = await supabase
      .from('announcements')
      .upsert(item, { onConflict: 'id' });

    if (error) {
      console.error('Error inserting:', item.title, error);
    } else {
      console.log('Inserted:', item.title);
    }
  }
  console.log('Seed completed.');
}

seed();
