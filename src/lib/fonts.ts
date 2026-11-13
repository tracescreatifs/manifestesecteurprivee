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

/* Document : équivalent libre de Georgia */
export const gelasio = Gelasio({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-gelasio",
});

/* Document : équivalent libre de Calibri */
export const carlito = Carlito({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-carlito",
});

/* Classes à poser sur <html> pour exposer les quatre variables CSS */
export const fontVariables = [
  fraunces.variable,
  jost.variable,
  gelasio.variable,
  carlito.variable,
].join(" ");
