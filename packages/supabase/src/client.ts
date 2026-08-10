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
    accessToken: async () => (await getAccessToken()) ?? '',
    auth: {
      // Modul auth bawaan dimatikan total. SIGAP mengelola sesinya sendiri.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
