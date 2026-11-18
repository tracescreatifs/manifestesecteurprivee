import { Download, ListTodo, Tags } from "lucide-react";
import type { Metadata } from "next";

import { classesBouton } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { formaterDateLimite } from "@/lib/ceo/message";
import { lireDoleancesAdmin } from "@/lib/doleances/admin";
import { etatDoleances } from "@/lib/doleances/regles";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";
import { lireManifeste } from "@/lib/texte/serveur";
import type { StatutManifeste } from "@/types/database";

import { ListeDoleances } from "./liste-doleances";
import { ThemesDoleances } from "./themes-doleances";

export const metadata: Metadata = { title: "Doléances" };

/* Ouverture du dépôt, en heure de Dakar et d'Abu Dhabi (D105) */
function phraseOuverture(statut: StatutManifeste, cloture: string): string {
  const etat = etatDoleances(statut, cloture, new Date());
  if (etat === "pas_ouvert") return `Le dépôt s'ouvre au gel du texte et se ferme le ${formaterDateLimite(cloture)}.`;
  if (etat === "clos") return `Le dépôt est clos depuis le ${formaterDateLimite(cloture)}.`;
  return `Dépôt ouvert jusqu'au ${formaterDateLimite(cloture)}.`;
}

/*
  Rubrique Doléances (prompt 09a) : doléances privées déposées par les CEO depuis leur lien,
  lues par les admins seuls. La publication anonyme, les soutiens et le classement viendront au prompt 09b.
*/
export default async function PageDoleances({ searchParams }: { searchParams: Promise<{ onglet?: string; lecture?: string }> }) {
  await exigerSessionAdmin();
  const { onglet, lecture } = await searchParams;
  const actif = onglet === "themes" ? "themes" : "liste";
  const supabase = await creerClientServeur();
  const manifeste = await lireManifeste(supabase);

  const entete = (description: string | null) => (
    <div>
      <h2 className="font-titre text-[22px] font-normal tracking-[-0.01em]">Doléances</h2>
      <p className="mt-1 max-w-[70ch] text-texte-secondaire">
        Difficultés que les CEO rencontrent dans leur entreprise ou dans le secteur, déposées depuis leur lien, qu&apos;ils
        aient signé ou non. Lues par les admins seulement, jamais par les autres CEO.
        {description ? ` ${description}` : ""}
      </p>
    </div>
  );

  if (!manifeste) {
    return (
      <p role="alert" className="text-erreur">
        Le Manifeste n&apos;existe pas encore en base : exécutez supabase/seed/0001_referentiels.sql.
      </p>
    );
  }

  const donnees = await lireDoleancesAdmin(supabase, manifeste.id);
  if (!donnees.disponible) {
    return (
      <>
        <div className="mb-4">{entete(null)}</div>
        <p role="alert" className="max-w-[70ch] rounded-[10px] bg-erreur-doux px-4 py-3 text-[14.5px] text-[#7a2a1d]">
          La rubrique attend sa migration. Dans le SQL Editor de Supabase, exécutez supabase/migrations/0009_doleances.sql,
          puis supabase/seed/0003_themes_doleances.sql, et rechargez cette page.
        </p>
      </>
    );
  }

  const nonLues = donnees.doleances.filter((d) => !d.lueLe).length;
  const ouverture = phraseOuverture(manifeste.statut, donnees.cloture);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        {entete(ouverture)}
        <a href="/admin/doleances/export" download className={classesBouton("secondaire")}>
          <Download aria-hidden="true" strokeWidth={1.75} />
          Exporter les doléances
        </a>
      </div>
      <Tabs
        libelle="Rubrique Doléances"
        actif={actif}
        onglets={[
          {
            cle: "liste",
            libelle: "Doléances",
            href: "/admin/doleances",
            icone: ListTodo,
            pastille: { nombre: nonLues, variante: "neutre", titre: "Non lues" },
          },
          { cle: "themes", libelle: "Thèmes", href: "/admin/doleances?onglet=themes", icone: Tags },
        ]}
      />
      {actif === "themes" ? (
        <ThemesDoleances themes={donnees.themes} />
      ) : (
        <ListeDoleances
          doleances={donnees.doleances}
          themes={donnees.themes}
          lectureInitiale={lecture === "non_lues" || lecture === "lues" ? lecture : "toutes"}
        />
      )}
    </>
  );
}
