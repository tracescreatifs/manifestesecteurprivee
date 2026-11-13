import { createBrowserClient } from "@supabase/ssr";

import { lireSupabaseClePublique, lireSupabaseUrl } from "@/lib/env";

/* Client Supabase pour le navigateur (clé publique, soumise aux règles RLS) */
export function creerClientNavigateur() {
  return createBrowserClient(lireSupabaseUrl(), lireSupabaseClePublique());
}
