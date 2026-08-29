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
const SUPABASE_PUBLISHABLE_KEY = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.error('Missing environment variables. Check apps/native/.env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function checkAndAttemptModify() {
    console.log('--- Fetching Existing Data ---');
    
    const { data: vpData, error: vpError } = await supabase.from('voting_periods').select('*');
    if (vpError) console.error('Error fetching voting_periods:', vpError);
    else console.log('Existing voting_periods:', vpData);

    const { data: aspData, error: aspError } = await supabase.from('aspirations').select('*').limit(5);
    if (aspError) console.error('Error fetching aspirations:', aspError);
    else console.log('First 5 existing aspirations:', aspData);

    console.log('\n--- Attempting Modification (Should fail due to RLS) ---');

    const { error: insError } = await supabase
        .from('voting_periods')
        .insert({
            id: 'dddddddd-0000-0000-0000-000000000000',
            name: 'Musrenbang 2027',
            fiscal_year: 2027,
            starts_at: new Date().toISOString(),
            ends_at: new Date().toISOString(),
            is_active: true
        });

    if (insError) {
        console.log('Modification failed as expected (RLS active):', insError.message);
    } else {
        console.log('Modification succeeded (unexpected, check RLS!).');
    }
}

checkAndAttemptModify();
