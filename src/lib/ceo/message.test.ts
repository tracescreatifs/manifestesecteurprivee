import { describe, expect, it } from "vitest";

import {
  MODELE_ORIGINE,
  formaterDateLimite,
  formaterDateLimiteComplete,
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
  it("affiche la date limite en heure de Dakar et en heure d'Abu Dhabi (D105)", () => {
    /* La valeur du calendrier : clôture le 8 décembre à minuit, heure de Dakar */
    expect(formaterDateLimite("2026-12-09T00:00:00Z")).toBe("8 décembre à minuit, heure de Dakar (9 décembre à 4 h à Abu Dhabi)");
    expect(formaterDateLimiteComplete("2026-12-09T00:00:00Z")).toEqual({
      longue: "8 décembre à minuit, heure de Dakar (9 décembre à 4 h à Abu Dhabi)",
      dakar: "8 décembre à minuit, heure de Dakar",
      abuDhabi: "9 décembre à 4 h à Abu Dhabi",
    });
    /* Heure pleine, même jour : le jour n'est pas répété */
    expect(formaterDateLimite("2026-12-08T18:00:00Z")).toBe("8 décembre à 18 h, heure de Dakar (22 h à Abu Dhabi)");
    /* Minutes, jour différent */
    expect(formaterDateLimite("2026-12-02T23:59:00Z")).toBe("2 décembre à 23 h 59, heure de Dakar (3 décembre à 3 h 59 à Abu Dhabi)");
    /* Minutes à un chiffre, même jour */
    expect(formaterDateLimite("2026-12-08T09:05:00Z")).toBe("8 décembre à 9 h 05, heure de Dakar (13 h 05 à Abu Dhabi)");
    /* Minuit à Abu Dhabi : rattaché au jour qui se termine, donc le même jour qu'à Dakar */
    expect(formaterDateLimite("2026-12-08T20:00:00Z")).toBe("8 décembre à 20 h, heure de Dakar (minuit à Abu Dhabi)");
    /* « 1er » pour le premier jour du mois, jamais « 1 » ; le 2 reste « 2 » (09a.1) */
    expect(formaterDateLimite("2026-12-31T23:59:00Z")).toBe("31 décembre à 23 h 59, heure de Dakar (1er janvier à 3 h 59 à Abu Dhabi)");
    expect(formaterDateLimite("2026-12-01T10:00:00Z")).toBe("1er décembre à 10 h, heure de Dakar (14 h à Abu Dhabi)");
    expect(formaterDateLimite("2026-12-02T10:00:00Z")).toBe("2 décembre à 10 h, heure de Dakar (14 h à Abu Dhabi)");
    /* Minuit le 2 : rattaché au 1er à Dakar */
    expect(formaterDateLimite("2026-12-02T00:00:00Z")).toBe("1er décembre à minuit, heure de Dakar (2 décembre à 4 h à Abu Dhabi)");
    /* Jamais « 0 h » */
    expect(formaterDateLimite("2026-12-09T00:00:00Z")).not.toMatch(/\b0 h/);
  });

  it("garde un gras WhatsApp valide autour de la date limite", () => {
    const message = remplirModele(MODELE_ORIGINE, { ...valeurs, dateLimite: formaterDateLimite("2026-12-09T00:00:00Z") });
    expect(message).toContain(
      "*Merci de signer avant le 8 décembre à minuit, heure de Dakar (9 décembre à 4 h à Abu Dhabi)* pour figurer dans l'exemplaire imprimé pour Abu Dhabi.",
    );
    expect(rendu(message).split("\n")[7]).toBe(
      "[Merci de signer avant le 8 décembre à minuit, heure de Dakar (9 décembre à 4 h à Abu Dhabi)] pour figurer dans l'exemplaire imprimé pour Abu Dhabi.",
    );
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
    const lienOuvert = messageLienOuvert("https://exemple.sn/rejoindre", formaterDateLimite("2026-12-09T00:00:00Z"));
    expect(lienOuvert).toBe(
      [
        "Vous dirigez une entreprise sénégalaise de l'eau et de l'assainissement ? Lisez et signez le *Manifeste du secteur privé sénégalais de l'eau et de l'assainissement*, qui sera présenté à Abu Dhabi.",
        "",
        "https://exemple.sn/rejoindre",
        "",
        "*Merci de signer avant le 8 décembre à minuit, heure de Dakar (9 décembre à 4 h à Abu Dhabi).*",
        "",
        "_La Task Force du secteur privé sénégalais de l'eau et de l'assainissement_",
      ].join("\n"),
    );
    expect(rendu(lienOuvert).split("\n")).toEqual([
      "Vous dirigez une entreprise sénégalaise de l'eau et de l'assainissement ? Lisez et signez le [Manifeste du secteur privé sénégalais de l'eau et de l'assainissement], qui sera présenté à Abu Dhabi.",
      "",
      "<https://exemple.sn/rejoindre>",
      "",
      "[Merci de signer avant le 8 décembre à minuit, heure de Dakar (9 décembre à 4 h à Abu Dhabi).]",
      "",
      "(La Task Force du secteur privé sénégalais de l'eau et de l'assainissement)",
    ]);
    /* Une date piégée ne casse pas la mise en forme */
    expect(messageLienOuvert("https://exemple.sn/r_a_", "8 *déc* _x_")).toContain("*Merci de signer avant le 8 \u2217déc\u2217 \u02CDx\u02CD.*");
    expect(messageLienOuvert("https://exemple.sn/r_a_", "8 décembre")).toContain("\nhttps://exemple.sn/r_a_\n");
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
