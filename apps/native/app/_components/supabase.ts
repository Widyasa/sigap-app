import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { createSigapClient } from '@repo/supabase';
import { getAccessToken } from './session';

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ??
  '';
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  (Constants.expoConfig?.extra?.supabasePublishableKey as string | undefined) ??
  '';

if (!url || !publishableKey) {
  console.warn('Supabase URL or publishable key is missing');
}

export const supabase = createSigapClient(url, publishableKey, getAccessToken);
