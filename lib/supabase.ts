import { createClient } from "@supabase/supabase-js";

// Placeholders evitam que o build quebre quando as env vars ainda não estão
// definidas (ex.: pré-renderização na Vercel antes de cadastrar as variáveis).
// Em runtime, com as env vars corretas, o cliente usa os valores reais.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
