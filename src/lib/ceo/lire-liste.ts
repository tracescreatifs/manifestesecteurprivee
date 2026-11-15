/*
  Lecture de la liste des CEO (fichier Excel, CSV, ou tableau collé), à partir d'une grille de cellules.
  Fonctions pures : l'aperçu est calculé dans le navigateur, puis le serveur revalide chaque ligne.
*/

import { normaliserNomEntreprise, normaliserTelephone, normaliserTexte, rapprocherMaillon } from "./normaliser";

export type Signalement = "deja_dans_la_liste" | "sans_telephone" | "maillon_a_preciser" | "dirigeant_a_preciser";

export const LIBELLES_SIGNALEMENTS: Record<Signalement, string> = {
  deja_dans_la_liste: "Déjà dans la liste",
  sans_telephone: "Sans téléphone",
  maillon_a_preciser: "Maillon à préciser",
  dirigeant_a_preciser: "Dirigeant à préciser",
};

export type LigneListe = {
  /* Numéro de la ligne dans le fichier (à partir de 1) */
  numero: number;
  prenom: string;
  nom: string;
  fonction: string;
  entreprise: string;
  /* Libellé officiel du maillon, ou chaîne vide */
  maillon: string;
  /* Format E.164, ou chaîne vide */
  telephone: string;
  /* Email en minuscules, ou chaîne vide (jamais demandé au CEO : D30) */
  email: string;
  /* Téléphone tel qu'écrit dans le fichier, s'il n'a pas pu être lu */
  telephoneIllisible: string;
  signalements: Signalement[];
};

export type ColonnesReconnues = Partial<
  Record<"entreprise" | "prenom" | "nom" | "fonction" | "maillon" | "telephone" | "email", string>
>;

