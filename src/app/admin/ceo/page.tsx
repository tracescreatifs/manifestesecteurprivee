import type { Metadata } from "next";

import { lireMaillons, lireListeCeo } from "@/lib/ceo/serveur";
import { formaterDateLimite } from "@/lib/ceo/message";
import { lireSiteUrl } from "@/lib/env";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireManifeste } from "@/lib/texte/serveur";

import { TableauCeo } from "./tableau-ceo";

export const metadata: Metadata = { title: "CEO" };

/* Rubrique CEO, onglet « Liste et suivi ». « À vérifier » et « Commentaires » arriveront au prompt 07. */
export default async function PageCeo() {
  await exigerSessionAdmin();
  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);

  if (!manifeste) {
    return (
      <p role="alert" className="text-erreur">
        Le Manifeste n&apos;existe pas encore en base : exécutez supabase/seed/0001_referentiels.sql.
      </p>
    );
  }

  const [{ lignes, recentes }, maillons] = await Promise.all([
    lireListeCeo(supabase, manifeste.id),
    lireMaillons(supabase),
  ]);

  let siteUrl: string | null = null;
  try {
    siteUrl = lireSiteUrl();
  } catch {
    siteUrl = null;
  }

  return (
    <TableauCeo
      lignes={lignes}
      recentes={recentes}
      maillons={maillons.map((m) => m.libelle)}
      statutManifeste={manifeste.statut}
      siteUrl={siteUrl}
      modele={manifeste.modele_message_whatsapp}
      dateLimite={formaterDateLimite(manifeste.date_limite)}
      lienOuvertActif={manifeste.lien_ouvert_actif}
    />
  );
}
