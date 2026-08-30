import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SIGAP_JWT_SECRET = process.env.SIGAP_JWT_SECRET;

function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function signAccessToken(userId) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { sub: userId, role: 'authenticated', aud: 'authenticated', iat: nowSeconds - 3600, exp: nowSeconds + 3600 };
  const signingInput = `${base64UrlEncode(Buffer.from(JSON.stringify(header)))}.${base64UrlEncode(Buffer.from(JSON.stringify(payload)))}`;
  const signature = createHmac('sha256', SIGAP_JWT_SECRET).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: user, error: uerr } = await supabase.from('users').select('id').ilike('email', 'admin@sigap.test').single();
if (!user) { console.error('user not found', uerr); process.exit(1); }
const token = signAccessToken(user.id);
const payload = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - token.split('.')[1].length % 4) % 4), 'base64').toString());
console.log('payload', payload);

const client = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  accessToken: async () => token,
});
const { data, error } = await client.from('profiles').select('role').eq('id', user.id).single();
console.log('profile', data, 'error', error);
