/*
  « À vérifier » et « Commentaires » (rubrique CEO, prompt 07) : règles en fonctions pures, testées avec vitest.
  Les décisions sont appliquées par les fonctions SQL de la migration 0006, qui recontrôlent tout
  dans une seule transaction et journalisent la décision avec l'admin.
*/

import { MANIFESTE_GRAS, neutraliserMiseEnForme, SIGNATURE_TASK_FORCE } from "@/lib/ceo/message";
import { normaliserTelephone, normaliserTexte } from "@/lib/ceo/normaliser";
import { CHAMPS, etatCampagne, type Champ } from "@/lib/signature/regles";
import type { Bloc, DecisionVerification, EtatVerification, MotifVerification, StatutCommentaire, StatutManifeste } from "@/types/database";

/* ----- Cas à vérifier ----- */

/* « manuelle » : informations identiques à la liste, mais la validation automatique était coupée */
export type MotifCas = "modification" | "nouveau" | "doublon" | "manuelle";

export function motifDuCas(motif: MotifVerification | null): MotifCas {
  return motif ?? "manuelle";
}

export const LIBELLES_MOTIFS: Record<MotifCas, string> = {
  modification: "Informations modifiées par le CEO",
  nouveau: "Nouvel inscrit",
  doublon: "Entreprise qui a déjà signé",
  manuelle: "Validation automatique coupée",
};

export const LIBELLES_DECISIONS: Record<DecisionVerification, string> = {
  verifiee: "Vérifiée",
  validee: "Validée",
  deux_gardees: "Les deux signatures gardées",
  entreprise_mise_a_jour: "Entreprise mise à jour",
  retiree: "Retirée par un admin",
  refusee: "Refusée par un admin",
  retablie: "Rétablie",
};

export type ActionVerification = "verifier" | "valider" | "garder_les_deux" | "mettre_a_jour_entreprise" | "retirer";

export type CasLu = {
  verification: EtatVerification;
  motif: MotifVerification | null;
  /* Signature active (non retirée) */
  active: boolean;
  /* Le nom ou le maillon saisis par le CEO diffèrent de l'entreprise enregistrée */
  entrepriseDifferente: boolean;
};

/* Décisions proposées pour un cas, selon son motif (prototype et cahier des charges, partie 6.4) */
export function actionsPossibles(cas: CasLu): ActionVerification[] {
  if (cas.verification !== "a_verifier" || !cas.active) return [];
  switch (motifDuCas(cas.motif)) {
    case "nouveau":
      return ["valider", "retirer"];
    case "doublon":
      return ["garder_les_deux", "retirer"];
    case "modification":
      return cas.entrepriseDifferente ? ["verifier", "mettre_a_jour_entreprise", "retirer"] : ["verifier", "retirer"];
    case "manuelle":
      return ["verifier", "retirer"];
  }
}

export type CodeVerification =
  | "introuvable"
  | "action_impossible"
  | "acces_refuse"
  | "entreprise_existe"
  | "rien_a_retablir"
  | "signatures_closes"
  | "document_publie"
  | "echec";

export type DepotVerification = {
  lireCas(invitationId: string): Promise<CasLu | null>;
  appliquer(invitationId: string, action: ActionVerification, motif: string): Promise<{ ok: true } | { ok: false; code: CodeVerification }>;
};

/* Une décision n'est appliquée que si elle est proposée pour ce cas (et encore à traiter) */
export async function deciderCas(
  depot: DepotVerification,
  entree: { invitationId: string; action: ActionVerification; motif: string },
): Promise<{ ok: true } | { ok: false; code: CodeVerification }> {
  const cas = await depot.lireCas(entree.invitationId);
  if (!cas) return { ok: false, code: "introuvable" };
  if (!actionsPossibles(cas).includes(entree.action)) return { ok: false, code: "action_impossible" };
  return depot.appliquer(entree.invitationId, entree.action, entree.motif.trim().slice(0, 500));
}

