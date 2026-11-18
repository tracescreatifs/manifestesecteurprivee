import { describe, expect, it } from "vitest";

import { heureDakar, jourDakar, joursRestants, ligneEtat, pourcentage, quandRelatif, signaturesCloses } from "./calculs";

const LIMITE = "2026-12-09T00:00:00Z";

describe("tableau de bord : calculs (D120)", () => {
  it("pourcentage entier, plafonné à 100, nul si le total est nul", () => {
    expect(pourcentage(0, 120)).toBe(0);
    expect(pourcentage(42, 120)).toBe(35);
    expect(pourcentage(1, 3)).toBe(33);
    expect(pourcentage(130, 120)).toBe(100);
    expect(pourcentage(5, 0)).toBe(0);
  });

  it("jour et heure de Dakar", () => {
    expect(jourDakar(new Date("2026-11-18T23:59:00Z"))).toBe("2026-11-18");
    expect(heureDakar("2026-11-18T09:05:00Z")).toBe("9 h 05");
  });

  it("jours restants : minuit appartient au jour qui se termine", () => {
    expect(joursRestants(LIMITE, new Date("2026-11-18T10:00:00Z"))).toBe(20);
    expect(joursRestants(LIMITE, new Date("2026-12-07T23:59:00Z"))).toBe(1);
    expect(joursRestants(LIMITE, new Date("2026-12-08T00:00:00Z"))).toBe(0);
    expect(joursRestants(LIMITE, new Date("2026-12-08T23:59:59Z"))).toBe(0);
    expect(joursRestants(LIMITE, new Date("2026-12-09T00:00:00Z"))).toBeNull();
  });

  it("dernier export : aujourd'hui, hier, ou la date en lettres", () => {
    const maintenant = new Date("2026-12-01T20:00:00Z");
    expect(quandRelatif("2026-12-01T19:04:00Z", maintenant)).toBe("Aujourd'hui à 19 h 04");
    expect(quandRelatif("2026-11-30T21:04:00Z", maintenant)).toBe("Hier à 21 h 04");
    expect(quandRelatif("2026-11-14T21:04:00Z", maintenant)).toBe("14 novembre à 21 h 04");
    expect(quandRelatif("2026-11-01T08:00:00Z", maintenant)).toBe("1er novembre à 8 h 00");
  });

  it("ligne d'état selon le cycle de vie", () => {
    const base = { version: { numero: 1, correction: false }, geleLe: null, closLe: null, publieLe: null, dateLimite: LIMITE };
    expect(ligneEtat({ ...base, statut: "redaction", version: null })).toBe("En rédaction, aucune version importée");
    expect(ligneEtat({ ...base, statut: "redaction" })).toBe("En rédaction, version 1");
    expect(ligneEtat({ ...base, statut: "gele", geleLe: "2026-11-20T10:00:00Z" })).toBe("Version 1, gelée le 20 novembre");
    expect(ligneEtat({ ...base, statut: "gele", version: { numero: 2, correction: true }, geleLe: "2026-12-01T10:00:00Z" })).toBe(
      "Version 2 (correction mineure), gelée le 1er décembre",
    );
    expect(ligneEtat({ ...base, statut: "clos", closLe: "2026-12-09T00:00:00Z" })).toBe("Version 1, signatures closes le 9 décembre");
    expect(ligneEtat({ ...base, statut: "publie", publieLe: "2026-12-10T08:00:00Z" })).toBe("Document final publié le 10 décembre");
  });

  it("signatures closes : clôture enregistrée ou date limite passée", () => {
    expect(signaturesCloses("redaction", LIMITE, new Date("2026-12-10T00:00:00Z"))).toBe(false);
    expect(signaturesCloses("gele", LIMITE, new Date("2026-12-08T23:00:00Z"))).toBe(false);
    expect(signaturesCloses("gele", LIMITE, new Date("2026-12-09T00:00:00Z"))).toBe(true);
    expect(signaturesCloses("clos", LIMITE, new Date("2026-11-20T00:00:00Z"))).toBe(true);
  });
});
