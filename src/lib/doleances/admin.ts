import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/*
  Doléances côté admin (prompt 09a) : lues avec la session de l'admin, sous RLS (admins actifs seulement).
  Migration 0009 pas encore exécutée : disponible vaut false, la rubrique l'explique, rien ne plante.
*/

type Client = SupabaseClient<Database>;

export type DoleanceAdmin = {
  id: string;
  themeId: string | null;
  /* Libellé du thème, ou null pour « Autre » */
  theme: string | null;
  themePropose: string | null;
  texte: string;
  solution: string | null;
  neJamaisPublier: boolean;
  deposeLe: string;
  lueLe: string | null;
  luePar: string | null;
  auteur: { nom: string; entreprise: string; invitationId: string; signataire: boolean };
};

export type ThemeAdmin = { id: string; libelle: string; ordre: number; actif: boolean; nombre: number };

export type DonneesDoleances =
  | { disponible: false }
  | { disponible: true; doleances: DoleanceAdmin[]; themes: ThemeAdmin[]; cloture: string };

/* Nombre de doléances non lues, pour la navigation ; 0 si la migration manque */
export async function compterDoleancesNonLues(supabase: Client, manifesteId: string): Promise<number> {
  const { count, error } = await supabase
    .from("doleances")
    .select("id", { count: "exact", head: true })
    .eq("manifeste_id", manifesteId)
    .is("lue_le", null);
  return error ? 0 : (count ?? 0);
}

type Ligne = {
  id: string;
  invitation_id: string;
  auteur_nom: string;
  entreprise_nom: string;
  theme_id: string | null;
  theme_propose: string | null;
  texte: string;
  solution: string | null;
  ne_jamais_publier: boolean;
  depose_le: string;
  lue_le: string | null;
  lue_par: string | null;
};

export async function lireDoleancesAdmin(supabase: Client, manifesteId: string): Promise<DonneesDoleances> {
  const [{ data: lignes, error: e1 }, { data: themes, error: e2 }, { data: manifeste, error: e3 }] = await Promise.all([
    supabase
      .from("doleances")
      .select(
        "id, invitation_id, auteur_nom, entreprise_nom, theme_id, theme_propose, texte, solution, ne_jamais_publier, depose_le, lue_le, lue_par",
      )
      .eq("manifeste_id", manifesteId)
      .order("depose_le", { ascending: false }),
    supabase.from("doleance_themes").select("id, libelle, ordre, actif").order("ordre").order("libelle"),
    supabase.from("manifestes").select("doleances_cloture").eq("id", manifesteId).maybeSingle(),
  ]);
  if (e1 || e2 || e3 || !manifeste) return { disponible: false };

  const liste = (lignes ?? []) as Ligne[];
  const invitations = [...new Set(liste.map((l) => l.invitation_id))];
  const lecteurs = [...new Set(liste.map((l) => l.lue_par).filter((x): x is string => Boolean(x)))];
  const [{ data: signatures }, { data: admins }] = await Promise.all([
    invitations.length
      ? supabase.from("signatures").select("invitation_id").in("invitation_id", invitations).is("retiree_le", null)
      : Promise.resolve({ data: [] as { invitation_id: string | null }[] }),
    lecteurs.length
      ? supabase.from("admins").select("user_id, prenom, nom").in("user_id", lecteurs)
      : Promise.resolve({ data: [] as { user_id: string; prenom: string; nom: string }[] }),
  ]);
  const signataires = new Set((signatures ?? []).map((s) => s.invitation_id));
  const noms = new Map((admins ?? []).map((a) => [a.user_id, `${a.prenom} ${a.nom}`.trim()]));
  const libelles = new Map((themes ?? []).map((t) => [t.id, t.libelle]));
  const nombres = new Map<string, number>();
  liste.forEach((l) => l.theme_id && nombres.set(l.theme_id, (nombres.get(l.theme_id) ?? 0) + 1));

  return {
    disponible: true,
    cloture: (manifeste as { doleances_cloture: string }).doleances_cloture,
    themes: (themes ?? []).map((t) => ({ ...t, nombre: nombres.get(t.id) ?? 0 })),
    doleances: liste.map((l) => ({
      id: l.id,
      themeId: l.theme_id,
      theme: l.theme_id ? (libelles.get(l.theme_id) ?? null) : null,
      themePropose: l.theme_propose,
      texte: l.texte,
      solution: l.solution,
      neJamaisPublier: l.ne_jamais_publier,
      deposeLe: l.depose_le,
      lueLe: l.lue_le,
      luePar: l.lue_par ? (noms.get(l.lue_par) ?? "Admin supprimé") : null,
      auteur: {
        nom: l.auteur_nom,
        entreprise: l.entreprise_nom,
        invitationId: l.invitation_id,
        signataire: signataires.has(l.invitation_id),
      },
    })),
  };
}
