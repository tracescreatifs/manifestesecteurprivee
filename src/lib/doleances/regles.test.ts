import { describe, expect, it } from "vitest";

import {
  AUTRE,
  deposer,
  erreursDoleance,
  etatDoleances,
  LIMITE_PAR_JOUR,
  libelleTheme,
  peutDeposer,
  type DepotDoleance,
} from "./regles";

const THEME = "2f1b8a54-6c2d-4f0e-9a51-3d0c8f1e7a10";
const SAISIE = {
  theme: THEME,
  themePropose: "",
  texte: "Les paiements des marchés publics arrivent avec six mois de retard.",
  solution: "Un délai légal de 60 jours.",
  neJamaisPublier: false,
};

/* Faux dépôt en mémoire, qui reprend les règles de la fonction SQL deposer_doleance (migration 0009) */
function base() {
  const doleances: { id: string; cle: string; texte: string }[] = [];
  const depot: DepotDoleance = {
    async deposer(e) {
      const deja = doleances.find((d) => d.cle === e.cle);
      if (deja) return { ok: true, id: deja.id, renvoi: true };
      if (doleances.length >= e.limiteParJour) return { ok: false, code: "limite_atteinte" };
      const id = `dol-${doleances.length + 1}`;
      doleances.push({ id, cle: e.cle, texte: e.texte });
      return { ok: true, id, renvoi: false };
    },
  };
  let n = 0;
  const cle = () => `cle-doleance-${String(++n).padStart(6, "0")}`;
  return { doleances, depot, cle };
}

describe("doléances : ouverture et clôture", () => {
  const CLOTURE = "2027-01-08T23:59:00Z";
  it("fermées en rédaction, ouvertes dès le gel, même après la clôture des signatures", () => {
    expect(etatDoleances("redaction", CLOTURE, new Date("2026-11-20T10:00:00Z"))).toBe("pas_ouvert");
    expect(etatDoleances("gele", CLOTURE, new Date("2026-11-23T10:00:00Z"))).toBe("ouvert");
    expect(etatDoleances("clos", CLOTURE, new Date("2026-12-10T10:00:00Z"))).toBe("ouvert");
    expect(etatDoleances("publie", CLOTURE, new Date("2027-01-05T10:00:00Z"))).toBe("ouvert");
  });
  it("closes après la date de clôture des doléances, à la minute près", () => {
    expect(etatDoleances("publie", CLOTURE, new Date("2027-01-08T23:59:00Z"))).toBe("ouvert");
    expect(etatDoleances("publie", CLOTURE, new Date("2027-01-08T23:59:01Z"))).toBe("clos");
  });
});

describe("doléances : droit de dépôt (D28)", () => {
  it("CEO de la liste, signataire ou non ; jamais un lien rejeté", () => {
    expect(peutDeposer({ origine: "liste", verification: "aucune", signatureValidee: false })).toBe(true);
    expect(peutDeposer({ origine: "liste", verification: "a_verifier", signatureValidee: false })).toBe(true);
    expect(peutDeposer({ origine: "liste", verification: "rejete", signatureValidee: true })).toBe(false);
  });
  it("nouvel inscrit seulement après la validation de sa signature par un admin", () => {
    expect(peutDeposer({ origine: "lien_ouvert", verification: "aucune", signatureValidee: false })).toBe(false);
    expect(peutDeposer({ origine: "parrainage", verification: "a_verifier", signatureValidee: false })).toBe(false);
    expect(peutDeposer({ origine: "lien_ouvert", verification: "valide", signatureValidee: true })).toBe(true);
    /* Validé, puis signature retirée par le CEO : le droit reste acquis */
    expect(peutDeposer({ origine: "parrainage", verification: "aucune", signatureValidee: true })).toBe(true);
  });
});

