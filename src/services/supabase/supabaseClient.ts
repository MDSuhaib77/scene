/**
 * SceneOS — Supabase Client Initializer
 * 
 * Strict Security Rules:
 * - Uses only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * - NEVER imports service-role keys or AI secrets.
 * - Gracefully reports when credentials are not configured.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/database.types';
import { config } from '../../config/env';

let supabaseInstance: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (config.dataProvider !== 'supabase') {
    return null;
  }

  if (!supabaseInstance) {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      console.warn('[SceneOS] Cannot initialize Supabase: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing.');
      return null;
    }

    supabaseInstance = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseInstance;
}
