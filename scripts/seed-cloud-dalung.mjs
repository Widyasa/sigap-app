import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Manually load env variables from apps/native/.env.local
const envFile = fs.readFileSync('apps/native/.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length) {
    env[key.trim()] = value.join('=').trim();
  }
});

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SIGAP_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing environment variables. Check apps/native/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const users = [
  { id: 'dddddddd-0001-0001-0001-000000000001', email: 'warga.dalung1@sigap.test', email_verified_at: daysAgo(0) },
  { id: 'dddddddd-0002-0002-0002-000000000002', email: 'warga.dalung2@sigap.test', email_verified_at: daysAgo(0) },
  { id: 'dddddddd-0003-0003-0003-000000000003', email: 'warga.dalung3@sigap.test', email_verified_at: daysAgo(0) },
  { id: 'dddddddd-0004-0004-0004-000000000004', email: 'warga.dalung4@sigap.test', email_verified_at: daysAgo(0) },
  { id: 'dddddddd-0005-0005-0005-000000000005', email: 'petugas.dalung@sigap.test', email_verified_at: daysAgo(0) },
  { id: 'dddddddd-0006-0006-0006-000000000006', email: 'kepala.dalung@sigap.test', email_verified_at: daysAgo(0) }
];

const profiles = [
  { id: 'dddddddd-0001-0001-0001-000000000001', full_name: 'Ketut Suardana', role: 'citizen', dinas_id: null, kelurahan: 'Dalung', kecamatan: 'Kuta Utara', rw: 'RW 01' },
  { id: 'dddddddd-0002-0002-0002-000000000002', full_name: 'Made Wirata', role: 'citizen', dinas_id: null, kelurahan: 'Dalung', kecamatan: 'Kuta Utara', rw: 'RW 02' },
  { id: 'dddddddd-0003-0003-0003-000000000003', full_name: 'Nyoman Suartini', role: 'citizen', dinas_id: null, kelurahan: 'Dalung', kecamatan: 'Kuta Utara', rw: 'RW 03' },
  { id: 'dddddddd-0004-0004-0004-000000000004', full_name: 'Komang Wijaya', role: 'citizen', dinas_id: null, kelurahan: 'Dalung', kecamatan: 'Kuta Utara', rw: 'RW 04' },
  { id: 'dddddddd-0005-0005-0005-000000000005', full_name: 'I Wayan Susila', role: 'dinas_staff', dinas_id: 'pupr', kelurahan: 'Dalung', kecamatan: 'Kuta Utara', rw: 'RW 01' },
  { id: 'dddddddd-0006-0006-0006-000000000006', full_name: 'I Gusti Ngurah Rai', role: 'dinas_head', dinas_id: 'dishub', kelurahan: 'Dalung', kecamatan: 'Kuta Utara', rw: 'RW 02' }
];

const pointLedger = [
  { id: 100001, user_id: 'dddddddd-0001-0001-0001-000000000001', points: 20, reason: 'report_created', created_at: daysAgo(2) },
  { id: 100002, user_id: 'dddddddd-0001-0001-0001-000000000001', points: 50, reason: 'report_resolved', created_at: daysAgo(18) },
  { id: 100003, user_id: 'dddddddd-0002-0002-0002-000000000002', points: 15, reason: 'report_verified', created_at: daysAgo(5) },
  { id: 100004, user_id: 'dddddddd-0002-0002-0002-000000000002', points: 35, reason: 'aspiration_musrenbang', created_at: daysAgo(25) },
  { id: 100005, user_id: 'dddddddd-0003-0003-0003-000000000003', points: 10, reason: 'upvote_given', created_at: daysAgo(1) },
  { id: 100006, user_id: 'dddddddd-0003-0003-0003-000000000003', points: 25, reason: 'report_created', created_at: daysAgo(45) },
  { id: 100007, user_id: 'dddddddd-0004-0004-0004-000000000004', points: 40, reason: 'aspiration_musrenbang', created_at: daysAgo(3) },
  { id: 100008, user_id: '66666666-6666-6666-6666-666666666666', points: 30, reason: 'aspiration_musrenbang', created_at: daysAgo(20) },
  { id: 100009, user_id: '77777777-7777-7777-7777-777777777777', points: 55, reason: 'report_resolved', created_at: daysAgo(7) },
  { id: 100010, user_id: 'eeeeeeee-0001-0001-0001-000000000001', points: 20, reason: 'upvote_given', created_at: daysAgo(60) }
];

