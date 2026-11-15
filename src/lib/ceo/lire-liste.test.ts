import { describe, expect, it } from "vitest";

import { analyserGrille, lireTexteDelimite, marquerDoublons, separerNomComplet } from "./lire-liste";
import { formaterTelephone, normaliserNomEntreprise, normaliserTelephone, rapprocherMaillon } from "./normaliser";

const MAILLONS = ["Études", "Production", "Transport et distribution", "Traitement et valorisation", "Axes transversaux"];

/* Structure du fichier de cartographie : titre, lignes vides, puis en-tête en ligne 4 */
const CARTOGRAPHIE: unknown[][] = [
  ["Cartographie des entreprises du secteur privé de l'eau et de l'assainissement", null, null],
  ["Mise à jour : octobre 2026"],
  [],
  ["N°", "Nom entreprise", "Nom CEO", "Fonction", "Adresse", "Téléphone", "Email", "Maillon", "Statut", "Notes"],
  [1, "Niayes Hydro SARL", "Aminata DIALLO", "Directrice générale", "Dakar", 770000101, "a@exemple.sn", "1 · Études", "Actif", ""],
  [2, "Forages du Ndiambour", "Moussa Ndiaye", "Directeur général", "Louga", "+221 77 000 01 02", "", "2 · Production", "", ""],
  [3, "Sine Assainissement", "", "", "Fatick", "", "", "4 · Traitement et valorisation", "", "Dirigeant inconnu"],
  [4, "Delta Pompes Services", "Cheikh Ibrahima MBAYE", "Directeur général", "", "00221 76 000 01 06", "", "Pompes", "", ""],
  [5, "", "", "", "", "", "", "", "", "ligne vide"],
];

describe("lecture de la liste des CEO", () => {
  const r = analyserGrille(CARTOGRAPHIE, MAILLONS);
  if (!r.ok) throw new Error(r.erreur);

  it("trouve l'en-tête en ligne 4 en ignorant le titre", () => {
    expect(r.ligneEntete).toBe(4);
    expect(r.colonnes).toEqual({
      entreprise: "Nom entreprise",
      prenom: undefined,
      nom: "Nom CEO",
      fonction: "Fonction",
      maillon: "Maillon",
      telephone: "Téléphone",
    });
  });

  it("ignore les lignes sans entreprise", () => {
    expect(r.lignes.map((l) => l.entreprise)).toEqual([
      "Niayes Hydro SARL",
      "Forages du Ndiambour",
      "Sine Assainissement",
      "Delta Pompes Services",
    ]);
  });

  it("sépare le nom complet : les mots en majuscules forment le nom", () => {
    expect([r.lignes[0].prenom, r.lignes[0].nom]).toEqual(["Aminata", "DIALLO"]);
    expect([r.lignes[3].prenom, r.lignes[3].nom]).toEqual(["Cheikh Ibrahima", "MBAYE"]);
    expect([r.lignes[1].prenom, r.lignes[1].nom]).toEqual(["Moussa", "Ndiaye"]);
  });

  it("rapproche le maillon, même avec un préfixe numéroté", () => {
    expect(r.lignes.map((l) => l.maillon)).toEqual(["Études", "Production", "Traitement et valorisation", ""]);
  });

  it("normalise les téléphones au format international", () => {
    expect(r.lignes.map((l) => l.telephone)).toEqual(["+221770000101", "+221770000102", "", "+221760000106"]);
  });

  it("signale les lignes à compléter", () => {
    expect(r.lignes[2].signalements).toEqual(["sans_telephone", "dirigeant_a_preciser"]);
    expect(r.lignes[3].signalements).toEqual(["maillon_a_preciser"]);
    expect(r.lignes[0].signalements).toEqual([]);
  });

  it("refuse un tableau sans colonne entreprise", () => {
    expect(analyserGrille([["Nom", "Prénom", "Téléphone"]], MAILLONS).ok).toBe(false);
  });
});

