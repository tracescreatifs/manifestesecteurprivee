import { describe, expect, it } from "vitest";

import {
  annexeReduite,
  mentionAutresSignataires,
  paginerAnnexe,
  reduireAnnexe,
  REGLAGES_ANNEXE,
  trierAnnexe,
  type LigneAnnexeA4,
} from "./annexe";

const ligne = (entreprise: string, nom: string, signeLe = "2026-11-23T10:00:00Z", maillon = "Études"): LigneAnnexeA4 => ({
  cle: `${entreprise}-${nom}`,
  prenom: "A",
  nom,
  fonction: "Directeur général",
  entreprise,
  maillon,
  trace: null,
  signeLe,
});

describe("annexe des signataires", () => {
  it("classe par entreprise par défaut, sans tenir compte des accents ni des majuscules", () => {
    const lignes = [ligne("Sine Assainissement", "Sarr"), ligne("Équipements Delta", "Mbaye"), ligne("ferlo Traitement", "Faye")];
    expect(trierAnnexe(lignes, "entreprise").map((l) => l.entreprise)).toEqual([
      "Équipements Delta",
      "ferlo Traitement",
      "Sine Assainissement",
    ]);
  });

  it("classe aussi par date de signature", () => {
    const lignes = [ligne("B", "x", "2026-11-24T10:00:00Z"), ligne("A", "y", "2026-11-25T10:00:00Z")];
    expect(trierAnnexe(lignes, "date").map((l) => l.entreprise)).toEqual(["B", "A"]);
  });

  it("10 lignes par page, avec une page au moins, et les lignes vides à la fin", () => {
    const vingtEtUne = Array.from({ length: 21 }, (_, i) => ligne(`Entreprise ${String(i).padStart(2, "0")}`, "N"));
    const pages = paginerAnnexe(vingtEtUne, REGLAGES_ANNEXE);
    expect(pages.map((p) => p.length)).toEqual([10, 10, 1]);
    expect(paginerAnnexe([], REGLAGES_ANNEXE)).toEqual([[]]);
    const avecVides = paginerAnnexe(vingtEtUne, { ordre: "entreprise", parPage: 8, lignesVides: 5 });
    expect(avecVides.map((p) => p.length)).toEqual([8, 8, 8, 2]);
    expect(avecVides[3]).toEqual([null, null]);
  });
});

describe("annexe réduite d'un inscrit non validé (06c)", () => {
  it("inscrit du lien ouvert ou par parrainage, sans signature validée : annexe réduite", () => {
    expect(annexeReduite({ origine: "lien_ouvert", aSignatureValidee: false, publie: false })).toBe(true);
    expect(annexeReduite({ origine: "parrainage", aSignatureValidee: false, publie: false })).toBe(true);
  });
  it("inscrit validé par un admin : annexe complète", () => {
    expect(annexeReduite({ origine: "lien_ouvert", aSignatureValidee: true, publie: false })).toBe(false);
    expect(annexeReduite({ origine: "parrainage", aSignatureValidee: true, publie: false })).toBe(false);
  });
  it("CEO de la liste : inchangé, même en attente de vérification", () => {
    expect(annexeReduite({ origine: "liste", aSignatureValidee: false, publie: false })).toBe(false);
  });
  it("après la publication : document final complet pour tous", () => {
    expect(annexeReduite({ origine: "lien_ouvert", aSignatureValidee: false, publie: true })).toBe(false);
  });
  it("ne garde que sa ligne et compte les autres", () => {
    const lignes = [
      { moi: false, nom: "Ndiaye" },
      { moi: true, nom: "Sy" },
      { moi: false, nom: "Diop" },
    ];
    const r = reduireAnnexe(lignes);
    expect(r.lignes).toEqual([{ moi: true, nom: "Sy" }]);
    expect(r.autres).toBe(2);
    expect(JSON.stringify(r)).not.toMatch(/Ndiaye|Diop/);
  });
  it("mention du nombre des autres signataires", () => {
    expect(mentionAutresSignataires(12, true)).toBe("et 12 autres signataires");
    expect(mentionAutresSignataires(1, true)).toBe("et 1 autre signataire");
    expect(mentionAutresSignataires(12, false)).toBe("12 signataires");
    expect(mentionAutresSignataires(0, true)).toBeNull();
  });
});
