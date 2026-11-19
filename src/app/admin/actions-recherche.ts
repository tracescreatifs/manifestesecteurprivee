"use server";

import { z } from "zod";

import { rechercherDans, type ResultatRecherche } from "@/lib/admin/recherche";
import { exigerAdminActif, type ResultatAction } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireManifeste } from "@/lib/texte/serveur";

/*
  Recherche du panneau de l'admin (R2) : lue côté serveur avec la session de l'admin (RLS, admins actifs seulement).
  Les données ne quittent le serveur que pour les premières correspondances.
*/

const schema = z.string().trim().max(80, "Recherche trop longue (80 caractères au plus).");

type Brute = {
  id: string;
  personne: { prenom: string; nom: string; telephone: string | null } | null;
  entreprise: { nom: string } | null;
};

export async function rechercherAdmin(q: unknown): Promise<ResultatAction<{ resultat: ResultatRecherche }>> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  const saisie = schema.safeParse(q);
  if (!saisie.success) return { ok: false, erreur: saisie.error.issues[0]?.message ?? "Recherche invalide." };

  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);
  if (!manifeste) return { ok: false, erreur: "Le Manifeste n'existe pas encore en base." };

  const [{ data: invitations }, doleances, themes] = await Promise.all([
    supabase
      .from("invitations")
      .select("id, personne:personnes(prenom, nom, telephone), entreprise:entreprises(nom)")
      .eq("manifeste_id", manifeste.id),
    supabase.from("doleances").select("id, theme_id, theme_propose, texte").eq("manifeste_id", manifeste.id),
    supabase.from("doleance_themes").select("id, libelle"),
  ]);

  const libelles = new Map((themes.data ?? []).map((t) => [t.id, t.libelle]));
  const resultat = rechercherDans(
    saisie.data,
    ((invitations ?? []) as unknown as Brute[]).map((i) => ({
      invitationId: i.id,
      prenom: i.personne?.prenom ?? "",
      nom: i.personne?.nom ?? "",
      entreprise: i.entreprise?.nom ?? "",
      telephone: i.personne?.telephone ?? "",
    })),
    /* Doléances : absentes tant que la migration 0009 n'est pas exécutée (erreur ignorée) */
    (doleances.error ? [] : (doleances.data ?? [])).map((d) => ({
      id: d.id,
      theme: d.theme_id ? (libelles.get(d.theme_id) ?? "Autre") : d.theme_propose ? `Autre (« ${d.theme_propose} »)` : "Autre",
      texte: d.texte,
    })),
  );
  return { ok: true, resultat };
}
