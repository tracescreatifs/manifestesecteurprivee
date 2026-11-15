"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";

import { lireSiteUrl } from "@/lib/env";
import { rangerAccuse } from "@/lib/signature/accuse-stockage";
import { retirerSignature } from "@/lib/signature/retrait";
import {
  creerDepot,
  creerDepotRetrait,
  invitationDuJeton,
  JETON_VALIDE,
  lireChoix,
  lireSignatureActive,
} from "@/lib/signature/serveur";
import { TEXTES_CHOIX, type ChoixFiche } from "@/lib/signature/fiche";
import { etatCampagne, signer, type Champ, type CodeErreur, type SignatureEnregistree } from "@/lib/signature/regles";
import { schemaSaisie, schemaTrace } from "@/lib/signature/saisie";
import { creerClientAdmin } from "@/lib/supabase/admin";
import type { Bloc } from "@/types/database";

/*
  Actions de l'espace CEO. Chaque action revalide le jeton côté serveur,
  puis lit et écrit avec la clé secrète : le CEO n'a aucun accès direct aux tables.
  Le jeton n'apparaît jamais dans le journal ni dans les messages d'erreur.
  Pas de revalidatePath : les pages admin sont toujours rendues à la demande (D33),
  et une revalidation forcerait le rechargement de la page du CEO après chaque action.
*/

type Echec = { ok: false; erreur: string };

const MESSAGES: Record<CodeErreur, string> = {
  lien_invalide: "Ce lien n'est pas valide.",
  pas_ouvert: "Le Manifeste n'est pas encore ouvert à la signature.",
  signatures_closes: "Les signatures sont closes.",
  deja_signe: "Vous avez déjà signé le Manifeste.",
  cle_invalide: "La signature n'a pas pu être enregistrée. Rechargez la page, puis réessayez.",
  aucune_version: "Le texte n'est pas disponible. Réessayez dans quelques minutes.",
  signature_refusee: "Votre signature n'a pas été retenue : ce lien ne permet plus de signer.",
  echec: "La signature n'a pas pu être enregistrée. Réessayez : elle ne sera jamais enregistrée deux fois.",
};

const schemaJeton = z.string().regex(JETON_VALIDE);
const LIMITE_COMMENTAIRES_PAR_HEURE = 30;
/* Clé anti-doublon tirée une fois par le navigateur, renvoyée telle quelle en cas de nouvel essai */
const schemaCle = z.string().regex(/^[A-Za-z0-9-]{16,64}$/);

/* Type d'appareil seulement (jamais l'adresse IP ni l'empreinte du navigateur) */
function typeAppareil(agent: string): string {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(agent)) return "tablette";
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini/i.test(agent)) return "mobile";
  return "ordinateur";
}

/* ----- Signer ----- */

export type ResultatSignatureCeo =
  | { ok: true; signature: SignatureEnregistree; modifies: Champ[] }
  | (Echec & { code?: CodeErreur; champs?: Partial<Record<Champ, string>> });

export async function signerManifeste(entree: {
  jeton: string;
  cle: string;
  saisie: Record<string, string>;
  trace: unknown;
}): Promise<ResultatSignatureCeo> {
  if (!schemaJeton.safeParse(entree.jeton).success) return { ok: false, erreur: MESSAGES.lien_invalide, code: "lien_invalide" };
  if (!schemaCle.safeParse(entree.cle).success) return { ok: false, erreur: MESSAGES.cle_invalide, code: "cle_invalide" };

  const supabase = creerClientAdmin();
  const { data: maillons, error: erreurMaillons } = await supabase.from("maillons").select("libelle").eq("actif", true);
  if (erreurMaillons) return { ok: false, erreur: MESSAGES.echec, code: "echec" };
  const saisie = schemaSaisie((maillons ?? []).map((m) => m.libelle)).safeParse(entree.saisie);
  if (!saisie.success) {
    const champs: Partial<Record<Champ, string>> = {};
    saisie.error.issues.forEach((i) => {
      const champ = i.path[0] as Champ;
      if (!champs[champ]) champs[champ] = i.message;
    });
    return { ok: false, erreur: "Vérifiez vos informations, à l'étape 1.", champs };
  }
  const trace = schemaTrace.safeParse(entree.trace);
  if (!trace.success) {
    return { ok: false, erreur: trace.error.issues[0]?.message ?? "Votre signature est trop courte." };
  }

  const agent = (await headers()).get("user-agent") ?? "";
  const depot = creerDepot({ trace: trace.data, appareil: typeAppareil(agent) });
  const resultat = await signer(depot, { jeton: entree.jeton, cle: entree.cle, saisie: saisie.data }, new Date());
  if (!resultat.ok) return { ok: false, erreur: MESSAGES[resultat.code], code: resultat.code };
  /* L'accusé PDF est produit et rangé juste après la réponse (D74) ; à défaut, au premier téléchargement */
  if (!resultat.signature.deja) {
    const reference = resultat.signature.reference;
    after(() => rangerAccuse(reference).catch(() => undefined));
  }
  return { ...resultat, signature: { ...resultat.signature, invitationId: "" } };
}

