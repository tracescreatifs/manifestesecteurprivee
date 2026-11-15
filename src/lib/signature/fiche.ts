/*
  Fiche facultative du CEO (après la signature) : trois consentements indépendants.
  Textes du prototype 2-ceo.html, avec le nom complet du secteur (prompt 06.1, D103) : le même texte est affiché
  et enregistré avec chaque consentement. Un consentement déjà donné garde le texte présenté à l'époque.
*/

export type ChoixFiche = { recontact: boolean; annuaire: boolean; photo_communication: boolean };

export const TEXTES_CHOIX: Record<keyof ChoixFiche, string> = {
  recontact: "J'accepte d'être recontacté pour la suite de la démarche du secteur privé sénégalais de l'eau et de l'assainissement.",
  annuaire: "J'accepte de figurer, avec ma photo, dans l'annuaire du secteur privé sénégalais de l'eau et de l'assainissement, visible uniquement par ses membres.",
  photo_communication: "J'accepte que ma photo soit utilisée dans la communication autour du Manifeste.",
};

/* Photo de la fiche : carré de 400 px en JPEG, préparé dans le navigateur */
export const PHOTO_COTE = 400;
export const PHOTO_TAILLE_MAX = 400 * 1024;
