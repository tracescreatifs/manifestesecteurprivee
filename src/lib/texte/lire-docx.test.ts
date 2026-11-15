import { readFileSync } from "node:fs";
import { join } from "node:path";

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { lireDocx } from "./lire-docx";

const MODELE = new Uint8Array(readFileSync(join(process.cwd(), "docs/prototypes/Modele_Manifeste_GoogleDoc.docx")));

/* Copie du modèle dont word/document.xml est transformé */
function modeleModifie(transformer: (xml: string) => string): Uint8Array {
  const fichiers = unzipSync(MODELE);
  fichiers["word/document.xml"] = strToU8(transformer(strFromU8(fichiers["word/document.xml"])));
  return zipSync(fichiers);
}

describe("lecture du modèle Word", () => {
  const r = lireDocx(MODELE);
  const types = r.blocs.map((b) => b.type);

  it("reconnaît le titre, sur deux lignes, et le sous-titre", () => {
    expect(r.titre).toBe("Manifeste du secteur privé sénégalais\nde l'eau et de l'assainissement");
    expect(r.sousTitre).toBe("Conférence des Nations Unies sur l'eau · Abu Dhabi, décembre 2026");
  });

  it("reconnaît les quatre intertitres", () => {
    expect(r.blocs.filter((b) => b.type === "h").map((b) => b.html)).toEqual([
      "Notre constat",
      "Nos engagements",
      "Nos demandes",
      "Notre conviction",
    ]);
  });

  it("reconnaît les deux listes numérotées : 6 engagements, puis 4 demandes", () => {
    const debutEngagements = types.indexOf("li");
    expect(types.slice(debutEngagements, debutEngagements + 6)).toEqual(Array(6).fill("li"));
    expect(types[debutEngagements + 6]).toBe("h");
    expect(types.slice(debutEngagements + 7, debutEngagements + 11)).toEqual(Array(4).fill("li"));
    expect(types.filter((t) => t === "li")).toHaveLength(10);
  });

  it("reconnaît l'accroche et la mention, à la fin", () => {
    expect(types.slice(-2)).toEqual(["accroche", "mention"]);
    expect(r.blocs.at(-2)?.html).toBe("Un secteur privé uni est un secteur privé plus fort.");
  });

  it("conserve le gras et échappe le texte", () => {
    const engagement = r.blocs.find((b) => b.type === "li");
    expect(engagement?.html).toBe(
      "<strong>Nous organiser,</strong> à tous les niveaux : localement, nationalement, au sein de la CEDEAO, en Afrique et dans les enceintes internationales.",
    );
    expect(r.blocs.find((b) => b.html.includes("Réunis à Dakar"))?.html).toContain("d&#39;une seule voix");
  });

  it("n'a aucun avertissement bloquant", () => {
    expect(r.avertissements.filter((a) => a.niveau === "bloquant")).toEqual([]);
  });

  it("signale le commentaire du modèle comme simple information", () => {
    expect(r.avertissements).toContainEqual({ niveau: "info", message: "1 commentaire ignoré." });
  });
});

describe("avertissements", () => {
  it("bloque un fichier avec des suggestions non acceptées", () => {
    const octets = modeleModifie((xml) =>
      xml.replace(
        "<w:r><w:t xml:space=\"preserve\">Notre constat</w:t></w:r>",
        '<w:ins w:id="99" w:author="X" w:date="2026-11-15T00:00:00Z"><w:r><w:t xml:space="preserve">Notre constat</w:t></w:r></w:ins>',
      ),
    );
    const r = lireDocx(octets);
    expect(r.avertissements.some((a) => a.niveau === "bloquant" && a.message.includes("suggestion"))).toBe(true);
  });

  it("bloque un fichier sans paragraphe au style Titre", () => {
    const r = lireDocx(modeleModifie((xml) => xml.replace('<w:pStyle w:val="Title"/>', "")));
    expect(r.avertissements.some((a) => a.niveau === "bloquant" && a.message.includes("« Titre »"))).toBe(true);
  });

  it("signale un paragraphe entièrement en gras", () => {
    const r = lireDocx(
      modeleModifie((xml) =>
        xml.replace(
          "<w:body>",
          '<w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Nos partenaires</w:t></w:r></w:p>',
        ),
      ),
    );
    expect(r.avertissements.some((a) => a.niveau === "attention" && a.message.includes("Nos partenaires"))).toBe(true);
  });

  it("refuse un fichier qui n'est pas un .docx", () => {
    expect(() => lireDocx(strToU8("ceci n'est pas un fichier Word"))).toThrow();
  });
});
