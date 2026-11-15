/* Messages WhatsApp envoyés aux CEO, au nom de la Task Force */

/* Modèle d'origine : constante MODELE du prototype 1-admin.html, identique au seed 0001 */
export const MODELE_ORIGINE =
  "Bonjour {prenom},\n\nSuite au déjeuner du 22 octobre, voici le Manifeste du secteur privé sénégalais de l'eau et de l'assainissement, qui sera présenté à Abu Dhabi.\n\nVous pouvez le lire, le commenter et le signer en deux minutes, depuis votre téléphone ou votre ordinateur, avec ce lien personnel :\n{lien}\n\nMerci de signer avant le {date_limite} pour figurer dans l'exemplaire imprimé pour Abu Dhabi. Une question ? Répondez simplement à ce message.\n\nLa Task Force du secteur privé sénégalais de l'eau et de l'assainissement";

/* Texte ajouté en tête d'une relance (prototype) */
export const PREFIXE_RELANCE = "Petit rappel. ";

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
  const texte = modele
    .replace(/\{prenom\}/g, valeurs.prenom)
    .replace(/\{lien\}/g, valeurs.lien)
    .replace(/\{date_limite\}/g, valeurs.dateLimite);
  return relance ? `${PREFIXE_RELANCE}${texte}` : texte;
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
