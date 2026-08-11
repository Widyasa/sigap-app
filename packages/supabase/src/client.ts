import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * getAccessToken dipanggil setiap kali supabase-js perlu token.
 * Implementasinya ada di apps/mobile/src/lib/session.ts dan bertugas
 * menyegarkan token yang hampir kedaluwarsa sebelum mengembalikannya.
 */
export function createSigapClient(
  url: string,
  anonKey: string,
  getAccessToken: () => Promise<string | null>,
) {
  return createClient<Database>(url, anonKey, {
    // `?? null` (bukan `?? ''`) penting: fetchWithAuth supabase-js hanya
    // jatuh balik ke apikey (anon key) sebagai Authorization saat callback
    // ini mengembalikan null/undefined — string kosong dianggap token valid
    // dan dikirim sebagai `Authorization: Bearer ` (rusak, 401 dari
    // PostgREST). Ini wajib benar agar panggilan tanpa sesi (mis. halaman
    // publik /verify/[code] yang memanggil RPC dengan grant EXECUTE anon)
    // benar-benar terautentikasi sebagai `anon`, bukan token kosong.
    accessToken: async () => await getAccessToken(),
    auth: {
      // Modul auth bawaan dimatikan total. SIGAP mengelola sesinya sendiri.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