describe("doléances : longueurs et thème", () => {
  it("accepte une doléance complète, avec ou sans solution", () => {
    expect(erreursDoleance(SAISIE)).toBeNull();
    expect(erreursDoleance({ ...SAISIE, solution: "" })).toBeNull();
    expect(erreursDoleance({ ...SAISIE, theme: AUTRE, themePropose: "" })).toBeNull();
  });
  it("dit quoi corriger : texte de 15 à 500 caractères, solution de 400 au plus, thème proposé de 60 au plus", () => {
    expect(erreursDoleance({ ...SAISIE, texte: "Trop court." })?.texte).toBe("Décrivez la difficulté en 15 caractères au moins.");
    /* Les espaces autour ne comptent pas */
    expect(erreursDoleance({ ...SAISIE, texte: `   ${"a".repeat(14)}   ` })?.texte).toBeDefined();
    expect(erreursDoleance({ ...SAISIE, texte: "a".repeat(500) })).toBeNull();
    expect(erreursDoleance({ ...SAISIE, texte: "a".repeat(501) })?.texte).toBe("Votre doléance : 500 caractères au plus.");
    expect(erreursDoleance({ ...SAISIE, solution: "s".repeat(401) })?.solution).toBe("Proposition de solution : 400 caractères au plus.");
    expect(erreursDoleance({ ...SAISIE, theme: AUTRE, themePropose: "t".repeat(61) })?.themePropose).toBe(
      "Votre thème : 60 caractères au plus.",
    );
    expect(erreursDoleance({ ...SAISIE, theme: "" })?.theme).toBe("Choisissez un thème.");
    expect(erreursDoleance({ ...SAISIE, theme: "n'importe quoi" })?.theme).toBe("Choisissez un thème.");
  });
  it("libellé du thème : « Autre », avec le thème proposé", () => {
    expect(libelleTheme("Délais de paiement", null)).toBe("Délais de paiement");
    expect(libelleTheme(null, "Fiscalité")).toBe("Autre (« Fiscalité »)");
    expect(libelleTheme(null, null)).toBe("Autre");
  });
});

describe("doléances : dépôt, anti-doublon et limite", () => {
  it("un renvoi avec la même clé (coupure de connexion, double clic) ne crée qu'une doléance", async () => {
    const { doleances, depot, cle } = base();
    const k = cle();
    const premier = await deposer(depot, { cle: k, saisie: SAISIE });
    const renvoi = await deposer(depot, { cle: k, saisie: SAISIE });
    expect(premier).toEqual({ ok: true, id: "dol-1", renvoi: false });
    expect(renvoi).toEqual({ ok: true, id: "dol-1", renvoi: true });
    expect(doleances).toHaveLength(1);
  });
  it("refuse une clé absente ou trop courte, sans rien créer", async () => {
    const { doleances, depot } = base();
    expect(await deposer(depot, { cle: "", saisie: SAISIE })).toEqual({ ok: false, code: "cle_invalide" });
    expect(await deposer(depot, { cle: "courte", saisie: SAISIE })).toEqual({ ok: false, code: "cle_invalide" });
    expect(doleances).toHaveLength(0);
  });
  it("refuse une saisie invalide avec le champ à corriger, sans rien créer", async () => {
    const { doleances, depot, cle } = base();
    const r = await deposer(depot, { cle: cle(), saisie: { ...SAISIE, texte: "Court" } });
    expect(r).toMatchObject({ ok: false, code: "texte_invalide", champs: { texte: "Décrivez la difficulté en 15 caractères au moins." } });
    expect(doleances).toHaveLength(0);
  });
  it(`limite à ${LIMITE_PAR_JOUR} doléances par jour et par lien`, async () => {
    const { depot, cle } = base();
    for (let i = 0; i < LIMITE_PAR_JOUR; i++) expect((await deposer(depot, { cle: cle(), saisie: SAISIE })).ok).toBe(true);
    expect(await deposer(depot, { cle: cle(), saisie: SAISIE })).toEqual({ ok: false, code: "limite_atteinte" });
  });
  it("« Autre » : pas de thème, le thème proposé est gardé ; espaces retirés, solution vide enregistrée comme absente", async () => {
    const recu: unknown[] = [];
    const depot: DepotDoleance = {
      async deposer(e) {
        recu.push(e);
        return { ok: true, id: "x", renvoi: false };
      },
    };
    await deposer(depot, {
      cle: "cle-doleance-autre-01",
      saisie: { ...SAISIE, theme: AUTRE, themePropose: "  Fiscalité  ", texte: `  ${SAISIE.texte}  `, solution: "  " },
    });
    expect(recu[0]).toEqual({
      cle: "cle-doleance-autre-01",
      themeId: null,
      themePropose: "Fiscalité",
      texte: SAISIE.texte,
      solution: null,
      neJamaisPublier: false,
      limiteParJour: LIMITE_PAR_JOUR,
    });
  });
});
