/*
  Annexe des signataires : ordre des lignes et découpage en pages.
  Fonctions pures, partagées par la page A4 et par le moment de la signature côté CEO.
*/

import type { TraceSignature } from "@/types/database";

export type LigneAnnexeA4 = {
  cle: string;
  prenom: string;
  nom: string;
  fonction: string;
  entreprise: string;
  maillon: string;
  trace: TraceSignature | null;
  /* Signataire sur place (prompt 08) : photo de la signature manuscrite, par un lien signé de courte durée */
  image?: string | null;
  signeLe: string;
  /* Signature d'un autre signataire, non montrée avant la publication (D75) : la cellule affiche « Signé » */
  masquee?: boolean;
};

export type OrdreAnnexe = "entreprise" | "maillon" | "nom" | "date";

/* Réglages de l'annexe (cahier des charges, partie 5 ; D69) : enregistrés sur le Manifeste (migration 0010) */
export type ReglagesAnnexe = { ordre: OrdreAnnexe; parPage: 8 | 10 | 15; lignesVides: 0 | 5 | 10 };
export const REGLAGES_ANNEXE: ReglagesAnnexe = { ordre: "entreprise", parPage: 10, lignesVides: 0 };
export const ORDRES_ANNEXE: OrdreAnnexe[] = ["entreprise", "maillon", "nom", "date"];
export const LIGNES_PAR_PAGE: ReglagesAnnexe["parPage"][] = [8, 10, 15];
export const LIGNES_VIDES: ReglagesAnnexe["lignesVides"][] = [0, 5, 10];

/* Réglages lus sur la ligne du Manifeste ; valeurs par défaut si la migration 0010 n'est pas encore exécutée */
export function reglagesDuManifeste(m: {
  annexe_ordre?: unknown;
  annexe_lignes_par_page?: unknown;
  annexe_lignes_vides?: unknown;
} | null): ReglagesAnnexe {
  const ordre = ORDRES_ANNEXE.find((o) => o === m?.annexe_ordre) ?? REGLAGES_ANNEXE.ordre;
  const parPage = LIGNES_PAR_PAGE.find((n) => n === m?.annexe_lignes_par_page) ?? REGLAGES_ANNEXE.parPage;
  const lignesVides = LIGNES_VIDES.find((n) => n === m?.annexe_lignes_vides) ?? REGLAGES_ANNEXE.lignesVides;
  return { ordre, parPage, lignesVides };
}

/* Nombre de pages de l'annexe (une au moins) */
export function nombrePagesAnnexe(nombreSignataires: number, reglages: ReglagesAnnexe): number {
  return Math.max(1, Math.ceil((nombreSignataires + reglages.lignesVides) / reglages.parPage));
}

const comparer = (a: string, b: string) => a.localeCompare(b, "fr", { sensitivity: "base" });

export function trierAnnexe<T extends LigneAnnexeA4>(lignes: T[], ordre: OrdreAnnexe): T[] {
  const parEntreprise = (a: T, b: T) => comparer(a.entreprise, b.entreprise) || comparer(a.nom, b.nom);
  const tri: Record<OrdreAnnexe, (a: T, b: T) => number> = {
    entreprise: parEntreprise,
    maillon: (a, b) => comparer(a.maillon, b.maillon) || parEntreprise(a, b),
    nom: (a, b) => comparer(a.nom, b.nom) || comparer(a.prenom, b.prenom) || parEntreprise(a, b),
    date: (a, b) => a.signeLe.localeCompare(b.signeLe) || parEntreprise(a, b),
  };
  return [...lignes].sort(tri[ordre]);
}

/* Pages de l'annexe : les signatures, puis les lignes vides pour les signatures manuscrites. Une page au moins. */
export function paginerAnnexe<T extends LigneAnnexeA4>(lignes: T[], reglages: ReglagesAnnexe): (T | null)[][] {
  const toutes: (T | null)[] = [...trierAnnexe(lignes, reglages.ordre), ...Array<null>(reglages.lignesVides).fill(null)];
  const pages: (T | null)[][] = [];
  for (let i = 0; i < toutes.length; i += reglages.parPage) pages.push(toutes.slice(i, i + reglages.parPage));
  return pages.length ? pages : [[]];
}

/*
  Côté CEO, jusqu'à la publication, l'image des signatures des autres n'est pas envoyée au navigateur (D75) :
  les liens circulent sur WhatsApp et peuvent être transférés. La signature du CEO lui-même reste visible.
*/
export function masquerAnnexe<T extends LigneAnnexeA4 & { moi: boolean }>(lignes: T[], publie: boolean): T[] {
  if (publie) return lignes;
  return lignes.map((l) => (l.moi ? l : { ...l, trace: null, image: null, masquee: true }));
}
