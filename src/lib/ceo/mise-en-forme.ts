/*
  Lecture de la mise en forme WhatsApp d'un message, pour l'aperçu de l'admin (D101) :
  *texte* en gras, _texte_ en italique, sur une même ligne, comme dans WhatsApp.
  Un marqueur ouvre seulement en début de ligne ou après un espace ou une ponctuation, suivi d'un caractère visible ;
  il ferme après un caractère visible, en fin de ligne ou avant un espace ou une ponctuation.
  Un lien (http:// ou https://) n'est jamais mis en forme : il est affiché en clair.
*/

export type Morceau = { texte: string; gras: boolean; italique: boolean; lien: boolean };

const LIEN = /https?:\/\/\S+/g;
const MARQUEURS = { "*": "gras", _: "italique" } as const;
type Marqueur = keyof typeof MARQUEURS;

const lettreOuChiffre = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
const espace = (c: string | undefined) => c !== undefined && /\s/.test(c);
const estMarqueur = (c: string): c is Marqueur => c === "*" || c === "_";

function peutOuvrir(texte: string, i: number): boolean {
  const avant = texte[i - 1];
  const apres = texte[i + 1];
  return apres !== undefined && !espace(apres) && apres !== texte[i] && !lettreOuChiffre(avant);
}

function fermeture(texte: string, i: number): number {
  const m = texte[i];
  for (let j = i + 2; j < texte.length; j++) {
    if (texte[j] === m && !espace(texte[j - 1]) && !lettreOuChiffre(texte[j + 1])) return j;
  }
  return -1;
}

function analyserTexte(texte: string, gras: boolean, italique: boolean): Morceau[] {
  const morceaux: Morceau[] = [];
  let tampon = "";
  const vider = () => {
    if (tampon) morceaux.push({ texte: tampon, gras, italique, lien: false });
    tampon = "";
  };
  let i = 0;
  while (i < texte.length) {
    const c = texte[i];
    if (estMarqueur(c) && peutOuvrir(texte, i)) {
      const j = fermeture(texte, i);
      if (j > 0) {
        vider();
        const style = MARQUEURS[c];
        morceaux.push(...analyserTexte(texte.slice(i + 1, j), gras || style === "gras", italique || style === "italique"));
        i = j + 1;
        continue;
      }
    }
    tampon += c;
    i++;
  }
  vider();
  return morceaux;
}

/* Une ligne : les liens d'abord (jamais mis en forme), puis le reste */
function analyserLigne(ligne: string): Morceau[] {
  const morceaux: Morceau[] = [];
  let debut = 0;
  for (const m of ligne.matchAll(LIEN)) {
    const index = m.index ?? 0;
    morceaux.push(...analyserTexte(ligne.slice(debut, index), false, false));
    morceaux.push({ texte: m[0], gras: false, italique: false, lien: true });
    debut = index + m[0].length;
  }
  morceaux.push(...analyserTexte(ligne.slice(debut), false, false));
  return morceaux;
}

/* Le message, ligne par ligne (une ligne vide reste une ligne vide) */
export function analyserMessage(message: string): Morceau[][] {
  return message.split("\n").map(analyserLigne);
}
