import { DOMParser, type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from "@xmldom/xmldom";
import { strFromU8, unzipSync } from "fflate";

import type { Bloc } from "@/types/database";

import { echapper, texteBrut } from "./html";

/*
  Lecture d'un fichier Word (.docx) téléchargé depuis le Google Doc.
  Correspondance des styles (cahier des charges, partie 5.1) :
    Titre (Title) : titre ; Sous-titre (Subtitle) : sous ;
    Titre 1 : intertitre (h) ; Titre 2 : accroche ; Titre 3 : mention ;
    Titre 4 à 9 : intertitre, avec un avertissement ;
    paragraphe numéroté (w:numPr dans le paragraphe ou dans son style) : li ;
    le reste : paragraphe (p).
  Seul le gras est conservé (strong). Tout le texte est échappé.
*/

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export type NiveauAvertissement = "bloquant" | "attention" | "info";
export type Avertissement = { niveau: NiveauAvertissement; message: string };

export type ResultatLecture = {
  titre: string;
  sousTitre: string;
  blocs: Bloc[];
  avertissements: Avertissement[];
};

export class ErreurLecture extends Error {}

type Genre = "titre" | "sous" | "h" | "accroche" | "mention" | "titre_bas" | "normal";
type InfoStyle = { nom: string; parent: string | null; numerote: boolean | null };

/* Minuscules, sans accents, sans espaces ni tirets : « Sous-titre » devient « soustitre » */
function cle(valeur: string | null | undefined): string {
  return (valeur ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function attribut(el: XmlElement | null | undefined, nom: string): string | null {
  if (!el) return null;
  return el.getAttributeNS(W, nom) ?? el.getAttribute(`w:${nom}`);
}

function enfant(el: XmlElement | null | undefined, nom: string): XmlElement | null {
  if (!el) return null;
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as XmlElement).localName === nom && (n as XmlElement).namespaceURI === W) {
      return n as XmlElement;
    }
  }
  return null;
}

function enfants(el: XmlNode): XmlElement[] {
  const liste: XmlElement[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) liste.push(n as XmlElement);
  return liste;
}

/* Propriété booléenne de Word (w:b) : présente et pas à « false », « 0 » ou « none » */
function actif(el: XmlElement | null): boolean {
  if (!el) return false;
  const v = attribut(el, "val");
  return !(v === "0" || v === "false" || v === "none" || v === "off");
}

/* Un w:numPr qui désigne une vraie liste (numId différent de 0) */
function numerotation(pPr: XmlElement | null): boolean | null {
  const numPr = enfant(pPr, "numPr");
  if (!numPr) return null;
  const numId = attribut(enfant(numPr, "numId"), "val");
  return numId !== null && numId !== "0";
}

function genreDuNom(valeur: string): Genre | null {
  const k = cle(valeur);
  if (k === "title" || k === "titre") return "titre";
  if (k === "subtitle" || k === "soustitre") return "sous";
  if (k === "heading1" || k === "titre1") return "h";
  if (k === "heading2" || k === "titre2") return "accroche";
  if (k === "heading3" || k === "titre3") return "mention";
  if (/^(heading|titre)[4-9]$/.test(k)) return "titre_bas";
  return null;
}

function lireXml(fichiers: Record<string, Uint8Array>, chemin: string): XmlDocument | null {
  const contenu = fichiers[chemin];
  if (!contenu) return null;
  return new DOMParser().parseFromString(strFromU8(contenu), "text/xml");
}

