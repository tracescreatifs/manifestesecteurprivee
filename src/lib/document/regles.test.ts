import { describe, expect, it } from "vitest";

import { nombrePagesAnnexe, paginerAnnexe, reglagesDuManifeste, REGLAGES_ANNEXE, type LigneAnnexeA4 } from "@/lib/signature/annexe";

import { cheminPdfFinal, dateDeReouverture, estJpeg, estPdf, peutGererSurPlace, peutReglerAnnexe, schemaSignataireSurPlace } from "./regles";

const MAILLONS = ["Études", "Production"];
const ligne = (n: number): LigneAnnexeA4 => ({
  cle: `s${n}`,
  prenom: "P",
  nom: `Nom ${String(n).padStart(3, "0")}`,
  fonction: "DG",
  entreprise: `Entreprise ${String(n).padStart(3, "0")}`,
  maillon: "Production",
  trace: null,
  signeLe: "2026-11-23T10:00:00Z",
});

describe("document final : réglages de l'annexe (D69)", () => {
  it("lit les réglages du Manifeste, avec les valeurs par défaut sans la migration 0010 ou si une valeur est inattendue", () => {
    expect(reglagesDuManifeste({ annexe_ordre: "maillon", annexe_lignes_par_page: 15, annexe_lignes_vides: 5 })).toEqual({
      ordre: "maillon",
      parPage: 15,
      lignesVides: 5,
    });
    expect(reglagesDuManifeste({})).toEqual(REGLAGES_ANNEXE);
    expect(reglagesDuManifeste(null)).toEqual(REGLAGES_ANNEXE);
    expect(reglagesDuManifeste({ annexe_ordre: "couleur", annexe_lignes_par_page: 12, annexe_lignes_vides: 3 })).toEqual(REGLAGES_ANNEXE);
  });

  it("compte les pages de l'annexe : signatures, puis lignes vides numérotées ; jamais une ligne coupée entre deux pages", () => {
    expect(nombrePagesAnnexe(0, { ordre: "entreprise", parPage: 10, lignesVides: 0 })).toBe(1);
    expect(nombrePagesAnnexe(10, { ordre: "entreprise", parPage: 10, lignesVides: 0 })).toBe(1);
    expect(nombrePagesAnnexe(11, { ordre: "entreprise", parPage: 10, lignesVides: 0 })).toBe(2);
    expect(nombrePagesAnnexe(23, { ordre: "entreprise", parPage: 8, lignesVides: 10 })).toBe(5);
    const pages = paginerAnnexe(Array.from({ length: 23 }, (_, k) => ligne(k)), { ordre: "nom", parPage: 8, lignesVides: 10 });
    expect(pages.map((p) => p.length)).toEqual([8, 8, 8, 8, 1]);
    expect(pages.flat().filter((l) => l === null)).toHaveLength(10);
    expect(pages[0][0]?.nom).toBe("Nom 000");
  });
});

describe("document final : signataires sur place", () => {
  it("dit quoi corriger, et accepte une saisie complète", () => {
    const s = schemaSignataireSurPlace(MAILLONS);
    expect(s.safeParse({ prenom: " Awa ", nom: "Faye", fonction: "DG", entreprise: "Ferlo", maillon: "Production" }).success).toBe(true);
    const r = s.safeParse({ prenom: "", nom: "Faye", fonction: "DG", entreprise: "Ferlo", maillon: "Autre" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual(["Indiquez le prénom.", "Choisissez le maillon."]);
  });
  it("seulement quand le Manifeste est clos ; les réglages, jusqu'à la publication", () => {
    expect(peutGererSurPlace("gele")).toBe(false);
    expect(peutGererSurPlace("clos")).toBe(true);
    expect(peutGererSurPlace("publie")).toBe(false);
    expect(peutReglerAnnexe("clos")).toBe(true);
    expect(peutReglerAnnexe("publie")).toBe(false);
  });
  it("reconnaît le type réel d'un fichier par ses premiers octets", () => {
    expect(estPdf(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
    expect(estPdf(new TextEncoder().encode("<html>"))).toBe(false);
    expect(estJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(estJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });
});

describe("document final : réouverture (D18) et PDF déposé", () => {
  const maintenant = new Date("2026-12-09T05:00:00Z");
  it("refuse une date passée ou mal saisie", () => {
    expect(dateDeReouverture("2026-12-09T04:59", maintenant)).toEqual({ ok: false, erreur: "Cette date est déjà passée. Choisissez une date à venir." });
    expect(dateDeReouverture("", maintenant)).toEqual({ ok: false, erreur: "Indiquez la nouvelle date et l'heure limites." });
    expect(dateDeReouverture("2026-12-10T00:00", maintenant)).toEqual({ ok: true, date: new Date("2026-12-10T00:00:00Z") });
  });
  it("range le PDF dans exports, sous un nom horodaté", () => {
    expect(cheminPdfFinal(new Date("2026-12-10T18:05:09Z"))).toBe("document-final/manifeste-20261210-180509.pdf");
  });
});
