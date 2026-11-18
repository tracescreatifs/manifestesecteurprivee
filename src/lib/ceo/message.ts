/* Messages WhatsApp envoyés aux CEO, au nom de la Task Force */

import { formaterAvecPremier } from "@/lib/dates";

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

/*
  Date limite des signatures, en heure de Dakar et en heure d'Abu Dhabi (D105). Source unique de tout affichage.
  Règles : 00 h 00 s'écrit « à minuit » et se rattache au jour précédent ; heure pleine « à 4 h », sinon « à 23 h 59 » ;
  si les deux heures tombent le même jour, le jour n'est pas répété.
*/
const DAKAR = "Africa/Dakar";
const ABU_DHABI = "Asia/Dubai";

type Moment = { jour: string; heure: string };

function moment(date: Date, fuseau: string): Moment {
  const parties = new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, hour: "numeric", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const h = Number(parties.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parties.find((p) => p.type === "minute")?.value ?? 0);
  const minuit = h === 0 && m === 0;
  /* Minuit appartient au jour qui se termine : on lit le jour une minute plus tôt */
  const jour = formaterAvecPremier(
    new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, day: "numeric", month: "long" }),
    minuit ? new Date(date.getTime() - 60_000) : date,
  );
  const heure = minuit ? "minuit" : m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
  return { jour, heure };
}

export type DateLimiteFormatee = {
  /* « 8 décembre à minuit, heure de Dakar (9 décembre à 4 h à Abu Dhabi) » */
  longue: string;
  /* Forme courte : « 8 décembre à minuit, heure de Dakar » … */
  dakar: string;
  /* … et, à part, « 9 décembre à 4 h à Abu Dhabi » (ou « 22 h à Abu Dhabi » le même jour) */
  abuDhabi: string;
};

export function formaterDateLimiteComplete(iso: string): DateLimiteFormatee {
  const date = new Date(iso);
  const d = moment(date, DAKAR);
  const a = moment(date, ABU_DHABI);
  const dakar = `${d.jour} à ${d.heure}, heure de Dakar`;
  const abuDhabi = a.jour === d.jour ? `${a.heure} à Abu Dhabi` : `${a.jour} à ${a.heure} à Abu Dhabi`;
  return { longue: `${dakar} (${abuDhabi})`, dakar, abuDhabi };
}

/* Forme longue, pour les messages et les phrases */
export function formaterDateLimite(iso: string): string {
  return formaterDateLimiteComplete(iso).longue;
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

/* Partage du lien ouvert par un admin (rubrique CEO, « Lien ouvert »), au nom de la Task Force (D106) */
export function messageLienOuvert(lien: string, dateLimite: string): string {
  return `Vous dirigez une entreprise sénégalaise de l'eau et de l'assainissement ? Lisez et signez le ${MANIFESTE_GRAS}, qui sera présenté à Abu Dhabi.\n\n${lien}\n\n*Merci de signer avant le ${neutraliserMiseEnForme(dateLimite)}.*\n\n${SIGNATURE_TASK_FORCE}`;
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
