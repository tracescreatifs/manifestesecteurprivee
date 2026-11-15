"use server";

import { headers } from "next/headers";

import { genererCodeParrainage, genererJeton } from "@/lib/ceo/jetons";
import { lireSupabaseCleSecrete } from "@/lib/env";
import { adresseDuClient, empreinteAdresse, inscrire, type CodeInscription } from "@/lib/signature/inscription";
import type { Champ } from "@/lib/signature/regles";
import { schemaSaisie } from "@/lib/signature/saisie";
import { creerDepotInscription, lirePageRejoindre } from "@/lib/signature/serveur";
import { creerClientAdmin } from "@/lib/supabase/admin";

/*
  Inscription par le lien ouvert ou par parrainage, à la fin de l'étape 1.
  Le serveur crée l'entreprise, la personne et l'invitation, puis renvoie le jeton du nouveau lien personnel
  au CEO qui vient de s'inscrire (jamais celui d'un autre). On ne révèle jamais qu'un numéro ou une entreprise
  existe déjà. Anti-abus : champ piège et limite par empreinte d'adresse (jamais l'adresse elle-même).
*/

const MESSAGES: Record<CodeInscription, string> = {
  pas_ouvert: "Le Manifeste n'est pas encore ouvert à la signature.",
  signatures_closes: "Les signatures sont closes.",
  lien_en_pause: "Les inscriptions sont momentanément en pause.",
  limite_atteinte:
    "Trop d'inscriptions ont été faites depuis cette connexion. Réessayez dans une heure, ou écrivez à la Task Force avec « Une question ? ».",
  refuse: "L'inscription n'a pas pu être enregistrée.",
  cle_invalide: "L'inscription n'a pas pu être enregistrée. Rechargez la page, puis réessayez.",
  echec: "L'inscription n'a pas pu être enregistrée. Réessayez.",
};

export type ResultatInscription =
  | { ok: true; jeton: string }
  | { ok: false; erreur: string; champs?: Partial<Record<Champ, string>> };

export async function inscrireCeo(entree: {
  /* Clé anti-doublon tirée dans le navigateur, la même à chaque nouvel essai (D102) */
  cle: string;
  saisie: Record<string, string>;
  invitePar: string;
  codeParrain: string;
  piege: string;
}): Promise<ResultatInscription> {
  const page = await lirePageRejoindre(null);
  if (!page) return { ok: false, erreur: MESSAGES.echec };

  const { data: maillons } = await creerClientAdmin().from("maillons").select("libelle").eq("actif", true);
  const saisie = schemaSaisie((maillons ?? []).map((m) => m.libelle)).safeParse(entree.saisie);
  if (!saisie.success) {
    const champs: Partial<Record<Champ, string>> = {};
    saisie.error.issues.forEach((i) => {
      const champ = i.path[0] as Champ;
      if (!champs[champ]) champs[champ] = i.message;
    });
    return { ok: false, erreur: "Vérifiez vos informations.", champs };
  }

  let secret: string;
  try {
    secret = lireSupabaseCleSecrete();
  } catch {
    return { ok: false, erreur: MESSAGES.echec };
  }
  const empreinte = empreinteAdresse(adresseDuClient(await headers()), secret, new Date());

  const r = await inscrire(
    creerDepotInscription(page.manifesteId),
    {
      cle: String(entree.cle ?? ""),
      saisie: saisie.data,
      invitePar: String(entree.invitePar ?? ""),
      codeParrain: String(entree.codeParrain ?? ""),
      piege: String(entree.piege ?? ""),
      empreinte,
    },
    { jeton: genererJeton, code: genererCodeParrainage },
  );
  return r.ok ? r : { ok: false, erreur: MESSAGES[r.code] };
}
