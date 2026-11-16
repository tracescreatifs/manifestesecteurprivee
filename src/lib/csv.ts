/* Fichiers CSV pour Excel (exports des signatures et des doléances) */

const FUSEAU = "Africa/Dakar";

/* « 2026-11-23 10:05 », à l'heure de Dakar */
export function dateHeureDakar(iso: string): string {
  const parties = new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const v = (t: string) => parties.find((p) => p.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")} ${v("hour")}:${v("minute")}`;
}

/* Cellule CSV : séparateur point-virgule (Excel en français), guillemets échappés */
export function cellule(valeur: string | number | null | undefined): string {
  const texte = valeur === null || valeur === undefined ? "" : String(valeur);
  /* Une cellule qui commence par =, +, - ou @ serait lue comme une formule par Excel */
  const sure = /^[=+\-@]/.test(texte) ? `'${texte}` : texte;
  return /[";\n\r]/.test(sure) ? `"${sure.replace(/"/g, '""')}"` : sure;
}

/* Tableau complet, avec le BOM UTF-8 : Excel lit correctement les accents */
export function tableauCsv(entetes: string[], lignes: (string | number | null | undefined)[][]): string {
  return `﻿${[entetes, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n")}\r\n`;
}
