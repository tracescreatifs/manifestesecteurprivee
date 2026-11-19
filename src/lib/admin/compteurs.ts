import type { StatutEnvoi } from "@/types/database";

/*
  Définitions uniques des compteurs de l'admin (R2), partagées par le menu, le tableau de bord et la rubrique CEO :
  le même chiffre partout.
*/

/* « À vérifier » : invitation en attente de vérification, avec une signature active (non retirée) */
export function estAVerifier(verification: string, aSignatureActive: boolean): boolean {
  return verification === "a_verifier" && aSignatureActive;
}

/*
  « À relancer » : lien envoyé ou ouvert, pas encore signé, avec un numéro WhatsApp (la relance part sur WhatsApp).
  statut : statut de la rubrique CEO (« signe » dès qu'une signature active existe).
  Même liste que la file « Relancer un par un ».
*/
export function estARelancer(statut: StatutEnvoi, telephone: string | null | undefined): boolean {
  return (statut === "envoye" || statut === "ouvert") && Boolean(telephone?.trim());
}
