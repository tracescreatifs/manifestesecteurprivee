import { describe, expect, it } from "vitest";

import { estARelancer, estAVerifier } from "./compteurs";

describe("compteurs partagés (R2)", () => {
  it("à vérifier : en attente et signature active", () => {
    expect(estAVerifier("a_verifier", true)).toBe(true);
    expect(estAVerifier("a_verifier", false)).toBe(false);
    expect(estAVerifier("verifie", true)).toBe(false);
  });

  it("à relancer : envoyé ou ouvert, non signé, avec un numéro", () => {
    expect(estARelancer("envoye", "+221 77 000 00 00")).toBe(true);
    expect(estARelancer("ouvert", "+221 77 000 00 00")).toBe(true);
    expect(estARelancer("a_envoyer", "+221 77 000 00 00")).toBe(false);
    expect(estARelancer("signe", "+221 77 000 00 00")).toBe(false);
    expect(estARelancer("ouvert", "  ")).toBe(false);
    expect(estARelancer("envoye", null)).toBe(false);
  });
});
