import type { Metadata } from "next";
import type { ReactNode } from "react";

import { BarreEtapes } from "@/components/admin/barre-etapes";
import { Marque } from "@/components/marque";
import { compterDoleancesNonLues } from "@/lib/doleances/admin";
import { compterAVerifier } from "@/lib/verification/serveur";
import { NavBasse, NavLaterale } from "@/components/admin/navigation";
import { exigerSessionAdmin } from "@/lib/session-admin";
import { creerClientServeur } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Espace admin" };

/*
  Toute la zone /admin : vérifie côté serveur, à chaque requête,
  que l'utilisateur est un admin actif connecté depuis moins de 30 jours.
*/
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const admin = await exigerSessionAdmin();
  const supabase = await creerClientServeur();
  const { data: manifeste } = await supabase
    .from("manifestes")
    .select("id, statut")
    .order("cree_le", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: courante } = manifeste
    ? await supabase
        .from("manifeste_versions")
        .select("numero")
        .eq("manifeste_id", manifeste.id)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  /* Signatures à vérifier, affichées à côté de « CEO » dans la navigation */
  /* Doléances non lues, à côté de « Doléances » (0 tant que la migration 0009 n'est pas exécutée) */
  const [aVerifier, nonLues] = manifeste
    ? await Promise.all([compterAVerifier(supabase, manifeste.id), compterDoleancesNonLues(supabase, manifeste.id)])
    : [0, 0];

  return (
    <div data-ambiance="admin" className="min-h-dvh min-[820px]:grid min-[820px]:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-0.5 border-r border-filet bg-sureleve px-3 py-4 min-[820px]:flex">
        <div className="px-2 pt-1 pb-5">
          <Marque deuxLignes />
        </div>
        <NavLaterale aVerifier={aVerifier} nonLues={nonLues} />
      </aside>

      <section className="min-w-0 px-4 pt-4 pb-24 min-[820px]:px-8 min-[820px]:pt-6">
        {/* Sur téléphone, la barre latérale est masquée : la marque passe en tête de page */}
        <header className="mb-3 min-[820px]:hidden">
          <Marque deuxLignes />
        </header>
        <BarreEtapes
          statut={manifeste?.statut ?? "redaction"}
          versionCourante={courante?.numero ?? null}
          admin={{ prenom: admin.prenom, nom: admin.nom, email: admin.email }}
        />
        {children}
      </section>

      <NavBasse aVerifier={aVerifier} nonLues={nonLues} />
    </div>
  );
}
