/*
  Fiche facultative du CEO (après la signature) : trois consentements indépendants.
  Textes exacts du prototype 2-ceo.html : le même texte est affiché et enregistré avec chaque consentement.
*/

export type ChoixFiche = { recontact: boolean; annuaire: boolean; photo_communication: boolean };

export const TEXTES_CHOIX: Record<keyof ChoixFiche, string> = {
  recontact: "J'accepte d'être recontacté pour la suite de la démarche du secteur privé.",
  annuaire: "J'accepte de figurer, avec ma photo, dans l'annuaire du secteur privé, visible uniquement par ses membres.",
  photo_communication: "J'accepte que ma photo soit utilisée dans la communication autour du Manifeste.",
};

/* Photo de la fiche : carré de 400 px en JPEG, préparé dans le navigateur */
export const PHOTO_COTE = 400;
export const PHOTO_TAILLE_MAX = 400 * 1024;
