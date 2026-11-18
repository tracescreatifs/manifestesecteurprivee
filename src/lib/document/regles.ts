/*
  Document final (prompt 08) : règles pures, partagées par le navigateur et le serveur, testées avec vitest.
  Signataires sur place, réouverture, fichiers déposés (PDF du document final, photo d'une signature manuscrite).
*/

import * as z from "zod/mini";

import type { StatutManifeste } from "@/types/database";

/* PDF du document final : au plus 4 Mo (limite d'un envoi vers une fonction Vercel : 4,5 Mo) */
export const PDF_TAILLE_MAX = 4 * 1024 * 1024;
/* Photo d'une signature manuscrite, après recadrage et compression dans le navigateur
   (sous la limite d'un envoi de Server Action, 1 Mo, avec les autres champs) */
export const SIGNATURE_IMAGE_TAILLE_MAX = 800 * 1024;

/* Le type réel d'un fichier, lu dans ses premiers octets (jamais son nom ni le type annoncé) */
export function estPdf(octets: Uint8Array): boolean {
  return octets.length >= 5 && octets[0] === 0x25 && octets[1] === 0x50 && octets[2] === 0x44 && octets[3] === 0x46 && octets[4] === 0x2d;
}
export function estJpeg(octets: Uint8Array): boolean {
  return octets.length >= 3 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff;
}

const texte = (max: number, vide: string, long: string) => z.string().check(z.trim(), z.minLength(1, vide), z.maxLength(max, long));

/* Formulaire « Ajouter un signataire sur place » : mêmes messages dans le navigateur et sur le serveur */
export function schemaSignataireSurPlace(maillons: string[]) {
  return z.object({
    prenom: texte(80, "Indiquez le prénom.", "Prénom trop long."),
    nom: texte(80, "Indiquez le nom.", "Nom trop long."),
    fonction: texte(120, "Indiquez la fonction.", "Fonction trop longue."),
    entreprise: texte(160, "Indiquez le nom officiel de l'entreprise.", "Nom d'entreprise trop long."),
    maillon: z.string().check(z.refine((m) => maillons.includes(m), "Choisissez le maillon.")),
  });
}
export type SaisieSurPlace = { prenom: string; nom: string; fonction: string; entreprise: string; maillon: string };

/* Ce qui est possible selon le statut : réglages et signataires sur place */
export const peutReglerAnnexe = (statut: StatutManifeste) => statut !== "publie";
export const peutGererSurPlace = (statut: StatutManifeste) => statut === "clos";

/*
  Nouvelle date limite à la réouverture (D18), saisie « AAAA-MM-JJTHH:MM » à l'heure de Dakar (= UTC).
  Renvoie la date, ou le message à afficher.
*/
export function dateDeReouverture(saisie: string, maintenant: Date): { ok: true; date: Date } | { ok: false; erreur: string } {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(saisie)) return { ok: false, erreur: "Indiquez la nouvelle date et l'heure limites." };
  const date = new Date(`${saisie}:00Z`);
  if (Number.isNaN(date.getTime())) return { ok: false, erreur: "Indiquez une date valide." };
  if (date.getTime() <= maintenant.getTime()) return { ok: false, erreur: "Cette date est déjà passée. Choisissez une date à venir." };
  return { ok: true, date };
}

/* Nom du PDF déposé dans le bucket exports, horodaté (heure UTC = heure de Dakar) */
export function cheminPdfFinal(maintenant: Date): string {
  const h = maintenant.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  return `document-final/manifeste-${h}.pdf`;
}
