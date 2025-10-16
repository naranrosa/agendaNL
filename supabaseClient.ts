import { createClient } from '@supabase/supabase-js'

// Busca a URL e a chave anon do seu arquivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem ser definidos no arquivo .env");
}

// Cria e exporta o cliente supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)