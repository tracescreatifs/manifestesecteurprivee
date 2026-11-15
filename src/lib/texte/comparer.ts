import type { Bloc } from "@/types/database";

import { texteBrut } from "./html";

/*
  Alignement de deux versions du texte (cahier des charges, partie 5.2).
  Plus longue sous-séquence commune sur (type, contenu) :
  - un bloc inchangé garde son identifiant ;
  - entre deux blocs inchangés, un bloc supprimé et un bloc ajouté du même type
    forment un bloc modifié, qui garde l'identifiant de l'ancien ;
  - le reste est ajouté (nouvel identifiant) ou supprimé.
  Les commentaires des CEO restent ainsi attachés au bon paragraphe.
*/

export type Operation =
  | { statut: "egal"; avant: Bloc; apres: Bloc }
  | { statut: "modifie"; avant: Bloc; apres: Bloc }
  | { statut: "ajoute"; apres: Bloc }
  | { statut: "supprime"; avant: Bloc };

export type ChangementsSection = { section: string | null; modifies: number; ajoutes: number; supprimes: number };

export type Resume = {
  texte: string;
  identique: boolean;
  modifies: number;
  ajoutes: number;
  supprimes: number;
  sections: ChangementsSection[];
  titreModifie: boolean;
  sousTitreModifie: boolean;
};

export type VersionComparable = { titre: string; sousTitre: string; blocs: Bloc[] };

const cleBloc = (b: Bloc) => `${b.type}|${b.html}`;

function plusLongueSousSequence<T>(a: T[], b: T[]): Array<["egal" | "supprime" | "ajoute", number, number]> {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Array<["egal" | "supprime" | "ajoute", number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) ops.push(["egal", i++, j++]);
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(["supprime", i++, -1]);
    else ops.push(["ajoute", -1, j++]);
  }
  while (i < n) ops.push(["supprime", i++, -1]);
  while (j < m) ops.push(["ajoute", -1, j++]);
  return ops;
}

/* Intertitre qui précède un bloc (null : avant le premier intertitre) */
function sectionDe(blocs: Bloc[], index: number): string | null {
  for (let i = index; i >= 0; i--) if (blocs[i]?.type === "h") return texteBrut(blocs[i].html);
  return null;
}