/* « Rétablir » : seulement une signature retirée ou refusée par un admin, tant que les signatures sont ouvertes */
export function peutRetablir(
  invitation: { verification: EtatVerification; decisionSignature: boolean; signatureActive: boolean },
  manifeste: { statut: StatutManifeste; dateLimite: string },
  maintenant: Date,
): boolean {
  return (
    invitation.verification === "rejete" &&
    invitation.decisionSignature &&
    !invitation.signatureActive &&
    etatCampagne(manifeste.statut, manifeste.dateLimite, maintenant) === "ouvert"
  );
}

/* ----- Comparaison champ par champ : « Votre liste » et « Saisie du CEO » ----- */

export const LIBELLES_CHAMPS: Record<Champ, string> = {
  prenom: "Prénom",
  nom: "Nom",
  fonction: "Fonction",
  entreprise: "Entreprise",
  maillon: "Maillon",
  telephone: "Téléphone",
};

function comparable(champ: Champ, valeur: string | null | undefined): string {
  const v = valeur ?? "";
  return champ === "telephone" ? (normaliserTelephone(v) ?? normaliserTexte(v)) : normaliserTexte(v);
}

export function comparerChamps(
  liste: Partial<Record<Champ, string | null>> | null,
  saisie: Partial<Record<Champ, string | null>>,
): { champ: Champ; libelle: string; liste: string; saisie: string; different: boolean }[] {
  return CHAMPS.map((champ) => ({
    champ,
    libelle: LIBELLES_CHAMPS[champ],
    liste: liste?.[champ] ?? "",
    saisie: saisie[champ] ?? "",
    different: comparable(champ, liste?.[champ]) !== comparable(champ, saisie[champ]),
  }));
}

/* Message après la validation d'un nouvel inscrit, avec son lien personnel (D93), mis en forme pour WhatsApp (D101) */
export function messageValidation(prenom: string, lien: string): string {
  return `Bonjour ${neutraliserMiseEnForme(prenom)},\n\nVotre signature du ${MANIFESTE_GRAS} est validée. Merci.\n\nVous pouvez retrouver votre accusé et compléter votre fiche avec ce lien :\n${lien}\n\n${SIGNATURE_TASK_FORCE}`;
}

/* ----- Commentaires ----- */

export const LIBELLES_STATUTS_COMMENTAIRE: Record<StatutCommentaire, string> = {
  nouveau: "Nouveau",
  retenu: "Retenu pour la suite",
  integre: "Intégré",
  non_retenu: "Non retenu",
};

/* Passer à « Intégré » après le gel demande un avertissement (cahier des charges, partie 6.5) */
export function avertirIntegration(nouveau: StatutCommentaire, statutManifeste: StatutManifeste): boolean {
  return nouveau === "integre" && statutManifeste !== "redaction";
}

export type GroupeCommentaires<T> = { blocId: string | null; position: number; commentaires: T[] };

/*
  Regroupe les commentaires par paragraphe : d'abord les commentaires généraux, puis dans l'ordre du texte
  courant ; un paragraphe qui n'existe plus dans la version courante vient à la fin.
*/
export function regrouperCommentaires<T extends { blocId: string | null; creeLe: string }>(
  commentaires: T[],
  blocs: Pick<Bloc, "id">[],
): GroupeCommentaires<T>[] {
  const ordre = new Map(blocs.map((b, i) => [b.id, i]));
  const groupes = new Map<string, GroupeCommentaires<T>>();
  for (const c of commentaires) {
    const cle = c.blocId ?? "";
    const position = c.blocId === null ? -1 : (ordre.get(c.blocId) ?? Number.MAX_SAFE_INTEGER);
    const g = groupes.get(cle) ?? { blocId: c.blocId, position, commentaires: [] };
    g.commentaires.push(c);
    groupes.set(cle, g);
  }
  return [...groupes.values()]
    .map((g) => ({ ...g, commentaires: [...g.commentaires].sort((a, b) => a.creeLe.localeCompare(b.creeLe)) }))
    .sort((a, b) => a.position - b.position);
}
