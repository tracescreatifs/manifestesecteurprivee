import { Carlito, Fraunces, Gelasio, Jost } from "next/font/google";

/* Titres de l'interface */
export const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-fraunces",
});

/* Interface */
export const jost = Jost({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jost",
});

/*
  Document : équivalent libre de Georgia. Pas de préchargement : seules les variantes réellement affichées
  sont téléchargées (Georgia est utilisée en priorité quand l'appareil l'a).
*/
export const gelasio = Gelasio({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
  variable: "--font-gelasio",
});

/* Document : équivalent libre de Calibri (même règle : chargé à la demande, sans préchargement) */
export const carlito = Carlito({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
  variable: "--font-carlito",
});

/* Classes à poser sur <html> pour exposer les quatre variables CSS */
export const fontVariables = [
  fraunces.variable,
  jost.variable,
  gelasio.variable,
  carlito.variable,
].join(" ");
