/*
  Règles de la signature, en fonctions pures (testées avec vitest).
  Utilisées par le serveur avant l'appel à la fonction SQL enregistrer_signature,
  qui recontrôle le statut, la date limite et l'unicité dans la même transaction.
*/

import { normaliserNomEntreprise, normaliserTelephone, normaliserTexte } from "@/lib/ceo/normaliser";
import type { EtatVerification, MotifVerification, OrigineInvitation, StatutManifeste } from "@/types/database";

/* ----- État de la campagne pour un CEO ----- */

export type EtatCampagne = "pas_ouvert" | "ouvert" | "clos" | "publie";

/* La date limite ferme les signatures même sans clôture manuelle (règle 6) */
export function etatCampagne(statut: StatutManifeste, dateLimiteIso: string, maintenant: Date): EtatCampagne {
  if (statut === "redaction") return "pas_ouvert";
  if (statut === "publie") return "publie";
  if (statut === "clos") return "clos";
  return maintenant.getTime() > new Date(dateLimiteIso).getTime() ? "clos" : "ouvert";
}

/* ----- Saisie du CEO ----- */

export const CHAMPS = ["prenom", "nom", "fonction", "entreprise", "maillon", "telephone"] as const;
export type Champ = (typeof CHAMPS)[number];
export type Saisie = Record<Champ, string>;

function comparable(champ: Champ, valeur: string | undefined | null): string {
  const v = valeur ?? "";
  if (champ === "telephone") return normaliserTelephone(v) ?? normaliserTexte(v);
  return normaliserTexte(v);
}

/* Champs que le CEO a changés par rapport à la liste importée (D20) */
export function champsModifies(liste: Partial<Record<Champ, string | null>> | null, saisie: Saisie): Champ[] {
  if (!liste) return [];
  return CHAMPS.filter((c) => comparable(c, liste[c]) !== comparable(c, saisie[c]));
}

/* ----- Vérification (« À vérifier », prompt 07) ----- */

export type Decision = { validee: boolean; verification: EtatVerification; motif: MotifVerification | null };

export function decider(entree: {
  origine: OrigineInvitation;
  autoValidation: boolean;
  modifie: boolean;
  doublon: boolean;
}): Decision {
  /* Un nouvel inscrit (lien ouvert, parrainage) n'entre dans l'annexe qu'après validation */
  if (entree.origine !== "liste") return { validee: false, verification: "a_verifier", motif: "nouveau" };
  /* Un CEO de la liste entre tout de suite dans l'annexe, avec sa version (D20) */
  if (entree.doublon) return { validee: true, verification: "a_verifier", motif: "doublon" };
  if (entree.modifie) return { validee: true, verification: "a_verifier", motif: "modification" };
  if (!entree.autoValidation) return { validee: true, verification: "a_verifier", motif: null };
  return { validee: true, verification: "valide", motif: null };
}

/* ----- Orchestration d'une signature ----- */

export type CodeErreur =
  | "lien_invalide"
  | "pas_ouvert"
  | "signatures_closes"
  | "deja_signe"
  | "cle_invalide"
  | "aucune_version"
  | "signature_refusee"
  | "echec";

export type SignatureEnregistree = {
  reference: string;
  signeLe: string;
  version: number;
  prenom: string;
  nom: string;
  fonction: string;
  entreprise: string;
  maillon: string;
  validee: boolean;
  invitationId: string;
  deja: boolean;
};

export type ContexteSignature = {
  invitation: {
    id: string;
    origine: OrigineInvitation;
    saisieListe: Partial<Record<Champ, string | null>> | null;
    /* Signature retirée ou refusée par un admin (vérification « rejete ») : ce lien ne peut plus signer */
    refusee?: boolean;
  };
  manifeste: { statut: StatutManifeste; dateLimite: string; autoValidation: boolean };
  signatureActive: boolean;
};

/* Accès aux données, remplacé par un faux dépôt dans les tests */
export type DepotSignature = {
  contexte(jeton: string): Promise<ContexteSignature | null>;
  parCle(cle: string): Promise<SignatureEnregistree | null>;
  doublonEntreprise(entrepriseNormalisee: string, invitationId: string): Promise<boolean>;
  enregistrer(
    invitationId: string,
    cle: string,
    saisie: Saisie,
    decision: Decision,
  ): Promise<{ ok: true; signature: SignatureEnregistree } | { ok: false; code: CodeErreur }>;
};

export type ResultatSignature = { ok: true; signature: SignatureEnregistree; modifies: Champ[] } | { ok: false; code: CodeErreur };

export async function signer(
  depot: DepotSignature,
  entree: { jeton: string; cle: string; saisie: Saisie },
  maintenant: Date,
): Promise<ResultatSignature> {
  const contexte = await depot.contexte(entree.jeton);
  if (!contexte) return { ok: false, code: "lien_invalide" };
  const modifies = champsModifies(contexte.invitation.saisieListe, entree.saisie);

  /* Clé anti-doublon : un renvoi renvoie la signature déjà enregistrée, sans rien créer */
  const existante = await depot.parCle(entree.cle);
  if (existante) {
    return existante.invitationId === contexte.invitation.id
      ? { ok: true, signature: { ...existante, deja: true }, modifies }
      : { ok: false, code: "cle_invalide" };
  }

  if (contexte.invitation.refusee) return { ok: false, code: "signature_refusee" };
  const etat = etatCampagne(contexte.manifeste.statut, contexte.manifeste.dateLimite, maintenant);
  if (etat === "pas_ouvert") return { ok: false, code: "pas_ouvert" };
  if (etat !== "ouvert") return { ok: false, code: "signatures_closes" };
  if (contexte.signatureActive) return { ok: false, code: "deja_signe" };

  const doublon = await depot.doublonEntreprise(normaliserNomEntreprise(entree.saisie.entreprise), contexte.invitation.id);
  const decision = decider({
    origine: contexte.invitation.origine,
    autoValidation: contexte.manifeste.autoValidation,
    modifie: modifies.length > 0,
    doublon,
  });

  const resultat = await depot.enregistrer(contexte.invitation.id, entree.cle, entree.saisie, decision);
  if (resultat.ok) return { ok: true, signature: resultat.signature, modifies };

  /* Deux envois simultanés avec la même clé : le second retrouve le premier */
  if (resultat.code === "deja_signe" || resultat.code === "echec") {
    const apres = await depot.parCle(entree.cle);
    if (apres && apres.invitationId === contexte.invitation.id) {
      return { ok: true, signature: { ...apres, deja: true }, modifies };
    }
  }
  return { ok: false, code: resultat.code };
}
