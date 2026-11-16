"use server";

import { z } from "zod";

import { deposer, MESSAGES_DOLEANCE, type ChampDoleance } from "@/lib/doleances/regles";
import {
  contexteDoleances,
  creerDepotDoleance,
  lireDoleanceCeo,
  supprimerDoleanceCeo,
  type DoleanceCeo,
} from "@/lib/doleances/serveur";
import { JETON_VALIDE } from "@/lib/signature/serveur";

/*
  Doléances du CEO (prompt 09a). Chaque action revalide le jeton, puis écrit avec la clé secrète :
  le CEO n'a aucun accès direct aux tables. Le jeton n'apparaît jamais dans le journal ni dans les messages.
*/

const schemaJeton = z.string().regex(JETON_VALIDE);
const schemaId = z.string().regex(/^[0-9a-f-]{36}$/i);

export type ResultatDoleance =
  | { ok: true; doleance: DoleanceCeo }
  | { ok: false; erreur: string; champs?: Partial<Record<ChampDoleance, string>> };

export async function deposerDoleance(entree: { jeton: string; cle: string; saisie: unknown }): Promise<ResultatDoleance> {
  if (!schemaJeton.safeParse(entree.jeton).success) return { ok: false, erreur: MESSAGES_DOLEANCE.lien_invalide };
  const contexte = await contexteDoleances(entree.jeton);
  if (!contexte) return { ok: false, erreur: MESSAGES_DOLEANCE.lien_invalide };
  if (!contexte.autorise) return { ok: false, erreur: MESSAGES_DOLEANCE.non_autorise };
  if (contexte.etat === "pas_ouvert") return { ok: false, erreur: MESSAGES_DOLEANCE.pas_ouvert };
  if (contexte.etat === "clos") return { ok: false, erreur: MESSAGES_DOLEANCE.doleances_closes };

  const r = await deposer(creerDepotDoleance(contexte.invitationId), { cle: String(entree.cle ?? ""), saisie: entree.saisie });
  if (!r.ok) {
    return r.champs ? { ok: false, erreur: "Vérifiez votre doléance.", champs: r.champs } : { ok: false, erreur: MESSAGES_DOLEANCE[r.code] };
  }
  const doleance = await lireDoleanceCeo(contexte.invitationId, r.id);
  return doleance ? { ok: true, doleance } : { ok: false, erreur: MESSAGES_DOLEANCE.echec };
}

export async function supprimerMaDoleance(entree: { jeton: string; id: string }): Promise<{ ok: true } | { ok: false; erreur: string }> {
  if (!schemaJeton.safeParse(entree.jeton).success || !schemaId.safeParse(entree.id).success) {
    return { ok: false, erreur: MESSAGES_DOLEANCE.lien_invalide };
  }
  const contexte = await contexteDoleances(entree.jeton);
  if (!contexte) return { ok: false, erreur: MESSAGES_DOLEANCE.lien_invalide };
  const r = await supprimerDoleanceCeo(contexte.invitationId, entree.id);
  if (r === "ok") return { ok: true };
  return {
    ok: false,
    erreur: r === "introuvable" ? "Cette doléance n'existe plus. Rechargez la page." : "La doléance n'a pas pu être supprimée. Réessayez.",
  };
}
