import "server-only";

import { randomInt } from "node:crypto";

/*
  Jetons des liens personnels (D15) : aléatoires cryptographiques, 22 caractères,
  alphabet sans caractères ambigus (ni 0, O, 1, I, l). 54 symboles : environ 126 bits.
*/
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
/* Code de parrainage : 8 caractères, en majuscules et chiffres, faciles à recopier */
const ALPHABET_CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function tirer(alphabet: string, longueur: number): string {
  let resultat = "";
  for (let i = 0; i < longueur; i++) resultat += alphabet[randomInt(alphabet.length)];
  return resultat;
}

export function genererJeton(): string {
  return tirer(ALPHABET, 22);
}

export function genererCodeParrainage(): string {
  return tirer(ALPHABET_CODE, 8);
}
