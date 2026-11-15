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
  signeLe: string;
  /* Signature d'un autre signataire, non montrée avant la publication (D75) : la cellule affiche « Signé » */
  masquee?: boolean;
};

export type OrdreAnnexe = "entreprise" | "maillon" | "nom" | "date";

/* Réglages de l'annexe (cahier des charges, partie 5) : pas encore d'interface pour les changer */
export type ReglagesAnnexe = { ordre: OrdreAnnexe; parPage: 8 | 10 | 15; lignesVides: 0 | 5 | 10 };
export const REGLAGES_ANNEXE: ReglagesAnnexe = { ordre: "entreprise", parPage: 10, lignesVides: 0 };

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
  return lignes.map((l) => (l.moi ? l : { ...l, trace: null, masquee: true }));
}
