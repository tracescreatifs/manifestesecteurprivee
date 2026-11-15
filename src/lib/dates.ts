/* Dates affichées en français, à l'heure de Dakar */

const FUSEAU = "Africa/Dakar";

const formatJour = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const formatHeure = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  hour: "2-digit",
  minute: "2-digit",
});

/* « 14 nov. 2026 » */
export function formaterJour(iso: string): string {
  return formatJour.format(new Date(iso));
}

/* « 14 nov. 2026 à 09:30 » */
export function formaterDateHeure(iso: string): string {
  const date = new Date(iso);
  return `${formatJour.format(date)} à ${formatHeure.format(date)}`;
}

const formatJourLong = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  day: "numeric",
  month: "long",
});

/* « 2 décembre » */
export function formaterJourLong(iso: string): string {
  return formatJourLong.format(new Date(iso));
}

const formatJourComplet = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/* « 23 novembre 2026 à 11:06 » (heure de Dakar) */
export function formaterDateHeureLongue(iso: string): string {
  const date = new Date(iso);
  return `${formatJourComplet.format(date)} à ${formatHeure.format(date)}`;
}
