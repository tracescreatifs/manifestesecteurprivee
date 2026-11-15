import { describe, expect, it } from "vitest";

import { debutParcours, lienApresInscription, signerSurTelephonePossible } from "./parcours";

describe("signature par QR code après une inscription par /rejoindre", () => {
  const jeton = "TMtx6C6sytuAXRXUPHWXYQ";

  it("l'inscription mène au nouveau lien personnel, à l'étape 2", () => {
    expect(lienApresInscription(jeton)).toBe(`/s/${jeton}?etape=2`);
  });

  it("sur ce lien, le parcours s'ouvre à l'étape 2 et propose « Signer sur mon téléphone »", () => {
    expect(debutParcours({ jeton, reprendre: true, saisieComplete: true, etat: "ouvert", signe: false })).toEqual({
      ouvert: true,
      etape: "signature",
    });
    expect(signerSurTelephonePossible(jeton)).toBe(true);
  });

  it("sur /rejoindre, sans jeton, rien n'est proposé avant l'inscription", () => {
    expect(signerSurTelephonePossible(null)).toBe(false);
    expect(debutParcours({ jeton: null, reprendre: true, saisieComplete: true, etat: "ouvert", signe: false }).ouvert).toBe(false);
  });

  it("reprend à l'étape 1 si les informations sont incomplètes, et ne rouvre rien après la signature ou la clôture", () => {
    expect(debutParcours({ jeton, reprendre: true, saisieComplete: false, etat: "ouvert", signe: false })).toEqual({
      ouvert: true,
      etape: "infos",
    });
    expect(debutParcours({ jeton, reprendre: true, saisieComplete: true, etat: "ouvert", signe: true }).ouvert).toBe(false);
    expect(debutParcours({ jeton, reprendre: true, saisieComplete: true, etat: "clos", signe: false }).ouvert).toBe(false);
    expect(debutParcours({ jeton, reprendre: false, saisieComplete: true, etat: "ouvert", signe: false }).ouvert).toBe(false);
  });
});
