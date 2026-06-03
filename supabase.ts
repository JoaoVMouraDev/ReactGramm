/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

// O uso de '/// <reference types="vite/client" />' acima resolve o erro do import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: Variáveis de ambiente do Supabase não encontradas. Verifique o painel do Netlify.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
