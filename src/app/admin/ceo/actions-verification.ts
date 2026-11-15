"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerAdminActif, type ResultatAction } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireManifeste } from "@/lib/texte/serveur";
import {
  deciderCas,
  peutRetablir,
  type ActionVerification,
  type CasLu,
  type CodeVerification,
  type DepotVerification,
} from "@/lib/verification/regles";
import { normaliserNomEntreprise } from "@/lib/ceo/normaliser";

/*
  Décisions sur les signatures « À vérifier » et traitement des commentaires (prompt 07).
  Chaque action : zod, admin actif, puis une fonction SQL de la migration 0006, appelée avec la session
  de l'admin, qui recontrôle tout dans une transaction et journalise la décision avec l'admin.
*/

const rafraichir = () => revalidatePath("/admin", "layout");

const MESSAGES: Record<CodeVerification, string> = {
  introuvable: "Ce cas n'existe plus. Rechargez la page.",
  action_impossible: "Ce cas a déjà été traité, ou cette décision ne s'y applique pas. Rechargez la page.",
  acces_refuse: "Votre accès d'admin n'est plus actif.",
  entreprise_existe:
    "Une autre entreprise porte déjà ce nom. Rien n'a été changé : marquez la signature comme vérifiée, ou corrigez l'entreprise depuis la fiche.",
  rien_a_retablir: "Il n'y a rien à rétablir pour ce CEO.",
  signatures_closes: "Les signatures sont closes : rien ne peut être rétabli.",
  document_publie: "Le document est publié : les signatures ne changent plus.",
  echec: "La décision n'a pas pu être enregistrée. Réessayez.",
};

function codeDe(message: string): CodeVerification {
  if (message.includes("acces_refuse")) return "acces_refuse";
  if (message.includes("entreprise_existe")) return "entreprise_existe";
  if (message.includes("deja_traite") || message.includes("aucune_signature") || message.includes("decision_invalide")) return "action_impossible";
  if (message.includes("rien_a_retablir") || message.includes("deja_signe")) return "rien_a_retablir";
  if (message.includes("signatures_fermees") || message.includes("date_limite_depassee")) return "signatures_closes";
  if (message.includes("document_publie")) return "document_publie";
  if (message.includes("lien_invalide")) return "introuvable";
  return "echec";
}

/* Dépôt réel : lecture du cas et application par les fonctions SQL, avec la session de l'admin */
async function depot(): Promise<DepotVerification> {
  const supabase = await creerClientServeur();
  return {
    async lireCas(invitationId) {
      const [{ data: inv }, { count }] = await Promise.all([
        supabase
          .from("invitations")
          .select("verification, motif, saisie_ceo, entreprise:entreprises(nom, maillon:maillons(libelle))")
          .eq("id", invitationId)
          .maybeSingle(),
        supabase
          .from("signatures")
          .select("id", { count: "exact", head: true })
          .eq("invitation_id", invitationId)
          .is("retiree_le", null),
      ]);
      if (!inv) return null;
      const saisie = (inv.saisie_ceo ?? {}) as { entreprise?: string; maillon?: string };
      const entreprise = inv.entreprise as unknown as { nom: string; maillon: { libelle: string } | null } | null;
      const cas: CasLu = {
        verification: inv.verification,
        motif: inv.motif,
        active: (count ?? 0) > 0,
        entrepriseDifferente:
          Boolean(saisie.entreprise) &&
          (normaliserNomEntreprise(saisie.entreprise ?? "") !== normaliserNomEntreprise(entreprise?.nom ?? "") ||
            (saisie.maillon ?? "") !== (entreprise?.maillon?.libelle ?? "")),
      };
      return cas;
    },
    async appliquer(invitationId, action, motif) {
      const appel =
        action === "retirer"
          ? supabase.rpc("retirer_signature_admin", { p_invitation_id: invitationId, p_motif: motif })
          : action === "mettre_a_jour_entreprise"
            ? supabase.rpc("mettre_a_jour_entreprise", { p_invitation_id: invitationId })
            : supabase.rpc("confirmer_signature", {
                p_invitation_id: invitationId,
                p_decision: action === "valider" ? "validee" : action === "garder_les_deux" ? "deux_gardees" : "verifiee",
              });
      const { error } = await appel;
      return error ? { ok: false, code: codeDe(error.message ?? "") } : { ok: true };
    },
  };
}

