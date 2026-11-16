import "server-only";

import { JETON_VALIDE } from "@/lib/signature/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";
import type { EtatVerification, OrigineInvitation, StatutManifeste } from "@/types/database";

import { etatDoleances, peutDeposer, type CodeDoleance, type DepotDoleance } from "./regles";

/*
  Doléances côté CEO (prompt 09a) : lecture et écriture avec la clé secrète, après validation du jeton.
  Le navigateur ne reçoit que les doléances de ce lien, jamais celles d'un autre CEO.
  Migration 0009 pas encore exécutée, ou base injoignable : la carte n'est simplement pas affichée.
*/

export type DoleanceCeo = {
  id: string;
  /* Libellé du thème, ou null pour « Autre » */
  theme: string | null;
  themePropose: string | null;
  texte: string;
  solution: string | null;
  neJamaisPublier: boolean;
  deposeLe: string;
};

export type DoleancesCeo = {
  etat: "ouvert" | "clos";
  cloture: string;
  themes: { id: string; libelle: string }[];
  doleances: DoleanceCeo[];
};

type Contexte = { invitationId: string; etat: "pas_ouvert" | "ouvert" | "clos"; cloture: string; autorise: boolean };

/* Invitation, ouverture et droit de dépôt d'un jeton ; null si le lien n'est pas valide ou si la migration manque */
export async function contexteDoleances(jeton: string): Promise<Contexte | null> {
  if (!JETON_VALIDE.test(jeton)) return null;
  const supabase = creerClientAdmin();
  const { data: inv, error } = await supabase
    .from("invitations")
    .select("id, manifeste_id, origine, verification")
    .eq("jeton", jeton)
    .maybeSingle();
  if (error || !inv) return null;
  const invitation = inv as { id: string; manifeste_id: string; origine: OrigineInvitation; verification: EtatVerification };
  const [{ data: manifeste, error: erreurManifeste }, { count }] = await Promise.all([
    supabase.from("manifestes").select("statut, doleances_cloture").eq("id", invitation.manifeste_id).maybeSingle(),
    supabase
      .from("signatures")
      .select("id", { count: "exact", head: true })
      .eq("invitation_id", invitation.id)
      .eq("validee", true),
  ]);
  if (erreurManifeste || !manifeste) return null;
  const m = manifeste as { statut: StatutManifeste; doleances_cloture: string };
  return {
    invitationId: invitation.id,
    etat: etatDoleances(m.statut, m.doleances_cloture, new Date()),
    cloture: m.doleances_cloture,
    autorise: peutDeposer({ origine: invitation.origine, verification: invitation.verification, signatureValidee: (count ?? 0) > 0 }),
  };
}

type LigneDoleance = {
  id: string;
  theme_propose: string | null;
  texte: string;
  solution: string | null;
  ne_jamais_publier: boolean;
  depose_le: string;
  theme: { libelle: string } | null;
};

const COLONNES = "id, theme_propose, texte, solution, ne_jamais_publier, depose_le, theme:doleance_themes(libelle)";

function versDoleance(l: LigneDoleance): DoleanceCeo {
  return {
    id: l.id,
    theme: l.theme?.libelle ?? null,
    themePropose: l.theme_propose,
    texte: l.texte,
    solution: l.solution,
    neJamaisPublier: l.ne_jamais_publier,
    deposeLe: l.depose_le,
  };
}

/* Carte « Vos doléances » : null si le lien ne permet pas de déposer, avant le gel, ou si la migration manque */
export async function lireDoleancesCeo(jeton: string): Promise<DoleancesCeo | null> {
  try {
    const contexte = await contexteDoleances(jeton);
    if (!contexte || !contexte.autorise || contexte.etat === "pas_ouvert") return null;
    const supabase = creerClientAdmin();
    const [{ data: themes, error: e1 }, { data: lignes, error: e2 }] = await Promise.all([
      supabase.from("doleance_themes").select("id, libelle").eq("actif", true).order("ordre").order("libelle"),
      supabase
        .from("doleances")
        .select(COLONNES)
        .eq("invitation_id", contexte.invitationId)
        .order("depose_le", { ascending: false }),
    ]);
    if (e1 || e2) return null;
    return {
      etat: contexte.etat,
      cloture: contexte.cloture,
      themes: themes ?? [],
      doleances: ((lignes ?? []) as unknown as LigneDoleance[]).map(versDoleance),
    };
  } catch {
    return null;
  }
}

/* Une doléance de ce lien (après le dépôt) */
export async function lireDoleanceCeo(invitationId: string, id: string): Promise<DoleanceCeo | null> {
  const { data } = await creerClientAdmin()
    .from("doleances")
    .select(COLONNES)
    .eq("id", id)
    .eq("invitation_id", invitationId)
    .maybeSingle();
  return data ? versDoleance(data as unknown as LigneDoleance) : null;
}

const CODES: CodeDoleance[] = [
  "cle_invalide",
  "lien_invalide",
  "non_autorise",
  "pas_ouvert",
  "doleances_closes",
  "theme_invalide",
  "texte_invalide",
  "limite_atteinte",
];

/* Écriture par la fonction SQL deposer_doleance (une transaction, journalisée) */
export function creerDepotDoleance(invitationId: string): DepotDoleance {
  return {
    async deposer(e) {
      const { data, error } = await creerClientAdmin().rpc("deposer_doleance", {
        p_invitation_id: invitationId,
        p_theme_id: e.themeId,
        p_theme_propose: e.themePropose,
        p_texte: e.texte,
        p_solution: e.solution,
        p_ne_jamais_publier: e.neJamaisPublier,
        p_cle: e.cle,
        p_limite_par_jour: e.limiteParJour,
      });
      if (error) {
        const code = CODES.find((c) => (error.message ?? "").includes(c));
        return { ok: false, code: code ?? "echec" };
      }
      const r = data as { id?: unknown; renvoi?: unknown } | null;
      return typeof r?.id === "string" ? { ok: true, id: r.id, renvoi: r.renvoi === true } : { ok: false, code: "echec" };
    },
  };
}

/* Le CEO supprime sa propre doléance : la fonction SQL vérifie qu'elle appartient à ce lien */
export async function supprimerDoleanceCeo(invitationId: string, id: string): Promise<"ok" | "introuvable" | "echec"> {
  const { error } = await creerClientAdmin().rpc("supprimer_doleance", { p_invitation_id: invitationId, p_doleance_id: id });
  if (!error) return "ok";
  return (error.message ?? "").includes("introuvable") ? "introuvable" : "echec";
}
