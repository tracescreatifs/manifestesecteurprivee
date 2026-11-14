import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { creerClientAdmin } from "@/lib/supabase/admin";
import { creerClientServeur } from "@/lib/supabase/server";
import type { Ligne } from "@/types/database";

/*
  Session des admins.
  Un cookie httpOnly garde la date de connexion : au-delà de 30 jours,
  l'admin est déconnecté et doit se reconnecter.
*/

export const COOKIE_CONNEXION = "manifeste_connecte_le";
export const DUREE_CONNEXION_MS = 30 * 24 * 60 * 60 * 1000;

export type Admin = Ligne<"admins">;

export type EtatSession =
  | { etat: "anonyme" }
  | { etat: "expire" }
  | { etat: "retire" }
  | { etat: "en_attente"; admin: Admin }
  | { etat: "actif"; admin: Admin };

/* À appeler seulement depuis une Server Action ou une route serveur */
export async function poserCookieConnexion() {
  const magasin = await cookies();
  magasin.set(COOKIE_CONNEXION, String(Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_CONNEXION_MS / 1000,
  });
}

/* À appeler seulement depuis une Server Action ou une route serveur */
export async function effacerCookieConnexion() {
  const magasin = await cookies();
  magasin.delete(COOKIE_CONNEXION);
}

async function connexionRecente(): Promise<boolean> {
  const magasin = await cookies();
  const valeur = Number(magasin.get(COOKIE_CONNEXION)?.value);
  return Number.isFinite(valeur) && valeur > 0 && Date.now() - valeur < DUREE_CONNEXION_MS;
}

/*
  État de la session de la requête en cours (une seule lecture par requête).
  La ligne admins est lue avec la session de l'utilisateur : la RLS ne montre
  la ligne qu'à un admin actif. Un accès coupé se lit donc comme « retiré ».
*/
export const lireSession = cache(async (): Promise<EtatSession> => {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { etat: "anonyme" };

  const { data: admin } = await supabase
    .from("admins")
    .select("*")
    .eq("user_id", user.id)
    .eq("actif", true)
    .maybeSingle();

  if (!admin) return { etat: "retire" };
  if (!admin.mot_de_passe_defini_le) return { etat: "en_attente", admin };
  if (!(await connexionRecente())) return { etat: "expire" };

  return { etat: "actif", admin };
});

/*
  Contrôle des pages et du layout /admin : renvoie l'admin actif,
  ou redirige (connexion, session expirée, accès retiré, mot de passe à définir).
  Le layout n'est pas réexécuté lors d'une navigation entre pages :
  chaque page de l'espace admin appelle donc aussi cette fonction.
*/
export async function exigerSessionAdmin(): Promise<Admin> {
  const session = await lireSession();
  if (session.etat === "anonyme") redirect("/connexion");
  if (session.etat === "expire") redirect("/auth/deconnexion?raison=expiree");
  if (session.etat === "retire") redirect("/auth/deconnexion?raison=retire");
  if (session.etat === "en_attente") redirect("/definir-mot-de-passe");
  return session.admin;
}

export type ResultatAction<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; erreur: string };

/*
  Contrôle à faire au début de chaque Server Action réservée aux admins.
  Relit la ligne admins avec la clé secrète, pour ne dépendre d'aucun cache.
*/
export async function exigerAdminActif(): Promise<
  { ok: true; admin: Admin } | { ok: false; erreur: string }
> {
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, erreur: "Vous n'êtes plus connecté. Reconnectez-vous." };
  }
  if (!(await connexionRecente())) {
    return { ok: false, erreur: "Votre session a expiré. Reconnectez-vous." };
  }

  const { data: admin, error } = await creerClientAdmin()
    .from("admins")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, erreur: "Vérification de votre accès impossible. Réessayez." };
  }
  if (!admin || !admin.actif || !admin.mot_de_passe_defini_le) {
    return { ok: false, erreur: "Votre accès administrateur a été retiré." };
  }

  return { ok: true, admin };
}
