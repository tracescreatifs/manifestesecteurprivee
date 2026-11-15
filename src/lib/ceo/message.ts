/* Messages WhatsApp envoyés aux CEO, au nom de la Task Force */

/*
  Mise en forme WhatsApp : *texte* en gras, _texte_ en italique (D101).
  Nom du Manifeste en gras, signature de la Task Force en italique sur sa propre ligne,
  lien jamais mis en forme, paragraphes séparés par une ligne vide.
*/

/* Nom du Manifeste, en gras dans les messages */
export const MANIFESTE_GRAS = "*Manifeste du secteur privé sénégalais de l'eau et de l'assainissement*";
/* Signature de la Task Force, en italique sur sa propre ligne */
export const SIGNATURE_TASK_FORCE = "_La Task Force du secteur privé sénégalais de l'eau et de l'assainissement_";

/* Modèle d'origine (prompt 06.1), identique au seed 0002 */
export const MODELE_ORIGINE =
  "Bonjour {prenom},\n\nSuite au déjeuner du 22 octobre, voici le *Manifeste du secteur privé sénégalais de l'eau et de l'assainissement*, qui sera présenté à Abu Dhabi.\n\nVous pouvez le lire, le commenter et le signer en deux minutes, depuis votre téléphone ou votre ordinateur, avec ce lien personnel :\n{lien}\n\n*Merci de signer avant le {date_limite}* pour figurer dans l'exemplaire imprimé pour Abu Dhabi.\n\nUne question ? Répondez simplement à ce message.\n\n_La Task Force du secteur privé sénégalais de l'eau et de l'assainissement_";

/* Texte ajouté en tête d'une relance, sur sa propre ligne */
export const PREFIXE_RELANCE = "*Petit rappel.*\n";

/*
  Une donnée insérée dans un message (prénom, entreprise, toute saisie) ne doit jamais casser la mise en forme :
  les caractères de mise en forme de WhatsApp y sont remplacés par un équivalent visuel inerte
  (* par ∗, _ par ˍ, ~ par ∼, ` par ˋ). Le lien n'est jamais passé par cette fonction.
*/
export function neutraliserMiseEnForme(donnee: string): string {
  return donnee.replace(/\*/g, "\u2217").replace(/_/g, "\u02CD").replace(/~/g, "\u223C").replace(/`/g, "\u02CB");
}

const FUSEAU = "Africa/Dakar";

/* « 2 décembre à 23 h 59 », à l'heure de Dakar */
export function formaterDateLimite(iso: string): string {
  const date = new Date(iso);
  const jour = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, day: "numeric", month: "long" }).format(date);
  const parties = new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const heure = parties.find((p) => p.type === "hour")?.value ?? "";
  const minute = parties.find((p) => p.type === "minute")?.value ?? "";
  return `${jour} à ${heure} h ${minute}`;
}

export function lienPersonnel(siteUrl: string, jeton: string): string {
  return `${siteUrl}/s/${jeton}`;
}

export function lienOuvert(siteUrl: string): string {
  return `${siteUrl}/rejoindre`;
}

export function remplirModele(
  modele: string,
  valeurs: { prenom: string; lien: string; dateLimite: string },
  relance = false,
): string {
  /* Remplacement par fonction : un « $ » dans une donnée n'est jamais interprété */
  const texte = modele
    .replace(/\{prenom\}/g, () => neutraliserMiseEnForme(valeurs.prenom))
    .replace(/\{lien\}/g, () => valeurs.lien)
    .replace(/\{date_limite\}/g, () => neutraliserMiseEnForme(valeurs.dateLimite));
  return relance ? `${PREFIXE_RELANCE}${texte}` : texte;
}

/* Partage du lien ouvert par un admin (rubrique CEO, « Lien ouvert ») */
export function messageLienOuvert(lien: string): string {
  return `Dirigeants d'entreprises sénégalaises de l'eau et de l'assainissement : lisez et signez le *Manifeste* qui sera présenté à Abu Dhabi.\n\n${lien}`;
}

/* Le CEO s'envoie son lien personnel sur WhatsApp */
export function messageMonLien(lien: string): string {
  return `Mon lien personnel pour le ${MANIFESTE_GRAS} :\n${lien}`;
}

/* Le CEO invite un confrère avec son lien de parrainage */
export function messageInvitationConfrere(lien: string): string {
  return `Je viens de signer le ${MANIFESTE_GRAS}, qui sera présenté à Abu Dhabi.\n\nVous pouvez le lire et le signer ici :\n${lien}`;
}

/* Lien d'invitation ou de réinitialisation envoyé à un admin (Réglages, Admins) */
export function messageLienAdmin(type: "invite" | "reinitialisation", prenom: string, lien: string): string {
  const nom = neutraliserMiseEnForme(prenom);
  const plateforme = `la plateforme du ${MANIFESTE_GRAS}`;
  return type === "invite"
    ? `Bonjour ${nom},\n\nVous êtes invité comme admin de ${plateforme}. Ouvrez ce lien pour choisir votre mot de passe :\n${lien}\n\nCe lien ne fonctionne qu'une seule fois.`
    : `Bonjour ${nom},\n\nVoici votre lien pour choisir un nouveau mot de passe sur ${plateforme} :\n${lien}\n\nCe lien ne fonctionne qu'une seule fois.`;
}

/* Lien wa.me : numéro sans le +, message prérempli */
export function lienWhatsApp(telephoneE164: string | null, message: string): string {
  const numero = (telephoneE164 ?? "").replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}

/* Partage sans destinataire (l'admin choisit le contact ou le groupe dans WhatsApp) */
export function lienPartageWhatsApp(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
