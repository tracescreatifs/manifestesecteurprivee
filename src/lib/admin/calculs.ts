/*
  Calculs du tableau de bord de l'admin (R1), purs et testés. Définitions dans decisions.md (D120).
  Jours et heures à l'heure de Dakar (UTC+0, sans heure d'été).
*/

import { formaterAvecPremier } from "@/lib/dates";
import type { StatutManifeste } from "@/types/database";

const DAKAR = "Africa/Dakar";
const formatIso = new Intl.DateTimeFormat("en-CA", { timeZone: DAKAR, year: "numeric", month: "2-digit", day: "2-digit" });
const formatJourMois = new Intl.DateTimeFormat("fr-FR", { timeZone: DAKAR, day: "numeric", month: "long" });
const formatHeure = new Intl.DateTimeFormat("fr-FR", { timeZone: DAKAR, hour: "numeric", minute: "2-digit", hourCycle: "h23" });

/* « 2026-11-18 » : le jour de Dakar d'un instant */
export function jourDakar(date: Date): string {
  return formatIso.format(date);
}

/* « 9 h 12 », à l'heure de Dakar */
export function heureDakar(iso: string): string {
  const parties = formatHeure.formatToParts(new Date(iso));
  return `${parties.find((p) => p.type === "hour")?.value ?? ""} h ${parties.find((p) => p.type === "minute")?.value ?? ""}`;
}

/* « 20 novembre », « 1er décembre » (heure de Dakar) */
export function jourEnLettres(iso: string): string {
  return formaterAvecPremier(formatJourMois, new Date(iso));
}

/* Pourcentage entier de 0 à 100 (arrondi, plafonné) ; 0 si le total est nul */
export function pourcentage(nombre: number, total: number): number {
  if (total <= 0 || nombre <= 0) return 0;
  return Math.min(100, Math.round((nombre / total) * 100));
}

const JOUR_MS = 86_400_000;

/*
  Jours restants avant la clôture des signatures : nombre de jours de calendrier (Dakar) entre aujourd'hui et
  le dernier jour où l'on peut signer. Minuit appartient au jour qui se termine (comme la date limite affichée, D105) :
  pour une clôture le 9 décembre à 00 h 00, le dernier jour est le 8 décembre. 0 : c'est le dernier jour.
  null : la date limite est passée.
*/
export function joursRestants(dateLimite: string, maintenant: Date): number | null {
  const limite = new Date(dateLimite).getTime();
  if (limite <= maintenant.getTime()) return null;
  const dernierJour = Date.parse(`${jourDakar(new Date(limite - 1))}T00:00:00Z`);
  const aujourdhui = Date.parse(`${jourDakar(maintenant)}T00:00:00Z`);
  return Math.max(0, Math.round((dernierJour - aujourdhui) / JOUR_MS));
}

/* « Aujourd'hui à 21 h 04 », « Hier à 21 h 04 », « 14 novembre à 21 h 04 » (heure de Dakar) */
export function quandRelatif(iso: string, maintenant: Date): string {
  const jour = jourDakar(new Date(iso));
  const aujourdhui = jourDakar(maintenant);
  const hier = jourDakar(new Date(Date.parse(`${aujourdhui}T12:00:00Z`) - JOUR_MS));
  const prefixe = jour === aujourdhui ? "Aujourd'hui" : jour === hier ? "Hier" : jourEnLettres(iso);
  return `${prefixe} à ${heureDakar(iso)}`;
}

/* Ligne d'état sous « Vue d'ensemble » */
export function ligneEtat(e: {
  statut: StatutManifeste;
  version: { numero: number; correction: boolean } | null;
  geleLe: string | null;
  closLe: string | null;
  publieLe: string | null;
  dateLimite: string;
}): string {
  const version = e.version ? `Version ${e.version.numero}${e.version.correction ? " (correction mineure)" : ""}` : null;
  if (e.statut === "redaction") return version ? `En rédaction, ${version.toLowerCase()}` : "En rédaction, aucune version importée";
  const le = e.geleLe ? ` le ${jourEnLettres(e.geleLe)}` : "";
  if (e.statut === "gele") return version ? `${version}, gelée${le}` : `Texte gelé${le}`;
  if (e.statut === "clos") return `${version ?? "Texte"}, signatures closes le ${jourEnLettres(e.closLe ?? e.dateLimite)}`;
  return `Document final publié${e.publieLe ? ` le ${jourEnLettres(e.publieLe)}` : ""}`;
}

/* Signatures closes : clôture enregistrée, ou date limite passée sans clic (règle métier 6) */
export function signaturesCloses(statut: StatutManifeste, dateLimite: string, maintenant: Date): boolean {
  return statut === "clos" || statut === "publie" || (statut === "gele" && new Date(dateLimite).getTime() <= maintenant.getTime());
}