/* ----- Lien ouvert : appelé par le navigateur après l'affichage de la page (D65) ----- */

export async function marquerOuvert(entree: { jeton: string }): Promise<{ ok: boolean }> {
  if (!schemaJeton.safeParse(entree.jeton).success) return { ok: false };
  const invitation = await invitationDuJeton(entree.jeton);
  if (!invitation) return { ok: false };

  const supabase = creerClientAdmin();
  const { data: manifeste } = await supabase.from("manifestes").select("statut").eq("id", invitation.manifesteId).single();
  /* Les liens ne sont actifs qu'à partir du gel */
  if (!manifeste || manifeste.statut === "redaction") return { ok: false };

  const maintenant = new Date().toISOString();
  await supabase.from("invitations").update({ ouvert_le: maintenant }).eq("id", invitation.id).is("ouvert_le", null);
  await supabase
    .from("invitations")
    .update({ statut_envoi: "ouvert" })
    .eq("id", invitation.id)
    .in("statut_envoi", ["a_envoyer", "envoye"]);
  return { ok: true };
}

/* ----- Commenter un paragraphe ou l'ensemble du texte ----- */

const schemaCommentaire = z.object({
  texte: z
    .string()
    .trim()
    .min(2, "Écrivez au moins deux caractères.")
    .max(1000, "Votre commentaire est trop long (1 000 caractères au plus)."),
  blocId: z.string().max(64).nullable(),
});

export type ResultatCommentaire =
  | { ok: true; commentaire: { id: string; blocId: string | null; texte: string; creeLe: string } }
  | Echec;

