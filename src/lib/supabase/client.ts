import { createBrowserClient } from "@supabase/ssr";

import { lireSupabaseClePublique, lireSupabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

/* Client Supabase pour le navigateur (clé publique, soumise aux règles RLS) */
export function creerClientNavigateur() {
  return createBrowserClient<Database>(lireSupabaseUrl(), lireSupabaseClePublique());
}
