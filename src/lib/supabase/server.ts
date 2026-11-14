import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { lireSupabaseClePublique, lireSupabaseUrl } from "@/lib/env";
import type { Database } from "@/types/database";

/*
  Client Supabase côté serveur (clé publique, soumise aux règles RLS),
  qui lit et écrit la session dans les cookies de Next.js.
  Un nouveau client par requête : ne jamais le partager.
*/
export async function creerClientServeur() {
  const magasin = await cookies();

  return createServerClient<Database>(lireSupabaseUrl(), lireSupabaseClePublique(), {
    cookies: {
      getAll() {
        return magasin.getAll();
      },
      setAll(cookiesAEcrire) {
        try {
          cookiesAEcrire.forEach(({ name, value, options }) =>
            magasin.set(name, value, options),
          );
        } catch {
          /*
            Appel depuis un composant serveur : Next.js interdit d'y écrire des cookies.
            La session est alors rafraîchie par une Server Action ou un route handler.
          */
        }
      },
    },
  });
}
