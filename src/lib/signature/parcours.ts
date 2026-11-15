/*
  Début du parcours de signature (fonctions pures, testées avec vitest).
  Après une inscription par /rejoindre, le CEO arrive sur son nouveau lien personnel à l'étape 2 :
  le parcours connaît alors son jeton, et « Signer sur mon téléphone » est proposé sur ordinateur.
*/

import type { EtatCampagne } from "./regles";

/* Adresse du nouveau lien personnel, juste après l'inscription : la signature reprend à l'étape 2 */
export function lienApresInscription(jeton: string): string {
  return `/s/${jeton}?etape=2`;
}

/* « Signer sur mon téléphone » : il faut un lien personnel vers lequel pointer le QR code */
export function signerSurTelephonePossible(jeton: string | null): boolean {
  return jeton !== null && jeton.length > 0;
}

export function debutParcours(e: {
  jeton: string | null;
  /* ?etape=2 : QR code depuis l'ordinateur, ou arrivée juste après l'inscription */
  reprendre: boolean;
  saisieComplete: boolean;
  etat: EtatCampagne;
  signe: boolean;
}): { ouvert: boolean; etape: "infos" | "signature" } {
  const ouvert = e.reprendre && e.etat === "ouvert" && !e.signe && e.jeton !== null;
  return { ouvert, etape: ouvert && e.saisieComplete ? "signature" : "infos" };
}
