/*
  Inscription d'un CEO absent de la liste, par le lien ouvert (/rejoindre) ou par un lien de parrainage
  (/rejoindre?par=CODE). Fonctions pures, testées avec vitest ; l'écriture passe par la fonction SQL
  inscrire_par_lien_ouvert (migrations 0005 et 0008), qui recontrôle tout dans une seule transaction.
  Clé anti-doublon (0008) : un renvoi avec la même clé renvoie la même invitation et le même jeton, sans rien créer.
*/

import { createHmac } from "node:crypto";

import type { Saisie } from "./regles";

/* Clé anti-doublon : 16 à 64 caractères (comme celle de la signature) */
export const CLE_VALIDE = /^[A-Za-z0-9-]{16,64}$/;

/* Limite d'inscriptions par adresse (empreinte), sur une heure glissante */
export const LIMITE_PAR_HEURE = 5;

export type CodeInscription =
  | "pas_ouvert"
  | "signatures_closes"
  | "lien_en_pause"
  | "limite_atteinte"
  | "refuse"
  | "cle_invalide"
  | "echec";

export type DepotInscription = {
  /* Crée entreprise, personne et invitation ; renvoie le jeton du lien personnel (celui déjà créé si la clé a déjà servi) */
  inscrire(entree: {
    cle: string;
    saisie: Saisie;
    jeton: string;
    codeParrainage: string;
    codeParrain: string;
    invitePar: string;
    empreinte: string;
    limiteParHeure: number;
  }): Promise<{ ok: true; jeton: string } | { ok: false; code: CodeInscription }>;
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
    /* Clé anti-doublon tirée dans le navigateur, la même à chaque nouvel essai */
    cle: string;
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
  if (!CLE_VALIDE.test(entree.cle)) return { ok: false, code: "cle_invalide" };
  const r = await depot.inscrire({
    cle: entree.cle,
    saisie: entree.saisie,
    jeton: generer.jeton(),
    codeParrainage: generer.code(),
    codeParrain: entree.codeParrain.trim(),
    invitePar: entree.invitePar.trim().slice(0, 160),
    empreinte: entree.empreinte,
    limiteParHeure: LIMITE_PAR_HEURE,
  });
  return r.ok ? { ok: true, jeton: r.jeton } : r;
}
