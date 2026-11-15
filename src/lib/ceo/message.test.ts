import { describe, expect, it } from "vitest";

import {
  MODELE_ORIGINE,
  formaterDateLimite,
  lienWhatsApp,
  messageInvitationConfrere,
  messageLienAdmin,
  messageLienOuvert,
  messageMonLien,
  neutraliserMiseEnForme,
  remplirModele,
} from "./message";
import { analyserMessage } from "./mise-en-forme";

const LIEN = "https://exemple.sn/s/AbCdEfGhJkMnPqRsTuVw";
const valeurs = { prenom: "Aminata", lien: LIEN, dateLimite: "2 décembre à 23 h 59" };

/* Texte affiché par WhatsApp, avec le style de chaque morceau : [gras] et (italique) */
const rendu = (message: string) =>
  analyserMessage(message)
    .map((morceaux) =>
      morceaux
        .map((m) => {
          let t = m.texte;
          if (m.italique) t = `(${t})`;
          if (m.gras) t = `[${t}]`;
          return m.lien ? `<${t}>` : t;
        })
        .join(""),
    )
    .join("\n");

describe("message WhatsApp", () => {
  it("affiche la date limite à l'heure de Dakar", () => {
    expect(formaterDateLimite("2026-12-02T23:59:00Z")).toBe("2 décembre à 23 h 59");
  });

  it("garde le modèle d'origine du prompt 06.1, sauts de ligne compris", () => {
    expect(MODELE_ORIGINE).toBe(
      [
        "Bonjour {prenom},",
        "",
        "Suite au déjeuner du 22 octobre, voici le *Manifeste du secteur privé sénégalais de l'eau et de l'assainissement*, qui sera présenté à Abu Dhabi.",
        "",
        "Vous pouvez le lire, le commenter et le signer en deux minutes, depuis votre téléphone ou votre ordinateur, avec ce lien personnel :",
        "{lien}",
        "",
        "*Merci de signer avant le {date_limite}* pour figurer dans l'exemplaire imprimé pour Abu Dhabi.",
        "",
        "Une question ? Répondez simplement à ce message.",
        "",
        "_La Task Force du secteur privé sénégalais de l'eau et de l'assainissement_",
      ].join("\n"),
    );
  });

  it("remplit le modèle, et met « Petit rappel. » en gras sur sa propre ligne pour une relance", () => {
    const message = remplirModele(MODELE_ORIGINE, valeurs);
    expect(message.startsWith("Bonjour Aminata,")).toBe(true);
    expect(message).toContain(`\n${LIEN}\n`);
    expect(message).toContain("*Merci de signer avant le 2 décembre à 23 h 59*");
    expect(message).not.toMatch(/\{(prenom|lien|date_limite)\}/);
    expect(remplirModele(MODELE_ORIGINE, valeurs, true).startsWith("*Petit rappel.*\nBonjour Aminata,")).toBe(true);
  });

  it("rend le gras, l'italique et le lien en clair comme WhatsApp", () => {
    const lignes = rendu(remplirModele(MODELE_ORIGINE, valeurs, true)).split("\n");
    expect(lignes[0]).toBe("[Petit rappel.]");
    expect(lignes[3]).toBe(
      "Suite au déjeuner du 22 octobre, voici le [Manifeste du secteur privé sénégalais de l'eau et de l'assainissement], qui sera présenté à Abu Dhabi.",
    );
    expect(lignes[6]).toBe(`<${LIEN}>`);
    expect(lignes[8]).toBe("[Merci de signer avant le 2 décembre à 23 h 59] pour figurer dans l'exemplaire imprimé pour Abu Dhabi.");
    expect(lignes.at(-1)).toBe("(La Task Force du secteur privé sénégalais de l'eau et de l'assainissement)");
    expect(lignes[11]).toBe("");
  });

  it("suit les règles de WhatsApp : pas de mise en forme au milieu d'un mot, ni sur plusieurs lignes, ni dans un lien", () => {
    expect(rendu("2*3*4 et snake_case_ici")).toBe("2*3*4 et snake_case_ici");
    expect(rendu("*début\nfin*")).toBe("*début\nfin*");
    expect(rendu("* pas gras *")).toBe("* pas gras *");
    expect(rendu("*_gras et italique_*")).toBe("[(gras et italique)]");
    expect(rendu("https://exemple.sn/_a_/*b*")).toBe("<https://exemple.sn/_a_/*b*>");
  });

  it("neutralise *, _, ~ et ` dans les données insérées, jamais dans le lien", () => {
    expect(neutraliserMiseEnForme("*Awa* _Diop_ ~x~ `y`")).toBe("\u2217Awa\u2217 \u02CDDiop\u02CD \u223Cx\u223C \u02CBy\u02CB");
    const lienAvecMarqueurs = "https://exemple.sn/s/a_b*c";
    const message = remplirModele(MODELE_ORIGINE, { ...valeurs, prenom: "*Awa_", lien: lienAvecMarqueurs });
    expect(message.startsWith("Bonjour \u2217Awa\u02CD,")).toBe(true);
    expect(message).toContain(lienAvecMarqueurs);
    /* Le prénom piégé ne casse ni le gras ni l'italique du reste du message */
    const lignes = rendu(message).split("\n");
    expect(lignes[0]).toBe("Bonjour \u2217Awa\u02CD,");
    expect(lignes.at(-1)).toBe("(La Task Force du secteur privé sénégalais de l'eau et de l'assainissement)");
    /* Un « $ » dans une donnée n'est jamais interprété par le remplacement */
    expect(remplirModele("Bonjour {prenom}", { ...valeurs, prenom: "A$&B" })).toBe("Bonjour A$&B");
    expect(messageLienAdmin("invite", "_Fatou_", LIEN).startsWith("Bonjour \u02CDFatou\u02CD,")).toBe(true);
  });

  it("met en forme les autres messages préremplis", () => {
    expect(messageLienOuvert("https://exemple.sn/rejoindre")).toBe(
      "Dirigeants d'entreprises sénégalaises de l'eau et de l'assainissement : lisez et signez le *Manifeste* qui sera présenté à Abu Dhabi.\n\nhttps://exemple.sn/rejoindre",
    );
    expect(messageMonLien(LIEN)).toBe(
      `Mon lien personnel pour le *Manifeste du secteur privé sénégalais de l'eau et de l'assainissement* :\n${LIEN}`,
    );
    expect(messageInvitationConfrere("https://exemple.sn/rejoindre?par=ABCD2345")).toBe(
      "Je viens de signer le *Manifeste du secteur privé sénégalais de l'eau et de l'assainissement*, qui sera présenté à Abu Dhabi.\n\nVous pouvez le lire et le signer ici :\nhttps://exemple.sn/rejoindre?par=ABCD2345",
    );
    expect(rendu(messageLienAdmin("reinitialisation", "Awa", LIEN)).split("\n")[2]).toBe(
      "Voici votre lien pour choisir un nouveau mot de passe sur la plateforme du [Manifeste du secteur privé sénégalais de l'eau et de l'assainissement] :",
    );
  });

  it("construit le lien wa.me avec le numéro sans le +", () => {
    expect(lienWhatsApp("+221771234567", "Bonjour à vous")).toBe("https://wa.me/221771234567?text=Bonjour%20%C3%A0%20vous");
  });
});