const complaints = [
  {
    id: 'dddddddd-0001-0001-0001-000000000101',
    user_id: 'dddddddd-0001-0001-0001-000000000001',
    title: 'Lampu Jalan Padang Galak Mati',
    description: 'Lampu penerangan jalan di Jalan Padang Galak padam sejak seminggu, rawan kecelakaan di malam hari.',
    category: 'penerangan_jalan',
    assigned_dinas: 'dishub',
    urgency: 'P1',
    location_lat: -8.7035,
    location_lng: 115.1745,
    location_address: 'Jl. Padang Galak',
    kelurahan: 'Dalung',
    kecamatan: 'Kuta Utara',
    status: 'verified'
  },
  {
    id: 'dddddddd-0001-0001-0001-000000000102',
    user_id: 'dddddddd-0002-0002-0002-000000000002',
    title: 'Sampah Menumpuk di Pasar Dalung',
    description: 'Tumpukan sampah di sekitar Pasar Dalung tidak diangkut selama tiga hari, menimbulkan bau dan lalat.',
    category: 'sampah',
    assigned_dinas: 'dlh',
    urgency: 'P0',
    location_lat: -8.7045,
    location_lng: 115.1755,
    location_address: 'Pasar Dalung',
    kelurahan: 'Dalung',
    kecamatan: 'Kuta Utara',
    status: 'pending'
  },
  {
    id: 'dddddddd-0001-0001-0001-000000000103',
    user_id: 'dddddddd-0003-0003-0003-000000000003',
    title: 'Jalan Raya Dalung Berlubang',
    description: 'Jalan Raya Dalung memiliki banyak lubang di sepanjang 200 meter, membahayakan pengendara.',
    category: 'jalan_rusak',
    assigned_dinas: 'pupr',
    urgency: 'P1',
    location_lat: -8.7040,
    location_lng: 115.1760,
    location_address: 'Jl. Raya Dalung',
    kelurahan: 'Dalung',
    kecamatan: 'Kuta Utara',
    status: 'in_progress'
  },
  {
    id: 'dddddddd-0001-0001-0001-000000000104',
    user_id: 'dddddddd-0004-0004-0004-000000000004',
    title: 'Drainase Tersumbat Jl. Pluit',
    description: 'Saluran drainase di Jalan Pluit tersumbat sampah sehingga air meluap saat hujan deras.',
    category: 'drainase',
    assigned_dinas: 'pupr',
    urgency: 'P0',
    location_lat: -8.7050,
    location_lng: 115.1750,
    location_address: 'Jl. Pluit',
    kelurahan: 'Dalung',
    kecamatan: 'Kuta Utara',
    status: 'pending'
  }
];

const aspirations = [
  {
    id: 'dddddddd-0002-0002-0002-000000000201',
    user_id: 'dddddddd-0001-0001-0001-000000000001',
    title: 'Trotoar Aman SDN Dalung',
    description: 'Pembangunan trotoar dan rambu penyeberangan di depan SDN Dalung agar siswa aman berjalan kaki.',
    kelurahan: 'Dalung',
    kecamatan: 'Kuta Utara',
    vote_count: 45,
    status: 'voting',
    estimated_beneficiaries: 300,
    estimated_cost: 120000000,
    location_lat: -8.7035,
    location_lng: 115.1760,
    voting_period_id: 'dddddddd-0000-0000-0000-000000000000',
    created_at: daysAgo(2)
  },
  {
    id: 'dddddddd-0002-0002-0002-000000000202',
    user_id: 'dddddddd-0002-0002-0002-000000000002',
    title: 'Penerangan Jalan Utama Dalung',
    description: 'Pemasangan lampu penerangan di sepanjang jalan utama Dalung agar lebih aman pada malam hari.',
    kelurahan: 'Dalung',
    kecamatan: 'Kuta Utara',
    vote_count: 78,
    status: 'voting',
    estimated_beneficiaries: 500,
    estimated_cost: 80000000,
    location_lat: -8.7045,
    location_lng: 115.1745,
    voting_period_id: 'dddddddd-0000-0000-0000-000000000000',
    created_at: daysAgo(4)
  },
  {
    id: 'dddddddd-0002-0002-0002-000000000203',
    user_id: 'dddddddd-0003-0003-0003-000000000003',
    title: 'Revitalisasi Taman Desa Adat Dalung',
    description: 'Perbaikan taman dan area bermain anak di Desa Adat Dalung untuk ruang publik yang lebih nyaman.',
    kelurahan: 'Dalung',
    kecamatan: 'Kuta Utara',
    vote_count: 12,
    status: 'musrenbang',
    estimated_beneficiaries: 200,
    estimated_cost: 95000000,
    location_lat: -8.7050,
    location_lng: 115.1755,
    voting_period_id: null,
    created_at: daysAgo(20)
  },
  {
    id: 'dddddddd-0002-0002-0002-000000000204',
    user_id: 'dddddddd-0004-0004-0004-000000000004',
    title: 'Pembangunan Drainase Jl. Tukad Balian',
    description: 'Pembangunan drainase baru di Jalan Tukad Balian untuk mengatasi genangan saat musim hujan.',
    kelurahan: 'Dalung',
    kecamatan: 'Kuta Utara',
    vote_count: 8,
    status: 'musrenbang',
    estimated_beneficiaries: 150,
    estimated_cost: 65000000,
    location_lat: -8.7040,
    location_lng: 115.1765,
    voting_period_id: null,
    created_at: daysAgo(35)
  }
];

async function upsertTable(table, rows) {
  const { data, error } = await supabase.from(table).upsert(rows, { onConflict: 'id' }).select();
  if (error) {
    console.error(`Error upserting ${table}:`, error.message);
    process.exit(1);
  }
  const count = Array.isArray(data) ? data.length : 0;
  console.log(`Seeded ${table}: ${count} rows`);
  return data;
}

async function seed() {
  console.log('Starting Dalung cloud seed...');
  await upsertTable('users', users);
  await upsertTable('profiles', profiles);
  await upsertTable('point_ledger', pointLedger);
  await upsertTable('complaints', complaints);
  await upsertTable('aspirations', aspirations);
  console.log('Dalung cloud seed completed.');
}

seed();
