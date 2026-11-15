import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { LineCapStyle, PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { traceSure } from "@/components/document/signature";
import { formaterDateHeureLongue } from "@/lib/dates";
import type { TraceSignature } from "@/types/database";

/*
  Accusé de signature en PDF (D74), fidèle à la page /s/[jeton]/accuse :
  A4, Gelasio et Carlito intégrés (sous-ensembles latins), signature dessinée en vectoriel.
  Les mesures reprennent celles de la page : 1 % de la largeur de la page (cqw) = 5,95 points.
*/

export type DonneesAccuse = {
  reference: string;
  signeLe: string;
  version: number;
  titre: string;
  prenom: string;
  nom: string;
  fonction: string;
  entreprise: string;
  maillon: string;
  trace: TraceSignature | null;
  texteConsentement: string;
};

const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const U = LARGEUR / 100;
const MARGE_X = 10.5 * U;
const MARGE_HAUT = 6.7 * U;
const MARGE_BAS = 5.2 * U;
const UTILE = LARGEUR - 2 * MARGE_X;

const VERT = rgb(0x0e / 255, 0x4b / 255, 0x3a / 255);
const OR = rgb(0xc2 / 255, 0xa1 / 255, 0x4d / 255);
const GRIS = rgb(0x6a / 255, 0x73 / 255, 0x6e / 255);
const TEXTE = rgb(0x1e / 255, 0x26 / 255, 0x22 / 255);
const FILET = rgb(0xd9 / 255, 0xd3 / 255, 0xc2 / 255);
const ENCRE = rgb(0x14 / 255, 0x21 / 255, 0x2b / 255);

const POLICES = join(process.cwd(), "src/assets/polices");

/* Découpe un texte en lignes qui tiennent dans la largeur donnée */
function lignes(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const sortie: string[] = [];
  for (const paragraphe of texte.split("\n")) {
    let courante = "";
    for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) <= largeur || !courante) courante = essai;
      else {
        sortie.push(courante);
        courante = mot;
      }
    }
    sortie.push(courante);
  }
  return sortie;
}

/* Les caractères absents des polices sont remplacés, pour ne jamais faire échouer l'accusé */
function lisible(texte: string, police: PDFFont): string {
  const jeu = new Set(police.getCharacterSet());
  return Array.from(texte.normalize("NFC"))
    .map((c) => (jeu.has(c.codePointAt(0) ?? 0) || c === "\n" ? c : (c.normalize("NFD").replace(/[̀-ͯ]/g, "") || "?")))
    .join("");
}

function centrer(page: PDFPage, texte: string, police: PDFFont, taille: number, y: number, couleur = TEXTE, espacement = 0) {
  const largeur = police.widthOfTextAtSize(texte, taille) + espacement * Math.max(0, texte.length - 1);
  if (!espacement) {
    page.drawText(texte, { x: (LARGEUR - largeur) / 2, y, size: taille, font: police, color: couleur });
    return;
  }
  let x = (LARGEUR - largeur) / 2;
  for (const c of texte) {
    page.drawText(c, { x, y, size: taille, font: police, color: couleur });
    x += police.widthOfTextAtSize(c, taille) + espacement;
  }
}

