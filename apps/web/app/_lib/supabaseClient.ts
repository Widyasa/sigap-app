import { createSigapClient } from '@repo/supabase';
import { getAccessToken } from './session';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!url || !publishableKey) {
  console.warn('Supabase URL or publishable key is missing');
}

export const supabase = createSigapClient(url, publishableKey, getAccessToken);