/* Email plausible (une seule arobase, un domaine avec un point), en minuscules ; sinon chaîne vide */
export function normaliserEmail(valeur: string): string {
  const email = valeur.trim().toLowerCase().replace(/^mailto:/, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200 ? email : "";
}

export type ResultatListe =
  | { ok: true; lignes: LigneListe[]; colonnes: ColonnesReconnues; ligneEntete: number }
  | { ok: false; erreur: string };

/* ----- Texte délimité (CSV, ou tableau collé depuis Excel ou Google Sheets) ----- */

export function lireTexteDelimite(texte: string): string[][] {
  const contenu = texte.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const premiere = contenu.split("\n").find((l) => l.trim()) ?? "";
  const separateur = premiere.includes("\t")
    ? "\t"
    : (premiere.match(/;/g)?.length ?? 0) >= (premiere.match(/,/g)?.length ?? 0) && premiere.includes(";")
      ? ";"
      : ",";

  const lignes: string[][] = [];
  let ligne: string[] = [];
  let cellule = "";
  let guillemets = false;
  for (let i = 0; i < contenu.length; i++) {
    const c = contenu[i];
    if (guillemets) {
      if (c === '"' && contenu[i + 1] === '"') {
        cellule += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else cellule += c;
    } else if (c === '"' && cellule === "") guillemets = true;
    else if (c === separateur) {
      ligne.push(cellule);
      cellule = "";
    } else if (c === "\n") {
      ligne.push(cellule);
      lignes.push(ligne);
      ligne = [];
      cellule = "";
    } else cellule += c;
  }
  if (cellule !== "" || ligne.length) {
    ligne.push(cellule);
    lignes.push(ligne);
  }
  return lignes;
}

/* ----- Grille vers lignes de CEO ----- */

const estEntreprise = (t: string) => /(entreprise|societe|raison sociale)/.test(t);

/* Le nom complet : les mots en majuscules forment le nom, le reste le prénom */
export function separerNomComplet(complet: string): { prenom: string; nom: string } {
  const mots = complet.trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return { prenom: "", nom: "" };
  const majuscules = mots.filter((m) => m.length > 1 && m === m.toLocaleUpperCase("fr-FR") && /\p{Lu}/u.test(m));
  if (majuscules.length && majuscules.length < mots.length) {
    return {
      prenom: mots.filter((m) => !majuscules.includes(m)).join(" "),
      nom: majuscules.join(" "),
    };
  }
  if (mots.length === 1) return { prenom: "", nom: mots[0] };
  return { prenom: mots.slice(0, -1).join(" "), nom: mots[mots.length - 1] };
}

export function analyserGrille(grille: unknown[][], maillons: string[]): ResultatListe {
  const cellules = grille.map((r) => (Array.isArray(r) ? r : []).map((c) => (c === null || c === undefined ? "" : String(c).trim())));

  /* En-tête : au moins 3 cellules non vides, et une cellule courte « entreprise », « société » ou « raison sociale » */
  const iEntete = cellules.findIndex(
    (r) =>
      r.filter(Boolean).length >= 3 &&
      r.some((c) => {
        const t = normaliserTexte(c);
        return t.length > 0 && t.length < 30 && estEntreprise(t);
      }),
  );
  if (iEntete < 0) {
    return {
      ok: false,
      erreur: "Aucune ligne d'en-tête trouvée : le tableau doit avoir une colonne « Entreprise » (ou « Société », « Raison sociale »).",
    };
  }

  const entete = cellules[iEntete].map((c) => normaliserTexte(c));
  const trouver = (test: (t: string, i: number) => boolean) => entete.findIndex((t, i) => t !== "" && test(t, i));

  const cEntreprise = trouver((t) => t.length < 30 && estEntreprise(t));
  const cPrenom = trouver((t, i) => i !== cEntreprise && /^prenom/.test(t) && !/\bnom\b.*\bprenom\b|\bprenom\b.*\bnom\b/.test(t));
  const cNom = trouver(
    (t, i) =>
      i !== cEntreprise &&
      i !== cPrenom &&
      (t === "nom" || /\bnom (du )?(ceo|dirigeant|complet)\b/.test(t) || /\bdirigeant\b/.test(t) || /\bnom et prenom\b|\bprenom et nom\b/.test(t)),
  );
  const cFonction = trouver((t) => /\b(fonction|poste)\b/.test(t));
  const cMaillon = trouver((t) => /\bmaillon\b/.test(t));
  const cTelephone = trouver((t) => /\b(telephone|tel|whatsapp|mobile|portable)\b/.test(t));
  const cEmail = trouver((t) => /^(adresse )?(e-?mail|courriel|mail)\b/.test(t) || /\b(e-?mail|courriel)\b/.test(t));

  const titre = (i: number) => (i >= 0 ? cellules[iEntete][i] : undefined);
  const colonnes: ColonnesReconnues = {
    entreprise: titre(cEntreprise),
    prenom: titre(cPrenom),
    nom: titre(cNom),
    fonction: titre(cFonction),
    maillon: titre(cMaillon),
    telephone: titre(cTelephone),
    email: titre(cEmail),
  };

  const lire = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").replace(/\s+/g, " ").trim() : "");
  const lignes: LigneListe[] = [];

  cellules.slice(iEntete + 1).forEach((r, k) => {
    const entreprise = lire(r, cEntreprise);
    if (!entreprise) return;

    let prenom = lire(r, cPrenom);
    let nom = lire(r, cNom);
    if (cPrenom < 0 && nom) ({ prenom, nom } = separerNomComplet(nom));

    const telBrut = lire(r, cTelephone);
    const telephone = normaliserTelephone(telBrut) ?? "";
    const maillonBrut = lire(r, cMaillon);
    const maillon = maillonBrut ? (rapprocherMaillon(maillonBrut, maillons) ?? "") : "";

    const signalements: Signalement[] = [];
    if (!telephone) signalements.push("sans_telephone");
    if (!maillon) signalements.push("maillon_a_preciser");
    if (!nom && !prenom) signalements.push("dirigeant_a_preciser");

    lignes.push({
      numero: iEntete + k + 2,
      prenom,
      nom,
      fonction: lire(r, cFonction),
      entreprise,
      maillon,
      telephone,
      telephoneIllisible: telephone ? "" : telBrut,
      email: normaliserEmail(lire(r, cEmail)),
      signalements,
    });
  });

  return { ok: true, lignes, colonnes, ligneEntete: iEntete + 1 };
}

/*
  Doublons (D21) : même entreprise (nom normalisé) ou même téléphone,
  dans la liste existante ou plus haut dans le même fichier.
*/
export function marquerDoublons(
  lignes: LigneListe[],
  existants: { entreprises: string[]; telephones: string[] },
): LigneListe[] {
  const entreprises = new Set(existants.entreprises.map(normaliserNomEntreprise));
  const telephones = new Set(existants.telephones.filter(Boolean));
  return lignes.map((l) => {
    const cle = normaliserNomEntreprise(l.entreprise);
    const doublon = (cle && entreprises.has(cle)) || (l.telephone && telephones.has(l.telephone));
    if (cle) entreprises.add(cle);
    if (l.telephone) telephones.add(l.telephone);
    return doublon && !l.signalements.includes("deja_dans_la_liste")
      ? { ...l, signalements: ["deja_dans_la_liste", ...l.signalements] }
      : l;
  });
}