const schemaDecision = z.object({
  invitationId: z.uuid("Cas introuvable."),
  action: z.enum(["verifier", "valider", "garder_les_deux", "mettre_a_jour_entreprise", "retirer"]),
  motif: z.string().max(500, "Le motif est trop long (500 caractères au plus).").default(""),
});

export async function deciderVerification(saisie: {
  invitationId: string;
  action: ActionVerification;
  motif?: string;
}): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  const donnees = schemaDecision.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: donnees.error.issues[0]?.message ?? "Décision invalide." };

  const r = await deciderCas(await depot(), donnees.data);
  if (!r.ok) return { ok: false, erreur: MESSAGES[r.code] };
  rafraichir();
  return { ok: true };
}

/* ----- Rétablir une signature retirée ou refusée par un admin ----- */

const schemaCible = z.object({ invitationId: z.uuid("CEO introuvable.") });

export async function retablirSignature(saisie: { invitationId: string }): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  const donnees = schemaCible.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: "CEO introuvable." };

  const supabase = await creerClientServeur();
  const [manifeste, { data: inv }, { count }] = await Promise.all([
    lireManifeste(supabase),
    supabase.from("invitations").select("verification, decision_signature_id").eq("id", donnees.data.invitationId).maybeSingle(),
    supabase
      .from("signatures")
      .select("id", { count: "exact", head: true })
      .eq("invitation_id", donnees.data.invitationId)
      .is("retiree_le", null),
  ]);
  if (!manifeste || !inv) return { ok: false, erreur: MESSAGES.introuvable };
  const possible = peutRetablir(
    { verification: inv.verification, decisionSignature: inv.decision_signature_id !== null, signatureActive: (count ?? 0) > 0 },
    { statut: manifeste.statut, dateLimite: manifeste.date_limite },
    new Date(),
  );
  if (!possible) {
    return { ok: false, erreur: inv.verification === "rejete" ? MESSAGES.signatures_closes : MESSAGES.rien_a_retablir };
  }

  const { error } = await supabase.rpc("retablir_signature", { p_invitation_id: donnees.data.invitationId });
  if (error) return { ok: false, erreur: MESSAGES[codeDe(error.message ?? "")] };
  rafraichir();
  return { ok: true };
}

/* ----- Commentaires : statut et note interne ----- */

const schemaCommentaire = z.object({
  commentaireId: z.uuid("Commentaire introuvable."),
  statut: z.enum(["nouveau", "retenu", "integre", "non_retenu"]),
  note: z.string().trim().max(1000, "La note est trop longue (1 000 caractères au plus).").default(""),
});

export async function traiterCommentaire(saisie: {
  commentaireId: string;
  statut: "nouveau" | "retenu" | "integre" | "non_retenu";
  note: string;
}): Promise<ResultatAction> {
  const acces = await exigerAdminActif();
  if (!acces.ok) return acces;
  const donnees = schemaCommentaire.safeParse(saisie);
  if (!donnees.success) return { ok: false, erreur: donnees.error.issues[0]?.message ?? "Traitement invalide." };

  const supabase = await creerClientServeur();
  const { error } = await supabase.rpc("traiter_commentaire", {
    p_commentaire_id: donnees.data.commentaireId,
    p_statut: donnees.data.statut,
    p_note: donnees.data.note,
  });
  if (error) {
    const m = error.message ?? "";
    return {
      ok: false,
      erreur: m.includes("acces_refuse")
        ? MESSAGES.acces_refuse
        : m.includes("commentaire_introuvable")
          ? "Ce commentaire n'existe plus. Rechargez la page."
          : MESSAGES.echec,
    };
  }
  rafraichir();
  return { ok: true };
}
