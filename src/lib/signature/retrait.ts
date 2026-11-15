/*
  Retirer sa signature (et « Refaire », qui retire puis relance la signature en trois étapes).
  Possible seulement tant que les signatures sont ouvertes : texte gelé, date limite non passée.
  La fonction SQL retirer_signature (migration 0005) recontrôle tout dans la même transaction.
*/

import { etatCampagne, type ContexteSignature } from "./regles";

export type CodeRetrait = "lien_invalide" | "pas_ouvert" | "signatures_closes" | "aucune_signature" | "echec";

export type DepotRetrait = {
  contexte(jeton: string): Promise<ContexteSignature | null>;
  retirer(invitationId: string): Promise<{ ok: true; reference: string } | { ok: false; code: CodeRetrait }>;
};

export async function retirerSignature(
  depot: DepotRetrait,
  jeton: string,
  maintenant: Date,
): Promise<{ ok: true; reference: string } | { ok: false; code: CodeRetrait }> {
  const contexte = await depot.contexte(jeton);
  if (!contexte) return { ok: false, code: "lien_invalide" };
  const etat = etatCampagne(contexte.manifeste.statut, contexte.manifeste.dateLimite, maintenant);
  if (etat === "pas_ouvert") return { ok: false, code: "pas_ouvert" };
  if (etat !== "ouvert") return { ok: false, code: "signatures_closes" };
  if (!contexte.signatureActive) return { ok: false, code: "aucune_signature" };
  return depot.retirer(contexte.invitation.id);
}