export async function genererAccusePdf(d: DonneesAccuse): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [serif, sans, sansGras, sansItalique] = await Promise.all(
    ["Gelasio-Regular", "Carlito-Regular", "Carlito-Bold", "Carlito-Italic"].map(async (nom) =>
      doc.embedFont(await readFile(join(POLICES, `${nom}-latin.ttf`)), { subset: true }),
    ),
  );
  doc.setTitle(`Accusé de signature ${d.reference}`);
  doc.setSubject("Manifeste du secteur privé sénégalais de l'eau et de l'assainissement");
  doc.setProducer("Plateforme du Manifeste");
  doc.setCreator("Plateforme du Manifeste");
  doc.setLanguage("fr-FR");

  const page = doc.addPage([LARGEUR, HAUTEUR]);
  /* y : haut de la ligne courante, mesuré depuis le haut de la page */
  let y = MARGE_HAUT;
  const base = (haut: number, taille: number) => HAUTEUR - haut - taille * 0.8;

  /* Surtitre */
  const tailleKicker = 1.25 * U;
  centrer(page, "ACCUSÉ DE SIGNATURE", sansGras, tailleKicker, base(y, tailleKicker), OR, tailleKicker * 0.14);
  y += tailleKicker * 1.38 + 1.6 * U;

  /* Titre : le retour à la ligne du Word est gardé (comme la page A4) */
  const tailleTitre = 3.55 * U;
  for (const ligne of lignes(lisible(d.titre, serif), serif, tailleTitre, UTILE)) {
    centrer(page, ligne, serif, tailleTitre, base(y, tailleTitre), VERT);
    y += tailleTitre * 1.18;
  }

  /* Sous-titre et filet or */
  y += 1.4 * U;
  const tailleSous = 1.4 * U;
  centrer(page, `Version ${d.version} du texte`, sans, tailleSous, base(y, tailleSous), GRIS);
  y += tailleSous * 1.38 + 2.2 * U;
  page.drawLine({ start: { x: MARGE_X, y: HAUTEUR - y }, end: { x: LARGEUR - MARGE_X, y: HAUTEUR - y }, thickness: 0.22 * U, color: OR });
  y += 2.6 * U;

  /* Signataire */
  const tailleNom = 2.6 * U;
  page.drawText(lisible(`${d.prenom} ${d.nom}`, serif), { x: MARGE_X, y: base(y, tailleNom), size: tailleNom, font: serif, color: VERT });
  y += tailleNom * 1.35 + 0.6 * U;
  const tailleInfo = 1.9 * U;
  for (const ligne of lignes(lisible(`${d.fonction}, ${d.entreprise}`, sans), sans, tailleInfo, UTILE)) {
    page.drawText(ligne, { x: MARGE_X, y: base(y, tailleInfo), size: tailleInfo, font: sans, color: TEXTE });
    y += tailleInfo * 1.35;
  }
  y += 0.6 * U;
  page.drawText(lisible(`Maillon : ${d.maillon}`, sans), { x: MARGE_X, y: base(y, tailleInfo), size: tailleInfo, font: sans, color: GRIS });
  y += tailleInfo * 1.35;

  /* Signature : cadre de 16 % de la largeur, alignée en bas à gauche (xMinYMax meet) */
  y += 3 * U;
  const hauteurCadre = 16 * U;
  const trace = d.trace ? traceSure(d.trace) : null;
  if (trace) {
    const [, , w, h] = trace.vb.split(" ").map(Number);
    const echelle = Math.min(UTILE / w, hauteurCadre / h);
    const origineY = HAUTEUR - y - (hauteurCadre - h * echelle);
    for (const chemin of trace.d) {
      page.drawSvgPath(chemin, {
        x: MARGE_X,
        y: origineY,
        scale: echelle,
        borderColor: ENCRE,
        borderWidth: 3.2 * echelle,
        borderLineCap: LineCapStyle.Round,
      });
    }
  }
  y += hauteurCadre;
  page.drawLine({ start: { x: MARGE_X, y: HAUTEUR - y }, end: { x: LARGEUR - MARGE_X, y: HAUTEUR - y }, thickness: 0.75, color: FILET });
  y += 1 * U + 2.4 * U;

  /* Référence, date, version */
  const tailleDl = 1.7 * U;
  const libelles: [string, string, PDFFont][] = [
    ["Référence", d.reference, sansGras],
    ["Signé le", `${formaterDateHeureLongue(d.signeLe)} (heure de Dakar)`, sans],
    ["Version signée", `Version ${d.version}`, sans],
  ];
  const colonne = Math.max(...libelles.map(([l]) => sans.widthOfTextAtSize(l, tailleDl))) + 3 * U;
  for (const [libelle, valeur, police] of libelles) {
    page.drawText(libelle, { x: MARGE_X, y: base(y, tailleDl), size: tailleDl, font: sans, color: GRIS });
    page.drawText(lisible(valeur, police), { x: MARGE_X + colonne, y: base(y, tailleDl), size: tailleDl, font: police, color: TEXTE });
    y += tailleDl * 1.38 + 1 * U;
  }

  /* Consentement accepté */
  y += 3 * U;
  const tailleConsent = 1.6 * U;
  page.drawText("Consentement accepté au moment de signer", { x: MARGE_X, y: base(y, tailleConsent), size: tailleConsent, font: sans, color: GRIS });
  y += tailleConsent * 1.38 + 0.8 * U;
  for (const ligne of lignes(lisible(`« ${d.texteConsentement} »`, sansItalique), sansItalique, tailleConsent, UTILE)) {
    page.drawText(ligne, { x: MARGE_X, y: base(y, tailleConsent), size: tailleConsent, font: sansItalique, color: TEXTE });
    y += tailleConsent * 1.38;
  }

  /* Pied de page */
  const taillePied = 1.15 * U;
  const yPied = MARGE_BAS;
  page.drawText("Manifeste du secteur privé sénégalais de l'eau et de l'assainissement", {
    x: MARGE_X,
    y: yPied,
    size: taillePied,
    font: sans,
    color: GRIS,
  });
  page.drawText(d.reference, {
    x: LARGEUR - MARGE_X - sans.widthOfTextAtSize(d.reference, taillePied),
    y: yPied,
    size: taillePied,
    font: sans,
    color: GRIS,
  });

  return doc.save();
}