describe("doublons", () => {
  const r = analyserGrille(CARTOGRAPHIE, MAILLONS);
  if (!r.ok) throw new Error(r.erreur);

  it("détecte un doublon par le nom d'entreprise normalisé ou par le téléphone", () => {
    const marquees = marquerDoublons(r.lignes, {
      entreprises: ["NIAYES HYDRO S.A.R.L."],
      telephones: ["+221770000102"],
    });
    expect(marquees.map((l) => l.signalements.includes("deja_dans_la_liste"))).toEqual([true, true, false, false]);
  });

  it("signale tout le fichier quand on le réimporte", () => {
    const existants = {
      entreprises: r.lignes.map((l) => l.entreprise),
      telephones: r.lignes.map((l) => l.telephone),
    };
    expect(marquerDoublons(r.lignes, existants).every((l) => l.signalements[0] === "deja_dans_la_liste")).toBe(true);
  });

  it("détecte les doublons à l'intérieur d'un même fichier", () => {
    const deux = [r.lignes[1], { ...r.lignes[1], numero: 99 }];
    expect(marquerDoublons(deux, { entreprises: [], telephones: [] }).map((l) => l.signalements[0])).toEqual([
      undefined,
      "deja_dans_la_liste",
    ]);
  });
});

describe("tableau collé et CSV", () => {
  it("lit un tableau collé depuis Excel (tabulations)", () => {
    const grille = lireTexteDelimite("Entreprise\tPrénom\tNom\tTéléphone\nKane Forages\tMamadou\tKane\t77 123 45 67\n");
    const r = analyserGrille(grille, MAILLONS);
    expect(r.ok && r.lignes[0]).toMatchObject({ prenom: "Mamadou", nom: "Kane", telephone: "+221771234567" });
  });

  it("lit un CSV avec points-virgules et guillemets", () => {
    const grille = lireTexteDelimite('﻿Société;Dirigeant;Poste;WhatsApp\r\n"Eau; Vie et Santé";Awa FAYE;Gérante;+33 6 12 34 56 78\r\n');
    const r = analyserGrille(grille, MAILLONS);
    expect(r.ok && r.lignes[0]).toMatchObject({
      entreprise: "Eau; Vie et Santé",
      prenom: "Awa",
      nom: "FAYE",
      fonction: "Gérante",
      telephone: "+33612345678",
    });
  });
});

describe("outils de normalisation", () => {
  it("normalise les noms d'entreprise comme la base", () => {
    expect(normaliserNomEntreprise("  Forages du Ndiambour S.A.R.L. ")).toBe("forages du ndiambour");
    expect(normaliserNomEntreprise("Kayor-Ingénierie Eau GIE")).toBe("kayor ingenierie eau");
  });

  it("lit les numéros sénégalais et internationaux", () => {
    expect(normaliserTelephone("77 123 45 67")).toBe("+221771234567");
    expect(normaliserTelephone("33 821 00 00")).toBe("+221338210000");
    expect(normaliserTelephone("221 78 123 45 67")).toBe("+221781234567");
    expect(normaliserTelephone("0033 6 12 34 56 78")).toBe("+33612345678");
    expect(normaliserTelephone("12345")).toBeNull();
    expect(formaterTelephone("+221771234567")).toBe("+221 77 123 45 67");
  });

  it("sépare un nom sans majuscules : le dernier mot est le nom", () => {
    expect(separerNomComplet("Pape Gueye")).toEqual({ prenom: "Pape", nom: "Gueye" });
  });

  it("rapproche les maillons écrits librement", () => {
    expect(rapprocherMaillon("etudes", MAILLONS)).toBe("Études");
    expect(rapprocherMaillon("3 - Transport", MAILLONS)).toBe("Transport et distribution");
    expect(rapprocherMaillon("Autre", MAILLONS)).toBeNull();
  });
});
