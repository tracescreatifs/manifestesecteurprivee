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
