/*
  Normalisations utilisées pour l'import de la liste et la détection des doublons.
  Fonctions pures : utilisables dans le navigateur (aperçu) et sur le serveur (revalidation).
*/

/* Minuscules, sans accents, espaces réduits */
export function normaliserTexte(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/*
  Même règle que la fonction SQL public.normaliser_nom_entreprise (migration 0001) :
  minuscules, sans accents, points retirés, autre ponctuation remplacée par des espaces,
  espaces réduits, sans forme juridique finale (SARL, SA, SAS, SASU, SUARL, GIE).
*/
export function normaliserNomEntreprise(nom: string): string {
  const base = normaliserTexte(nom).replace(/\./g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return base.replace(/\s+(sarl|sasu|sas|sa|suarl|gie)$/, "").trim();
}

/*
  Téléphone au format international E.164 (+221771234567), ou null s'il est illisible.
  - commence par + ou 00 : gardé en international ;
  - 9 chiffres commençant par 7 ou 3 (77, 78, 76, 75, 70, 33...) : numéro sénégalais, préfixe +221 ;
  - 12 chiffres commençant par 221 : numéro sénégalais écrit sans le +.
*/
export function normaliserTelephone(valeur: string): string | null {
  const brut = valeur.trim();
  if (!brut) return null;
  const chiffres = brut.replace(/\D/g, "");
  let international: string | null = null;

  if (brut.startsWith("+")) international = chiffres;
  else if (chiffres.startsWith("00")) international = chiffres.slice(2);
  else if (/^[37]\d{8}$/.test(chiffres)) international = `221${chiffres}`;
  else if (/^221[37]\d{8}$/.test(chiffres)) international = chiffres;

  if (!international || !/^[1-9]\d{7,14}$/.test(international)) return null;
  return `+${international}`;
}

/* « +221771234567 » devient « +221 77 123 45 67 » ; les autres numéros restent groupés par 3 */
export function formaterTelephone(e164: string | null): string {
  if (!e164) return "";
  const m = /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  if (m) return `+221 ${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return e164.replace(/^(\+\d{1,3})(\d+)$/, (_, indicatif: string, reste: string) =>
    `${indicatif} ${reste.replace(/(\d{3})(?=\d)/g, "$1 ")}`,
  );
}

/*
  Rapproche un maillon écrit librement (« 2 · Production », « production », « Etudes »)
  d'un des libellés officiels. Renvoie le libellé officiel, ou null.
*/
export function rapprocherMaillon(valeur: string, libelles: string[]): string | null {
  const nettoye = normaliserTexte(valeur)
    .replace(/^[\d\s.·:,)(-]+/, "")
    .trim();
  if (!nettoye) return null;
  const candidats = libelles.map((l) => ({ libelle: l, cle: normaliserTexte(l) }));
  return (
    candidats.find((c) => c.cle === nettoye)?.libelle ??
    candidats.find((c) => nettoye.startsWith(c.cle) || (nettoye.length >= 4 && c.cle.startsWith(nettoye)))?.libelle ??
    candidats.find((c) => nettoye.includes(c.cle))?.libelle ??
    null
  );
}
