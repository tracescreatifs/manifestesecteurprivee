import { describe, expect, it } from "vitest";

import type { Bloc } from "@/types/database";

import { aligner, diffMots, numerosDesPoints } from "./comparer";

const b = (id: string, type: Bloc["type"], html: string): Bloc => ({ id, type, html });

const V1 = {
  titre: "Manifeste",
  sousTitre: "Abu Dhabi",
  blocs: [
    b("p1", "p", "Introduction."),
    b("h1", "h", "Nos engagements"),
    b("e1", "li", "Premier engagement."),
    b("e2", "li", "Deuxième engagement."),
    b("h2", "h", "Nos demandes"),
    b("d1", "li", "Première demande."),
  ],
};

describe("alignement de deux versions", () => {
  it("garde les identifiants, et ne voit aucun changement sur un texte identique", () => {
    const r = aligner(V1, { ...V1, blocs: V1.blocs.map((x) => ({ ...x, id: "nouveau" })) });
    expect(r.blocs.map((x) => x.id)).toEqual(V1.blocs.map((x) => x.id));
    expect(r.resume.identique).toBe(true);
    expect(r.resume.texte).toBe("Aucune modification");
  });

  it("garde l'identifiant d'un bloc modifié, et en donne un nouveau au bloc ajouté", () => {
    const suivante = {
      ...V1,
      blocs: [
        b("x", "p", "Introduction."),
        b("x", "h", "Nos engagements"),
        b("x", "li", "Premier engagement, reformulé."),
        b("x", "li", "Deuxième engagement, reformulé."),
        b("x", "li", "Troisième engagement."),
        b("x", "h", "Nos demandes"),
        b("x", "li", "Première demande."),
      ],
    };
    const r = aligner(V1, suivante);
    expect(r.blocs.map((x) => x.id).slice(0, 4)).toEqual(["p1", "h1", "e1", "e2"]);
    expect(r.blocs[4].id).not.toBe("x");
    expect(r.blocs[5].id).toBe("h2");
    expect(r.resume.texte).toBe("2 paragraphes modifiés, 1 ajouté, dans Nos engagements");
  });

  it("compte une suppression et un titre modifié", () => {
    const r = aligner(V1, { ...V1, titre: "Autre titre", blocs: V1.blocs.filter((x) => x.id !== "d1") });
    expect(r.resume.supprimes).toBe(1);
    expect(r.resume.texte).toBe("1 paragraphe supprimé, dans Nos demandes ; titre modifié");
  });
});

describe("outils", () => {
  it("met en évidence les mots changés", () => {
    expect(diffMots("un ouvrage ne sert personne", "un ouvrage ne sert à personne")).toEqual([
      { statut: "egal", texte: "un ouvrage ne sert" },
      { statut: "ajoute", texte: "à" },
      { statut: "egal", texte: "personne" },
    ]);
  });

  it("recommence la numérotation après chaque bloc qui n'est pas un point", () => {
    expect(numerosDesPoints(V1.blocs)).toEqual([null, null, 1, 2, null, 1]);
  });
});
