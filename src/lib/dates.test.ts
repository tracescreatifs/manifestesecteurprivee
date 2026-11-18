import { describe, expect, it } from "vitest";

import { formaterDateHeure, formaterDateHeureLongue, formaterJour } from "./dates";

describe("dates affichées, à l'heure de Dakar", () => {
  it("écrit « 1er » le premier jour du mois, jamais « 1 »", () => {
    expect(formaterJour("2026-12-01T10:00:00Z")).toBe("1er déc. 2026");
    expect(formaterDateHeure("2026-12-01T10:00:00Z")).toBe("1er déc. 2026 à 10:00");
    expect(formaterDateHeureLongue("2027-01-01T08:05:00Z")).toBe("1er janvier 2027 à 08:05");
  });

  it("garde le chiffre seul les autres jours (2, 11, 21, 31)", () => {
    expect(formaterJour("2026-12-02T10:00:00Z")).toBe("2 déc. 2026");
    expect(formaterJour("2026-11-11T10:00:00Z")).toBe("11 nov. 2026");
    expect(formaterJour("2026-11-21T10:00:00Z")).toBe("21 nov. 2026");
    expect(formaterDateHeureLongue("2026-12-31T23:59:00Z")).toBe("31 décembre 2026 à 23:59");
  });
});