export async function commenter(entree: { jeton: string; texte: string; blocId: string | null }): Promise<ResultatCommentaire> {
  if (!schemaJeton.safeParse(entree.jeton).success) return { ok: false, erreur: MESSAGES.lien_invalide };
  const donnees = schemaCommentaire.safeParse({ texte: entree.texte, blocId: entree.blocId });
  if (!donnees.success) return { ok: false, erreur: donnees.error.issues[0]?.message ?? "Commentaire invalide." };

  const invitation = await invitationDuJeton(entree.jeton);
  if (!invitation) return { ok: false, erreur: MESSAGES.lien_invalide };
  if (!invitation.personneId) {
    return { ok: false, erreur: "Indiquez d'abord votre nom, à la première étape de la signature." };
  }
  if (invitation.refusee) return { ok: false, erreur: MESSAGES.signature_refusee };

  const supabase = creerClientAdmin();
  const [{ data: manifeste }, { data: version }] = await Promise.all([
    supabase.from("manifestes").select("statut, date_limite").eq("id", invitation.manifesteId).single(),
    supabase
      .from("manifeste_versions")
      .select("id, blocs")
      .eq("manifeste_id", invitation.manifesteId)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!manifeste || !version) return { ok: false, erreur: MESSAGES.aucune_version };
  const etat = etatCampagne(manifeste.statut, manifeste.date_limite, new Date());
  if (etat === "pas_ouvert") return { ok: false, erreur: MESSAGES.pas_ouvert };
  if (etat !== "ouvert") return { ok: false, erreur: "Les signatures sont closes : les commentaires aussi." };

  /* Le paragraphe commenté doit exister dans la version courante */
  const blocs = (Array.isArray(version.blocs) ? version.blocs : []) as unknown as Bloc[];
  const blocId = donnees.data.blocId;
  if (blocId && !blocs.some((b) => b.id === blocId)) {
    return { ok: false, erreur: "Ce passage n'existe plus dans le texte. Rechargez la page." };
  }

  /* Au plus 30 commentaires par heure et par lien ; un double clic ne crée pas deux commentaires */
  const { data: recents } = await supabase
    .from("commentaires")
    .select("id, bloc_id, texte, cree_le")
    .eq("invitation_id", invitation.id)
    .gte("cree_le", new Date(Date.now() - 3600 * 1000).toISOString())
    .order("cree_le", { ascending: false });
  const dernier = recents?.[0];
  if (dernier && dernier.texte === donnees.data.texte && dernier.bloc_id === blocId && Date.now() - new Date(dernier.cree_le).getTime() < 60 * 1000) {
    return { ok: true, commentaire: { id: dernier.id, blocId: dernier.bloc_id, texte: dernier.texte, creeLe: dernier.cree_le } };
  }
  if ((recents?.length ?? 0) >= LIMITE_COMMENTAIRES_PAR_HEURE) {
    return { ok: false, erreur: "Vous avez envoyé beaucoup de commentaires en une heure. Réessayez un peu plus tard." };
  }

  const { data: cree, error } = await supabase
    .from("commentaires")
    .insert({
      invitation_id: invitation.id,
      manifeste_version_id: version.id,
      bloc_id: blocId,
      texte: donnees.data.texte,
    })
    .select("id, bloc_id, texte, cree_le")
    .single();
  if (error || !cree) return { ok: false, erreur: "Le commentaire n'a pas pu être envoyé. Réessayez." };

  return { ok: true, commentaire: { id: cree.id, blocId: cree.bloc_id, texte: cree.texte, creeLe: cree.cree_le } };
}

/* ----- Retirer sa signature (et première moitié de « Refaire ») ----- */

export async function retirerMaSignature(entree: { jeton: string }): Promise<{ ok: true } | Echec> {
  if (!schemaJeton.safeParse(entree.jeton).success) return { ok: false, erreur: MESSAGES.lien_invalide };
  const r = await retirerSignature(creerDepotRetrait(), entree.jeton, new Date());
  if (r.ok) return { ok: true };
  const messages = {
    lien_invalide: MESSAGES.lien_invalide,
    pas_ouvert: MESSAGES.pas_ouvert,
    signatures_closes: "Les signatures sont closes : votre signature ne peut plus être retirée.",
    aucune_signature: "Votre signature est déjà retirée.",
    echec: "Le retrait n'a pas pu être enregistré. Réessayez.",
  } as const;
  return { ok: false, erreur: messages[r.code] };
}

/* ----- Signer sur son téléphone : brouillon de l'étape 1, puis QR code vers le lien personnel ----- */

export async function preparerTelephone(entree: {
  jeton: string;
  saisie: Record<string, string>;
}): Promise<{ ok: true; lien: string; qr: string } | Echec> {
  if (!schemaJeton.safeParse(entree.jeton).success) return { ok: false, erreur: MESSAGES.lien_invalide };
  const invitation = await invitationDuJeton(entree.jeton);
  if (!invitation) return { ok: false, erreur: MESSAGES.lien_invalide };
  if (invitation.refusee) return { ok: false, erreur: MESSAGES.signature_refusee };

  const supabase = creerClientAdmin();
  const { data: maillons, error: erreurMaillons } = await supabase.from("maillons").select("libelle").eq("actif", true);
  if (erreurMaillons) return { ok: false, erreur: "Le service est momentanément indisponible. Réessayez dans quelques minutes." };
  const saisie = schemaSaisie((maillons ?? []).map((m) => m.libelle)).safeParse(entree.saisie);
  if (!saisie.success) return { ok: false, erreur: "Vérifiez vos informations, à l'étape 1." };

  const { error } = await supabase.rpc("enregistrer_brouillon", {
    p_invitation_id: invitation.id,
    p_saisie: saisie.data,
  });
  if (error) {
    return {
      ok: false,
      erreur: /signatures_fermees|date_limite_depassee/.test(error.message ?? "")
        ? MESSAGES.signatures_closes
        : /signature_refusee/.test(error.message ?? "")
          ? MESSAGES.signature_refusee
          : "Vos informations n'ont pas pu être gardées pour le téléphone. Réessayez.",
    };
  }

  let site: string;
  try {
    site = lireSiteUrl();
  } catch {
    return { ok: false, erreur: "L'adresse du site n'est pas configurée. Prévenez la Task Force avec « Une question ? »." };
  }
  const lien = `${site}/s/${entree.jeton}?etape=2`;
  const qr = await QRCode.toString(lien, { type: "svg", margin: 1, color: { dark: "#14212B", light: "#FFFFFF" } });
  return { ok: true, lien, qr };
}

/* ----- Signature faite sur le téléphone : l'ordinateur vérifie toutes les 5 secondes ----- */

export async function verifierSignature(entree: {
  jeton: string;
}): Promise<{ signature: SignatureEnregistree; trace: unknown; modifies: Champ[] } | null> {
  if (!schemaJeton.safeParse(entree.jeton).success) return null;
  const invitation = await invitationDuJeton(entree.jeton);
  if (!invitation) return null;
  const active = await lireSignatureActive(invitation.id);
  return active ? { signature: { ...active.signature, invitationId: "" }, trace: active.trace, modifies: [] } : null;
}

/* ----- Fiche facultative : consentements (la photo passe par la route /s/[jeton]/photo) ----- */

const schemaChoix = z.object({ recontact: z.boolean(), annuaire: z.boolean(), photo_communication: z.boolean() });

export async function enregistrerFiche(entree: { jeton: string; choix: ChoixFiche }): Promise<{ ok: true } | Echec> {
  if (!schemaJeton.safeParse(entree.jeton).success) return { ok: false, erreur: MESSAGES.lien_invalide };
  const choix = schemaChoix.safeParse(entree.choix);
  if (!choix.success) return { ok: false, erreur: "Choix invalides." };
  const invitation = await invitationDuJeton(entree.jeton);
  if (!invitation?.personneId) return { ok: false, erreur: MESSAGES.lien_invalide };

  /* Sans photo, la photo ne peut pas être utilisée pour la communication */
  const voulus: ChoixFiche = { ...choix.data, photo_communication: choix.data.photo_communication && Boolean(invitation.photoPath) };
  const actuels = await lireChoix(invitation.personneId);
  const changements = (Object.keys(voulus) as (keyof ChoixFiche)[]).filter((t) => voulus[t] !== actuels[t]);
  if (!changements.length) return { ok: true };

  /* Donner un accord demande une signature active (la fiche vient après la signature) ; le retirer est toujours possible */
  if (changements.some((t) => voulus[t])) {
    const { count } = await creerClientAdmin()
      .from("signatures")
      .select("id", { count: "exact", head: true })
      .eq("invitation_id", invitation.id)
      .is("retiree_le", null);
    if (invitation.refusee || (count ?? 0) === 0) {
      return { ok: false, erreur: "La fiche se complète après votre signature. Vous pouvez toujours retirer un accord déjà donné." };
    }
  }

  /* Chaque changement ajoute une ligne, avec le texte exact présenté (jamais de modification) */
  const { error } = await creerClientAdmin()
    .from("consentements")
    .insert(
      changements.map((type) => ({
        personne_id: invitation.personneId as string,
        type,
        accorde: voulus[type],
        texte: TEXTES_CHOIX[type],
        source: "fiche",
      })),
    );
  if (error) return { ok: false, erreur: "Vos choix n'ont pas pu être enregistrés. Réessayez." };
  return { ok: true };
}
