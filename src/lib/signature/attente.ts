/*
  Signature en attente d'envoi, gardée sur l'appareil quand le réseau coupe (cahier des charges, 7.5).
  La clé anti-doublon est gardée avec elle : un renvoi n'est jamais enregistré deux fois.
  Fonctions pures, sans dépendance au navigateur (le stockage est passé en paramètre, testé avec vitest).
*/

import type { TraceSignature } from "@/types/database";

import type { Saisie } from "./regles";

export type EnvoiEnAttente = { cle: string; saisie: Saisie; trace: TraceSignature; garde: string };

type Stockage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/* Au-delà de 30 jours, une signature gardée n'est plus renvoyée (les signatures sont closes depuis longtemps) */
const DUREE_MAX = 30 * 24 * 3600 * 1000;

const cleStockage = (jeton: string) => `manifeste-signature-${jeton}`;

export const INTERVALLE_RENVOI = 15000;

export function garderEnAttente(stockage: Stockage | null, jeton: string, envoi: Omit<EnvoiEnAttente, "garde">, maintenant: Date) {
  try {
    stockage?.setItem(cleStockage(jeton), JSON.stringify({ ...envoi, garde: maintenant.toISOString() }));
  } catch {
    /* Stockage plein ou interdit : la signature reste en mémoire tant que la page est ouverte */
  }
}

export function lireEnAttente(stockage: Stockage | null, jeton: string, maintenant: Date): EnvoiEnAttente | null {
  try {
    const brut = stockage?.getItem(cleStockage(jeton));
    if (!brut) return null;
    const e = JSON.parse(brut) as EnvoiEnAttente;
    const valide =
      typeof e.cle === "string" &&
      e.saisie &&
      typeof e.saisie === "object" &&
      e.trace &&
      Array.isArray(e.trace.d) &&
      maintenant.getTime() - new Date(e.garde).getTime() < DUREE_MAX;
    if (!valide) {
      stockage?.removeItem(cleStockage(jeton));
      return null;
    }
    return e;
  } catch {
    return null;
  }
}

export function oublierEnAttente(stockage: Stockage | null, jeton: string) {
  try {
    stockage?.removeItem(cleStockage(jeton));
  } catch {
    /* rien à faire */
  }
}
