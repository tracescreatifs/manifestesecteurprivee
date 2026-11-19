import { describe, expect, it } from "vitest";

import { rechercherDans } from "./recherche";

const CEO = [
  { invitationId: "a", prenom: "Moussa", nom: "Ndiaye", entreprise: "Forage du Ndiambour", telephone: "+221 77 000 01 02" },
  { invitationId: "b", prenom: "Khady", nom: "Diop", entreprise: "Niayes Hydro", telephone: "" },
  { invitationId: "c", prenom: "Aïssatou", nom: "Mbacké", entreprise: "Sénéo", telephone: "+221 76 555 44 33" },
];
const DOLEANCES = [
  { id: "1", theme: "Délais de paiement", texte: "Les paiements des marchés publics arrivent avec six mois de retard." },
  { id: "2", theme: "Autre (« Fiscalité »)", texte: "La fiscalité des équipements importés pèse sur nos prix." },
];

describe("recherche de l'admin (R2)", () => {
  it("rien sous deux caractères", () => {
    expect(rechercherDans("n", CEO, DOLEANCES).ceo).toHaveLength(0);
  });

  it("CEO par nom, entreprise, sans accents ni majuscules", () => {
    expect(rechercherDans("ndiaye", CEO, DOLEANCES).ceo.map((c) => c.id)).toEqual(["a"]);
    expect(rechercherDans("mbacke", CEO, DOLEANCES).ceo.map((c) => c.id)).toEqual(["c"]);
    expect(rechercherDans("HYDRO", CEO, DOLEANCES).ceo[0]).toEqual({ id: "b", titre: "Khady Diop", detail: "Niayes Hydro" });
  });

  it("CEO par téléphone, à partir de trois chiffres", () => {
    expect(rechercherDans("55 44", CEO, DOLEANCES).ceo.map((c) => c.id)).toEqual(["c"]);
    expect(rechercherDans("01 02", CEO, DOLEANCES).ceo.map((c) => c.id)).toEqual(["a"]);
  });

  it("doléances par thème ou par texte", () => {
    expect(rechercherDans("delais", CEO, DOLEANCES).doleances.map((d) => d.id)).toEqual(["1"]);
    expect(rechercherDans("fiscalite", CEO, DOLEANCES).doleances.map((d) => d.id)).toEqual(["2"]);
    expect(rechercherDans("marchés", CEO, DOLEANCES).totalDoleances).toBe(1);
  });
});
