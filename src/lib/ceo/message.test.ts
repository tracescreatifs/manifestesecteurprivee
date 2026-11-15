import { describe, expect, it } from "vitest";

import { MODELE_ORIGINE, formaterDateLimite, lienWhatsApp, remplirModele } from "./message";

describe("message WhatsApp", () => {
  it("affiche la date limite à l'heure de Dakar", () => {
    expect(formaterDateLimite("2026-12-02T23:59:00Z")).toBe("2 décembre à 23 h 59");
  });

  it("remplit le modèle, et ajoute « Petit rappel. » pour une relance", () => {
    const valeurs = { prenom: "Aminata", lien: "https://exemple.sn/s/ABC", dateLimite: "2 décembre à 23 h 59" };
    const message = remplirModele(MODELE_ORIGINE, valeurs);
    expect(message.startsWith("Bonjour Aminata,")).toBe(true);
    expect(message).toContain("https://exemple.sn/s/ABC");
    expect(message).toContain("avant le 2 décembre à 23 h 59");
    expect(message).not.toMatch(/\{(prenom|lien|date_limite)\}/);
    expect(remplirModele(MODELE_ORIGINE, valeurs, true).startsWith("Petit rappel. Bonjour Aminata,")).toBe(true);
  });

  it("construit le lien wa.me avec le numéro sans le +", () => {
    expect(lienWhatsApp("+221771234567", "Bonjour à vous")).toBe("https://wa.me/221771234567?text=Bonjour%20%C3%A0%20vous");
  });
});
