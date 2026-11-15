/*
  Inscription d'un CEO absent de la liste, par le lien ouvert (/rejoindre) ou par un lien de parrainage
  (/rejoindre?par=CODE). Fonctions pures, testées avec vitest ; l'écriture passe par la fonction SQL
  inscrire_par_lien_ouvert (migration 0005), qui recontrôle tout dans une seule transaction.
*/

import { createHmac } from "node:crypto";

import type { Saisie } from "./regles";

/* Limite d'inscriptions par adresse (empreinte), sur une heure glissante */
export const LIMITE_PAR_HEURE = 5;

export type CodeInscription =
  | "pas_ouvert"
  | "signatures_closes"
  | "lien_en_pause"
  | "limite_atteinte"
  | "refuse"
  | "echec";

export type DepotInscription = {
  /* Crée entreprise, personne et invitation ; renvoie le jeton du nouveau lien personnel */
  inscrire(entree: {
    saisie: Saisie;
    jeton: string;
    codeParrainage: string;
    codeParrain: string;
    invitePar: string;
    empreinte: string;
    limiteParHeure: number;
  }): Promise<{ ok: true } | { ok: false; code: CodeInscription }>;
};

/*
  Empreinte de l'adresse IP : HMAC-SHA256 avec un secret du serveur et le jour (UTC).
  L'adresse elle-même n'est jamais enregistrée, et deux jours différents donnent deux empreintes
  sans lien entre elles.
*/
export function empreinteAdresse(adresse: string, secret: string, maintenant: Date): string {
  const jour = maintenant.toISOString().slice(0, 10);
  return createHmac("sha256", secret).update(`inscription|${jour}|${adresse}`).digest("hex");
}

/* Première adresse de la chaîne transmise par l'hébergeur (x-forwarded-for), sinon x-real-ip */
export function adresseDuClient(entetes: { get(nom: string): string | null }): string {
  const transmise = entetes.get("x-forwarded-for")?.split(",")[0]?.trim();
  return transmise || entetes.get("x-real-ip")?.trim() || "inconnue";
}

export async function inscrire(
  depot: DepotInscription,
  entree: {
    saisie: Saisie;
    invitePar: string;
    codeParrain: string;
    /* Champ piège, invisible pour une personne : rempli, c'est un robot */
    piege: string;
    empreinte: string;
  },
  generer: { jeton: () => string; code: () => string },
): Promise<{ ok: true; jeton: string } | { ok: false; code: CodeInscription }> {
  if (entree.piege.trim()) return { ok: false, code: "refuse" };
  const jeton = generer.jeton();
  const r = await depot.inscrire({
    saisie: entree.saisie,
    jeton,
    codeParrainage: generer.code(),
    codeParrain: entree.codeParrain.trim(),
    invitePar: entree.invitePar.trim().slice(0, 160),
    empreinte: entree.empreinte,
    limiteParHeure: LIMITE_PAR_HEURE,
  });
  return r.ok ? { ok: true, jeton } : r;
}