function nouvelId(): string {
  return `b${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export function aligner(
  precedente: VersionComparable,
  suivante: VersionComparable,
): { blocs: Bloc[]; operations: Operation[]; resume: Resume } {
  const avant = precedente.blocs;
  const apres = suivante.blocs.map((b) => ({ ...b }));
  const brutes = plusLongueSousSequence(avant.map(cleBloc), apres.map(cleBloc));

  const operations: Operation[] = [];
  const sections = new Map<string, ChangementsSection>();
  const compter = (section: string | null, champ: "modifies" | "ajoutes" | "supprimes") => {
    const k = section ?? "";
    if (!sections.has(k)) sections.set(k, { section, modifies: 0, ajoutes: 0, supprimes: 0 });
    sections.get(k)![champ]++;
  };

  /* Traite une suite de suppressions et d'ajouts comprise entre deux blocs inchangés */
  const traiterSuite = (suppressions: number[], ajouts: number[]) => {
    const restants = [...suppressions];
    const appariement = new Map<number, number>();
    for (const j of ajouts) {
      const k = restants.findIndex((i) => avant[i].type === apres[j].type);
      if (k >= 0) {
        appariement.set(j, restants[k]);
        restants.splice(k, 1);
      }
    }
    for (const i of restants) {
      operations.push({ statut: "supprime", avant: avant[i] });
      compter(sectionDe(avant, i), "supprimes");
    }
    for (const j of ajouts) {
      const i = appariement.get(j);
      if (i !== undefined) {
        apres[j].id = avant[i].id;
        operations.push({ statut: "modifie", avant: avant[i], apres: apres[j] });
        compter(sectionDe(apres, j), "modifies");
      } else {
        apres[j].id = nouvelId();
        operations.push({ statut: "ajoute", apres: apres[j] });
        compter(sectionDe(apres, j), "ajoutes");
      }
    }
  };

  let suppressions: number[] = [];
  let ajouts: number[] = [];
  for (const [genre, i, j] of brutes) {
    if (genre === "egal") {
      traiterSuite(suppressions, ajouts);
      suppressions = [];
      ajouts = [];
      apres[j].id = avant[i].id;
      operations.push({ statut: "egal", avant: avant[i], apres: apres[j] });
    } else if (genre === "supprime") suppressions.push(i);
    else ajouts.push(j);
  }
  traiterSuite(suppressions, ajouts);

  const liste = [...sections.values()];
  const titreModifie = precedente.titre !== suivante.titre;
  const sousTitreModifie = precedente.sousTitre !== suivante.sousTitre;
  const total = (champ: "modifies" | "ajoutes" | "supprimes") => liste.reduce((s, c) => s + c[champ], 0);

  const resume: Resume = {
    texte: rediger(liste, titreModifie, sousTitreModifie),
    identique: liste.length === 0 && !titreModifie && !sousTitreModifie,
    modifies: total("modifies"),
    ajoutes: total("ajoutes"),
    supprimes: total("supprimes"),
    sections: liste,
    titreModifie,
    sousTitreModifie,
  };

  return { blocs: apres, operations, resume };
}

/* « 2 paragraphes modifiés, 1 ajouté, dans Nos engagements ; titre modifié » */
function rediger(sections: ChangementsSection[], titre: boolean, sousTitre: boolean): string {
  const parties = sections.map((s) => {
    const morceaux: string[] = [];
    const ajouter = (n: number, participe: string) => {
      if (!n) return;
      const nom = morceaux.length === 0 ? (n > 1 ? "paragraphes " : "paragraphe ") : "";
      morceaux.push(`${n} ${nom}${participe}${n > 1 ? "s" : ""}`);
    };
    ajouter(s.modifies, "modifié");
    ajouter(s.ajoutes, "ajouté");
    ajouter(s.supprimes, "supprimé");
    return `${morceaux.join(", ")}, ${s.section ? `dans ${s.section}` : "dans l'introduction"}`;
  });
  if (titre) parties.push("titre modifié");
  if (sousTitre) parties.push("sous-titre modifié");
  if (!parties.length) return "Aucune modification";
  const texte = parties.join(" ; ");
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/* Résumé d'une première version (rien à comparer) */
export function resumePremiereVersion(blocs: Bloc[]): Resume {
  return {
    texte: "Première version du texte",
    identique: false,
    modifies: 0,
    ajoutes: blocs.length,
    supprimes: 0,
    sections: [],
    titreModifie: false,
    sousTitreModifie: false,
  };
}

/* Différence mot à mot entre deux textes, pour les blocs modifiés */
export type MorceauDiff = { statut: "egal" | "ajoute" | "supprime"; texte: string };

export function diffMots(avant: string, apres: string): MorceauDiff[] {
  const a = avant.split(/\s+/).filter(Boolean);
  const b = apres.split(/\s+/).filter(Boolean);
  const morceaux: MorceauDiff[] = [];
  for (const [genre, i, j] of plusLongueSousSequence(a, b)) {
    const mot = genre === "ajoute" ? b[j] : a[i];
    const dernier = morceaux[morceaux.length - 1];
    if (dernier && dernier.statut === genre) dernier.texte += ` ${mot}`;
    else morceaux.push({ statut: genre, texte: mot });
  }
  return morceaux;
}

/* Numéro des points : la numérotation recommence à 1 après chaque bloc qui n'est pas un point */
export function numerosDesPoints(blocs: Bloc[]): Array<number | null> {
  let n = 0;
  return blocs.map((b) => {
    if (b.type !== "li") {
      n = 0;
      return null;
    }
    return ++n;
  });
}
