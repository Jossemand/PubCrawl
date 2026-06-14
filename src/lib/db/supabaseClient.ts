// Creates the Supabase client from public env vars, if they're set. When they
// aren't, `supabase` is null and the app falls back to localStorage — so the
// app keeps working with zero configuration.
//
// Set these in a .env file (see .env.example) or in your host's env settings:
//   PUBLIC_SUPABASE_URL
//   PUBLIC_SUPABASE_ANON_KEY

import { env } from '$env/dynamic/public';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = env.PUBLIC_SUPABASE_URL;
const key = env.PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(url && key);

export const supabase: SupabaseClient | null = supabaseConfigured
	? createClient(url as string, key as string, { auth: { persistSession: false } })
	: null;
