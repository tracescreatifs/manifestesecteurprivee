import { describe, expect, it } from "vitest";

import { paginerAnnexe, REGLAGES_ANNEXE, trierAnnexe, type LigneAnnexeA4 } from "./annexe";

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
