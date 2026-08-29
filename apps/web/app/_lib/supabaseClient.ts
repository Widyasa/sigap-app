import { createSigapClient } from '@repo/supabase';
import { getAccessToken } from './session';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!url || !publishableKey) {
  console.warn(
    'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diisi — ' +
      'setiap permintaan data akan gagal. Salin apps/web/.env.local.example ke .env.local.',
  );
}

// `createClient` melempar `supabaseUrl is required` kalau URL kosong, dan
// karena klien ini dibuat saat modul dimuat, lemparan itu menggagalkan
// SELURUH `next build` di tahap prerender (termasuk halaman statis seperti
// /_not-found) di lingkungan tanpa .env — bukan hanya halaman yang benar-benar
// memakai Supabase. Placeholder di bawah menjaga build tetap jalan; permintaan
// runtime tetap gagal dengan jelas dan sudah didahului peringatan di atas.
const PLACEHOLDER_URL = 'https://supabase-url-belum-diisi.invalid';

export const supabase = createSigapClient(
  url || PLACEHOLDER_URL,
  publishableKey || 'publishable-key-belum-diisi',
  getAccessToken,
);
