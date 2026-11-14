import { NextResponse, type NextRequest } from "next/server";

import { effacerCookieConnexion } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";

/*
  Déconnexion automatique demandée par le layout /admin :
  session de plus de 30 jours (raison=expiree) ou accès retiré (raison=retire).
  Le bouton « Se déconnecter » passe, lui, par une Server Action journalisée.
*/
export async function GET(request: NextRequest) {
  const raison = request.nextUrl.searchParams.get("raison");

  const supabase = await creerClientServeur();
  await supabase.auth.signOut();
  await effacerCookieConnexion();

  const url = request.nextUrl.clone();
  url.pathname = "/connexion";
  url.search = raison === "expiree" || raison === "retire" ? `?raison=${raison}` : "";
  return NextResponse.redirect(url);
}