function nouvelId(): string {
  return `b${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

/* 20 Mo de XML décompressé par fichier, 40 Mo au total : bien au-delà d'un texte de Manifeste */
const TAILLE_XML_MAX = 20 * 1024 * 1024;

export function lireDocx(octets: Uint8Array): ResultatLecture {
  let fichiers: Record<string, Uint8Array>;
  try {
    /* Taille décompressée plafonnée : un fichier piégé ne peut pas saturer la mémoire du serveur */
    let total = 0;
    fichiers = unzipSync(octets, {
      filter: (f) => {
        if (!(f.name.startsWith("word/") && f.name.endsWith(".xml"))) return false;
        total += f.originalSize;
        if (f.originalSize > TAILLE_XML_MAX || total > TAILLE_XML_MAX * 2) throw new Error("trop_gros");
        return true;
      },
    });
  } catch {
    throw new ErreurLecture("Ce fichier n'a pas pu être lu. Retéléchargez-le depuis le Google Doc au format Word (.docx).");
  }

  const doc = lireXml(fichiers, "word/document.xml");
  const corps = doc?.getElementsByTagNameNS(W, "body")[0];
  if (!doc || !corps) {
    throw new ErreurLecture("Ce fichier n'est pas un document Word valide. Retéléchargez-le depuis le Google Doc au format Word (.docx).");
  }

  /* Styles : identifiant, nom, style parent, numérotation */
  const styles = new Map<string, InfoStyle>();
  const docStyles = lireXml(fichiers, "word/styles.xml");
  if (docStyles) {
    const liste = docStyles.getElementsByTagNameNS(W, "style");
    for (let i = 0; i < liste.length; i++) {
      const s = liste[i];
      const id = attribut(s, "styleId");
      if (!id) continue;
      styles.set(id, {
        nom: attribut(enfant(s, "name"), "val") ?? id,
        parent: attribut(enfant(s, "basedOn"), "val"),
        numerote: numerotation(enfant(s, "pPr")),
      });
    }
  }

  /* Listes à puces (numbering.xml), pour un avertissement */
  const puces = new Set<string>();
  const docNum = lireXml(fichiers, "word/numbering.xml");
  if (docNum) {
    const formats = new Map<string, string>();
    const abstraits = docNum.getElementsByTagNameNS(W, "abstractNum");
    for (let i = 0; i < abstraits.length; i++) {
      const a = abstraits[i];
      const niveau0 = enfants(a).find((e) => e.localName === "lvl" && attribut(e, "ilvl") === "0");
      formats.set(attribut(a, "abstractNumId") ?? "", attribut(enfant(niveau0, "numFmt"), "val") ?? "");
    }
    const nums = docNum.getElementsByTagNameNS(W, "num");
    for (let i = 0; i < nums.length; i++) {
      const id = attribut(nums[i], "numId");
      const abstrait = attribut(enfant(nums[i], "abstractNumId"), "val");
      if (id && formats.get(abstrait ?? "") === "bullet") puces.add(id);
    }
  }

  const genreDuStyle = (id: string | null): Genre => {
    if (!id) return "normal";
    return genreDuNom(id) ?? genreDuNom(styles.get(id)?.nom ?? "") ?? "normal";
  };

  /* La numérotation peut venir du style ou d'un de ses parents */
  const styleNumerote = (id: string | null): boolean => {
    const vus = new Set<string>();
    let courant = id;
    while (courant && !vus.has(courant)) {
      vus.add(courant);
      const s = styles.get(courant);
      if (!s) return false;
      if (s.numerote !== null) return s.numerote;
      courant = s.parent;
    }
    return false;
  };

  let suggestions = 0;
  let images = 0;
  let tableaux = 0;
  let commentaires = 0;
  let titresBas = 0;
  let listesAPuces = 0;
  const titres: string[] = [];
  const sousTitres: string[] = [];
  const blocs: Bloc[] = [];
  const avertissements: Avertissement[] = [];

  type Segment = { texte: string; gras: boolean };

  /* Texte d'une suite de runs, avec le gras ; sauts de ligne gardés seulement dans le titre */
  const lireRuns = (parent: XmlNode, segments: Segment[], dansTitre: boolean) => {
    for (const el of enfants(parent)) {
      if (el.namespaceURI !== W) continue;
      switch (el.localName) {
        case "r": {
          const rPr = enfant(el, "rPr");
          const gras = actif(enfant(rPr, "b"));
          let texte = "";
          for (const n of enfants(el)) {
            if (n.localName === "t") texte += n.textContent ?? "";
            else if (n.localName === "tab") texte += " ";
            else if (n.localName === "br" || n.localName === "cr") texte += dansTitre ? "\n" : " ";
            else if (n.localName === "noBreakHyphen") texte += "-";
            else if (n.localName === "drawing" || n.localName === "pict" || n.localName === "object") images++;
            else if (n.localName === "commentReference") commentaires++;
          }
          if (texte) segments.push({ texte, gras });
          break;
        }
        case "ins":
        case "moveTo":
          suggestions++;
          lireRuns(el, segments, dansTitre);
          break;
        case "del":
        case "moveFrom":
          suggestions++;
          break;
        case "commentRangeStart":
          break;
        default:
          /* Liens, champs, contrôles de contenu : on lit les runs qu'ils contiennent */
          if (["hyperlink", "smartTag", "sdt", "sdtContent", "fldSimple", "customXml"].includes(el.localName ?? "")) {
            lireRuns(el, segments, dansTitre);
          }
      }
    }
  };

  /* Segments vers HTML : texte échappé, gras en strong, espaces réduits */
  const versHtml = (segments: Segment[]): { html: string; texte: string; toutEnGras: boolean } => {
    const fusion: Segment[] = [];
    for (const s of segments) {
      const t = s.texte.replace(/\s+/g, " ");
      if (!t) continue;
      const dernier = fusion[fusion.length - 1];
      /* Un espace seul prend la mise en forme de ce qui précède */
      const gras = t.trim() === "" && dernier ? dernier.gras : s.gras;
      if (dernier && dernier.gras === gras) dernier.texte += t;
      else fusion.push({ texte: t, gras });
    }
    let html = "";
    fusion.forEach((s, i) => {
      let t = s.texte;
      if (i === 0) t = t.replace(/^\s+/, "");
      if (i === fusion.length - 1) t = t.replace(/\s+$/, "");
      if (!t) return;
      if (s.gras && t.trim()) {
        const debut = t.match(/^\s*/)?.[0] ?? "";
        const fin = t.match(/\s*$/)?.[0] ?? "";
        html += `${debut}<strong>${echapper(t.trim())}</strong>${fin}`;
      } else {
        html += echapper(t);
      }
    });
    html = html.replace(/ {2,}/g, " ");
    const texte = texteBrut(html);
    const toutEnGras = texte !== "" && fusion.every((s) => s.gras || s.texte.trim() === "");
    return { html, texte, toutEnGras };
  };

  const lireParagraphe = (p: XmlElement) => {
    const pPr = enfant(p, "pPr");
    const idStyle = attribut(enfant(pPr, "pStyle"), "val");
    const genre = genreDuStyle(idStyle);
    const numPr = numerotation(pPr);
    const numerote = numPr ?? styleNumerote(idStyle);
    if (numPr) {
      const numId = attribut(enfant(enfant(pPr, "numPr"), "numId"), "val");
      if (numId && puces.has(numId)) listesAPuces++;
    }

    /* Marque de paragraphe insérée ou supprimée par une suggestion */
    const rPrParagraphe = enfant(pPr, "rPr");
    if (enfant(rPrParagraphe, "ins") || enfant(rPrParagraphe, "del")) suggestions++;

    const segments: Segment[] = [];
    lireRuns(p, segments, genre === "titre");

    if (genre === "titre") {
      const t = segments
        .map((s) => s.texte)
        .join("")
        .split("\n")
        .map((ligne) => ligne.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n");
      if (t) titres.push(t);
      return;
    }

    const { html, texte, toutEnGras } = versHtml(segments);
    if (!texte) return;

    if (genre === "sous") {
      sousTitres.push(texte);
      return;
    }
    if (genre === "h" || genre === "accroche" || genre === "mention") {
      blocs.push({ id: nouvelId(), type: genre, html: echapper(texte) });
      return;
    }
    if (genre === "titre_bas") {
      titresBas++;
      blocs.push({ id: nouvelId(), type: "h", html: echapper(texte) });
      return;
    }
    if (numerote) {
      blocs.push({ id: nouvelId(), type: "li", html });
      return;
    }
    if (toutEnGras) {
      avertissements.push({
        niveau: "attention",
        message: `« ${extrait(texte, 60)} » est entièrement en gras : si c'est un intertitre, appliquez le style « Titre 1 » dans le Google Doc.`,
      });
    }
    blocs.push({ id: nouvelId(), type: "p", html });
  };

  /* Corps du document : paragraphes, tableaux (ignorés), contrôles de contenu */
  const parcourir = (parent: XmlNode) => {
    for (const el of enfants(parent)) {
      if (el.namespaceURI !== W) continue;
      if (el.localName === "p") lireParagraphe(el);
      else if (el.localName === "tbl") tableaux++;
      else if (el.localName === "sdt" || el.localName === "sdtContent" || el.localName === "customXml") parcourir(el);
      else if (el.localName === "ins" || el.localName === "moveTo") {
        suggestions++;
        parcourir(el);
      } else if (el.localName === "del" || el.localName === "moveFrom") suggestions++;
    }
  };
  parcourir(corps);

  /* Commentaires présents dans le fichier, même sans marque dans le texte */
  if (!commentaires && fichiers["word/comments.xml"]) {
    const docCom = lireXml(fichiers, "word/comments.xml");
    commentaires = docCom?.getElementsByTagNameNS(W, "comment").length ?? 0;
  }

  const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

  const bloquants: Avertissement[] = [];
  if (suggestions) {
    bloquants.push({
      niveau: "bloquant",
      message:
        suggestions > 1
          ? `${suggestions} suggestions Google Docs ne sont ni acceptées ni refusées. Acceptez-les ou refusez-les dans le Google Doc, puis téléchargez à nouveau le fichier.`
          : "1 suggestion Google Docs n'est ni acceptée ni refusée. Acceptez-la ou refusez-la dans le Google Doc, puis téléchargez à nouveau le fichier.",
    });
  }
  if (!titres.length) {
    bloquants.push({
      niveau: "bloquant",
      message: "Aucun paragraphe au style « Titre » : le titre du Manifeste est introuvable. Appliquez le style « Titre » au titre dans le Google Doc.",
    });
  }
  if (!blocs.length) {
    bloquants.push({ niveau: "bloquant", message: "Aucun contenu reconnu dans le document." });
  }

  const suite: Avertissement[] = [];
  if (!sousTitres.length) {
    suite.push({ niveau: "attention", message: "Pas de sous-titre (style « Sous-titre ») : la ligne sous le titre sera vide." });
  }
  if (blocs.length && !blocs.some((b) => b.type === "h")) {
    suite.push({ niveau: "attention", message: "Aucun intertitre (style « Titre 1 ») : vérifiez la structure du texte." });
  }
  if (titresBas) {
    suite.push({
      niveau: "attention",
      message: `${pluriel(titresBas, "paragraphe en style Titre 4 ou plus est traité", "paragraphes en style Titre 4 ou plus sont traités")} comme intertitre.`,
    });
  }
  if (listesAPuces) {
    suite.push({
      niveau: "attention",
      message: `${pluriel(listesAPuces, "point d'une liste à puces est traité", "points d'une liste à puces sont traités")} comme point numéroté. Utilisez une liste numérotée dans le Google Doc.`,
    });
  }
  if (images) {
    suite.push({ niveau: "info", message: `${pluriel(images, "image ignorée", "images ignorées")} : le Manifeste n'en contient pas.` });
  }
  if (tableaux) {
    suite.push({
      niveau: "info",
      message: `${pluriel(tableaux, "tableau ignoré", "tableaux ignorés")}. L'annexe des signataires est produite par la plateforme.`,
    });
  }
  if (commentaires) {
    suite.push({ niveau: "info", message: `${pluriel(commentaires, "commentaire ignoré", "commentaires ignorés")}.` });
  }

  return {
    titre: titres.join("\n"),
    sousTitre: sousTitres.join(" "),
    blocs,
    avertissements: [...bloquants, ...avertissements, ...suite],
  };
}

function extrait(texte: string, n: number): string {
  return texte.length > n ? `${texte.slice(0, n).trim()}…` : texte;
}
