import "server-only";

import { createClient } from "@supabase/supabase-js";

import { lireSupabaseCleSecrete, lireSupabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

/*
  Client Supabase avec la clé secrète : il contourne la RLS.
  Serveur uniquement (Server Actions, routes serveur). Jamais importé côté client :
  le paquet server-only fait échouer le build si cela arrive.
  Aucune session : chaque appel est fait au nom du serveur.
*/
export function creerClientAdmin() {
  return createClient<Database>(lireSupabaseUrl(), lireSupabaseCleSecrete(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
