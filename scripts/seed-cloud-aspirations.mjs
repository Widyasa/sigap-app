import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
const SUPABASE_PUBLISHABLE_KEY = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing environment variables. Check apps/native/.env.local');
    process.exit(1);
}

// Client for testing
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function test() {
    console.log('Testing connection with publishable key...');
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    if (error) {
        console.error('Test error:', error);
    } else {
        console.log('Test successful, data:', data);
    }
}

test();
