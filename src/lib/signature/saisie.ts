/*
  Validation de la saisie du CEO (étape 1) et du tracé (étape 2).
  Le même schéma sert dans le navigateur et sur le serveur.
  zod/mini : même bibliothèque que le reste du projet, en version allégée pour le téléphone du CEO.
*/

import * as z from "zod/mini";

import { normaliserTelephone } from "@/lib/ceo/normaliser";
import type { TraceSignature } from "@/types/database";

const texte = (min: string, max: number, trop: string) =>
  z.string().check(z.trim(), z.minLength(1, min), z.maxLength(max, trop));

export function schemaSaisie(maillons: string[]) {
  return z.object({
    prenom: texte("Indiquez votre prénom.", 80, "Prénom trop long."),
    nom: texte("Indiquez votre nom.", 80, "Nom trop long."),
    fonction: texte("Indiquez votre fonction.", 120, "Fonction trop longue."),
    entreprise: texte("Indiquez le nom officiel de votre entreprise.", 160, "Nom d'entreprise trop long."),
    maillon: z.string().check(z.refine((m) => maillons.includes(m), "Choisissez votre maillon.")),
    telephone: z.pipe(
      z
        .string()
        .check(
          z.trim(),
          z.refine((t) => normaliserTelephone(t) !== null, "Indiquez votre numéro WhatsApp complet, avec l'indicatif."),
        ),
      z.transform((t) => normaliserTelephone(t) ?? t),
    ),
  });
}

/* ----- Tracé ----- */

const TRACE_VALIDE = /^[MLCQSTHVZmlcqsthvz0-9eE.,\s-]+$/;
const VB_VALIDE = /^0 0 \d{1,5}(\.\d+)? \d{1,5}(\.\d+)?$/;

/* Longueur approximative d'un tracé (somme des segments entre points successifs) */
export function longueurTrace(trace: TraceSignature): number {
  let total = 0;
  for (const d of trace.d) {
    const nombres = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    for (let i = 2; i + 1 < nombres.length; i += 2) {
      total += Math.hypot(nombres[i] - nombres[i - 2], nombres[i + 1] - nombres[i - 1]);
    }
  }
  return total;
}

export const LONGUEUR_MIN = 40;

export const schemaTrace = z
  .object({
    vb: z.string().check(z.regex(VB_VALIDE)),
    d: z.array(z.string().check(z.maxLength(40000), z.regex(TRACE_VALIDE))).check(z.minLength(1), z.maxLength(80)),
  })
  .check(
    z.refine((t) => t.d.reduce((n, x) => n + x.length, 0) <= 200000, "Signature trop lourde."),
    z.refine((t) => longueurTrace(t) >= LONGUEUR_MIN, "Votre signature est trop courte."),
  );
