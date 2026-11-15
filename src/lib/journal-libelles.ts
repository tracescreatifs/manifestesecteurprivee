/* Actions du journal et leur libellé en français */
export const LIBELLES_ACTIONS = {
  connexion: "Connexion",
  deconnexion: "Déconnexion",
  admin_invite: "Admin invité",
  lien_invitation_genere: "Nouveau lien d'invitation généré",
  lien_reinitialisation_genere: "Lien de réinitialisation généré",
  acces_coupe: "Accès coupé",
  acces_retabli: "Accès rétabli",
  mot_de_passe_defini: "Mot de passe défini",
  premier_admin_promu: "Premier admin créé",
  version_importee: "Version importée",
  correction_mineure_importee: "Correction mineure importée",
  version_restauree: "Version restaurée",
  texte_gele: "Texte gelé",
  retour_redaction: "Retour en rédaction",
  google_doc_modifie: "Lien du Google Doc modifié",
  ceo_importes: "Liste des CEO importée",
  ceo_ajoute: "CEO ajouté",
  ceo_modifie: "CEO modifié",
  ceo_retire: "CEO retiré de la liste",
  lien_envoye: "Lien envoyé sur WhatsApp",
  relance_envoyee: "Relance WhatsApp",
  envoi_annule: "Envoi marqué comme non fait",
  lien_ouvert_active: "Lien ouvert activé",
  lien_ouvert_pause: "Lien ouvert mis en pause",
  signatures_exportees: "Signatures exportées",
  modele_message_modifie: "Message WhatsApp modifié",
  reglages_signature_modifies: "Réglages de la signature modifiés",
  consentement_modifie: "Texte de consentement modifié",
  signature_enregistree: "Signature enregistrée",
  signature_retiree: "Signature retirée",
  inscription_lien_ouvert: "Inscription par le lien ouvert",
  signature_verifiee: "Signature vérifiée",
  signature_validee: "Signature validée (nouvel inscrit)",
  doublon_garde: "Doublon d'entreprise : les deux signatures gardées",
  entreprise_mise_a_jour: "Entreprise mise à jour avec la saisie du CEO",
  signature_retiree_admin: "Signature retirée par un admin",
  signature_refusee: "Signature refusée",
  signature_retablie: "Signature rétablie",
  commentaire_traite: "Commentaire traité",
} as const;

export type ActionJournal = keyof typeof LIBELLES_ACTIONS;

export function libelleAction(action: string): string {
  return action in LIBELLES_ACTIONS ? LIBELLES_ACTIONS[action as ActionJournal] : action;
}
