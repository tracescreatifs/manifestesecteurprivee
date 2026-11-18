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

/*
  Jour et mois en toutes lettres, avec « 1er » pour le premier jour du mois (« 1er janvier », jamais « 1 janvier »).
  Toute date affichée avec un jour et un mois passe par ici.
*/
export function formaterAvecPremier(format: Intl.DateTimeFormat, date: Date): string {
  return format
    .formatToParts(date)
    .map((p) => (p.type === "day" && Number(p.value) === 1 ? "1er" : p.value))
    .join("");
}

/* « 14 nov. 2026 », « 1er déc. 2026 » */
export function formaterJour(iso: string): string {
  return formaterAvecPremier(formatJour, new Date(iso));
}

/* « 14 nov. 2026 à 09:30 » */
export function formaterDateHeure(iso: string): string {
  const date = new Date(iso);
  return `${formaterAvecPremier(formatJour, date)} à ${formatHeure.format(date)}`;
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
  return `${formaterAvecPremier(formatJourComplet, date)} à ${formatHeure.format(date)}`;
}
