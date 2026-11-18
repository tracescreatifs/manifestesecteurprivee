/*
  Doléances privées (prompt 09a, D109). Règles pures, partagées par le navigateur et le serveur, testées avec vitest.
  L'écriture passe par la fonction SQL deposer_doleance (migration 0009), qui recontrôle tout dans une transaction :
  ouverture, clôture, droit de dépôt, thème, longueurs, clé anti-doublon et limite par jour.
  zod/mini : version allégée pour le téléphone du CEO.
*/

import * as z from "zod/mini";

import type { EtatVerification, OrigineInvitation, StatutManifeste } from "@/types/database";

export const TEXTE_MIN = 15;
export const TEXTE_MAX = 500;
export const SOLUTION_MAX = 400;
export const THEME_PROPOSE_MAX = 60;
export const LIMITE_PAR_JOUR = 10;
/* Valeur du choix « Autre » dans la liste des thèmes */
export const AUTRE = "autre";
/* Clé anti-doublon : 16 à 64 caractères, comme celles de la signature et de l'inscription */
export const CLE_VALIDE = /^[A-Za-z0-9-]{16,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Ouverture : du gel jusqu'à la clôture des doléances, indépendante de la clôture des signatures */
export type EtatDoleances = "pas_ouvert" | "ouvert" | "clos";

export function etatDoleances(statut: StatutManifeste, clotureIso: string, maintenant: Date): EtatDoleances {
  if (statut === "redaction") return "pas_ouvert";
  return maintenant.getTime() > new Date(clotureIso).getTime() ? "clos" : "ouvert";
}

/*
  Droit de dépôt (D28) : un CEO de la liste dont le lien n'est pas rejeté, ou un nouvel inscrit
  dont une signature a été validée par un admin. Qu'il ait signé ou non, et même après la clôture des signatures.
*/
export function peutDeposer(invitation: {
  origine: OrigineInvitation;
  verification: EtatVerification;
  signatureValidee: boolean;
}): boolean {
  if (invitation.verification === "rejete") return false;
  return invitation.origine === "liste" || invitation.signatureValidee;
}

const texte = (min: number, max: number, court: string, long: string) =>
  z.string().check(z.trim(), z.minLength(min, court), z.maxLength(max, long));

/* Formulaire du CEO : mêmes messages dans le navigateur et sur le serveur */
export const schemaDoleance = z
  .object({
    theme: z.string().check(z.refine((t) => t === AUTRE || UUID.test(t), "Choisissez un thème.")),
    themePropose: z.string().check(z.trim(), z.maxLength(THEME_PROPOSE_MAX, `Votre thème : ${THEME_PROPOSE_MAX} caractères au plus.`)),
    texte: texte(
      TEXTE_MIN,
      TEXTE_MAX,
      `Décrivez la difficulté en ${TEXTE_MIN} caractères au moins.`,
      `Votre doléance : ${TEXTE_MAX} caractères au plus.`,
    ),
    solution: z.string().check(z.trim(), z.maxLength(SOLUTION_MAX, `Proposition de solution : ${SOLUTION_MAX} caractères au plus.`)),
    neJamaisPublier: z.boolean(),
  });

export type SaisieDoleance = z.infer<typeof schemaDoleance>;
export type ChampDoleance = keyof SaisieDoleance;

/* Premier message d'erreur de chaque champ */
export function erreursDoleance(saisie: unknown): Partial<Record<ChampDoleance, string>> | null {
  const r = schemaDoleance.safeParse(saisie);
  if (r.success) return null;
  const erreurs: Partial<Record<ChampDoleance, string>> = {};
  r.error.issues.forEach((i) => {
    const champ = i.path[0] as ChampDoleance;
    if (!erreurs[champ]) erreurs[champ] = i.message;
  });
  return erreurs;
}

export type CodeDoleance =
  | "lien_invalide"
  | "non_autorise"
  | "pas_ouvert"
  | "doleances_closes"
  | "theme_invalide"
  | "texte_invalide"
  | "cle_invalide"
  | "limite_atteinte"
  | "echec";

export const MESSAGES_DOLEANCE: Record<CodeDoleance, string> = {
  lien_invalide: "Ce lien n'est pas valide.",
  non_autorise: "Ce lien ne permet pas de déposer une doléance.",
  pas_ouvert: "Le dépôt des doléances n'est pas encore ouvert.",
  doleances_closes: "Le dépôt des doléances est clos.",
  theme_invalide: "Ce thème n'est plus proposé. Choisissez-en un autre.",
  texte_invalide: "Vérifiez la longueur de votre doléance et de la proposition de solution.",
  cle_invalide: "La doléance n'a pas pu être enregistrée. Rechargez la page, puis réessayez.",
  limite_atteinte: `Vous avez déposé ${LIMITE_PAR_JOUR} doléances en 24 heures. Réessayez demain.`,
  echec: "La doléance n'a pas pu être enregistrée. Réessayez : elle ne sera jamais enregistrée deux fois.",
};

export type DepotDoleance = {
  deposer(entree: {
    cle: string;
    themeId: string | null;
    themePropose: string | null;
    texte: string;
    solution: string | null;
    neJamaisPublier: boolean;
    limiteParJour: number;
  }): Promise<{ ok: true; id: string; renvoi: boolean } | { ok: false; code: CodeDoleance }>;
};

/* Dépôt : clé et saisie contrôlées ici, tout le reste par la fonction SQL dans une seule transaction */
export async function deposer(
  depot: DepotDoleance,
  entree: { cle: string; saisie: unknown },
): Promise<{ ok: true; id: string; renvoi: boolean } | { ok: false; code: CodeDoleance; champs?: Partial<Record<ChampDoleance, string>> }> {
  if (!CLE_VALIDE.test(entree.cle)) return { ok: false, code: "cle_invalide" };
  const r = schemaDoleance.safeParse(entree.saisie);
  if (!r.success) return { ok: false, code: "texte_invalide", champs: erreursDoleance(entree.saisie) ?? undefined };
  const s = r.data;
  const autre = s.theme === AUTRE;
  return depot.deposer({
    cle: entree.cle,
    themeId: autre ? null : s.theme,
    themePropose: autre && s.themePropose ? s.themePropose : null,
    texte: s.texte,
    solution: s.solution || null,
    neJamaisPublier: s.neJamaisPublier,
    limiteParJour: LIMITE_PAR_JOUR,
  });
}

/* Libellé du thème d'une doléance : le thème, ou « Autre », avec le thème proposé s'il y en a un */
export function libelleTheme(theme: string | null, themePropose: string | null): string {
  if (theme) return theme;
  return themePropose ? `Autre (« ${themePropose} »)` : "Autre";
}
