import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { lireSupabaseClePublique, lireSupabaseUrl, supabaseConfigure } from "@/lib/env";
import type { Database } from "@/types/database";

/*
  Proxy de Next.js 16 (anciennement middleware) :
  1. rafraîchit la session Supabase sur toutes les routes ;
  2. renvoie /admin vers /connexion si personne n'est connecté.
  Le contrôle complet (admin actif, durée de 30 jours) est fait par le layout /admin.
*/
export async function proxy(request: NextRequest) {
  const espaceAdmin = request.nextUrl.pathname.startsWith("/admin");

  /*
    Sans variables Supabase, le site public reste accessible.
    L'espace admin, lui, lèvera une erreur claire dans son layout.
  */
  if (!supabaseConfigure()) {
    return NextResponse.next({ request });
  }

  let reponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(lireSupabaseUrl(), lireSupabaseClePublique(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesAEcrire, entetes) {
        cookiesAEcrire.forEach(({ name, value }) => request.cookies.set(name, value));
        reponse = NextResponse.next({ request });
        cookiesAEcrire.forEach(({ name, value, options }) =>
          reponse.cookies.set(name, value, options),
        );
        Object.entries(entetes).forEach(([cle, valeur]) => reponse.headers.set(cle, valeur));
      },
    },
  });

  /* Ne rien placer entre la création du client et getUser : la session doit être rafraîchie ici */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (espaceAdmin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    const redirection = NextResponse.redirect(url);
    reponse.cookies.getAll().forEach((cookie) => redirection.cookies.set(cookie));
    return redirection;
  }

  return reponse;
}

export const config = {
  matcher: [
    /*
      Toutes les routes, sauf les fichiers de Next.js, les images,
      robots.txt, la tâche planifiée (qui n'a pas de session)
      l'espace CEO /s/[jeton] (sans compte : le jeton est validé par le serveur) et /rejoindre.
    */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|api/cron|s/|rejoindre|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
