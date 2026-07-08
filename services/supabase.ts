import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO SUPABASE ---
// Substitua pelas credenciais do seu projeto Supabase (Settings → API)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase URL ou Anon Key não configurados. ' +
    'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
