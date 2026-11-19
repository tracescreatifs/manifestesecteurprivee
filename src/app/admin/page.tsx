import type { Metadata } from "next";

import { AFaireMaintenant } from "@/components/admin/a-faire";
import { ActualisationAuto } from "@/components/admin/actualisation-auto";
import { ligneEtat, signaturesCloses } from "@/lib/admin/calculs";
import { lireCadreAdmin, lireTableauDeBord } from "@/lib/admin/tableau-de-bord";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";

import {
  CarteActions,
  CarteAvantGel,
  CarteCloture,
  CarteDoleances,
  CarteParcours,
  CarteSignatures,
  CarteTaux,
} from "./cartes-tableau";

export const metadata: Metadata = { title: "Tableau de bord" };

/*
  Tableau de bord (R1), page d'arrivée de l'espace admin : vue d'ensemble de la campagne, valeurs réelles lues
  en base à chaque requête, relues toutes les 30 secondes tant que l'onglet est visible (comme D117).
  Avant le gel : un état propre, jamais de chiffre de signature inventé.
*/
export default async function TableauDeBordAdmin() {
  await exigerSessionAdmin();
  const supabase = await creerClientServeur();
  const d = await lireTableauDeBord(supabase);

  if (!d) {
    return (
      <p role="alert" className="text-erreur">
        Le Manifeste n&apos;existe pas encore en base : exécutez supabase/seed/0001_referentiels.sql.
      </p>
    );
  }

  const cadre = await lireCadreAdmin(supabase, d.manifesteId);
  const maintenant = new Date();
  const avantGel = d.statut === "redaction";

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h1 className="font-titre text-[34px] leading-tight font-light tracking-[-0.01em] min-[820px]:text-[40px]">Vue d&apos;ensemble</h1>
            <p className="mt-1 text-texte-secondaire">{ligneEtat(d)}</p>
          </div>
          <ActualisationAuto lueLe={d.lueLe} />
        </div>
        {/* « À faire maintenant » : une ligne, sous la ligne d'état, sur ordinateur comme sur téléphone (R2) */}
        <AFaireMaintenant donnees={cadre} relanceOuverte={d.statut === "gele" && !signaturesCloses(d.statut, d.dateLimite, maintenant)} />
      </div>

      <div className="@container">
        <div className="grid gap-4 @[560px]:grid-cols-2 @[860px]:grid-cols-3">
          {avantGel ? <CarteAvantGel invites={d.parcours.total} /> : <CarteSignatures d={d} />}
          <CarteCloture d={d} maintenant={maintenant} />
          {avantGel ? null : (
            <>
              <CarteParcours d={d} />
              <CarteTaux d={d} />
            </>
          )}
          <CarteDoleances d={d} />
          <CarteActions d={d} maintenant={maintenant} />
        </div>
      </div>
    </div>
  );
}
