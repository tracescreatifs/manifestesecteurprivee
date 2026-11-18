import { formaterDateLimite } from "@/lib/ceo/message";
import { LIBELLES_STATUTS_COMMENTAIRE } from "@/lib/verification/regles";
import type { StatutCommentaire } from "@/types/database";

/*
  Affichage d'une ligne du journal : qui a agi, et sur quoi (sans jamais le texte d'une doléance ni un jeton).
  Partagé par l'onglet Journal des Réglages et la carte « Dernières actions » du tableau de bord.
  noms : nom complet de chaque admin, par identifiant.
*/

export function acteurJournal(type: string, id: string | null, noms: Map<string, string>): string {
  if (type === "systeme") return "Système";
  if (type === "admin") return (id && noms.get(id)) || "Admin supprimé";
  return "CEO";
}

export function cibleJournal(type: string | null, id: string | null, details: unknown, noms: Map<string, string>): string {
  if (type === "admin") {
    const nom = id ? noms.get(id) : undefined;
    if (nom) return nom;
    const email = (details as { email?: string } | null)?.email;
    return email ?? "";
  }
  if (type === "ceo") {
    const d = details as { nom?: string; entreprise?: string; motif?: string; statut?: string } | null;
    const base = [d?.nom, d?.entreprise].filter(Boolean).join(", ");
    const statut = d?.statut && d.statut in LIBELLES_STATUTS_COMMENTAIRE ? LIBELLES_STATUTS_COMMENTAIRE[d.statut as StatutCommentaire] : null;
    return `${base}${statut ? ` : ${statut}` : ""}${d?.motif ? ` (motif : ${d.motif})` : ""}`;
  }
  if (!type) {
    const d = details as { nombre?: number; fichier?: string } | null;
    if (typeof d?.nombre === "number") return `${d.nombre} CEO${d.fichier ? `, depuis ${d.fichier}` : ""}`;
  }
  if (type === "manifeste") {
    const d = details as { nombre?: number; objet?: string; date_limite?: string } | null;
    if (typeof d?.nombre === "number") {
      const mot = d.objet === "doleances" ? "doléance" : "signature";
      return `${d.nombre} ${mot}${d.nombre > 1 ? "s" : ""}`;
    }
    if (d?.date_limite) return `jusqu'au ${formaterDateLimite(d.date_limite)}`;
  }
  /* Signataire sur place : nom, entreprise et référence */
  if (type === "signature") {
    const d = details as { nom?: string; entreprise?: string; reference?: string } | null;
    return `${[d?.nom, d?.entreprise].filter(Boolean).join(", ")}${d?.reference ? ` (${d.reference})` : ""}`;
  }
  /* Doléances : auteur, entreprise et thème ; jamais le texte */
  if (type === "doleance") {
    const d = details as { nom?: string; entreprise?: string; theme?: string; de?: string; vers?: string } | null;
    const base = [d?.nom, d?.entreprise].filter(Boolean).join(", ");
    if (d?.vers) return `${base} : de ${d.de ?? "Autre"} vers ${d.vers}`;
    return `${base}${d?.theme ? ` (${d.theme})` : ""}`;
  }
  if (type === "theme") {
    const d = details as { libelle?: string; ancien?: string } | null;
    return d?.ancien ? `${d.ancien}, devenu ${d.libelle ?? ""}` : (d?.libelle ?? "");
  }
  if (type === "version") {
    const numero = (details as { numero?: number } | null)?.numero;
    return numero ? `version ${numero}` : "";
  }
  return "";
}
