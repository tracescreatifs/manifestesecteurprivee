"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerAdminActif, type ResultatAction } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/*
  Doléances côté admin (prompt 09a) : lecture, rattachement à un thème, thèmes.
  Chaque action : zod, admin actif, puis une fonction SQL de la migration 0009, appelée avec la session
  de l'admin, qui recontrôle tout et journalise dans la même transaction (jamais le texte d'une doléance).
*/

const rafraichir = () => revalidatePath("/admin", "layout");
const id = z.string().regex(/^[0-9a-f-]{36}$/i);
const libelle = z
  .string()
  .trim()
  .min(2, "Le thème doit compter 2 caractères au moins.")
  .max(60, "Le thème doit compter 60 caractères au plus.");

const MESSAGES: Record<string, string> = {
  acces_refuse: "Votre accès d'admin n'est plus actif.",
  introuvable: "Cet élément n'existe plus. Rechargez la page.",
  theme_invalide: "Ce thème n'est plus disponible. Rechargez la page.",
  theme_existe: "Un thème porte déjà ce nom.",
  libelle_invalide: "Le thème doit compter de 2 à 60 caractères.",
};

type Fonctions = Database["public"]["Functions"];
type NomFonction =
  | "marquer_doleance_lue"
  | "rattacher_doleance"
  | "creer_theme_doleance"
  | "renommer_theme_doleance"
  | "activer_theme_doleance"
  | "ordonner_themes_doleances";

async function appeler<N extends NomFonction>(nom: N, args: Fonctions[N]["Args"], echec: string): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc(nom, args as never);
  if (error) {
    const code = Object.keys(MESSAGES).find((c) => (error.message ?? "").includes(c));
    return { ok: false, erreur: code ? MESSAGES[code] : echec };
  }
  rafraichir();
  return { ok: true };
}

export async function marquerDoleance(entree: { id: string; lue: boolean }): Promise<ResultatAction> {
  const d = z.object({ id, lue: z.boolean() }).safeParse(entree);
  if (!d.success) return { ok: false, erreur: MESSAGES.introuvable };
  return appeler("marquer_doleance_lue", { p_doleance_id: d.data.id, p_lue: d.data.lue }, "La doléance n'a pas pu être mise à jour. Réessayez.");
}

export async function rattacherDoleance(entree: { id: string; themeId: string }): Promise<ResultatAction> {
  const d = z.object({ id, themeId: id }).safeParse(entree);
  if (!d.success) return { ok: false, erreur: "Choisissez un thème." };
  return appeler("rattacher_doleance", { p_doleance_id: d.data.id, p_theme_id: d.data.themeId }, "Le rattachement a échoué. Réessayez.");
}

export async function creerTheme(entree: { libelle: string }): Promise<ResultatAction> {
  const d = z.object({ libelle }).safeParse(entree);
  if (!d.success) return { ok: false, erreur: d.error.issues[0]?.message ?? MESSAGES.libelle_invalide };
  return appeler("creer_theme_doleance", { p_libelle: d.data.libelle }, "Le thème n'a pas pu être créé. Réessayez.");
}

export async function renommerTheme(entree: { id: string; libelle: string }): Promise<ResultatAction> {
  const d = z.object({ id, libelle }).safeParse(entree);
  if (!d.success) return { ok: false, erreur: d.error.issues[0]?.message ?? MESSAGES.libelle_invalide };
  return appeler("renommer_theme_doleance", { p_theme_id: d.data.id, p_libelle: d.data.libelle }, "Le thème n'a pas pu être renommé. Réessayez.");
}

export async function activerTheme(entree: { id: string; actif: boolean }): Promise<ResultatAction> {
  const d = z.object({ id, actif: z.boolean() }).safeParse(entree);
  if (!d.success) return { ok: false, erreur: MESSAGES.introuvable };
  return appeler("activer_theme_doleance", { p_theme_id: d.data.id, p_actif: d.data.actif }, "Le thème n'a pas pu être modifié. Réessayez.");
}

export async function ordonnerThemes(entree: { ids: string[] }): Promise<ResultatAction> {
  const d = z.object({ ids: z.array(id).min(1).max(200) }).safeParse(entree);
  if (!d.success) return { ok: false, erreur: MESSAGES.theme_invalide };
  return appeler("ordonner_themes_doleances", { p_ids: d.data.ids }, "L'ordre n'a pas pu être enregistré. Réessayez.");
}
