import { writeFile } from "node:fs/promises";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { genererAccusePdf } from "./accuse-pdf";

describe("accusé de signature en PDF", () => {
  it("produit une seule page A4, avec les polices intégrées et la signature", async () => {
    const octets = await genererAccusePdf({
      reference: "MSP-2026-0001",
      signeLe: "2026-11-23T11:06:00Z",
      version: 1,
      titre: "Manifeste du secteur privé sénégalais\nde l'eau et de l'assainissement",
      prenom: "Ndèye",
      nom: "Ŋom Sow",
      fonction: "Directrice générale",
      entreprise: "Forages du Ndiambour SARL",
      maillon: "Production",
      trace: { vb: "0 0 600 250", d: ["M10 100 Q60 20 120 110 T260 90 L400 120", "M20 200 Q300 180 500 190"] },
      texteConsentement:
        "J'accepte que mon nom, ma fonction, le nom de mon entreprise et ma signature figurent dans le Manifeste et dans sa diffusion publique.",
    });
    const doc = await PDFDocument.load(octets);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
    expect(doc.getTitle()).toBe("Accusé de signature MSP-2026-0001");
    if (process.env.ACCUSE_SORTIE) await writeFile(process.env.ACCUSE_SORTIE, octets);
  });
});
